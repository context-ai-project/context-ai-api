import { SourceType } from '@context-ai/shared';

/**
 * KnowledgeSource Entity (Aggregate Root)
 *
 * Represents a source of knowledge in the system (PDF, Markdown, URL).
 * Follows Domain-Driven Design principles.
 */
export class KnowledgeSource {
  public id?: string;
  public title: string;
  public sectorId: string;
  public sourceType: SourceType;
  public content: string;
  public metadata?: Record<string, any>;
  public status: string;
  public errorMessage?: string;
  public createdAt: Date;
  public updatedAt: Date;
  public deletedAt?: Date;

  constructor(data: {
    title: string;
    sectorId: string;
    sourceType: SourceType;
    content: string;
    metadata?: Record<string, any>;
  }) {
    this.validate(data);

    this.title = data.title;
    this.sectorId = data.sectorId;
    this.sourceType = data.sourceType;
    this.content = data.content;
    this.metadata = data.metadata;
    this.status = 'PENDING';
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Validates the knowledge source data
   */
  private validate(data: {
    title: string;
    sectorId: string;
    sourceType: SourceType;
    content: string;
  }): void {
    if (!data.title || data.title.trim() === '') {
      throw new Error('Title cannot be empty');
    }

    if (data.title.length > 255) {
      throw new Error('Title cannot exceed 255 characters');
    }

    if (!data.sectorId || data.sectorId.trim() === '') {
      throw new Error('SectorId cannot be empty');
    }

    if (!Object.values(SourceType).includes(data.sourceType)) {
      throw new Error('Invalid source type');
    }

    if (!data.content || data.content.trim() === '') {
      throw new Error('Content cannot be empty');
    }
  }

  // ==================== Status Management ====================

  /**
   * Marks the source as being processed
   */
  public markAsProcessing(): void {
    this.ensureNotDeleted();
    this.status = 'PROCESSING';
    this.updatedAt = new Date();
  }

  /**
   * Marks the source as completed
   * @throws Error if source is not being processed
   */
  public markAsCompleted(): void {
    this.ensureNotDeleted();

    if (this.status !== 'PROCESSING') {
      throw new Error(
        'Cannot mark as completed: source is not being processed',
      );
    }

    this.status = 'COMPLETED';
    this.updatedAt = new Date();
  }

  /**
   * Marks the source as failed
   * @param errorMessage - The error message describing the failure
   */
  public markAsFailed(errorMessage: string): void {
    this.ensureNotDeleted();
    this.status = 'FAILED';
    this.errorMessage = errorMessage;
    this.updatedAt = new Date();
  }

  /**
   * Soft deletes the source
   */
  public delete(): void {
    this.status = 'DELETED';
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }

  // ==================== Status Checks ====================

  public isPending(): boolean {
    return this.status === 'PENDING';
  }

  public isProcessing(): boolean {
    return this.status === 'PROCESSING';
  }

  public isCompleted(): boolean {
    return this.status === 'COMPLETED';
  }

  public hasFailed(): boolean {
    return this.status === 'FAILED';
  }

  public isDeleted(): boolean {
    return this.status === 'DELETED';
  }

  // ==================== Metadata Management ====================

  /**
   * Updates the metadata, merging with existing data
   * @param newMetadata - The new metadata to merge
   */
  public updateMetadata(newMetadata: Record<string, any>): void {
    this.ensureNotDeleted();
    this.metadata = {
      ...this.metadata,
      ...newMetadata,
    };
    this.updatedAt = new Date();
  }

  // ==================== Business Rules ====================

  /**
   * Checks if the source is stale (older than 30 days)
   */
  public isStale(): boolean {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return this.createdAt < thirtyDaysAgo;
  }

  /**
   * Checks if the source belongs to a specific sector
   * @param sectorId - The sector ID to check
   */
  public belongsToSector(sectorId: string): boolean {
    return this.sectorId === sectorId;
  }

  // ==================== Private Helpers ====================

  /**
   * Ensures the source is not deleted before performing operations
   * @throws Error if source is deleted
   */
  private ensureNotDeleted(): void {
    if (this.isDeleted()) {
      throw new Error('Cannot modify deleted source');
    }
  }
}
