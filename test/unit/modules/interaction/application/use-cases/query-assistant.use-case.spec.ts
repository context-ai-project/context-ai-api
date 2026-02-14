import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { QueryAssistantUseCase } from '@modules/interaction/application/use-cases/query-assistant.use-case';
import { IConversationRepository } from '@modules/interaction/domain/repositories/conversation.repository.interface';
import { Conversation } from '@modules/interaction/domain/entities/conversation.entity';
import { Message } from '@modules/interaction/domain/entities/message.entity';
import {
  RagQueryInput,
  RagQueryOutput,
} from '@/shared/genkit/flows/rag-query.flow';

// Define the type for the RAG query flow service
type RagQueryFlowService = (input: RagQueryInput) => Promise<RagQueryOutput>;

describe('QueryAssistantUseCase', () => {
  let useCase: QueryAssistantUseCase;
  let mockConversationRepository: jest.Mocked<IConversationRepository>;
  let mockRagQueryFlow: jest.Mock<Promise<RagQueryOutput>, [RagQueryInput]>;

  const testUserId = 'user-123';
  const testSectorId = 'sector-456';
  const testQuery = 'How do I request vacation?';

  beforeEach(() => {
    // Create mock repository
    mockConversationRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findBySectorId: jest.fn(),
      findByUserAndSector: jest.fn(),
      addMessage: jest.fn(),
      getMessages: jest.fn(),
      delete: jest.fn(),
      countByUserId: jest.fn(),
      findActiveConversations: jest.fn(),
      transaction: jest.fn(),
    };

    // Create mock RAG query flow
    mockRagQueryFlow = jest.fn();

    // Create use case instance
    useCase = new QueryAssistantUseCase(
      mockConversationRepository,
      mockRagQueryFlow as unknown as RagQueryFlowService,
    );
  });

  describe('Conversation Management', () => {
    it('should create new conversation if none exists', async () => {
      mockConversationRepository.findByUserAndSector.mockResolvedValue(
        undefined,
      );

      const newConversation = new Conversation({
        userId: testUserId,
        sectorId: testSectorId,
      });

      mockConversationRepository.save.mockResolvedValue(newConversation);

      mockRagQueryFlow.mockResolvedValue({
        response: 'Test response',
        sources: [],
        timestamp: new Date(),
      });

      await useCase.execute({
        userContext: { userId: testUserId, sectorId: testSectorId },
        query: testQuery,
      });

      expect(mockConversationRepository.findByUserAndSector).toHaveBeenCalledWith(
        testUserId,
        testSectorId,
      );
      expect(mockConversationRepository.save).toHaveBeenCalled();
    });

    it('should use existing conversation if available', async () => {
      const existingConversation = new Conversation({
        id: 'conv-123',
        userId: testUserId,
        sectorId: testSectorId,
      });

      mockConversationRepository.findByUserAndSector.mockResolvedValue(
        existingConversation,
      );

      mockRagQueryFlow.mockResolvedValue({
        response: 'Test response',
        sources: [],
        timestamp: new Date(),
      });

      await useCase.execute({
        userContext: { userId: testUserId, sectorId: testSectorId },
        query: testQuery,
      });

      expect(mockConversationRepository.findByUserAndSector).toHaveBeenCalledWith(
        testUserId,
        testSectorId,
      );
      expect(mockConversationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'conv-123',
        }),
      );
    });

    it('should use provided conversationId if given', async () => {
      const conversationId = 'conv-existing';
      const existingConversation = new Conversation({
        id: conversationId,
        userId: testUserId,
        sectorId: testSectorId,
      });

      mockConversationRepository.findById.mockResolvedValue(
        existingConversation,
      );

      mockRagQueryFlow.mockResolvedValue({
        response: 'Test response',
        sources: [],
        timestamp: new Date(),
      });

      await useCase.execute({
        userContext: { userId: testUserId, sectorId: testSectorId },
        query: testQuery,
        conversationId,
      });

      expect(mockConversationRepository.findById).toHaveBeenCalledWith(
        conversationId,
      );
      expect(mockConversationRepository.findByUserAndSector).not.toHaveBeenCalled();
    });
  });

  describe('Message Handling', () => {
    it('should add user message to conversation', async () => {
      const conversation = new Conversation({
        userId: testUserId,
        sectorId: testSectorId,
      });

      mockConversationRepository.findByUserAndSector.mockResolvedValue(
        conversation,
      );

      mockRagQueryFlow.mockResolvedValue({
        response: 'Test response',
        sources: [],
        timestamp: new Date(),
      });

      await useCase.execute({
        userContext: { userId: testUserId, sectorId: testSectorId },
        query: testQuery,
      });

      // Verify conversation was saved with user message
      expect(mockConversationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: testQuery,
            }),
          ]),
        }),
      );
    });

    it('should add assistant message to conversation', async () => {
      const conversation = new Conversation({
        userId: testUserId,
        sectorId: testSectorId,
      });

      mockConversationRepository.findByUserAndSector.mockResolvedValue(
        conversation,
      );

      const assistantResponse = 'You need to submit a request 15 days in advance.';

      mockRagQueryFlow.mockResolvedValue({
        response: assistantResponse,
        sources: [
          {
            id: 'frag-1',
            content: 'Vacation policy details...',
            sourceId: 'source-1',
            similarity: 0.9,
          },
        ],
        timestamp: new Date(),
      });

      await useCase.execute({
        userContext: { userId: testUserId, sectorId: testSectorId },
        query: testQuery,
      });

      // Verify conversation was saved with assistant message
      expect(mockConversationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'assistant',
              content: assistantResponse,
            }),
          ]),
        }),
      );
    });

    it('should include conversation context in RAG query', async () => {
      const conversation = new Conversation({
        userId: testUserId,
        sectorId: testSectorId,
      });

      // Add previous messages to conversation
      conversation.addMessage(
        new Message({
          conversationId: conversation.id,
          role: 'user',
          content: 'Previous question',
        }),
      );
      conversation.addMessage(
        new Message({
          conversationId: conversation.id,
          role: 'assistant',
          content: 'Previous answer',
        }),
      );

      mockConversationRepository.findByUserAndSector.mockResolvedValue(
        conversation,
      );

      mockRagQueryFlow.mockResolvedValue({
        response: 'Test response',
        sources: [],
        timestamp: new Date(),
      });

      await useCase.execute({
        userContext: { userId: testUserId, sectorId: testSectorId },
        query: testQuery,
      });

      // Verify RAG flow was called with conversation context
      expect(mockRagQueryFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('Previous question'),
          conversationId: conversation.id,
        }),
      );
    });
  });

  describe('RAG Integration', () => {
    it('should call RAG query flow with correct parameters', async () => {
      const conversation = new Conversation({
        id: 'conv-123',
        userId: testUserId,
        sectorId: testSectorId,
      });

      mockConversationRepository.findByUserAndSector.mockResolvedValue(
        conversation,
      );

      mockRagQueryFlow.mockResolvedValue({
        response: 'Test response',
        sources: [],
        timestamp: new Date(),
      });

      await useCase.execute({
        userContext: { userId: testUserId, sectorId: testSectorId },
        query: testQuery,
      });

      expect(mockRagQueryFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.any(String),
          sectorId: testSectorId,
          conversationId: 'conv-123',
        }),
      );
    });

    it('should pass through custom RAG parameters', async () => {
      const conversation = new Conversation({
        userId: testUserId,
        sectorId: testSectorId,
      });

      mockConversationRepository.findByUserAndSector.mockResolvedValue(
        conversation,
      );

      mockRagQueryFlow.mockResolvedValue({
        response: 'Test response',
        sources: [],
        timestamp: new Date(),
      });

      const customMaxResults = 5;
      const customMinSimilarity = 0.8;

      await useCase.execute({
        userContext: { userId: testUserId, sectorId: testSectorId },
        query: testQuery,
        searchOptions: {
          maxResults: customMaxResults,
          minSimilarity: customMinSimilarity,
        },
      });

      expect(mockRagQueryFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          maxResults: customMaxResults,
          minSimilarity: customMinSimilarity,
        }),
      );
    });
  });

  describe('Response Formatting', () => {
    it('should return formatted response with metadata', async () => {
      const conversation = new Conversation({
        id: 'conv-123',
        userId: testUserId,
        sectorId: testSectorId,
      });

      mockConversationRepository.findByUserAndSector.mockResolvedValue(
        conversation,
      );

      const testTimestamp = new Date();
      const testSources = [
        {
          id: 'frag-1',
          content: 'Source content',
          sourceId: 'source-1',
          similarity: 0.9,
        },
      ];

      mockRagQueryFlow.mockResolvedValue({
        response: 'Test response',
        sources: testSources,
        timestamp: testTimestamp,
      });

      const result = await useCase.execute({
        userContext: { userId: testUserId, sectorId: testSectorId },
        query: testQuery,
      });

      expect(result).toEqual(
        expect.objectContaining({
          response: 'Test response',
          conversationId: 'conv-123',
          sources: testSources,
        }),
      );
    });

    it('should include assistant message metadata with sources', async () => {
      const conversation = new Conversation({
        userId: testUserId,
        sectorId: testSectorId,
      });

      mockConversationRepository.findByUserAndSector.mockResolvedValue(
        conversation,
      );

      const testSources = [
        {
          id: 'frag-1',
          content: 'Source content',
          sourceId: 'source-1',
          similarity: 0.9,
        },
      ];

      mockRagQueryFlow.mockResolvedValue({
        response: 'Test response',
        sources: testSources,
        timestamp: new Date(),
      });

      await useCase.execute({
        userContext: { userId: testUserId, sectorId: testSectorId },
        query: testQuery,
      });

      // Verify assistant message includes source metadata
      expect(mockConversationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'assistant',
              metadata: expect.objectContaining({
                sourceFragments: expect.arrayContaining(['frag-1']),
              }),
            }),
          ]),
        }),
      );
    });
  });

  describe('Evaluation Integration', () => {
    it('should include evaluation scores in output when available', async () => {
      const conversation = new Conversation({
        id: 'conv-eval',
        userId: testUserId,
        sectorId: testSectorId,
      });

      mockConversationRepository.findByUserAndSector.mockResolvedValue(
        conversation,
      );

      const evaluationData = {
        faithfulness: {
          score: 0.9,
          status: 'PASS' as const,
          reasoning: 'Response is grounded in the context.',
        },
        relevancy: {
          score: 0.85,
          status: 'PASS' as const,
          reasoning: 'Response addresses the user question.',
        },
      };

      mockRagQueryFlow.mockResolvedValue({
        response: 'Test response',
        sources: [
          {
            id: 'frag-1',
            content: 'Source content',
            sourceId: 'source-1',
            similarity: 0.9,
          },
        ],
        timestamp: new Date(),
        evaluation: evaluationData,
      });

      const result = await useCase.execute({
        userContext: { userId: testUserId, sectorId: testSectorId },
        query: testQuery,
      });

      expect(result.evaluation).toBeDefined();
      expect(result.evaluation?.faithfulness.score).toBe(0.9);
      expect(result.evaluation?.faithfulness.status).toBe('PASS');
      expect(result.evaluation?.relevancy.score).toBe(0.85);
      expect(result.evaluation?.relevancy.status).toBe('PASS');
    });

    it('should store evaluation scores in assistant message metadata', async () => {
      const conversation = new Conversation({
        userId: testUserId,
        sectorId: testSectorId,
      });

      mockConversationRepository.findByUserAndSector.mockResolvedValue(
        conversation,
      );

      const evaluationData = {
        faithfulness: {
          score: 0.75,
          status: 'PASS' as const,
          reasoning: 'Mostly grounded.',
        },
        relevancy: {
          score: 0.8,
          status: 'PASS' as const,
          reasoning: 'Addresses the question.',
        },
      };

      mockRagQueryFlow.mockResolvedValue({
        response: 'Test response',
        sources: [],
        timestamp: new Date(),
        evaluation: evaluationData,
      });

      await useCase.execute({
        userContext: { userId: testUserId, sectorId: testSectorId },
        query: testQuery,
      });

      // Extract the conversation that was saved
      const savedConversation = mockConversationRepository.save.mock
        .calls[0][0] as Conversation;
      const assistantMsg = savedConversation.messages.find(
        (m) => m.role === 'assistant',
      );

      expect(assistantMsg).toBeDefined();
      expect(assistantMsg?.metadata).toBeDefined();

      const evalMeta = assistantMsg?.metadata?.evaluation as Record<
        string,
        unknown
      >;
      expect(evalMeta).toBeDefined();

      const faithfulness = evalMeta.faithfulness as Record<string, unknown>;
      expect(faithfulness.score).toBe(0.75);
      expect(faithfulness.status).toBe('PASS');

      const relevancy = evalMeta.relevancy as Record<string, unknown>;
      expect(relevancy.score).toBe(0.8);
      expect(relevancy.status).toBe('PASS');
    });

    it('should not include evaluation when RAG flow returns without it', async () => {
      const conversation = new Conversation({
        userId: testUserId,
        sectorId: testSectorId,
      });

      mockConversationRepository.findByUserAndSector.mockResolvedValue(
        conversation,
      );

      mockRagQueryFlow.mockResolvedValue({
        response: 'Test response',
        sources: [],
        timestamp: new Date(),
        // No evaluation field
      });

      const result = await useCase.execute({
        userContext: { userId: testUserId, sectorId: testSectorId },
        query: testQuery,
      });

      expect(result.evaluation).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw error if conversation not found by ID', async () => {
      mockConversationRepository.findById.mockResolvedValue(undefined);

      await expect(
        useCase.execute({
          userContext: { userId: testUserId, sectorId: testSectorId },
          query: testQuery,
          conversationId: 'non-existent',
        }),
      ).rejects.toThrow('Conversation not found');
    });

    it('should handle RAG flow errors gracefully', async () => {
      const conversation = new Conversation({
        userId: testUserId,
        sectorId: testSectorId,
      });

      mockConversationRepository.findByUserAndSector.mockResolvedValue(
        conversation,
      );

      mockRagQueryFlow.mockRejectedValue(new Error('RAG service error'));

      await expect(
        useCase.execute({
          userContext: { userId: testUserId, sectorId: testSectorId },
          query: testQuery,
        }),
      ).rejects.toThrow('RAG service error');
    });

    it('should validate required parameters', async () => {
      await expect(
        useCase.execute({
          userContext: { userId: '', sectorId: testSectorId },
          query: testQuery,
        }),
      ).rejects.toThrow();

      await expect(
        useCase.execute({
          userContext: { userId: testUserId, sectorId: '' },
          query: testQuery,
        }),
      ).rejects.toThrow();

      await expect(
        useCase.execute({
          userContext: { userId: testUserId, sectorId: testSectorId },
          query: '',
        }),
      ).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', async () => {
      const conversation = new Conversation({
        userId: testUserId,
        sectorId: testSectorId,
      });

      mockConversationRepository.findByUserAndSector.mockResolvedValue(
        conversation,
      );

      mockRagQueryFlow.mockResolvedValue({
        response: 'Test response',
        sources: [],
        timestamp: new Date(),
      });

      const startTime = Date.now();

      await useCase.execute({
        userContext: { userId: testUserId, sectorId: testSectorId },
        query: testQuery,
      });

      const duration = Date.now() - startTime;

      // Should complete in less than 1 second for mocked services
      const maxDurationMs = 1000;
      expect(duration).toBeLessThan(maxDurationMs);
    });
  });
});

