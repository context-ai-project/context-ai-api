import { Logger } from '@nestjs/common';
import { UserService } from '../../../../../../src/modules/users/application/services/user.service';
import type { SyncUserDto } from '../../../../../../src/modules/users/application/services/user.service';
import { UserRepository } from '../../../../../../src/modules/users/infrastructure/persistence/repositories/user.repository';

describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<UserRepository>;

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
      findByIdWithRoles: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    service = new UserService(userRepository);

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
      userRepository.save.mockResolvedValue({
        ...mockUser,
        lastLoginAt: new Date(),
      });

      const result = await service.syncUser(syncDto);

      expect(userRepository.findByAuth0UserId).toHaveBeenCalledWith(
        'auth0|123456',
      );
      expect(userRepository.save).toHaveBeenCalledWith(
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
      userRepository.save.mockResolvedValue(mockUser);

      await service.syncUser(syncDto);

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lastLoginAt: expect.any(Date),
        }),
      );
    });

    it('should include updatedAt when updating existing user', async () => {
      userRepository.findByAuth0UserId.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);

      await service.syncUser(syncDto);

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          updatedAt: expect.any(Date),
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

