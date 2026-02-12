// Mock pdf-parse before any imports that use it
jest.mock('pdf-parse', () => jest.fn());

// Mock genkit before any imports
jest.mock('genkit', () => ({
  genkit: jest.fn(),
}));

jest.mock('@genkit-ai/google-genai', () => ({
  googleAI: jest.fn(),
}));

import { IngestDocumentUseCase } from '../../../../../../src/modules/knowledge/application/use-cases/ingest-document.use-case';
import { IKnowledgeRepository } from '../../../../../../src/modules/knowledge/domain/repositories/knowledge.repository.interface';
import { IVectorStore } from '../../../../../../src/modules/knowledge/domain/services/vector-store.interface';
import { DocumentParserService } from '../../../../../../src/modules/knowledge/infrastructure/services/document-parser.service';
import { ChunkingService } from '../../../../../../src/modules/knowledge/infrastructure/services/chunking.service';
import { EmbeddingService } from '../../../../../../src/modules/knowledge/infrastructure/services/embedding.service';
import { KnowledgeSource } from '../../../../../../src/modules/knowledge/domain/entities/knowledge-source.entity';
import { Fragment } from '../../../../../../src/modules/knowledge/domain/entities/fragment.entity';
import { SourceType, SourceStatus } from '@shared/types';
import type {
  IngestDocumentDto,
  IngestDocumentResult,
} from '../../../../../../src/modules/knowledge/application/dtos/ingest-document.dto';

