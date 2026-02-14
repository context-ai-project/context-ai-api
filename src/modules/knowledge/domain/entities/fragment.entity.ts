import { type Metadata } from '@shared/types';
import { CHARS_PER_TOKEN_ESTIMATE } from '@shared/constants';

/**
 * Fragment metadata type
 * Stores additional context about the fragment
 */
export type FragmentMetadata = Metadata;

/**
 * Persistence data for hydrating a Fragment from the database
 */
export interface FragmentPersistenceData {
  id: string;
  sourceId: string;
  content: string;
  position: number;
  tokenCount: number;
  metadata?: FragmentMetadata;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Fragment Entity
 *
 * Represents a chunk of content from a knowledge source.
 * Fragments are the basic unit of retrieval in the RAG system.
 *
 * Key Responsibilities:
 * - Store content chunks from documents
 * - Track position within the source document
 * - Maintain token count for context window management
 * - Support metadata for additional context
 *
 * Note: Vector embeddings are managed externally by IVectorStore (Pinecone).
 * The fragment ID is used as the vector ID in the vector store.
 */
export class Fragment {
  public id?: string;
  public sourceId: string;
  public content: string;
  public position: number;
  public tokenCount: number;
  public metadata?: FragmentMetadata;
  public createdAt: Date;
  public updatedAt: Date;

  // Content validation constants
  private static readonly MIN_CONTENT_LENGTH = 10;

  constructor(data: {
    sourceId: string;
    content: string;
    position: number;
    tokenCount?: number;
    metadata?: FragmentMetadata;
  }) {
    this.validate(data);

    this.sourceId = data.sourceId;
    this.content = data.content;
    this.position = data.position;
    this.tokenCount =
      data.tokenCount ??
      Math.ceil(data.content.length / CHARS_PER_TOKEN_ESTIMATE);
    this.metadata = data.metadata;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Factory method to hydrate a Fragment from persistence data.
   * Bypasses validation since data is already validated in the database.
   * @param data - Persistence data including id, timestamps, etc.
   * @returns Hydrated Fragment entity
   */
  static fromPersistence(data: FragmentPersistenceData): Fragment {
    const fragment = new Fragment({
      sourceId: data.sourceId,
      content: data.content,
      position: data.position,
      tokenCount: data.tokenCount,
      metadata: data.metadata,
    });
    fragment.id = data.id;
    fragment.createdAt = data.createdAt;
    fragment.updatedAt = data.updatedAt;
    return fragment;
  }

  /**
   * Validates the fragment data
   */
  private validate(data: {
    sourceId: string;
    content: string;
    position: number;
  }): void {
    // Source ID validation
    if (!data.sourceId || data.sourceId.trim() === '') {
      throw new Error('SourceId cannot be empty');
    }

    // Content validation
    if (!data.content || data.content.trim() === '') {
      throw new Error('Content cannot be empty');
    }

    if (data.content.length < Fragment.MIN_CONTENT_LENGTH) {
      throw new Error(
        `Content must be at least ${Fragment.MIN_CONTENT_LENGTH} characters long`,
      );
    }

    // Position validation
    if (data.position < 0) {
      throw new Error('Position cannot be negative');
    }
  }

  // ==================== Content Analysis ====================

  /**
   * Returns the length of the content in characters
   * @returns The number of characters in the content
   * @planned Phase 6 — Analytics dashboard: fragment metrics
   */
  public getContentLength(): number {
    return this.content.length;
  }

  /**
   * Estimates the number of tokens in the content
   * Rough estimate: 1 token ≈ 4 characters
   * @returns Estimated token count
   */
  public estimateTokenCount(): number {
    return Math.ceil(this.content.length / CHARS_PER_TOKEN_ESTIMATE);
  }

  /**
   * Checks if the content contains a specific term (case insensitive)
   * @param term - The term to search for
   * @returns True if the term is found in the content
   * @planned Phase 6 — Knowledge search / content highlighting
   */
  public containsTerm(term: string): boolean {
    return this.content.toLowerCase().includes(term.toLowerCase());
  }

  // ==================== Metadata Management ====================

  /**
   * Updates the metadata, merging with existing data
   * @param newMetadata - The new metadata to merge
   */
  public updateMetadata(newMetadata: FragmentMetadata): void {
    this.metadata = {
      ...this.metadata,
      ...newMetadata,
    };
  }

  // ==================== Business Rules ====================

  /**
   * Checks if the fragment belongs to a specific source
   * @param sourceId - The source ID to check
   * @returns True if the fragment belongs to the specified source
   */
  public belongsToSource(sourceId: string): boolean {
    return this.sourceId === sourceId;
  }

  /**
   * Checks if this fragment comes before another fragment
   * @param other - The other fragment to compare with
   * @returns True if this fragment's position is less than the other's
   * @planned Phase 6 — Fragment ordering / document reconstruction
   */
  public isBefore(other: Fragment): boolean {
    return this.position < other.position;
  }

  /**
   * Checks if this fragment comes after another fragment
   * @param other - The other fragment to compare with
   * @returns True if this fragment's position is greater than the other's
   * @planned Phase 6 — Fragment ordering / document reconstruction
   */
  public isAfter(other: Fragment): boolean {
    return this.position > other.position;
  }

  /**
   * Checks if this is the first fragment in the document
   * @returns True if the fragment's position is 0
   * @planned Phase 6 — Fragment ordering / document reconstruction
   */
  public isFirstFragment(): boolean {
    return this.position === 0;
  }
}
