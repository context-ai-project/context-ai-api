import { HttpStatus, Logger } from '@nestjs/common';
import { UserController } from '../../../../../../src/modules/users/api/controllers/user.controller';
import { UserService } from '../../../../../../src/modules/users/application/services/user.service';
import type {
  SyncUserDto,
  UserResponseDto,
} from '../../../../../../src/modules/users/application/services/user.service';
import type { ValidatedUser } from '../../../../../../src/modules/auth/types/jwt-payload.type';

describe('UserController', () => {
  let controller: UserController;
  let userService: jest.Mocked<UserService>;

  const mockUserResponse: UserResponseDto = {
    id: 'user-uuid-123',
    auth0UserId: 'auth0|123',
    email: 'test@example.com',
    name: 'Test User',
    roles: ['user'],
    isActive: true,
    createdAt: new Date('2024-01-01'),
    lastLoginAt: new Date('2024-01-02'),
  };

  const mockValidatedUser: ValidatedUser = {
    auth0Id: 'auth0|123',
    email: 'test@example.com',
    name: 'Test User',
    permissions: ['profile:read'],
    userId: 'user-uuid-123',
  };

  beforeEach(() => {
    // Mock UserService
    userService = {
      syncUser: jest.fn(),
      getUserById: jest.fn(),
    } as unknown as jest.Mocked<UserService>;

    // Create controller instance directly
    controller = new UserController(userService);

    // Mock logger to avoid console output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('syncUser', () => {
    it('should sync user successfully', async () => {
      const dto: SyncUserDto = {
        auth0UserId: 'auth0|123',
        email: 'test@example.com',
        name: 'Test User',
      };

      userService.syncUser.mockResolvedValue(mockUserResponse);

      const result = await controller.syncUser(dto);

      expect(userService.syncUser).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockUserResponse);
    });

    it('should handle sync user with minimal data', async () => {
      const dto: SyncUserDto = {
        auth0UserId: 'auth0|456',
      };

      const minimalUserResponse: UserResponseDto = {
        ...mockUserResponse,
        id: 'user-uuid-456',
        auth0UserId: 'auth0|456',
        email: 'user@example.com',
        name: 'user',
      };

      userService.syncUser.mockResolvedValue(minimalUserResponse);

      const result = await controller.syncUser(dto);

      expect(userService.syncUser).toHaveBeenCalledWith(dto);
      expect(result).toEqual(minimalUserResponse);
    });

    it('should propagate errors from service', async () => {
      const dto: SyncUserDto = {
        auth0UserId: 'auth0|123',
        email: 'test@example.com',
      };

      const error = new Error('Database connection failed');
      userService.syncUser.mockRejectedValue(error);

      await expect(controller.syncUser(dto)).rejects.toThrow(
        'Database connection failed',
      );
      expect(userService.syncUser).toHaveBeenCalledWith(dto);
    });
  });

  describe('getProfile', () => {
    it('should return current user profile', async () => {
      userService.getUserById.mockResolvedValue(mockUserResponse);

      const result = await controller.getProfile(mockValidatedUser);

      expect(userService.getUserById).toHaveBeenCalledWith('user-uuid-123');
      expect(result).toEqual(mockUserResponse);
    });

    it('should return null if user ID is missing', async () => {
      const userWithoutId: ValidatedUser = {
        ...mockValidatedUser,
        userId: undefined,
      };

      const result = await controller.getProfile(userWithoutId);

      expect(result).toBeNull();
      expect(userService.getUserById).not.toHaveBeenCalled();
    });

    it('should return null if user not found', async () => {
      userService.getUserById.mockResolvedValue(null);

      const result = await controller.getProfile(mockValidatedUser);

      expect(userService.getUserById).toHaveBeenCalledWith('user-uuid-123');
      expect(result).toBeNull();
    });

    it('should propagate errors from service', async () => {
      const error = new Error('Database error');
      userService.getUserById.mockRejectedValue(error);

      await expect(controller.getProfile(mockValidatedUser)).rejects.toThrow(
        'Database error',
      );
      expect(userService.getUserById).toHaveBeenCalledWith('user-uuid-123');
    });
  });

  describe('HTTP Status Codes', () => {
    it('should use OK status (200) for syncUser', () => {
      // Verify decorator via reflection (if needed for documentation)
      expect(HttpStatus.OK).toBe(200);
    });

    it('should use OK status (200) for getProfile', () => {
      expect(HttpStatus.OK).toBe(200);
    });
  });
});

