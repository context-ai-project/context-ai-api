import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PermissionRepository } from '../../../../../../../src/modules/auth/infrastructure/persistence/repositories/permission.repository';
import { PermissionModel } from '../../../../../../../src/modules/auth/infrastructure/persistence/models/permission.model';
import { Permission } from '../../../../../../../src/modules/auth/domain/entities/permission.entity';

describe('PermissionRepository', () => {
  let repository: PermissionRepository;
  let mockTypeOrmRepo: Record<string, jest.Mock>;

  const mockDate = new Date('2024-01-01T00:00:00Z');

  const mockPermissionModel: PermissionModel = {
    id: 'perm-uuid-1',
    name: 'chat:read',
    description: 'Read chat messages',
    resource: 'chat',
    action: 'read',
    isSystemPermission: true,
    createdAt: mockDate,
    updatedAt: mockDate,
    roles: [],
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
        PermissionRepository,
        {
          provide: getRepositoryToken(PermissionModel),
          useValue: mockTypeOrmRepo,
        },
      ],
    }).compile();

    repository = module.get<PermissionRepository>(PermissionRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findByName', () => {
    it('should return Permission when found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockPermissionModel);

      const result = await repository.findByName('chat:read');

      expect(result).toBeInstanceOf(Permission);
      expect(result?.name).toBe('chat:read');
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { name: 'chat:read' },
      });
    });

    it('should return null when not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findByName('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return Permission when found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockPermissionModel);

      const result = await repository.findById('perm-uuid-1');

      expect(result).toBeInstanceOf(Permission);
      expect(result?.id).toBe('perm-uuid-1');
    });

    it('should return null when not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByResource', () => {
    it('should return array of permissions for resource', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([mockPermissionModel]);

      const result = await repository.findByResource('chat');

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(Permission);
      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({
        where: { resource: 'chat' },
      });
    });

    it('should return empty array when no permissions found', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([]);

      const result = await repository.findByResource('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('findAll', () => {
    it('should return all permissions', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([mockPermissionModel]);

      const result = await repository.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(Permission);
    });
  });

  describe('save', () => {
    it('should create and save permission', async () => {
      mockTypeOrmRepo.create.mockReturnValue(mockPermissionModel);
      mockTypeOrmRepo.save.mockResolvedValue(mockPermissionModel);

      const result = await repository.save({
        name: 'chat:read',
        resource: 'chat',
        action: 'read',
      });

      expect(result).toBeInstanceOf(Permission);
      expect(mockTypeOrmRepo.create).toHaveBeenCalled();
      expect(mockTypeOrmRepo.save).toHaveBeenCalled();
    });
  });

  describe('toDomain mapping', () => {
    it('should handle empty description', async () => {
      const modelWithNoDesc = { ...mockPermissionModel, description: '' };
      mockTypeOrmRepo.findOne.mockResolvedValue(modelWithNoDesc);

      const result = await repository.findById('perm-uuid-1');

      expect(result?.description).toBe('');
    });

    it('should handle null description', async () => {
      const modelWithNullDesc = { ...mockPermissionModel, description: null };
      mockTypeOrmRepo.findOne.mockResolvedValue(modelWithNullDesc);

      const result = await repository.findById('perm-uuid-1');

      expect(result?.description).toBe('');
    });
  });
});

