import { User } from '../../../../../../src/modules/users/domain/entities/user.entity';

describe('User Entity', () => {
  const defaultDate = new Date('2024-01-01T00:00:00Z');

  const createUser = (): User => {
    return new User({
      id: 'user-uuid-123',
      auth0UserId: 'auth0|123456',
      email: 'test@example.com',
      name: 'Test User',
      isActive: true,
      createdAt: defaultDate,
      updatedAt: defaultDate,
      lastLoginAt: defaultDate,
    });
  };

  describe('Constructor', () => {
    it('should create a user with all fields', () => {
      const user = createUser();

      expect(user.id).toBe('user-uuid-123');
      expect(user.auth0UserId).toBe('auth0|123456');
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
      expect(user.isActive).toBe(true);
      expect(user.createdAt).toEqual(defaultDate);
      expect(user.updatedAt).toEqual(defaultDate);
      expect(user.lastLoginAt).toEqual(defaultDate);
    });

    it('should use default values for optional fields', () => {
      const user = new User({
        id: 'user-uuid-123',
        auth0UserId: 'auth0|123456',
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(user.isActive).toBe(true);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
      expect(user.lastLoginAt).toBeNull();
    });

    it('should allow null lastLoginAt', () => {
      const user = new User({
        id: 'user-uuid-123',
        auth0UserId: 'auth0|123456',
        email: 'test@example.com',
        name: 'Test User',
        isActive: true,
        createdAt: defaultDate,
        updatedAt: defaultDate,
        lastLoginAt: null,
      });

      expect(user.lastLoginAt).toBeNull();
    });
  });

  describe('updateLastLogin', () => {
    it('should return a new User with updated timestamps', () => {
      const user = createUser();
      const updated = user.updateLastLogin();

      expect(updated).toBeInstanceOf(User);
      expect(updated).not.toBe(user); // Should be a new instance
      expect(updated.id).toBe(user.id);
      expect(updated.auth0UserId).toBe(user.auth0UserId);
      expect(updated.email).toBe(user.email);
      expect(updated.name).toBe(user.name);
      expect(updated.isActive).toBe(true);
      expect(updated.createdAt).toEqual(user.createdAt);
      expect(updated.updatedAt).toBeInstanceOf(Date);
      expect(updated.lastLoginAt).toBeInstanceOf(Date);
    });

    it('should not modify the original user', () => {
      const user = createUser();
      const originalLastLogin = user.lastLoginAt;

      user.updateLastLogin();

      expect(user.lastLoginAt).toBe(originalLastLogin);
    });
  });

  describe('deactivate', () => {
    it('should return a new User with isActive set to false', () => {
      const user = createUser();
      const deactivated = user.deactivate();

      expect(deactivated).toBeInstanceOf(User);
      expect(deactivated).not.toBe(user);
      expect(deactivated.isActive).toBe(false);
      expect(deactivated.id).toBe(user.id);
      expect(deactivated.auth0UserId).toBe(user.auth0UserId);
      expect(deactivated.email).toBe(user.email);
      expect(deactivated.name).toBe(user.name);
      expect(deactivated.createdAt).toEqual(user.createdAt);
      expect(deactivated.lastLoginAt).toEqual(user.lastLoginAt);
    });

    it('should update the updatedAt timestamp', () => {
      const user = createUser();
      const deactivated = user.deactivate();

      expect(deactivated.updatedAt).toBeInstanceOf(Date);
      // updatedAt should be recent (not the same as the original static date)
      expect(deactivated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        Date.now() - 1000,
      );
    });

    it('should not modify the original user', () => {
      const user = createUser();

      user.deactivate();

      expect(user.isActive).toBe(true);
    });
  });
});
