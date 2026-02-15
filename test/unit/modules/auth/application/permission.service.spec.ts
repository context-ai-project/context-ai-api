import { Test, TestingModule } from '@nestjs/testing';
import { PermissionService } from '../../../../../src/modules/auth/application/services/permission.service';
import { UserRepository } from '../../../../../src/modules/users/infrastructure/persistence/repositories/user.repository';
import { RoleRepository } from '../../../../../src/modules/auth/infrastructure/persistence/repositories/role.repository';
import { PermissionRepository } from '../../../../../src/modules/auth/infrastructure/persistence/repositories/permission.repository';
import { UserModel } from '../../../../../src/modules/users/infrastructure/persistence/models/user.model';
import { RoleModel } from '../../../../../src/modules/auth/infrastructure/persistence/models/role.model';
import { PermissionModel } from '../../../../../src/modules/auth/infrastructure/persistence/models/permission.model';

describe('PermissionService', () => {
  let service: PermissionService;
  let userRepository: jest.Mocked<UserRepository>;
  let roleRepository: jest.Mocked<RoleRepository>;

  // Test data
  const mockUserId = 'user-uuid-123';
  const mockRoleId1 = 'role-uuid-user';
  const mockRoleId2 = 'role-uuid-manager';

  const mockUserRole: RoleModel = {
    id: mockRoleId1,
    name: 'user',
    description: 'Basic user',
    isSystemRole: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    users: [],
    permissions: [],
  };

  const mockManagerRole: RoleModel = {
    id: mockRoleId2,
    name: 'manager',
    description: 'Manager',
    isSystemRole: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    users: [],
    permissions: [],
  };

  const mockChatReadPermission: PermissionModel = {
    id: 'perm-1',
    name: 'chat:read',
    description: 'Chat read',
    resource: 'chat',
    action: 'read',
    isSystemPermission: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [],
  };

  const mockKnowledgeReadPermission: PermissionModel = {
    id: 'perm-2',
    name: 'knowledge:read',
    description: 'Knowledge read',
    resource: 'knowledge',
    action: 'read',
    isSystemPermission: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [],
  };

  const mockKnowledgeCreatePermission: PermissionModel = {
    id: 'perm-3',
    name: 'knowledge:create',
    description: 'Knowledge create',
    resource: 'knowledge',
    action: 'create',
    isSystemPermission: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [],
  };

  const mockUserModel: UserModel = {
    id: mockUserId,
    auth0UserId: 'auth0|123',
    email: 'test@example.com',
    name: 'Test User',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
    roles: [mockUserRole],
  };

  beforeEach(async () => {
    const mockUserRepo = {
      findByIdWithRoles: jest.fn(),
    };

    const mockRoleRepo = {
      findManyWithPermissions: jest.fn(),
    };

    const mockPermRepo = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionService,
        {
          provide: UserRepository,
          useValue: mockUserRepo,
        },
        {
          provide: RoleRepository,
          useValue: mockRoleRepo,
        },
        {
          provide: PermissionRepository,
          useValue: mockPermRepo,
        },
      ],
    }).compile();

    service = module.get<PermissionService>(PermissionService);
    userRepository = module.get(UserRepository);
    roleRepository = module.get(RoleRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserRoles', () => {
    it('should return array of role names for a user', async () => {
      userRepository.findByIdWithRoles.mockResolvedValue(mockUserModel);

      const roles = await service.getUserRoles(mockUserId);

      expect(roles).toEqual(['user']);
      expect(userRepository.findByIdWithRoles).toHaveBeenCalledWith(
        mockUserId,
      );
    });

    it('should return empty array if user not found', async () => {
      userRepository.findByIdWithRoles.mockResolvedValue(null);

      const roles = await service.getUserRoles(mockUserId);

      expect(roles).toEqual([]);
    });

    it('should return empty array on error', async () => {
      userRepository.findByIdWithRoles.mockRejectedValue(
        new Error('Database error'),
      );

      const roles = await service.getUserRoles(mockUserId);

      expect(roles).toEqual([]);
    });

    it('should return multiple roles if user has them', async () => {
      const userWithMultipleRoles: UserModel = {
        ...mockUserModel,
        roles: [mockUserRole, mockManagerRole],
      };
      userRepository.findByIdWithRoles.mockResolvedValue(
        userWithMultipleRoles,
      );

      const roles = await service.getUserRoles(mockUserId);

      expect(roles).toEqual(['user', 'manager']);
    });
  });

  describe('getUserPermissions', () => {
    it('should return array of unique permission names for a user', async () => {
      userRepository.findByIdWithRoles.mockResolvedValue(mockUserModel);

      const rolesWithPerms: RoleModel[] = [
        {
          ...mockUserRole,
          permissions: [mockChatReadPermission, mockKnowledgeReadPermission],
        },
      ];
      roleRepository.findManyWithPermissions.mockResolvedValue(rolesWithPerms);

      const permissions = await service.getUserPermissions(mockUserId);

      expect(permissions).toEqual(['chat:read', 'knowledge:read']);
      expect(roleRepository.findManyWithPermissions).toHaveBeenCalledWith([
        mockRoleId1,
      ]);
    });

    it('should return empty array if user not found', async () => {
      userRepository.findByIdWithRoles.mockResolvedValue(null);

      const permissions = await service.getUserPermissions(mockUserId);

      expect(permissions).toEqual([]);
    });

    it('should return empty array if user has no roles', async () => {
      const userWithoutRoles: UserModel = {
        ...mockUserModel,
        roles: [],
      };
      userRepository.findByIdWithRoles.mockResolvedValue(userWithoutRoles);

      const permissions = await service.getUserPermissions(mockUserId);

      expect(permissions).toEqual([]);
    });

    it('should remove duplicate permissions from multiple roles', async () => {
      const userWithMultipleRoles: UserModel = {
        ...mockUserModel,
        roles: [mockUserRole, mockManagerRole],
      };
      userRepository.findByIdWithRoles.mockResolvedValue(
        userWithMultipleRoles,
      );

      const rolesWithPerms: RoleModel[] = [
        {
          ...mockUserRole,
          permissions: [mockChatReadPermission, mockKnowledgeReadPermission],
        },
        {
          ...mockManagerRole,
          permissions: [
            mockKnowledgeReadPermission, // Duplicate
            mockKnowledgeCreatePermission,
          ],
        },
      ];
      roleRepository.findManyWithPermissions.mockResolvedValue(rolesWithPerms);

      const permissions = await service.getUserPermissions(mockUserId);

      expect(permissions).toHaveLength(3);
      expect(permissions).toContain('chat:read');
      expect(permissions).toContain('knowledge:read');
      expect(permissions).toContain('knowledge:create');
    });

    it('should return empty array on error', async () => {
      userRepository.findByIdWithRoles.mockRejectedValue(
        new Error('Database error'),
      );

      const permissions = await service.getUserPermissions(mockUserId);

      expect(permissions).toEqual([]);
    });
  });

  describe('hasPermission', () => {
    it('should return true if user has the permission', async () => {
      userRepository.findByIdWithRoles.mockResolvedValue(mockUserModel);
      const rolesWithPerms: RoleModel[] = [
        {
          ...mockUserRole,
          permissions: [mockChatReadPermission],
        },
      ];
      roleRepository.findManyWithPermissions.mockResolvedValue(rolesWithPerms);

      const result = await service.hasPermission(mockUserId, 'chat:read');

      expect(result).toBe(true);
    });

    it('should return false if user does not have the permission', async () => {
      userRepository.findByIdWithRoles.mockResolvedValue(mockUserModel);
      const rolesWithPerms: RoleModel[] = [
        {
          ...mockUserRole,
          permissions: [mockChatReadPermission],
        },
      ];
      roleRepository.findManyWithPermissions.mockResolvedValue(rolesWithPerms);

      const result = await service.hasPermission(
        mockUserId,
        'knowledge:create',
      );

      expect(result).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if user has at least one permission', async () => {
      userRepository.findByIdWithRoles.mockResolvedValue(mockUserModel);
      const rolesWithPerms: RoleModel[] = [
        {
          ...mockUserRole,
          permissions: [mockChatReadPermission],
        },
      ];
      roleRepository.findManyWithPermissions.mockResolvedValue(rolesWithPerms);

      const result = await service.hasAnyPermission(mockUserId, [
        'chat:read',
        'knowledge:create',
      ]);

      expect(result).toBe(true);
    });

    it('should return false if user has none of the permissions', async () => {
      userRepository.findByIdWithRoles.mockResolvedValue(mockUserModel);
      const rolesWithPerms: RoleModel[] = [
        {
          ...mockUserRole,
          permissions: [mockChatReadPermission],
        },
      ];
      roleRepository.findManyWithPermissions.mockResolvedValue(rolesWithPerms);

      const result = await service.hasAnyPermission(mockUserId, [
        'knowledge:create',
        'users:manage',
      ]);

      expect(result).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if user has all permissions', async () => {
      userRepository.findByIdWithRoles.mockResolvedValue(mockUserModel);
      const rolesWithPerms: RoleModel[] = [
        {
          ...mockUserRole,
          permissions: [mockChatReadPermission, mockKnowledgeReadPermission],
        },
      ];
      roleRepository.findManyWithPermissions.mockResolvedValue(rolesWithPerms);

      const result = await service.hasAllPermissions(mockUserId, [
        'chat:read',
        'knowledge:read',
      ]);

      expect(result).toBe(true);
    });

    it('should return false if user is missing any permission', async () => {
      userRepository.findByIdWithRoles.mockResolvedValue(mockUserModel);
      const rolesWithPerms: RoleModel[] = [
        {
          ...mockUserRole,
          permissions: [mockChatReadPermission],
        },
      ];
      roleRepository.findManyWithPermissions.mockResolvedValue(rolesWithPerms);

      const result = await service.hasAllPermissions(mockUserId, [
        'chat:read',
        'knowledge:create',
      ]);

      expect(result).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('should return true if user has the role', async () => {
      userRepository.findByIdWithRoles.mockResolvedValue(mockUserModel);

      const result = await service.hasRole(mockUserId, 'user');

      expect(result).toBe(true);
    });

    it('should return false if user does not have the role', async () => {
      userRepository.findByIdWithRoles.mockResolvedValue(mockUserModel);

      const result = await service.hasRole(mockUserId, 'admin');

      expect(result).toBe(false);
    });
  });

});

