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
 * Fragment metadata type
 * Stores additional context about the fragment
 */
export type FragmentMetadata = Record<string, MetadataValue>;

/**
 * Fragment Entity
 *
 * Represents a chunk of content from a knowledge source with its vector embedding.
 * Fragments are the basic unit of retrieval in the RAG system.
 *
 * Key Responsibilities:
 * - Store content chunks from documents
 * - Maintain vector embeddings for semantic search
 * - Track position within the source document
 * - Support metadata for additional context
 */
export class Fragment {
  public id?: string;
  public sourceId: string;
  public content: string;
  public position: number;
  public embedding: number[];
  public metadata?: FragmentMetadata;
  public createdAt: Date;

  // Supported embedding dimensions
  private static readonly GEMINI_EMBEDDING_001_DIMENSION = 3072; // Gemini gemini-embedding-001
  private static readonly GEMINI_DIMENSION = 768; // Gemini text-embedding-004 (legacy)
  private static readonly OPENAI_DIMENSION = 1536; // OpenAI text-embedding-3-small
  private static readonly VALID_DIMENSIONS = [
    Fragment.GEMINI_EMBEDDING_001_DIMENSION,
    Fragment.GEMINI_DIMENSION,
    Fragment.OPENAI_DIMENSION,
  ];

  // Content validation constants
  private static readonly MIN_CONTENT_LENGTH = 10;
  private static readonly CHARS_PER_TOKEN = 4; // Rough estimate: 1 token ≈ 4 characters

  constructor(data: {
    sourceId: string;
    content: string;
    position: number;
    embedding: number[];
    metadata?: FragmentMetadata;
  }) {
    this.validate(data);

    this.sourceId = data.sourceId;
    this.content = data.content;
    this.position = data.position;
    this.embedding = data.embedding;
    this.metadata = data.metadata;
    this.createdAt = new Date();
  }

  /**
   * Validates the fragment data
   */
  private validate(data: {
    sourceId: string;
    content: string;
    position: number;
    embedding: number[];
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

    // Embedding validation
    if (data.embedding == null) {
      throw new Error('Embedding cannot be null or undefined');
    }

    if (!Array.isArray(data.embedding)) {
      throw new Error('Embedding must be an array');
    }

    if (data.embedding.length === 0) {
      throw new Error('Embedding array cannot be empty');
    }

    this.validateEmbeddingDimension(data.embedding);
  }

  /**
   * Validates embedding dimension
   */
  private validateEmbeddingDimension(embedding: number[]): void {
    if (!Fragment.VALID_DIMENSIONS.includes(embedding.length)) {
      throw new Error(
        `Embedding must be ${Fragment.VALID_DIMENSIONS.join(' or ')} dimensions`,
      );
    }
  }

  // ==================== Content Analysis ====================

  /**
   * Returns the length of the content in characters
   * @returns The number of characters in the content
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
    return Math.ceil(this.content.length / Fragment.CHARS_PER_TOKEN);
  }

  /**
   * Checks if the content contains a specific term (case insensitive)
   * @param term - The term to search for
   * @returns True if the term is found in the content
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
   */
  public isBefore(other: Fragment): boolean {
    return this.position < other.position;
  }

  /**
   * Checks if this fragment comes after another fragment
   * @param other - The other fragment to compare with
   * @returns True if this fragment's position is greater than the other's
   */
  public isAfter(other: Fragment): boolean {
    return this.position > other.position;
  }

  /**
   * Checks if this is the first fragment in the document
   * @returns True if the fragment's position is 0
   */
  public isFirstFragment(): boolean {
    return this.position === 0;
  }

  // ==================== Embedding Operations ====================

  /**
   * Returns the dimension of the embedding vector
   * @returns The length of the embedding array (768 or 1536)
   */
  public getEmbeddingDimension(): number {
    return this.embedding.length;
  }

  /**
   * Updates the embedding vector (for reprocessing scenarios)
   * @param newEmbedding - The new embedding vector
   * @throws Error if the embedding dimension is invalid
   */
  public updateEmbedding(newEmbedding: number[]): void {
    this.validateEmbeddingDimension(newEmbedding);
    this.embedding = newEmbedding;
  }

  /**
   * Checks if this fragment uses Gemini embeddings
   * @returns True if the embedding dimension is 768 (Gemini text-embedding-004)
   */
  public usesGeminiEmbedding(): boolean {
    return this.embedding.length === Fragment.GEMINI_DIMENSION;
  }

  /**
   * Checks if this fragment uses OpenAI embeddings
   * @returns True if the embedding dimension is 1536 (OpenAI text-embedding-3-small)
   */
  public usesOpenAIEmbedding(): boolean {
    return this.embedding.length === Fragment.OPENAI_DIMENSION;
  }
}
