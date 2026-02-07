import { describe, it, expect } from '@jest/globals';
import { MessageMapper } from '@modules/interaction/infrastructure/persistence/mappers/message.mapper';
import { Message } from '@modules/interaction/domain/entities/message.entity';
import { MessageModel } from '@modules/interaction/infrastructure/persistence/models/message.model';
import { ConversationModel } from '@modules/interaction/infrastructure/persistence/models/conversation.model';

describe('MessageMapper', () => {
  const testConversationId = 'conv-123';

  describe('toDomain', () => {
    it('should map model to domain entity', () => {
      const model: MessageModel = {
        id: 'msg-1',
        conversationId: testConversationId,
        role: 'user',
        content: 'Hello, how are you?',
        metadata: null,
        createdAt: new Date('2024-01-01'),
        conversation: {} as ConversationModel,
      };

      const entity = MessageMapper.toDomain(model);

      expect(entity).toBeInstanceOf(Message);
      expect(entity.id).toBe('msg-1');
      expect(entity.conversationId).toBe(testConversationId);
      expect(entity.role).toBe('user');
      expect(entity.content).toBe('Hello, how are you?');
      expect(entity.metadata).toBeUndefined();
      expect(entity.createdAt).toEqual(new Date('2024-01-01'));
    });

    it('should map model with metadata to domain entity', () => {
      const metadata = {
        sourceFragments: ['frag-1', 'frag-2'],
        sentiment: 0.8,
      };

      const model: MessageModel = {
        id: 'msg-1',
        conversationId: testConversationId,
        role: 'assistant',
        content: 'Test response',
        metadata,
        createdAt: new Date('2024-01-01'),
        conversation: {} as ConversationModel,
      };

      const entity = MessageMapper.toDomain(model);

      expect(entity.metadata).toEqual(metadata);
      expect(entity.getMetadata('sourceFragments')).toEqual([
        'frag-1',
        'frag-2',
      ]);
      expect(entity.getMetadata('sentiment')).toBe(0.8);
    });

    it('should map assistant role correctly', () => {
      const model: MessageModel = {
        id: 'msg-1',
        conversationId: testConversationId,
        role: 'assistant',
        content: 'Assistant response',
        metadata: null,
        createdAt: new Date(),
        conversation: {} as ConversationModel,
      };

      const entity = MessageMapper.toDomain(model);

      expect(entity.role).toBe('assistant');
      expect(entity.isFromAssistant()).toBe(true);
      expect(entity.isFromUser()).toBe(false);
    });

    it('should map system role correctly', () => {
      const model: MessageModel = {
        id: 'msg-1',
        conversationId: testConversationId,
        role: 'system',
        content: 'System message',
        metadata: null,
        createdAt: new Date(),
        conversation: {} as ConversationModel,
      };

      const entity = MessageMapper.toDomain(model);

      expect(entity.role).toBe('system');
      expect(entity.isSystemMessage()).toBe(true);
    });
  });

  describe('toModel', () => {
    it('should map new domain entity to model', () => {
      const entity = new Message({
        conversationId: testConversationId,
        role: 'user',
        content: 'Test message',
      });

      const model = MessageMapper.toModel(entity);

      expect(model).toBeInstanceOf(MessageModel);
      expect(model.conversationId).toBe(testConversationId);
      expect(model.role).toBe('user');
      expect(model.content).toBe('Test message');
      expect(model.metadata).toBeNull();
      expect(model.createdAt).toBeInstanceOf(Date);
    });

    it('should map existing domain entity with id to model', () => {
      const entity = new Message({
        id: 'msg-123',
        conversationId: testConversationId,
        role: 'user',
        content: 'Test message',
      });

      const model = MessageMapper.toModel(entity);

      expect(model.id).toBe('msg-123');
    });

    it('should map domain entity with metadata to model', () => {
      const metadata = {
        sourceFragments: ['frag-1', 'frag-2'],
        sourcesCount: 2,
      };

      const entity = new Message({
        conversationId: testConversationId,
        role: 'assistant',
        content: 'Response with sources',
        metadata,
      });

      const model = MessageMapper.toModel(entity);

      expect(model.metadata).toEqual(metadata);
    });

    it('should preserve timestamps from domain entity', () => {
      const createdAt = new Date('2024-01-01');

      const entity = new Message({
        conversationId: testConversationId,
        role: 'user',
        content: 'Test',
        createdAt,
      });

      const model = MessageMapper.toModel(entity);

      expect(model.createdAt).toEqual(createdAt);
    });

    it('should handle all role types', () => {
      const userMessage = new Message({
        conversationId: testConversationId,
        role: 'user',
        content: 'User message',
      });

      const assistantMessage = new Message({
        conversationId: testConversationId,
        role: 'assistant',
        content: 'Assistant message',
      });

      const systemMessage = new Message({
        conversationId: testConversationId,
        role: 'system',
        content: 'System message',
      });

      const userModel = MessageMapper.toModel(userMessage);
      const assistantModel = MessageMapper.toModel(assistantMessage);
      const systemModel = MessageMapper.toModel(systemMessage);

      expect(userModel.role).toBe('user');
      expect(assistantModel.role).toBe('assistant');
      expect(systemModel.role).toBe('system');
    });
  });

  describe('Bidirectional Mapping', () => {
    it('should maintain data integrity through round-trip conversion', () => {
      const originalModel: MessageModel = {
        id: 'msg-1',
        conversationId: testConversationId,
        role: 'user',
        content: 'Original message',
        metadata: { testKey: 'testValue' },
        createdAt: new Date('2024-01-01'),
        conversation: {} as ConversationModel,
      };

      const entity = MessageMapper.toDomain(originalModel);
      const resultModel = MessageMapper.toModel(entity);

      expect(resultModel.id).toBe(originalModel.id);
      expect(resultModel.conversationId).toBe(originalModel.conversationId);
      expect(resultModel.role).toBe(originalModel.role);
      expect(resultModel.content).toBe(originalModel.content);
      expect(resultModel.metadata).toEqual(originalModel.metadata);
      expect(resultModel.createdAt).toEqual(originalModel.createdAt);
    });

    it('should handle metadata transformations', () => {
      const entity = new Message({
        conversationId: testConversationId,
        role: 'assistant',
        content: 'Test',
        metadata: {
          sourceFragments: ['a', 'b', 'c'],
          confidence: 0.95,
        },
      });

      const model = MessageMapper.toModel(entity);
      const roundTripEntity = MessageMapper.toDomain(model);

      expect(roundTripEntity.getMetadata('sourceFragments')).toEqual([
        'a',
        'b',
        'c',
      ]);
      expect(roundTripEntity.getMetadata('confidence')).toBe(0.95);
    });
  });
});

