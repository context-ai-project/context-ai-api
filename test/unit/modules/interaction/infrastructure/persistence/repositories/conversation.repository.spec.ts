import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConversationRepository } from '../../../../../../../src/modules/interaction/infrastructure/persistence/repositories/conversation.repository';
import { ConversationModel } from '../../../../../../../src/modules/interaction/infrastructure/persistence/models/conversation.model';
import { MessageModel } from '../../../../../../../src/modules/interaction/infrastructure/persistence/models/message.model';
import { Conversation } from '../../../../../../../src/modules/interaction/domain/entities/conversation.entity';
import { Message } from '../../../../../../../src/modules/interaction/domain/entities/message.entity';

const CONVERSATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const SECTOR_ID = '770e8400-e29b-41d4-a716-446655440002';
const NOW = new Date('2026-01-15T12:00:00Z');

function createConversationModel(
  overrides?: Partial<ConversationModel>,
): ConversationModel {
  const model = new ConversationModel();
  model.id = CONVERSATION_ID;
  model.userId = USER_ID;
  model.sectorId = SECTOR_ID;
  model.messages = [];
  model.createdAt = NOW;
  model.updatedAt = NOW;
  model.deletedAt = null as unknown as Date;
  Object.assign(model, overrides);
  return model;
}

