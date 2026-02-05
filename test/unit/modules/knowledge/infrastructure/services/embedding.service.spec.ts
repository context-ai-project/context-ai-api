import { EmbeddingService } from '../../../../../../src/modules/knowledge/infrastructure/services/embedding.service';

// Mock Genkit modules
jest.mock('@genkit-ai/ai', () => ({
  embed: jest.fn(),
}));

jest.mock('@genkit-ai/googleai', () => ({
  gemini15Flash: jest.fn(),
  textEmbedding004: jest.fn(() => 'mock-embedder'),
}));

jest.mock('@genkit-ai/core', () => ({
  genkit: jest.fn(() => ({
    embed: jest.fn(),
  })),
}));

import { embed } from '@genkit-ai/ai';
import { textEmbedding004 } from '@genkit-ai/googleai';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  const mockEmbed = embed as jest.MockedFunction<typeof embed>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmbeddingService();
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      // Arrange & Act
      const config = service.getConfig();

      // Assert
      expect(config.model).toBe('text-embedding-004');
      expect(config.dimensions).toBe(768);
      expect(config.batchSize).toBe(100);
    });

    it('should accept custom configuration', () => {
      // Arrange
      const customService = new EmbeddingService({
        model: 'custom-model',
        dimensions: 1536,
        batchSize: 50,
      });

      // Act
      const config = customService.getConfig();

      // Assert
      expect(config.model).toBe('custom-model');
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
  });

  describe('Single Text Embedding', () => {
    it('should generate embedding for single text', async () => {
      // Arrange
      const text = 'This is a test sentence for embedding generation.';
      const mockEmbedding = Array(768).fill(0.1);
      mockEmbed.mockResolvedValue(mockEmbedding);

      // Act
      const embedding = await service.generateEmbedding(text);

      // Assert
      expect(embedding).toEqual(mockEmbedding);
      expect(embedding).toHaveLength(768);
      expect(mockEmbed).toHaveBeenCalledTimes(1);
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
      mockEmbed.mockRejectedValue(new Error('API Error: Rate limit exceeded'));

      // Act & Assert
      await expect(service.generateEmbedding(text)).rejects.toThrow(
        'Failed to generate embedding: API Error: Rate limit exceeded',
      );
    });

    it('should handle very long text (within limits)', async () => {
      // Arrange
      const longText = 'word '.repeat(1000); // 1000 words
      const mockEmbedding = Array(768).fill(0.1);
      mockEmbed.mockResolvedValue(mockEmbedding);

      // Act
      const embedding = await service.generateEmbedding(longText);

      // Assert
      expect(embedding).toEqual(mockEmbedding);
      expect(mockEmbed).toHaveBeenCalledTimes(1);
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
      const mockEmbedding = Array(768).fill(0.1);
      mockEmbed.mockResolvedValue(mockEmbedding);

      // Act
      const embeddings = await service.generateEmbeddings(texts);

      // Assert
      expect(embeddings).toHaveLength(3);
      expect(mockEmbed).toHaveBeenCalledTimes(3);
      embeddings.forEach((embedding) => {
        expect(embedding).toHaveLength(768);
      });
    });

    it('should handle empty array', async () => {
      // Arrange
      const texts: string[] = [];

      // Act
      const embeddings = await service.generateEmbeddings(texts);

      // Assert
      expect(embeddings).toEqual([]);
      expect(mockEmbed).not.toHaveBeenCalled();
    });

    it('should process texts in batches', async () => {
      // Arrange
      const customService = new EmbeddingService({ batchSize: 2 });
      const texts = ['Text 1', 'Text 2', 'Text 3', 'Text 4', 'Text 5'];
      const mockEmbedding = Array(768).fill(0.1);
      mockEmbed.mockResolvedValue(mockEmbedding);

      // Act
      const embeddings = await customService.generateEmbeddings(texts);

      // Assert
      expect(embeddings).toHaveLength(5);
      // Should process in 3 batches: [2, 2, 1]
      expect(mockEmbed).toHaveBeenCalledTimes(5);
    });

    it('should handle batch with some failures', async () => {
      // Arrange
      const texts = ['Text 1', 'Text 2', 'Text 3'];
      const mockEmbedding = Array(768).fill(0.1);
      
      // First call succeeds, second fails, third succeeds
      mockEmbed
        .mockResolvedValueOnce(mockEmbedding)
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce(mockEmbedding);

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
      expect(dimension).toBe(768);
    });

    it('should match configured dimension', () => {
      // Arrange
      const customService = new EmbeddingService({ dimensions: 1536 });

      // Act
      const dimension = customService.getEmbeddingDimension();

      // Assert
      expect(dimension).toBe(1536);
    });
  });

  describe('Performance', () => {
    it('should handle large batch efficiently', async () => {
      // Arrange
      const texts = Array(100)
        .fill(null)
        .map((_, i) => `Test sentence ${i}`);
      const mockEmbedding = Array(768).fill(0.1);
      mockEmbed.mockResolvedValue(mockEmbedding);
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

  describe('Integration with Fragment Entity', () => {
    it('should produce embeddings compatible with Fragment entity', async () => {
      // Arrange
      const text = 'This is content for a Fragment entity.';
      const mockEmbedding = Array(768).fill(0.1);
      mockEmbed.mockResolvedValue(mockEmbedding);

      // Act
      const embedding = await service.generateEmbedding(text);

      // Assert
      // Fragment entity expects embeddings to be 768 or 1536 dimensions
      expect([768, 1536]).toContain(embedding.length);
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
      mockEmbed.mockRejectedValue(new Error('Network timeout'));

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
      mockEmbed.mockRejectedValue('Unknown error type');

      // Act & Assert
      await expect(service.generateEmbedding(text)).rejects.toThrow(
        'Failed to generate embedding: Unknown error',
      );
    });
  });

  describe('Text Truncation', () => {
    it('should handle text exceeding token limits', async () => {
      // Arrange
      // Gemini text-embedding-004 has a limit of ~2048 tokens (~8000 characters)
      const veryLongText = 'word '.repeat(10000); // Way over limit
      const mockEmbedding = Array(768).fill(0.1);
      mockEmbed.mockResolvedValue(mockEmbedding);

      // Act
      const embedding = await service.generateEmbedding(veryLongText);

      // Assert
      // Service should truncate or handle long text
      expect(embedding).toBeDefined();
      expect(embedding).toHaveLength(768);
    });
  });
});

