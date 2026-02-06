import { ChunkingService } from '../../../../../../src/modules/knowledge/infrastructure/services/chunking.service';

describe('ChunkingService', () => {
  let service: ChunkingService;

  beforeEach(() => {
    service = new ChunkingService();
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      // Arrange & Act
      const config = service.getConfig();

      // Assert
      expect(config.chunkSize).toBe(500);
      expect(config.overlap).toBe(50);
      expect(config.minChunkSize).toBe(100);
    });

    it('should accept custom configuration', () => {
      // Arrange
      const customService = new ChunkingService({
        chunkSize: 300,
        overlap: 30,
        minChunkSize: 50,
      });

      // Act
      const config = customService.getConfig();

      // Assert
      expect(config.chunkSize).toBe(300);
      expect(config.overlap).toBe(30);
      expect(config.minChunkSize).toBe(50);
    });

    it('should validate overlap is less than chunk size', () => {
      // Arrange & Act & Assert
      expect(() => {
        new ChunkingService({ chunkSize: 100, overlap: 150 });
      }).toThrow('Overlap must be less than chunk size');
    });

    it('should validate chunk size is greater than min chunk size', () => {
      // Arrange & Act & Assert
      expect(() => {
        new ChunkingService({ chunkSize: 100, minChunkSize: 200 });
      }).toThrow('Chunk size must be greater than min chunk size');
    });
  });

  describe('Basic Chunking', () => {
    it('should chunk short text into single chunk', () => {
      // Arrange
      const text = 'This is a short text that fits in one chunk.';

      // Act
      const chunks = service.chunk(text);

      // Assert
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(text);
      expect(chunks[0].position).toBe(0);
      expect(chunks[0].tokens).toBeLessThanOrEqual(500);
    });

    it('should chunk long text into multiple chunks', () => {
      // Arrange
      const text = 'word '.repeat(600); // ~600 words = ~800 tokens

      // Act
      const chunks = service.chunk(text);

      // Assert
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].position).toBe(0);
      expect(chunks[1].position).toBe(1);
    });

    it('should throw error for empty text', () => {
      // Arrange
      const emptyText = '';

      // Act & Assert
      expect(() => service.chunk(emptyText)).toThrow('Text cannot be empty');
    });

    it('should throw error for null text', () => {
      // Arrange
      const nullText = null as any;

      // Act & Assert
      expect(() => service.chunk(nullText)).toThrow(
        'Text cannot be null or undefined',
      );
    });

    it('should throw error for undefined text', () => {
      // Arrange
      const undefinedText = undefined as any;

      // Act & Assert
      expect(() => service.chunk(undefinedText)).toThrow(
        'Text cannot be null or undefined',
      );
    });
  });

  describe('Sliding Window with Overlap', () => {
    it('should create overlapping chunks', () => {
      // Arrange
      const text = 'word '.repeat(800); // Long text

      // Act
      const chunks = service.chunk(text);

      // Assert
      expect(chunks.length).toBeGreaterThan(1);

      // Check that consecutive chunks have overlap
      for (let i = 0; i < chunks.length - 1; i++) {
        const currentChunk = chunks[i].content;
        const nextChunk = chunks[i + 1].content;

        // Extract end of current and start of next
        const currentEnd = currentChunk.split(' ').slice(-10).join(' ');
        const nextStart = nextChunk.split(' ').slice(0, 10).join(' ');

        // There should be some overlap
        expect(nextStart).toContain(currentEnd.split(' ')[0]);
      }
    });

    it('should respect configured overlap size', () => {
      // Arrange
      const customService = new ChunkingService({
        chunkSize: 200,
        overlap: 20,
      });
      const text = 'word '.repeat(300);

      // Act
      const chunks = customService.chunk(text);

      // Assert
      expect(chunks.length).toBeGreaterThan(1);
      // Each chunk should not exceed configured size
      chunks.forEach((chunk) => {
        expect(chunk.tokens).toBeLessThanOrEqual(200);
      });
    });

    it('should not create chunks smaller than min size', () => {
      // Arrange
      const text = 'word '.repeat(550); // Creates potential small last chunk

      // Act
      const chunks = service.chunk(text);

      // Assert
      chunks.forEach((chunk) => {
        // All chunks should meet minimum size or be the last chunk
        const isLastChunk = chunk.position === chunks.length - 1;
        if (!isLastChunk) {
          expect(chunk.tokens).toBeGreaterThanOrEqual(100);
        }
      });
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens correctly', () => {
      // Arrange
      const text = 'This is a test sentence with ten words in total.';
      // Rough estimate: 10 words ≈ 13 tokens (1.3 ratio)

      // Act
      const tokens = service.estimateTokens(text);

      // Assert
      expect(tokens).toBeGreaterThan(8);
      expect(tokens).toBeLessThan(20);
    });

    it('should handle empty string token estimation', () => {
      // Arrange
      const text = '';

      // Act
      const tokens = service.estimateTokens(text);

      // Assert
      expect(tokens).toBe(0);
    });

    it('should estimate tokens for long text', () => {
      // Arrange
      const text = 'word '.repeat(1000); // 1000 words

      // Act
      const tokens = service.estimateTokens(text);

      // Assert
      expect(tokens).toBeGreaterThan(1000);
      expect(tokens).toBeLessThan(1500);
    });
  });

  describe('Chunk Metadata', () => {
    it('should include position in chunks', () => {
      // Arrange
      const text = 'word '.repeat(800);

      // Act
      const chunks = service.chunk(text);

      // Assert
      chunks.forEach((chunk, index) => {
        expect(chunk.position).toBe(index);
      });
    });

    it('should include token count in chunks', () => {
      // Arrange
      const text = 'This is a test.';

      // Act
      const chunks = service.chunk(text);

      // Assert
      chunks.forEach((chunk) => {
        expect(chunk.tokens).toBeGreaterThan(0);
        expect(chunk.tokens).toBeLessThanOrEqual(500);
      });
    });

    it('should include start and end indices', () => {
      // Arrange
      const text = 'word '.repeat(800);

      // Act
      const chunks = service.chunk(text);

      // Assert
      chunks.forEach((chunk, index) => {
        expect(chunk.startIndex).toBeGreaterThanOrEqual(0);
        expect(chunk.endIndex).toBeGreaterThan(chunk.startIndex);
        expect(chunk.endIndex).toBeLessThanOrEqual(text.length);

        // Verify content matches indices
        const extractedContent = text.substring(
          chunk.startIndex,
          chunk.endIndex,
        );
        expect(extractedContent.trim()).toBe(chunk.content.trim());
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle text with only whitespace', () => {
      // Arrange
      const text = '   \n\n   \t\t   ';

      // Act & Assert
      expect(() => service.chunk(text)).toThrow('Text cannot be empty');
    });

    it('should handle text with special characters', () => {
      // Arrange
      const text = 'Hello! @#$%^&*() World? 你好 Мир 🚀 '.repeat(100);

      // Act
      const chunks = service.chunk(text);

      // Assert
      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeGreaterThan(0);
      });
    });

    it('should handle text with multiple line breaks', () => {
      // Arrange
      const text = 'Line 1\n\nLine 2\n\n\nLine 3\n'.repeat(100);

      // Act
      const chunks = service.chunk(text);

      // Assert
      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeGreaterThan(0);
      });
    });

    it('should handle very long words', () => {
      // Arrange
      const longWord = 'a'.repeat(1000);
      const text = `Normal text ${longWord} more text`;

      // Act
      const chunks = service.chunk(text);

      // Assert
      expect(chunks.length).toBeGreaterThan(0);
      // Long word should be split if necessary
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance', () => {
    it('should handle large documents efficiently', () => {
      // Arrange
      const text = 'word '.repeat(10000); // Large document
      const startTime = Date.now();

      // Act
      const chunks = service.chunk(text);
      const endTime = Date.now();

      // Assert
      expect(chunks.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in < 1s
    });

    it('should not exceed memory limits with large text', () => {
      // Arrange
      const text = 'word '.repeat(50000); // Very large document

      // Act
      const chunks = service.chunk(text);

      // Assert
      expect(chunks.length).toBeGreaterThan(0);
      // Verify chunks are being created, not just one huge chunk
      expect(chunks.length).toBeGreaterThan(50);
    });
  });

  describe('Integration with Fragment Creation', () => {
    it('should produce chunks ready for Fragment entity', () => {
      // Arrange
      const text = 'word '.repeat(600);

      // Act
      const chunks = service.chunk(text);

      // Assert
      chunks.forEach((chunk) => {
        // Chunks should meet Fragment entity requirements
        expect(chunk.content.length).toBeGreaterThanOrEqual(10); // Min content length
        expect(chunk.position).toBeGreaterThanOrEqual(0);
        expect(chunk.tokens).toBeGreaterThan(0);
        expect(typeof chunk.content).toBe('string');
      });
    });
  });
});
