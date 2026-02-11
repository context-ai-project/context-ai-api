import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  Controller,
  Get,
  Injectable,
  HttpCode,
  HttpStatus,
  Delete,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import request from 'supertest';
import type { App } from 'supertest/types';
import { RBACGuard } from '../../src/modules/auth/guards/rbac.guard';
import {
  Public,
  IS_PUBLIC_KEY,
} from '../../src/modules/auth/decorators/public.decorator';
import { RequirePermissions } from '../../src/modules/auth/decorators/require-permissions.decorator';
import { RequireRoles } from '../../src/modules/auth/decorators/require-roles.decorator';
import { CurrentUser } from '../../src/modules/auth/decorators/current-user.decorator';
import { PermissionService } from '../../src/modules/auth/application/services/permission.service';
import type { ValidatedUser } from '../../src/modules/auth/types/jwt-payload.type';

/**
 * E2E Tests for Authentication & Authorization (Phase 6)
 *
 * Tests the complete security pipeline:
 * 1. JWT Authentication (TestJwtAuthGuard — mocks Passport JWT)
 * 2. Token Revocation (lightweight in-memory mock)
 * 3. Role-Based Access Control (RBACGuard)
 * 4. Permission Decorators (@RequirePermissions)
 * 5. Role Decorators (@RequireRoles)
 * 6. Public Routes (@Public)
 * 7. Current User Decorator (@CurrentUser)
 *
 * Strategy:
 * - Uses a self-contained test module with mock controllers
 * - TestJwtAuthGuard is a proper @Injectable() class (injected via DI)
 * - RBACGuard is resolved normally from DI with mocked PermissionService
 * - Guards are registered globally via APP_GUARD + useExisting
 * - Tests the full HTTP pipeline: Request → Guard → Controller → Response
 *
 * Issue 6.16: E2E Tests for Auth ✅
 */

// ============================================================================
// Test Data
// ============================================================================

/**
 * Mock user for authenticated requests (regular user)
 */
const MOCK_USER: ValidatedUser = {
  userId: '11111111-1111-4111-a111-111111111111',
  auth0Id: 'auth0|test-user-123',
  email: 'test@contextai.com',
  name: 'Test User',
  permissions: ['chat:read', 'knowledge:read', 'profile:read'],
  jti: 'test-jti-abc123',
};

/**
 * Mock admin user for privileged requests
 */
const MOCK_ADMIN: ValidatedUser = {
  userId: '22222222-2222-4222-a222-222222222222',
  auth0Id: 'auth0|admin-user-456',
  email: 'admin@contextai.com',
  name: 'Admin User',
  permissions: [
    'chat:read',
    'knowledge:read',
    'knowledge:create',
    'users:manage',
    'profile:read',
  ],
  jti: 'admin-jti-def456',
};

// ============================================================================
// Token Revocation Service (lightweight test double)
// ============================================================================

/**
 * Interface for the lightweight test token revocation service.
 */
interface TokenRevocationServiceLike {
  revokeToken(jti: string, exp: number): void;
  isTokenRevoked(jti: string): boolean;
  clearAllRevokedTokens(): void;
  getRevokedTokenCount(): number;
  getStatistics(): {
    totalRevoked: number;
    oldestExpiration: Date | null;
    newestExpiration: Date | null;
  };
}

/**
 * DI token for the test token revocation service.
 * Using a string token avoids importing the real TokenRevocationService class,
 * which would pull in its real dependencies (setInterval, Logger, etc.).
 */
const TEST_TOKEN_REVOCATION = 'TEST_TOKEN_REVOCATION';

/**
 * Creates a lightweight token revocation service for E2E tests.
 * No setInterval, no Logger — pure in-memory Map.
 */
function createTestTokenRevocationService(): TokenRevocationServiceLike {
  const revokedTokens = new Map<string, number>();

  return {
    revokeToken(jti: string, exp: number): void {
      if (!jti) return;
      const expirationMs = exp * 1000;
      if (expirationMs <= Date.now()) return;
      revokedTokens.set(jti, expirationMs);
    },

    isTokenRevoked(jti: string): boolean {
      if (!jti) return false;
      const expirationMs = revokedTokens.get(jti);
      if (expirationMs === undefined) return false;
      if (expirationMs <= Date.now()) {
        revokedTokens.delete(jti);
        return false;
      }
      return true;
    },

    clearAllRevokedTokens(): void {
      revokedTokens.clear();
    },

    getRevokedTokenCount(): number {
      return revokedTokens.size;
    },

    getStatistics() {
      const expirations = Array.from(revokedTokens.values());
      return {
        totalRevoked: expirations.length,
        oldestExpiration:
          expirations.length > 0 ? new Date(Math.min(...expirations)) : null,
        newestExpiration:
          expirations.length > 0 ? new Date(Math.max(...expirations)) : null,
      };
    },
  };
}

