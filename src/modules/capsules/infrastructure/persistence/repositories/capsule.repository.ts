import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import type {
  ICapsuleRepository,
  CapsuleFilters,
  PaginationOptions,
  PaginatedResult,
} from '../../../domain/repositories/capsule.repository.interface';
import {
  Capsule,
  CapsuleSourceRef,
} from '../../../domain/entities/capsule.entity';
import { CapsuleModel } from '../models/capsule.model';
import { CapsuleMapper } from '../mappers/capsule.mapper';
import { CapsuleStatus } from '@shared/types/enums/capsule-status.enum';
import { CapsuleType } from '@shared/types/enums/capsule-type.enum';

/**
 * TypeORM Capsule Repository Implementation
 *
 * Implements ICapsuleRepository using TypeORM.
 * Manages persistence for Capsule aggregates and their source associations.
 */
@Injectable()
export class CapsuleRepository implements ICapsuleRepository {
  constructor(
    @InjectRepository(CapsuleModel)
    private readonly repository: Repository<CapsuleModel>,
    private readonly dataSource: DataSource,
  ) {}

  async save(capsule: Capsule): Promise<Capsule> {
    const model = CapsuleMapper.toModel(capsule);
    const saved = await this.repository.save(model);
    return CapsuleMapper.toDomain(saved);
  }

  async findById(id: string): Promise<Capsule | null> {
    const model = await this.repository.findOne({ where: { id } });
    return model ? CapsuleMapper.toDomain(model) : null;
  }

  async findAll(
    filters: CapsuleFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<Capsule>> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const qb = this.repository.createQueryBuilder('capsule');

    if (filters.sectorId) {
      qb.andWhere('capsule.sector_id = :sectorId', {
        sectorId: filters.sectorId,
      });
    }
    if (filters.status) {
      qb.andWhere('capsule.status = :status', { status: filters.status });
    }
    if (filters.type) {
      qb.andWhere('capsule.type = :type', { type: filters.type });
    }
    if (filters.createdBy) {
      qb.andWhere('capsule.created_by = :createdBy', {
        createdBy: filters.createdBy,
      });
    }
    if (filters.search) {
      qb.andWhere('LOWER(capsule.title) LIKE LOWER(:search)', {
        search: `%${filters.search}%`,
      });
    }
    if (filters.excludeArchived) {
      qb.andWhere('capsule.status != :archived', {
        archived: CapsuleStatus.ARCHIVED,
      });
    }

    qb.orderBy('capsule.created_at', 'DESC').skip(skip).take(limit);

    const [models, total] = await qb.getManyAndCount();

    return {
      data: CapsuleMapper.toDomainArray(models),
      total,
      page,
      limit,
    };
  }

  async findBySectorId(
    sectorId: string,
    filters?: Partial<CapsuleFilters>,
  ): Promise<Capsule[]> {
    const qb = this.repository
      .createQueryBuilder('capsule')
      .where('capsule.sector_id = :sectorId', { sectorId });

    if (filters?.status) {
      qb.andWhere('capsule.status = :status', { status: filters.status });
    }
    if (filters?.type) {
      qb.andWhere('capsule.type = :type', { type: filters.type });
    }

    qb.orderBy('capsule.created_at', 'DESC');
    const models = await qb.getMany();
    return CapsuleMapper.toDomainArray(models);
  }

  async delete(id: string): Promise<void> {
    await this.repository.update(id, { status: CapsuleStatus.ARCHIVED });
  }

  async addSources(capsuleId: string, sourceIds: string[]): Promise<void> {
    if (sourceIds.length === 0) return;

    const PARAMS_PER_ROW = 2;
    const FIRST_PARAM_OFFSET = 1;
    const SECOND_PARAM_OFFSET = 2;
    const values = sourceIds
      .map(
        (_, i) =>
          `($${i * PARAMS_PER_ROW + FIRST_PARAM_OFFSET}::uuid, $${i * PARAMS_PER_ROW + SECOND_PARAM_OFFSET}::uuid)`,
      )
      .join(', ');
    const params = sourceIds.flatMap((sid) => [capsuleId, sid]);

    await this.dataSource.query(
      `INSERT INTO capsule_sources (capsule_id, source_id) VALUES ${values} ON CONFLICT DO NOTHING`,
      params,
    );
  }

  async getSources(capsuleId: string): Promise<CapsuleSourceRef[]> {
    const rows = await this.dataSource.query<
      { id: string; title: string; source_type: string }[]
    >(
      `SELECT ks.id, ks.title, ks.source_type
       FROM knowledge_sources ks
       INNER JOIN capsule_sources cs ON cs.source_id = ks.id
       WHERE cs.capsule_id = $1
       ORDER BY ks.title ASC`,
      [capsuleId],
    );

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      sourceType: r.source_type,
    }));
  }

  async countBySectorAndStatus(
    sectorId: string,
    status: CapsuleStatus,
  ): Promise<number> {
    return this.repository.count({
      where: { sectorId, status: status as unknown as CapsuleStatus },
    });
  }
}

// Re-export filter/pagination types for use-case imports
export type { CapsuleFilters, PaginationOptions, PaginatedResult };
export { CapsuleType };
