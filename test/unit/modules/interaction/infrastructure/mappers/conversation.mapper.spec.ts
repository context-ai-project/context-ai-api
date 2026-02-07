import { describe, it, expect } from '@jest/globals';
import { ConversationMapper } from '@modules/interaction/infrastructure/persistence/mappers/conversation.mapper';
import { Conversation } from '@modules/interaction/domain/entities/conversation.entity';
import { Message } from '@modules/interaction/domain/entities/message.entity';
import { ConversationModel } from '@modules/interaction/infrastructure/persistence/models/conversation.model';
import { MessageModel } from '@modules/interaction/infrastructure/persistence/models/message.model';

describe('ConversationMapper', () => {
  const testUserId = 'user-123';
  const testSectorId = 'sector-456';

  describe('toDomain', () => {
    it('should map model to domain entity without messages', () => {
      const model: ConversationModel = {
        id: 'conv-123',
        userId: testUserId,
        sectorId: testSectorId,
        messages: [],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        deletedAt: null,
      };

      const entity = ConversationMapper.toDomain(model);

      expect(entity).toBeInstanceOf(Conversation);
      expect(entity.id).toBe('conv-123');
      expect(entity.userId).toBe(testUserId);
      expect(entity.sectorId).toBe(testSectorId);
      expect(entity.messages).toEqual([]);
      expect(entity.createdAt).toEqual(new Date('2024-01-01'));
      expect(entity.updatedAt).toEqual(new Date('2024-01-02'));
    });

    it('should map model to domain entity with messages', () => {
      const messageModel: MessageModel = {
        id: 'msg-1',
        conversationId: 'conv-123',
        role: 'user',
        content: 'Hello',
        metadata: null,
        createdAt: new Date('2024-01-01'),
        conversation: {} as ConversationModel,
      };

      const model: ConversationModel = {
        id: 'conv-123',
        userId: testUserId,
        sectorId: testSectorId,
        messages: [messageModel],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        deletedAt: null,
      };

      const entity = ConversationMapper.toDomain(model);

      expect(entity.messages).toHaveLength(1);
      expect(entity.messages[0]).toBeInstanceOf(Message);
      expect(entity.messages[0].id).toBe('msg-1');
      expect(entity.messages[0].content).toBe('Hello');
    });

    it('should handle soft deleted conversations', () => {
      const model: ConversationModel = {
        id: 'conv-123',
        userId: testUserId,
        sectorId: testSectorId,
        messages: [],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        deletedAt: new Date('2024-01-03'),
      };

      const entity = ConversationMapper.toDomain(model);

      expect(entity).toBeDefined();
      expect(entity.id).toBe('conv-123');
    });
  });

  describe('toModel', () => {
    it('should map new domain entity to model', () => {
      const entity = new Conversation({
        userId: testUserId,
        sectorId: testSectorId,
      });

      const model = ConversationMapper.toModel(entity);

      expect(model).toBeInstanceOf(ConversationModel);
      expect(model.userId).toBe(testUserId);
      expect(model.sectorId).toBe(testSectorId);
      expect(model.createdAt).toBeInstanceOf(Date);
      expect(model.updatedAt).toBeInstanceOf(Date);
    });

    it('should map existing domain entity with id to model', () => {
      const entity = new Conversation({
        id: 'conv-123',
        userId: testUserId,
        sectorId: testSectorId,
      });

      const model = ConversationMapper.toModel(entity);

      expect(model.id).toBe('conv-123');
      expect(model.userId).toBe(testUserId);
      expect(model.sectorId).toBe(testSectorId);
    });

    it('should map domain entity with messages to model', () => {
      const entity = new Conversation({
        userId: testUserId,
        sectorId: testSectorId,
      });

      const message = new Message({
        conversationId: entity.id,
        role: 'user',
        content: 'Test message',
      });

      entity.addMessage(message);

      const model = ConversationMapper.toModel(entity);

      expect(model.messages).toBeDefined();
      expect(model.messages).toHaveLength(1);
      expect(model.messages[0].content).toBe('Test message');
    });

    it('should preserve timestamps from domain entity', () => {
      const createdAt = new Date('2024-01-01');
      const updatedAt = new Date('2024-01-02');

      const entity = new Conversation({
        userId: testUserId,
        sectorId: testSectorId,
        createdAt,
        updatedAt,
      });

      const model = ConversationMapper.toModel(entity);

      expect(model.createdAt).toEqual(createdAt);
      expect(model.updatedAt).toEqual(updatedAt);
    });
  });

  describe('Bidirectional Mapping', () => {
    it('should maintain data integrity through round-trip conversion', () => {
      const originalModel: ConversationModel = {
        id: 'conv-123',
        userId: testUserId,
        sectorId: testSectorId,
        messages: [],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        deletedAt: null,
      };

      const entity = ConversationMapper.toDomain(originalModel);
      const resultModel = ConversationMapper.toModel(entity);

      expect(resultModel.id).toBe(originalModel.id);
      expect(resultModel.userId).toBe(originalModel.userId);
      expect(resultModel.sectorId).toBe(originalModel.sectorId);
      expect(resultModel.createdAt).toEqual(originalModel.createdAt);
      expect(resultModel.updatedAt).toEqual(originalModel.updatedAt);
    });
  });
});