// ============================================================================
// Test JWT Auth Guard (@Injectable — resolves via NestJS DI)
// ============================================================================

/**
 * Test JWT Auth Guard
 *
 * Proper @Injectable() guard that simulates Passport JWT validation.
 * Unlike the real JwtAuthGuard, it does NOT extend AuthGuard('jwt'),
 * so it never invokes Passport or JWKS.
 *
 * Token mapping:
 * - 'valid-token'          → MOCK_USER (regular user)
 * - 'admin-token'          → MOCK_ADMIN (admin user)
 * - 'no-permissions-token' → User with no permissions
 * - 'expired-token'        → 401 Token expired
 * - 'invalid-token'        → 401 Invalid token
 * - 'revoked-token'        → 401 Token revoked
 * - Any other token        → 401 Unauthorized
 */
@Injectable()
class TestJwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TEST_TOKEN_REVOCATION)
    private readonly tokenRevocationService: TokenRevocationServiceLike,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is marked as @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Extract Authorization header
    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: ValidatedUser;
    }>();
    const authHeader = req.headers.authorization;

    // No header or wrong format → 401
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Authentication token is required. Please provide a valid JWT in the Authorization header',
      );
    }

    // Extract token value
    const token = authHeader.substring('Bearer '.length);

    // Empty token value → 401
    if (!token) {
      throw new UnauthorizedException(
        'Authentication token is required. Please provide a valid JWT in the Authorization header',
      );
    }

    // Simulate different token scenarios
    if (token === 'expired-token') {
      throw new UnauthorizedException('Token has expired');
    }

    if (token === 'invalid-token') {
      throw new UnauthorizedException('Invalid token');
    }

    if (token === 'revoked-token') {
      throw new UnauthorizedException(
        'Token has been revoked. Please login again',
      );
    }

    // Valid user token
    if (token === 'valid-token') {
      const mockUser = { ...MOCK_USER };
      if (
        mockUser.jti &&
        this.tokenRevocationService.isTokenRevoked(mockUser.jti)
      ) {
        throw new UnauthorizedException(
          'Token has been revoked. Please login again',
        );
      }
      req.user = mockUser;
      return true;
    }

    // Admin token
    if (token === 'admin-token') {
      const mockAdmin = { ...MOCK_ADMIN };
      if (
        mockAdmin.jti &&
        this.tokenRevocationService.isTokenRevoked(mockAdmin.jti)
      ) {
        throw new UnauthorizedException(
          'Token has been revoked. Please login again',
        );
      }
      req.user = mockAdmin;
      return true;
    }

    // User with no permissions
    if (token === 'no-permissions-token') {
      req.user = {
        userId: '33333333-3333-4333-a333-333333333333',
        auth0Id: 'auth0|no-perms-789',
        email: 'noperms@contextai.com',
        name: 'No Permissions User',
        permissions: [],
        jti: 'noperms-jti-ghi789',
      };
      return true;
    }

    // Unknown token → 401
    throw new UnauthorizedException('Unauthorized access');
  }
}

// ============================================================================
// Test Controllers
// ============================================================================

/**
 * Test controller with various auth scenarios.
 * Guards are applied globally via APP_GUARD.
 */
@Controller('test-auth')
class TestAuthController {
  @Public()
  @Get('public')
  @HttpCode(HttpStatus.OK)
  getPublicResource(): { message: string } {
    return { message: 'Public resource accessible' };
  }

  @Get('protected')
  @HttpCode(HttpStatus.OK)
  getProtectedResource(): { message: string } {
    return { message: 'Protected resource accessible' };
  }

