import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '../../../../../src/modules/auth/strategies/jwt.strategy';
import { AuthService } from '../../../../../src/modules/auth/auth.service';
import { JwtPayload } from '../../../../../src/modules/auth/types/jwt-payload.type';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: AuthService;

  const mockAuthService = {
    getAuth0Domain: jest.fn().mockReturnValue('test.auth0.com'),
    getAuth0Audience: jest.fn().mockReturnValue('https://api.contextai.com'),
    getAuth0Issuer: jest.fn().mockReturnValue('https://test.auth0.com/'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should validate and return user with RBAC permissions', () => {
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

      const result = strategy.validate(payload);

      expect(result).toEqual({
        auth0Id: 'auth0|123456',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        permissions: ['read:knowledge', 'write:knowledge'],
      });
    });

    it('should validate and return user with OAuth2 scopes', () => {
      const payload: JwtPayload = {
        sub: 'auth0|123456',
        iss: 'https://test.auth0.com/',
        aud: 'https://api.contextai.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        email: 'test@example.com',
        name: 'Test User',
        scope: 'openid profile email read:knowledge',
      };

      const result = strategy.validate(payload);

      expect(result).toEqual({
        auth0Id: 'auth0|123456',
        email: 'test@example.com',
        name: 'Test User',
        picture: undefined,
        permissions: ['openid', 'profile', 'email', 'read:knowledge'],
      });
    });

    it('should validate and return user without permissions', () => {
      const payload: JwtPayload = {
        sub: 'auth0|123456',
        iss: 'https://test.auth0.com/',
        aud: 'https://api.contextai.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        email: 'test@example.com',
        name: 'Test User',
      };

      const result = strategy.validate(payload);

      expect(result).toEqual({
        auth0Id: 'auth0|123456',
        email: 'test@example.com',
        name: 'Test User',
        picture: undefined,
        permissions: [],
      });
    });

    it('should validate with minimal payload (only sub)', () => {
      const payload: JwtPayload = {
        sub: 'auth0|123456',
        iss: 'https://test.auth0.com/',
        aud: 'https://api.contextai.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const result = strategy.validate(payload);

      expect(result).toEqual({
        auth0Id: 'auth0|123456',
        email: undefined,
        name: undefined,
        picture: undefined,
        permissions: [],
      });
    });

    it('should throw UnauthorizedException when sub is missing', () => {
      const payload = {
        iss: 'https://test.auth0.com/',
        aud: 'https://api.contextai.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      } as JwtPayload;

      expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
      expect(() => strategy.validate(payload)).toThrow(
        'Invalid token: missing subject (sub) claim',
      );
    });

    it('should handle Google OAuth2 provider sub format', () => {
      const payload: JwtPayload = {
        sub: 'google-oauth2|123456789',
        iss: 'https://test.auth0.com/',
        aud: 'https://api.contextai.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        email: 'test@gmail.com',
        name: 'Google User',
        email_verified: true,
      };

      const result = strategy.validate(payload);

      expect(result.auth0Id).toBe('google-oauth2|123456789');
      expect(result.email).toBe('test@gmail.com');
    });

    it('should handle GitHub OAuth2 provider sub format', () => {
      const payload: JwtPayload = {
        sub: 'github|123456789',
        iss: 'https://test.auth0.com/',
        aud: 'https://api.contextai.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        email: 'test@github.com',
        name: 'GitHub User',
      };

      const result = strategy.validate(payload);

      expect(result.auth0Id).toBe('github|123456789');
      expect(result.email).toBe('test@github.com');
    });

    it('should prioritize RBAC permissions over OAuth2 scopes', () => {
      const payload: JwtPayload = {
        sub: 'auth0|123456',
        iss: 'https://test.auth0.com/',
        aud: 'https://api.contextai.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        permissions: ['read:knowledge', 'write:knowledge'],
        scope: 'openid profile email',
      };

      const result = strategy.validate(payload);

      // Should use RBAC permissions, not OAuth2 scopes
      expect(result.permissions).toEqual(['read:knowledge', 'write:knowledge']);
    });

    it('should handle multiple audiences in aud claim', () => {
      const payload: JwtPayload = {
        sub: 'auth0|123456',
        iss: 'https://test.auth0.com/',
        aud: ['https://api.contextai.com', 'https://other-api.com'],
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        email: 'test@example.com',
      };

      const result = strategy.validate(payload);

      expect(result.auth0Id).toBe('auth0|123456');
    });
  });

  describe('constructor', () => {
    it('should use Auth0 configuration from AuthService', () => {
      expect(authService.getAuth0Audience).toHaveBeenCalled();
      expect(authService.getAuth0Issuer).toHaveBeenCalled();
    });
  });
});

