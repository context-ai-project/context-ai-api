import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for required roles
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator: Require Roles
 *
 * Marks a route handler to require specific roles.
 * Must be used in combination with RBACGuard (Issue 6.10).
 *
 * User must have AT LEAST ONE of the specified roles.
 *
 * @param roles - Array of role names (e.g., ['admin', 'manager'])
 *
 * @example
 * // Require admin or manager role
 * `@RequireRoles(['admin', 'manager'])`
 * getAdminData() { ... }
 *
 * @example
 * // Require only admin role
 * `@RequireRoles(['admin'])`
 * deleteUser() { ... }
 */
export const RequireRoles = (...roles: string[]) =>
  SetMetadata(ROLES_KEY, roles);
