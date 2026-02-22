import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserRepository } from '../../infrastructure/persistence/repositories/user.repository';
import { RoleRepository } from '../../../auth/infrastructure/persistence/repositories/role.repository';
import { User } from '../../domain/entities/user.entity';
import { UserActivatedEvent } from '../../domain/events/user.events';
import { extractErrorMessage } from '@shared/utils';

/**
 * Interface for InvitationService to avoid circular import.
 * Only the methods used by UserService are declared here.
 */
export interface InvitationAcceptanceService {
  findPendingByEmail(email: string): Promise<InvitationForSync | null>;
  markAccepted(id: string): Promise<void>;
}

export interface InvitationForSync {
  id: string;
  email: string;
  role: string;
  sectors?: { id: string; name: string }[];
}

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
  roles: string[];
  createdAt: Date;
  lastLoginAt: Date | null;
}

/**
 * User Service
 *
 * Handles user synchronization from Auth0
 * Creates or updates users based on Auth0 profile data
 *
 * v1.3: On first login, checks for pending invitation and:
 * - Assigns sectors from the invitation to the user
 * - Marks the invitation as accepted
 * - Emits user.activated event for admin notifications
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
    @Optional()
    @Inject('IInvitationAcceptanceService')
    private readonly invitationService: InvitationAcceptanceService | null,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Find or create user from Auth0 profile
   * Updates last login timestamp on each call
   *
   * v1.3: On new user creation, checks for pending invitation and
   * assigns sectors + marks invitation as accepted.
   */
  async syncUser(dto: SyncUserDto): Promise<UserResponseDto> {
    this.logger.log(`Syncing user: ${dto.auth0UserId}`);

    // Try to find existing user
    let user = await this.userRepository.findByAuth0UserId(dto.auth0UserId);
    let isNewUser = false;

    if (user) {
      // Update profile from Auth0 + record last login via domain method
      this.logger.log(
        `User found: ${user.id}, updating last login (isActive=${String(user.isActive)})`,
      );
      const updatedUser = new User({
        ...user,
        email: dto.email,
        name: dto.name,
      }).updateLastLogin();
      user = await this.userRepository.saveEntity(updatedUser);
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
      isNewUser = true;
    }

    // v1.3: Accept pending invitation for new users
    if (isNewUser) {
      await this.acceptPendingInvitation(user, dto);
    }

    return this.buildDto(user);
  }

  /**
   * Find user by Auth0 user ID (sub)
   * Used by JWT Strategy when access token doesn't include email claim
   */
  async findByAuth0UserId(
    auth0UserId: string,
  ): Promise<UserResponseDto | null> {
    const user = await this.userRepository.findByAuth0UserId(auth0UserId);
    if (!user) return null;
    return this.buildDto(user);
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<UserResponseDto | null> {
    const user = await this.userRepository.findById(id);
    if (!user) return null;
    return this.buildDto(user);
  }

  /**
   * Accept a pending invitation for a newly created user (v1.3)
   *
   * 1. Find pending invitation by email
   * 2. Assign sectors from the invitation to the user
   * 3. Mark the invitation as accepted
   * 4. Emit user.activated event
   */
  private async acceptPendingInvitation(
    user: User,
    dto: SyncUserDto,
  ): Promise<void> {
    if (!this.invitationService) {
      return;
    }

    try {
      const invitation = await this.invitationService.findPendingByEmail(
        dto.email,
      );
      if (!invitation) {
        return;
      }

      this.logger.log(
        `Found pending invitation ${invitation.id} for ${dto.email}, accepting...`,
      );

      // Load user with all relations (roles + sectors) for assignment
      const userWithRelations = await this.userRepository.findByIdWithRelations(
        user.id,
      );

      if (userWithRelations) {
        // Assign role from the invitation
        const roleName = invitation.role || 'user';
        const role = await this.roleRepository.findByName(roleName);
        if (role) {
          const roleModel = await this.roleRepository.findWithPermissions(
            role.id,
          );
          if (roleModel) {
            userWithRelations.roles = [roleModel];
            this.logger.log(
              `Assigned role "${roleName}" from invitation to user ${user.id}`,
            );
          }
        }

        // Assign sectors from the invitation
        const sectorIds = (invitation.sectors ?? []).map((s) => s.id);
        if (sectorIds.length > 0) {
          const existingSectorIds = (userWithRelations.sectors ?? []).map(
            (s) => s.id,
          );
          const newSectors = sectorIds.filter(
            (id) => !existingSectorIds.includes(id),
          );

          if (newSectors.length > 0) {
            const allSectorModels = [
              ...(userWithRelations.sectors ?? []),
              ...newSectors.map((id) => ({ id }) as { id: string }),
            ];
            userWithRelations.sectors =
              allSectorModels as typeof userWithRelations.sectors;
            this.logger.log(
              `Assigned ${newSectors.length} sectors from invitation to user ${user.id}`,
            );
          }
        }

        // Save role + sector assignments in a single operation
        await this.userRepository.saveModel(userWithRelations);
      }

      // Mark invitation as accepted
      await this.invitationService.markAccepted(invitation.id);

      // Emit user.activated event
      this.eventEmitter.emit(
        'user.activated',
        new UserActivatedEvent(
          user.id,
          user.email,
          user.name,
          user.auth0UserId,
          new Date(),
        ),
      );

      this.logger.log(
        `Invitation ${invitation.id} accepted for user ${user.id}`,
      );
    } catch (error: unknown) {
      // Don't fail the login if invitation acceptance fails
      this.logger.warn(
        `Failed to accept invitation for ${dto.email}: ${extractErrorMessage(error)}`,
      );
    }
  }

  /**
   * Load user roles and map to DTO in a single step.
   * Eliminates the repeated 3-line pattern:
   *   findByIdWithRoles → extract names → mapToDto
   */
  private async buildDto(user: User): Promise<UserResponseDto> {
    const userWithRoles = await this.userRepository.findByIdWithRoles(user.id);
    const roles = userWithRoles?.roles?.map((r) => r.name) ?? [];
    return this.mapToDto(user, roles);
  }

  /**
   * Map domain entity to DTO
   */
  private mapToDto(user: User, roles: string[] = []): UserResponseDto {
    return {
      id: user.id,
      auth0UserId: user.auth0UserId,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      roles,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
