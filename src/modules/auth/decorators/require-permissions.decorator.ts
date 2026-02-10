import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for required permissions
 */
export const PERMISSIONS_KEY = 'permissions';

/**
 * Metadata key for permission match mode
 */
export const PERMISSION_MATCH_MODE_KEY = 'permission_match_mode';

/**
 * Permission match mode
 * - ALL: User must have ALL specified permissions (AND logic)
 * - ANY: User must have AT LEAST ONE specified permission (OR logic)
 */
export enum PermissionMatchMode {
  ALL = 'ALL',
  ANY = 'ANY',
}

/**
 * Options for @RequirePermissions decorator
 */
export interface RequirePermissionsOptions {
  /**
   * Match mode for permissions
   * @default PermissionMatchMode.ALL
   */
  mode?: PermissionMatchMode;
}

/**
 * Decorator: Require Permissions
 *
 * Marks a route handler to require specific permissions.
 * Must be used in combination with RBACGuard (Issue 6.10).
 *
 * @param permissions - Array of permission names (e.g., ['knowledge:read', 'knowledge:create'])
 * @param options - Optional configuration
 *
 * @example
 * // Require ALL permissions (default)
 * `@RequirePermissions(['knowledge:read', 'knowledge:update'])`
 * getKnowledge() { ... }
 *
 * @example
 * // Require ANY permission (OR logic)
 * `@RequirePermissions(['knowledge:read', 'chat:read'], { mode: PermissionMatchMode.ANY })`
 * getData() { ... }
 *
 * @example
 * // Single permission
 * `@RequirePermissions(['knowledge:create'])`
 * createKnowledge() { ... }
 */
export const RequirePermissions = (
  permissions: string[],
  options?: RequirePermissionsOptions,
) => {
  const mode = options?.mode ?? PermissionMatchMode.ALL;

  // Use a function to apply both metadata decorators
  return (
    target: object,
    propertyKey?: string | symbol,
    descriptor?: TypedPropertyDescriptor<unknown>,
  ) => {
    SetMetadata(PERMISSIONS_KEY, permissions)(target, propertyKey, descriptor);
    SetMetadata(PERMISSION_MATCH_MODE_KEY, mode)(
      target,
      propertyKey,
      descriptor,
    );
  };
};