describe('ConversationRepository', () => {
  let repository: ConversationRepository;

  const mockConvQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const mockConvRepo = {
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    softDelete: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(mockConvQueryBuilder),
  };

  const mockMsgRepo = {
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      getRepository: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationRepository,
        {
          provide: getRepositoryToken(ConversationModel),
          useValue: mockConvRepo,
        },
        {
          provide: getRepositoryToken(MessageModel),
          useValue: mockMsgRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    repository = module.get<ConversationRepository>(ConversationRepository);
    jest.clearAllMocks();
    mockConvRepo.createQueryBuilder.mockReturnValue(mockConvQueryBuilder);
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
  });

  describe('save', () => {
    it('should save and return domain entity', async () => {
      const model = createConversationModel();
      mockConvRepo.save.mockResolvedValue(model);

      const conversation = new Conversation({
        id: CONVERSATION_ID,
        userId: USER_ID,
        sectorId: SECTOR_ID,
      });

      const result = await repository.save(conversation);

      expect(result.id).toBe(CONVERSATION_ID);
    });
  });

  describe('findById', () => {
    it('should return domain entity when found', async () => {
      mockConvRepo.findOne.mockResolvedValue(createConversationModel());

      const result = await repository.findById(CONVERSATION_ID);

      expect(result).toBeDefined();
      expect(result!.id).toBe(CONVERSATION_ID);
    });

    it('should return undefined when not found', async () => {
      mockConvRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('findByUserId', () => {
    it('should return conversations with default options', async () => {
      mockConvQueryBuilder.getMany.mockResolvedValue([
        createConversationModel(),
      ]);

      const result = await repository.findByUserId(USER_ID);

      expect(result).toHaveLength(1);
      expect(mockConvQueryBuilder.andWhere).toHaveBeenCalledWith(
        'conversation.deleted_at IS NULL',
      );
    });

    it('should include inactive when option is set', async () => {
      mockConvQueryBuilder.getMany.mockResolvedValue([]);

      await repository.findByUserId(USER_ID, { includeInactive: true });

      expect(mockConvQueryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('should apply custom limit and offset', async () => {
      mockConvQueryBuilder.getMany.mockResolvedValue([]);

      await repository.findByUserId(USER_ID, { limit: 10, offset: 5 });

      expect(mockConvQueryBuilder.limit).toHaveBeenCalledWith(10);
      expect(mockConvQueryBuilder.offset).toHaveBeenCalledWith(5);
    });
  });

  describe('findBySectorId', () => {
    it('should return conversations for a sector', async () => {
      mockConvRepo.find.mockResolvedValue([createConversationModel()]);

      const result = await repository.findBySectorId(SECTOR_ID);

      expect(result).toHaveLength(1);
    });

    it('should apply custom pagination', async () => {
      mockConvRepo.find.mockResolvedValue([]);

      await repository.findBySectorId(SECTOR_ID, { limit: 5, offset: 10 });

      expect(mockConvRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5, skip: 10 }),
      );
    });
  });

  describe('findByUserAndSector', () => {
    it('should return conversation when found', async () => {
      mockConvRepo.findOne.mockResolvedValue(createConversationModel());

      const result = await repository.findByUserAndSector(USER_ID, SECTOR_ID);

      expect(result).toBeDefined();
    });

    it('should return undefined when not found', async () => {
      mockConvRepo.findOne.mockResolvedValue(null);

      const result = await repository.findByUserAndSector(USER_ID, SECTOR_ID);

      expect(result).toBeUndefined();
    });
  });

  describe('addMessage', () => {
    it('should add message and return updated conversation', async () => {
      const model = createConversationModel();
      mockConvRepo.findOne
        .mockResolvedValueOnce(model)
        .mockResolvedValueOnce(model);
      mockMsgRepo.save.mockResolvedValue({});
      mockConvRepo.update.mockResolvedValue({ affected: 1 });

      const message = new Message({
        conversationId: CONVERSATION_ID,
        role: 'user',
        content: 'Hello',
      });

      const result = await repository.addMessage(CONVERSATION_ID, message);

      expect(result).toBeDefined();
      expect(mockMsgRepo.save).toHaveBeenCalled();
    });

    it('should throw when conversation not found', async () => {
      mockConvRepo.findOne.mockResolvedValue(null);

      const message = new Message({
        conversationId: 'nonexistent',
        role: 'user',
        content: 'Hello',
      });

      await expect(
        repository.addMessage('nonexistent', message),
      ).rejects.toThrow('Conversation not found');
    });

    it('should throw when conversation disappears after update', async () => {
      const model = createConversationModel();
      mockConvRepo.findOne
        .mockResolvedValueOnce(model)
        .mockResolvedValueOnce(null);
      mockMsgRepo.save.mockResolvedValue({});
      mockConvRepo.update.mockResolvedValue({ affected: 1 });

      const message = new Message({
        conversationId: CONVERSATION_ID,
        role: 'user',
        content: 'Hello',
      });

      await expect(
        repository.addMessage(CONVERSATION_ID, message),
      ).rejects.toThrow('Conversation not found after update');
    });
  });

  describe('getMessages', () => {
    it('should return messages for conversation', async () => {
      const msgModel = new MessageModel();
      msgModel.id = 'msg-1';
      msgModel.conversationId = CONVERSATION_ID;
      msgModel.role = 'user';
      msgModel.content = 'Hello';
      msgModel.createdAt = NOW;
      mockMsgRepo.find.mockResolvedValue([msgModel]);

      const result = await repository.getMessages(CONVERSATION_ID);

      expect(result).toHaveLength(1);
    });

    it('should apply pagination options', async () => {
      mockMsgRepo.find.mockResolvedValue([]);

      await repository.getMessages(CONVERSATION_ID, { limit: 5, offset: 10 });

      expect(mockMsgRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5, skip: 10 }),
      );
    });
  });

  describe('delete', () => {
    it('should soft-delete conversation', async () => {
      await repository.delete(CONVERSATION_ID);

      expect(mockConvRepo.softDelete).toHaveBeenCalledWith(CONVERSATION_ID);
    });
  });

  describe('countByUserId', () => {
    it('should count non-deleted conversations for user', async () => {
      mockConvRepo.count.mockResolvedValue(3);

      const result = await repository.countByUserId(USER_ID);

      expect(result).toBe(3);
    });
  });

  describe('countAll', () => {
    it('should count all non-deleted conversations', async () => {
      mockConvRepo.count.mockResolvedValue(15);

      const result = await repository.countAll();

      expect(result).toBe(15);
    });
  });

  describe('findActiveConversations', () => {
    it('should find active conversations with default threshold', async () => {
      mockConvRepo.find.mockResolvedValue([createConversationModel()]);

      const result = await repository.findActiveConversations(USER_ID);

      expect(result).toHaveLength(1);
    });

    it('should apply custom hours threshold', async () => {
      mockConvRepo.find.mockResolvedValue([]);

      await repository.findActiveConversations(USER_ID, 48);

      expect(mockConvRepo.find).toHaveBeenCalled();
    });
  });

  describe('transaction', () => {
    it('should commit on success', async () => {
      mockQueryRunner.manager.getRepository
        .mockReturnValueOnce(mockConvRepo)
        .mockReturnValueOnce(mockMsgRepo);

      const result = await repository.transaction(async () => 'result');

      expect(result).toBe('result');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      mockQueryRunner.manager.getRepository
        .mockReturnValueOnce(mockConvRepo)
        .mockReturnValueOnce(mockMsgRepo);

      await expect(
        repository.transaction(async () => {
          throw new Error('TX error');
        }),
      ).rejects.toThrow('TX error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
