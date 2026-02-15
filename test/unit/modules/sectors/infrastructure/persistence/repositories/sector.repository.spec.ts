import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SectorRepository } from '../../../../../../../src/modules/sectors/infrastructure/persistence/repositories/sector.repository';
import { SectorModel } from '../../../../../../../src/modules/sectors/infrastructure/persistence/models/sector.model';
import { Sector } from '../../../../../../../src/modules/sectors/domain/entities/sector.entity';
import { SectorIcon, SectorStatus } from '@shared/types';

describe('SectorRepository', () => {
  let repository: SectorRepository;

  const sectorId = '550e8400-e29b-41d4-a716-446655440000';
  const now = new Date('2025-06-01T12:00:00Z');

  function createModel(overrides?: Partial<SectorModel>): SectorModel {
    const model = new SectorModel();
    model.id = sectorId;
    model.name = 'Human Resources';
    model.description = 'Company policies';
    model.icon = SectorIcon.USERS;
    model.status = SectorStatus.ACTIVE;
    model.createdAt = now;
    model.updatedAt = now;
    Object.assign(model, overrides);
    return model;
  }

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getCount: jest.fn(),
  };

  const mockTypeOrmRepo = {
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SectorRepository,
        { provide: getRepositoryToken(SectorModel), useValue: mockTypeOrmRepo },
      ],
    }).compile();

    repository = module.get<SectorRepository>(SectorRepository);
    jest.clearAllMocks();
    mockTypeOrmRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
  });

  describe('save', () => {
    it('should save and return domain entity', async () => {
      const model = createModel();
      mockTypeOrmRepo.save.mockResolvedValue(model);

      const sector = new Sector({ name: 'HR', description: 'Company policies and employee handbook', icon: SectorIcon.USERS });

      const result = await repository.save(sector);

      expect(result.name).toBe('Human Resources');
      expect(mockTypeOrmRepo.save).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return domain entity when found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(createModel());

      const result = await repository.findById(sectorId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(sectorId);
    });

    it('should return null when not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByName', () => {
    it('should return domain entity when found by name', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(createModel());

      const result = await repository.findByName('Human Resources');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Human Resources');
    });

    it('should return null when not found by name', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      const result = await repository.findByName('Nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all sectors as domain entities', async () => {
      const models = [createModel(), createModel({ id: '550e8400-e29b-41d4-a716-446655440001', name: 'IT' })];
      mockTypeOrmRepo.find.mockResolvedValue(models);

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
    });
  });

  describe('findAllActive', () => {
    it('should return only active sectors', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([createModel()]);

      const result = await repository.findAllActive();

      expect(result).toHaveLength(1);
      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: SectorStatus.ACTIVE } }),
      );
    });
  });

  describe('delete', () => {
    it('should delete by ID', async () => {
      mockTypeOrmRepo.delete.mockResolvedValue({ affected: 1 });

      await repository.delete(sectorId);

      expect(mockTypeOrmRepo.delete).toHaveBeenCalledWith(sectorId);
    });
  });

  describe('existsByName', () => {
    it('should return true when name exists', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(1);

      const result = await repository.existsByName('HR');

      expect(result).toBe(true);
    });

    it('should return false when name does not exist', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(0);

      const result = await repository.existsByName('Nonexistent');

      expect(result).toBe(false);
    });

    it('should exclude given ID from check', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(0);

      await repository.existsByName('HR', sectorId);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'sector.id != :excludeId',
        { excludeId: sectorId },
      );
    });
  });

  describe('countAll', () => {
    it('should return total count', async () => {
      mockTypeOrmRepo.count.mockResolvedValue(5);

      const result = await repository.countAll();

      expect(result).toBe(5);
    });
  });

  describe('countByStatus', () => {
    it('should return count for given status', async () => {
      mockTypeOrmRepo.count.mockResolvedValue(3);

      const result = await repository.countByStatus(SectorStatus.ACTIVE);

      expect(result).toBe(3);
      expect(mockTypeOrmRepo.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: SectorStatus.ACTIVE } }),
      );
    });
  });
});

