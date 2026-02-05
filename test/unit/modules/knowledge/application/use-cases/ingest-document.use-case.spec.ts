// Mock pdfjs-dist before any imports that use it
jest.mock('pdfjs-dist', () => ({
  getDocument: jest.fn(),
}));

// Mock genkit before any imports
jest.mock('genkit', () => ({
  genkit: jest.fn(),
}));

jest.mock('@genkit-ai/google-genai', () => ({
  googleAI: jest.fn(),
}));

import { IngestDocumentUseCase } from '../../../../../../src/modules/knowledge/application/use-cases/ingest-document.use-case';
import { IKnowledgeRepository } from '../../../../../../src/modules/knowledge/domain/repositories/knowledge.repository.interface';
import { DocumentParserService } from '../../../../../../src/modules/knowledge/infrastructure/services/document-parser.service';
import { ChunkingService } from '../../../../../../src/modules/knowledge/infrastructure/services/chunking.service';
import { EmbeddingService } from '../../../../../../src/modules/knowledge/infrastructure/services/embedding.service';
import { KnowledgeSource } from '../../../../../../src/modules/knowledge/domain/entities/knowledge-source.entity';
import { Fragment } from '../../../../../../src/modules/knowledge/domain/entities/fragment.entity';
import { SourceType, SourceStatus } from '@context-ai/shared';
import type {
  IngestDocumentDto,
  IngestDocumentResult,
} from '../../../../../../src/modules/knowledge/application/dtos/ingest-document.dto';

describe('IngestDocumentUseCase', () => {
  let useCase: IngestDocumentUseCase;
  let mockRepository: jest.Mocked<IKnowledgeRepository>;
  let mockParserService: jest.Mocked<DocumentParserService>;
  let mockChunkingService: jest.Mocked<ChunkingService>;
  let mockEmbeddingService: jest.Mocked<EmbeddingService>;

  beforeEach(() => {
    // Mock Repository
    mockRepository = {
      saveSource: jest.fn(),
      findSourceById: jest.fn(),
      findSourcesBySector: jest.fn(),
      findSourcesByStatus: jest.fn(),
      deleteSource: jest.fn(),
      countSourcesBySector: jest.fn(),
      saveFragment: jest.fn(),
      saveFragments: jest.fn(),
      findFragmentById: jest.fn(),
      findFragmentsBySource: jest.fn(),
      vectorSearch: jest.fn(),
      deleteFragmentsBySource: jest.fn(),
      countFragmentsBySource: jest.fn(),
      transaction: jest.fn(),
    } as unknown as jest.Mocked<IKnowledgeRepository>;

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
      const mockEmbedding = Array(768).fill(0.1);

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

      mockRepository.saveFragments.mockResolvedValue([
        new Fragment({
          sourceId: 'source-123',
          content: mockChunks[0].content,
          position: 0,
          embedding: mockEmbedding,
        }),
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
      expect(mockEmbeddingService.generateDocumentEmbeddings).toHaveBeenCalled();
      expect(mockRepository.saveSource).toHaveBeenCalled();
      expect(mockRepository.saveFragments).toHaveBeenCalled();
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
      const mockEmbedding = Array(768).fill(0.2);

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
        new Fragment({
          sourceId: 'source-456',
          content: mockChunks[0].content,
          position: 0,
          embedding: mockEmbedding,
        }),
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
        Array(768).fill(0.1),
        Array(768).fill(0.2),
        Array(768).fill(0.3),
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

      const mockFragments = mockChunks.map(
        (chunk, index) =>
          new Fragment({
            sourceId: 'source-789',
            content: chunk.content,
            position: index,
            embedding: mockEmbeddings[index],
          }),
      );

      mockRepository.saveFragments.mockResolvedValue(mockFragments);

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.fragmentCount).toBe(3);
      expect(result.status).toBe('COMPLETED');
      expect(mockEmbeddingService.generateDocumentEmbeddings).toHaveBeenCalledWith(
        mockChunks.map((c) => c.content),
      );
      expect(mockRepository.saveFragments).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ position: 0 }),
          expect.objectContaining({ position: 1 }),
          expect.objectContaining({ position: 2 }),
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
      await expect(useCase.execute(dto)).rejects.toThrow('Buffer cannot be empty');
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

      // Verify source was marked as FAILED
      const savedSource = (mockRepository.saveSource as jest.Mock).mock
        .calls[0][0] as KnowledgeSource;
      expect(savedSource.status).toBe(SourceStatus.PROCESSING);
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
        Array(768).fill(0.1),
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

      mockRepository.saveFragments.mockResolvedValue([]);

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
        Array(768).fill(0.1),
      ]);

      mockRepository.saveSource.mockImplementation(
        async (source: KnowledgeSource) => {
          Reflect.set(source, 'id', 'source-123');
          return source;
        },
      );

      mockRepository.saveFragments.mockResolvedValue([]);

      // Act
      await useCase.execute(dto);

      // Assert - Should be called twice: initial save and status update
      expect(mockRepository.saveSource).toHaveBeenCalledTimes(2);
      const finalSource = (mockRepository.saveSource as jest.Mock).mock
        .calls[1][0] as KnowledgeSource;
      expect(finalSource.status).toBe(SourceStatus.COMPLETED);
    });
  });
});

