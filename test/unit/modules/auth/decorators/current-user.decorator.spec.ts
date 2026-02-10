import { CurrentUser } from '../../../../../src/modules/auth/decorators/current-user.decorator';

/**
 * CurrentUser Decorator Tests
 *
 * Note: NestJS parameter decorators created with `createParamDecorator` are
 * difficult to test in complete isolation because they rely on NestJS's
 * internal metadata and reflection system.
 *
 * These tests verify:
 * 1. The decorator can be instantiated
 * 2. The decorator returns a valid function
 * 3. The decorator has the expected NestJS structure
 *
 * Full functionality testing (extracting user from request, accessing properties)
 * is better suited for integration/E2E tests where the decorator is used
 * within a real NestJS controller context.
 */
describe('CurrentUser Decorator', () => {
  describe('Decorator Creation', () => {
    it('should be defined', () => {
      expect(CurrentUser).toBeDefined();
    });

    it('should create a parameter decorator without arguments', () => {
      const decorator = CurrentUser();
      expect(decorator).toBeDefined();
      expect(typeof decorator).toBe('function');
    });

    it('should create a parameter decorator with "auth0Id" property', () => {
      const decorator = CurrentUser('auth0Id');
      expect(decorator).toBeDefined();
      expect(typeof decorator).toBe('function');
    });

    it('should create a parameter decorator with "email" property', () => {
      const decorator = CurrentUser('email');
      expect(decorator).toBeDefined();
      expect(typeof decorator).toBe('function');
    });

    it('should create a parameter decorator with "name" property', () => {
      const decorator = CurrentUser('name');
      expect(decorator).toBeDefined();
      expect(typeof decorator).toBe('function');
    });

    it('should create a parameter decorator with "picture" property', () => {
      const decorator = CurrentUser('picture');
      expect(decorator).toBeDefined();
      expect(typeof decorator).toBe('function');
    });

    it('should create a parameter decorator with "permissions" property', () => {
      const decorator = CurrentUser('permissions');
      expect(decorator).toBeDefined();
      expect(typeof decorator).toBe('function');
    });

    it('should accept valid ValidatedUser property keys', () => {
      // Test that TypeScript compilation succeeds for valid keys
      const validKeys: Array<Parameters<typeof CurrentUser>[0]> = [
        undefined,
        'auth0Id',
        'email',
        'name',
        'picture',
        'permissions',
      ];

      validKeys.forEach((key) => {
        const decorator = CurrentUser(key);
        expect(decorator).toBeDefined();
        expect(typeof decorator).toBe('function');
      });
    });
  });

  describe('Decorator Type Safety', () => {
    it('should compile with undefined parameter', () => {
      // This tests TypeScript compilation
      const decorator = CurrentUser();
      expect(decorator).toBeDefined();
    });

    it('should compile with valid property keys', () => {
      // This tests TypeScript compilation for all valid keys
      expect(CurrentUser('auth0Id')).toBeDefined();
      expect(CurrentUser('email')).toBeDefined();
      expect(CurrentUser('name')).toBeDefined();
      expect(CurrentUser('picture')).toBeDefined();
      expect(CurrentUser('permissions')).toBeDefined();
    });
  });

  describe('Documentation', () => {
    it('should be exported for use in controllers', () => {
      // Verify the decorator is properly exported and can be imported
      expect(typeof CurrentUser).toBe('function');
    });
  });
});
