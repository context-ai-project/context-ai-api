import { KnowledgeSource } from '../../../../../../src/modules/knowledge/domain/entities/knowledge-source.entity';
import { SourceType } from '@context-ai/shared';

describe('KnowledgeSource Entity', () => {
  describe('Creation', () => {
    it('should create a knowledge source with valid data', () => {
      // Arrange
      const validData = {
        title: 'Manual de Vacaciones',
        sectorId: 'sector-123',
        sourceType: SourceType.PDF,
        content: 'Contenido del documento...',
        metadata: { pages: 15, size: 2048000 },
      };

      // Act
      const source = new KnowledgeSource(validData);

      // Assert
      expect(source.title).toBe('Manual de Vacaciones');
      expect(source.sectorId).toBe('sector-123');
      expect(source.sourceType).toBe(SourceType.PDF);
      expect(source.content).toBe('Contenido del documento...');
      expect(source.metadata).toEqual({ pages: 15, size: 2048000 });
      expect(source.status).toBe('PENDING'); // Default status
      expect(source.id).toBeUndefined(); // ID assigned by DB
      expect(source.createdAt).toBeInstanceOf(Date);
      expect(source.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a knowledge source with markdown type', () => {
      // Arrange
      const markdownData = {
        title: 'Guía de Onboarding',
        sectorId: 'rrhh-001',
        sourceType: SourceType.MARKDOWN,
        content: '# Bienvenido\n\nEsta es la guía...',
      };

      // Act
      const source = new KnowledgeSource(markdownData);

      // Assert
      expect(source.sourceType).toBe(SourceType.MARKDOWN);
      expect(source.title).toBe('Guía de Onboarding');
    });

    it('should create a knowledge source with URL type', () => {
      // Arrange
      const urlData = {
        title: 'Documentación Externa',
        sectorId: 'tech-001',
        sourceType: SourceType.URL,
        content: 'https://example.com/docs',
      };

      // Act
      const source = new KnowledgeSource(urlData);

      // Assert
      expect(source.sourceType).toBe(SourceType.URL);
      expect(source.content).toBe('https://example.com/docs');
    });
  });

  describe('Validation', () => {
    it('should throw error if title is empty', () => {
      // Arrange
      const invalidData = {
        title: '',
        sectorId: 'sector-123',
        sourceType: SourceType.PDF,
        content: 'Content...',
      };

      // Act & Assert
      expect(() => new KnowledgeSource(invalidData)).toThrow(
        'Title cannot be empty',
      );
    });

    it('should throw error if title exceeds 255 characters', () => {
      // Arrange
      const invalidData = {
        title: 'a'.repeat(256),
        sectorId: 'sector-123',
        sourceType: SourceType.PDF,
        content: 'Content...',
      };

      // Act & Assert
      expect(() => new KnowledgeSource(invalidData)).toThrow(
        'Title cannot exceed 255 characters',
      );
    });

    it('should throw error if sectorId is empty', () => {
      // Arrange
      const invalidData = {
        title: 'Manual',
        sectorId: '',
        sourceType: SourceType.PDF,
        content: 'Content...',
      };

      // Act & Assert
      expect(() => new KnowledgeSource(invalidData)).toThrow(
        'SectorId cannot be empty',
      );
    });

    it('should throw error if sourceType is invalid', () => {
      // Arrange
      const invalidData = {
        title: 'Manual',
        sectorId: 'sector-123',
        sourceType: 'INVALID' as SourceType,
        content: 'Content...',
      };

      // Act & Assert
      expect(() => new KnowledgeSource(invalidData)).toThrow(
        'Invalid source type',
      );
    });

    it('should throw error if content is empty', () => {
      // Arrange
      const invalidData = {
        title: 'Manual',
        sectorId: 'sector-123',
        sourceType: SourceType.PDF,
        content: '',
      };

      // Act & Assert
      expect(() => new KnowledgeSource(invalidData)).toThrow(
        'Content cannot be empty',
      );
    });
  });

  describe('Status Management', () => {
    it('should have PENDING status by default', () => {
      // Arrange
      const data = {
        title: 'Manual',
        sectorId: 'sector-123',
        sourceType: SourceType.PDF,
        content: 'Content...',
      };

      // Act
      const source = new KnowledgeSource(data);

      // Assert
      expect(source.status).toBe('PENDING');
      expect(source.isPending()).toBe(true);
      expect(source.isProcessing()).toBe(false);
      expect(source.isCompleted()).toBe(false);
      expect(source.hasFailed()).toBe(false);
    });

    it('should mark as processing', () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Manual',
        sectorId: 'sector-123',
        sourceType: SourceType.PDF,
        content: 'Content...',
      });

      // Act
      source.markAsProcessing();

      // Assert
      expect(source.status).toBe('PROCESSING');
      expect(source.isProcessing()).toBe(true);
      expect(source.isPending()).toBe(false);
    });

    it('should mark as completed', () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Manual',
        sectorId: 'sector-123',
        sourceType: SourceType.PDF,
        content: 'Content...',
      });
      source.markAsProcessing(); // Must be processing first

      // Act
      source.markAsCompleted();

      // Assert
      expect(source.status).toBe('COMPLETED');
      expect(source.isCompleted()).toBe(true);
      expect(source.isPending()).toBe(false);
    });

    it('should mark as failed with error message', () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Manual',
        sectorId: 'sector-123',
        sourceType: SourceType.PDF,
        content: 'Content...',
      });

      // Act
      source.markAsFailed('PDF parsing error');

      // Assert
      expect(source.status).toBe('FAILED');
      expect(source.hasFailed()).toBe(true);
      expect(source.errorMessage).toBe('PDF parsing error');
    });

    it('should not allow marking as completed if not processing', () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Manual',
        sectorId: 'sector-123',
        sourceType: SourceType.PDF,
        content: 'Content...',
      });

      // Act & Assert
      expect(() => source.markAsCompleted()).toThrow(
        'Cannot mark as completed: source is not being processed',
      );
    });
  });

  describe('Soft Delete', () => {
    it('should mark as deleted (soft delete)', () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Manual',
        sectorId: 'sector-123',
        sourceType: SourceType.PDF,
        content: 'Content...',
      });

      // Act
      source.delete();

      // Assert
      expect(source.status).toBe('DELETED');
      expect(source.deletedAt).toBeInstanceOf(Date);
      expect(source.isDeleted()).toBe(true);
    });

    it('should not allow operations on deleted source', () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Manual',
        sectorId: 'sector-123',
        sourceType: SourceType.PDF,
        content: 'Content...',
      });
      source.delete();

      // Act & Assert
      expect(() => source.markAsProcessing()).toThrow(
        'Cannot modify deleted source',
      );
    });
  });

  describe('Metadata Management', () => {
    it('should allow updating metadata', () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Manual',
        sectorId: 'sector-123',
        sourceType: SourceType.PDF,
        content: 'Content...',
        metadata: { pages: 10 },
      });

      // Act
      source.updateMetadata({ pages: 15, author: 'RRHH Team' });

      // Assert
      expect(source.metadata).toEqual({ pages: 15, author: 'RRHH Team' });
    });

    it('should merge metadata on update', () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Manual',
        sectorId: 'sector-123',
        sourceType: SourceType.PDF,
        content: 'Content...',
        metadata: { pages: 10, size: 2048 },
      });

      // Act
      source.updateMetadata({ author: 'Admin' });

      // Assert
      expect(source.metadata).toEqual({
        pages: 10,
        size: 2048,
        author: 'Admin',
      });
    });
  });

  describe('Business Rules', () => {
    it('should calculate if source is stale (older than 30 days)', () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Manual',
        sectorId: 'sector-123',
        sourceType: SourceType.PDF,
        content: 'Content...',
      });

      // Simulate old date
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);
      source['createdAt'] = oldDate;

      // Act & Assert
      expect(source.isStale()).toBe(true);
    });

    it('should calculate if source is fresh (less than 30 days)', () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Manual',
        sectorId: 'sector-123',
        sourceType: SourceType.PDF,
        content: 'Content...',
      });

      // Act & Assert
      expect(source.isStale()).toBe(false);
    });

    it('should validate if belongs to sector', () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Manual',
        sectorId: 'rrhh-001',
        sourceType: SourceType.PDF,
        content: 'Content...',
      });

      // Act & Assert
      expect(source.belongsToSector('rrhh-001')).toBe(true);
      expect(source.belongsToSector('tech-001')).toBe(false);
    });
  });
});
