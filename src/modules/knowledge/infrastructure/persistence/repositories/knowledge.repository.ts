import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import {
  IKnowledgeRepository,
  FragmentWithSimilarity,
} from '../../../domain/repositories/knowledge.repository.interface';
import { KnowledgeSource } from '../../../domain/entities/knowledge-source.entity';
import { Fragment } from '../../../domain/entities/fragment.entity';
import { KnowledgeSourceModel } from '../models/knowledge-source.model';
import { FragmentModel } from '../models/fragment.model';
import { KnowledgeSourceMapper } from '../mappers/knowledge-source.mapper';
import { FragmentMapper } from '../mappers/fragment.mapper';
import { SourceStatus } from '@shared/types';

// Constants for vector search (OWASP: Magic Numbers)
const DEFAULT_VECTOR_SEARCH_LIMIT = 5;
const DEFAULT_SIMILARITY_THRESHOLD = 0.7;

/**
 * Type for vector search raw query results
 * Extends FragmentModel with similarity score
 */
interface VectorSearchRawResult {
  id: string;
  source_id: string;
  content: string;
  embedding: string | null;
  position: number;
  token_count: number;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  similarity: number;
}

/**
 * Type guard to validate vector search result
 */
function isVectorSearchRawResult(obj: unknown): obj is VectorSearchRawResult {
  if (typeof obj !== 'object' || obj === null) return false;

  const result = obj as Record<string, unknown>;

  return (
    typeof result.id === 'string' &&
    typeof result.source_id === 'string' &&
    typeof result.content === 'string' &&
    (result.embedding === null || typeof result.embedding === 'string') &&
    typeof result.position === 'number' &&
    typeof result.token_count === 'number' &&
    (result.metadata === null || typeof result.metadata === 'object') &&
    result.created_at instanceof Date &&
    result.updated_at instanceof Date &&
    typeof result.similarity === 'number'
  );
}

/**
 * TypeORM Knowledge Repository Implementation
 *
 * Implements the IKnowledgeRepository interface using TypeORM.
 * Manages persistence for KnowledgeSource and Fragment entities.
 *
 * Features:
 * - PostgreSQL + pgvector integration
 * - Vector similarity search using cosine distance
 * - Transaction support
 * - Soft delete support for knowledge sources
 * - Bulk operations for fragments
 *
 * Security:
 * - Input validation in domain layer
 * - Parameterized queries (SQL injection prevention)
 * - Transaction isolation
 *
 * Performance:
 * - Indexed queries
 * - Batch inserts for fragments
 * - Vector index (IVFFlat) for similarity search
 */
@Injectable()
export class KnowledgeRepository implements IKnowledgeRepository {
  constructor(
    @InjectRepository(KnowledgeSourceModel)
    private readonly sourceRepository: Repository<KnowledgeSourceModel>,
    @InjectRepository(FragmentModel)
    private readonly fragmentRepository: Repository<FragmentModel>,
    private readonly dataSource: DataSource,
  ) {}

  // ==================== KnowledgeSource Operations ====================

  async saveSource(source: KnowledgeSource): Promise<KnowledgeSource> {
    const model = KnowledgeSourceMapper.toModel(source);
    const saved = await this.sourceRepository.save(model);
    return KnowledgeSourceMapper.toDomain(saved);
  }

  async findSourceById(id: string): Promise<KnowledgeSource | null> {
    const model = await this.sourceRepository.findOne({ where: { id } });
    return model ? KnowledgeSourceMapper.toDomain(model) : null;
  }

  async findSourcesBySector(
    sectorId: string,
    includeDeleted = false,
  ): Promise<KnowledgeSource[]> {
    const whereCondition = includeDeleted
      ? { sectorId }
      : { sectorId, deletedAt: IsNull() };

    const options = includeDeleted
      ? { where: { sectorId }, withDeleted: true }
      : { where: whereCondition };

    const models = await this.sourceRepository.find(options);
    return KnowledgeSourceMapper.toDomainArray(models);
  }

  async findSourcesByStatus(status: SourceStatus): Promise<KnowledgeSource[]> {
    const statusValue = status;
    const whereClause: { status: SourceStatus } = { status: statusValue };
    const models = await this.sourceRepository.find({
      where: whereClause,
    });
    return KnowledgeSourceMapper.toDomainArray(models);
  }

  async softDeleteSource(id: string): Promise<void> {
    await this.sourceRepository.softDelete(id);
  }

  async deleteSource(id: string): Promise<void> {
    await this.sourceRepository.delete(id);
  }

  async countSourcesBySector(sectorId: string): Promise<number> {
    return this.sourceRepository.count({
      where: { sectorId, deletedAt: IsNull() },
    });
  }