  @Get('profile')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['profile:read'])
  getProfile(@CurrentUser() user: ValidatedUser): {
    message: string;
    userId: string;
    email: string | undefined;
  } {
    return {
      message: 'Profile retrieved',
      userId: user.userId,
      email: user.email,
    };
  }

  @Get('knowledge')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['knowledge:read'])
  getKnowledge(): { message: string } {
    return { message: 'Knowledge accessible' };
  }

  @Get('knowledge-create')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['knowledge:create'])
  createKnowledge(): { message: string } {
    return { message: 'Knowledge created' };
  }

  @Get('admin-only')
  @HttpCode(HttpStatus.OK)
  @RequireRoles('admin')
  getAdminResource(): { message: string } {
    return { message: 'Admin resource accessible' };
  }

  @Get('manager-or-admin')
  @HttpCode(HttpStatus.OK)
  @RequireRoles('admin', 'manager')
  getManagerResource(): { message: string } {
    return { message: 'Manager resource accessible' };
  }

  @Delete('danger-zone')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['users:manage'])
  @RequireRoles('admin')
  dangerZone(): { message: string } {
    return { message: 'Danger zone accessed' };
  }
}

// ============================================================================
// E2E Test Suite
// ============================================================================

describe('Authentication & Authorization E2E Tests (Phase 6)', () => {
  let app: INestApplication<App>;
  let tokenRevocationService: TokenRevocationServiceLike;
  let permissionService: PermissionService;

  beforeAll(async () => {
    // Create lightweight token revocation service (no setInterval)
    tokenRevocationService = createTestTokenRevocationService();

    // Create mocked PermissionService
    permissionService = {
      getUserRoles: jest.fn(),
      getUserPermissions: jest.fn(),
      hasPermission: jest.fn(),
      hasAnyPermission: jest.fn(),
      hasAllPermissions: jest.fn(),
      hasRole: jest.fn(),
      isAdmin: jest.fn(),
      isManager: jest.fn(),
      isUser: jest.fn(),
    } as unknown as PermissionService;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestAuthController],
      providers: [
        // Provide the test token revocation service via string token
        {
          provide: TEST_TOKEN_REVOCATION,
          useValue: tokenRevocationService,
        },
        // Provide mocked PermissionService
        {
          provide: PermissionService,
          useValue: permissionService,
        },
        // Register the guards as providers (NestJS creates via DI)
        TestJwtAuthGuard,
        RBACGuard,
        // Apply guards globally via APP_GUARD (execution order = registration order)
        // 1. JWT Authentication — validates tokens (no Passport dependency)
        {
          provide: APP_GUARD,
          useExisting: TestJwtAuthGuard,
        },
        // 2. RBAC Authorization — checks permissions/roles
        {
          provide: APP_GUARD,
          useExisting: RBACGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
    tokenRevocationService.clearAllRevokedTokens();
  });

  // ==========================================================================
  // 1. Public Routes
  // ==========================================================================
  describe('Public Routes (@Public decorator)', () => {
    it('should allow access to public routes without token', async () => {
      const response = await request(app.getHttpServer())
        .get('/test-auth/public')
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({ message: 'Public resource accessible' });
    });

    it('should allow access to public routes with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/test-auth/public')
        .set('Authorization', 'Bearer valid-token')
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({ message: 'Public resource accessible' });
    });

    it('should allow access to public routes with invalid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/test-auth/public')
        .set('Authorization', 'Bearer invalid-token')
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({ message: 'Public resource accessible' });
    });
  });

  // ==========================================================================
  // 2. JWT Authentication
  // ==========================================================================
  describe('JWT Authentication (JwtAuthGuard)', () => {
    it('should return 401 when no token is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/test-auth/protected')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.message).toContain(
        'Authentication token is required',
      );
    });

    it('should return 401 when token format is invalid (no Bearer prefix)', async () => {
      const response = await request(app.getHttpServer())
        .get('/test-auth/protected')
        .set('Authorization', 'InvalidFormat token-here')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.message).toContain(
        'Authentication token is required',
      );
    });

    it('should return 401 when token is expired', async () => {
      const response = await request(app.getHttpServer())
        .get('/test-auth/protected')
        .set('Authorization', 'Bearer expired-token')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.message).toBe('Token has expired');
    });

    it('should return 401 when token is invalid', async () => {
      const response = await request(app.getHttpServer())
        .get('/test-auth/protected')
        .set('Authorization', 'Bearer invalid-token')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.message).toBe('Invalid token');
    });

    it('should return 401 when token is explicitly revoked', async () => {
      const response = await request(app.getHttpServer())
        .get('/test-auth/protected')
        .set('Authorization', 'Bearer revoked-token')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.message).toBe(
        'Token has been revoked. Please login again',
      );
    });

    it('should return 200 when valid token is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/test-auth/protected')
        .set('Authorization', 'Bearer valid-token')
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({
        message: 'Protected resource accessible',
      });
    });

    it('should return 401 when unknown token format is used', async () => {
      const response = await request(app.getHttpServer())
        .get('/test-auth/protected')
        .set('Authorization', 'Bearer unknown-format-token')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.message).toBe('Unauthorized access');
    });
  });

  // ==========================================================================
  // 3. Token Revocation
  // ==========================================================================
  describe('Token Revocation', () => {
    it('should deny access after token is revoked', async () => {
      // First, verify the token works
      await request(app.getHttpServer())
        .get('/test-auth/protected')
        .set('Authorization', 'Bearer valid-token')
        .expect(HttpStatus.OK);

      // Revoke the token (exp = 1 hour from now)
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      tokenRevocationService.revokeToken(MOCK_USER.jti!, futureExp);

      // Now the token should be rejected
      const response = await request(app.getHttpServer())
        .get('/test-auth/protected')
        .set('Authorization', 'Bearer valid-token')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.message).toBe(
        'Token has been revoked. Please login again',
      );
    });

    it('should allow access after revoked token is cleared', async () => {
      // Revoke and then clear
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      tokenRevocationService.revokeToken(MOCK_USER.jti!, futureExp);

      // Verify it's revoked
      expect(tokenRevocationService.isTokenRevoked(MOCK_USER.jti!)).toBe(true);

      // Clear all revoked tokens
      tokenRevocationService.clearAllRevokedTokens();

      // Now the token should work again
      await request(app.getHttpServer())
        .get('/test-auth/protected')
        .set('Authorization', 'Bearer valid-token')
        .expect(HttpStatus.OK);
    });

    it('should track revocation count', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;

      expect(tokenRevocationService.getRevokedTokenCount()).toBe(0);

      tokenRevocationService.revokeToken('jti-1', futureExp);
      expect(tokenRevocationService.getRevokedTokenCount()).toBe(1);

      tokenRevocationService.revokeToken('jti-2', futureExp);
      expect(tokenRevocationService.getRevokedTokenCount()).toBe(2);

      tokenRevocationService.clearAllRevokedTokens();
      expect(tokenRevocationService.getRevokedTokenCount()).toBe(0);
    });

    it('should not revoke tokens that are already expired', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      tokenRevocationService.revokeToken('expired-jti', pastExp);

      expect(tokenRevocationService.isTokenRevoked('expired-jti')).toBe(false);
      expect(tokenRevocationService.getRevokedTokenCount()).toBe(0);
    });
  });

  // ==========================================================================
  // 4. Permission-Based Access Control (RBAC)
  // ==========================================================================
  describe('Permission-Based Access Control (@RequirePermissions)', () => {
    beforeEach(() => {
      // Default: allow all permission checks
      (permissionService.hasAllPermissions as jest.Mock).mockResolvedValue(
        true,
      );
      (permissionService.hasAnyPermission as jest.Mock).mockResolvedValue(true);
      (permissionService.getUserRoles as jest.Mock).mockResolvedValue(['user']);
    });

    it('should allow access when user has required permissions', async () => {
      (permissionService.hasAllPermissions as jest.Mock).mockResolvedValue(
        true,
      );

      const response = await request(app.getHttpServer())
        .get('/test-auth/knowledge')
        .set('Authorization', 'Bearer valid-token')
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({ message: 'Knowledge accessible' });
    });

    it('should deny access (403) when user lacks required permissions', async () => {
      (permissionService.hasAllPermissions as jest.Mock).mockResolvedValue(
        false,
      );

      const response = await request(app.getHttpServer())
        .get('/test-auth/knowledge')
        .set('Authorization', 'Bearer valid-token')
        .expect(HttpStatus.FORBIDDEN);

      expect(response.body.message).toContain('Access denied');
      expect(response.body.message).toContain('permission');
    });

    it('should deny access for user with no permissions', async () => {
      (permissionService.hasAllPermissions as jest.Mock).mockResolvedValue(
        false,
      );

      const response = await request(app.getHttpServer())
        .get('/test-auth/knowledge')
        .set('Authorization', 'Bearer no-permissions-token')
        .expect(HttpStatus.FORBIDDEN);

      expect(response.body.message).toContain('Access denied');
    });

    it('should deny knowledge:create to regular user', async () => {
      (permissionService.hasAllPermissions as jest.Mock).mockResolvedValue(
        false,
      );

      const response = await request(app.getHttpServer())
        .get('/test-auth/knowledge-create')
        .set('Authorization', 'Bearer valid-token')
        .expect(HttpStatus.FORBIDDEN);

      expect(response.body.message).toContain('knowledge:create');
    });

    it('should allow knowledge:create to admin user', async () => {
      (permissionService.hasAllPermissions as jest.Mock).mockResolvedValue(
        true,
      );

      const response = await request(app.getHttpServer())
        .get('/test-auth/knowledge-create')
        .set('Authorization', 'Bearer admin-token')
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({ message: 'Knowledge created' });
    });
  });

  // ==========================================================================
  // 5. Role-Based Access Control
  // ==========================================================================
  describe('Role-Based Access Control (@RequireRoles)', () => {
    beforeEach(() => {
      (permissionService.hasAllPermissions as jest.Mock).mockResolvedValue(
        true,
      );
      (permissionService.hasAnyPermission as jest.Mock).mockResolvedValue(true);
    });

    it('should deny access when user does not have required role', async () => {
      (permissionService.getUserRoles as jest.Mock).mockResolvedValue(['user']);

      const response = await request(app.getHttpServer())
        .get('/test-auth/admin-only')
        .set('Authorization', 'Bearer valid-token')
        .expect(HttpStatus.FORBIDDEN);

      expect(response.body.message).toContain('Access denied');
      expect(response.body.message).toContain('role');
    });

    it('should allow access when user has admin role', async () => {
      (permissionService.getUserRoles as jest.Mock).mockResolvedValue([
        'admin',
      ]);

      const response = await request(app.getHttpServer())
        .get('/test-auth/admin-only')
        .set('Authorization', 'Bearer admin-token')
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({ message: 'Admin resource accessible' });
    });

    it('should allow access when user has one of multiple required roles', async () => {
      (permissionService.getUserRoles as jest.Mock).mockResolvedValue([
        'manager',
      ]);

      const response = await request(app.getHttpServer())
        .get('/test-auth/manager-or-admin')
        .set('Authorization', 'Bearer admin-token')
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({
        message: 'Manager resource accessible',
      });
    });

    it('should deny access when user has neither required role', async () => {
      (permissionService.getUserRoles as jest.Mock).mockResolvedValue(['user']);

      const response = await request(app.getHttpServer())
        .get('/test-auth/manager-or-admin')
        .set('Authorization', 'Bearer valid-token')
        .expect(HttpStatus.FORBIDDEN);

      expect(response.body.message).toContain('role');
    });
  });

  // ==========================================================================
  // 6. Combined Role + Permission Guards
  // ==========================================================================
  describe('Combined Role + Permission Guards', () => {
    it('should require both role AND permission for danger zone', async () => {
      (permissionService.getUserRoles as jest.Mock).mockResolvedValue([
        'admin',
      ]);
      (permissionService.hasAllPermissions as jest.Mock).mockResolvedValue(
        true,
      );

      const response = await request(app.getHttpServer())
        .delete('/test-auth/danger-zone')
        .set('Authorization', 'Bearer admin-token')
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({ message: 'Danger zone accessed' });
    });

    it('should deny if has role but not permission', async () => {
      (permissionService.getUserRoles as jest.Mock).mockResolvedValue([
        'admin',
      ]);
      (permissionService.hasAllPermissions as jest.Mock).mockResolvedValue(
        false,
      );

      const response = await request(app.getHttpServer())
        .delete('/test-auth/danger-zone')
        .set('Authorization', 'Bearer admin-token')
        .expect(HttpStatus.FORBIDDEN);

      expect(response.body.message).toContain('Access denied');
    });

    it('should deny if has permission but not role', async () => {
      (permissionService.getUserRoles as jest.Mock).mockResolvedValue(['user']);
      (permissionService.hasAllPermissions as jest.Mock).mockResolvedValue(
        true,
      );

      const response = await request(app.getHttpServer())
        .delete('/test-auth/danger-zone')
        .set('Authorization', 'Bearer valid-token')
        .expect(HttpStatus.FORBIDDEN);

      expect(response.body.message).toContain('role');
    });
  });

  // ==========================================================================
  // 7. @CurrentUser Decorator
  // ==========================================================================
  describe('@CurrentUser Decorator', () => {
    beforeEach(() => {
      (permissionService.hasAllPermissions as jest.Mock).mockResolvedValue(
        true,
      );
      (permissionService.getUserRoles as jest.Mock).mockResolvedValue(['user']);
    });

    it('should inject current user into controller method', async () => {
      const response = await request(app.getHttpServer())
        .get('/test-auth/profile')
        .set('Authorization', 'Bearer valid-token')
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({
        message: 'Profile retrieved',
        userId: MOCK_USER.userId,
        email: MOCK_USER.email,
      });
    });

    it('should inject admin user when admin token is used', async () => {
      (permissionService.getUserRoles as jest.Mock).mockResolvedValue([
        'admin',
      ]);

      const response = await request(app.getHttpServer())
        .get('/test-auth/profile')
        .set('Authorization', 'Bearer admin-token')
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({
        message: 'Profile retrieved',
        userId: MOCK_ADMIN.userId,
        email: MOCK_ADMIN.email,
      });
    });
  });

  // ==========================================================================
  // 8. Security Edge Cases
  // ==========================================================================
  describe('Security Edge Cases', () => {
    it('should return 401 for empty Authorization header', async () => {
      const response = await request(app.getHttpServer())
        .get('/test-auth/protected')
        .set('Authorization', '')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.message).toContain(
        'Authentication token is required',
      );
    });

    it('should return 401 for Bearer with no token value', async () => {
      const response = await request(app.getHttpServer())
        .get('/test-auth/protected')
        .set('Authorization', 'Bearer ')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.statusCode).toBe(401);
    });

    it('should return 404 for non-existent routes', async () => {
      await request(app.getHttpServer())
        .get('/test-auth/nonexistent')
        .set('Authorization', 'Bearer valid-token')
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should protect all HTTP methods (GET)', async () => {
      await request(app.getHttpServer())
        .get('/test-auth/protected')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should protect all HTTP methods (DELETE)', async () => {
      await request(app.getHttpServer())
        .delete('/test-auth/danger-zone')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should handle multiple rapid authenticated requests', async () => {
      (permissionService.hasAllPermissions as jest.Mock).mockResolvedValue(
        true,
      );
      (permissionService.getUserRoles as jest.Mock).mockResolvedValue(['user']);

      // Send 5 sequential requests to verify auth works consistently
      const requestCount = 5;
      for (let i = 0; i < requestCount; i++) {
        const response = await request(app.getHttpServer())
          .get('/test-auth/protected')
          .set('Authorization', 'Bearer valid-token');

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toEqual({
          message: 'Protected resource accessible',
        });
      }
    });
  });

  // ==========================================================================
  // 9. TokenRevocationService Unit Integration
  // ==========================================================================
  describe('TokenRevocationService Integration', () => {
    it('should provide statistics about revoked tokens', () => {
      const stats = tokenRevocationService.getStatistics();
      expect(stats.totalRevoked).toBe(0);
      expect(stats.oldestExpiration).toBeNull();
      expect(stats.newestExpiration).toBeNull();
    });

    it('should update statistics after token revocation', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;

      tokenRevocationService.revokeToken('test-jti-1', futureExp);
      tokenRevocationService.revokeToken('test-jti-2', futureExp + 1800);

      const stats = tokenRevocationService.getStatistics();
      expect(stats.totalRevoked).toBe(2);
      expect(stats.oldestExpiration).not.toBeNull();
      expect(stats.newestExpiration).not.toBeNull();
    });

    it('should ignore revocation of empty JTI', () => {
      tokenRevocationService.revokeToken('', 9999999999);
      expect(tokenRevocationService.getRevokedTokenCount()).toBe(0);
    });

    it('should return false for non-revoked JTI', () => {
      expect(tokenRevocationService.isTokenRevoked('nonexistent-jti')).toBe(
        false,
      );
    });

    it('should return false for empty JTI check', () => {
      expect(tokenRevocationService.isTokenRevoked('')).toBe(false);
    });
  });

  // ==========================================================================
  // 10. Response Format Validation
  // ==========================================================================
  describe('Response Format Validation', () => {
    it('should return proper JSON for successful auth', async () => {
      const response = await request(app.getHttpServer())
        .get('/test-auth/public')
        .expect('Content-Type', /json/)
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('message');
    });

    it('should return proper error format for 401', async () => {
      const response = await request(app.getHttpServer())
        .get('/test-auth/protected')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body).toHaveProperty('statusCode', 401);
      expect(response.body).toHaveProperty('message');
    });

    it('should return proper error format for 403', async () => {
      (permissionService.hasAllPermissions as jest.Mock).mockResolvedValue(
        false,
      );
      (permissionService.getUserRoles as jest.Mock).mockResolvedValue(['user']);

      const response = await request(app.getHttpServer())
        .get('/test-auth/knowledge')
        .set('Authorization', 'Bearer valid-token')
        .expect(HttpStatus.FORBIDDEN);

      expect(response.body).toHaveProperty('statusCode', 403);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error', 'Forbidden');
    });
  });
});
