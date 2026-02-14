import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConversationRepository } from '@modules/interaction/infrastructure/persistence/repositories/conversation.repository';
import { ConversationModel } from '@modules/interaction/infrastructure/persistence/models/conversation.model';
import { MessageModel } from '@modules/interaction/infrastructure/persistence/models/message.model';
import { Conversation } from '@modules/interaction/domain/entities/conversation.entity';

describe('ConversationRepository', () => {
  let repository: ConversationRepository;
  let conversationRepo: jest.Mocked<Repository<ConversationModel>>;
  let messageRepo: jest.Mocked<Repository<MessageModel>>;
  let dataSource: jest.Mocked<DataSource>;

  const mockConversationRepo = {
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    softDelete: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  };

  const mockMessageRepo = {
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
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
          useValue: mockConversationRepo,
        },
        {
          provide: getRepositoryToken(MessageModel),
          useValue: mockMessageRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    repository = module.get<ConversationRepository>(ConversationRepository);
    conversationRepo = module.get(getRepositoryToken(ConversationModel));
    messageRepo = module.get(getRepositoryToken(MessageModel));
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('save', () => {
    it('should save a conversation', async () => {
      const conversation = new Conversation({
        userId: '550e8400-e29b-41d4-a716-446655440999',
        sectorId: '440e8400-e29b-41d4-a716-446655440000',
        title: 'Test Conversation',
        metadata: {},
      });

      const savedModel: ConversationModel = {
        id: 'conv-id',
        userId: conversation.userId,
        sectorId: conversation.sectorId,
        title: conversation.title,
        metadata: conversation.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        messages: [],
      };

      mockConversationRepo.save.mockResolvedValue(savedModel);

      const result = await repository.save(conversation);

      expect(result).toBeInstanceOf(Conversation);
      expect(mockConversationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: conversation.userId,
          sectorId: conversation.sectorId,
        }),
        { reload: true },
      );
    });
  });

  describe('findById', () => {
    it('should find a conversation by id with messages', async () => {
      const model: ConversationModel = {
        id: 'conv-id',
        userId: '550e8400-e29b-41d4-a716-446655440999',
        sectorId: '440e8400-e29b-41d4-a716-446655440000',
        title: 'Test Conversation',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        messages: [
          {
            id: 'msg-1',
            conversationId: 'conv-id',
            role: 'user',
            content: 'Hello',
            metadata: {},
            createdAt: new Date(),
            conversation: null as unknown as ConversationModel,
          },
        ],
      };

      mockConversationRepo.findOne.mockResolvedValue(model);

      const result = await repository.findById('conv-id');

      expect(result).toBeInstanceOf(Conversation);
      expect(result?.id).toBe('conv-id');
      expect(mockConversationRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'conv-id' },
        relations: ['messages'],
        order: {
          messages: {
            createdAt: 'ASC',
          },
        },
      });
    });

    it('should return undefined if conversation not found', async () => {
      mockConversationRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('findByUserId', () => {
    it('should find conversations by user id', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockConversationRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as never,
      );

      const result = await repository.findByUserId(
        '550e8400-e29b-41d4-a716-446655440999',
      );

      expect(Array.isArray(result)).toBe(true);
      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(mockQueryBuilder.getMany).toHaveBeenCalled();
    });

    it('should respect pagination options', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockConversationRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as never,
      );

      await repository.findByUserId('550e8400-e29b-41d4-a716-446655440999', {
        limit: 10,
        offset: 20,
      });

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(20);
    });
  });

  describe('delete', () => {
    it('should soft delete a conversation by default', async () => {
      mockConversationRepo.softDelete.mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      });

      await repository.delete('conv-id');

      expect(mockConversationRepo.softDelete).toHaveBeenCalledWith('conv-id');
    });
  });

  // Note: addMessage tests are complex due to transaction handling
  // These will be covered by integration tests

  describe('findBySectorId', () => {
    it('should find conversations by sector id', async () => {
      mockConversationRepo.find.mockResolvedValue([]);

      const result = await repository.findBySectorId(
        '440e8400-e29b-41d4-a716-446655440000',
      );

      expect(Array.isArray(result)).toBe(true);
      expect(mockConversationRepo.find).toHaveBeenCalled();
    });
  });

  describe('countByUserId', () => {
    it('should count conversations by user id', async () => {
      mockConversationRepo.count.mockResolvedValue(5);

      const result = await repository.countByUserId(
        '550e8400-e29b-41d4-a716-446655440999',
      );

      expect(result).toBe(5);
      expect(mockConversationRepo.count).toHaveBeenCalled();
    });
  });

  describe('findActiveConversations', () => {
    it('should find active conversations', async () => {
      mockConversationRepo.find.mockResolvedValue([]);

      const result = await repository.findActiveConversations(
        '550e8400-e29b-41d4-a716-446655440999',
        '440e8400-e29b-41d4-a716-446655440000',
      );

      expect(Array.isArray(result)).toBe(true);
      expect(mockConversationRepo.find).toHaveBeenCalled();
    });
  });
});
