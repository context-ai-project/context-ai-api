import { Permission } from '../../../../../src/modules/auth/domain/entities/permission.entity';

describe('Permission Entity', () => {
  const mockId = 'perm-uuid-123';
  const mockCreatedAt = new Date('2026-01-01');
  const mockUpdatedAt = new Date('2026-01-02');

  describe('Constructor', () => {
    it('should create a permission with all properties', () => {
      const permission = new Permission(
        mockId,
        'knowledge:read',
        'Read knowledge documents',
        'knowledge',
        'read',
        true,
        mockCreatedAt,
        mockUpdatedAt,
      );

      expect(permission.id).toBe(mockId);
      expect(permission.name).toBe('knowledge:read');
      expect(permission.description).toBe('Read knowledge documents');
      expect(permission.resource).toBe('knowledge');
      expect(permission.action).toBe('read');
      expect(permission.isSystemPermission).toBe(true);
      expect(permission.createdAt).toBe(mockCreatedAt);
      expect(permission.updatedAt).toBe(mockUpdatedAt);
    });

    it('should create a permission with default isSystemPermission', () => {
      const permission = new Permission(
        mockId,
        'custom:action',
        'Custom permission',
        'custom',
        'action',
      );

      expect(permission.isSystemPermission).toBe(false);
    });

    it('should create a permission with default timestamps', () => {
      const beforeCreate = Date.now();
      const permission = new Permission(
        mockId,
        'chat:read',
        'Chat read',
        'chat',
        'read',
      );
      const afterCreate = Date.now();

      expect(permission.createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreate,
      );
      expect(permission.createdAt.getTime()).toBeLessThanOrEqual(afterCreate);
      expect(permission.updatedAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreate,
      );
      expect(permission.updatedAt.getTime()).toBeLessThanOrEqual(afterCreate);
    });
  });

  describe('isSystem', () => {
    it('should return true for system permissions', () => {
      const permission = new Permission(
        mockId,
        'knowledge:read',
        'Read',
        'knowledge',
        'read',
        true,
      );
      expect(permission.isSystem()).toBe(true);
    });

    it('should return false for non-system permissions', () => {
      const permission = new Permission(
        mockId,
        'custom:action',
        'Custom',
        'custom',
        'action',
        false,
      );
      expect(permission.isSystem()).toBe(false);
    });
  });

  describe('isReadPermission', () => {
    it('should return true for read action', () => {
      const permission = new Permission(
        mockId,
        'knowledge:read',
        'Read',
        'knowledge',
        'read',
      );
      expect(permission.isReadPermission()).toBe(true);
    });

    it('should return false for non-read actions', () => {
      const createPerm = new Permission(
        mockId,
        'knowledge:create',
        'Create',
        'knowledge',
        'create',
      );
      const updatePerm = new Permission(
        mockId,
        'knowledge:update',
        'Update',
        'knowledge',
        'update',
      );
      const deletePerm = new Permission(
        mockId,
        'knowledge:delete',
        'Delete',
        'knowledge',
        'delete',
      );

      expect(createPerm.isReadPermission()).toBe(false);
      expect(updatePerm.isReadPermission()).toBe(false);
      expect(deletePerm.isReadPermission()).toBe(false);
    });
  });

  describe('isWritePermission', () => {
    it('should return true for write actions', () => {
      const createPerm = new Permission(
        mockId,
        'knowledge:create',
        'Create',
        'knowledge',
        'create',
      );
      const updatePerm = new Permission(
        mockId,
        'knowledge:update',
        'Update',
        'knowledge',
        'update',
      );
      const deletePerm = new Permission(
        mockId,
        'knowledge:delete',
        'Delete',
        'knowledge',
        'delete',
      );
      const writePerm = new Permission(
        mockId,
        'knowledge:write',
        'Write',
        'knowledge',
        'write',
      );

      expect(createPerm.isWritePermission()).toBe(true);
      expect(updatePerm.isWritePermission()).toBe(true);
      expect(deletePerm.isWritePermission()).toBe(true);
      expect(writePerm.isWritePermission()).toBe(true);
    });

    it('should return false for read action', () => {
      const permission = new Permission(
        mockId,
        'knowledge:read',
        'Read',
        'knowledge',
        'read',
      );
      expect(permission.isWritePermission()).toBe(false);
    });
  });

  describe('isForResource', () => {
    it('should return true when resource matches', () => {
      const permission = new Permission(
        mockId,
        'knowledge:read',
        'Read',
        'knowledge',
        'read',
      );
      expect(permission.isForResource('knowledge')).toBe(true);
    });

    it('should return false when resource does not match', () => {
      const permission = new Permission(
        mockId,
        'knowledge:read',
        'Read',
        'knowledge',
        'read',
      );
      expect(permission.isForResource('chat')).toBe(false);
      expect(permission.isForResource('users')).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the permission name', () => {
      const permission = new Permission(
        mockId,
        'knowledge:read',
        'Read',
        'knowledge',
        'read',
      );
      expect(permission.toString()).toBe('knowledge:read');
    });

    it('should return correct format for all permission types', () => {
      const chatRead = new Permission(
        mockId,
        'chat:read',
        'Chat',
        'chat',
        'read',
      );
      const knowledgeCreate = new Permission(
        mockId,
        'knowledge:create',
        'Create',
        'knowledge',
        'create',
      );
      const usersManage = new Permission(
        mockId,
        'users:manage',
        'Manage',
        'users',
        'manage',
      );

      expect(chatRead.toString()).toBe('chat:read');
      expect(knowledgeCreate.toString()).toBe('knowledge:create');
      expect(usersManage.toString()).toBe('users:manage');
    });
  });

  describe('Permission Naming Convention', () => {
    it('should follow resource:action format', () => {
      const permissions = [
        new Permission(mockId, 'chat:read', 'Chat', 'chat', 'read'),
        new Permission(
          mockId,
          'knowledge:read',
          'Read',
          'knowledge',
          'read',
        ),
        new Permission(
          mockId,
          'knowledge:create',
          'Create',
          'knowledge',
          'create',
        ),
        new Permission(
          mockId,
          'users:manage',
          'Manage',
          'users',
          'manage',
        ),
      ];

      permissions.forEach((perm) => {
        expect(perm.name).toMatch(/^[a-z]+:[a-z]+$/);
        expect(perm.name).toBe(`${perm.resource}:${perm.action}`);
      });
    });
  });
});

