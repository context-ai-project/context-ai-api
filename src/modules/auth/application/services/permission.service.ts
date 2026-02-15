import { Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '../../../users/infrastructure/persistence/repositories/user.repository';
import { RoleRepository } from '../../infrastructure/persistence/repositories/role.repository';
import { extractErrorMessage } from '@shared/utils';

/**
 * Permission Service
 *
 * Handles Role-Based Access Control (RBAC) logic
 *
 * Features:
 * - Get user roles
 * - Get user permissions (from roles)
 * - Check if user has specific permission
 * - Check if user has specific role
 *
 * Security:
 * - Returns empty arrays for non-existent users (fail-safe)
 * - Caches are not used here (stateless)
 * - Logging for audit trail
 */
@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
  ) {}

  /**
   * Get all role names for a user
   *
   * @param userId - Internal user UUID
   * @returns Array of role names (e.g., ['user', 'manager'])
   */
  async getUserRoles(userId: string): Promise<string[]> {
    try {
      const userWithRoles = await this.userRepository.findByIdWithRoles(userId);

      if (!userWithRoles) {
        this.logger.warn('User not found for role lookup', {
          userId: userId.substring(0, 8) + '...',
        });
        return [];
      }

      return userWithRoles.roles.map((role) => role.name);
    } catch (error: unknown) {
      this.logger.error('Failed to get user roles', {
        userId: userId.substring(0, 8) + '...',
        error: extractErrorMessage(error),
      });
      return [];
    }
  }

  /**
   * Get all permission names for a user (from their roles)
   *
   * @param userId - Internal user UUID
   * @returns Array of unique permission names (e.g., ['chat:read', 'knowledge:read'])
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const userWithRoles = await this.userRepository.findByIdWithRoles(userId);

      if (!userWithRoles) {
        this.logger.warn('User not found for permission lookup', {
          userId: userId.substring(0, 8) + '...',
        });
        return [];
      }

      // Get role IDs
      const roleIds = userWithRoles.roles.map((role) => role.id);

      if (roleIds.length === 0) {
        this.logger.warn('User has no roles assigned', {
          userId: userId.substring(0, 8) + '...',
        });
        return [];
      }

      // Get roles with their permissions
      const rolesWithPermissions =
        await this.roleRepository.findManyWithPermissions(roleIds);

      // Flatten permissions from all roles and remove duplicates
      const permissionSet = new Set<string>();

      for (const role of rolesWithPermissions) {
        for (const permission of role.permissions) {
          permissionSet.add(permission.name);
        }
      }

      return Array.from(permissionSet);
    } catch (error: unknown) {
      this.logger.error('Failed to get user permissions', {
        userId: userId.substring(0, 8) + '...',
        error: extractErrorMessage(error),
      });
      return [];
    }
  }

  /**
   * Check if user has a specific permission
   *
   * @param userId - Internal user UUID
   * @param permission - Permission name (e.g., 'knowledge:create')
   * @returns True if user has permission, false otherwise
   */
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    const hasAccess = permissions.includes(permission);

    // Structured logging for security audit
    this.logger.log('Permission check', {
      userId: userId.substring(0, 8) + '...',
      permission,
      granted: hasAccess,
      timestamp: new Date().toISOString(),
    });

    return hasAccess;
  }

  /**
   * Check if user has any of the specified permissions
   *
   * @param userId - Internal user UUID
   * @param permissions - Array of permission names
   * @returns True if user has at least one permission, false otherwise
   */
  async hasAnyPermission(
    userId: string,
    permissions: string[],
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    const hasAccess = permissions.some((perm) =>
      userPermissions.includes(perm),
    );

    this.logger.log('Multiple permission check (ANY)', {
      userId: userId.substring(0, 8) + '...',
      requiredPermissions: permissions,
      granted: hasAccess,
      timestamp: new Date().toISOString(),
    });

    return hasAccess;
  }

  /**
   * Check if user has all of the specified permissions
   *
   * @param userId - Internal user UUID
   * @param permissions - Array of permission names
   * @returns True if user has all permissions, false otherwise
   */
  async hasAllPermissions(
    userId: string,
    permissions: string[],
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    const hasAccess = permissions.every((perm) =>
      userPermissions.includes(perm),
    );

    this.logger.log('Multiple permission check (ALL)', {
      userId: userId.substring(0, 8) + '...',
      requiredPermissions: permissions,
      granted: hasAccess,
      timestamp: new Date().toISOString(),
    });

    return hasAccess;
  }

  /**
   * Check if user has a specific role
   *
   * @param userId - Internal user UUID
   * @param roleName - Role name (e.g., 'admin', 'manager', 'user')
   * @returns True if user has role, false otherwise
   */
  async hasRole(userId: string, roleName: string): Promise<boolean> {
    const roles = await this.getUserRoles(userId);
    const hasAccess = roles.includes(roleName);

    this.logger.log('Role check', {
      userId: userId.substring(0, 8) + '...',
      role: roleName,
      granted: hasAccess,
      timestamp: new Date().toISOString(),
    });

    return hasAccess;
  }
}
