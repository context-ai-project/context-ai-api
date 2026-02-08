import { Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '../../infrastructure/persistence/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';

export interface SyncUserDto {
  auth0UserId: string;
  email: string;
  name: string;
}

export interface UserResponseDto {
  id: string;
  auth0UserId: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

/**
 * User Service
 *
 * Handles user synchronization from Auth0
 * Creates or updates users based on Auth0 profile data
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Find or create user from Auth0 profile
   * Updates last login timestamp on each call
   */
  async syncUser(dto: SyncUserDto): Promise<UserResponseDto> {
    this.logger.log(`Syncing user: ${dto.auth0UserId}`);

    // Try to find existing user
    let user = await this.userRepository.findByAuth0UserId(dto.auth0UserId);

    if (user) {
      // Update last login
      this.logger.log(`User found: ${user.id}, updating last login`);
      user = await this.userRepository.save({
        id: user.id,
        auth0UserId: user.auth0UserId,
        email: dto.email,
        name: dto.name,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      // Create new user
      this.logger.log(
        `User not found, creating new user for: ${dto.auth0UserId}`,
      );
      user = await this.userRepository.save({
        auth0UserId: dto.auth0UserId,
        email: dto.email,
        name: dto.name,
        lastLoginAt: new Date(),
        isActive: true,
      });
    }

    return this.mapToDto(user);
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<UserResponseDto | null> {
    const user = await this.userRepository.findById(id);
    return user ? this.mapToDto(user) : null;
  }

  /**
   * Map domain entity to DTO
   */
  private mapToDto(user: User): UserResponseDto {
    return {
      id: user.id,
      auth0UserId: user.auth0UserId,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
