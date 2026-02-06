import { Fragment } from '../../../../../../src/modules/knowledge/domain/entities/fragment.entity';

describe('Fragment Entity', () => {
  describe('Creation', () => {
    it('should create a fragment with valid data', () => {
      // Arrange
      const mockEmbedding = new Array(768).fill(0.1);
      const validData = {
        sourceId: 'source-123',
        content:
          'Este es el contenido del fragmento que contiene información importante...',
        position: 0,
        embedding: mockEmbedding,
        metadata: { tokens: 45, page: 1 },
      };

      // Act
      const fragment = new Fragment(validData);

      // Assert
      expect(fragment.sourceId).toBe('source-123');
      expect(fragment.content).toBe(
        'Este es el contenido del fragmento que contiene información importante...',
      );
      expect(fragment.position).toBe(0);
      expect(fragment.embedding).toEqual(mockEmbedding);
      expect(fragment.metadata).toEqual({ tokens: 45, page: 1 });
      expect(fragment.id).toBeUndefined(); // ID assigned by DB
      expect(fragment.createdAt).toBeInstanceOf(Date);
    });

    it('should create a fragment without metadata', () => {
      // Arrange
      const mockEmbedding = new Array(768).fill(0.2);
      const data = {
        sourceId: 'source-456',
        content: 'Fragmento sin metadata...',
        position: 1,
        embedding: mockEmbedding,
      };

      // Act
      const fragment = new Fragment(data);

      // Assert
      expect(fragment.metadata).toBeUndefined();
      expect(fragment.sourceId).toBe('source-456');
    });

    it('should create fragments with different positions', () => {
      // Arrange
      const mockEmbedding = new Array(768).fill(0.3);

      // Act
      const fragment1 = new Fragment({
        sourceId: 'source-789',
        content: 'Primer fragmento...',
        position: 0,
        embedding: mockEmbedding,
      });

      const fragment2 = new Fragment({
        sourceId: 'source-789',
        content: 'Segundo fragmento...',
        position: 1,
        embedding: mockEmbedding,
      });

      // Assert
      expect(fragment1.position).toBe(0);
      expect(fragment2.position).toBe(1);
    });
  });

  describe('Validation', () => {
    const mockEmbedding = new Array(768).fill(0.1);

    it('should throw error if sourceId is empty', () => {
      // Arrange
      const invalidData = {
        sourceId: '',
        content: 'Content...',
        position: 0,
        embedding: mockEmbedding,
      };

      // Act & Assert
      expect(() => new Fragment(invalidData)).toThrow(
        'SourceId cannot be empty',
      );
    });

    it('should throw error if content is empty', () => {
      // Arrange
      const invalidData = {
        sourceId: 'source-123',
        content: '',
        position: 0,
        embedding: mockEmbedding,
      };

      // Act & Assert
      expect(() => new Fragment(invalidData)).toThrow(
        'Content cannot be empty',
      );
    });

    it('should throw error if content is too short (less than 10 characters)', () => {
      // Arrange
      const invalidData = {
        sourceId: 'source-123',
        content: 'Short',
        position: 0,
        embedding: mockEmbedding,
      };

      // Act & Assert
      expect(() => new Fragment(invalidData)).toThrow(
        'Content must be at least 10 characters long',
      );
    });

    it('should throw error if position is negative', () => {
      // Arrange
      const invalidData = {
        sourceId: 'source-123',
        content: 'Valid content here...',
        position: -1,
        embedding: mockEmbedding,
      };

      // Act & Assert
      expect(() => new Fragment(invalidData)).toThrow(
        'Position cannot be negative',
      );
    });

    it('should throw error if embedding is null or undefined', () => {
      // Arrange
      const invalidData = {
        sourceId: 'source-123',
        content: 'Valid content here...',
        position: 0,
        embedding: null as any,
      };

      // Act & Assert
      expect(() => new Fragment(invalidData)).toThrow(
        'Embedding cannot be null or undefined',
      );
    });

    it('should throw error if embedding is empty array', () => {
      // Arrange
      const invalidData = {
        sourceId: 'source-123',
        content: 'Valid content here...',
        position: 0,
        embedding: [],
      };

      // Act & Assert
      expect(() => new Fragment(invalidData)).toThrow(
        'Embedding array cannot be empty',
      );
    });

    it('should throw error if embedding has invalid dimension', () => {
      // Arrange
      const invalidData = {
        sourceId: 'source-123',
        content: 'Valid content here...',
        position: 0,
        embedding: new Array(500).fill(0.1), // Invalid dimension
      };

      // Act & Assert
      expect(() => new Fragment(invalidData)).toThrow(
        'Embedding must be 768 or 1536 dimensions',
      );
    });

    it('should accept 768-dimensional embedding (Gemini text-embedding-004)', () => {
      // Arrange
      const validData = {
        sourceId: 'source-123',
        content: 'Valid content here...',
        position: 0,
        embedding: new Array(768).fill(0.1),
      };

      // Act
      const fragment = new Fragment(validData);

      // Assert
      expect(fragment.embedding).toHaveLength(768);
    });

    it('should accept 1536-dimensional embedding (OpenAI text-embedding-3-small)', () => {
      // Arrange
      const validData = {
        sourceId: 'source-123',
        content: 'Valid content here...',
        position: 0,
        embedding: new Array(1536).fill(0.1),
      };

      // Act
      const fragment = new Fragment(validData);

      // Assert
      expect(fragment.embedding).toHaveLength(1536);
    });
  });

  describe('Content Analysis', () => {
    const mockEmbedding = new Array(768).fill(0.1);

    it('should calculate content length', () => {
      // Arrange
      const fragment = new Fragment({
        sourceId: 'source-123',
        content: 'This is a test content with some words.',
        position: 0,
        embedding: mockEmbedding,
      });

      // Act & Assert
      expect(fragment.getContentLength()).toBe(39); // 39 characters
    });

    it('should estimate token count (rough estimate: chars / 4)', () => {
      // Arrange
      const content = 'a'.repeat(400); // 400 characters
      const fragment = new Fragment({
        sourceId: 'source-123',
        content: content,
        position: 0,
        embedding: mockEmbedding,
      });

      // Act
      const estimatedTokens = fragment.estimateTokenCount();

      // Assert
      expect(estimatedTokens).toBe(100); // 400 / 4 = 100
    });

    it('should check if content contains a term (case insensitive)', () => {
      // Arrange
      const fragment = new Fragment({
        sourceId: 'source-123',
        content: 'Este documento habla sobre VACACIONES en la empresa.',
        position: 0,
        embedding: mockEmbedding,
      });

      // Act & Assert
      expect(fragment.containsTerm('vacaciones')).toBe(true);
      expect(fragment.containsTerm('VACACIONES')).toBe(true);
      expect(fragment.containsTerm('empresa')).toBe(true);
      expect(fragment.containsTerm('salario')).toBe(false);
    });
  });

  describe('Metadata Management', () => {
    const mockEmbedding = new Array(768).fill(0.1);

    it('should allow updating metadata', () => {
      // Arrange
      const fragment = new Fragment({
        sourceId: 'source-123',
        content: 'Content...',
        position: 0,
        embedding: mockEmbedding,
        metadata: { page: 1 },
      });

      // Act
      fragment.updateMetadata({ page: 2, section: 'Intro' });

      // Assert
      expect(fragment.metadata).toEqual({ page: 2, section: 'Intro' });
    });

    it('should merge metadata on update', () => {
      // Arrange
      const fragment = new Fragment({
        sourceId: 'source-123',
        content: 'Content...',
        position: 0,
        embedding: mockEmbedding,
        metadata: { page: 1, tokens: 50 },
      });

      // Act
      fragment.updateMetadata({ section: 'Chapter 1' });

      // Assert
      expect(fragment.metadata).toEqual({
        page: 1,
        tokens: 50,
        section: 'Chapter 1',
      });
    });
  });

  describe('Business Rules', () => {
    const mockEmbedding = new Array(768).fill(0.1);

    it('should validate if belongs to source', () => {
      // Arrange
      const fragment = new Fragment({
        sourceId: 'source-abc',
        content: 'Content...',
        position: 0,
        embedding: mockEmbedding,
      });

      // Act & Assert
      expect(fragment.belongsToSource('source-abc')).toBe(true);
      expect(fragment.belongsToSource('source-xyz')).toBe(false);
    });

    it('should compare positions with another fragment', () => {
      // Arrange
      const fragment1 = new Fragment({
        sourceId: 'source-123',
        content: 'First fragment...',
        position: 0,
        embedding: mockEmbedding,
      });

      const fragment2 = new Fragment({
        sourceId: 'source-123',
        content: 'Second fragment...',
        position: 1,
        embedding: mockEmbedding,
      });

      // Act & Assert
      expect(fragment1.isBefore(fragment2)).toBe(true);
      expect(fragment2.isBefore(fragment1)).toBe(false);
      expect(fragment1.isAfter(fragment2)).toBe(false);
      expect(fragment2.isAfter(fragment1)).toBe(true);
    });

    it('should check if is first fragment', () => {
      // Arrange
      const firstFragment = new Fragment({
        sourceId: 'source-123',
        content: 'First fragment content...',
        position: 0,
        embedding: mockEmbedding,
      });

      const secondFragment = new Fragment({
        sourceId: 'source-123',
        content: 'Second fragment content...',
        position: 1,
        embedding: mockEmbedding,
      });

      // Act & Assert
      expect(firstFragment.isFirstFragment()).toBe(true);
      expect(secondFragment.isFirstFragment()).toBe(false);
    });
  });

  describe('Embedding Operations', () => {
    it('should get embedding dimension', () => {
      // Arrange
      const embedding768 = new Array(768).fill(0.1);
      const embedding1536 = new Array(1536).fill(0.2);

      const fragment1 = new Fragment({
        sourceId: 'source-123',
        content: 'Content...',
        position: 0,
        embedding: embedding768,
      });

      const fragment2 = new Fragment({
        sourceId: 'source-456',
        content: 'Content...',
        position: 0,
        embedding: embedding1536,
      });

      // Act & Assert
      expect(fragment1.getEmbeddingDimension()).toBe(768);
      expect(fragment2.getEmbeddingDimension()).toBe(1536);
    });

    it('should allow updating embedding (for reprocessing)', () => {
      // Arrange
      const oldEmbedding = new Array(768).fill(0.1);
      const newEmbedding = new Array(768).fill(0.5);

      const fragment = new Fragment({
        sourceId: 'source-123',
        content: 'Content...',
        position: 0,
        embedding: oldEmbedding,
      });

      // Act
      fragment.updateEmbedding(newEmbedding);

      // Assert
      expect(fragment.embedding).toEqual(newEmbedding);
      expect(fragment.embedding).not.toEqual(oldEmbedding);
    });

    it('should validate new embedding dimension on update', () => {
      // Arrange
      const oldEmbedding = new Array(768).fill(0.1);
      const invalidNewEmbedding = new Array(500).fill(0.5);

      const fragment = new Fragment({
        sourceId: 'source-123',
        content: 'Content...',
        position: 0,
        embedding: oldEmbedding,
      });

      // Act & Assert
      expect(() => fragment.updateEmbedding(invalidNewEmbedding)).toThrow(
        'Embedding must be 768 or 1536 dimensions',
      );
    });
  });
});
