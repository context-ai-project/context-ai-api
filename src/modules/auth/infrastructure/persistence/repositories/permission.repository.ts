import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionModel } from '../models/permission.model';
import { Permission } from '../../../domain/entities/permission.entity';

/**
 * Permission Repository
 *
 * Handles persistence operations for Permission entities
 * Maps between domain entities and TypeORM models
 */
@Injectable()
export class PermissionRepository {
  constructor(
    @InjectRepository(PermissionModel)
    private readonly repository: Repository<PermissionModel>,
  ) {}

  /**
   * Find permission by name (resource:action)
   */
  async findByName(name: string): Promise<Permission | null> {
    const model = await this.repository.findOne({
      where: { name },
    });

    return model ? this.toDomain(model) : null;
  }

  /**
   * Find permission by ID
   */
  async findById(id: string): Promise<Permission | null> {
    const model = await this.repository.findOne({
      where: { id },
    });

    return model ? this.toDomain(model) : null;
  }

  /**
   * Find permissions by resource
   */
  async findByResource(resource: string): Promise<Permission[]> {
    const models = await this.repository.find({
      where: { resource },
    });

    return models.map((model) => this.toDomain(model));
  }

  /**
   * Find all permissions
   */
  async findAll(): Promise<Permission[]> {
    const models = await this.repository.find();
    return models.map((model) => this.toDomain(model));
  }

  /**
   * Create or update permission
   */
  async save(permission: Partial<PermissionModel>): Promise<Permission> {
    const model = this.repository.create(permission);
    const saved = await this.repository.save(model);
    return this.toDomain(saved);
  }

  /**
   * Map TypeORM model to domain entity
   */
  private toDomain(model: PermissionModel): Permission {
    return new Permission(
      model.id,
      model.name,
      model.description || '',
      model.resource,
      model.action,
      model.isSystemPermission,
      model.createdAt,
      model.updatedAt,
    );
  }
}
