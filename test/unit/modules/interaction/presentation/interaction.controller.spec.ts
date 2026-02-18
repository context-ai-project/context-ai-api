import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InteractionController } from '@modules/interaction/presentation/interaction.controller';
import { QueryAssistantUseCase } from '@modules/interaction/application/use-cases/query-assistant.use-case';
import { QueryAssistantDto } from '@modules/interaction/presentation/dtos/query-assistant.dto';
import type { IConversationRepository } from '@modules/interaction/domain/repositories/conversation.repository.interface';
import { Conversation } from '@modules/interaction/domain/entities/conversation.entity';
import { Message } from '@modules/interaction/domain/entities/message.entity';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RBACGuard } from '@modules/auth/guards/rbac.guard';
import { PermissionService } from '@modules/auth/application/services/permission.service';
import { TokenRevocationService } from '@modules/auth/application/services/token-revocation.service';

describe('InteractionController', () => {
  let controller: InteractionController;
  let queryAssistantUseCase: jest.Mocked<QueryAssistantUseCase>;
  let conversationRepository: jest.Mocked<IConversationRepository>;

  const mockQueryAssistantUseCase = {
    execute: jest.fn(),
  };

  const mockConversationRepository = {
    findByUserId: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
    save: jest.fn(),
    findByUserAndSector: jest.fn(),
    findBySectorId: jest.fn(),
    addMessage: jest.fn(),
    getMessages: jest.fn(),
    countByUserId: jest.fn(),
    findActiveConversations: jest.fn(),
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InteractionController],
      providers: [
        {
          provide: QueryAssistantUseCase,
          useValue: mockQueryAssistantUseCase,
        },
        {
          provide: 'IConversationRepository',
          useValue: mockConversationRepository,
        },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: PermissionService,
          useValue: {
            getUserRoles: jest.fn().mockResolvedValue(['user']),
            getUserPermissions: jest.fn().mockResolvedValue(['chat:read']),
            hasPermission: jest.fn().mockResolvedValue(true),
            hasAnyPermission: jest.fn().mockResolvedValue(true),
            hasAllPermissions: jest.fn().mockResolvedValue(true),
            hasRole: jest.fn().mockResolvedValue(true),
            isAdmin: jest.fn().mockResolvedValue(false),
            isManager: jest.fn().mockResolvedValue(false),
            isUser: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: JwtAuthGuard,
          useValue: {
            canActivate: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: RBACGuard,
          useValue: {
            canActivate: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: TokenRevocationService,
          useValue: {
            revokeToken: jest.fn(),
            isTokenRevoked: jest.fn().mockReturnValue(false),
            clearAllRevokedTokens: jest.fn(),
            getRevokedTokenCount: jest.fn().mockReturnValue(0),
            getStatistics: jest.fn().mockReturnValue({
              totalRevoked: 0,
              oldestExpiration: null,
              newestExpiration: null,
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<InteractionController>(InteractionController);
    queryAssistantUseCase = module.get(QueryAssistantUseCase);
    conversationRepository = module.get('IConversationRepository');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('query', () => {
    // userId comes from JWT session via @CurrentUser('userId'), not from the DTO body
    const jwtUserId = '550e8400-e29b-41d4-a716-446655440999';

    const validDto: QueryAssistantDto = {
      sectorId: '440e8400-e29b-41d4-a716-446655440000',
      query: '¿Cuántos días de vacaciones tengo?',
    };

    const mockUseCaseResult = {
      response: 'Tienes derecho a 15 días hábiles de vacaciones pagadas por año.',
      responseType: 'answer' as const,
      conversationId: '8470609d-84f7-4b97-bea9-d000c355acb4',
      sources: [
        {
          id: 'b2286679-5b53-4cd5-a152-ddbfa117fb52',
          content: 'Política de Vacaciones 2026...',
          sourceId: 'bd658bd8-9d94-4dc7-b6f6-e351507253dc',
          similarity: 0.7631168906564851,
          metadata: { tokens: 67, startIndex: 0, endIndex: 430 },
        },
      ],
      timestamp: new Date('2026-02-07T19:53:21.843Z'),
    };

    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should successfully process a query', async () => {
      queryAssistantUseCase.execute.mockResolvedValue(mockUseCaseResult);

      const result = await controller.query(validDto, jwtUserId);

      expect(result).toEqual(
        expect.objectContaining({
          response: mockUseCaseResult.response,
          responseType: 'answer',
          conversationId: mockUseCaseResult.conversationId,
          sources: mockUseCaseResult.sources,
          timestamp: mockUseCaseResult.timestamp,
        }),
      );

      expect(queryAssistantUseCase.execute).toHaveBeenCalledWith({
        userContext: { userId: jwtUserId, sectorId: validDto.sectorId },
        query: validDto.query,
        conversationId: undefined,
        searchOptions: {
          maxResults: undefined,
          minSimilarity: undefined,
        },
      });
      expect(queryAssistantUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it('should process query with optional parameters', async () => {
      const dtoWithOptionals: QueryAssistantDto = {
        ...validDto,
        conversationId: 'existing-conversation-id',
        maxResults: 10,
        minSimilarity: 0.8,
      };

      queryAssistantUseCase.execute.mockResolvedValue(mockUseCaseResult);

      await controller.query(dtoWithOptionals, jwtUserId);

      expect(queryAssistantUseCase.execute).toHaveBeenCalledWith({
        userContext: { userId: jwtUserId, sectorId: dtoWithOptionals.sectorId },
        query: dtoWithOptionals.query,
        conversationId: dtoWithOptionals.conversationId,
        searchOptions: {
          maxResults: dtoWithOptionals.maxResults,
          minSimilarity: dtoWithOptionals.minSimilarity,
        },
      });
    });

    it('should handle short queries correctly', async () => {
      const shortQueryDto: QueryAssistantDto = {
        ...validDto,
        query: 'Vacaciones?',
      };

      queryAssistantUseCase.execute.mockResolvedValue(mockUseCaseResult);

      await controller.query(shortQueryDto, jwtUserId);

      expect(queryAssistantUseCase.execute).toHaveBeenCalled();
    });

    it('should handle long queries correctly', async () => {
      const longQuery =
        'Esta es una pregunta muy larga que excede los 50 caracteres para validar el truncamiento en logs';
      const longQueryDto: QueryAssistantDto = {
        ...validDto,
        query: longQuery,
      };

      queryAssistantUseCase.execute.mockResolvedValue(mockUseCaseResult);

      await controller.query(longQueryDto, jwtUserId);

      expect(queryAssistantUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          query: longQuery,
        }),
      );
    });

    it('should map sources correctly', async () => {
      const resultWithMultipleSources = {
        ...mockUseCaseResult,
        sources: [
          {
            id: 'source-1',
            content: 'Content 1',
            sourceId: 'doc-1',
            similarity: 0.9,
            metadata: { page: 1 },
          },
          {
            id: 'source-2',
            content: 'Content 2',
            sourceId: 'doc-2',
            similarity: 0.8,
            metadata: { page: 2 },
          },
        ],
      };

      queryAssistantUseCase.execute.mockResolvedValue(
        resultWithMultipleSources,
      );

      const result = await controller.query(validDto, jwtUserId);

      expect(result.sources).toHaveLength(2);
      expect(result.sources[0]).toEqual({
        id: 'source-1',
        content: 'Content 1',
        sourceId: 'doc-1',
        similarity: 0.9,
        metadata: { page: 1 },
      });
      expect(result.sources[1]).toEqual({
        id: 'source-2',
        content: 'Content 2',
        sourceId: 'doc-2',
        similarity: 0.8,
        metadata: { page: 2 },
      });
    });

    it('should handle empty sources array', async () => {
      const resultWithNoSources = {
        ...mockUseCaseResult,
        sources: [],
      };

      queryAssistantUseCase.execute.mockResolvedValue(resultWithNoSources);

      const result = await controller.query(validDto, jwtUserId);

      expect(result.sources).toEqual([]);
    });

    it('should throw error when use case fails', async () => {
      const error = new Error('Use case execution failed');
      queryAssistantUseCase.execute.mockRejectedValue(error);

      await expect(controller.query(validDto, jwtUserId)).rejects.toThrow(
        'Use case execution failed',
      );
    });

    it('should throw error when use case throws unknown error', async () => {
      queryAssistantUseCase.execute.mockRejectedValue(
        'Unknown string error',
      );

      await expect(controller.query(validDto, jwtUserId)).rejects.toThrow('Unknown error');
    });

    it('should return timestamp from use case result', async () => {
      const timestamp = new Date('2026-02-07T20:00:00.000Z');
      const resultWithTimestamp = {
        ...mockUseCaseResult,
        timestamp,
      };

      queryAssistantUseCase.execute.mockResolvedValue(resultWithTimestamp);

      const result = await controller.query(validDto, jwtUserId);

      expect(result.timestamp).toEqual(timestamp);
    });
  });

  describe('getConversations', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440999';

    const now = new Date();
    const mockConversations = [
      new Conversation({
        id: 'conv-1',
        userId,
        sectorId: 'sector-1',
        messages: [
          new Message({
            id: 'msg-1',
            conversationId: 'conv-1',
            role: 'USER',
            content: 'Hello',
            createdAt: now,
          }),
          new Message({
            id: 'msg-2',
            conversationId: 'conv-1',
            role: 'ASSISTANT',
            content: 'Hi there!',
            createdAt: now,
          }),
        ],
        createdAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T10:30:00Z'),
      }),
      new Conversation({
        id: 'conv-2',
        userId,
        sectorId: 'sector-1',
        messages: [
          new Message({
            id: 'msg-3',
            conversationId: 'conv-2',
            role: 'USER',
            content: 'Question?',
            createdAt: now,
          }),
        ],
        createdAt: new Date('2024-01-15T09:00:00Z'),
        updatedAt: new Date('2024-01-15T09:15:00Z'),
      }),
    ];

    it('should return list of conversations for user', async () => {
      conversationRepository.findByUserId.mockResolvedValue(mockConversations);
      conversationRepository.countByUserId.mockResolvedValue(2);

      // Pass default values explicitly since pipes handle defaults in runtime
      const result = await controller.getConversations(userId, 10, 0, false);

      expect(result.conversations).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.count).toBe(2);
      expect(result.hasMore).toBe(false);

      expect(conversationRepository.findByUserId).toHaveBeenCalledWith(userId, {
        limit: 10,
        offset: 0,
        includeInactive: false,
      });
      expect(conversationRepository.countByUserId).toHaveBeenCalledWith(userId);
    });

    it('should return conversations with pagination', async () => {
      conversationRepository.findByUserId.mockResolvedValue([mockConversations[0]]);
      conversationRepository.countByUserId.mockResolvedValue(15);

      // Pass includeInactive explicitly since pipes handle defaults in runtime
      const result = await controller.getConversations(userId, 5, 5, false);

      expect(result.conversations).toHaveLength(1);
      expect(result.total).toBe(15);
      expect(result.count).toBe(1);
      expect(result.offset).toBe(5);
      expect(result.hasMore).toBe(true);

      expect(conversationRepository.findByUserId).toHaveBeenCalledWith(userId, {
        limit: 5,
        offset: 5,
        includeInactive: false,
      });
    });

    it('should return empty list when no conversations', async () => {
      conversationRepository.findByUserId.mockResolvedValue([]);
      conversationRepository.countByUserId.mockResolvedValue(0);

      const result = await controller.getConversations(userId);

      expect(result.conversations).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should include inactive conversations when requested', async () => {
      conversationRepository.findByUserId.mockResolvedValue(mockConversations);
      conversationRepository.countByUserId.mockResolvedValue(2);

      await controller.getConversations(userId, 10, 0, true);

      expect(conversationRepository.findByUserId).toHaveBeenCalledWith(userId, {
        limit: 10,
        offset: 0,
        includeInactive: true,
      });
    });

    it('should map conversation data correctly', async () => {
      conversationRepository.findByUserId.mockResolvedValue([mockConversations[0]]);
      conversationRepository.countByUserId.mockResolvedValue(1);

      const result = await controller.getConversations(userId);

      expect(result.conversations[0]).toEqual({
        id: 'conv-1',
        userId,
        sectorId: 'sector-1',
        title: undefined,
        isActive: true,
        messageCount: 2,
        lastMessagePreview: 'Hi there!',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('getConversationById', () => {
    const conversationId = 'conv-123';
    const userId = '550e8400-e29b-41d4-a716-446655440999';

    const mockConversation = new Conversation({
      id: conversationId,
      userId,
      sectorId: 'sector-1',
      messages: [
        new Message({
          id: 'msg-1',
          conversationId,
          role: 'USER',
          content: 'Hello',
          createdAt: new Date(), // Recent message for isActive() to return true
        }),
        new Message({
          id: 'msg-2',
          conversationId,
          role: 'ASSISTANT',
          content: 'Hi there!',
          createdAt: new Date(), // Recent message for isActive() to return true
        }),
      ],
      createdAt: new Date('2024-01-15T10:00:00Z'),
      updatedAt: new Date('2024-01-15T10:01:00Z'),
    });

    it('should return conversation with messages', async () => {
      conversationRepository.findById.mockResolvedValue(mockConversation);

      const result = await controller.getConversationById(conversationId, userId);

      expect(result).toEqual({
        id: conversationId,
        userId,
        sectorId: 'sector-1',
        title: undefined,
        isActive: true,
        messages: [
          {
            id: 'msg-1',
            role: 'USER',
            content: 'Hello',
            timestamp: expect.any(Date),
            metadata: undefined,
          },
          {
            id: 'msg-2',
            role: 'ASSISTANT',
            content: 'Hi there!',
            timestamp: expect.any(Date),
            metadata: undefined,
          },
        ],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        // metadata property removed from ConversationDetailDto
      });

      expect(conversationRepository.findById).toHaveBeenCalledWith(conversationId);
    });

    it('should throw NotFoundException when conversation not found', async () => {
      conversationRepository.findById.mockResolvedValue(undefined);

      await expect(
        controller.getConversationById('non-existent-id', userId),
      ).rejects.toThrow(NotFoundException);

      await expect(
        controller.getConversationById('non-existent-id', userId),
      ).rejects.toThrow('Conversation not found');
    });

    it('should throw NotFoundException when conversation belongs to different user', async () => {
      const differentUserConversation = new Conversation({
        id: conversationId,
        userId: 'different-user-id',
        sectorId: 'sector-1',
        isActive: true,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      conversationRepository.findById.mockResolvedValue(differentUserConversation);

      await expect(
        controller.getConversationById(conversationId, userId),
      ).rejects.toThrow(NotFoundException);

      await expect(
        controller.getConversationById(conversationId, userId),
      ).rejects.toThrow('Conversation not found');
    });

    it('should return conversation with empty messages', async () => {
      const emptyConversation = new Conversation({
        id: conversationId,
        userId,
        sectorId: 'sector-1',
        isActive: true,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      conversationRepository.findById.mockResolvedValue(emptyConversation);

      const result = await controller.getConversationById(conversationId, userId);

      expect(result.messages).toHaveLength(0);
    });
  });

  describe('deleteConversation', () => {
    const conversationId = 'conv-123';
    const userId = '550e8400-e29b-41d4-a716-446655440999';

    const mockConversation = new Conversation({
      id: conversationId,
      userId,
      sectorId: 'sector-1',
      isActive: true,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should delete conversation successfully', async () => {
      conversationRepository.findById.mockResolvedValue(mockConversation);
      conversationRepository.delete.mockResolvedValue();

      await controller.deleteConversation(conversationId, userId);

      expect(conversationRepository.findById).toHaveBeenCalledWith(conversationId);
      expect(conversationRepository.delete).toHaveBeenCalledWith(conversationId);
    });

    it('should throw NotFoundException when conversation not found', async () => {
      conversationRepository.findById.mockResolvedValue(undefined);

      await expect(
        controller.deleteConversation('non-existent-id', userId),
      ).rejects.toThrow(NotFoundException);

      await expect(
        controller.deleteConversation('non-existent-id', userId),
      ).rejects.toThrow('Conversation not found');

      expect(conversationRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when trying to delete another user conversation', async () => {
      const differentUserConversation = new Conversation({
        id: conversationId,
        userId: 'different-user-id',
        sectorId: 'sector-1',
        isActive: true,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      conversationRepository.findById.mockResolvedValue(differentUserConversation);

      await expect(
        controller.deleteConversation(conversationId, userId),
      ).rejects.toThrow(NotFoundException);

      await expect(
        controller.deleteConversation(conversationId, userId),
      ).rejects.toThrow('Conversation not found');

      expect(conversationRepository.delete).not.toHaveBeenCalled();
    });

    it('should propagate repository errors', async () => {
      conversationRepository.findById.mockResolvedValue(mockConversation);
      conversationRepository.delete.mockRejectedValue(new Error('Database error'));

      await expect(
        controller.deleteConversation(conversationId, userId),
      ).rejects.toThrow('Database error');

      expect(conversationRepository.delete).toHaveBeenCalled();
    });
  });
});
