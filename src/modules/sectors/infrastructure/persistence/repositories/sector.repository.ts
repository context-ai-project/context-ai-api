import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { ISectorRepository } from '../../../domain/repositories/sector.repository.interface';
import { Sector } from '../../../domain/entities/sector.entity';
import { SectorModel } from '../models/sector.model';
import { SectorMapper } from '../mappers/sector.mapper';
import { SectorStatus } from '@shared/types';

/**
 * TypeORM Sector Repository Implementation
 *
 * Implements the ISectorRepository interface using TypeORM.
 * Manages persistence for Sector entities.
 *
 * Features:
 * - CRUD operations
 * - Case-insensitive name lookups using LOWER()
 * - Name uniqueness validation
 */
@Injectable()
export class SectorRepository implements ISectorRepository {
  constructor(
    @InjectRepository(SectorModel)
    private readonly repository: Repository<SectorModel>,
  ) {}

  async save(sector: Sector): Promise<Sector> {
    const model = SectorMapper.toModel(sector);
    const saved = await this.repository.save(model);
    return SectorMapper.toDomain(saved);
  }

  async findById(id: string): Promise<Sector | null> {
    const model = await this.repository.findOne({ where: { id } });
    return model ? SectorMapper.toDomain(model) : null;
  }

  async findByName(name: string): Promise<Sector | null> {
    const model = await this.repository
      .createQueryBuilder('sector')
      .where('LOWER(sector.name) = LOWER(:name)', { name: name.trim() })
      .getOne();
    return model ? SectorMapper.toDomain(model) : null;
  }

  async findByIds(ids: string[]): Promise<Sector[]> {
    if (ids.length === 0) return [];
    const models = await this.repository.find({ where: { id: In(ids) } });
    return SectorMapper.toDomainArray(models);
  }

  async findAll(): Promise<Sector[]> {
    const models = await this.repository.find({
      order: { createdAt: 'DESC' },
    });
    return SectorMapper.toDomainArray(models);
  }

  async findAllActive(): Promise<Sector[]> {
    const models = await this.repository.find({
      where: { status: SectorStatus.ACTIVE },
      order: { name: 'ASC' },
    });
    return SectorMapper.toDomainArray(models);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async existsByName(name: string, excludeId?: string): Promise<boolean> {
    const query = this.repository
      .createQueryBuilder('sector')
      .where('LOWER(sector.name) = LOWER(:name)', { name: name.trim() });

    if (excludeId) {
      query.andWhere('sector.id != :excludeId', { excludeId });
    }

    const count = await query.getCount();
    return count > 0;
  }

  async countAll(): Promise<number> {
    return this.repository.count();
  }

  async countByStatus(status: string): Promise<number> {
    return this.repository.count({
      where: { status: status as SectorStatus },
    });
  }
}
