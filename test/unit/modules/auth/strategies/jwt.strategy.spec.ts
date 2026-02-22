import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '../../../../../src/modules/auth/strategies/jwt.strategy';
import { AuthService } from '../../../../../src/modules/auth/auth.service';
import { UserService } from '../../../../../src/modules/users/application/services/user.service';
import { JwtPayload } from '../../../../../src/modules/auth/types/jwt-payload.type';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: AuthService;
  let userService: UserService;

  const mockAuthService = {
    getAuth0Config: jest.fn().mockReturnValue({
      domain: 'test.auth0.com',
      audience: 'https://api.contextai.com',
      issuer: 'https://test.auth0.com/',
    }),
  };

  const mockUserService = {
    syncUser: jest.fn().mockResolvedValue({
      id: 'user-uuid-123',
      auth0UserId: 'auth0|123456',
      email: 'test@example.com',
      name: 'Test User',
      isActive: true,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    }),
    findByAuth0UserId: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    authService = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should validate and return user with RBAC permissions', async () => {
      const payload: JwtPayload = {
        sub: 'auth0|123456',
        iss: 'https://test.auth0.com/',
        aud: 'https://api.contextai.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        permissions: ['read:knowledge', 'write:knowledge'],
      };

      const result = await strategy.validate(payload);

      // Verify user sync was called
      expect(userService.syncUser).toHaveBeenCalledWith({
        auth0UserId: 'auth0|123456',
        email: 'test@example.com',
        name: 'Test User',
      });

      // Verify result includes userId from sync
      // Permissions are normalized from action:resource → resource:action
      expect(result).toEqual({
        userId: 'user-uuid-123',
        auth0Id: 'auth0|123456',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        permissions: ['knowledge:read', 'knowledge:write'],
      });
    });

    it('should validate and return user with OAuth2 scopes', async () => {
      const payload: JwtPayload = {
        sub: 'auth0|789',
        iss: 'https://test.auth0.com/',
        aud: 'https://api.contextai.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        email: 'scope@example.com',
        scope: 'openid profile email read:data',
      };

      const result = await strategy.validate(payload);

      expect(userService.syncUser).toHaveBeenCalledWith({
        auth0UserId: 'auth0|789',
        email: 'scope@example.com',
        name: 'scope',
      });

      expect(result).toEqual({
        userId: 'user-uuid-123',
        auth0Id: 'auth0|789',
        email: 'scope@example.com',
        name: undefined,
        picture: undefined,
        permissions: ['openid', 'profile', 'email', 'data:read'],
      });
    });

    it('should validate and return user without permissions', async () => {
      const payload: JwtPayload = {
        sub: 'auth0|no-perms',
        iss: 'https://test.auth0.com/',
        aud: 'https://api.contextai.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        email: 'no-perms@example.com',
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: 'user-uuid-123',
        auth0Id: 'auth0|no-perms',
        email: 'no-perms@example.com',
        name: undefined,
        picture: undefined,
        permissions: [],
      });
    });

    it('should validate with minimal payload (only sub and email)', async () => {
      const payload: JwtPayload = {
        sub: 'auth0|minimal',
        email: 'minimal@example.com',
        iss: 'https://test.auth0.com/',
        aud: 'https://api.contextai.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: 'user-uuid-123',
        auth0Id: 'auth0|minimal',
        email: 'minimal@example.com',
        name: undefined,
        picture: undefined,
        permissions: [],
      });
    });

    it('should throw UnauthorizedException when sub is missing', async () => {
      const payload = {
        iss: 'https://test.auth0.com/',
        aud: 'https://api.contextai.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        email: 'missing-sub@example.com',
      } as JwtPayload;

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate(payload)).rejects.toThrow(
        'Invalid token: missing subject (sub) claim',
      );
    });

    it('should resolve user from database when email is missing from token', async () => {
      mockUserService.findByAuth0UserId.mockResolvedValueOnce({
        id: 'db-user-uuid',
        auth0UserId: 'auth0|no-email',
        email: 'db-user@example.com',
        name: 'DB User',
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      });

      const payload = {
        sub: 'auth0|no-email',
        iss: 'https://test.auth0.com/',
        aud: 'https://api.contextai.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      } as JwtPayload;

      const result = await strategy.validate(payload);

      expect(mockUserService.findByAuth0UserId).toHaveBeenCalledWith(
        'auth0|no-email',
      );
      expect(result).toEqual({
        userId: 'db-user-uuid',
        auth0Id: 'auth0|no-email',
        email: 'db-user@example.com',
        name: 'DB User',
        picture: undefined,
        permissions: [],
      });
    });

    it('should throw UnauthorizedException when email is missing and user not in database', async () => {
      mockUserService.findByAuth0UserId.mockResolvedValueOnce(null);

      const payload = {
        sub: 'auth0|no-email-no-db',
        iss: 'https://test.auth0.com/',
        aud: 'https://api.contextai.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      } as JwtPayload;

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate(payload)).rejects.toThrow(
        'User not found. Please login again to sync your profile.',
      );
    });

    it('should handle Google OAuth2 provider sub format', async () => {
      const payload: JwtPayload = {
        sub: 'google-oauth2|1234567890',
        email: 'google@example.com',
        name: 'Google User',
        picture: 'https://lh3.googleusercontent.com/avatar.jpg',
        iss: 'https://test.auth0.com/',
        aud: 'https://api.contextai.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      mockUserService.syncUser.mockResolvedValueOnce({
        id: 'google-user-uuid',
        auth0UserId: 'google-oauth2|1234567890',
        email: 'google@example.com',
        name: 'Google User',
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      });

      const result = await strategy.validate(payload);

      expect(result.userId).toBe('google-user-uuid');
      expect(result.auth0Id).toBe('google-oauth2|1234567890');
    });

    it('should handle GitHub OAuth2 provider sub format', async () => {
      const payload: JwtPayload = {
        sub: 'github|9876543',
        email: 'github@example.com',
        name: 'GitHub User',
        iss: 'https://test.auth0.com/',
        aud: 'https://api.contextai.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      mockUserService.syncUser.mockResolvedValueOnce({
        id: 'github-user-uuid',
        auth0UserId: 'github|9876543',
        email: 'github@example.com',
        name: 'GitHub User',
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      });

      const result = await strategy.validate(payload);

      expect(result.userId).toBe('github-user-uuid');
      expect(result.auth0Id).toBe('github|9876543');
    });

    it('should prioritize RBAC permissions over OAuth2 scopes', async () => {
      const payload: JwtPayload = {
        sub: 'auth0|both',
        email: 'both@example.com',
        iss: 'https://test.auth0.com/',
        aud: 'https://api.contextai.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        permissions: ['read:all', 'write:all'],
        scope: 'openid profile',
      };

      const result = await strategy.validate(payload);

      // Permissions are normalized from action:resource → resource:action
      expect(result.permissions).toEqual(['all:read', 'all:write']);
    });

    it('should handle multiple audiences in aud claim', async () => {
      const payload: JwtPayload = {
        sub: 'auth0|multi-aud',
        email: 'multi@example.com',
        iss: 'https://test.auth0.com/',
        aud: ['https://api.contextai.com', 'https://other-api.com'],
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const result = await strategy.validate(payload);

      expect(result.auth0Id).toBe('auth0|multi-aud');
    });

    it('should use email username as fallback name', async () => {
      const payload: JwtPayload = {
        sub: 'auth0|no-name',
        email: 'johndoe@example.com',
        iss: 'https://test.auth0.com/',
        aud: 'https://api.contextai.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      await strategy.validate(payload);

      expect(userService.syncUser).toHaveBeenCalledWith({
        auth0UserId: 'auth0|no-name',
        email: 'johndoe@example.com',
        name: 'johndoe',
      });
    });
  });

  describe('constructor', () => {
    it('should use Auth0 configuration from AuthService', () => {
      expect(authService.getAuth0Config).toHaveBeenCalled();
    });
  });
});
