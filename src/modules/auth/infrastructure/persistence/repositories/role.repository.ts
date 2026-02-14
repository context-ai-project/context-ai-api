import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { RoleModel } from '../models/role.model';
import { Role } from '../../../domain/entities/role.entity';

/**
 * Role Repository
 *
 * Handles persistence operations for Role entities
 * Maps between domain entities and TypeORM models
 */
@Injectable()
export class RoleRepository {
  constructor(
    @InjectRepository(RoleModel)
    private readonly repository: Repository<RoleModel>,
  ) {}

  /**
   * Find role by name
   */
  async findByName(name: string): Promise<Role | null> {
    const model = await this.repository.findOne({
      where: { name },
    });

    return model ? this.toDomain(model) : null;
  }

  /**
   * Find role by ID
   */
  async findById(id: string): Promise<Role | null> {
    const model = await this.repository.findOne({
      where: { id },
    });

    return model ? this.toDomain(model) : null;
  }

  /**
   * Find roles by IDs
   */
  async findByIds(ids: string[]): Promise<Role[]> {
    const models = await this.repository.find({
      where: { id: In(ids) },
    });
    return models.map((model) => this.toDomain(model));
  }

  /**
   * Find all roles
   */
  async findAll(): Promise<Role[]> {
    const models = await this.repository.find();
    return models.map((model) => this.toDomain(model));
  }

  /**
   * Find roles with their permissions
   */
  async findWithPermissions(roleId: string): Promise<RoleModel | null> {
    return this.repository.findOne({
      where: { id: roleId },
      relations: ['permissions'],
    });
  }

  /**
   * Find multiple roles with their permissions
   */
  async findManyWithPermissions(roleIds: string[]): Promise<RoleModel[]> {
    return this.repository.find({
      where: { id: In(roleIds) },
      relations: ['permissions'],
    });
  }

  /**
   * Create or update role
   */
  async save(role: Partial<RoleModel>): Promise<Role> {
    const model = this.repository.create(role);
    const saved = await this.repository.save(model);
    return this.toDomain(saved);
  }

  /**
   * Map TypeORM model to domain entity
   */
  private toDomain(model: RoleModel): Role {
    return new Role(
      model.id,
      model.name,
      model.description || '',
      model.isSystemRole,
      model.createdAt,
      model.updatedAt,
    );
  }
}
