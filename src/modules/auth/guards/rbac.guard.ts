import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from '../application/services/permission.service';
import { ValidatedUser } from '../types/jwt-payload.type';
import {
  PERMISSIONS_KEY,
  PERMISSION_MATCH_MODE_KEY,
  PermissionMatchMode,
} from '../decorators/require-permissions.decorator';
import { ROLES_KEY } from '../decorators/require-roles.decorator';

/**
 * Context for access control logging.
 * Groups the (userId, request) data clump that is passed to all logging methods.
 */
interface AccessLogContext {
  userId: string;
  method: string;
  path: string;
  ip?: string;
}

/**
 * RBAC Guard
 *
 * Role-Based Access Control guard that validates user permissions and roles.
 * This guard should be used in combination with JwtAuthGuard.
 *
 * Features:
 * - Validates permissions using @RequirePermissions decorator
 * - Validates roles using @RequireRoles decorator
 * - Supports ALL (AND) and ANY (OR) permission matching modes
 * - Provides structured logging for access control decisions
 * - Fails securely if user is not authenticated
 *
 * Usage Order (apply guards in this order):
 * @UseGuards(JwtAuthGuard, RBACGuard)
 * @RequirePermissions(['knowledge:create'])
 * @Post('knowledge')
 * createKnowledge() { ... }
 *
 * @example
 * // Require specific permissions (ALL mode - default)
 * `@UseGuards(JwtAuthGuard, RBACGuard)`
 * `@RequirePermissions(['knowledge:read', 'knowledge:update'])`
 * `@Get('knowledge')`
 * getKnowledge() { ... }
 *
 * @example
 * // Require at least one permission (ANY mode)
 * `@UseGuards(JwtAuthGuard, RBACGuard)`
 * `@RequirePermissions(['chat:read', 'knowledge:read'], { mode: PermissionMatchMode.ANY })`
 * `@Get('data')`
 * getData() { ... }
 *
 * @example
 * // Require specific roles
 * `@UseGuards(JwtAuthGuard, RBACGuard)`
 * `@RequireRoles('admin', 'manager')`
 * `@Delete('users/:id')`
 * deleteUser() { ... }
 */
