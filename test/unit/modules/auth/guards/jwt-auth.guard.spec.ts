import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../../../../src/modules/auth/guards/jwt-auth.guard';
import { TokenRevocationService } from '../../../../../src/modules/auth/application/services/token-revocation.service';
import { ValidatedUser } from '../../../../../src/modules/auth/types/jwt-payload.type';
import { IS_PUBLIC_KEY } from '../../../../../src/modules/auth/decorators/public.decorator';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  let tokenRevocationService: TokenRevocationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        Reflector,
        {
          provide: TokenRevocationService,
          useValue: {
            isTokenRevoked: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    reflector = module.get<Reflector>(Reflector);
    tokenRevocationService = module.get<TokenRevocationService>(
      TokenRevocationService,
    );
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true for public routes without calling parent', async () => {
      // Mock ExecutionContext
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            headers: {},
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;

      // Mock reflector to return true for IS_PUBLIC_KEY
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const result = guard.canActivate(mockContext);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
      expect(result).toBe(true);
    });

    it('should call super.canActivate for protected routes', async () => {
      // Mock ExecutionContext
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            headers: {
              authorization: 'Bearer valid-token',
            },
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;

      // Mock reflector to return false (not public)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      // Mock parent's canActivate to return true
      const superSpy = jest
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      const result = guard.canActivate(mockContext);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
      expect(superSpy).toHaveBeenCalledWith(mockContext);
      expect(result).toBe(true);

      superSpy.mockRestore();
    });

    it('should call super.canActivate when IS_PUBLIC_KEY is undefined', async () => {
      // Mock ExecutionContext
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            headers: {
              authorization: 'Bearer valid-token',
            },
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;

      // Mock reflector to return undefined (no metadata)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      // Mock parent's canActivate to return true
      const superSpy = jest
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      const result = guard.canActivate(mockContext);

      expect(superSpy).toHaveBeenCalledWith(mockContext);
      expect(result).toBe(true);

      superSpy.mockRestore();
    });
  });

  describe('handleRequest', () => {
    let mockContext: ExecutionContext;

    beforeEach(() => {
      mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'GET',
            url: '/api/protected',
            ip: '127.0.0.1',
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;
    });

    it('should return user when validation succeeds', () => {
      const mockUser = {
        userId: 'user-uuid-123',
        auth0Id: 'auth0|123',
        email: 'test@example.com',
        permissions: ['read:data'],
      };

      const result = guard.handleRequest(null, mockUser, null, mockContext);

      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException when user is null', () => {
      expect(() => {
        guard.handleRequest(null, null, null, mockContext);
      }).toThrow(UnauthorizedException);

      expect(() => {
        guard.handleRequest(null, null, null, mockContext);
      }).toThrow('Unauthorized access');
    });

    it('should throw UnauthorizedException when there is an error', () => {
      const mockError = new Error('JWT validation failed');

      expect(() => {
        guard.handleRequest(mockError, null, null, mockContext);
      }).toThrow(UnauthorizedException);

      expect(() => {
        guard.handleRequest(mockError, null, null, mockContext);
      }).toThrow('JWT validation failed');
    });

    it('should throw specific error for expired token', () => {
      const mockInfo = { name: 'TokenExpiredError', message: 'jwt expired' };

      expect(() => {
        guard.handleRequest(null, null, mockInfo, mockContext);
      }).toThrow(UnauthorizedException);

      expect(() => {
        guard.handleRequest(null, null, mockInfo, mockContext);
      }).toThrow('Token has expired');
    });

    it('should throw specific error for invalid token', () => {
      const mockInfo = {
        name: 'JsonWebTokenError',
        message: 'invalid signature',
      };

      expect(() => {
        guard.handleRequest(null, null, mockInfo, mockContext);
      }).toThrow(UnauthorizedException);

      expect(() => {
        guard.handleRequest(null, null, mockInfo, mockContext);
      }).toThrow('Invalid token');
    });

    it('should throw specific error when no token is provided', () => {
      const mockInfo = { message: 'No auth token' };

      expect(() => {
        guard.handleRequest(null, null, mockInfo, mockContext);
      }).toThrow(UnauthorizedException);

      expect(() => {
        guard.handleRequest(null, null, mockInfo, mockContext);
      }).toThrow(
        'Authentication token is required. Please provide a valid JWT in the Authorization header',
      );
    });

    it('should log unauthorized access attempts', () => {
      const loggerWarnSpy = jest
        .spyOn((guard as any).logger, 'warn')
        .mockImplementation(() => {});
      const mockInfo = { message: 'Invalid token' };

      try {
        guard.handleRequest(null, null, mockInfo, mockContext);
      } catch (error) {
        // Expected to throw
      }

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Authentication failed',
        expect.objectContaining({
          method: 'GET',
          path: '/api/protected',
          errorType: 'Invalid token',
        }),
      );

      loggerWarnSpy.mockRestore();
    });

    it('should handle error with user being undefined', () => {
      expect(() => {
        guard.handleRequest(null, undefined, null, mockContext);
      }).toThrow(UnauthorizedException);
    });

    it('should prefer error message over info message', () => {
      const mockError = new Error('Custom error');
      const mockInfo = { message: 'Info message' };

      expect(() => {
        guard.handleRequest(mockError, null, mockInfo, mockContext);
      }).toThrow(UnauthorizedException);

      expect(() => {
        guard.handleRequest(mockError, null, mockInfo, mockContext);
      }).toThrow('Custom error');
    });

    describe('token revocation', () => {
      it('should return user when token is not revoked', () => {
        const mockUser: ValidatedUser = {
          userId: 'user-uuid-123',
          auth0Id: 'auth0|123',
          email: 'test@example.com',
          permissions: ['read:data'],
          jti: 'test-jti-123',
        };

        // Mock revocation service to return false (not revoked)
        jest
          .spyOn(tokenRevocationService, 'isTokenRevoked')
          .mockReturnValue(false);

        const result = guard.handleRequest(null, mockUser, null, mockContext);

        expect(result).toEqual(mockUser);
        expect(tokenRevocationService.isTokenRevoked).toHaveBeenCalledWith(
          'test-jti-123',
        );
      });

      it('should throw UnauthorizedException when token is revoked', () => {
        const mockUser: ValidatedUser = {
          userId: 'user-uuid-123',
          auth0Id: 'auth0|123',
          email: 'test@example.com',
          permissions: ['read:data'],
          jti: 'revoked-jti-123',
        };

        // Mock revocation service to return true (revoked)
        jest
          .spyOn(tokenRevocationService, 'isTokenRevoked')
          .mockReturnValue(true);

        expect(() => {
          guard.handleRequest(null, mockUser, null, mockContext);
        }).toThrow(UnauthorizedException);

        expect(() => {
          guard.handleRequest(null, mockUser, null, mockContext);
        }).toThrow('Token has been revoked. Please login again');

        expect(tokenRevocationService.isTokenRevoked).toHaveBeenCalledWith(
          'revoked-jti-123',
        );
      });

      it('should not check revocation if token has no JTI', () => {
        const mockUser: ValidatedUser = {
          userId: 'user-uuid-123',
          auth0Id: 'auth0|123',
          email: 'test@example.com',
          permissions: ['read:data'],
          // No jti field
        };

        const isRevokedSpy = jest.spyOn(
          tokenRevocationService,
          'isTokenRevoked',
        );

        const result = guard.handleRequest(null, mockUser, null, mockContext);

        expect(result).toEqual(mockUser);
        expect(isRevokedSpy).not.toHaveBeenCalled();
      });

      it('should log revoked token attempts', () => {
        const mockUser: ValidatedUser = {
          userId: 'user-uuid-123',
          auth0Id: 'auth0|123',
          email: 'test@example.com',
          permissions: ['read:data'],
          jti: 'revoked-jti-123',
        };

        // Mock revocation service to return true (revoked)
        jest
          .spyOn(tokenRevocationService, 'isTokenRevoked')
          .mockReturnValue(true);

        // Spy on logger
        const loggerWarnSpy = jest.spyOn((guard as unknown as { logger: { warn: jest.Mock } }).logger, 'warn');

        try {
          guard.handleRequest(null, mockUser, null, mockContext);
        } catch (error) {
          // Expected to throw
        }

        expect(loggerWarnSpy).toHaveBeenCalledWith(
          'Revoked token attempted to access resource',
          expect.objectContaining({
            jti: 'revoked-j...',
            userId: 'user-uui...',
          }),
        );

        loggerWarnSpy.mockRestore();
      });
    });
  });
});

