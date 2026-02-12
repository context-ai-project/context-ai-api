/**
 * Vector Store Interface
 *
 * Defines the contract for vector database operations.
 * Follows the Dependency Inversion Principle (DIP) - domain layer
 * defines the interface, infrastructure layer provides the implementation.
 *
 * This abstraction allows switching between vector database providers
 * (e.g., pgvector → Pinecone) without changing business logic.
 *
 * @example
 * ```typescript
 * // Upsert vectors after document ingestion
 * await vectorStore.upsertVectors([{
 *   id: 'fragment-uuid',
 *   embedding: [0.1, 0.2, ...],
 *   metadata: {
 *     sourceId: 'source-uuid',
 *     sectorId: 'sector-uuid',
 *     content: 'Fragment text...',
 *     position: 0,
 *     tokenCount: 150,
 *   },
 * }]);
 *
 * // Search for similar vectors
 * const results = await vectorStore.vectorSearch(
 *   queryEmbedding, 'sector-uuid', 5, 0.7
 * );
 * ```
 */

/**
 * Metadata associated with each vector in the store.
 * Contains all necessary context for RAG retrieval.
 */
export interface VectorMetadata {
  /** ID of the knowledge source this fragment belongs to */
  sourceId: string;
  /** ID of the sector (used as namespace in Pinecone) */
  sectorId: string;
  /** Text content of the fragment */
  content: string;
  /** Position of the fragment within the source document */
  position: number;
  /** Estimated token count of the fragment content */
  tokenCount: number;
}

/**
 * Input type for upserting vectors into the store.
 * Used during document ingestion to store fragment embeddings.
 */
export interface VectorUpsertInput {
  /** Unique identifier for the vector (typically the fragment ID) */
  id: string;
  /** The embedding vector (number array, e.g., 3072 dimensions) */
  embedding: number[];
  /** Metadata associated with this vector */
  metadata: VectorMetadata;
}

/**
 * Result type for vector similarity search.
 * Returned when querying the vector store for similar content.
 */
export interface VectorSearchResult {
  /** Unique identifier of the matched vector */
  id: string;
  /** Similarity score (0-1, higher is more similar) */
  score: number;
  /** Metadata associated with the matched vector */
  metadata: VectorMetadata;
}

/**
 * IVectorStore Interface
 *
 * Defines the contract for vector database operations.
 * Implementations handle the specifics of the vector database provider.
 *
 * Responsibilities:
 * - Upserting vectors with metadata (batch support)
 * - Similarity search with filtering
 * - Deleting vectors by source ID
 *
 * Design Decisions:
 * - Uses sectorId as namespace for multi-tenant isolation
 * - Supports batch operations for efficient ingestion
 * - Returns similarity scores for result ranking
 * - Allows minimum score filtering for quality control
 */
export interface IVectorStore {
  /**
   * Upserts vectors into the store.
   * Creates new vectors or updates existing ones by ID.
   * Handles batching internally for large datasets.
   *
   * @param inputs - Array of vectors with embeddings and metadata
   * @throws Error if the upsert operation fails
   */
  upsertVectors(inputs: VectorUpsertInput[]): Promise<void>;

  /**
   * Performs vector similarity search.
   * Returns vectors most similar to the query embedding,
   * filtered by sector (namespace) and minimum score.
   *
   * @param embedding - Query embedding vector
   * @param sectorId - Sector ID to scope the search (namespace)
   * @param limit - Maximum number of results (default: 5)
   * @param minScore - Minimum similarity score threshold (default: 0.7)
   * @returns Array of search results ordered by similarity (highest first)
   */
  vectorSearch(
    embedding: number[],
    sectorId: string,
    limit?: number,
    minScore?: number,
  ): Promise<VectorSearchResult[]>;

  /**
   * Deletes all vectors associated with a specific knowledge source.
   * Used when a knowledge source is deleted to clean up vector data.
   *
   * @param sourceId - ID of the knowledge source whose vectors should be deleted
   * @param sectorId - Sector ID (namespace) where the vectors are stored
   * @throws Error if the deletion operation fails
   */
  deleteBySourceId(sourceId: string, sectorId: string): Promise<void>;
}
