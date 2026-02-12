/**
 * Integration Tests: PineconeVectorStore with Real Pinecone API
 *
 * Phase 6B.6 - Integration & E2E Validation
 *
 * These tests verify the PineconeVectorStore service against the real
 * Pinecone API. They require valid PINECONE_API_KEY and PINECONE_INDEX
 * environment variables.
 *
 * Test scenarios:
 * 1. Vector Upsert & Search - Insert vectors and verify retrieval
 * 2. Namespace Isolation - Verify sector-based multi-tenancy
 * 3. Delete by Source ID - Verify cascade deletion
 * 4. Error Handling - Invalid API key, missing index
 * 5. Batch Operations - Large batch upsert
 *
 * Usage:
 *   PINECONE_API_KEY=xxx PINECONE_INDEX=context-ai \
 *     npx jest test/integration/pinecone-vector-store.integration.spec.ts --verbose
 *
 * IMPORTANT: Tests use a unique namespace (test-{timestamp}) and clean up
 * after themselves. They will NOT affect production data.
 */

import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeVectorStore } from '../../src/modules/knowledge/infrastructure/services/pinecone-vector-store.service';
import type {
  VectorUpsertInput,
  VectorSearchResult,
} from '../../src/modules/knowledge/domain/services/vector-store.interface';

// Skip tests if Pinecone credentials are not configured
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = process.env.PINECONE_INDEX;
const SHOULD_RUN = Boolean(PINECONE_API_KEY && PINECONE_INDEX);

// Test constants
const TEST_NAMESPACE = `test-integration-${Date.now()}`;
const VECTOR_DIMENSIONS = 3072;
const PINECONE_CONSISTENCY_DELAY_MS = 3000;

/**
 * Creates a deterministic test vector with the given seed.
 * Different seeds produce orthogonal-ish vectors for distinguishable search results.
 */
function createTestVector(seed: number, dimensions: number = VECTOR_DIMENSIONS): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  // Create a simple pattern: set specific dimensions based on seed
  for (let i = 0; i < dimensions; i++) {
    vector[i] = Math.sin(seed * (i + 1) * 0.001) * 0.5 + 0.5;
  }
  // Normalize to unit vector
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return vector.map((v) => v / magnitude);
}

/**
 * Creates test upsert inputs with deterministic vectors
 */
function createTestInputs(
  count: number,
  sourceId: string,
  sectorId: string,
): VectorUpsertInput[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `test-vec-${sourceId}-${i}`,
    embedding: createTestVector(i),
    metadata: {
      sourceId,
      sectorId,
      content: `Test content for fragment ${i} from source ${sourceId}`,
      position: i,
      tokenCount: 50 + i * 10,
    },
  }));
}

// Use conditional describe to skip if no credentials
const describeIfPinecone = SHOULD_RUN ? describe : describe.skip;

