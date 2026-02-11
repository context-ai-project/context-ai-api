import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RBACGuard } from '../../../../../src/modules/auth/guards/rbac.guard';
import { PermissionService } from '../../../../../src/modules/auth/application/services/permission.service';
import { ValidatedUser } from '../../../../../src/modules/auth/types/jwt-payload.type';
import { PermissionMatchMode } from '../../../../../src/modules/auth/decorators/require-permissions.decorator';

describe('RBACGuard', () => {
  let guard: RBACGuard;
  let reflector: Reflector;
  let permissionService: jest.Mocked<PermissionService>;
  let loggerWarnSpy: jest.SpyInstance;
  let loggerLogSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  const mockUser: ValidatedUser = {
    auth0Id: 'auth0|123',
    email: 'test@example.com',
    name: 'Test User',
    permissions: [],
    userId: 'user-uuid-123',
  };

  beforeEach(async () => {
    const mockPermissionService = {
      getUserRoles: jest.fn(),
      hasAnyPermission: jest.fn(),
      hasAllPermissions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RBACGuard,
        Reflector,
        {
          provide: PermissionService,
          useValue: mockPermissionService,
        },
      ],
    }).compile();

    guard = module.get<RBACGuard>(RBACGuard);
    reflector = module.get<Reflector>(Reflector);
    permissionService = module.get(PermissionService);

    // Mock logger methods
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    loggerWarnSpy.mockRestore();
    loggerLogSpy.mockRestore();
    loggerErrorSpy.mockRestore();
  });

  const createMockContext = (user?: ValidatedUser): ExecutionContext => {
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user,
          method: 'GET',
          url: '/api/test',
          ip: '127.0.0.1',
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  };

  describe('No Restrictions', () => {
    it('should allow access when no permissions or roles are required', async () => {
      const context = createMockContext(mockUser);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('User Authentication', () => {
    it('should throw ForbiddenException if user is not authenticated', async () => {
      const context = createMockContext(undefined); // No user

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['knowledge:read']); // PERMISSIONS_KEY (always return)

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Access denied. Authentication required for this resource.',
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'RBAC check failed: User not authenticated',
        expect.objectContaining({
          method: 'GET',
          path: '/api/test',
        }),
      );
    });

    it('should throw ForbiddenException if user.userId is missing', async () => {
      const userWithoutId = { ...mockUser, userId: undefined };
      const context = createMockContext(userWithoutId);

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(['knowledge:read'])
        .mockReturnValueOnce(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('Role-Based Access', () => {
    it('should allow access if user has required role', async () => {
      const context = createMockContext(mockUser);

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(undefined) // PERMISSIONS_KEY
        .mockReturnValueOnce(['admin']); // ROLES_KEY

      permissionService.getUserRoles.mockResolvedValue(['admin', 'user']);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionService.getUserRoles).toHaveBeenCalledWith(
        mockUser.userId,
      );
      expect(loggerLogSpy).toHaveBeenCalledWith(
        'Access granted',
        expect.objectContaining({
          roles: ['admin'],
        }),
      );
    });

    it('should allow access if user has at least one of multiple required roles', async () => {
      const context = createMockContext(mockUser);

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(['admin', 'manager']);

      permissionService.getUserRoles.mockResolvedValue(['manager']);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny access if user does not have required role', async () => {
      const context = createMockContext(mockUser);

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(undefined) // PERMISSIONS_KEY
        .mockReturnValue(['admin']); // ROLES_KEY (always return)

      permissionService.getUserRoles.mockResolvedValue(['user']);

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Access denied. Required role: admin',
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Access denied',
        expect.objectContaining({
          type: 'roles',
          required: ['admin'],
        }),
      );
    });
  });

  describe('Permission-Based Access (ALL mode)', () => {
    it('should allow access if user has all required permissions', async () => {
      const context = createMockContext(mockUser);

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(['knowledge:read', 'knowledge:update'])
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(PermissionMatchMode.ALL);

      permissionService.hasAllPermissions.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionService.hasAllPermissions).toHaveBeenCalledWith(
        mockUser.userId,
        ['knowledge:read', 'knowledge:update'],
      );
      expect(loggerLogSpy).toHaveBeenCalledWith(
        'Access granted',
        expect.objectContaining({
          permissions: ['knowledge:read', 'knowledge:update'],
        }),
      );
    });

    it('should deny access if user is missing any required permission (ALL mode)', async () => {
      const context = createMockContext(mockUser);

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(['knowledge:read', 'knowledge:update']) // PERMISSIONS_KEY
        .mockReturnValueOnce(undefined) // ROLES_KEY
        .mockReturnValue(PermissionMatchMode.ALL); // PERMISSION_MATCH_MODE_KEY (always return)

      permissionService.hasAllPermissions.mockResolvedValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Access denied. Required permissions: knowledge:read and knowledge:update',
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Access denied',
        expect.objectContaining({
          type: 'permissions',
          required: ['knowledge:read', 'knowledge:update'],
          mode: PermissionMatchMode.ALL,
        }),
      );
    });
  });

  describe('Permission-Based Access (ANY mode)', () => {
    it('should allow access if user has at least one required permission', async () => {
      const context = createMockContext(mockUser);

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(['chat:read', 'knowledge:read'])
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(PermissionMatchMode.ANY);

      permissionService.hasAnyPermission.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionService.hasAnyPermission).toHaveBeenCalledWith(
        mockUser.userId,
        ['chat:read', 'knowledge:read'],
      );
    });

    it('should deny access if user has none of the required permissions (ANY mode)', async () => {
      const context = createMockContext(mockUser);

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(['chat:read', 'knowledge:read']) // PERMISSIONS_KEY
        .mockReturnValueOnce(undefined) // ROLES_KEY
        .mockReturnValue(PermissionMatchMode.ANY); // PERMISSION_MATCH_MODE_KEY (always return)

      permissionService.hasAnyPermission.mockResolvedValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Access denied. Required permissions: chat:read or knowledge:read',
      );
    });
  });

  describe('Combined Role and Permission Checks', () => {
    it('should check both roles and permissions', async () => {
      const context = createMockContext(mockUser);

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(['knowledge:read']) // PERMISSIONS_KEY
        .mockReturnValueOnce(['manager']) // ROLES_KEY
        .mockReturnValueOnce(PermissionMatchMode.ALL); // PERMISSION_MATCH_MODE_KEY

      permissionService.getUserRoles.mockResolvedValue(['manager']);
      permissionService.hasAllPermissions.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionService.getUserRoles).toHaveBeenCalled();
      expect(permissionService.hasAllPermissions).toHaveBeenCalled();
    });

    it('should deny access if role check fails even if permissions would pass', async () => {
      const context = createMockContext(mockUser);

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(['knowledge:read'])
        .mockReturnValueOnce(['admin']);

      permissionService.getUserRoles.mockResolvedValue(['user']);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      expect(permissionService.getUserRoles).toHaveBeenCalled();
      // Permission check should not be called if role check fails
      expect(permissionService.hasAllPermissions).not.toHaveBeenCalled();
    });
  });

  describe('Default Permission Mode', () => {
    it('should use ALL mode as default when mode is not specified', async () => {
      const context = createMockContext(mockUser);

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(['knowledge:read'])
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined); // No mode specified

      permissionService.hasAllPermissions.mockResolvedValue(true);

      await guard.canActivate(context);

      expect(permissionService.hasAllPermissions).toHaveBeenCalled();
      expect(permissionService.hasAnyPermission).not.toHaveBeenCalled();
    });
  });

  describe('Logging', () => {
    it('should log access granted with correct details', async () => {
      const context = createMockContext(mockUser);

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(['knowledge:read'])
        .mockReturnValueOnce(['user'])
        .mockReturnValueOnce(PermissionMatchMode.ALL);

      permissionService.getUserRoles.mockResolvedValue(['user']);
      permissionService.hasAllPermissions.mockResolvedValue(true);

      await guard.canActivate(context);

      expect(loggerLogSpy).toHaveBeenCalledWith(
        'Access granted',
        expect.objectContaining({
          userId: expect.stringContaining('...'),
          method: 'GET',
          path: '/api/test',
          roles: ['user'],
          permissions: ['knowledge:read'],
        }),
      );
    });

    it('should log access denied with correct details', async () => {
      const context = createMockContext(mockUser);

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(['admin:access'])
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(PermissionMatchMode.ALL);

      permissionService.hasAllPermissions.mockResolvedValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow();

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Access denied',
        expect.objectContaining({
          userId: expect.stringContaining('...'),
          method: 'GET',
          path: '/api/test',
          type: 'permissions',
          required: ['admin:access'],
        }),
      );
    });
  });
});

