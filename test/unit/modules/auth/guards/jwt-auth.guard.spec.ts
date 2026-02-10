import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../../src/modules/auth/guards/jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtAuthGuard],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should call super.canActivate', async () => {
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
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;
    });

    it('should return user when validation succeeds', () => {
      const mockUser = {
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
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      const mockInfo = { message: 'Invalid token' };

      try {
        guard.handleRequest(null, null, mockInfo, mockContext);
      } catch (error) {
        // Expected to throw
      }

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[JwtAuthGuard] Unauthorized access attempt: GET /api/protected',
        expect.objectContaining({
          info: 'Invalid token',
        }),
      );

      consoleWarnSpy.mockRestore();
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
  });
});

