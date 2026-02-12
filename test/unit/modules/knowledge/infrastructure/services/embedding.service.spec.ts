import {
  EmbeddingService,
  EmbeddingTaskType,
} from '../../../../../../src/modules/knowledge/infrastructure/services/embedding.service';

// Mock Genkit modules
const mockEmbedFn = jest.fn();
const mockGenkit = {
  embed: mockEmbedFn,
};

jest.mock('genkit', () => ({
  genkit: jest.fn(() => mockGenkit),
}));

jest.mock('@genkit-ai/google-genai', () => ({
  googleAI: jest.fn(),
}));

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  const mockGenkitFactory = genkit as jest.MockedFunction<typeof genkit>;
  const mockGoogleAI = googleAI as jest.MockedFunction<typeof googleAI>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEmbedFn.mockClear();

    // Set default API key for tests
    process.env.GOOGLE_API_KEY = 'test-api-key';

    service = new EmbeddingService();
  });

  afterEach(() => {
    // Clean up
    delete process.env.GOOGLE_API_KEY;
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      // Arrange & Act
      const config = service.getConfig();

      // Assert
      expect(config.model).toBe('googleai/gemini-embedding-001');
      expect(config.dimensions).toBe(3072);
      expect(config.batchSize).toBe(100);
      expect(config).not.toHaveProperty('apiKey'); // Security: apiKey should not be exposed
    });

    it('should accept custom configuration', () => {
      // Arrange
      const customService = new EmbeddingService({
        model: 'googleai/gemini-embedding-001',
        dimensions: 1536,
        batchSize: 50,
      });

      // Act
      const config = customService.getConfig();

      // Assert
      expect(config.model).toBe('googleai/gemini-embedding-001');
      expect(config.dimensions).toBe(1536);
      expect(config.batchSize).toBe(50);
    });

    it('should validate dimensions are positive', () => {
      // Arrange, Act & Assert
      expect(() => {
        new EmbeddingService({ dimensions: 0 });
      }).toThrow('Dimensions must be a positive number');
    });

    it('should validate batch size is positive', () => {
      // Arrange, Act & Assert
      expect(() => {
        new EmbeddingService({ batchSize: 0 });
      }).toThrow('Batch size must be a positive number');
    });

    it('should validate supported dimensions', () => {
      // Arrange, Act & Assert
      expect(() => {
        new EmbeddingService({ dimensions: 999 });
      }).toThrow(
        'Invalid dimensions. Supported dimensions: 768, 1536, 3072',
      );
    });

    it('should accept valid dimensions: 768', () => {
      // Arrange, Act
      const customService = new EmbeddingService({ dimensions: 768 });

      // Assert
      expect(customService.getEmbeddingDimension()).toBe(768);
    });

    it('should accept valid dimensions: 1536', () => {
      // Arrange, Act
      const customService = new EmbeddingService({ dimensions: 1536 });

      // Assert
      expect(customService.getEmbeddingDimension()).toBe(1536);
    });

    it('should accept valid dimensions: 3072', () => {
      // Arrange, Act
      const customService = new EmbeddingService({ dimensions: 3072 });

      // Assert
      expect(customService.getEmbeddingDimension()).toBe(3072);
    });
  });

  describe('Single Text Embedding', () => {
    it('should generate embedding for single text', async () => {
      // Arrange
      const text = 'This is a test sentence for embedding generation.';
      const mockEmbedding = Array(3072).fill(0.1);
      // Genkit returns an array with objects containing the embedding
      mockEmbedFn.mockResolvedValue([{ embedding: mockEmbedding }]);

      // Act
      const embedding = await service.generateEmbedding(text);

      // Assert
      expect(embedding).toEqual(mockEmbedding);
      expect(embedding).toHaveLength(3072);
      expect(mockEmbedFn).toHaveBeenCalledTimes(1);
      expect(mockEmbedFn).toHaveBeenCalledWith({
        embedder: 'googleai/gemini-embedding-001',
        content: text,
        options: {
          outputDimensionality: 3072,
        },
      });
    });

    it('should initialize Genkit on first call', async () => {
      // Arrange
      const text = 'Test text';
      const mockEmbedding = Array(3072).fill(0.1);
      mockEmbedFn.mockResolvedValue([{ embedding: mockEmbedding }]);

      // Act
      await service.generateEmbedding(text);

      // Assert
      expect(mockGenkitFactory).toHaveBeenCalledTimes(1);
      expect(mockGoogleAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
      });
    });

    it('should throw error if API key is missing', async () => {
      // Arrange
      delete process.env.GOOGLE_API_KEY;
      const serviceWithoutKey = new EmbeddingService();
      const text = 'Test text';

      // Act & Assert
      await expect(serviceWithoutKey.generateEmbedding(text)).rejects.toThrow(
        'GOOGLE_API_KEY environment variable is required',
      );
    });

    it('should throw error for empty text', async () => {
      // Arrange
      const emptyText = '';

      // Act & Assert
      await expect(service.generateEmbedding(emptyText)).rejects.toThrow(
        'Text cannot be empty',
      );
    });

    it('should throw error for null text', async () => {
      // Arrange
      const nullText = null as any;

      // Act & Assert
      await expect(service.generateEmbedding(nullText)).rejects.toThrow(
        'Text cannot be null or undefined',
      );
    });

    it('should throw error for undefined text', async () => {
      // Arrange
      const undefinedText = undefined as any;

      // Act & Assert
      await expect(service.generateEmbedding(undefinedText)).rejects.toThrow(
        'Text cannot be null or undefined',
      );
    });

    it('should handle API errors gracefully', async () => {
      // Arrange
      const text = 'Test text';
      mockEmbedFn.mockRejectedValue(
        new Error('API Error: Rate limit exceeded'),
      );

      // Act & Assert
      await expect(service.generateEmbedding(text)).rejects.toThrow(
        'Failed to generate embedding: API Error: Rate limit exceeded',
      );
    });

    it('should handle very long text (within limits)', async () => {
      // Arrange
      const longText = 'word '.repeat(1000); // 1000 words
      const mockEmbedding = Array(3072).fill(0.1);
      mockEmbedFn.mockResolvedValue([{ embedding: mockEmbedding }]);

      // Act
      const embedding = await service.generateEmbedding(longText);

      // Assert
      expect(embedding).toEqual(mockEmbedding);
      expect(mockEmbedFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Batch Text Embedding', () => {
    it('should generate embeddings for multiple texts', async () => {
      // Arrange
      const texts = [
        'First test sentence',
        'Second test sentence',
        'Third test sentence',
      ];
      const mockEmbedding = Array(3072).fill(0.1);
      mockEmbedFn.mockResolvedValue([{ embedding: mockEmbedding }]);

      // Act
      const embeddings = await service.generateEmbeddings(texts);

      // Assert
      expect(embeddings).toHaveLength(3);
      expect(mockEmbedFn).toHaveBeenCalledTimes(3);
      embeddings.forEach((embedding) => {
        expect(embedding).toHaveLength(3072);
      });
    });

    it('should handle empty array', async () => {
      // Arrange
      const texts: string[] = [];

      // Act
      const embeddings = await service.generateEmbeddings(texts);

      // Assert
      expect(embeddings).toEqual([]);
      expect(mockEmbedFn).not.toHaveBeenCalled();
    });

    it('should process texts in batches', async () => {
      // Arrange
      const customService = new EmbeddingService({ batchSize: 2 });
      const texts = ['Text 1', 'Text 2', 'Text 3', 'Text 4', 'Text 5'];
      const mockEmbedding = Array(3072).fill(0.1);
      mockEmbedFn.mockResolvedValue([{ embedding: mockEmbedding }]);

      // Act
      const embeddings = await customService.generateEmbeddings(texts);

      // Assert
      expect(embeddings).toHaveLength(5);
      // Should process in 3 batches: [2, 2, 1]
      expect(mockEmbedFn).toHaveBeenCalledTimes(5);
    });

    it('should handle batch with some failures', async () => {
      // Arrange
      const texts = ['Text 1', 'Text 2', 'Text 3'];
      const mockEmbedding = Array(3072).fill(0.1);

      // First call succeeds, second fails, third succeeds
      mockEmbedFn
        .mockResolvedValueOnce([{ embedding: mockEmbedding }])
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce([{ embedding: mockEmbedding }]);

      // Act & Assert
      await expect(service.generateEmbeddings(texts)).rejects.toThrow(
        'Failed to generate embedding: API Error',
      );
    });

    it('should validate all texts are non-empty', async () => {
      // Arrange
      const texts = ['Valid text', '', 'Another valid text'];

      // Act & Assert
      await expect(service.generateEmbeddings(texts)).rejects.toThrow(
        'Text cannot be empty',
      );
    });
  });

  describe('Embedding Dimensions', () => {
    it('should return correct embedding dimension', () => {
      // Arrange & Act
      const dimension = service.getEmbeddingDimension();

      // Assert
      expect(dimension).toBe(3072);
    });

    it('should match configured dimension', () => {
      // Arrange
      const customService = new EmbeddingService({ dimensions: 1536 });

      // Act
      const dimension = customService.getEmbeddingDimension();

      // Assert
      expect(dimension).toBe(1536);
    });

    it('should use outputDimensionality option in API call', async () => {
      // Arrange
      const customService = new EmbeddingService({ dimensions: 1536 });
      const text = 'Test text';
      const mockEmbedding = Array(1536).fill(0.1);
      mockEmbedFn.mockResolvedValue([{ embedding: mockEmbedding }]);

      // Act
      await customService.generateEmbedding(text);

      // Assert
      expect(mockEmbedFn).toHaveBeenCalledWith({
        embedder: 'googleai/gemini-embedding-001',
        content: text,
        options: {
          outputDimensionality: 1536,
        },
      });
    });
  });

  describe('Performance', () => {
    it('should handle large batch efficiently', async () => {
      // Arrange
      const texts = Array(100)
        .fill(null)
        .map((_, i) => `Test sentence ${i}`);
      const mockEmbedding = Array(3072).fill(0.1);
      mockEmbedFn.mockResolvedValue([{ embedding: mockEmbedding }]);
      const startTime = Date.now();

      // Act
      const embeddings = await service.generateEmbeddings(texts);
      const endTime = Date.now();

      // Assert
      expect(embeddings).toHaveLength(100);
      // Should complete in reasonable time (allowing for mocked calls)
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max
    });
  });

  describe('Integration with Vector Store', () => {
    it('should produce embeddings compatible with IVectorStore', async () => {
      // Arrange
      const text = 'This is content for a Fragment entity.';
      const mockEmbedding = Array(3072).fill(0.1);
      mockEmbedFn.mockResolvedValue([{ embedding: mockEmbedding }]);

      // Act
      const embedding = await service.generateEmbedding(text);

      // Assert
      // Embeddings are stored in Pinecone via IVectorStore (3072 dimensions for text-embedding-004)
      expect([768, 1536, 3072]).toContain(embedding.length);
      // All values should be numbers
      embedding.forEach((value) => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Error Recovery', () => {
    it('should provide meaningful error messages', async () => {
      // Arrange
      const text = 'Test text';
      mockEmbedFn.mockRejectedValue(new Error('Network timeout'));

      // Act & Assert
      try {
        await service.generateEmbedding(text);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Failed to generate embedding');
        expect(error.message).toContain('Network timeout');
      }
    });

    it('should handle unknown errors', async () => {
      // Arrange
      const text = 'Test text';
      mockEmbedFn.mockRejectedValue('Unknown error type');

      // Act & Assert
      await expect(service.generateEmbedding(text)).rejects.toThrow(
        'Failed to generate embedding: Unknown error',
      );
    });
  });

  describe('Text Truncation', () => {
    it('should handle text exceeding token limits', async () => {
      // Arrange
      // Gemini embedding models have a limit of ~2048 tokens (~8000 characters)
      const veryLongText = 'word '.repeat(10000); // Way over limit
      const mockEmbedding = Array(3072).fill(0.1);
      mockEmbedFn.mockResolvedValue([{ embedding: mockEmbedding }]);

      // Act
      const embedding = await service.generateEmbedding(veryLongText);

      // Assert
      // Service should truncate or handle long text
      expect(embedding).toBeDefined();
      expect(embedding).toHaveLength(3072);
    });
  });

  describe('Task Type Optimization', () => {
    it('should support RETRIEVAL_DOCUMENT task type', async () => {
      // Arrange
      const text = 'Document content to be indexed';
      const mockEmbedding = Array(3072).fill(0.1);
      mockEmbedFn.mockResolvedValue([{ embedding: mockEmbedding }]);

      // Act
      const embedding = await service.generateEmbedding(
        text,
        EmbeddingTaskType.RETRIEVAL_DOCUMENT,
      );

      // Assert
      expect(embedding).toEqual(mockEmbedding);
      expect(mockEmbedFn).toHaveBeenCalledWith({
        embedder: 'googleai/gemini-embedding-001',
        content: text,
        options: {
          outputDimensionality: 3072,
          taskType: EmbeddingTaskType.RETRIEVAL_DOCUMENT,
        },
      });
    });

    it('should support RETRIEVAL_QUERY task type', async () => {
      // Arrange
      const text = 'User search query';
      const mockEmbedding = Array(3072).fill(0.1);
      mockEmbedFn.mockResolvedValue([{ embedding: mockEmbedding }]);

      // Act
      const embedding = await service.generateEmbedding(
        text,
        EmbeddingTaskType.RETRIEVAL_QUERY,
      );

      // Assert
      expect(embedding).toEqual(mockEmbedding);
      expect(mockEmbedFn).toHaveBeenCalledWith({
        embedder: 'googleai/gemini-embedding-001',
        content: text,
        options: {
          outputDimensionality: 3072,
          taskType: EmbeddingTaskType.RETRIEVAL_QUERY,
        },
      });
    });

    it('should not include taskType when not provided', async () => {
      // Arrange
      const text = 'General text';
      const mockEmbedding = Array(3072).fill(0.1);
      mockEmbedFn.mockResolvedValue([{ embedding: mockEmbedding }]);

      // Act
      await service.generateEmbedding(text);

      // Assert
      expect(mockEmbedFn).toHaveBeenCalledWith({
        embedder: 'googleai/gemini-embedding-001',
        content: text,
        options: {
          outputDimensionality: 3072,
        },
      });
    });
  });

  describe('Specialized Embedding Methods', () => {
    it('should generate document embedding with RETRIEVAL_DOCUMENT taskType', async () => {
      // Arrange
      const docText = 'This is a document to be stored in Pinecone';
      const mockEmbedding = Array(3072).fill(0.1);
      mockEmbedFn.mockResolvedValue([{ embedding: mockEmbedding }]);

      // Act
      const embedding = await service.generateDocumentEmbedding(docText);

      // Assert
      expect(embedding).toEqual(mockEmbedding);
      expect(mockEmbedFn).toHaveBeenCalledWith({
        embedder: 'googleai/gemini-embedding-001',
        content: docText,
        options: {
          outputDimensionality: 3072,
          taskType: EmbeddingTaskType.RETRIEVAL_DOCUMENT,
        },
      });
    });

    it('should generate query embedding with RETRIEVAL_QUERY taskType', async () => {
      // Arrange
      const queryText = 'How do I update my database?';
      const mockEmbedding = Array(3072).fill(0.1);
      mockEmbedFn.mockResolvedValue([{ embedding: mockEmbedding }]);

      // Act
      const embedding = await service.generateQueryEmbedding(queryText);

      // Assert
      expect(embedding).toEqual(mockEmbedding);
      expect(mockEmbedFn).toHaveBeenCalledWith({
        embedder: 'googleai/gemini-embedding-001',
        content: queryText,
        options: {
          outputDimensionality: 3072,
          taskType: EmbeddingTaskType.RETRIEVAL_QUERY,
        },
      });
    });

    it('should generate multiple document embeddings', async () => {
      // Arrange
      const docs = ['Document 1', 'Document 2', 'Document 3'];
      const mockEmbedding = Array(3072).fill(0.1);
      mockEmbedFn.mockResolvedValue([{ embedding: mockEmbedding }]);

      // Act
      const embeddings = await service.generateDocumentEmbeddings(docs);

      // Assert
      expect(embeddings).toHaveLength(3);
      expect(mockEmbedFn).toHaveBeenCalledTimes(3);
      // Check first call has correct taskType
      expect(mockEmbedFn).toHaveBeenCalledWith({
        embedder: 'googleai/gemini-embedding-001',
        content: 'Document 1',
        options: {
          outputDimensionality: 3072,
          taskType: EmbeddingTaskType.RETRIEVAL_DOCUMENT,
        },
      });
    });
  });
});
