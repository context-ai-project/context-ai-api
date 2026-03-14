import { InteractionDtoMapper } from '../../../../../../src/modules/interaction/presentation/mappers/interaction-dto.mapper';
import { Conversation } from '../../../../../../src/modules/interaction/domain/entities/conversation.entity';
import { Message } from '../../../../../../src/modules/interaction/domain/entities/message.entity';
import { RagResponseType } from '../../../../../../src/modules/interaction/presentation/dtos/query-assistant.dto';

const CONVERSATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const SECTOR_ID = '770e8400-e29b-41d4-a716-446655440002';

function createMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
): Message {
  return new Message({
    conversationId,
    role,
    content,
    createdAt: new Date('2026-01-15T12:00:00Z'),
  });
}

function createConversation(messages: Message[] = []): Conversation {
  return new Conversation({
    id: CONVERSATION_ID,
    userId: USER_ID,
    sectorId: SECTOR_ID,
    messages,
    createdAt: new Date('2026-01-15T10:00:00Z'),
    updatedAt: new Date('2026-01-15T12:00:00Z'),
  });
}

describe('InteractionDtoMapper', () => {
  describe('toQueryResponse', () => {
    it('should map a basic response with no evaluation or structured data', () => {
      const result = InteractionDtoMapper.toQueryResponse({
        response: 'Hello!',
        responseType: 'answer',
        conversationId: CONVERSATION_ID,
        sources: [
          {
            id: 'src-1',
            content: 'content',
            sourceId: 'ks-1',
            similarity: 0.95,
            metadata: {},
          },
        ],
        timestamp: new Date('2026-01-15T12:00:00Z'),
      });

      expect(result.response).toBe('Hello!');
      expect(result.responseType).toBe(RagResponseType.ANSWER);
      expect(result.structured).toBeUndefined();
      expect(result.evaluation).toBeUndefined();
      expect(result.sources).toHaveLength(1);
    });

    it('should map evaluation data when present', () => {
      const result = InteractionDtoMapper.toQueryResponse({
        response: 'Answer',
        responseType: 'answer',
        conversationId: CONVERSATION_ID,
        sources: [],
        timestamp: new Date(),
        evaluation: {
          faithfulness: { score: 0.9, status: 'pass', reasoning: 'Good' },
          relevancy: { score: 0.8, status: 'pass', reasoning: 'Relevant' },
        },
      });

      expect(result.evaluation).toBeDefined();
      expect(result.evaluation!.faithfulness.score).toBe(0.9);
      expect(result.evaluation!.relevancy.status).toBe('pass');
    });

    it('should map structured response when present', () => {
      const result = InteractionDtoMapper.toQueryResponse({
        response: 'Answer',
        responseType: 'answer',
        conversationId: CONVERSATION_ID,
        sources: [],
        timestamp: new Date(),
        structured: {
          summary: 'Summary text',
          sections: [
            { title: 'Section 1', content: 'Content 1', type: 'text' },
          ],
          keyPoints: ['Key point 1'],
          relatedTopics: ['Topic 1'],
        },
      });

      expect(result.structured).toBeDefined();
      expect(result.structured!.summary).toBe('Summary text');
      expect(result.structured!.sections).toHaveLength(1);
      expect(result.structured!.keyPoints).toEqual(['Key point 1']);
    });

    it('should map responseType "no_context" correctly', () => {
      const result = InteractionDtoMapper.toQueryResponse({
        response: 'No context',
        responseType: 'no_context',
        conversationId: CONVERSATION_ID,
        sources: [],
        timestamp: new Date(),
      });

      expect(result.responseType).toBe(RagResponseType.NO_CONTEXT);
    });

    it('should map responseType "conversational" correctly', () => {
      const result = InteractionDtoMapper.toQueryResponse({
        response: 'Hi',
        responseType: 'conversational',
        conversationId: CONVERSATION_ID,
        sources: [],
        timestamp: new Date(),
      });

      expect(result.responseType).toBe(RagResponseType.CONVERSATIONAL);
    });

    it('should map responseType "error" correctly', () => {
      const result = InteractionDtoMapper.toQueryResponse({
        response: 'Error',
        responseType: 'error',
        conversationId: CONVERSATION_ID,
        sources: [],
        timestamp: new Date(),
      });

      expect(result.responseType).toBe(RagResponseType.ERROR);
    });

    it('should default to ANSWER for unknown responseType', () => {
      const result = InteractionDtoMapper.toQueryResponse({
        response: 'Test',
        responseType: 'unknown_type' as string,
        conversationId: CONVERSATION_ID,
        sources: [],
        timestamp: new Date(),
      });

      expect(result.responseType).toBe(RagResponseType.ANSWER);
    });
  });

  describe('toConversationSummary', () => {
    it('should map conversation without messages', () => {
      const conversation = createConversation();
      const dto = InteractionDtoMapper.toConversationSummary(conversation);

      expect(dto.id).toBe(CONVERSATION_ID);
      expect(dto.userId).toBe(USER_ID);
      expect(dto.sectorId).toBe(SECTOR_ID);
      expect(dto.title).toBeUndefined();
      expect(dto.messageCount).toBe(0);
      expect(dto.lastMessagePreview).toBeUndefined();
    });

    it('should include title from first user message', () => {
      const messages = [
        createMessage(CONVERSATION_ID, 'user', 'What is AI?'),
        createMessage(CONVERSATION_ID, 'assistant', 'AI is...'),
      ];
      const conversation = createConversation(messages);
      const dto = InteractionDtoMapper.toConversationSummary(conversation);

      expect(dto.title).toBe('What is AI?');
      expect(dto.messageCount).toBe(2);
    });

    it('should truncate long titles', () => {
      const longContent = 'A'.repeat(100);
      const messages = [
        createMessage(CONVERSATION_ID, 'user', longContent),
      ];
      const conversation = createConversation(messages);
      const dto = InteractionDtoMapper.toConversationSummary(conversation);

      expect(dto.title!.length).toBeLessThanOrEqual(80);
      expect(dto.title!.endsWith('...')).toBe(true);
    });

    it('should return undefined title when no user messages exist', () => {
      const messages = [
        createMessage(CONVERSATION_ID, 'system', 'System prompt'),
        createMessage(CONVERSATION_ID, 'assistant', 'Hello!'),
      ];
      const conversation = createConversation(messages);
      const dto = InteractionDtoMapper.toConversationSummary(conversation);

      expect(dto.title).toBeUndefined();
    });
  });

  describe('toConversationsList', () => {
    it('should map conversations to list DTO', () => {
      const conversations = [createConversation(), createConversation()];
      const dto = InteractionDtoMapper.toConversationsList(conversations, 10, 0);

      expect(dto.conversations).toHaveLength(2);
      expect(dto.total).toBe(10);
      expect(dto.count).toBe(2);
      expect(dto.offset).toBe(0);
      expect(dto.hasMore).toBe(true);
    });

    it('should set hasMore to false when all items returned', () => {
      const conversations = [createConversation()];
      const dto = InteractionDtoMapper.toConversationsList(conversations, 1, 0);

      expect(dto.hasMore).toBe(false);
    });
  });

  describe('toConversationDetail', () => {
    it('should map conversation with messages to detail DTO', () => {
      const messages = [
        createMessage(CONVERSATION_ID, 'user', 'Hello'),
        createMessage(CONVERSATION_ID, 'assistant', 'Hi!'),
      ];
      const conversation = createConversation(messages);
      const dto = InteractionDtoMapper.toConversationDetail(conversation);

      expect(dto.id).toBe(CONVERSATION_ID);
      expect(dto.messages).toHaveLength(2);
      expect(dto.messages[0].role).toBe('user');
      expect(dto.messages[0].content).toBe('Hello');
    });
  });
});
