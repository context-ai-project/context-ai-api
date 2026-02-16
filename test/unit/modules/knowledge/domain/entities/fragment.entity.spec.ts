import { Fragment } from '../../../../../../src/modules/knowledge/domain/entities/fragment.entity';

describe('Fragment Entity', () => {
  describe('Creation', () => {
    it('should create a fragment with valid data', () => {
      // Arrange
      const validData = {
        sourceId: 'source-123',
        content:
          'Este es el contenido del fragmento que contiene información importante...',
        position: 0,
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
      expect(fragment.tokenCount).toBeGreaterThan(0);
      expect(fragment.metadata).toEqual({ tokens: 45, page: 1 });
      expect(fragment.id).toBeUndefined(); // ID assigned by DB
      expect(fragment.createdAt).toBeInstanceOf(Date);
    });

    it('should create a fragment without metadata', () => {
      // Arrange
      const data = {
        sourceId: 'source-456',
        content: 'Fragmento sin metadata...',
        position: 1,
      };

      // Act
      const fragment = new Fragment(data);

      // Assert
      expect(fragment.metadata).toBeUndefined();
      expect(fragment.sourceId).toBe('source-456');
    });

    it('should create fragments with different positions', () => {
      // Act
      const fragment1 = new Fragment({
        sourceId: 'source-789',
        content: 'Primer fragmento...',
        position: 0,
      });

      const fragment2 = new Fragment({
        sourceId: 'source-789',
        content: 'Segundo fragmento...',
        position: 1,
      });

      // Assert
      expect(fragment1.position).toBe(0);
      expect(fragment2.position).toBe(1);
    });

    it('should auto-calculate tokenCount when not provided', () => {
      // Arrange
      const content = 'a'.repeat(400); // 400 characters

      // Act
      const fragment = new Fragment({
        sourceId: 'source-123',
        content,
        position: 0,
      });

      // Assert - 400 chars / 4 chars per token = 100 tokens
      expect(fragment.tokenCount).toBe(100);
    });

    it('should use provided tokenCount when given', () => {
      // Arrange & Act
      const fragment = new Fragment({
        sourceId: 'source-123',
        content: 'Some valid content here...',
        position: 0,
        tokenCount: 42,
      });

      // Assert
      expect(fragment.tokenCount).toBe(42);
    });
  });

  describe('Validation', () => {
    it('should throw error if sourceId is empty', () => {
      // Arrange
      const invalidData = {
        sourceId: '',
        content: 'Content...',
        position: 0,
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
      };

      // Act & Assert
      expect(() => new Fragment(invalidData)).toThrow(
        'Position cannot be negative',
      );
    });
  });

  describe('Content Analysis', () => {
    it('should estimate token count (rough estimate: chars / 4)', () => {
      // Arrange
      const content = 'a'.repeat(400); // 400 characters
      const fragment = new Fragment({
        sourceId: 'source-123',
        content: content,
        position: 0,
      });

      // Act
      const estimatedTokens = fragment.estimateTokenCount();

      // Assert
      expect(estimatedTokens).toBe(100); // 400 / 4 = 100
    });
  });

  describe('Metadata Management', () => {
    it('should allow updating metadata', () => {
      // Arrange
      const fragment = new Fragment({
        sourceId: 'source-123',
        content: 'Content...',
        position: 0,
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
    it('should validate if belongs to source', () => {
      // Arrange
      const fragment = new Fragment({
        sourceId: 'source-abc',
        content: 'Content...',
        position: 0,
      });

      // Act & Assert
      expect(fragment.belongsToSource('source-abc')).toBe(true);
      expect(fragment.belongsToSource('source-xyz')).toBe(false);
    });

  });
});
