/**
 * Role Domain Entity
 *
 * Represents a role in the RBAC (Role-Based Access Control) system.
 *
 * Business Rules:
 * - Each role has a unique name
 * - Roles can have multiple permissions
 * - Roles can be assigned to multiple users
 * - System roles (admin, manager, user) cannot be deleted
 *
 * @example
 * const userRole = new Role('user-role-id', 'user', 'Basic user access', true);
 */
export class Role {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public readonly isSystemRole: boolean = false,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
  ) {}

  /**
   * Check if this is a system role (cannot be deleted)
   */
  isSystem(): boolean {
    return this.isSystemRole;
  }

  /**
   * Check if role is admin
   */
  isAdmin(): boolean {
    return this.name === 'admin';
  }

  /**
   * Check if role is manager
   */
  isManager(): boolean {
    return this.name === 'manager';
  }

  /**
   * Check if role is user (default role)
   */
  isUser(): boolean {
    return this.name === 'user';
  }
}

