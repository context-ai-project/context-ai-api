import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser } from '../../../../../src/modules/auth/decorators/current-user.decorator';
import type { ValidatedUser } from '../../../../../src/modules/auth/types/jwt-payload.type';

/**
 * Helper to extract the factory function from a NestJS parameter decorator.
 * NestJS stores param decorators in ROUTE_ARGS_METADATA on the target class.
 */
function getParamDecoratorFactory() {
  class TestController {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    testMethod(@CurrentUser() _user: ValidatedUser): void {
      // no-op
    }
  }

  const metadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    TestController,
    'testMethod',
  );

  // The metadata is keyed by a string like "CUSTOM:paramtype:index"
  const keys = Object.keys(metadata);
  const key = keys[0];
  return metadata[key].factory;
}

describe('CurrentUser Decorator', () => {
  const mockUser: ValidatedUser = {
    auth0Id: 'auth0|123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/photo.jpg',
    permissions: ['chat:read', 'knowledge:read'],
    userId: 'user-uuid-123',
    jti: 'jwt-id-456',
  };

  const createMockContext = (user: ValidatedUser): ExecutionContext => {
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  };

  describe('Decorator Creation', () => {
    it('should be defined', () => {
      expect(CurrentUser).toBeDefined();
    });

    it('should create a parameter decorator without arguments', () => {
      const decorator = CurrentUser();
      expect(decorator).toBeDefined();
      expect(typeof decorator).toBe('function');
    });

    it('should create a parameter decorator with property key', () => {
      const decorator = CurrentUser('email');
      expect(decorator).toBeDefined();
      expect(typeof decorator).toBe('function');
    });
  });

  describe('Factory Function - Full User', () => {
    let factory: (data: string | undefined, ctx: ExecutionContext) => unknown;

    beforeEach(() => {
      factory = getParamDecoratorFactory();
    });

    it('should return the entire user when no data key is provided', () => {
      const ctx = createMockContext(mockUser);
      const result = factory(undefined, ctx);

      expect(result).toEqual(mockUser);
    });
  });

  describe('Factory Function - Property Extraction', () => {
    let factory: (data: string | undefined, ctx: ExecutionContext) => unknown;

    beforeEach(() => {
      factory = getParamDecoratorFactory();
    });

    it('should extract auth0Id property', () => {
      const ctx = createMockContext(mockUser);
      const result = factory('auth0Id', ctx);

      expect(result).toBe('auth0|123');
    });

    it('should extract email property', () => {
      const ctx = createMockContext(mockUser);
      const result = factory('email', ctx);

      expect(result).toBe('test@example.com');
    });

    it('should extract name property', () => {
      const ctx = createMockContext(mockUser);
      const result = factory('name', ctx);

      expect(result).toBe('Test User');
    });

    it('should extract picture property', () => {
      const ctx = createMockContext(mockUser);
      const result = factory('picture', ctx);

      expect(result).toBe('https://example.com/photo.jpg');
    });

    it('should extract permissions property', () => {
      const ctx = createMockContext(mockUser);
      const result = factory('permissions', ctx);

      expect(result).toEqual(['chat:read', 'knowledge:read']);
    });

    it('should extract userId property', () => {
      const ctx = createMockContext(mockUser);
      const result = factory('userId', ctx);

      expect(result).toBe('user-uuid-123');
    });

    it('should extract jti property', () => {
      const ctx = createMockContext(mockUser);
      const result = factory('jti', ctx);

      expect(result).toBe('jwt-id-456');
    });
  });

  describe('Type Safety', () => {
    it('should accept all valid ValidatedUser property keys', () => {
      const validKeys: Array<Parameters<typeof CurrentUser>[0]> = [
        undefined,
        'auth0Id',
        'email',
        'name',
        'picture',
        'permissions',
        'userId',
        'jti',
      ];

      validKeys.forEach((key) => {
        const decorator = CurrentUser(key);
        expect(decorator).toBeDefined();
        expect(typeof decorator).toBe('function');
      });
    });
  });

  describe('Export', () => {
    it('should be exported for use in controllers', () => {
      expect(typeof CurrentUser).toBe('function');
    });
  });
});
