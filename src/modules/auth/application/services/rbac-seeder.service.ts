import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleModel } from '../../infrastructure/persistence/models/role.model';
import { PermissionModel } from '../../infrastructure/persistence/models/permission.model';

// Constants for permission names
const PERM_CHAT_READ = 'chat:read';
const PERM_KNOWLEDGE_READ = 'knowledge:read';
const PERM_KNOWLEDGE_CREATE = 'knowledge:create';
const PERM_KNOWLEDGE_UPDATE = 'knowledge:update';
const PERM_KNOWLEDGE_DELETE = 'knowledge:delete';
const PERM_PROFILE_READ = 'profile:read';
const PERM_PROFILE_UPDATE = 'profile:update';
const PERM_USERS_READ = 'users:read';
const PERM_USERS_MANAGE = 'users:manage';
const PERM_SYSTEM_ADMIN = 'system:admin';

// Constants for permission descriptions
const PERM_DESC_KNOWLEDGE_READ = 'View knowledge documents';
const PERM_DESC_KNOWLEDGE_CREATE = 'Upload and create knowledge documents';
const PERM_DESC_KNOWLEDGE_UPDATE = 'Edit knowledge documents';
const PERM_DESC_KNOWLEDGE_DELETE = 'Delete knowledge documents';
const PERM_DESC_PROFILE_READ = 'View own profile';
const PERM_DESC_PROFILE_UPDATE = 'Update own profile';
const PERM_DESC_USERS_READ = 'View user information';

/**
 * RBAC Seeder Service
 *
 * Seeds initial roles, permissions, and role-permission associations.
 * This service is idempotent - it can be run multiple times without duplicating data.
 *
 * Purpose:
 * - Initialize RBAC data for development, testing, and production
 * - Ensure consistent role and permission structure across environments
 * - Provide programmatic seeding alternative to SQL migrations
 *
 * Usage:
 * - Run during application bootstrap in development
 * - Execute via CLI command for manual seeding
 * - Use in integration tests to prepare test data
 *
 * Roles:
 * - admin: Full system access
 * - manager: Knowledge management + user oversight
 * - user: Basic access (chat, read knowledge, profile)
 *
 * Permissions follow the format: resource:action
 * - chat:read
 * - knowledge:read, knowledge:create, knowledge:update, knowledge:delete
 * - profile:read, profile:update
 * - users:read, users:manage
 * - system:admin
 */
@Injectable()
export class RbacSeederService {
  private readonly logger = new Logger(RbacSeederService.name);

  constructor(
    @InjectRepository(RoleModel)
    private readonly roleRepository: Repository<RoleModel>,
    @InjectRepository(PermissionModel)
    private readonly permissionRepository: Repository<PermissionModel>,
  ) {}

  /**
   * Seeds all RBAC data: roles, permissions, and associations.
   *
   * This method is idempotent and can be safely run multiple times.
   *
   * @returns Summary of seeded data
   */
  async seed(): Promise<{
    rolesCreated: number;
    permissionsCreated: number;
    associationsCreated: number;
  }> {
    this.logger.log('Starting RBAC seeding...');

    const rolesCreated = await this.seedRoles();
    const permissionsCreated = await this.seedPermissions();
    const associationsCreated = await this.seedRolePermissions();

    this.logger.log(
      `RBAC seeding completed: ${rolesCreated} roles, ${permissionsCreated} permissions, ${associationsCreated} associations`,
    );

    return {
      rolesCreated,
      permissionsCreated,
      associationsCreated,
    };
  }

  /**
   * Seeds system roles.
   *
   * @returns Number of roles created
   */
  private async seedRoles(): Promise<number> {
    const roles = [
      {
        name: 'admin',
        description: 'Full system access and management capabilities',
      },
      {
        name: 'manager',
        description: 'Knowledge management and user oversight',
      },
      {
        name: 'user',
        description: 'Basic user access with read permissions',
      },
    ];

    let createdCount = 0;
    for (const roleData of roles) {
      const existing = await this.roleRepository.findOne({
        where: { name: roleData.name },
      });

      if (!existing) {
        const role = this.roleRepository.create(roleData);
        await this.roleRepository.save(role);
        createdCount++;
        this.logger.log(`Created role: ${roleData.name}`);
      } else {
        this.logger.debug(`Role already exists: ${roleData.name}`);
      }
    }

    return createdCount;
  }

