import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserModel } from '../models/user.model';
import { User } from '../../../domain/entities/user.entity';

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
   * Create or update user
   */
  async save(user: Partial<UserModel>): Promise<User> {
    const model = this.repository.create(user);
    const saved = await this.repository.save(model);
    return this.toDomain(saved);
  }

  /**
   * Map TypeORM model to domain entity
   */
  private toDomain(model: UserModel): User {
    return new User(
      model.id,
      model.auth0UserId,
      model.email,
      model.name,
      model.isActive,
      model.createdAt,
      model.updatedAt,
      model.lastLoginAt,
    );
  }
}
