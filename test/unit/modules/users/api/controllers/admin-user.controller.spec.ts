import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminUserController } from '../../../../../../src/modules/users/api/controllers/admin-user.controller';
import { AdminUserService } from '../../../../../../src/modules/users/application/services/admin-user.service';
import type { AdminUserResponseDto } from '../../../../../../src/modules/users/application/dtos/admin-user.dto';
import { JwtAuthGuard } from '../../../../../../src/modules/auth/guards/jwt-auth.guard';
import { RBACGuard } from '../../../../../../src/modules/auth/guards/rbac.guard';
import { PermissionService } from '../../../../../../src/modules/auth/application/services/permission.service';
import { TokenRevocationService } from '../../../../../../src/modules/auth/application/services/token-revocation.service';

describe('AdminUserController', () => {
  let controller: AdminUserController;

  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const sectorId = '770e8400-e29b-41d4-a716-446655440000';

  const mockAdminUserService = {
    listUsers: jest.fn(),
    getUserById: jest.fn(),
    updateUserRole: jest.fn(),
    toggleUserStatus: jest.fn(),
    updateUserSectors: jest.fn(),
  };

  function createMockResponse(overrides?: Partial<AdminUserResponseDto>): AdminUserResponseDto {
    return {
      id: userId,
      auth0UserId: 'auth0|abc123',
      email: 'test@example.com',
      name: 'Test User',
      isActive: true,
      roles: ['user'],
      sectorIds: [],
      createdAt: new Date('2025-01-01'),
      lastLoginAt: null,
      ...overrides,
    };
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUserController],
      providers: [
        { provide: AdminUserService, useValue: mockAdminUserService },
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn() } },
        { provide: JwtAuthGuard, useValue: { canActivate: jest.fn().mockReturnValue(true) } },
        { provide: RBACGuard, useValue: { canActivate: jest.fn().mockReturnValue(true) } },
        { provide: PermissionService, useValue: { hasPermissions: jest.fn() } },
        { provide: TokenRevocationService, useValue: { isTokenRevoked: jest.fn() } },
      ],
    }).compile();

    controller = module.get<AdminUserController>(AdminUserController);
    jest.clearAllMocks();
  });

  // ── listUsers ──────────────────────────────────────────────────────────────

  describe('listUsers', () => {
    it('should return list of users', async () => {
      const users = [createMockResponse()];
      mockAdminUserService.listUsers.mockResolvedValue(users);

      const result = await controller.listUsers({ search: undefined });

      expect(result).toEqual(users);
      expect(mockAdminUserService.listUsers).toHaveBeenCalledWith(undefined);
    });

    it('should pass search to service', async () => {
      mockAdminUserService.listUsers.mockResolvedValue([]);

      await controller.listUsers({ search: 'john' });

      expect(mockAdminUserService.listUsers).toHaveBeenCalledWith('john');
    });

    it('should propagate service errors', async () => {
      mockAdminUserService.listUsers.mockRejectedValue(new Error('DB error'));

      await expect(controller.listUsers({ search: undefined })).rejects.toThrow('DB error');
    });
  });

  // ── getUser ────────────────────────────────────────────────────────────────

  describe('getUser', () => {
    it('should return user by ID', async () => {
      const user = createMockResponse();
      mockAdminUserService.getUserById.mockResolvedValue(user);

      const result = await controller.getUser(userId);

      expect(result).toEqual(user);
      expect(mockAdminUserService.getUserById).toHaveBeenCalledWith(userId);
    });

    it('should throw BadRequestException for invalid UUID', async () => {
      await expect(controller.getUser('not-a-uuid')).rejects.toThrow(BadRequestException);
    });

    it('should propagate NotFoundException from service', async () => {
      mockAdminUserService.getUserById.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(controller.getUser(userId)).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateRole ─────────────────────────────────────────────────────────────

  describe('updateRole', () => {
    it('should update user role', async () => {
      const updated = createMockResponse({ roles: ['manager'] });
      mockAdminUserService.updateUserRole.mockResolvedValue(updated);

      const result = await controller.updateRole(userId, { role: 'manager' });

      expect(result.roles).toEqual(['manager']);
      expect(mockAdminUserService.updateUserRole).toHaveBeenCalledWith(userId, 'manager');
    });

    it('should throw BadRequestException for invalid UUID', async () => {
      await expect(
        controller.updateRole('bad-uuid', { role: 'admin' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate service errors', async () => {
      mockAdminUserService.updateUserRole.mockRejectedValue(
        new BadRequestException('Invalid role'),
      );

      await expect(
        controller.updateRole(userId, { role: 'superadmin' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── toggleStatus ───────────────────────────────────────────────────────────

  describe('toggleStatus', () => {
    it('should toggle user status', async () => {
      const updated = createMockResponse({ isActive: false });
      mockAdminUserService.toggleUserStatus.mockResolvedValue(updated);

      const result = await controller.toggleStatus(userId, { isActive: false });

      expect(result.isActive).toBe(false);
      expect(mockAdminUserService.toggleUserStatus).toHaveBeenCalledWith(userId, false);
    });

    it('should throw BadRequestException for invalid UUID', async () => {
      await expect(
        controller.toggleStatus('bad-uuid', { isActive: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate NotFoundException', async () => {
      mockAdminUserService.toggleUserStatus.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        controller.toggleStatus(userId, { isActive: false }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateSectors ──────────────────────────────────────────────────────────

  describe('updateSectors', () => {
    it('should update user sectors', async () => {
      const updated = createMockResponse({ sectorIds: [sectorId] });
      mockAdminUserService.updateUserSectors.mockResolvedValue(updated);

      const result = await controller.updateSectors(userId, { sectorIds: [sectorId] });

      expect(result.sectorIds).toEqual([sectorId]);
      expect(mockAdminUserService.updateUserSectors).toHaveBeenCalledWith(userId, [sectorId]);
    });

    it('should throw BadRequestException for invalid UUID', async () => {
      await expect(
        controller.updateSectors('bad-uuid', { sectorIds: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate errors', async () => {
      mockAdminUserService.updateUserSectors.mockRejectedValue(
        new BadRequestException('Sector not found'),
      );

      await expect(
        controller.updateSectors(userId, { sectorIds: [sectorId] }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

