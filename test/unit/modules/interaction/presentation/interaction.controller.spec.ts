import { Test, TestingModule } from '@nestjs/testing';
import { InteractionController } from '@modules/interaction/presentation/interaction.controller';
import { QueryAssistantUseCase } from '@modules/interaction/application/use-cases/query-assistant.use-case';
import { QueryAssistantDto } from '@modules/interaction/presentation/dtos/query-assistant.dto';

describe('InteractionController', () => {
  let controller: InteractionController;
  let queryAssistantUseCase: jest.Mocked<QueryAssistantUseCase>;

  const mockQueryAssistantUseCase = {
    execute: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InteractionController],
      providers: [
        {
          provide: QueryAssistantUseCase,
          useValue: mockQueryAssistantUseCase,
        },
      ],
    }).compile();

    controller = module.get<InteractionController>(InteractionController);
    queryAssistantUseCase = module.get(QueryAssistantUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('query', () => {
    const validDto: QueryAssistantDto = {
      userId: '550e8400-e29b-41d4-a716-446655440999',
      sectorId: '440e8400-e29b-41d4-a716-446655440000',
      query: '¿Cuántos días de vacaciones tengo?',
    };

    const mockUseCaseResult = {
      response: 'Tienes derecho a 15 días hábiles de vacaciones pagadas por año.',
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

      const result = await controller.query(validDto);

      expect(result).toEqual({
        response: mockUseCaseResult.response,
        conversationId: mockUseCaseResult.conversationId,
        sources: mockUseCaseResult.sources,
        timestamp: mockUseCaseResult.timestamp,
      });

      expect(queryAssistantUseCase.execute).toHaveBeenCalledWith({
        userId: validDto.userId,
        sectorId: validDto.sectorId,
        query: validDto.query,
        conversationId: undefined,
        maxResults: undefined,
        minSimilarity: undefined,
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

      await controller.query(dtoWithOptionals);

      expect(queryAssistantUseCase.execute).toHaveBeenCalledWith({
        userId: dtoWithOptionals.userId,
        sectorId: dtoWithOptionals.sectorId,
        query: dtoWithOptionals.query,
        conversationId: dtoWithOptionals.conversationId,
        maxResults: dtoWithOptionals.maxResults,
        minSimilarity: dtoWithOptionals.minSimilarity,
      });
    });

    it('should handle short queries correctly', async () => {
      const shortQueryDto: QueryAssistantDto = {
        ...validDto,
        query: 'Vacaciones?',
      };

      queryAssistantUseCase.execute.mockResolvedValue(mockUseCaseResult);

      await controller.query(shortQueryDto);

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

      await controller.query(longQueryDto);

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

      const result = await controller.query(validDto);

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

      const result = await controller.query(validDto);

      expect(result.sources).toEqual([]);
    });

    it('should throw error when use case fails', async () => {
      const error = new Error('Use case execution failed');
      queryAssistantUseCase.execute.mockRejectedValue(error);

      await expect(controller.query(validDto)).rejects.toThrow(
        'Use case execution failed',
      );
    });

    it('should throw error when use case throws unknown error', async () => {
      queryAssistantUseCase.execute.mockRejectedValue(
        'Unknown string error',
      );

      await expect(controller.query(validDto)).rejects.toBe(
        'Unknown string error',
      );
    });

    it('should return timestamp from use case result', async () => {
      const timestamp = new Date('2026-02-07T20:00:00.000Z');
      const resultWithTimestamp = {
        ...mockUseCaseResult,
        timestamp,
      };

      queryAssistantUseCase.execute.mockResolvedValue(resultWithTimestamp);

      const result = await controller.query(validDto);

      expect(result.timestamp).toEqual(timestamp);
    });
  });
});
