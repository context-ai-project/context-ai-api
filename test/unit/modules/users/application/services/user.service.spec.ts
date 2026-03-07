import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserService } from '../../../../../../src/modules/users/application/services/user.service';
import type { SyncUserDto } from '../../../../../../src/modules/users/application/services/user.service';
import { UserRepository } from '../../../../../../src/modules/users/infrastructure/persistence/repositories/user.repository';
import { RoleRepository } from '../../../../../../src/modules/auth/infrastructure/persistence/repositories/role.repository';

const mockSectorRepository = {
  findByName: jest.fn(),
  findById: jest.fn(),
  findByIds: jest.fn(),
  findAll: jest.fn(),
  save: jest.fn(),
} as unknown as { findByName: jest.Mock; findById: jest.Mock };

describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<UserRepository>;
  let roleRepository: jest.Mocked<RoleRepository>;
  let sectorRepository: typeof mockSectorRepository;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockDate = new Date('2024-01-01T00:00:00Z');
  const mockUser = {
    id: 'user-uuid-123',
    auth0UserId: 'auth0|123456',
    email: 'test@example.com',
    name: 'Test User',
    isActive: true,
    createdAt: mockDate,
    updatedAt: mockDate,
    lastLoginAt: mockDate,
    roles: [],
  };

  beforeEach(() => {
    userRepository = {
      findByAuth0UserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      saveEntity: jest.fn(),
      findByIdWithRoles: jest.fn(),
      findByIdWithRelations: jest.fn(),
      saveModel: jest.fn(),
      findAllWithRelations: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    roleRepository = {
      findByName: jest.fn(),
      findWithPermissions: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
      findManyWithPermissions: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<RoleRepository>;

    sectorRepository = { ...mockSectorRepository, findByName: jest.fn(), findById: jest.fn() };
    eventEmitter = {
      emit: jest.fn(),
    } as unknown as jest.Mocked<EventEmitter2>;

    // Default sector for assignDefaultRoleAndSectorIfNeeded (new users without invitation)
    sectorRepository.findByName.mockResolvedValue({
      id: 'hr-sector-uuid',
      name: 'Human Resources',
      description: 'HR sector',
      icon: 'users',
      status: 'ACTIVE',
      contactName: null,
      contactPhone: null,
      createdAt: mockDate,
      updatedAt: mockDate,
    });

    // Pass null for invitationService (default behavior without invitations module)
    service = new UserService(
      userRepository,
      roleRepository,
      sectorRepository,
      null,
      eventEmitter,
    );

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('syncUser', () => {
    const syncDto: SyncUserDto = {
      auth0UserId: 'auth0|123456',
      email: 'test@example.com',
      name: 'Test User',
    };

    it('should update existing user and return DTO', async () => {
      userRepository.findByAuth0UserId.mockResolvedValue(mockUser);
      userRepository.saveEntity.mockResolvedValue({
        ...mockUser,
        lastLoginAt: new Date(),
      });

      const result = await service.syncUser(syncDto);

      expect(userRepository.findByAuth0UserId).toHaveBeenCalledWith(
        'auth0|123456',
      );
      expect(userRepository.saveEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockUser.id,
          auth0UserId: mockUser.auth0UserId,
          email: syncDto.email,
          name: syncDto.name,
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: mockUser.id,
          auth0UserId: mockUser.auth0UserId,
          email: 'test@example.com',
          name: 'Test User',
          isActive: true,
        }),
      );
    });

    it('should create new user when not found', async () => {
      userRepository.findByAuth0UserId.mockResolvedValue(null);
      userRepository.save.mockResolvedValue({
        ...mockUser,
        id: 'new-user-uuid',
      });
      roleRepository.findByName.mockResolvedValue({
        id: 'role-uuid',
        name: 'user',
        description: 'User role',
        isSystemRole: true,
        createdAt: mockDate,
        updatedAt: mockDate,
      });
      roleRepository.findWithPermissions.mockResolvedValue({
        id: 'role-uuid',
        name: 'user',
        permissions: [],
      });
      userRepository.findByIdWithRelations.mockResolvedValue({
        ...mockUser,
        id: 'new-user-uuid',
        roles: [],
        sectors: [],
      });
      userRepository.saveModel.mockResolvedValue({});
      userRepository.findByIdWithRoles.mockResolvedValue({
        ...mockUser,
        id: 'new-user-uuid',
        roles: [{ id: 'role-uuid', name: 'user' }],
      });

      const result = await service.syncUser(syncDto);

      expect(userRepository.findByAuth0UserId).toHaveBeenCalledWith(
        'auth0|123456',
      );
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          auth0UserId: syncDto.auth0UserId,
          email: syncDto.email,
          name: syncDto.name,
          isActive: true,
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: 'new-user-uuid',
          auth0UserId: 'auth0|123456',
        }),
      );
    });

    it('should propagate errors from repository', async () => {
      userRepository.findByAuth0UserId.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(service.syncUser(syncDto)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should include lastLoginAt in the save call', async () => {
      userRepository.findByAuth0UserId.mockResolvedValue(mockUser);
      userRepository.saveEntity.mockResolvedValue(mockUser);

      await service.syncUser(syncDto);

      expect(userRepository.saveEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          lastLoginAt: expect.any(Date),
        }),
      );
    });

    it('should include updatedAt when updating existing user', async () => {
      userRepository.findByAuth0UserId.mockResolvedValue(mockUser);
      userRepository.saveEntity.mockResolvedValue(mockUser);

      await service.syncUser(syncDto);

      expect(userRepository.saveEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should preserve isActive=false when syncing inactive user', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      userRepository.findByAuth0UserId.mockResolvedValue(inactiveUser);
      userRepository.saveEntity.mockResolvedValue(inactiveUser);

      const result = await service.syncUser(syncDto);

      expect(userRepository.saveEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockUser.id,
          isActive: false,
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          isActive: false,
        }),
      );
    });
  });

  describe('findByAuth0UserId', () => {
    it('should return user DTO when user exists', async () => {
      userRepository.findByAuth0UserId.mockResolvedValue(mockUser);

      const result = await service.findByAuth0UserId('auth0|123456');

      expect(userRepository.findByAuth0UserId).toHaveBeenCalledWith(
        'auth0|123456',
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: 'user-uuid-123',
          auth0UserId: 'auth0|123456',
          email: 'test@example.com',
          name: 'Test User',
          isActive: true,
          createdAt: mockDate,
          lastLoginAt: mockDate,
        }),
      );
    });

    it('should return null when user does not exist', async () => {
      userRepository.findByAuth0UserId.mockResolvedValue(null);

      const result = await service.findByAuth0UserId('auth0|nonexistent');

      expect(userRepository.findByAuth0UserId).toHaveBeenCalledWith(
        'auth0|nonexistent',
      );
      expect(result).toBeNull();
    });

    it('should propagate errors from repository', async () => {
      userRepository.findByAuth0UserId.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(
        service.findByAuth0UserId('auth0|123456'),
      ).rejects.toThrow('DB error');
    });
  });

  describe('getUserById', () => {
    it('should return user DTO when user exists', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      const result = await service.getUserById('user-uuid-123');

      expect(userRepository.findById).toHaveBeenCalledWith('user-uuid-123');
      expect(result).toEqual(
        expect.objectContaining({
          id: 'user-uuid-123',
          auth0UserId: 'auth0|123456',
          email: 'test@example.com',
        }),
      );
    });

    it('should return null when user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null);

      const result = await service.getUserById('nonexistent-id');

      expect(userRepository.findById).toHaveBeenCalledWith('nonexistent-id');
      expect(result).toBeNull();
    });

    it('should propagate errors from repository', async () => {
      userRepository.findById.mockRejectedValue(new Error('DB error'));

      await expect(service.getUserById('user-uuid-123')).rejects.toThrow(
        'DB error',
      );
    });
  });

  describe('acceptPendingInvitation (via syncUser for new users)', () => {
    const syncDto: SyncUserDto = {
      auth0UserId: 'auth0|new-invited-user',
      email: 'invited@example.com',
      name: 'Invited User',
    };

    const mockNewUser = {
      id: 'invited-user-uuid',
      auth0UserId: 'auth0|new-invited-user',
      email: 'invited@example.com',
      name: 'Invited User',
      isActive: true,
      createdAt: mockDate,
      updatedAt: mockDate,
      lastLoginAt: mockDate,
      roles: [],
    };

    const mockInvitation = {
      id: 'invitation-uuid',
      email: 'invited@example.com',
      role: 'user',
      sectors: [{ id: 'sector-uuid-1', name: 'Sector A' }],
    };

    const mockRoleDomain = {
      id: 'role-uuid',
      name: 'user',
      description: 'Regular user',
      isSystemRole: true,
      createdAt: mockDate,
      updatedAt: mockDate,
    };

    const mockRoleModel = {
      id: 'role-uuid',
      name: 'user',
      description: 'Regular user',
      isSystemRole: true,
      permissions: [],
      createdAt: mockDate,
      updatedAt: mockDate,
    };

    it('should assign role and sectors from invitation for new users', async () => {
      const mockInvitationService = {
        findPendingByEmail: jest.fn().mockResolvedValue(mockInvitation),
        markAccepted: jest.fn().mockResolvedValue(undefined),
      };

      const serviceWithInvitations = new UserService(
        userRepository,
        roleRepository,
        sectorRepository,
        mockInvitationService,
        eventEmitter,
      );

      // User not found → new user
      userRepository.findByAuth0UserId.mockResolvedValue(null);
      userRepository.save.mockResolvedValue(mockNewUser);

      // Role lookup
      roleRepository.findByName.mockResolvedValue(mockRoleDomain);
      roleRepository.findWithPermissions.mockResolvedValue(mockRoleModel);

      // User with relations for sector/role assignment
      const userWithRelations = {
        ...mockNewUser,
        roles: [],
        sectors: [],
      };
      userRepository.findByIdWithRelations.mockResolvedValue(
        userWithRelations,
      );
      userRepository.saveModel.mockResolvedValue(userWithRelations);

      // findByIdWithRoles for the response
      userRepository.findByIdWithRoles.mockResolvedValue({
        ...mockNewUser,
        roles: [mockRoleModel],
      });

      const result = await serviceWithInvitations.syncUser(syncDto);

      // Verify role was assigned
      expect(roleRepository.findByName).toHaveBeenCalledWith('user');
      expect(roleRepository.findWithPermissions).toHaveBeenCalledWith(
        'role-uuid',
      );

      // Verify sectors were assigned
      expect(userRepository.saveModel).toHaveBeenCalledWith(
        expect.objectContaining({
          roles: [mockRoleModel],
          sectors: expect.arrayContaining([
            expect.objectContaining({ id: 'sector-uuid-1' }),
          ]),
        }),
      );

      // Verify invitation was marked as accepted
      expect(mockInvitationService.markAccepted).toHaveBeenCalledWith(
        'invitation-uuid',
      );

      // Verify event was emitted
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'user.activated',
        expect.anything(),
      );

      expect(result.roles).toEqual(['user']);
    });
  });

  describe('mapToDto (tested via public methods)', () => {
    it('should map all fields correctly', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      const result = await service.getUserById('user-uuid-123');

      expect(result).toEqual({
        id: 'user-uuid-123',
        auth0UserId: 'auth0|123456',
        email: 'test@example.com',
        name: 'Test User',
        isActive: true,
        roles: [],
        createdAt: mockDate,
        lastLoginAt: mockDate,
      });
    });

    it('should handle null lastLoginAt', async () => {
      const userWithoutLogin = { ...mockUser, lastLoginAt: null };
      userRepository.findById.mockResolvedValue(userWithoutLogin);

      const result = await service.getUserById('user-uuid-123');

      expect(result).toEqual(
        expect.objectContaining({
          lastLoginAt: null,
        }),
      );
    });
  });
});

