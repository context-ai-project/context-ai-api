import { Injectable, Logger } from '@nestjs/common';
import type {
  Pinecone,
  Index,
  RecordMetadata,
} from '@pinecone-database/pinecone';
import type {
  IVectorStore,
  VectorUpsertInput,
  VectorSearchResult,
  VectorMetadata,
} from '../../domain/services/vector-store.interface';

// Constants (OWASP: Magic Numbers)
const BATCH_SIZE = 100;
const DEFAULT_SEARCH_LIMIT = 5;
const DEFAULT_MIN_SCORE = 0.7;
const UNKNOWN_ERROR_MESSAGE = 'Unknown error';

/**
 * Type for Pinecone match result from query
 */
interface PineconeMatch {
  id: string;
  score?: number;
  metadata?: Record<string, unknown> | null;
}

/**
 * Validates that a metadata object has all required VectorMetadata fields
 */
function hasValidVectorMetadataFields(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  if (!metadata || typeof metadata !== 'object') return false;

  return (
    typeof metadata.sourceId === 'string' &&
    typeof metadata.sectorId === 'string' &&
    typeof metadata.content === 'string' &&
    typeof metadata.position === 'number' &&
    typeof metadata.tokenCount === 'number'
  );
}

/**
 * Extracts VectorMetadata from a validated metadata record
 */
function toVectorMetadata(metadata: Record<string, unknown>): VectorMetadata {
  return {
    sourceId: metadata.sourceId as string,
    sectorId: metadata.sectorId as string,
    content: metadata.content as string,
    position: metadata.position as number,
    tokenCount: metadata.tokenCount as number,
  };
}

/**
 * PineconeVectorStore Service
 *
 * Implements IVectorStore using Pinecone as the vector database provider.
 * Uses sectorId as Pinecone namespace for multi-tenant isolation.
 *
 * Features:
 * - Batch upsert (max 100 vectors per call)
 * - Similarity search with namespace filtering
 * - Delete by sourceId using metadata filters
 * - Health check for connectivity monitoring
 *
 * Pinecone Configuration:
 * - Index: context-ai (3072 dimensions, cosine metric)
 * - Namespaces: sectorId-based isolation
 * - Metadata: sourceId, sectorId, content, position, tokenCount
 *
 * Security:
 * - API key managed via environment variables
 * - Input validation before API calls
 * - Error sanitization in logs
 */
@Injectable()
export class PineconeVectorStore implements IVectorStore {
  private readonly logger = new Logger(PineconeVectorStore.name);
  private readonly index: Index;

  constructor(
    private readonly pinecone: Pinecone,
    private readonly indexName: string,
  ) {
    this.index = this.pinecone.index({ name: this.indexName });
    this.logger.log(
      `PineconeVectorStore initialized with index: ${this.indexName}`,
    );
  }

  /**
   * Upserts vectors into Pinecone.
   * Handles batching internally (max 100 vectors per request).
   * Uses sectorId from metadata as the Pinecone namespace.
   *
   * @param inputs - Array of vectors with embeddings and metadata
   * @throws Error if the upsert operation fails
   */
  async upsertVectors(inputs: VectorUpsertInput[]): Promise<void> {
    if (inputs.length === 0) {
      this.logger.debug('No vectors to upsert, skipping');
      return;
    }

    const sectorId = inputs[0].metadata.sectorId;
    const ns = this.index.namespace(sectorId);

    try {
      // Process in batches of BATCH_SIZE
      for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
        const batch = inputs.slice(i, i + BATCH_SIZE);
        const records = batch.map((input) => ({
          id: input.id,
          values: input.embedding,
          metadata: input.metadata as unknown as RecordMetadata,
        }));

        await ns.upsert({ records });

        this.logger.debug(
          `Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${records.length} vectors to namespace ${sectorId}`,
        );
      }

      this.logger.log(
        `Successfully upserted ${inputs.length} vectors to namespace ${sectorId}`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE;
      this.logger.error(
        `Failed to upsert vectors: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new Error(`Failed to upsert vectors to Pinecone: ${errorMessage}`);
    }
  }

  /**
   * Performs vector similarity search in Pinecone.
   * Uses sectorId as the namespace for scoped search.
   * Filters results by minimum similarity score.
   *
   * @param embedding - Query embedding vector
   * @param sectorId - Sector ID (Pinecone namespace)
   * @param limit - Maximum number of results (default: 5)
   * @param minScore - Minimum similarity score threshold (default: 0.7)
   * @returns Array of search results ordered by similarity
   */
  async vectorSearch(
    embedding: number[],
    sectorId: string,
    limit: number = DEFAULT_SEARCH_LIMIT,
    minScore: number = DEFAULT_MIN_SCORE,
  ): Promise<VectorSearchResult[]> {
    const ns = this.index.namespace(sectorId);

    try {
      const queryResponse = await ns.query({
        vector: embedding,
        topK: limit,
        includeMetadata: true,
      });

      const matches: PineconeMatch[] =
        (queryResponse.matches as PineconeMatch[] | null) ?? [];

      // Filter by minimum score and validate metadata
      const results: VectorSearchResult[] = matches
        .filter((match) => {
          const score = match.score ?? 0;
          return (
            score >= minScore && hasValidVectorMetadataFields(match.metadata)
          );
        })
        .map((match) => ({
          id: match.id,
          score: match.score ?? 0,
          metadata: toVectorMetadata(match.metadata as Record<string, unknown>),
        }));

      this.logger.debug(
        `Vector search in namespace ${sectorId}: ${matches.length} matches, ${results.length} above threshold ${minScore}`,
      );

      return results;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE;
      this.logger.error(
        `Failed to search vectors: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new Error(`Failed to search vectors in Pinecone: ${errorMessage}`);
    }
  }

  /**
   * Deletes all vectors associated with a specific knowledge source.
   * Uses metadata filter to find and delete vectors by sourceId.
   *
   * @param sourceId - ID of the knowledge source
   * @param sectorId - Sector ID (Pinecone namespace)
   * @throws Error if the deletion operation fails
   */
  async deleteBySourceId(sourceId: string, sectorId: string): Promise<void> {
    const ns = this.index.namespace(sectorId);

    try {
      await ns.deleteMany({
        filter: { sourceId: { $eq: sourceId } },
      });

      this.logger.log(
        `Deleted vectors for sourceId ${sourceId} from namespace ${sectorId}`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE;
      this.logger.error(
        `Failed to delete vectors: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new Error(
        `Failed to delete vectors from Pinecone: ${errorMessage}`,
      );
    }
  }

  /**
   * Health check for Pinecone connectivity.
   * Attempts to describe index stats to verify connection.
   *
   * @returns true if Pinecone is accessible, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.index.describeIndexStats();
      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE;
      this.logger.error(`Pinecone health check failed: ${errorMessage}`);
      return false;
    }
  }
}