@Injectable()
export class RBACGuard implements CanActivate {
  private readonly logger = new Logger(RBACGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  /**
   * Determines if the request can proceed based on RBAC rules
   *
   * @param context - Execution context
   * @returns Promise<boolean> - true if access is granted, false if denied
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Extract required permissions and roles from metadata
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions or roles are required, allow access
    if (!requiredPermissions && !requiredRoles) {
      return true;
    }

    // Extract user from request (set by JwtAuthGuard)
    const request = context.switchToHttp().getRequest<{
      user?: ValidatedUser;
      method: string;
      url: string;
      ip?: string;
    }>();

    const user = request.user;

    // Fail securely if user is not authenticated
    if (!user || !user.userId) {
      this.logger.error('RBAC check failed: User not authenticated', {
        method: request.method,
        path: request.url.split('?')[0],
        timestamp: new Date().toISOString(),
      });
      throw new ForbiddenException(
        'Access denied. Authentication required for this resource.',
      );
    }

    // Build shared access log context
    const logContext: AccessLogContext = {
      userId: user.userId,
      method: request.method,
      path: request.url.split('?')[0],
      ip: request.ip,
    };

    // Validate role-based access
    const hasRoleAccess = await this.validateRoleAccess(
      user.userId,
      requiredRoles,
      logContext,
    );
    if (!hasRoleAccess) {
      return false;
    }

    // Validate permission-based access
    const hasPermissionAccess = await this.validatePermissionAccess(
      user.userId,
      requiredPermissions,
      context,
      logContext,
    );
    if (!hasPermissionAccess) {
      return false;
    }

    // Access granted
    this.logAccessGranted(logContext, requiredRoles, requiredPermissions);
    return true;
  }

  /**
   * Validate role-based access
   *
   * @param userId - Internal user UUID
   * @param requiredRoles - Array of required role names
   * @param logContext - Access log context
   * @returns Promise<boolean> - true if access granted, false otherwise
   */
  private async validateRoleAccess(
    userId: string,
    requiredRoles: string[] | undefined,
    logContext: AccessLogContext,
  ): Promise<boolean> {
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const hasRole = await this.checkRoles(userId, requiredRoles);
    if (!hasRole) {
      this.logAccessDenied(logContext, 'roles', requiredRoles);
      throw new ForbiddenException(
        `Access denied. Required role: ${requiredRoles.join(' or ')}`,
      );
    }
    return true;
  }

  /**
   * Validate permission-based access
   *
   * @param userId - Internal user UUID
   * @param requiredPermissions - Array of required permission names
   * @param context - Execution context
   * @param logContext - Access log context
   * @returns Promise<boolean> - true if access granted, false otherwise
   */
  private async validatePermissionAccess(
    userId: string,
    requiredPermissions: string[] | undefined,
    context: ExecutionContext,
    logContext: AccessLogContext,
  ): Promise<boolean> {
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const permissionMode =
      this.reflector.getAllAndOverride<PermissionMatchMode>(
        PERMISSION_MATCH_MODE_KEY,
        [context.getHandler(), context.getClass()],
      );

    const hasPermission = await this.checkPermissions(
      userId,
      requiredPermissions,
      permissionMode,
    );

    if (!hasPermission) {
      this.logAccessDenied(
        logContext,
        'permissions',
        requiredPermissions,
        permissionMode,
      );
      const separator =
        permissionMode === PermissionMatchMode.ANY ? ' or ' : ' and ';
      const plural = requiredPermissions.length > 1 ? 's' : '';
      throw new ForbiddenException(
        `Access denied. Required permission${plural}: ${requiredPermissions.join(separator)}`,
      );
    }
    return true;
  }

  /**
   * Check if user has at least one of the required roles
   *
   * @param userId - Internal user UUID
   * @param requiredRoles - Array of required role names
   * @returns Promise<boolean> - true if user has at least one role
   */
  private async checkRoles(
    userId: string,
    requiredRoles: string[],
  ): Promise<boolean> {
    const userRoles = await this.permissionService.getUserRoles(userId);

    // Check if user has at least one of the required roles (OR logic)
    return requiredRoles.some((role) => userRoles.includes(role));
  }

  /**
   * Check if user has required permissions
   *
   * @param userId - Internal user UUID
   * @param requiredPermissions - Array of required permission names
   * @param mode - Permission match mode (ALL or ANY)
   * @returns Promise<boolean> - true if user has required permissions
   */
  private async checkPermissions(
    userId: string,
    requiredPermissions: string[],
    mode: PermissionMatchMode = PermissionMatchMode.ALL,
  ): Promise<boolean> {
    if (mode === PermissionMatchMode.ANY) {
      return this.permissionService.hasAnyPermission(
        userId,
        requiredPermissions,
      );
    }

    // Default: ALL mode
    return this.permissionService.hasAllPermissions(
      userId,
      requiredPermissions,
    );
  }

  /**
   * Log access denied for security audit
   *
   * @param logContext - Access log context (userId, method, path, ip)
   * @param type - Type of access control (roles or permissions)
   * @param required - Required roles or permissions
   * @param mode - Permission match mode (optional)
   */
  private logAccessDenied(
    logContext: AccessLogContext,
    type: 'roles' | 'permissions',
    required: string[],
    mode?: PermissionMatchMode,
  ): void {
    const userIdPrefix = 8;
    this.logger.warn('Access denied', {
      userId: logContext.userId.substring(0, userIdPrefix) + '...',
      method: logContext.method,
      path: logContext.path,
      ip: logContext.ip,
      type,
      required,
      mode:
        type === 'permissions' ? mode || PermissionMatchMode.ALL : undefined,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log access granted for security audit
   *
   * @param logContext - Access log context (userId, method, path, ip)
   * @param roles - Required roles (if any)
   * @param permissions - Required permissions (if any)
   */
  private logAccessGranted(
    logContext: AccessLogContext,
    roles?: string[],
    permissions?: string[],
  ): void {
    const userIdPrefix = 8;
    this.logger.log('Access granted', {
      userId: logContext.userId.substring(0, userIdPrefix) + '...',
      method: logContext.method,
      path: logContext.path,
      roles: roles || [],
      permissions: permissions || [],
      timestamp: new Date().toISOString(),
    });
  }
}
