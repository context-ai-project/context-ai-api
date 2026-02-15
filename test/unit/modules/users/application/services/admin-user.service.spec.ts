import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AdminUserService } from '../../../../../../src/modules/users/application/services/admin-user.service';
import { UserRepository } from '../../../../../../src/modules/users/infrastructure/persistence/repositories/user.repository';
import { RoleRepository } from '../../../../../../src/modules/auth/infrastructure/persistence/repositories/role.repository';
import type { UserModel } from '../../../../../../src/modules/users/infrastructure/persistence/models/user.model';
import type { RoleModel } from '../../../../../../src/modules/auth/infrastructure/persistence/models/role.model';

describe('AdminUserService', () => {
  let service: AdminUserService;

  const mockUserRepository = {
    findAllWithRelations: jest.fn(),
    findByIdWithRelations: jest.fn(),
    saveModel: jest.fn(),
  };

  const mockRoleRepository = {
    findByName: jest.fn(),
    findWithPermissions: jest.fn(),
  };

  const mockSectorRepository = {
    findById: jest.fn(),
  };

  // ── Test data ──────────────────────────────────────────────────────────────

  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const roleId = '660e8400-e29b-41d4-a716-446655440000';
  const sectorId = '770e8400-e29b-41d4-a716-446655440000';
  const sectorId2 = '770e8400-e29b-41d4-a716-446655440001';

  function createMockUser(overrides?: Partial<UserModel>): UserModel {
    return {
      id: userId,
      auth0UserId: 'auth0|abc123',
      email: 'test@example.com',
      name: 'Test User',
      isActive: true,
      roles: [{ id: roleId, name: 'user' } as RoleModel],
      sectors: [],
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
      lastLoginAt: null,
      ...overrides,
    } as UserModel;
  }

  // ── Setup ──────────────────────────────────────────────────────────────────

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUserService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: RoleRepository, useValue: mockRoleRepository },
        { provide: 'ISectorRepository', useValue: mockSectorRepository },
      ],
    }).compile();

    service = module.get<AdminUserService>(AdminUserService);
    jest.clearAllMocks();
  });

  // ── listUsers ──────────────────────────────────────────────────────────────

  describe('listUsers', () => {
    it('should return mapped users', async () => {
      const users = [createMockUser(), createMockUser({ id: '550e8400-e29b-41d4-a716-446655440001', name: 'User 2' })];
      mockUserRepository.findAllWithRelations.mockResolvedValue(users);

      const result = await service.listUsers();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(userId);
      expect(result[0].roles).toEqual(['user']);
      expect(result[0].sectorIds).toEqual([]);
      expect(mockUserRepository.findAllWithRelations).toHaveBeenCalledWith(undefined);
    });

    it('should pass search term to repository', async () => {
      mockUserRepository.findAllWithRelations.mockResolvedValue([]);

      await service.listUsers('john');

      expect(mockUserRepository.findAllWithRelations).toHaveBeenCalledWith('john');
    });

    it('should map sectors correctly', async () => {
      const user = createMockUser({
        sectors: [{ id: sectorId } as never, { id: sectorId2 } as never],
      });
      mockUserRepository.findAllWithRelations.mockResolvedValue([user]);

      const result = await service.listUsers();

      expect(result[0].sectorIds).toEqual([sectorId, sectorId2]);
    });

    it('should handle users with no roles', async () => {
      const user = createMockUser({ roles: [] });
      mockUserRepository.findAllWithRelations.mockResolvedValue([user]);

      const result = await service.listUsers();

      expect(result[0].roles).toEqual([]);
    });
  });

  // ── getUserById ────────────────────────────────────────────────────────────

  describe('getUserById', () => {
    it('should return mapped user when found', async () => {
      mockUserRepository.findByIdWithRelations.mockResolvedValue(createMockUser());

      const result = await service.getUserById(userId);

      expect(result.id).toBe(userId);
      expect(result.email).toBe('test@example.com');
      expect(mockUserRepository.findByIdWithRelations).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepository.findByIdWithRelations.mockResolvedValue(null);

      await expect(service.getUserById(userId)).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateUserRole ─────────────────────────────────────────────────────────

  describe('updateUserRole', () => {
    it('should update user role successfully', async () => {
      const user = createMockUser();
      const roleEntity = { id: roleId, name: 'manager' };
      const roleModel = { id: roleId, name: 'manager', permissions: [] } as unknown as RoleModel;
      const updatedUser = createMockUser({ roles: [roleModel] });

      mockUserRepository.findByIdWithRelations.mockResolvedValueOnce(user);
      mockRoleRepository.findByName.mockResolvedValue(roleEntity);
      mockRoleRepository.findWithPermissions.mockResolvedValue(roleModel);
      mockUserRepository.saveModel.mockResolvedValue({ ...user, id: userId });
      mockUserRepository.findByIdWithRelations.mockResolvedValueOnce(updatedUser);

      const result = await service.updateUserRole(userId, 'manager');

      expect(result.roles).toEqual(['manager']);
      expect(mockRoleRepository.findByName).toHaveBeenCalledWith('manager');
    });

    it('should throw BadRequestException for invalid role', async () => {
      await expect(service.updateUserRole(userId, 'superadmin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepository.findByIdWithRelations.mockResolvedValue(null);

      await expect(service.updateUserRole(userId, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when role not found in DB', async () => {
      mockUserRepository.findByIdWithRelations.mockResolvedValue(createMockUser());
      mockRoleRepository.findByName.mockResolvedValue(null);

      await expect(service.updateUserRole(userId, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when role model not found', async () => {
      mockUserRepository.findByIdWithRelations.mockResolvedValue(createMockUser());
      mockRoleRepository.findByName.mockResolvedValue({ id: roleId, name: 'admin' });
      mockRoleRepository.findWithPermissions.mockResolvedValue(null);

      await expect(service.updateUserRole(userId, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when user not found after update', async () => {
      const user = createMockUser();
      const roleModel = { id: roleId, name: 'admin', permissions: [] } as unknown as RoleModel;

      mockUserRepository.findByIdWithRelations.mockResolvedValueOnce(user);
      mockRoleRepository.findByName.mockResolvedValue({ id: roleId, name: 'admin' });
      mockRoleRepository.findWithPermissions.mockResolvedValue(roleModel);
      mockUserRepository.saveModel.mockResolvedValue({ ...user, id: userId });
      mockUserRepository.findByIdWithRelations.mockResolvedValueOnce(null);

      await expect(service.updateUserRole(userId, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── toggleUserStatus ───────────────────────────────────────────────────────

  describe('toggleUserStatus', () => {
    it('should deactivate user', async () => {
      const user = createMockUser({ isActive: true });
      const updated = createMockUser({ isActive: false });

      mockUserRepository.findByIdWithRelations.mockResolvedValueOnce(user);
      mockUserRepository.saveModel.mockResolvedValue(updated);
      mockUserRepository.findByIdWithRelations.mockResolvedValueOnce(updated);

      const result = await service.toggleUserStatus(userId, false);

      expect(result.isActive).toBe(false);
    });

    it('should activate user', async () => {
      const user = createMockUser({ isActive: false });
      const updated = createMockUser({ isActive: true });

      mockUserRepository.findByIdWithRelations.mockResolvedValueOnce(user);
      mockUserRepository.saveModel.mockResolvedValue(updated);
      mockUserRepository.findByIdWithRelations.mockResolvedValueOnce(updated);

      const result = await service.toggleUserStatus(userId, true);

      expect(result.isActive).toBe(true);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepository.findByIdWithRelations.mockResolvedValue(null);

      await expect(service.toggleUserStatus(userId, false)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when user not found after update', async () => {
      const user = createMockUser();

      mockUserRepository.findByIdWithRelations.mockResolvedValueOnce(user);
      mockUserRepository.saveModel.mockResolvedValue(user);
      mockUserRepository.findByIdWithRelations.mockResolvedValueOnce(null);

      await expect(service.toggleUserStatus(userId, false)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── updateUserSectors ──────────────────────────────────────────────────────

  describe('updateUserSectors', () => {
    it('should update sectors successfully', async () => {
      const user = createMockUser();
      const updatedUser = createMockUser({
        sectors: [{ id: sectorId } as never, { id: sectorId2 } as never],
      });

      mockUserRepository.findByIdWithRelations.mockResolvedValueOnce(user);
      mockSectorRepository.findById.mockResolvedValueOnce({ id: sectorId, name: 'HR' });
      mockSectorRepository.findById.mockResolvedValueOnce({ id: sectorId2, name: 'IT' });
      mockUserRepository.saveModel.mockResolvedValue(updatedUser);
      mockUserRepository.findByIdWithRelations.mockResolvedValueOnce(updatedUser);

      const result = await service.updateUserSectors(userId, [sectorId, sectorId2]);

      expect(result.sectorIds).toEqual([sectorId, sectorId2]);
    });

    it('should allow empty sector array', async () => {
      const user = createMockUser();
      const updated = createMockUser({ sectors: [] });

      mockUserRepository.findByIdWithRelations.mockResolvedValueOnce(user);
      mockUserRepository.saveModel.mockResolvedValue(updated);
      mockUserRepository.findByIdWithRelations.mockResolvedValueOnce(updated);

      const result = await service.updateUserSectors(userId, []);

      expect(result.sectorIds).toEqual([]);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepository.findByIdWithRelations.mockResolvedValue(null);

      await expect(service.updateUserSectors(userId, [sectorId])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when sector not found', async () => {
      mockUserRepository.findByIdWithRelations.mockResolvedValue(createMockUser());
      mockSectorRepository.findById.mockResolvedValue(null);

      await expect(service.updateUserSectors(userId, [sectorId])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when user not found after update', async () => {
      const user = createMockUser();

      mockUserRepository.findByIdWithRelations.mockResolvedValueOnce(user);
      mockUserRepository.saveModel.mockResolvedValue(user);
      mockUserRepository.findByIdWithRelations.mockResolvedValueOnce(null);

      await expect(service.updateUserSectors(userId, [])).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

