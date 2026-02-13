/**
 * Query Assistant Use Case
 *
 * Orchestrates the interaction between user and assistant using RAG.
 * Manages conversation history and integrates with the RAG query flow.
 */

import { Injectable } from '@nestjs/common';
import type { IConversationRepository } from '../../domain/repositories/conversation.repository.interface';
import { Conversation } from '../../domain/entities/conversation.entity';
import { Message } from '../../domain/entities/message.entity';
import type { UserContext } from '../../domain/value-objects/user-context.vo';
import type {
  RagQueryInput,
  RagQueryOutput,
} from '@shared/genkit/flows/rag-query.flow';
import { ragQueryOutputSchema } from '@shared/genkit/flows/rag-query.flow';

// Constants
const DEFAULT_CONTEXT_MESSAGE_LIMIT = 10;

/**
 * Safely execute RAG query and validate result using Zod schema.
 * Uses ragQueryOutputSchema.parse() for type-safe validation instead of
 * manual property-by-property checks.
 */
async function safeExecuteRagQuery(
  ragQueryFn: RagQueryFlowFunction,
  input: RagQueryInput,
): Promise<RagQueryOutput> {
  const result: unknown = await ragQueryFn(input);

  // Validate result structure using Zod schema (single source of truth)
  return ragQueryOutputSchema.parse(result);
}

/**
 * Search configuration options for the RAG query
 */
export interface SearchOptions {
  maxResults?: number;
  minSimilarity?: number;
}

export interface QueryAssistantInput {
  userContext: UserContext;
  query: string;
  conversationId?: string;
  searchOptions?: SearchOptions;
}

/**
 * Evaluation score for a single metric
 */
export interface EvaluationScoreOutput {
  score: number;
  status: 'PASS' | 'FAIL' | 'UNKNOWN';
  reasoning: string;
}

/**
 * RAG evaluation results
 */
export interface EvaluationOutput {
  faithfulness: EvaluationScoreOutput;
  relevancy: EvaluationScoreOutput;
}

export interface QueryAssistantOutput {
  response: string;
  conversationId: string;
  sources: Array<{
    id: string;
    content: string;
    sourceId: string;
    similarity: number;
    metadata?: Record<string, unknown>;
  }>;
  timestamp: Date;
  evaluation?: EvaluationOutput;
}

export type RagQueryFlowFunction = (
  input: RagQueryInput,
) => Promise<RagQueryOutput>;

@Injectable()
export class QueryAssistantUseCase {
  constructor(
    private readonly conversationRepository: IConversationRepository,
    private readonly ragQueryFlow: RagQueryFlowFunction,
  ) {}

  /**
   * Execute the query assistant use case
   * @param input - Query parameters
   * @returns Assistant response with metadata
   */
  async execute(input: QueryAssistantInput): Promise<QueryAssistantOutput> {
    // Validate input
    this.validateInput(input);

    // 1. Get or create conversation
    const conversation = await this.getOrCreateConversation(input);

    // 2. Add user message to conversation
    const userMessage = new Message({
      conversationId: conversation.id,
      role: 'user',
      content: input.query,
    });
    conversation.addMessage(userMessage);

    // 3. Build query with conversation context
    const contextualQuery = this.buildContextualQuery(
      conversation,
      input.query,
    );

    // 4. Execute RAG query flow with type-safe wrapper
    const ragQueryInput = {
      query: contextualQuery,
      sectorId: input.userContext.sectorId,
      conversationId: conversation.id,
      ...(input.searchOptions?.maxResults !== undefined && {
        maxResults: input.searchOptions.maxResults,
      }),
      ...(input.searchOptions?.minSimilarity !== undefined && {
        minSimilarity: input.searchOptions.minSimilarity,
      }),
    } as RagQueryInput;

    const ragResult = await safeExecuteRagQuery(
      this.ragQueryFlow,
      ragQueryInput,
    );

    // 5. Add assistant message to conversation with evaluation scores
    const sourceFragmentIds = ragResult.sources.map((s) => s.id);

    const messageMetadata: Record<string, unknown> = {
      sourceFragments: sourceFragmentIds,
      sourcesCount: ragResult.sources.length,
    };

    // Store evaluation scores in message metadata if available
    if (ragResult.evaluation) {
      messageMetadata.evaluation = {
        faithfulness: {
          score: ragResult.evaluation.faithfulness.score,
          status: ragResult.evaluation.faithfulness.status,
          reasoning: ragResult.evaluation.faithfulness.reasoning,
        },
        relevancy: {
          score: ragResult.evaluation.relevancy.score,
          status: ragResult.evaluation.relevancy.status,
          reasoning: ragResult.evaluation.relevancy.reasoning,
        },
      };
    }

    const assistantMessage = new Message({
      conversationId: conversation.id,
      role: 'assistant',
      content: ragResult.response,
      metadata: messageMetadata,
    });
    conversation.addMessage(assistantMessage);

    // 6. Save conversation with messages
    await this.conversationRepository.save(conversation);

    // 7. Return formatted response with evaluation
    const response: QueryAssistantOutput = {
      response: ragResult.response,
      conversationId: conversation.id,
      sources: ragResult.sources,
      timestamp: ragResult.timestamp,
      evaluation: ragResult.evaluation,
    };

    return response;
  }

  /**
   * Validate input parameters
   */
  private validateInput(input: QueryAssistantInput): void {
    if (!input.userContext?.userId || input.userContext.userId.trim() === '') {
      throw new Error('User ID is required');
    }

    if (
      !input.userContext?.sectorId ||
      input.userContext.sectorId.trim() === ''
    ) {
      throw new Error('Sector ID is required');
    }

    if (!input.query || input.query.trim() === '') {
      throw new Error('Query is required');
    }
  }

  /**
   * Get existing conversation or create a new one
   */
  private async getOrCreateConversation(
    input: QueryAssistantInput,
  ): Promise<Conversation> {
    // If conversationId is provided, fetch that specific conversation
    if (input.conversationId) {
      const conversation = await this.conversationRepository.findById(
        input.conversationId,
      );

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      return conversation;
    }

    // Otherwise, get or create conversation for user and sector
    const existingConversation =
      await this.conversationRepository.findByUserAndSector(
        input.userContext.userId,
        input.userContext.sectorId,
      );

    if (existingConversation) {
      return existingConversation;
    }

    // Create new conversation
    return new Conversation({
      userId: input.userContext.userId,
      sectorId: input.userContext.sectorId,
    });
  }

  /**
   * Build query with conversation context
   * Combines current query with recent conversation history
   */
  private buildContextualQuery(
    conversation: Conversation,
    currentQuery: string,
  ): string {
    if (!conversation.hasMessages()) {
      return currentQuery;
    }

    // Get recent conversation context
    const context = conversation.getContextForPrompt(
      DEFAULT_CONTEXT_MESSAGE_LIMIT,
    );

    // Combine context with current query
    if (context) {
      return `${context}\nUser: ${currentQuery}`;
    }

    return currentQuery;
  }
}