  // ==================== Fragment Operations ====================

  async saveFragments(fragments: Fragment[]): Promise<Fragment[]> {
    const models = fragments.map((f) => FragmentMapper.toModel(f));
    const saved = await this.fragmentRepository.save(models);
    return FragmentMapper.toDomainArray(saved);
  }

  async findFragmentById(id: string): Promise<Fragment | null> {
    const model = await this.fragmentRepository.findOne({ where: { id } });
    return model ? FragmentMapper.toDomain(model) : null;
  }

  async findFragmentsBySource(
    sourceId: string,
    orderBy: 'position' | 'createdAt' = 'position',
  ): Promise<Fragment[]> {
    const models = await this.fragmentRepository.find({
      where: { sourceId },
      order: { [orderBy]: 'ASC' },
    });
    return FragmentMapper.toDomainArray(models);
  }

  /**
   * Performs vector similarity search using pgvector
   *
   * Uses cosine distance (<=> operator) for similarity.
   * Filters by sector and similarity threshold.
   * Returns results ordered by similarity (highest first).
   *
   * Query structure:
   * - Joins fragments with knowledge_sources to filter by sector
   * - Calculates similarity: 1 - (embedding <=> query_embedding)
   * - Filters by similarity threshold
   * - Orders by similarity descending
   * - Limits results
   *
   * @param embedding - Query embedding vector
   * @param sectorId - Sector ID to filter results
   * @param limit - Maximum number of results (default: 5)
   * @param similarityThreshold - Minimum similarity score (default: 0.7)
   * @returns Array of fragments with similarity scores
   */
  async vectorSearch(
    embedding: number[],
    sectorId: string,
    limit: number = DEFAULT_VECTOR_SEARCH_LIMIT,
    similarityThreshold: number = DEFAULT_SIMILARITY_THRESHOLD,
  ): Promise<FragmentWithSimilarity[]> {
    // Serialize embedding to pgvector format
    const embeddingStr = JSON.stringify(embedding);

    // Raw SQL query for vector similarity search
    // Using parameterized query to prevent SQL injection
    const query = `
      SELECT 
        f.*,
        (1 - (f.embedding <=> $1::vector)) as similarity
      FROM fragments f
      INNER JOIN knowledge_sources ks ON f.source_id = ks.id
      WHERE ks.sector_id = $2
        AND f.embedding IS NOT NULL
        AND (1 - (f.embedding <=> $1::vector)) >= $3
      ORDER BY similarity DESC
      LIMIT $4
    `;

    // Execute query and validate results
    const queryResults: unknown = await this.fragmentRepository.query(query, [
      embeddingStr,
      sectorId,
      similarityThreshold,
      limit,
    ]);

    // Validate query results
    if (!Array.isArray(queryResults)) {
      throw new Error('Invalid query result: expected array');
    }

    const validatedResults = queryResults.filter(isVectorSearchRawResult);

    // Map results to domain entities with similarity
    return validatedResults.map((rawResult: VectorSearchRawResult) => {
      // Convert snake_case to camelCase for FragmentModel
      const model = new FragmentModel();
      model.id = rawResult.id;
      model.sourceId = rawResult.source_id;
      model.content = rawResult.content;
      model.embedding = rawResult.embedding;
      model.position = rawResult.position;
      model.tokenCount = rawResult.token_count;
      model.metadata = rawResult.metadata;
      model.createdAt = rawResult.created_at;
      model.updatedAt = rawResult.updated_at;

      const fragment = FragmentMapper.toDomain(model);
      // Add similarity property to the fragment
      const fragmentWithSimilarity = fragment as FragmentWithSimilarity;
      fragmentWithSimilarity.similarity = rawResult.similarity;
      return fragmentWithSimilarity;
    });
  }

  async deleteFragmentsBySource(sourceId: string): Promise<void> {
    await this.fragmentRepository.delete({ sourceId });
  }

  async countFragmentsBySource(sourceId: string): Promise<number> {
    return this.fragmentRepository.count({ where: { sourceId } });
  }

  // ==================== Transaction Support ====================

  /**
   * Executes work within a database transaction
   *
   * Ensures ACID properties:
   * - Atomicity: All operations succeed or all fail
   * - Consistency: Database remains in valid state
   * - Isolation: Concurrent transactions don't interfere
   * - Durability: Committed changes persist
   *
   * Error handling:
   * - Rolls back on any error
   * - Releases connection in finally block
   * - Propagates original error
   *
   * @param work - Function containing transactional work
   * @returns Result of the work function
   */
  async transaction<T>(work: () => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await work();
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
