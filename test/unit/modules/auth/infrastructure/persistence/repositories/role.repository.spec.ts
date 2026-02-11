import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RoleRepository } from '../../../../../../../src/modules/auth/infrastructure/persistence/repositories/role.repository';
import { RoleModel } from '../../../../../../../src/modules/auth/infrastructure/persistence/models/role.model';
import { Role } from '../../../../../../../src/modules/auth/domain/entities/role.entity';

describe('RoleRepository', () => {
  let repository: RoleRepository;
  let mockTypeOrmRepo: Record<string, jest.Mock>;

  const mockDate = new Date('2024-01-01T00:00:00Z');

  const mockRoleModel: RoleModel = {
    id: 'role-uuid-1',
    name: 'user',
    description: 'Basic user role',
    isSystemRole: true,
    createdAt: mockDate,
    updatedAt: mockDate,
    users: [],
    permissions: [],
  };

  beforeEach(async () => {
    mockTypeOrmRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleRepository,
        {
          provide: getRepositoryToken(RoleModel),
          useValue: mockTypeOrmRepo,
        },
      ],
    }).compile();

    repository = module.get<RoleRepository>(RoleRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findByName', () => {
    it('should return Role when found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockRoleModel);

      const result = await repository.findByName('user');

      expect(result).toBeInstanceOf(Role);
      expect(result?.name).toBe('user');
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { name: 'user' },
      });
    });

    it('should return null when not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findByName('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return Role when found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockRoleModel);

      const result = await repository.findById('role-uuid-1');

      expect(result).toBeInstanceOf(Role);
      expect(result?.id).toBe('role-uuid-1');
    });

    it('should return null when not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByIds', () => {
    it('should return array of roles for given IDs', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([mockRoleModel]);

      const result = await repository.findByIds(['role-uuid-1']);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(Role);
    });

    it('should return empty array when no roles match', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([]);

      const result = await repository.findByIds(['nonexistent']);

      expect(result).toEqual([]);
    });
  });

  describe('findAll', () => {
    it('should return all roles', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([mockRoleModel]);

      const result = await repository.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(Role);
    });
  });

  describe('findWithPermissions', () => {
    it('should return RoleModel with permissions relation', async () => {
      const modelWithPerms = { ...mockRoleModel, permissions: [{ id: 'p1', name: 'chat:read' }] };
      mockTypeOrmRepo.findOne.mockResolvedValue(modelWithPerms);

      const result = await repository.findWithPermissions('role-uuid-1');

      expect(result).toEqual(modelWithPerms);
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'role-uuid-1' },
        relations: ['permissions'],
      });
    });

    it('should return null when not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findWithPermissions('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findManyWithPermissions', () => {
    it('should return RoleModels with permissions', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([mockRoleModel]);

      const result = await repository.findManyWithPermissions(['role-uuid-1']);

      expect(result).toHaveLength(1);
      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({
        where: { id: expect.anything() },
        relations: ['permissions'],
      });
    });
  });

  describe('save', () => {
    it('should create and save role', async () => {
      mockTypeOrmRepo.create.mockReturnValue(mockRoleModel);
      mockTypeOrmRepo.save.mockResolvedValue(mockRoleModel);

      const result = await repository.save({ name: 'custom', description: 'Custom role' });

      expect(result).toBeInstanceOf(Role);
      expect(mockTypeOrmRepo.create).toHaveBeenCalled();
      expect(mockTypeOrmRepo.save).toHaveBeenCalled();
    });
  });

  describe('toDomain mapping', () => {
    it('should handle empty description', async () => {
      const modelWithNoDesc = { ...mockRoleModel, description: '' };
      mockTypeOrmRepo.findOne.mockResolvedValue(modelWithNoDesc);

      const result = await repository.findById('role-uuid-1');

      expect(result?.description).toBe('');
    });

    it('should handle null description', async () => {
      const modelWithNullDesc = { ...mockRoleModel, description: null };
      mockTypeOrmRepo.findOne.mockResolvedValue(modelWithNullDesc);

      const result = await repository.findById('role-uuid-1');

      expect(result?.description).toBe('');
    });
  });
});

