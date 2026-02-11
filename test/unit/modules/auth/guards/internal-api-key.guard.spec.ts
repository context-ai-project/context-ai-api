import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { InternalApiKeyGuard } from '../../../../../src/modules/auth/guards/internal-api-key.guard';

describe('InternalApiKeyGuard', () => {
  const VALID_API_KEY = 'test-internal-api-key-secret-123';
  let guard: InternalApiKeyGuard;
  let loggerWarnSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  const createMockContext = (
    headers: Record<string, string | undefined> = {},
  ): ExecutionContext => {
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers,
          method: 'POST',
          url: '/api/v1/users/sync',
          ip: '127.0.0.1',
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'auth.internalApiKey') {
          return VALID_API_KEY;
        }
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalApiKeyGuard,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    guard = module.get<InternalApiKeyGuard>(InternalApiKeyGuard);

    // Mock logger to avoid console output
    loggerWarnSpy = jest
      .spyOn(guard['logger'], 'warn')
      .mockImplementation();
    loggerErrorSpy = jest
      .spyOn(guard['logger'], 'error')
      .mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    loggerWarnSpy?.mockRestore();
    loggerErrorSpy?.mockRestore();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('Valid API Key', () => {
    it('should allow access with a valid API key', () => {
      const context = createMockContext({
        'x-internal-api-key': VALID_API_KEY,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when API key is the exact match', () => {
      const context = createMockContext({
        'x-internal-api-key': VALID_API_KEY,
        'content-type': 'application/json',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('Missing API Key', () => {
    it('should throw UnauthorizedException when header is missing', () => {
      const context = createMockContext({});

      expect(() => guard.canActivate(context)).toThrow(
        UnauthorizedException,
      );
      expect(() => guard.canActivate(context)).toThrow(
        'Internal API key is required',
      );
    });

    it('should log warning when API key is missing', () => {
      const context = createMockContext({});

      try {
        guard.canActivate(context);
      } catch {
        // expected
      }

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Missing internal API key',
        expect.objectContaining({
          method: 'POST',
          path: '/api/v1/users/sync',
        }),
      );
    });

    it('should throw UnauthorizedException when header value is undefined', () => {
      const context = createMockContext({
        'x-internal-api-key': undefined,
      });

      expect(() => guard.canActivate(context)).toThrow(
        'Internal API key is required',
      );
    });
  });

  describe('Invalid API Key', () => {
    it('should throw UnauthorizedException when API key is wrong', () => {
      const context = createMockContext({
        'x-internal-api-key': 'wrong-api-key',
      });

      expect(() => guard.canActivate(context)).toThrow(
        UnauthorizedException,
      );
      expect(() => guard.canActivate(context)).toThrow(
        'Invalid internal API key',
      );
    });

    it('should log warning when API key is invalid', () => {
      const context = createMockContext({
        'x-internal-api-key': 'wrong-api-key',
      });

      try {
        guard.canActivate(context);
      } catch {
        // expected
      }

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Invalid internal API key',
        expect.objectContaining({
          method: 'POST',
          path: '/api/v1/users/sync',
          ip: '127.0.0.1',
        }),
      );
    });

    it('should reject API key with different length', () => {
      const context = createMockContext({
        'x-internal-api-key': 'short',
      });

      expect(() => guard.canActivate(context)).toThrow(
        'Invalid internal API key',
      );
    });

    it('should reject API key with extra characters', () => {
      const context = createMockContext({
        'x-internal-api-key': VALID_API_KEY + '-extra',
      });

      expect(() => guard.canActivate(context)).toThrow(
        'Invalid internal API key',
      );
    });

    it('should reject empty string API key', () => {
      const context = createMockContext({
        'x-internal-api-key': '',
      });

      expect(() => guard.canActivate(context)).toThrow(
        'Internal API key is required',
      );
    });
  });

  describe('Unconfigured API Key', () => {
    it('should throw UnauthorizedException when INTERNAL_API_KEY is not configured', async () => {
      const mockConfigService = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          InternalApiKeyGuard,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const unconfiguredGuard =
        module.get<InternalApiKeyGuard>(InternalApiKeyGuard);

      const context = createMockContext({
        'x-internal-api-key': 'some-key',
      });

      expect(() => unconfiguredGuard.canActivate(context)).toThrow(
        UnauthorizedException,
      );
      expect(() => unconfiguredGuard.canActivate(context)).toThrow(
        'Internal API key not configured',
      );
    });
  });

  describe('Timing Safety', () => {
    it('should use constant-time comparison (timingSafeEqual method exists)', () => {
      // Verify the private method exists on the guard
      expect(typeof guard['timingSafeEqual']).toBe('function');
    });

    it('timingSafeEqual should return true for identical strings', () => {
      const result = guard['timingSafeEqual']('test123', 'test123');
      expect(result).toBe(true);
    });

    it('timingSafeEqual should return false for different strings of same length', () => {
      const result = guard['timingSafeEqual']('test123', 'test456');
      expect(result).toBe(false);
    });

    it('timingSafeEqual should return false for strings of different length', () => {
      const result = guard['timingSafeEqual']('short', 'much-longer-string');
      expect(result).toBe(false);
    });

    it('timingSafeEqual should return true for empty strings', () => {
      const result = guard['timingSafeEqual']('', '');
      expect(result).toBe(true);
    });
  });

  describe('URL Path Sanitization', () => {
    it('should strip query parameters from URL in log', () => {
      const context = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            headers: {},
            method: 'POST',
            url: '/api/v1/users/sync?token=secret',
            ip: '127.0.0.1',
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;

      try {
        guard.canActivate(context);
      } catch {
        // expected
      }

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Missing internal API key',
        expect.objectContaining({
          path: '/api/v1/users/sync',
        }),
      );
    });
  });
});

