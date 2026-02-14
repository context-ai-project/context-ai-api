import { DataSource } from 'typeorm';
import { KnowledgeSourceModel } from '../../../../src/modules/knowledge/infrastructure/persistence/models/knowledge-source.model';
import { FragmentModel } from '../../../../src/modules/knowledge/infrastructure/persistence/models/fragment.model';
import { KnowledgeRepository } from '../../../../src/modules/knowledge/infrastructure/persistence/repositories/knowledge.repository';
import { KnowledgeSource } from '../../../../src/modules/knowledge/domain/entities/knowledge-source.entity';
import { Fragment } from '../../../../src/modules/knowledge/domain/entities/fragment.entity';
import { SourceType, SourceStatus } from '@shared/types';
import {
  createTestingModule,
  cleanupDatabase,
  closeDatabase,
  createTestUuid,
} from '../../test-helpers';

/**
 * Integration Tests for KnowledgeRepository
 *
 * These tests use a real PostgreSQL database (without pgvector extension).
 * They verify the repository's ability to perform CRUD operations for
 * relational data. Vector operations are now handled by IVectorStore (Pinecone).
 *
 * Prerequisites:
 * - PostgreSQL must be running (docker-compose up -d postgres)
 * - Test database should be created and migrations run
 *
 * Run with: npm run test:integration
 *
 * Updated for Phase 6B: Removed pgvector/embedding/vectorSearch references.
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

    it('should have knowledge_sources table', async () => {
      const result = await dataSource.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'knowledge_sources')",
      );
      expect(result[0].exists).toBe(true);
    });

    it('should have fragments table', async () => {
      const result = await dataSource.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fragments')",
      );
      expect(result[0].exists).toBe(true);
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
    it('should save fragments without embeddings', async () => {
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
          position: 0,
        }),
        new Fragment({
          sourceId: savedSource.id!,
          content: 'Fragment 2 content with sufficient length.',
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
        position: 0,
      });
      await repository.saveFragments([fragment]);

      // Act
      await repository.deleteFragmentsBySource(savedSource.id!);
      const found = await repository.findFragmentsBySource(savedSource.id!);

      // Assert
      expect(found).toHaveLength(0);
    });

    it('should count fragments by source', async () => {
      // Arrange
      const source = new KnowledgeSource({
        title: 'Count Fragments Test',
        sectorId: createTestUuid('sector-'),
        sourceType: SourceType.PDF,
        content: 'Content.',
      });
      const savedSource = await repository.saveSource(source);

      const fragments = [
        new Fragment({
          sourceId: savedSource.id!,
          content: 'Fragment 1 content with sufficient length.',
          position: 0,
        }),
        new Fragment({
          sourceId: savedSource.id!,
          content: 'Fragment 2 content with sufficient length.',
          position: 1,
        }),
        new Fragment({
          sourceId: savedSource.id!,
          content: 'Fragment 3 content with sufficient length.',
          position: 2,
        }),
      ];
      await repository.saveFragments(fragments);

      // Act
      const count = await repository.countFragmentsBySource(savedSource.id!);

      // Assert
      expect(count).toBe(3);
    });
  });

  // Note: Vector search tests have been moved to IVectorStore integration tests (6B.6)
  // The repository no longer handles vector operations - those are delegated to Pinecone.

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
