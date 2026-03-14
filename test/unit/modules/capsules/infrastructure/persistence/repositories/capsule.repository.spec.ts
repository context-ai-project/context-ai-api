import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CapsuleRepository } from '../../../../../../../src/modules/capsules/infrastructure/persistence/repositories/capsule.repository';
import { CapsuleModel } from '../../../../../../../src/modules/capsules/infrastructure/persistence/models/capsule.model';
import { Capsule } from '../../../../../../../src/modules/capsules/domain/entities/capsule.entity';
import { CapsuleStatus } from '@shared/types/enums/capsule-status.enum';
import { CapsuleType } from '@shared/types/enums/capsule-type.enum';

const CAPSULE_ID = '550e8400-e29b-41d4-a716-446655440000';
const SECTOR_ID = '660e8400-e29b-41d4-a716-446655440001';
const USER_ID = '770e8400-e29b-41d4-a716-446655440002';
const SOURCE_ID_1 = '880e8400-e29b-41d4-a716-446655440003';
const SOURCE_ID_2 = '990e8400-e29b-41d4-a716-446655440004';
const NOW = new Date('2026-01-15T12:00:00Z');

function createModel(overrides?: Partial<CapsuleModel>): CapsuleModel {
  const model = new CapsuleModel();
  model.id = CAPSULE_ID;
  model.title = 'Test Capsule';
  model.description = 'A test capsule';
  model.sectorId = SECTOR_ID;
  model.type = CapsuleType.AUDIO;
  model.status = CapsuleStatus.DRAFT;
  model.introText = null;
  model.script = null;
  model.audioUrl = null;
  model.videoUrl = null;
  model.thumbnailUrl = null;
  model.durationSeconds = null;
  model.audioVoiceId = null;
  model.language = null;
  model.generationMetadata = null;
  model.createdBy = USER_ID;
  model.publishedAt = null;
  model.createdAt = NOW;
  model.updatedAt = NOW;
  Object.assign(model, overrides);
  return model;
}

describe('CapsuleRepository', () => {
  let repository: CapsuleRepository;

  const mockQueryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getMany: jest.fn(),
  };

  const mockTypeOrmRepo = {
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  const mockDataSource = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CapsuleRepository,
        { provide: getRepositoryToken(CapsuleModel), useValue: mockTypeOrmRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    repository = module.get<CapsuleRepository>(CapsuleRepository);
    jest.clearAllMocks();
    mockTypeOrmRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
  });

  describe('save', () => {
    it('should save and return domain entity', async () => {
      const model = createModel();
      mockTypeOrmRepo.save.mockResolvedValue(model);

      const capsule = new Capsule({
        title: 'Test Capsule',
        sectorId: SECTOR_ID,
        type: CapsuleType.AUDIO,
        createdBy: USER_ID,
      });

      const result = await repository.save(capsule);

      expect(result.title).toBe('Test Capsule');
      expect(mockTypeOrmRepo.save).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return domain entity when found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(createModel());

      const result = await repository.findById(CAPSULE_ID);

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Test Capsule');
    });

    it('should return null when not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return paginated results with no filters', async () => {
      const models = [createModel()];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([models, 1]);

      const result = await repository.findAll({}, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should apply sectorId filter', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await repository.findAll({ sectorId: SECTOR_ID }, { page: 1, limit: 10 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'capsule.sector_id = :sectorId',
        { sectorId: SECTOR_ID },
      );
    });

    it('should apply status filter', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await repository.findAll(
        { status: CapsuleStatus.DRAFT },
        { page: 1, limit: 10 },
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'capsule.status = :status',
        { status: CapsuleStatus.DRAFT },
      );
    });

    it('should apply type filter', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await repository.findAll(
        { type: CapsuleType.VIDEO },
        { page: 1, limit: 10 },
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'capsule.type = :type',
        { type: CapsuleType.VIDEO },
      );
    });

    it('should apply createdBy filter', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await repository.findAll({ createdBy: USER_ID }, { page: 1, limit: 10 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'capsule.created_by = :createdBy',
        { createdBy: USER_ID },
      );
    });

    it('should apply search filter', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await repository.findAll({ search: 'test' }, { page: 1, limit: 10 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'LOWER(capsule.title) LIKE LOWER(:search)',
        { search: '%test%' },
      );
    });

    it('should apply excludeArchived filter', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await repository.findAll(
        { excludeArchived: true },
        { page: 1, limit: 10 },
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'capsule.status != :archived',
        { archived: CapsuleStatus.ARCHIVED },
      );
    });

    it('should calculate correct skip offset for page 2', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await repository.findAll({}, { page: 2, limit: 10 });

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });
  });

  describe('findBySectorId', () => {
    it('should return capsules for a sector', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([createModel()]);

      const result = await repository.findBySectorId(SECTOR_ID);

      expect(result).toHaveLength(1);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'capsule.sector_id = :sectorId',
        { sectorId: SECTOR_ID },
      );
    });

    it('should apply status filter when provided', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await repository.findBySectorId(SECTOR_ID, {
        status: CapsuleStatus.ACTIVE,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'capsule.status = :status',
        { status: CapsuleStatus.ACTIVE },
      );
    });

    it('should apply type filter when provided', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await repository.findBySectorId(SECTOR_ID, {
        type: CapsuleType.VIDEO,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'capsule.type = :type',
        { type: CapsuleType.VIDEO },
      );
    });

    it('should not apply optional filters when not provided', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await repository.findBySectorId(SECTOR_ID);

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft-delete by setting status to ARCHIVED', async () => {
      mockTypeOrmRepo.update.mockResolvedValue({ affected: 1 });

      await repository.delete(CAPSULE_ID);

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(CAPSULE_ID, {
        status: CapsuleStatus.ARCHIVED,
      });
    });
  });

  describe('addSources', () => {
    it('should insert source associations via raw SQL', async () => {
      mockDataSource.query.mockResolvedValue(undefined);

      await repository.addSources(CAPSULE_ID, [SOURCE_ID_1, SOURCE_ID_2]);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO capsule_sources'),
        expect.arrayContaining([CAPSULE_ID, SOURCE_ID_1, CAPSULE_ID, SOURCE_ID_2]),
      );
    });

    it('should skip query when sourceIds is empty', async () => {
      await repository.addSources(CAPSULE_ID, []);

      expect(mockDataSource.query).not.toHaveBeenCalled();
    });
  });

  describe('getSources', () => {
    it('should return mapped source references', async () => {
      mockDataSource.query.mockResolvedValue([
        { id: SOURCE_ID_1, title: 'Source 1', source_type: 'PDF' },
        { id: SOURCE_ID_2, title: 'Source 2', source_type: 'DOCX' },
      ]);

      const result = await repository.getSources(CAPSULE_ID);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: SOURCE_ID_1,
        title: 'Source 1',
        sourceType: 'PDF',
      });
    });
  });

  describe('countBySectorAndStatus', () => {
    it('should return count', async () => {
      mockTypeOrmRepo.count.mockResolvedValue(5);

      const result = await repository.countBySectorAndStatus(
        SECTOR_ID,
        CapsuleStatus.ACTIVE,
      );

      expect(result).toBe(5);
    });
  });

  describe('countVideoCapsulesThisMonth', () => {
    it('should return parsed count from raw query', async () => {
      mockDataSource.query.mockResolvedValue([{ count: '7' }]);

      const result = await repository.countVideoCapsulesThisMonth();

      expect(result).toBe(7);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*)'),
        [CapsuleType.VIDEO, CapsuleStatus.ARCHIVED],
      );
    });
  });
});
