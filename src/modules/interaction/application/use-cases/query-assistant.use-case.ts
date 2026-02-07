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
import type {
  RagQueryInput,
  RagQueryOutput,
} from '@shared/genkit/flows/rag-query.flow';

// Constants
const DEFAULT_CONTEXT_MESSAGE_LIMIT = 10;

/**
 * Safely execute RAG query and validate result
 * This wrapper ensures type safety for the RAG query result
 */
async function safeExecuteRagQuery(
  ragQueryFn: RagQueryFlowFunction,
  input: RagQueryInput,
): Promise<{
  response: string;
  sources: Array<{
    id: string;
    content: string;
    similarity: number;
    sourceId: string;
    metadata?: Record<string, unknown>;
  }>;
  timestamp: Date;
  conversationId?: string;
}> {
  const result: unknown = await ragQueryFn(input);

  // Validate result structure
  if (!result || typeof result !== 'object') {
    throw new Error('Invalid RAG query result: result is not an object');
  }

  const resultObj = result as Record<string, unknown>;

  if (typeof resultObj.response !== 'string') {
    throw new Error('Invalid RAG query result: response is not a string');
  }

  if (!Array.isArray(resultObj.sources)) {
    throw new Error('Invalid RAG query result: sources is not an array');
  }

  if (!(resultObj.timestamp instanceof Date)) {
    throw new Error('Invalid RAG query result: timestamp is not a Date');
  }

  return {
    response: resultObj.response,
    sources: (resultObj.sources as unknown[]).map((s: unknown) => {
      const source = s as Record<string, unknown>;
      return {
        id: String(source.id),
        content: String(source.content),
        similarity: Number(source.similarity),
        sourceId: String(source.sourceId),
        metadata: source.metadata as Record<string, unknown> | undefined,
      };
    }),
    timestamp: resultObj.timestamp,
    conversationId: resultObj.conversationId as string | undefined,
  };
}

export interface QueryAssistantInput {
  userId: string;
  sectorId: string;
  query: string;
  conversationId?: string;
  maxResults?: number;
  minSimilarity?: number;
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
      sectorId: input.sectorId,
      conversationId: conversation.id,
      ...(input.maxResults !== undefined && { maxResults: input.maxResults }),
      ...(input.minSimilarity !== undefined && {
        minSimilarity: input.minSimilarity,
      }),
    } as RagQueryInput;

    const ragResult = await safeExecuteRagQuery(
      this.ragQueryFlow,
      ragQueryInput,
    );

    // 5. Add assistant message to conversation
    const sourceFragmentIds = ragResult.sources.map((s) => s.id);

    const assistantMessage = new Message({
      conversationId: conversation.id,
      role: 'assistant',
      content: ragResult.response,
      metadata: {
        sourceFragments: sourceFragmentIds,
        sourcesCount: ragResult.sources.length,
      },
    });
    conversation.addMessage(assistantMessage);

    // 6. Save conversation with messages
    await this.conversationRepository.save(conversation);

    // 7. Return formatted response
    const response: QueryAssistantOutput = {
      response: ragResult.response,
      conversationId: conversation.id,
      sources: ragResult.sources,
      timestamp: ragResult.timestamp,
    };

    return response;
  }

  /**
   * Validate input parameters
   */
  private validateInput(input: QueryAssistantInput): void {
    if (!input.userId || input.userId.trim() === '') {
      throw new Error('User ID is required');
    }

    if (!input.sectorId || input.sectorId.trim() === '') {
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
        input.userId,
        input.sectorId,
      );

    if (existingConversation) {
      return existingConversation;
    }

    // Create new conversation
    return new Conversation({
      userId: input.userId,
      sectorId: input.sectorId,
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
