import { Role } from '../../../../../src/modules/auth/domain/entities/role.entity';

describe('Role Entity', () => {
  const mockId = 'role-uuid-123';
  const mockCreatedAt = new Date('2026-01-01');
  const mockUpdatedAt = new Date('2026-01-02');

  describe('Constructor', () => {
    it('should create a role with all properties', () => {
      const role = new Role(
        mockId,
        'admin',
        'Administrator role',
        true,
        mockCreatedAt,
        mockUpdatedAt,
      );

      expect(role.id).toBe(mockId);
      expect(role.name).toBe('admin');
      expect(role.description).toBe('Administrator role');
      expect(role.isSystemRole).toBe(true);
      expect(role.createdAt).toBe(mockCreatedAt);
      expect(role.updatedAt).toBe(mockUpdatedAt);
    });

    it('should create a role with default isSystemRole', () => {
      const role = new Role(mockId, 'custom', 'Custom role');

      expect(role.isSystemRole).toBe(false);
    });

    it('should create a role with default timestamps', () => {
      const beforeCreate = Date.now();
      const role = new Role(mockId, 'user', 'User role');
      const afterCreate = Date.now();

      expect(role.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate);
      expect(role.createdAt.getTime()).toBeLessThanOrEqual(afterCreate);
      expect(role.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreate);
      expect(role.updatedAt.getTime()).toBeLessThanOrEqual(afterCreate);
    });
  });

  describe('isSystem', () => {
    it('should return true for system roles', () => {
      const role = new Role(mockId, 'admin', 'Admin', true);
      expect(role.isSystem()).toBe(true);
    });

    it('should return false for non-system roles', () => {
      const role = new Role(mockId, 'custom', 'Custom', false);
      expect(role.isSystem()).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('should return true for admin role', () => {
      const role = new Role(mockId, 'admin', 'Admin', true);
      expect(role.isAdmin()).toBe(true);
    });

    it('should return false for non-admin roles', () => {
      const userRole = new Role(mockId, 'user', 'User', true);
      const managerRole = new Role(mockId, 'manager', 'Manager', true);

      expect(userRole.isAdmin()).toBe(false);
      expect(managerRole.isAdmin()).toBe(false);
    });
  });

  describe('isManager', () => {
    it('should return true for manager role', () => {
      const role = new Role(mockId, 'manager', 'Manager', true);
      expect(role.isManager()).toBe(true);
    });

    it('should return false for non-manager roles', () => {
      const userRole = new Role(mockId, 'user', 'User', true);
      const adminRole = new Role(mockId, 'admin', 'Admin', true);

      expect(userRole.isManager()).toBe(false);
      expect(adminRole.isManager()).toBe(false);
    });
  });

  describe('isUser', () => {
    it('should return true for user role', () => {
      const role = new Role(mockId, 'user', 'User', true);
      expect(role.isUser()).toBe(true);
    });

    it('should return false for non-user roles', () => {
      const adminRole = new Role(mockId, 'admin', 'Admin', true);
      const managerRole = new Role(mockId, 'manager', 'Manager', true);

      expect(adminRole.isUser()).toBe(false);
      expect(managerRole.isUser()).toBe(false);
    });
  });

  describe('System Roles', () => {
    it('should correctly identify all system roles', () => {
      const admin = new Role(mockId, 'admin', 'Admin', true);
      const manager = new Role(mockId, 'manager', 'Manager', true);
      const user = new Role(mockId, 'user', 'User', true);

      expect(admin.isSystem()).toBe(true);
      expect(admin.isAdmin()).toBe(true);

      expect(manager.isSystem()).toBe(true);
      expect(manager.isManager()).toBe(true);

      expect(user.isSystem()).toBe(true);
      expect(user.isUser()).toBe(true);
    });
  });
});

