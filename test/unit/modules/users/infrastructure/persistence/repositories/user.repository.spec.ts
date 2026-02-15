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
    sectors: [],
  } as UserModel;

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  beforeEach(async () => {
    mockTypeOrmRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
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

  // ── New admin methods ────────────────────────────────────────────────────

  describe('countAll', () => {
    it('should return total user count', async () => {
      mockTypeOrmRepo.count.mockResolvedValue(42);

      const result = await repository.countAll();

      expect(result).toBe(42);
      expect(mockTypeOrmRepo.count).toHaveBeenCalled();
    });
  });

  describe('countRecent', () => {
    it('should count users created in last N days', async () => {
      mockTypeOrmRepo.count.mockResolvedValue(5);

      const result = await repository.countRecent(7);

      expect(result).toBe(5);
      expect(mockTypeOrmRepo.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({}) }),
      );
    });

    it('should default to 30 days', async () => {
      mockTypeOrmRepo.count.mockResolvedValue(10);

      const result = await repository.countRecent();

      expect(result).toBe(10);
    });
  });

  describe('findAllWithRelations', () => {
    it('should return all users with roles and sectors', async () => {
      const users = [mockUserModel];
      mockQueryBuilder.getMany.mockResolvedValue(users);

      const result = await repository.findAllWithRelations();

      expect(result).toEqual(users);
      expect(mockTypeOrmRepo.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('user.roles', 'role');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('user.sectors', 'sector');
    });

    it('should filter by search term when provided', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await repository.findAllWithRelations('john');

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        '(LOWER(user.name) LIKE LOWER(:term) OR LOWER(user.email) LIKE LOWER(:term))',
        { term: '%john%' },
      );
    });

    it('should not filter when search is empty', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await repository.findAllWithRelations('');

      expect(mockQueryBuilder.where).not.toHaveBeenCalled();
    });
  });

  describe('findByIdWithRelations', () => {
    it('should return user model with roles and sectors', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockUserModel);

      const result = await repository.findByIdWithRelations('user-uuid-123');

      expect(result).toEqual(mockUserModel);
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-uuid-123' },
        relations: ['roles', 'sectors'],
      });
    });

    it('should return null when not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findByIdWithRelations('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('saveModel', () => {
    it('should save and return the model directly', async () => {
      mockTypeOrmRepo.save.mockResolvedValue(mockUserModel);

      const result = await repository.saveModel(mockUserModel);

      expect(result).toEqual(mockUserModel);
      expect(mockTypeOrmRepo.save).toHaveBeenCalledWith(mockUserModel);
    });
  });
});