  /**
   * Seeds system permissions.
   *
   * @returns Number of permissions created
   */
  private async seedPermissions(): Promise<number> {
    const permissions = [
      // Chat permissions
      {
        name: PERM_CHAT_READ,
        description: 'Interact with AI assistant',
      },

      // Knowledge permissions
      {
        name: PERM_KNOWLEDGE_READ,
        description: PERM_DESC_KNOWLEDGE_READ,
      },
      {
        name: PERM_KNOWLEDGE_CREATE,
        description: PERM_DESC_KNOWLEDGE_CREATE,
      },
      {
        name: PERM_KNOWLEDGE_UPDATE,
        description: PERM_DESC_KNOWLEDGE_UPDATE,
      },
      {
        name: PERM_KNOWLEDGE_DELETE,
        description: PERM_DESC_KNOWLEDGE_DELETE,
      },

      // Profile permissions
      {
        name: PERM_PROFILE_READ,
        description: PERM_DESC_PROFILE_READ,
      },
      {
        name: PERM_PROFILE_UPDATE,
        description: PERM_DESC_PROFILE_UPDATE,
      },

      // User management permissions
      {
        name: PERM_USERS_READ,
        description: PERM_DESC_USERS_READ,
      },
      {
        name: PERM_USERS_MANAGE,
        description: 'Manage users (create, update, delete)',
      },

      // System administration permissions
      {
        name: PERM_SYSTEM_ADMIN,
        description: 'Full system administration access',
      },
    ];

    let createdCount = 0;
    for (const permData of permissions) {
      const existing = await this.permissionRepository.findOne({
        where: { name: permData.name },
      });

      if (!existing) {
        const permission = this.permissionRepository.create(permData);
        await this.permissionRepository.save(permission);
        createdCount++;
        this.logger.log(`Created permission: ${permData.name}`);
      } else {
        this.logger.debug(`Permission already exists: ${permData.name}`);
      }
    }

    return createdCount;
  }

  /**
   * Seeds role-permission associations.
   *
   * @returns Number of associations created
   */
  private async seedRolePermissions(): Promise<number> {
    const associations = [
      // USER ROLE: Basic access
      {
        roleName: 'user',
        permissions: [
          PERM_CHAT_READ,
          PERM_KNOWLEDGE_READ,
          PERM_PROFILE_READ,
          PERM_PROFILE_UPDATE,
        ],
      },

      // MANAGER ROLE: Knowledge management + all user permissions
      {
        roleName: 'manager',
        permissions: [
          PERM_CHAT_READ,
          PERM_KNOWLEDGE_READ,
          PERM_KNOWLEDGE_CREATE,
          PERM_KNOWLEDGE_UPDATE,
          PERM_KNOWLEDGE_DELETE,
          PERM_PROFILE_READ,
          PERM_PROFILE_UPDATE,
          PERM_USERS_READ,
        ],
      },

      // ADMIN ROLE: Full system access (all permissions)
      {
        roleName: 'admin',
        permissions: [], // Will be assigned all permissions
      },
    ];

    let createdCount = 0;
    for (const assoc of associations) {
      const role = await this.roleRepository.findOne({
        where: { name: assoc.roleName },
        relations: ['permissions'],
      });

      if (!role) {
        this.logger.warn(`Role not found: ${assoc.roleName}`);
        continue;
      }

      // Get permissions to assign
      let permissions: PermissionModel[];
      if (assoc.roleName === 'admin') {
        // For admin role, assign all permissions
        permissions = await this.permissionRepository.find();
      } else {
        // For other roles, get specific permissions
        permissions = await this.permissionRepository
          .createQueryBuilder('permission')
          .where('permission.name IN (:...names)', {
            names: assoc.permissions,
          })
          .getMany();
      }

      // Filter out permissions that are already assigned
      const newPermissions = permissions.filter(
        (perm) => !role.permissions.some((rp) => rp.id === perm.id),
      );

      if (newPermissions.length > 0) {
        role.permissions = [...role.permissions, ...newPermissions];
        await this.roleRepository.save(role);
        createdCount += newPermissions.length;
        this.logger.log(
          `Assigned ${newPermissions.length} permissions to role: ${assoc.roleName}`,
        );
      } else {
        this.logger.debug(
          `No new permissions to assign to role: ${assoc.roleName}`,
        );
      }
    }

    return createdCount;
  }

  /**
   * Clears all RBAC data (for testing purposes).
   *
   * WARNING: This will delete all roles, permissions, and user-role associations.
   * Use with caution!
   */
  async clear(): Promise<void> {
    this.logger.warn('Clearing all RBAC data...');

    // Delete role-permission associations (cascade will handle user-role)
    const roles = await this.roleRepository.find();
    if (roles.length > 0) {
      await this.roleRepository
        .createQueryBuilder()
        .relation(RoleModel, 'permissions')
        .of(roles)
        .delete()
        .execute();
    }

    await this.permissionRepository.delete({});
    await this.roleRepository.delete({});

    this.logger.warn('RBAC data cleared');
  }
}
