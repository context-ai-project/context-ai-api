/**
 * Permission Domain Entity
 *
 * Represents a permission in the RBAC system.
 *
 * Permission Naming Convention:
 * Format: {resource}:{action}
 * Examples:
 * - chat:read
 * - knowledge:read
 * - knowledge:create
 * - knowledge:update
 * - knowledge:delete
 * - users:manage
 * - profile:update
 *
 * Business Rules:
 * - Each permission has a unique name
 * - Permissions follow resource:action format
 * - Permissions can be assigned to multiple roles
 * - System permissions cannot be deleted
 *
 * @example
 * const readPermission = new Permission(
 *   'perm-id',
 *   'knowledge:read',
 *   'Read knowledge documents',
 *   'knowledge',
 *   'read',
 *   true
 * );
 */
export class Permission {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public readonly resource: string,
    public readonly action: string,
    public readonly isSystemPermission: boolean = false,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
  ) {}

  /**
   * Check if this is a system permission (cannot be deleted)
   */
  isSystem(): boolean {
    return this.isSystemPermission;
  }

  /**
   * Check if permission allows read access
   */
  isReadPermission(): boolean {
    return this.action === 'read';
  }

  /**
   * Check if permission allows write access
   */
  isWritePermission(): boolean {
    return ['create', 'update', 'delete', 'write'].includes(this.action);
  }

  /**
   * Check if permission is for a specific resource
   */
  isForResource(resource: string): boolean {
    return this.resource === resource;
  }

  /**
   * Get full permission string (resource:action)
   */
  toString(): string {
    return this.name;
  }
}
