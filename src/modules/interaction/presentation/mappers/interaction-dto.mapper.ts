import type { QueryAssistantOutput } from '../../application/use-cases/query-assistant.use-case';
import type { Conversation } from '../../domain/entities/conversation.entity';
import type {
  QueryAssistantResponseDto,
  SourceFragmentDto,
  ConversationSummaryDto,
  ConversationsListDto,
  ConversationDetailDto,
  MessageDto,
  EvaluationResultDto,
} from '../dtos/query-assistant.dto';

/**
 * Maps domain entities and use-case outputs to presentation DTOs.
 *
 * Keeps the controller thin by centralising all DTO-mapping logic here.
 */
export class InteractionDtoMapper {
  /** Map query use-case output → API response DTO */
  static toQueryResponse(
    result: QueryAssistantOutput,
  ): QueryAssistantResponseDto {
    const evaluationDto: EvaluationResultDto | undefined = result.evaluation
      ? {
          faithfulness: {
            score: result.evaluation.faithfulness.score,
            status: result.evaluation.faithfulness.status,
            reasoning: result.evaluation.faithfulness.reasoning,
          },
          relevancy: {
            score: result.evaluation.relevancy.score,
            status: result.evaluation.relevancy.status,
            reasoning: result.evaluation.relevancy.reasoning,
          },
        }
      : undefined;

    return {
      response: result.response,
      conversationId: result.conversationId,
      sources: result.sources.map(
        (source): SourceFragmentDto => ({
          id: source.id,
          content: source.content,
          sourceId: source.sourceId,
          similarity: source.similarity,
          metadata: source.metadata,
        }),
      ),
      timestamp: result.timestamp,
      evaluation: evaluationDto,
    };
  }

  /** Map a single Conversation entity → summary DTO (list view) */
  static toConversationSummary(
    conversation: Conversation,
  ): ConversationSummaryDto {
    const lastMessage = conversation.getLastMessages(1)[0];

    return {
      id: conversation.id,
      userId: conversation.userId,
      sectorId: conversation.sectorId,
      title: InteractionDtoMapper.generateTitle(conversation),
      isActive: conversation.isActive(),
      messageCount: conversation.getMessageCount(),
      lastMessagePreview: lastMessage?.content,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  /** Map a list of Conversations → paginated list DTO */
  static toConversationsList(
    conversations: Conversation[],
    total: number,
    offset: number,
  ): ConversationsListDto {
    const items = conversations.map((c) =>
      InteractionDtoMapper.toConversationSummary(c),
    );

    return {
      conversations: items,
      total,
      count: items.length,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  /** Map a Conversation entity with messages → detail DTO */
  static toConversationDetail(
    conversation: Conversation,
  ): ConversationDetailDto {
    const messageDtos: MessageDto[] = conversation.messages.map((msg) => ({
      id: msg.id ?? '',
      role: msg.role,
      content: msg.content,
      timestamp: msg.createdAt,
      metadata: msg.metadata,
    }));

    return {
      id: conversation.id,
      userId: conversation.userId,
      sectorId: conversation.sectorId,
      title: InteractionDtoMapper.generateTitle(conversation),
      isActive: conversation.isActive(),
      messages: messageDtos,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  /**
   * Generate a conversation title from the first user message.
   * Truncates to a reasonable length for display.
   * Returns undefined if no user messages exist.
   */
  private static readonly MAX_TITLE_LENGTH = 80;

  private static generateTitle(conversation: Conversation): string | undefined {
    if (!conversation.hasMessages()) {
      return undefined;
    }

    // Find the first user message for the conversation title
    const messages = conversation.messages;
    const firstUserMessage = messages.find((msg) => msg.isFromUser());
    if (!firstUserMessage) {
      return undefined;
    }

    const content = firstUserMessage.content;
    if (content.length <= InteractionDtoMapper.MAX_TITLE_LENGTH) {
      return content;
    }

    return (
      content.substring(0, InteractionDtoMapper.MAX_TITLE_LENGTH - 3) + '...'
    );
  }
}
