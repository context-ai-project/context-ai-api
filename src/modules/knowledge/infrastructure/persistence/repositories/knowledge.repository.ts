import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { IKnowledgeRepository } from '../../../domain/repositories/knowledge.repository.interface';
import { KnowledgeSource } from '../../../domain/entities/knowledge-source.entity';
import { Fragment } from '../../../domain/entities/fragment.entity';
import { KnowledgeSourceModel } from '../models/knowledge-source.model';
import { FragmentModel } from '../models/fragment.model';
import { KnowledgeSourceMapper } from '../mappers/knowledge-source.mapper';
import { FragmentMapper } from '../mappers/fragment.mapper';
import { SourceStatus } from '@shared/types';

/**
 * TypeORM Knowledge Repository Implementation
 *
 * Implements the IKnowledgeRepository interface using TypeORM.
 * Manages persistence for KnowledgeSource and Fragment entities.
 *
 * Features:
 * - PostgreSQL relational data management
 * - Transaction support
 * - Soft delete support for knowledge sources
 * - Bulk operations for fragments
 *
 * Note: Vector similarity search has been migrated to Pinecone (IVectorStore).
 * This repository now handles only relational/text data in PostgreSQL.
 *
 * Security:
 * - Input validation in domain layer
 * - Parameterized queries (SQL injection prevention)
 * - Transaction isolation
 *
 * Performance:
 * - Indexed queries
 * - Batch inserts for fragments
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

  async findAllSources(): Promise<KnowledgeSource[]> {
    const models = await this.sourceRepository.find({
      where: { deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
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
