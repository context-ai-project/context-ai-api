import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserRepository } from '../../../../../../../src/modules/users/infrastructure/persistence/repositories/user.repository';
import { UserModel } from '../../../../../../../src/modules/users/infrastructure/persistence/models/user.model';
import { User } from '../../../../../../../src/modules/users/domain/entities/user.entity';

describe('UserRepository', () => {
  let repository: UserRepository;
  let mockTypeOrmRepo: Record<string, jest.Mock>;

  const mockDate = new Date('2024-01-01T00:00:00Z');

  const mockUserModel: UserModel = {
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

  beforeEach(async () => {
    mockTypeOrmRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRepository,
        {
          provide: getRepositoryToken(UserModel),
          useValue: mockTypeOrmRepo,
        },
      ],
    }).compile();

    repository = module.get<UserRepository>(UserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findByAuth0UserId', () => {
    it('should return a User domain entity when found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockUserModel);

      const result = await repository.findByAuth0UserId('auth0|123456');

      expect(result).toBeInstanceOf(User);
      expect(result?.id).toBe('user-uuid-123');
      expect(result?.auth0UserId).toBe('auth0|123456');
      expect(result?.email).toBe('test@example.com');
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { auth0UserId: 'auth0|123456' },
      });
    });

    it('should return null when not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findByAuth0UserId('auth0|nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should return a User domain entity when found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockUserModel);

      const result = await repository.findByEmail('test@example.com');

      expect(result).toBeInstanceOf(User);
      expect(result?.email).toBe('test@example.com');
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null when not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return a User domain entity when found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockUserModel);

      const result = await repository.findById('user-uuid-123');

      expect(result).toBeInstanceOf(User);
      expect(result?.id).toBe('user-uuid-123');
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-uuid-123' },
      });
    });

    it('should return null when not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByIdWithRoles', () => {
    it('should return UserModel with roles relation when found', async () => {
      const modelWithRoles = { ...mockUserModel, roles: [{ id: 'role-1', name: 'user' }] };
      mockTypeOrmRepo.findOne.mockResolvedValue(modelWithRoles);

      const result = await repository.findByIdWithRoles('user-uuid-123');

      expect(result).toEqual(modelWithRoles);
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-uuid-123' },
        relations: ['roles'],
      });
    });

    it('should return null when not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findByIdWithRoles('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('should create and save a user model, returning domain entity', async () => {
      const partialUser = {
        auth0UserId: 'auth0|new',
        email: 'new@example.com',
        name: 'New User',
      };

      mockTypeOrmRepo.create.mockReturnValue({ ...mockUserModel, ...partialUser });
      mockTypeOrmRepo.save.mockResolvedValue({ ...mockUserModel, ...partialUser });

      const result = await repository.save(partialUser);

      expect(result).toBeInstanceOf(User);
      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith(partialUser);
      expect(mockTypeOrmRepo.save).toHaveBeenCalled();
    });

    it('should handle save errors', async () => {
      mockTypeOrmRepo.create.mockReturnValue(mockUserModel);
      mockTypeOrmRepo.save.mockRejectedValue(new Error('Unique constraint violation'));

      await expect(repository.save({})).rejects.toThrow(
        'Unique constraint violation',
      );
    });
  });

  describe('toDomain mapping', () => {
    it('should correctly map all fields from model to domain entity', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockUserModel);

      const result = await repository.findById('user-uuid-123');

      expect(result).toBeInstanceOf(User);
      expect(result?.id).toBe(mockUserModel.id);
      expect(result?.auth0UserId).toBe(mockUserModel.auth0UserId);
      expect(result?.email).toBe(mockUserModel.email);
      expect(result?.name).toBe(mockUserModel.name);
      expect(result?.isActive).toBe(mockUserModel.isActive);
      expect(result?.createdAt).toEqual(mockUserModel.createdAt);
      expect(result?.updatedAt).toEqual(mockUserModel.updatedAt);
      expect(result?.lastLoginAt).toEqual(mockUserModel.lastLoginAt);
    });

    it('should handle null lastLoginAt', async () => {
      const modelWithNullLogin = { ...mockUserModel, lastLoginAt: null };
      mockTypeOrmRepo.findOne.mockResolvedValue(modelWithNullLogin);

      const result = await repository.findById('user-uuid-123');

      expect(result?.lastLoginAt).toBeNull();
    });
  });
});

