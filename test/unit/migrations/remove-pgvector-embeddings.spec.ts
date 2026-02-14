import { RemovePgvectorEmbeddings1739000000000 } from '../../../src/migrations/1739000000000-RemovePgvectorEmbeddings';

/**
 * Unit Tests: RemovePgvectorEmbeddings Migration (6B.4)
 *
 * Tests the TypeORM migration that removes pgvector infrastructure:
 * - HNSW index removal
 * - Embedding column removal
 * - pgvector extension removal
 * - Reversibility (down method restores everything)
 */

interface QueryCall {
  sql: string;
}

describe('RemovePgvectorEmbeddings1739000000000', () => {
  let migration: RemovePgvectorEmbeddings1739000000000;
  let mockQueryRunner: { query: jest.Mock };
  let queryCalls: QueryCall[];

  beforeEach(() => {
    migration = new RemovePgvectorEmbeddings1739000000000();
    queryCalls = [];
    mockQueryRunner = {
      query: jest.fn().mockImplementation((sql: string) => {
        queryCalls.push({ sql });
        return Promise.resolve();
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('up', () => {
    it('should execute 3 SQL statements in correct order', async () => {
      await migration.up(mockQueryRunner as never);

      expect(mockQueryRunner.query).toHaveBeenCalledTimes(3);
    });

    it('should drop HNSW index first', async () => {
      await migration.up(mockQueryRunner as never);

      const firstCall = queryCalls[0].sql;
      expect(firstCall).toContain('DROP INDEX IF EXISTS');
      expect(firstCall).toContain('idx_fragments_embedding_hnsw');
    });

    it('should drop embedding column second', async () => {
      await migration.up(mockQueryRunner as never);

      const secondCall = queryCalls[1].sql;
      expect(secondCall).toContain('ALTER TABLE fragments');
      expect(secondCall).toContain('DROP COLUMN IF EXISTS embedding');
    });

    it('should drop vector extension third', async () => {
      await migration.up(mockQueryRunner as never);

      const thirdCall = queryCalls[2].sql;
      expect(thirdCall).toContain('DROP EXTENSION IF EXISTS vector');
      expect(thirdCall).toContain('CASCADE');
    });

    it('should use IF EXISTS for safe idempotent execution', async () => {
      await migration.up(mockQueryRunner as never);

      for (const call of queryCalls) {
        expect(call.sql).toContain('IF EXISTS');
      }
    });
  });

  describe('down', () => {
    it('should execute 3 SQL statements in correct order', async () => {
      await migration.down(mockQueryRunner as never);

      expect(mockQueryRunner.query).toHaveBeenCalledTimes(3);
    });

    it('should recreate pgvector extension first', async () => {
      await migration.down(mockQueryRunner as never);

      const firstCall = queryCalls[0].sql;
      expect(firstCall).toContain('CREATE EXTENSION IF NOT EXISTS vector');
    });

    it('should recreate embedding column with vector(3072) second', async () => {
      await migration.down(mockQueryRunner as never);

      const secondCall = queryCalls[1].sql;
      expect(secondCall).toContain('ALTER TABLE fragments');
      expect(secondCall).toContain('ADD COLUMN embedding vector(3072)');
    });

    it('should recreate HNSW index third', async () => {
      await migration.down(mockQueryRunner as never);

      const thirdCall = queryCalls[2].sql;
      expect(thirdCall).toContain('CREATE INDEX idx_fragments_embedding_hnsw');
      expect(thirdCall).toContain('USING hnsw');
      expect(thirdCall).toContain('vector_cosine_ops');
    });

    it('should recreate HNSW index with correct parameters', async () => {
      await migration.down(mockQueryRunner as never);

      const thirdCall = queryCalls[2].sql;
      expect(thirdCall).toContain('m = 16');
      expect(thirdCall).toContain('ef_construction = 64');
    });
  });

  describe('reversibility', () => {
    it('should be fully reversible (up then down restores original state)', async () => {
      // Run up migration
      await migration.up(mockQueryRunner as never);
      const upCalls = [...queryCalls];

      // Reset tracking
      queryCalls.length = 0;
      mockQueryRunner.query.mockClear();

      // Run down migration
      await migration.down(mockQueryRunner as never);
      const downCalls = [...queryCalls];

      // Verify both directions executed successfully
      expect(upCalls).toHaveLength(3);
      expect(downCalls).toHaveLength(3);

      // Verify up drops and down creates
      expect(upCalls[0].sql).toContain('DROP INDEX');
      expect(downCalls[2].sql).toContain('CREATE INDEX');

      expect(upCalls[1].sql).toContain('DROP COLUMN');
      expect(downCalls[1].sql).toContain('ADD COLUMN');

      expect(upCalls[2].sql).toContain('DROP EXTENSION');
      expect(downCalls[0].sql).toContain('CREATE EXTENSION');
    });
  });
});

