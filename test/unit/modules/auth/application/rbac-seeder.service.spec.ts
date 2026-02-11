import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RbacSeederService } from '../../../../../src/modules/auth/application/services/rbac-seeder.service';
import { RoleModel } from '../../../../../src/modules/auth/infrastructure/persistence/models/role.model';
import { PermissionModel } from '../../../../../src/modules/auth/infrastructure/persistence/models/permission.model';

describe('RbacSeederService', () => {
  let service: RbacSeederService;
  let roleRepository: jest.Mocked<Repository<RoleModel>>;
  let permissionRepository: jest.Mocked<Repository<PermissionModel>>;

  beforeEach(async () => {
    // Mock repositories
    const mockRoleRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => data as RoleModel),
      save: jest.fn((role) => Promise.resolve(role)),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockPermissionRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      findBy: jest.fn(),
      create: jest.fn((data) => data as PermissionModel),
      save: jest.fn((perm) => Promise.resolve(perm)),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacSeederService,
        {
          provide: getRepositoryToken(RoleModel),
          useValue: mockRoleRepository,
        },
        {
          provide: getRepositoryToken(PermissionModel),
          useValue: mockPermissionRepository,
        },
      ],
    }).compile();

    service = module.get<RbacSeederService>(RbacSeederService);
    roleRepository = module.get(getRepositoryToken(RoleModel));
    permissionRepository = module.get(getRepositoryToken(PermissionModel));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('seed', () => {
    it('should seed all RBAC data when database is empty', async () => {
      const mockRoles = [
        { id: '1', name: 'user', permissions: [] } as RoleModel,
        { id: '2', name: 'manager', permissions: [] } as RoleModel,
        { id: '3', name: 'admin', permissions: [] } as RoleModel,
      ];

      const allPermissions = [
        { id: '1', name: 'chat:read' } as PermissionModel,
        { id: '2', name: 'knowledge:read' } as PermissionModel,
        { id: '3', name: 'knowledge:create' } as PermissionModel,
        { id: '4', name: 'knowledge:update' } as PermissionModel,
        { id: '5', name: 'knowledge:delete' } as PermissionModel,
        { id: '6', name: 'profile:read' } as PermissionModel,
        { id: '7', name: 'profile:update' } as PermissionModel,
        { id: '8', name: 'users:read' } as PermissionModel,
        { id: '9', name: 'users:manage' } as PermissionModel,
        { id: '10', name: 'system:admin' } as PermissionModel,
      ];

      // Mock empty database during seedRoles and seedPermissions
      roleRepository.findOne
        .mockResolvedValueOnce(null) // user doesn't exist
        .mockResolvedValueOnce(null) // manager doesn't exist
        .mockResolvedValueOnce(null) // admin doesn't exist
        // Then for seedRolePermissions, return the roles
        .mockResolvedValueOnce(mockRoles[0]) // user role
        .mockResolvedValueOnce(mockRoles[1]) // manager role
        .mockResolvedValueOnce(mockRoles[2]); // admin role

      permissionRepository.findOne.mockResolvedValue(null);

      // Mock all permissions (for admin role in seedRolePermissions)
      permissionRepository.find.mockResolvedValue(allPermissions);

      // Mock query builder for specific permissions (user and manager roles)
      const qb = {
        where: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          // First call for user role
          .mockResolvedValueOnce([
            allPermissions[0], // chat:read
            allPermissions[1], // knowledge:read
            allPermissions[5], // profile:read
            allPermissions[6], // profile:update
          ])
          // Second call for manager role
          .mockResolvedValueOnce([
            allPermissions[0], // chat:read
            allPermissions[1], // knowledge:read
            allPermissions[2], // knowledge:create
            allPermissions[3], // knowledge:update
            allPermissions[4], // knowledge:delete
            allPermissions[5], // profile:read
            allPermissions[6], // profile:update
            allPermissions[7], // users:read
          ]),
      };
      permissionRepository.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service.seed();

      expect(result.rolesCreated).toBe(3);
      expect(result.permissionsCreated).toBe(10);
      expect(result.associationsCreated).toBeGreaterThan(0);
      // roleRepository.save is called 3 times for roles + 3 times for role-permission associations
      expect(roleRepository.save).toHaveBeenCalled();
      expect(permissionRepository.save).toHaveBeenCalledTimes(10); // 10 permissions
    });

    it('should skip existing roles and permissions', async () => {
      // Mock existing data - all roles and permissions exist
      roleRepository.findOne.mockResolvedValue({
        id: '1',
        name: 'admin',
        permissions: [],
      } as RoleModel);
      permissionRepository.findOne.mockResolvedValue({
        id: '1',
        name: 'chat:read',
      } as PermissionModel);

      // Mock for seedRolePermissions - all roles have permissions assigned
      roleRepository.find.mockResolvedValue([
        { id: '1', name: 'admin', permissions: [] } as RoleModel,
      ]);

      const qb = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      permissionRepository.createQueryBuilder.mockReturnValue(qb as never);
      permissionRepository.find.mockResolvedValue([]);

      const result = await service.seed();

      expect(result.rolesCreated).toBe(0);
      expect(result.permissionsCreated).toBe(0);
      // seedRolePermissions still runs but finds no new associations
      expect(result.associationsCreated).toBe(0);
    });

    it('should handle partial seeding (some existing, some new)', async () => {
      // Mock: admin exists, manager and user don't
      roleRepository.findOne
        .mockResolvedValueOnce({ id: '1', name: 'admin' } as RoleModel) // admin exists
        .mockResolvedValueOnce(null) // manager doesn't exist
        .mockResolvedValueOnce(null); // user doesn't exist

      // Mock: some permissions exist, some don't
      let permCallCount = 0;
      permissionRepository.findOne.mockImplementation(() => {
        permCallCount++;
        // First 3 exist, rest don't
        return permCallCount <= 3
          ? Promise.resolve({ id: String(permCallCount) } as PermissionModel)
          : Promise.resolve(null);
      });

      roleRepository.find.mockResolvedValue([
        { id: '1', name: 'admin', permissions: [] } as RoleModel,
        { id: '2', name: 'manager', permissions: [] } as RoleModel,
        { id: '3', name: 'user', permissions: [] } as RoleModel,
      ]);

      const qb = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      permissionRepository.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service.seed();

      expect(result.rolesCreated).toBe(2); // manager and user
      expect(result.permissionsCreated).toBe(7); // 10 - 3 existing
      expect(roleRepository.save).toHaveBeenCalledTimes(2);
      expect(permissionRepository.save).toHaveBeenCalledTimes(7);
    });
  });

  describe('seedRoles', () => {
    it('should create all system roles', async () => {
      roleRepository.findOne.mockResolvedValue(null);

      // Access private method via service['seedRoles']
      const result = await service['seedRoles']();

      expect(result).toBe(3);
      expect(roleRepository.save).toHaveBeenCalledTimes(3);
      expect(roleRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'admin' }),
      );
      expect(roleRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'manager' }),
      );
      expect(roleRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'user' }),
      );
    });

    it('should skip roles that already exist', async () => {
      roleRepository.findOne.mockResolvedValue({
        id: '1',
        name: 'admin',
      } as RoleModel);

      const result = await service['seedRoles']();

      expect(result).toBe(0);
      expect(roleRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('seedPermissions', () => {
    it('should create all system permissions', async () => {
      permissionRepository.findOne.mockResolvedValue(null);

      const result = await service['seedPermissions']();

      expect(result).toBe(10); // 10 permissions
      expect(permissionRepository.save).toHaveBeenCalledTimes(10);
      expect(permissionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'chat:read' }),
      );
      expect(permissionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'knowledge:read' }),
      );
      expect(permissionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'users:manage' }),
      );
    });

    it('should skip permissions that already exist', async () => {
      permissionRepository.findOne.mockResolvedValue({
        id: '1',
        name: 'chat:read',
      } as PermissionModel);

      const result = await service['seedPermissions']();

      expect(result).toBe(0);
      expect(permissionRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('seedRolePermissions', () => {
    it('should assign permissions to user role', async () => {
      const userRole = {
        id: '1',
        name: 'user',
        permissions: [],
      } as RoleModel;

      const userPermissions = [
        { id: '1', name: 'chat:read' } as PermissionModel,
        { id: '2', name: 'knowledge:read' } as PermissionModel,
        { id: '3', name: 'profile:read' } as PermissionModel,
        { id: '4', name: 'profile:update' } as PermissionModel,
      ];

      // Mock for the first call (user role)
      roleRepository.findOne
        .mockResolvedValueOnce(userRole)
        .mockResolvedValueOnce(null) // Skip manager
        .mockResolvedValueOnce(null); // Skip admin

      const qb = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(userPermissions),
      };
      permissionRepository.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service['seedRolePermissions']();

      expect(result).toBe(4); // 4 permissions for user role
      expect(roleRepository.save).toHaveBeenCalled();
    });

    it('should assign permissions to manager role', async () => {
      const managerRole = {
        id: '2',
        name: 'manager',
        permissions: [],
      } as RoleModel;

      const managerPermissions = [
        { id: '1', name: 'chat:read' } as PermissionModel,
        { id: '2', name: 'knowledge:read' } as PermissionModel,
        { id: '3', name: 'knowledge:create' } as PermissionModel,
        { id: '4', name: 'knowledge:update' } as PermissionModel,
        { id: '5', name: 'knowledge:delete' } as PermissionModel,
        { id: '6', name: 'profile:read' } as PermissionModel,
        { id: '7', name: 'profile:update' } as PermissionModel,
        { id: '8', name: 'users:read' } as PermissionModel,
      ];

      // Mock for the second call (manager role)
      roleRepository.findOne
        .mockResolvedValueOnce(null) // Skip user
        .mockResolvedValueOnce(managerRole)
        .mockResolvedValueOnce(null); // Skip admin

      const qb = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(managerPermissions),
      };
      permissionRepository.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service['seedRolePermissions']();

      expect(result).toBe(8); // 8 permissions for manager role
      expect(roleRepository.save).toHaveBeenCalled();
    });

    it('should assign all permissions to admin role', async () => {
      const adminRole = {
        id: '3',
        name: 'admin',
        permissions: [],
      } as RoleModel;

      const allPermissions = [
        { id: '1', name: 'chat:read' } as PermissionModel,
        { id: '2', name: 'knowledge:read' } as PermissionModel,
        { id: '3', name: 'knowledge:create' } as PermissionModel,
        { id: '4', name: 'knowledge:update' } as PermissionModel,
        { id: '5', name: 'knowledge:delete' } as PermissionModel,
        { id: '6', name: 'profile:read' } as PermissionModel,
        { id: '7', name: 'profile:update' } as PermissionModel,
        { id: '8', name: 'users:read' } as PermissionModel,
        { id: '9', name: 'users:manage' } as PermissionModel,
        { id: '10', name: 'system:admin' } as PermissionModel,
      ];

      // Mock for the third call (admin role)
      roleRepository.findOne
        .mockResolvedValueOnce(null) // Skip user
        .mockResolvedValueOnce(null) // Skip manager
        .mockResolvedValueOnce(adminRole);
      permissionRepository.find.mockResolvedValue(allPermissions);

      const result = await service['seedRolePermissions']();

      expect(result).toBe(10); // All 10 permissions for admin
      expect(roleRepository.save).toHaveBeenCalled();
    });

    it('should skip permissions that are already assigned', async () => {
      const userRole = {
        id: '1',
        name: 'user',
        permissions: [
          { id: '1', name: 'chat:read' } as PermissionModel,
          { id: '2', name: 'knowledge:read' } as PermissionModel,
          { id: '3', name: 'profile:read' } as PermissionModel,
          { id: '4', name: 'profile:update' } as PermissionModel,
        ],
      } as RoleModel;

      roleRepository.findOne
        .mockResolvedValueOnce(userRole)
        .mockResolvedValueOnce(null) // Skip manager
        .mockResolvedValueOnce(null); // Skip admin

      const qb = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(userRole.permissions),
      };
      permissionRepository.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service['seedRolePermissions']();

      expect(result).toBe(0); // No new permissions
      expect(roleRepository.save).not.toHaveBeenCalled();
    });

    it('should handle role not found', async () => {
      roleRepository.findOne.mockResolvedValue(null);

      const result = await service['seedRolePermissions']();

      expect(result).toBe(0);
      expect(roleRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear all RBAC data', async () => {
      const mockRoles = [
        { id: '1', name: 'admin' } as RoleModel,
        { id: '2', name: 'manager' } as RoleModel,
        { id: '3', name: 'user' } as RoleModel,
      ];

      roleRepository.find.mockResolvedValue(mockRoles);
      roleRepository.createQueryBuilder.mockReturnValue({
        relation: jest.fn().mockReturnThis(),
        of: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      } as never);

      await service.clear();

      expect(permissionRepository.delete).toHaveBeenCalledWith({});
      expect(roleRepository.delete).toHaveBeenCalledWith({});
    });
  });
});