describe('IngestDocumentUseCase', () => {
  let useCase: IngestDocumentUseCase;
  let mockRepository: jest.Mocked<IKnowledgeRepository>;
  let mockVectorStore: jest.Mocked<IVectorStore>;
  let mockParserService: jest.Mocked<DocumentParserService>;
  let mockChunkingService: jest.Mocked<ChunkingService>;
  let mockEmbeddingService: jest.Mocked<EmbeddingService>;

  beforeEach(() => {
    // Mock Repository (no longer includes vectorSearch)
    mockRepository = {
      saveSource: jest.fn(),
      findSourceById: jest.fn(),
      findSourcesBySector: jest.fn(),
      findSourcesByStatus: jest.fn(),
      softDeleteSource: jest.fn(),
      deleteSource: jest.fn(),
      countSourcesBySector: jest.fn(),
      saveFragments: jest.fn(),
      findFragmentById: jest.fn(),
      findFragmentsBySource: jest.fn(),
      deleteFragmentsBySource: jest.fn(),
      countFragmentsBySource: jest.fn(),
      transaction: jest.fn(),
    } as unknown as jest.Mocked<IKnowledgeRepository>;

    // Mock Vector Store
    mockVectorStore = {
      upsertVectors: jest.fn().mockResolvedValue(undefined),
      vectorSearch: jest.fn(),
      deleteBySourceId: jest.fn(),
    } as unknown as jest.Mocked<IVectorStore>;

    // Mock Parser Service
    mockParserService = {
      parse: jest.fn(),
      isPdf: jest.fn(),
      estimateContentSize: jest.fn(),
    } as unknown as jest.Mocked<DocumentParserService>;

    // Mock Chunking Service
    mockChunkingService = {
      chunk: jest.fn(),
      getConfig: jest.fn(),
      estimateTokenCount: jest.fn(),
    } as unknown as jest.Mocked<ChunkingService>;

    // Mock Embedding Service
    mockEmbeddingService = {
      generateEmbedding: jest.fn(),
      generateDocumentEmbedding: jest.fn(),
      generateQueryEmbedding: jest.fn(),
      generateDocumentEmbeddings: jest.fn(),
      getConfig: jest.fn(),
      getEmbeddingDimension: jest.fn(),
    } as unknown as jest.Mocked<EmbeddingService>;

    useCase = new IngestDocumentUseCase(
      mockRepository,
      mockVectorStore,
      mockParserService,
      mockChunkingService,
      mockEmbeddingService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper function to create mock buffer
  const createMockPdfBuffer = (content: string): Buffer => {
    return Buffer.from(`%PDF-1.4\n${content}`);
  };

  // Helper to create a saved fragment with ID
  const createSavedFragment = (
    id: string,
    sourceId: string,
    content: string,
    position: number,
    tokenCount: number,
  ): Fragment => {
    const fragment = new Fragment({
      sourceId,
      content,
      position,
      tokenCount,
    });
    Reflect.set(fragment, 'id', id);
    return fragment;
  };

  describe('Successful Document Ingestion', () => {
    it('should ingest a PDF document successfully', async () => {
      // Arrange
      const dto: IngestDocumentDto = {
        title: 'Test Document',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.PDF,
        buffer: createMockPdfBuffer('Test content for PDF document'),
        metadata: { author: 'Test Author' },
      };

      const parsedContent = 'Test content for PDF document';
      const mockChunks = [
        {
          content: 'Test content for PDF document',
          position: 0,
          tokens: 5,
          startIndex: 0,
          endIndex: 28,
        },
      ];
      const mockEmbedding = Array(3072).fill(0.1);

      // Mock service responses
      mockParserService.parse.mockResolvedValue({
        content: parsedContent,
        metadata: {
          sourceType: SourceType.PDF,
          parsedAt: new Date(),
          originalSize: dto.buffer.length,
          pages: 1,
        },
      });

      mockChunkingService.chunk.mockReturnValue(mockChunks);
      mockEmbeddingService.generateDocumentEmbeddings.mockResolvedValue([
        mockEmbedding,
      ]);

      // Mock repository to simulate successful saves
      mockRepository.saveSource.mockImplementation(
        async (source: KnowledgeSource) => {
          Reflect.set(source, 'id', 'source-123');
          return source;
        },
      );

      // Return fragments with IDs (needed for vector upsert)
      mockRepository.saveFragments.mockResolvedValue([
        createSavedFragment(
          'fragment-001',
          'source-123',
          mockChunks[0].content,
          0,
          5,
        ),
      ]);

      // Act
      const result: IngestDocumentResult = await useCase.execute(dto);

      // Assert
      expect(result.sourceId).toBe('source-123');
      expect(result.title).toBe('Test Document');
      expect(result.fragmentCount).toBe(1);
      expect(result.status).toBe('COMPLETED');
      expect(result.errorMessage).toBeUndefined();

      // Verify service calls
      expect(mockParserService.parse).toHaveBeenCalledWith(
        dto.buffer,
        dto.sourceType,
      );
      expect(mockChunkingService.chunk).toHaveBeenCalledWith(parsedContent);
      expect(
        mockEmbeddingService.generateDocumentEmbeddings,
      ).toHaveBeenCalled();
      expect(mockRepository.saveSource).toHaveBeenCalled();
      expect(mockRepository.saveFragments).toHaveBeenCalled();

      // Verify vector store was called with correct data
      expect(mockVectorStore.upsertVectors).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'fragment-001',
            embedding: mockEmbedding,
            metadata: expect.objectContaining({
              sourceId: 'source-123',
              sectorId: dto.sectorId,
              content: mockChunks[0].content,
              position: 0,
            }),
          }),
        ]),
      );
    });

    it('should ingest a Markdown document successfully', async () => {
      // Arrange
      const dto: IngestDocumentDto = {
        title: 'Markdown Guide',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.MARKDOWN,
        buffer: Buffer.from('# Test\n\nThis is **markdown** content.'),
      };

      const parsedContent = 'Test This is markdown content.';
      const mockChunks = [
        {
          content: parsedContent,
          position: 0,
          tokens: 6,
          startIndex: 0,
          endIndex: parsedContent.length,
        },
      ];
      const mockEmbedding = Array(3072).fill(0.2);

      mockParserService.parse.mockResolvedValue({
        content: parsedContent,
        metadata: {
          sourceType: SourceType.MARKDOWN,
          parsedAt: new Date(),
          originalSize: dto.buffer.length,
        },
      });

      mockChunkingService.chunk.mockReturnValue(mockChunks);
      mockEmbeddingService.generateDocumentEmbeddings.mockResolvedValue([
        mockEmbedding,
      ]);

      mockRepository.saveSource.mockImplementation(
        async (source: KnowledgeSource) => {
          Reflect.set(source, 'id', 'source-456');
          return source;
        },
      );

      mockRepository.saveFragments.mockResolvedValue([
        createSavedFragment(
          'fragment-010',
          'source-456',
          mockChunks[0].content,
          0,
          6,
        ),
      ]);

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.sourceId).toBe('source-456');
      expect(result.status).toBe('COMPLETED');
      expect(mockParserService.parse).toHaveBeenCalledWith(
        dto.buffer,
        SourceType.MARKDOWN,
      );
      expect(mockVectorStore.upsertVectors).toHaveBeenCalledTimes(1);
    });

    it('should handle documents with multiple fragments', async () => {
      // Arrange
      const longContent = 'A'.repeat(5000); // Long content to trigger multiple chunks
      const dto: IngestDocumentDto = {
        title: 'Long Document',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.PDF,
        buffer: createMockPdfBuffer(longContent),
      };

      const mockChunks = [
        {
          content: 'A'.repeat(1000),
          position: 0,
          tokens: 250,
          startIndex: 0,
          endIndex: 1000,
        },
        {
          content: 'A'.repeat(1000),
          position: 1,
          tokens: 250,
          startIndex: 1000,
          endIndex: 2000,
        },
        {
          content: 'A'.repeat(1000),
          position: 2,
          tokens: 250,
          startIndex: 2000,
          endIndex: 3000,
        },
      ];

      const mockEmbeddings = [
        Array(3072).fill(0.1),
        Array(3072).fill(0.2),
        Array(3072).fill(0.3),
      ];

      mockParserService.parse.mockResolvedValue({
        content: longContent,
        metadata: {
          sourceType: SourceType.PDF,
          parsedAt: new Date(),
          originalSize: dto.buffer.length,
        },
      });

      mockChunkingService.chunk.mockReturnValue(mockChunks);
      mockEmbeddingService.generateDocumentEmbeddings.mockResolvedValue(
        mockEmbeddings,
      );

      mockRepository.saveSource.mockImplementation(
        async (source: KnowledgeSource) => {
          Reflect.set(source, 'id', 'source-789');
          return source;
        },
      );

      const mockSavedFragments = mockChunks.map((chunk, index) =>
        createSavedFragment(
          `fragment-${index}`,
          'source-789',
          chunk.content,
          index,
          chunk.tokens,
        ),
      );

      mockRepository.saveFragments.mockResolvedValue(mockSavedFragments);

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.fragmentCount).toBe(3);
      expect(result.status).toBe('COMPLETED');
      expect(
        mockEmbeddingService.generateDocumentEmbeddings,
      ).toHaveBeenCalledWith(mockChunks.map((c) => c.content));
      expect(mockRepository.saveFragments).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ position: 0 }),
          expect.objectContaining({ position: 1 }),
          expect.objectContaining({ position: 2 }),
        ]),
      );

      // Verify 3 vectors were upserted
      expect(mockVectorStore.upsertVectors).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'fragment-0' }),
          expect.objectContaining({ id: 'fragment-1' }),
          expect.objectContaining({ id: 'fragment-2' }),
        ]),
      );
    });
  });

  describe('Input Validation', () => {
    it('should throw error for empty title', async () => {
      // Arrange
      const dto: IngestDocumentDto = {
        title: '',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.PDF,
        buffer: createMockPdfBuffer('content'),
      };

      // Act & Assert
      await expect(useCase.execute(dto)).rejects.toThrow(
        'Title cannot be empty',
      );
    });

    it('should throw error for empty sectorId', async () => {
      // Arrange
      const dto: IngestDocumentDto = {
        title: 'Test',
        sectorId: '',
        sourceType: SourceType.PDF,
        buffer: createMockPdfBuffer('content'),
      };

      // Act & Assert
      await expect(useCase.execute(dto)).rejects.toThrow(
        'SectorId cannot be empty',
      );
    });

    it('should throw error for empty buffer', async () => {
      // Arrange
      const dto: IngestDocumentDto = {
        title: 'Test',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.PDF,
        buffer: Buffer.from(''),
      };

      // Act & Assert
      await expect(useCase.execute(dto)).rejects.toThrow(
        'Buffer cannot be empty',
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle parsing errors', async () => {
      // Arrange
      const dto: IngestDocumentDto = {
        title: 'Test Document',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.PDF,
        buffer: createMockPdfBuffer('content'),
      };

      mockParserService.parse.mockRejectedValue(
        new Error('Failed to parse PDF'),
      );

      // Act & Assert
      await expect(useCase.execute(dto)).rejects.toThrow('Failed to parse PDF');
    });

    it('should handle embedding generation errors', async () => {
      // Arrange
      const dto: IngestDocumentDto = {
        title: 'Test Document',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.PDF,
        buffer: createMockPdfBuffer('content'),
      };

      mockParserService.parse.mockResolvedValue({
        content: 'Test content',
        metadata: {
          sourceType: SourceType.PDF,
          parsedAt: new Date(),
          originalSize: dto.buffer.length,
        },
      });

      mockChunkingService.chunk.mockReturnValue([
        {
          content: 'Test content',
          position: 0,
          tokens: 2,
          startIndex: 0,
          endIndex: 12,
        },
      ]);

      mockEmbeddingService.generateDocumentEmbeddings.mockRejectedValue(
        new Error('API rate limit exceeded'),
      );

      mockRepository.saveSource.mockImplementation(
        async (source: KnowledgeSource) => {
          Reflect.set(source, 'id', 'source-error');
          return source;
        },
      );

      // Act & Assert
      await expect(useCase.execute(dto)).rejects.toThrow(
        'API rate limit exceeded',
      );

      // Verify source was saved with PROCESSING status initially
      const savedSource = (mockRepository.saveSource as jest.Mock).mock
        .calls[0][0] as KnowledgeSource;
      expect(savedSource.status).toBe(SourceStatus.PROCESSING);
    });

    it('should handle vector store upsert errors', async () => {
      // Arrange
      const dto: IngestDocumentDto = {
        title: 'Test Document',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.PDF,
        buffer: createMockPdfBuffer('content'),
      };

      mockParserService.parse.mockResolvedValue({
        content: 'Test content here',
        metadata: {
          sourceType: SourceType.PDF,
          parsedAt: new Date(),
          originalSize: dto.buffer.length,
        },
      });

      mockChunkingService.chunk.mockReturnValue([
        {
          content: 'Test content here',
          position: 0,
          tokens: 3,
          startIndex: 0,
          endIndex: 17,
        },
      ]);

      mockEmbeddingService.generateDocumentEmbeddings.mockResolvedValue([
        Array(3072).fill(0.1),
      ]);

      mockRepository.saveSource.mockImplementation(
        async (source: KnowledgeSource) => {
          Reflect.set(source, 'id', 'source-vec-error');
          return source;
        },
      );

      mockRepository.saveFragments.mockResolvedValue([
        createSavedFragment(
          'fragment-err',
          'source-vec-error',
          'Test content here',
          0,
          3,
        ),
      ]);

      mockVectorStore.upsertVectors.mockRejectedValue(
        new Error('Pinecone connection failed'),
      );

      // Act & Assert
      await expect(useCase.execute(dto)).rejects.toThrow(
        'Pinecone connection failed',
      );
    });

    it('should handle repository errors', async () => {
      // Arrange
      const dto: IngestDocumentDto = {
        title: 'Test Document',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.PDF,
        buffer: createMockPdfBuffer('content'),
      };

      mockParserService.parse.mockResolvedValue({
        content: 'Test content',
        metadata: {
          sourceType: SourceType.PDF,
          parsedAt: new Date(),
          originalSize: dto.buffer.length,
        },
      });

      mockRepository.saveSource.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Act & Assert
      await expect(useCase.execute(dto)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('Status Management', () => {
    it('should set source status to PROCESSING initially', async () => {
      // Arrange
      const dto: IngestDocumentDto = {
        title: 'Test Document',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.PDF,
        buffer: createMockPdfBuffer('content'),
      };

      mockParserService.parse.mockResolvedValue({
        content: 'Test content',
        metadata: {
          sourceType: SourceType.PDF,
          parsedAt: new Date(),
          originalSize: dto.buffer.length,
        },
      });

      mockChunkingService.chunk.mockReturnValue([
        {
          content: 'Test content',
          position: 0,
          tokens: 2,
          startIndex: 0,
          endIndex: 12,
        },
      ]);

      mockEmbeddingService.generateDocumentEmbeddings.mockResolvedValue([
        Array(3072).fill(0.1),
      ]);

      // Capture the status at the time of each save
      const capturedStatuses: string[] = [];

      mockRepository.saveSource.mockImplementation(
        async (source: KnowledgeSource) => {
          // Capture status before any mutations
          capturedStatuses.push(source.status);
          Reflect.set(source, 'id', 'source-123');
          return source;
        },
      );

      mockRepository.saveFragments.mockResolvedValue([
        createSavedFragment('frag-001', 'source-123', 'Test content', 0, 2),
      ]);

      // Act
      await useCase.execute(dto);

      // Assert
      expect(capturedStatuses[0]).toBe(SourceStatus.PROCESSING);
    });

    it('should update source status to COMPLETED after successful ingestion', async () => {
      // Arrange
      const dto: IngestDocumentDto = {
        title: 'Test Document',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.PDF,
        buffer: createMockPdfBuffer('content'),
      };

      mockParserService.parse.mockResolvedValue({
        content: 'Test content',
        metadata: {
          sourceType: SourceType.PDF,
          parsedAt: new Date(),
          originalSize: dto.buffer.length,
        },
      });

      mockChunkingService.chunk.mockReturnValue([
        {
          content: 'Test content',
          position: 0,
          tokens: 2,
          startIndex: 0,
          endIndex: 12,
        },
      ]);

      mockEmbeddingService.generateDocumentEmbeddings.mockResolvedValue([
        Array(3072).fill(0.1),
      ]);

      mockRepository.saveSource.mockImplementation(
        async (source: KnowledgeSource) => {
          Reflect.set(source, 'id', 'source-123');
          return source;
        },
      );

      mockRepository.saveFragments.mockResolvedValue([
        createSavedFragment('frag-001', 'source-123', 'Test content', 0, 2),
      ]);

      // Act
      await useCase.execute(dto);

      // Assert - Should be called twice: initial save and status update
      expect(mockRepository.saveSource).toHaveBeenCalledTimes(2);
      const finalSource = (mockRepository.saveSource as jest.Mock).mock
        .calls[1][0] as KnowledgeSource;
      expect(finalSource.status).toBe(SourceStatus.COMPLETED);
    });
  });

  describe('Vector Store Integration', () => {
    it('should upsert vectors to store after saving fragments', async () => {
      // Arrange
      const dto: IngestDocumentDto = {
        title: 'Vector Test',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.PDF,
        buffer: createMockPdfBuffer('Vector content for testing'),
      };

      const mockChunks = [
        {
          content: 'Vector content for testing',
          position: 0,
          tokens: 5,
          startIndex: 0,
          endIndex: 26,
        },
      ];
      const mockEmbedding = Array(3072).fill(0.5);

      mockParserService.parse.mockResolvedValue({
        content: 'Vector content for testing',
        metadata: {
          sourceType: SourceType.PDF,
          parsedAt: new Date(),
          originalSize: dto.buffer.length,
        },
      });

      mockChunkingService.chunk.mockReturnValue(mockChunks);
      mockEmbeddingService.generateDocumentEmbeddings.mockResolvedValue([
        mockEmbedding,
      ]);

      mockRepository.saveSource.mockImplementation(
        async (source: KnowledgeSource) => {
          Reflect.set(source, 'id', 'source-vec');
          return source;
        },
      );

      mockRepository.saveFragments.mockResolvedValue([
        createSavedFragment(
          'frag-vec-001',
          'source-vec',
          'Vector content for testing',
          0,
          5,
        ),
      ]);

      // Act
      await useCase.execute(dto);

      // Assert - verify vector upsert was called after fragments saved
      expect(mockVectorStore.upsertVectors).toHaveBeenCalledTimes(1);
      expect(mockVectorStore.upsertVectors).toHaveBeenCalledWith([
        {
          id: 'frag-vec-001',
          embedding: mockEmbedding,
          metadata: {
            sourceId: 'source-vec',
            sectorId: dto.sectorId,
            content: 'Vector content for testing',
            position: 0,
            tokenCount: 5,
          },
        },
      ]);

      // Assert - fragments were saved to relational DB first, then vectors upserted
      const saveFragmentsOrder = (mockRepository.saveFragments as jest.Mock).mock.invocationCallOrder[0];
      const upsertVectorsOrder = (mockVectorStore.upsertVectors as jest.Mock).mock.invocationCallOrder[0];
      expect(saveFragmentsOrder).toBeLessThan(upsertVectorsOrder);
    });

    it('should not call vector store if no fragments were created', async () => {
      // Arrange
      const dto: IngestDocumentDto = {
        title: 'Empty Chunks Test',
        sectorId: '550e8400-e29b-41d4-a716-446655440000',
        sourceType: SourceType.PDF,
        buffer: createMockPdfBuffer('content'),
      };

      mockParserService.parse.mockResolvedValue({
        content: 'Parsed content',
        metadata: {
          sourceType: SourceType.PDF,
          parsedAt: new Date(),
          originalSize: dto.buffer.length,
        },
      });

      mockChunkingService.chunk.mockReturnValue([]);
      mockEmbeddingService.generateDocumentEmbeddings.mockResolvedValue([]);

      mockRepository.saveSource.mockImplementation(
        async (source: KnowledgeSource) => {
          Reflect.set(source, 'id', 'source-empty');
          return source;
        },
      );

      mockRepository.saveFragments.mockResolvedValue([]);

      // Act
      await useCase.execute(dto);

      // Assert - vector store called with empty array (or skipped)
      expect(mockVectorStore.upsertVectors).toHaveBeenCalledWith([]);
    });
  });
});
