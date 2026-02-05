import { SourceType } from '@context-ai/shared';

/**
 * Type-safe metadata value
 * Represents JSON-serializable values
 */
export type MetadataValue =
  | string
  | number
  | boolean
  | null
  | MetadataValue[]
  | { [key: string]: MetadataValue };

/**
 * Knowledge source metadata type
 * Stores additional context about the source (e.g., file info, parsing details)
 */
export type SourceMetadata = Record<string, MetadataValue>;

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
  public metadata?: SourceMetadata;
  public status: string;
  public errorMessage?: string;
  public createdAt: Date;
  public updatedAt: Date;
  public deletedAt?: Date;

  // Business rule constants
  private static readonly MAX_TITLE_LENGTH = 255;
  private static readonly STALE_DAYS_THRESHOLD = 30;

  constructor(data: {
    title: string;
    sectorId: string;
    sourceType: SourceType;
    content: string;
    metadata?: SourceMetadata;
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

    if (data.title.length > KnowledgeSource.MAX_TITLE_LENGTH) {
      throw new Error(
        `Title cannot exceed ${KnowledgeSource.MAX_TITLE_LENGTH} characters`,
      );
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
   * @throws Error if source is deleted
   */
  public markAsProcessing(): void {
    this.ensureNotDeleted();
    this.status = 'PROCESSING';
    this.updatedAt = new Date();
  }

  /**
   * Marks the source as completed
   * @throws Error if source is not being processed or is deleted
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
   * @throws Error if source is deleted
   */
  public markAsFailed(errorMessage: string): void {
    this.ensureNotDeleted();
    this.status = 'FAILED';
    this.errorMessage = errorMessage;
    this.updatedAt = new Date();
  }

  /**
   * Soft deletes the source by setting status to DELETED and recording the deletion timestamp
   */
  public delete(): void {
    this.status = 'DELETED';
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }

  // ==================== Status Checks ====================

  /**
   * Checks if the source is in PENDING status
   * @returns True if status is PENDING
   */
  public isPending(): boolean {
    return this.status === 'PENDING';
  }

  /**
   * Checks if the source is in PROCESSING status
   * @returns True if status is PROCESSING
   */
  public isProcessing(): boolean {
    return this.status === 'PROCESSING';
  }

  /**
   * Checks if the source is in COMPLETED status
   * @returns True if status is COMPLETED
   */
  public isCompleted(): boolean {
    return this.status === 'COMPLETED';
  }

  /**
   * Checks if the source has failed
   * @returns True if status is FAILED
   */
  public hasFailed(): boolean {
    return this.status === 'FAILED';
  }

  /**
   * Checks if the source is deleted
   * @returns True if status is DELETED
   */
  public isDeleted(): boolean {
    return this.status === 'DELETED';
  }

  // ==================== Metadata Management ====================

  /**
   * Updates the metadata, merging with existing data
   * @param newMetadata - The new metadata to merge
   * @throws Error if source is deleted
   */
  public updateMetadata(newMetadata: SourceMetadata): void {
    this.ensureNotDeleted();
    this.metadata = {
      ...this.metadata,
      ...newMetadata,
    };
    this.updatedAt = new Date();
  }

  // ==================== Business Rules ====================

  /**
   * Checks if the source is stale (older than configured threshold)
   * @returns True if the source was created more than STALE_DAYS_THRESHOLD days ago
   */
  public isStale(): boolean {
    const thresholdDate = new Date();
    thresholdDate.setDate(
      thresholdDate.getDate() - KnowledgeSource.STALE_DAYS_THRESHOLD,
    );
    return this.createdAt < thresholdDate;
  }

  /**
   * Checks if the source belongs to a specific sector
   * @param sectorId - The sector ID to check
   * @returns True if the source belongs to the specified sector
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
