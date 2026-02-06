import { DataSource } from 'typeorm';
import { KnowledgeSourceModel } from '../../../../src/modules/knowledge/infrastructure/persistence/models/knowledge-source.model';
import { FragmentModel } from '../../../../src/modules/knowledge/infrastructure/persistence/models/fragment.model';
import { KnowledgeRepository } from '../../../../src/modules/knowledge/infrastructure/persistence/repositories/knowledge.repository';
import { KnowledgeSource } from '../../../../src/modules/knowledge/domain/entities/knowledge-source.entity';
import { Fragment } from '../../../../src/modules/knowledge/domain/entities/fragment.entity';
import { SourceType, SourceStatus } from '@context-ai/shared';
import {
  createTestingModule,
  cleanupDatabase,
  closeDatabase,
  createTestUuid,
} from '../../test-helpers';

/**
 * Integration Tests for KnowledgeRepository
 *
 * These tests use a real PostgreSQL database with pgvector extension.
 * They verify the repository's ability to perform CRUD operations and vector searches.
 *
 * Prerequisites:
 * - PostgreSQL with pgvector must be running (docker-compose up -d postgres)
 * - Test database should be created and migrations run
 *
 * Run with: npm run test:integration
 */
describe('KnowledgeRepository Integration Tests', () => {
  let repository: KnowledgeRepository;
  let dataSource: DataSource;

  beforeAll(async () => {
    const module = await createTestingModule(
      [KnowledgeSourceModel, FragmentModel],
      [KnowledgeRepository],
    );

    repository = module.get<KnowledgeRepository>(KnowledgeRepository);
    dataSource = module.get<DataSource>(DataSource);

    // Wait for database to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    await closeDatabase(dataSource);
  });

  beforeEach(async () => {
    await cleanupDatabase(dataSource);
  });

  describe('Database Connection', () => {
    it('should connect to database successfully', async () => {
      expect(dataSource.isInitialized).toBe(true);
    });

    it('should have pgvector extension installed', async () => {
      const result = await dataSource.query(
        "SELECT * FROM pg_extension WHERE extname = 'vector'",
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have knowledge_sources table', async () => {
      const result = await dataSource.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'knowledge_sources')",
      );
      expect(result[0].exists).toBe(true);
    });

    it('should have fragments table with vector column', async () => {
      const result = await dataSource.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'fragments' AND column_name = 'embedding'",
      );
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('KnowledgeSource CRUD Operations', () => {
    it('should save a new knowledge source', async () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Integration Test Document',
        sectorId: createTestUuid('sector-'),
        sourceType: SourceType.PDF,
        content:
          'This is test content for integration testing with a real database.',
        metadata: { test: true },
      });

      // Act
      const saved = await repository.saveSource(source);

      // Assert
      expect(saved).toBeDefined();
      expect(saved.id).toBeDefined();
      expect(saved.title).toBe('Integration Test Document');
      expect(saved.status).toBe(SourceStatus.PENDING);
    });

    it('should find knowledge source by id', async () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Find by ID Test',
        sectorId: createTestUuid('sector-'),
        sourceType: SourceType.MARKDOWN,
        content: 'Content for find by ID test.',
      });
      const saved = await repository.saveSource(source);

      // Act
      const found = await repository.findSourceById(saved.id!);

      // Assert
      expect(found).toBeDefined();
      expect(found!.id).toBe(saved.id);
      expect(found!.title).toBe('Find by ID Test');
    });

    it('should update knowledge source status', async () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Status Update Test',
        sectorId: createTestUuid('sector-'),
        sourceType: SourceType.PDF,
        content: 'Content for status update test.',
      });
      const saved = await repository.saveSource(source);

      // Act
      saved.markAsProcessing();
      await repository.saveSource(saved);
      const updated = await repository.findSourceById(saved.id!);

      // Assert
      expect(updated!.status).toBe(SourceStatus.PROCESSING);
    });

    it('should find sources by sector', async () => {
      // Arrange
      const sectorId = createTestUuid('sector-');
      const source1 = new KnowledgeSource({
        title: 'Sector Test 1',
        sectorId,
        sourceType: SourceType.PDF,
        content: 'Content 1.',
      });
      const source2 = new KnowledgeSource({
        title: 'Sector Test 2',
        sectorId,
        sourceType: SourceType.MARKDOWN,
        content: 'Content 2.',
      });
      await repository.saveSource(source1);
      await repository.saveSource(source2);

      // Act
      const sources = await repository.findSourcesBySector(sectorId);

      // Assert
      expect(sources).toHaveLength(2);
      expect(sources.every((s) => s.sectorId === sectorId)).toBe(true);
    });

    it('should soft delete knowledge source', async () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Soft Delete Test',
        sectorId: createTestUuid('sector-'),
        sourceType: SourceType.PDF,
        content: 'Content for soft delete test.',
      });
      const saved = await repository.saveSource(source);

      // Act
      await repository.softDeleteSource(saved.id!);
      const found = await repository.findSourceById(saved.id!);

      // Assert
      expect(found).toBeNull();
    });
  });

  describe('Fragment CRUD Operations', () => {
    it('should save fragments', async () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Fragment Test',
        sectorId: createTestUuid('sector-'),
        sourceType: SourceType.PDF,
        content: 'Content for fragment test.',
      });
      const savedSource = await repository.saveSource(source);

      const fragment = new Fragment({
        sourceId: savedSource.id!,
        content: 'This is a test fragment with at least 10 characters.',
        embedding: Array(768).fill(0.1),
        position: 0,
        metadata: { test: true },
      });

      // Act
      const saved = await repository.saveFragments([fragment]);

      // Assert
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBeDefined();
      expect(saved[0].sourceId).toBe(savedSource.id);
    });

    it('should find fragments by source', async () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Find Fragments Test',
        sectorId: createTestUuid('sector-'),
        sourceType: SourceType.PDF,
        content: 'Content.',
      });
      const savedSource = await repository.saveSource(source);

      const fragments = [
        new Fragment({
          sourceId: savedSource.id!,
          content: 'Fragment 1 content with sufficient length.',
          embedding: Array(768).fill(0.1),
          position: 0,
        }),
        new Fragment({
          sourceId: savedSource.id!,
          content: 'Fragment 2 content with sufficient length.',
          embedding: Array(768).fill(0.2),
          position: 1,
        }),
      ];
      await repository.saveFragments(fragments);

      // Act
      const found = await repository.findFragmentsBySource(savedSource.id!);

      // Assert
      expect(found).toHaveLength(2);
      expect(found[0].position).toBe(0);
      expect(found[1].position).toBe(1);
    });

    it('should delete fragments by source', async () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Delete Fragments Test',
        sectorId: createTestUuid('sector-'),
        sourceType: SourceType.PDF,
        content: 'Content.',
      });
      const savedSource = await repository.saveSource(source);

      const fragment = new Fragment({
        sourceId: savedSource.id!,
        content: 'Fragment to delete with sufficient length.',
        embedding: Array(768).fill(0.1),
        position: 0,
      });
      await repository.saveFragments([fragment]);

      // Act
      await repository.deleteFragmentsBySource(savedSource.id!);
      const found = await repository.findFragmentsBySource(savedSource.id!);

      // Assert
      expect(found).toHaveLength(0);
    });
  });

  describe('Vector Search', () => {
    it('should perform vector similarity search', async () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Vector Search Test',
        sectorId: createTestUuid('sector-'),
        sourceType: SourceType.PDF,
        content: 'Content.',
      });
      const savedSource = await repository.saveSource(source);

      // Create fragments with different embeddings
      const queryEmbedding = Array(768)
        .fill(0)
        .map(() => Math.random());

      const similarFragment = new Fragment({
        sourceId: savedSource.id!,
        content:
          'Similar fragment with sufficient character length for testing.',
        embedding: queryEmbedding.map((v) => v + Math.random() * 0.1), // Very similar
        position: 0,
      });

      const differentFragment = new Fragment({
        sourceId: savedSource.id!,
        content:
          'Different fragment with sufficient character length for testing.',
        embedding: Array(768).fill(0.9), // Very different
        position: 1,
      });

      await repository.saveFragments([similarFragment, differentFragment]);

      // Act
      const results = await repository.vectorSearch(
        queryEmbedding,
        savedSource.sectorId,
        2,
        0.0,
      );

      // Assert
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('similarity');
      // The more similar fragment should have higher similarity
      if (results.length === 2) {
        expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
      }
    });

    it('should respect limit in vector search', async () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Vector Search Limit Test',
        sectorId: createTestUuid('sector-'),
        sourceType: SourceType.PDF,
        content: 'Content.',
      });
      const savedSource = await repository.saveSource(source);

      const fragments = Array.from(
        { length: 5 },
        (_, i) =>
          new Fragment({
            sourceId: savedSource.id!,
            content: `Fragment ${i} with sufficient character length for testing purposes.`,
            embedding: Array(768)
              .fill(0)
              .map(() => Math.random()),
            position: i,
          }),
      );
      await repository.saveFragments(fragments);

      const queryEmbedding = Array(768)
        .fill(0)
        .map(() => Math.random());

      // Act
      const results = await repository.vectorSearch(
        queryEmbedding,
        savedSource.sectorId,
        3,
        0.0,
      );

      // Assert
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should filter by similarity threshold', async () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Similarity Threshold Test',
        sectorId: createTestUuid('sector-'),
        sourceType: SourceType.PDF,
        content: 'Content.',
      });
      const savedSource = await repository.saveSource(source);

      const queryEmbedding = Array(768).fill(0.5);

      const fragment = new Fragment({
        sourceId: savedSource.id!,
        content:
          'Fragment for similarity threshold test with sufficient length.',
        embedding: queryEmbedding, // Identical (similarity = 1.0)
        position: 0,
      });
      await repository.saveFragments([fragment]);

      // Act - high threshold should return results
      const highThresholdResults = await repository.vectorSearch(
        queryEmbedding,
        savedSource.sectorId,
        5,
        0.99,
      );

      // Assert
      expect(highThresholdResults.length).toBeGreaterThan(0);
      expect(highThresholdResults[0].similarity).toBeGreaterThanOrEqual(0.99);
    });
  });

  describe('Transactions', () => {
    it('should rollback transaction on error', async () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Transaction Test',
        sectorId: createTestUuid('sector-'),
        sourceType: SourceType.PDF,
        content: 'Content.',
      });

      // Act & Assert
      await expect(
        repository.transaction(async () => {
          await repository.saveSource(source);
          // Simulate error
          throw new Error('Transaction should rollback');
        }),
      ).rejects.toThrow('Transaction should rollback');

      // Verify source was not saved
      const sources = await repository.findSourcesBySector(source.sectorId);
      expect(sources).toHaveLength(0);
    });

    it('should commit transaction on success', async () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Transaction Commit Test',
        sectorId: createTestUuid('sector-'),
        sourceType: SourceType.PDF,
        content: 'Content for successful transaction.',
      });

      // Act
      await repository.transaction(async () => {
        await repository.saveSource(source);
      });

      // Assert
      const sources = await repository.findSourcesBySector(source.sectorId);
      expect(sources).toHaveLength(1);
      expect(sources[0].title).toBe('Transaction Commit Test');
    });
  });
});
