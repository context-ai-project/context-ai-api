import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UserRepository } from '../../infrastructure/persistence/repositories/user.repository';
import { RoleRepository } from '../../../auth/infrastructure/persistence/repositories/role.repository';
import type { UserModel } from '../../infrastructure/persistence/models/user.model';
import type { SectorModel } from '../../../sectors/infrastructure/persistence/models/sector.model';
import type { AdminUserResponseDto } from '../dtos/admin-user.dto';
import type { ISectorRepository } from '../../../sectors/domain/repositories/sector.repository.interface';
import { Inject } from '@nestjs/common';

/** Valid role names for assignment */
const VALID_ROLES = ['admin', 'manager', 'user'] as const;

/**
 * Admin User Service
 *
 * Handles administrative operations on users:
 * - List users with search/filter
 * - Update user roles
 * - Toggle user active status
 * - Manage user-sector associations
 */
@Injectable()
export class AdminUserService {
  private readonly logger = new Logger(AdminUserService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
    @Inject('ISectorRepository')
    private readonly sectorRepository: ISectorRepository,
  ) {}

  /**
   * List all users with their roles and sectors
   * Optionally filter by name/email search term
   */
  async listUsers(search?: string): Promise<AdminUserResponseDto[]> {
    const searchSuffix = search ? ' with search: "' + search + '"' : '';
    this.logger.log('List users request' + searchSuffix);

    const users = await this.userRepository.findAllWithRelations(search);
    return users.map((user) => this.mapToAdminDto(user));
  }

  /**
   * Get a single user by ID with all relations
   */
  async getUserById(id: string): Promise<AdminUserResponseDto> {
    const user = await this.userRepository.findByIdWithRelations(id);
    if (!user) {
      throw new NotFoundException(`User not found: ${id}`);
    }
    return this.mapToAdminDto(user);
  }

  /**
   * Update a user's role
   * Replaces all existing roles with the new single role
   */
  async updateUserRole(
    userId: string,
    roleName: string,
  ): Promise<AdminUserResponseDto> {
    this.logger.log(`Update role for user ${userId} to ${roleName}`);

    if (!VALID_ROLES.includes(roleName as (typeof VALID_ROLES)[number])) {
      throw new BadRequestException(
        `Invalid role: ${roleName}. Valid roles: ${VALID_ROLES.join(', ')}`,
      );
    }

    const user = await this.userRepository.findByIdWithRelations(userId);
    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    const role = await this.roleRepository.findByName(roleName);
    if (!role) {
      throw new NotFoundException(`Role not found: ${roleName}`);
    }

    // Find the role model to assign
    const roleModel = await this.roleRepository.findWithPermissions(role.id);
    if (!roleModel) {
      throw new NotFoundException(`Role model not found: ${roleName}`);
    }

    user.roles = [roleModel];
    user.updatedAt = new Date();

    const saved = await this.userRepository.saveModel(user);
    // Reload with relations
    const updated = await this.userRepository.findByIdWithRelations(saved.id);
    if (!updated) {
      throw new NotFoundException(`User not found after update: ${saved.id}`);
    }

    return this.mapToAdminDto(updated);
  }

  /**
   * Toggle a user's active/inactive status
   */
  async toggleUserStatus(
    userId: string,
    isActive: boolean,
  ): Promise<AdminUserResponseDto> {
    this.logger.log(
      `Toggle status for user ${userId} to ${isActive ? 'active' : 'inactive'}`,
    );

    const user = await this.userRepository.findByIdWithRelations(userId);
    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    user.isActive = isActive;
    user.updatedAt = new Date();

    await this.userRepository.saveModel(user);
    const updated = await this.userRepository.findByIdWithRelations(userId);
    if (!updated) {
      throw new NotFoundException(`User not found after update: ${userId}`);
    }

    return this.mapToAdminDto(updated);
  }

  /**
   * Update the sectors assigned to a user
   * Replaces all existing sector associations
   */
  async updateUserSectors(
    userId: string,
    sectorIds: string[],
  ): Promise<AdminUserResponseDto> {
    this.logger.log(
      `Update sectors for user ${userId}: [${sectorIds.join(', ')}]`,
    );

    const user = await this.userRepository.findByIdWithRelations(userId);
    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    // Validate all sector IDs exist
    const sectors: SectorModel[] = [];
    for (const sectorId of sectorIds) {
      const sector = await this.sectorRepository.findById(sectorId);
      if (!sector) {
        throw new BadRequestException(`Sector not found: ${sectorId}`);
      }
      // We need the SectorModel, not domain entity. Use the sector id.
      sectors.push({ id: sectorId } as SectorModel);
    }

    user.sectors = sectors;
    user.updatedAt = new Date();

    await this.userRepository.saveModel(user);
    const updated = await this.userRepository.findByIdWithRelations(userId);
    if (!updated) {
      throw new NotFoundException(`User not found after update: ${userId}`);
    }

    return this.mapToAdminDto(updated);
  }

  /**
   * Map a UserModel (with relations) to AdminUserResponseDto
   */
  private mapToAdminDto(user: UserModel): AdminUserResponseDto {
    return {
      id: user.id,
      auth0UserId: user.auth0UserId,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      roles: user.roles?.map((r) => r.name) ?? [],
      sectorIds: user.sectors?.map((s) => s.id) ?? [],
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
