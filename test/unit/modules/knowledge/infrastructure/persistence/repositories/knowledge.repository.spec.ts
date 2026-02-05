import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner, IsNull } from 'typeorm';
import { KnowledgeRepository } from '../../../../../../../src/modules/knowledge/infrastructure/persistence/repositories/knowledge.repository';
import { KnowledgeSourceModel } from '../../../../../../../src/modules/knowledge/infrastructure/persistence/models/knowledge-source.model';
import { FragmentModel } from '../../../../../../../src/modules/knowledge/infrastructure/persistence/models/fragment.model';
import { KnowledgeSource } from '../../../../../../../src/modules/knowledge/domain/entities/knowledge-source.entity';
import { Fragment } from '../../../../../../../src/modules/knowledge/domain/entities/fragment.entity';

// Import enums separately to ensure they're available
enum SourceType {
  PDF = 'PDF',
  MARKDOWN = 'MARKDOWN',
  TEXT = 'TEXT',
  URL = 'URL',
}

enum SourceStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

describe('KnowledgeRepository', () => {
  let repository: KnowledgeRepository;
  let sourceRepository: Repository<KnowledgeSourceModel>;
  let fragmentRepository: Repository<FragmentModel>;
  let dataSource: DataSource;

  // Mock repositories
  const mockSourceRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
  };

  const mockFragmentRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
    query: jest.fn(),
  };

  const mockQueryRunner: Partial<QueryRunner> = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    } as Partial<QueryRunner['manager']> as QueryRunner['manager'],
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeRepository,
        {
          provide: getRepositoryToken(KnowledgeSourceModel),
          useValue: mockSourceRepository,
        },
        {
          provide: getRepositoryToken(FragmentModel),
          useValue: mockFragmentRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    repository = module.get<KnowledgeRepository>(KnowledgeRepository);
    sourceRepository = module.get<Repository<KnowledgeSourceModel>>(
      getRepositoryToken(KnowledgeSourceModel),
    );
    fragmentRepository = module.get<Repository<FragmentModel>>(
      getRepositoryToken(FragmentModel),
    );
    dataSource = module.get<DataSource>(DataSource);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('KnowledgeSource Operations', () => {
    describe('saveSource', () => {
      it('should save a new knowledge source', async () => {
        // Arrange
        const source = new KnowledgeSource({
          title: 'Test Document',
          sectorId: 'sector-123',
          sourceType: SourceType.PDF,
          content: 'This is test content',
        });

        const savedModel = new KnowledgeSourceModel();
        savedModel.id = 'source-123';
        savedModel.title = source.title;
        savedModel.sectorId = source.sectorId;
        savedModel.sourceType = source.sourceType;
        savedModel.content = source.content;
        savedModel.status = source.status;
        savedModel.metadata = source.metadata;
        savedModel.createdAt = new Date();
        savedModel.updatedAt = new Date();
        savedModel.deletedAt = null;

        mockSourceRepository.save.mockResolvedValue(savedModel);

        // Act
        const result = await repository.saveSource(source);

        // Assert
        expect(result).toBeInstanceOf(KnowledgeSource);
        expect(result.id).toBe('source-123');
        expect(result.title).toBe('Test Document');
        expect(mockSourceRepository.save).toHaveBeenCalledTimes(1);
      });

      it('should update an existing knowledge source', async () => {
        // Arrange
        const source = new KnowledgeSource({
          title: 'Updated Document',
          sectorId: 'sector-123',
          sourceType: SourceType.PDF,
          content: 'Updated content',
        });
        Reflect.set(source, 'id', 'existing-source-123');

        const updatedModel = new KnowledgeSourceModel();
        updatedModel.id = source.id;
        updatedModel.title = source.title;
        updatedModel.sectorId = source.sectorId;
        updatedModel.sourceType = source.sourceType;
        updatedModel.content = source.content;
        updatedModel.status = source.status;
        updatedModel.metadata = source.metadata;
        updatedModel.createdAt = new Date();
        updatedModel.updatedAt = new Date();
        updatedModel.deletedAt = null;

        mockSourceRepository.save.mockResolvedValue(updatedModel);

        // Act
        const result = await repository.saveSource(source);

        // Assert
        expect(result.id).toBe('existing-source-123');
        expect(result.title).toBe('Updated Document');
        expect(mockSourceRepository.save).toHaveBeenCalledTimes(1);
      });
    });

    describe('findSourceById', () => {
      it('should find a knowledge source by ID', async () => {
        // Arrange
        const sourceId = 'source-123';
        const model = new KnowledgeSourceModel();
        model.id = sourceId;
        model.title = 'Test Document';
        model.sectorId = 'sector-123';
        model.sourceType = SourceType.PDF;
        model.content = 'Test content';
        model.status = SourceStatus.PENDING;
        model.metadata = {};
        model.createdAt = new Date();
        model.updatedAt = new Date();
        model.deletedAt = null;

        mockSourceRepository.findOne.mockResolvedValue(model);

        // Act
        const result = await repository.findSourceById(sourceId);

        // Assert
        expect(result).toBeInstanceOf(KnowledgeSource);
        expect(result?.id).toBe(sourceId);
        expect(mockSourceRepository.findOne).toHaveBeenCalledWith({
          where: { id: sourceId },
        });
      });

      it('should return null if knowledge source not found', async () => {
        // Arrange
        mockSourceRepository.findOne.mockResolvedValue(null);

        // Act
        const result = await repository.findSourceById('non-existent');

        // Assert
        expect(result).toBeNull();
      });
    });

    describe('findSourcesBySector', () => {
      it('should find all sources in a sector (excluding deleted)', async () => {
        // Arrange
        const sectorId = 'sector-123';
        const models = [
          createMockSourceModel('source-1', sectorId),
          createMockSourceModel('source-2', sectorId),
        ];

        mockSourceRepository.find.mockResolvedValue(models);

        // Act
        const result = await repository.findSourcesBySector(sectorId);

        // Assert
        expect(result).toHaveLength(2);
        expect(result[0]).toBeInstanceOf(KnowledgeSource);
        expect(mockSourceRepository.find).toHaveBeenCalledWith({
          where: { sectorId, deletedAt: IsNull() },
        });
      });

      it('should find all sources in a sector (including deleted)', async () => {
        // Arrange
        const sectorId = 'sector-123';
        const models = [
          createMockSourceModel('source-1', sectorId),
          createMockSourceModel('source-2', sectorId),
        ];

        mockSourceRepository.find.mockResolvedValue(models);

        // Act
        const result = await repository.findSourcesBySector(sectorId, true);

        // Assert
        expect(result).toHaveLength(2);
        expect(mockSourceRepository.find).toHaveBeenCalledWith({
          where: { sectorId },
          withDeleted: true,
        });
      });
    });

    describe('findSourcesByStatus', () => {
      it('should find sources by status', async () => {
        // Arrange
        const status = SourceStatus.PROCESSED;
        const models = [
          createMockSourceModel('source-1', 'sector-1'),
          createMockSourceModel('source-2', 'sector-2'),
        ];
        models.forEach((m) => (m.status = status));

        mockSourceRepository.find.mockResolvedValue(models);

        // Act
        const result = await repository.findSourcesByStatus(status);

        // Assert
        expect(result).toHaveLength(2);
        expect(result[0].status).toBe(status);
        expect(mockSourceRepository.find).toHaveBeenCalledWith({
          where: { status },
        });
      });
    });

    describe('deleteSource', () => {
      it('should delete a source', async () => {
        // Arrange
        const sourceId = 'source-123';
        mockSourceRepository.delete.mockResolvedValue({ affected: 1, raw: [] });

        // Act
        await repository.deleteSource(sourceId);

        // Assert
        expect(mockSourceRepository.delete).toHaveBeenCalledWith(sourceId);
      });
    });

    describe('countSourcesBySector', () => {
      it('should count sources in a sector', async () => {
        // Arrange
        const sectorId = 'sector-123';
        const expectedCount = 5;
        mockSourceRepository.count.mockResolvedValue(expectedCount);

        // Act
        const result = await repository.countSourcesBySector(sectorId);

        // Assert
        expect(result).toBe(expectedCount);
        expect(mockSourceRepository.count).toHaveBeenCalledWith({
          where: { sectorId, deletedAt: IsNull() },
        });
      });
    });
  });

  describe('Fragment Operations', () => {
    describe('saveFragments', () => {
      it('should save multiple fragments in batch', async () => {
        // Arrange
        const sourceId = '550e8400-e29b-41d4-a716-446655440000'; // Valid UUID
        const mockEmbedding = Array(768).fill(0.1);
        const fragments = [
          new Fragment({
            sourceId,
            content: 'This is test content for fragment 1',
            position: 0,
            embedding: mockEmbedding,
          }),
          new Fragment({
            sourceId,
            content: 'This is test content for fragment 2',
            position: 1,
            embedding: mockEmbedding,
          }),
          new Fragment({
            sourceId,
            content: 'This is test content for fragment 3',
            position: 2,
            embedding: mockEmbedding,
          }),
        ];

        const savedModels = fragments.map((f, i) => {
          const model = new FragmentModel();
          model.id = `fragment-${i}`;
          model.sourceId = f.sourceId;
          model.content = f.content;
          model.position = f.position;
          model.tokenCount = f.tokenCount;
          model.embedding = null;
          model.metadata = {};
          model.createdAt = new Date();
          model.updatedAt = new Date();
          return model;
        });

        mockFragmentRepository.save.mockResolvedValue(savedModels);

        // Act
        const result = await repository.saveFragments(fragments);

        // Assert
        expect(result).toHaveLength(3);
        expect(result[0]).toBeInstanceOf(Fragment);
        expect(mockFragmentRepository.save).toHaveBeenCalledTimes(1);
      });
    });

    describe('findFragmentById', () => {
      it('should find a fragment by ID', async () => {
        // Arrange
        const fragmentId = 'fragment-123';
        const model = createMockFragmentModel(fragmentId, 'source-1');

        mockFragmentRepository.findOne.mockResolvedValue(model);

        // Act
        const result = await repository.findFragmentById(fragmentId);

        // Assert
        expect(result).toBeInstanceOf(Fragment);
        expect(result?.id).toBe(fragmentId);
        expect(mockFragmentRepository.findOne).toHaveBeenCalledWith({
          where: { id: fragmentId },
        });
      });

      it('should return null if fragment not found', async () => {
        // Arrange
        mockFragmentRepository.findOne.mockResolvedValue(null);

        // Act
        const result = await repository.findFragmentById('non-existent');

        // Assert
        expect(result).toBeNull();
      });
    });

    describe('findFragmentsBySource', () => {
      it('should find fragments by source ordered by position', async () => {
        // Arrange
        const sourceId = '550e8400-e29b-41d4-a716-446655440000';
        const models = [
          createMockFragmentModel('frag-1', sourceId, 0),
          createMockFragmentModel('frag-2', sourceId, 1),
          createMockFragmentModel('frag-3', sourceId, 2),
        ];

        mockFragmentRepository.find.mockResolvedValue(models);

        // Act
        const result = await repository.findFragmentsBySource(sourceId);

        // Assert
        expect(result).toHaveLength(3);
        expect(result[0].position).toBe(0);
        expect(result[1].position).toBe(1);
        expect(result[2].position).toBe(2);
        expect(mockFragmentRepository.find).toHaveBeenCalledWith({
          where: { sourceId },
          order: { position: 'ASC' },
        });
      });

      it('should find fragments ordered by createdAt', async () => {
        // Arrange
        const sourceId = '550e8400-e29b-41d4-a716-446655440000';
        const models = [createMockFragmentModel('frag-1', sourceId, 0)];

        mockFragmentRepository.find.mockResolvedValue(models);

        // Act
        await repository.findFragmentsBySource(sourceId, 'createdAt');

        // Assert
        expect(mockFragmentRepository.find).toHaveBeenCalledWith({
          where: { sourceId },
          order: { createdAt: 'ASC' },
        });
      });
    });

    describe('vectorSearch', () => {
      it('should perform vector similarity search', async () => {
        // Arrange
        const embedding = Array(768).fill(0.1);
        const sectorId = 'sector-123';
        const limit = 5;
        const similarityThreshold = 0.7;
        const sourceId = '550e8400-e29b-41d4-a716-446655440000';

        // Mock results must be in snake_case (as returned by raw SQL query)
        const mockResults = [
          {
            id: 'frag-1',
            source_id: sourceId,
            content: 'This is test content for fragment frag-1 with sufficient length',
            embedding: null,
            position: 0,
            token_count: 100,
            metadata: {},
            created_at: new Date(),
            updated_at: new Date(),
            similarity: 0.95,
          },
          {
            id: 'frag-2',
            source_id: sourceId,
            content: 'This is test content for fragment frag-2 with sufficient length',
            embedding: null,
            position: 1,
            token_count: 100,
            metadata: {},
            created_at: new Date(),
            updated_at: new Date(),
            similarity: 0.85,
          },
        ];

        mockFragmentRepository.query.mockResolvedValue(mockResults);

        // Act
        const result = await repository.vectorSearch(
          embedding,
          sectorId,
          limit,
          similarityThreshold,
        );

        // Assert
        expect(result).toHaveLength(2);
        expect(result[0].similarity).toBe(0.95);
        expect(result[1].similarity).toBe(0.85);
        expect(mockFragmentRepository.query).toHaveBeenCalled();
      });
    });

    describe('deleteFragmentsBySource', () => {
      it('should delete all fragments for a source', async () => {
        // Arrange
        const sourceId = 'source-123';
        mockFragmentRepository.delete.mockResolvedValue({
          affected: 10,
          raw: [],
        });

        // Act
        await repository.deleteFragmentsBySource(sourceId);

        // Assert
        expect(mockFragmentRepository.delete).toHaveBeenCalledWith({
          sourceId,
        });
      });
    });

    describe('countFragmentsBySource', () => {
      it('should count fragments for a source', async () => {
        // Arrange
        const sourceId = 'source-123';
        const expectedCount = 25;
        mockFragmentRepository.count.mockResolvedValue(expectedCount);

        // Act
        const result = await repository.countFragmentsBySource(sourceId);

        // Assert
        expect(result).toBe(expectedCount);
        expect(mockFragmentRepository.count).toHaveBeenCalledWith({
          where: { sourceId },
        });
      });
    });
  });

  describe('Transaction Support', () => {
    it('should execute work within a transaction', async () => {
      // Arrange
      const work = jest.fn().mockResolvedValue('success');

      // Act
      const result = await repository.transaction(work);

      // Assert
      expect(result).toBe('success');
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      // Arrange
      const error = new Error('Transaction failed');
      const work = jest.fn().mockRejectedValue(error);

      // Act & Assert
      await expect(repository.transaction(work)).rejects.toThrow(
        'Transaction failed',
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});

// Helper functions to create mock models
function createMockSourceModel(
  id: string,
  sectorId: string,
): KnowledgeSourceModel {
  const model = new KnowledgeSourceModel();
  model.id = id;
  model.title = `Document ${id}`;
  model.sectorId = sectorId;
  model.sourceType = SourceType.PDF;
  model.content = `Content for ${id}`;
  model.status = SourceStatus.PENDING;
  model.metadata = {};
  model.createdAt = new Date();
  model.updatedAt = new Date();
  model.deletedAt = null;
  return model;
}

function createMockFragmentModel(
  id: string,
  sourceId: string = '550e8400-e29b-41d4-a716-446655440000',
  position = 0,
): FragmentModel {
  const model = new FragmentModel();
  model.id = id;
  model.sourceId = sourceId;
  model.content = `This is test content for fragment ${id} with sufficient length`;
  model.embedding = null;
  model.position = position;
  model.tokenCount = 100;
  model.metadata = {};
  model.createdAt = new Date();
  model.updatedAt = new Date();
  return model;
}