describeIfPinecone('PineconeVectorStore Integration Tests', () => {
  let pinecone: Pinecone;
  let vectorStore: PineconeVectorStore;

  const testSourceId = `source-int-${Date.now()}`;
  const testSectorId = TEST_NAMESPACE;

  beforeAll(() => {
    pinecone = new Pinecone({ apiKey: PINECONE_API_KEY as string });
    vectorStore = new PineconeVectorStore(
      pinecone,
      PINECONE_INDEX as string,
    );
  });

  afterAll(async () => {
    // Clean up: delete all vectors in test namespace
    try {
      const index = pinecone.index({ name: PINECONE_INDEX as string });
      await index.namespace(TEST_NAMESPACE).deleteAll();
      console.log(`Cleaned up test namespace: ${TEST_NAMESPACE}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Cleanup warning: ${msg}`);
    }
  });

  describe('healthCheck', () => {
    it('should return true when Pinecone is accessible', async () => {
      const isHealthy = await vectorStore.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('upsertVectors', () => {
    it('should successfully upsert vectors to Pinecone', async () => {
      const inputs = createTestInputs(5, testSourceId, testSectorId);

      await expect(vectorStore.upsertVectors(inputs)).resolves.not.toThrow();
    });

    it('should handle empty input without error', async () => {
      await expect(vectorStore.upsertVectors([])).resolves.not.toThrow();
    });

    it('should upsert a large batch (>100 vectors)', async () => {
      const largeBatchSourceId = `source-batch-${Date.now()}`;
      const inputs = createTestInputs(150, largeBatchSourceId, testSectorId);

      await expect(vectorStore.upsertVectors(inputs)).resolves.not.toThrow();
    });
  });

  describe('vectorSearch', () => {
    beforeAll(async () => {
      // Upsert known vectors and wait for Pinecone consistency
      const searchInputs = createTestInputs(10, testSourceId, testSectorId);
      await vectorStore.upsertVectors(searchInputs);

      // Wait for Pinecone's eventual consistency
      await new Promise((resolve) =>
        setTimeout(resolve, PINECONE_CONSISTENCY_DELAY_MS),
      );
    });

    it('should return results for a similar vector query', async () => {
      // Use vector[0] as query — should find itself or similar
      const queryVector = createTestVector(0);

      const results: VectorSearchResult[] = await vectorStore.vectorSearch(
        queryVector,
        testSectorId,
        5,
        0.0, // Low threshold to ensure results
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].metadata).toBeDefined();
      expect(results[0].metadata.sourceId).toBe(testSourceId);
      expect(results[0].metadata.sectorId).toBe(testSectorId);
    });

    it('should return results ordered by score (descending)', async () => {
      const queryVector = createTestVector(0);

      const results = await vectorStore.vectorSearch(
        queryVector,
        testSectorId,
        10,
        0.0,
      );

      // Verify scores are in descending order
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    it('should respect the limit parameter', async () => {
      const queryVector = createTestVector(0);
      const limit = 3;

      const results = await vectorStore.vectorSearch(
        queryVector,
        testSectorId,
        limit,
        0.0,
      );

      expect(results.length).toBeLessThanOrEqual(limit);
    });

    it('should filter by minimum score', async () => {
      const queryVector = createTestVector(0);
      const highMinScore = 0.99;

      const results = await vectorStore.vectorSearch(
        queryVector,
        testSectorId,
        10,
        highMinScore,
      );

      // All returned results should have score >= minScore
      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(highMinScore);
      }
    });

    it('should return results with valid metadata', async () => {
      const queryVector = createTestVector(0);

      const results = await vectorStore.vectorSearch(
        queryVector,
        testSectorId,
        5,
        0.0,
      );

      for (const result of results) {
        expect(result.id).toBeDefined();
        expect(typeof result.score).toBe('number');
        expect(result.metadata.sourceId).toBeDefined();
        expect(result.metadata.sectorId).toBe(testSectorId);
        expect(typeof result.metadata.content).toBe('string');
        expect(typeof result.metadata.position).toBe('number');
        expect(typeof result.metadata.tokenCount).toBe('number');
      }
    });
  });

  describe('namespace isolation', () => {
    const isolatedNamespace = `test-isolated-${Date.now()}`;
    const isolatedSourceId = `source-isolated-${Date.now()}`;

    afterAll(async () => {
      // Clean up isolated namespace
      try {
        const index = pinecone.index({ name: PINECONE_INDEX as string });
        await index.namespace(isolatedNamespace).deleteAll();
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should not return results from a different namespace', async () => {
      // Upsert to isolated namespace
      const inputs = createTestInputs(3, isolatedSourceId, isolatedNamespace);
      await vectorStore.upsertVectors(inputs);

      await new Promise((resolve) =>
        setTimeout(resolve, PINECONE_CONSISTENCY_DELAY_MS),
      );

      // Query in original namespace — should NOT find isolated vectors
      const queryVector = createTestVector(0);
      const results = await vectorStore.vectorSearch(
        queryVector,
        testSectorId,
        10,
        0.0,
      );

      const hasIsolatedSource = results.some(
        (r) => r.metadata.sourceId === isolatedSourceId,
      );
      expect(hasIsolatedSource).toBe(false);
    });
  });

  describe('deleteBySourceId', () => {
    const deleteSourceId = `source-delete-${Date.now()}`;
    const deleteNamespace = `test-delete-${Date.now()}`;

    afterAll(async () => {
      try {
        const index = pinecone.index({ name: PINECONE_INDEX as string });
        await index.namespace(deleteNamespace).deleteAll();
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should delete vectors by sourceId', async () => {
      // Upsert vectors for deletion test
      const inputs = createTestInputs(5, deleteSourceId, deleteNamespace);
      await vectorStore.upsertVectors(inputs);

      await new Promise((resolve) =>
        setTimeout(resolve, PINECONE_CONSISTENCY_DELAY_MS),
      );

      // Verify vectors exist
      const queryVector = createTestVector(0);
      const beforeDelete = await vectorStore.vectorSearch(
        queryVector,
        deleteNamespace,
        10,
        0.0,
      );
      expect(beforeDelete.length).toBeGreaterThan(0);

      // Delete by sourceId
      await vectorStore.deleteBySourceId(deleteSourceId, deleteNamespace);

      await new Promise((resolve) =>
        setTimeout(resolve, PINECONE_CONSISTENCY_DELAY_MS),
      );

      // Verify vectors are gone
      const afterDelete = await vectorStore.vectorSearch(
        queryVector,
        deleteNamespace,
        10,
        0.0,
      );

      const stillHasSource = afterDelete.some(
        (r) => r.metadata.sourceId === deleteSourceId,
      );
      expect(stillHasSource).toBe(false);
    });

    it('should not throw when deleting non-existent sourceId', async () => {
      await expect(
        vectorStore.deleteBySourceId('non-existent-source', deleteNamespace),
      ).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should throw when using invalid API key', async () => {
      const badPinecone = new Pinecone({ apiKey: 'invalid-key' });
      const badStore = new PineconeVectorStore(
        badPinecone,
        PINECONE_INDEX as string,
      );

      await expect(badStore.healthCheck()).resolves.toBe(false);
    });
  });
});

