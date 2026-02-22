import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { UserModel } from '../models/user.model';
import { User } from '../../../domain/entities/user.entity';

/** Number of days considered "recent" for new user counting */
const RECENT_DAYS = 30;

/** Milliseconds in a single day */
const MS_PER_DAY = 86_400_000;

/**
 * User Repository
 *
 * Handles persistence operations for User entities
 * Maps between domain entities and TypeORM models
 */
@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserModel)
    private readonly repository: Repository<UserModel>,
  ) {}

  /**
   * Find user by Auth0 user ID (sub)
   */
  async findByAuth0UserId(auth0UserId: string): Promise<User | null> {
    const model = await this.repository.findOne({
      where: { auth0UserId },
    });

    return model ? this.toDomain(model) : null;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const model = await this.repository.findOne({
      where: { email },
    });

    return model ? this.toDomain(model) : null;
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const model = await this.repository.findOne({
      where: { id },
    });

    return model ? this.toDomain(model) : null;
  }

  /**
   * Find user with roles (for RBAC)
   */
  async findByIdWithRoles(id: string): Promise<UserModel | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['roles'],
    });
  }

  /**
   * Create or update user from a raw Partial<UserModel>
   */
  async save(user: Partial<UserModel>): Promise<User> {
    const model = this.repository.create(user);
    const saved = await this.repository.save(model);
    return this.toDomain(saved);
  }

  /**
   * Persist a User domain entity (maps fields automatically).
   * Prefer this over `save(Partial<UserModel>)` when working with domain entities
   * so the service does not need to know about the UserModel structure.
   */
  async saveEntity(user: User): Promise<User> {
    const model = this.repository.create({
      id: user.id,
      auth0UserId: user.auth0UserId,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    });
    const saved = await this.repository.save(model);
    return this.toDomain(saved);
  }

  /**
   * Count total registered users
   */
  async countAll(): Promise<number> {
    return this.repository.count();
  }

  /**
   * Count users created in the last N days (default: 30)
   */
  async countRecent(days: number = RECENT_DAYS): Promise<number> {
    const since = new Date(Date.now() - days * MS_PER_DAY);
    return this.repository.count({
      where: { createdAt: MoreThanOrEqual(since) },
    });
  }

  /**
   * Find all users with roles and sectors, optionally filtered by search term
   */
  async findAllWithRelations(search?: string): Promise<UserModel[]> {
    const queryBuilder = this.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .leftJoinAndSelect('user.sectors', 'sector')
      .orderBy('user.createdAt', 'DESC');

    if (search && search.trim().length > 0) {
      const term = `%${search.trim()}%`;
      queryBuilder.where(
        '(LOWER(user.name) LIKE LOWER(:term) OR LOWER(user.email) LIKE LOWER(:term))',
        { term },
      );
    }

    return queryBuilder.getMany();
  }

  /**
   * Find user by ID with roles and sectors
   */
  async findByIdWithRelations(id: string): Promise<UserModel | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['roles', 'sectors'],
    });
  }

  /**
   * Find all users that have a specific role assigned.
   * Uses INNER JOIN for efficiency — returns only { id } to avoid loading
   * unnecessary columns when only the user ID is needed (e.g. notifications).
   *
   * @param roleName - Role name to filter by (e.g. 'admin')
   * @returns Array of objects with id only
   */
  async findByRole(roleName: string): Promise<Array<{ id: string }>> {
    return this.repository
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role', 'role.name = :roleName', { roleName })
      .select(['user.id'])
      .getMany();
  }

  /**
   * Save a UserModel directly (for admin operations that modify relations)
   */
  async saveModel(model: UserModel): Promise<UserModel> {
    return this.repository.save(model);
  }

  /**
   * Map TypeORM model to domain entity
   */
  private toDomain(model: UserModel): User {
    return new User({
      id: model.id,
      auth0UserId: model.auth0UserId,
      email: model.email,
      name: model.name,
      isActive: model.isActive,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      lastLoginAt: model.lastLoginAt,
    });
  }
}
