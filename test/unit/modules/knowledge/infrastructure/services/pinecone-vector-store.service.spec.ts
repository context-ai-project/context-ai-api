import { Logger } from '@nestjs/common';
import { PineconeVectorStore } from '@modules/knowledge/infrastructure/services/pinecone-vector-store.service';
import type {
  VectorUpsertInput,
  VectorMetadata,
} from '@modules/knowledge/domain/services/vector-store.interface';

// Constants for test data
const TEST_SECTOR_ID = 'sector-123';
const TEST_SOURCE_ID = 'source-456';
const TEST_VECTOR_ID = 'vector-789';
const TEST_EMBEDDING_DIMENSIONS = 3072;
const DEFAULT_LIMIT = 5;
const DEFAULT_MIN_SCORE = 0.7;
const CUSTOM_LIMIT = 3;
const CUSTOM_MIN_SCORE = 0.8;
const BATCH_SIZE = 100;
const BATCH_TOTAL_VECTORS = 250;
const FIRST_BATCH_START = 0;
const SECOND_BATCH_START = 100;
const THIRD_BATCH_START = 200;
const THIRD_BATCH_SIZE = 50;
const HIGH_SIMILARITY_SCORE = 0.95;
const MEDIUM_SIMILARITY_SCORE = 0.85;
const LOW_SIMILARITY_SCORE = 0.6;
const TOKEN_COUNT = 150;
const POSITION_0 = 0;
const POSITION_1 = 1;

/**
 * Creates a test embedding of specified dimensions
 */
function createTestEmbedding(dimensions: number = TEST_EMBEDDING_DIMENSIONS): number[] {
  return Array.from({ length: dimensions }, (_, i) => i * 0.001);
}

/**
 * Creates a test VectorUpsertInput
 */
function createTestInput(overrides?: Partial<VectorUpsertInput>): VectorUpsertInput {
  return {
    id: TEST_VECTOR_ID,
    embedding: createTestEmbedding(),
    metadata: {
      sourceId: TEST_SOURCE_ID,
      sectorId: TEST_SECTOR_ID,
      content: 'Test fragment content for embedding',
      position: POSITION_0,
      tokenCount: TOKEN_COUNT,
    },
    ...overrides,
  };
}

/**
 * Creates a mock Pinecone namespace with all required methods
 */
function createMockNamespace() {
  return {
    upsert: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue({ matches: [] }),
    deleteMany: jest.fn().mockResolvedValue(undefined),
    deleteAll: jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * Creates a mock Pinecone index with namespace support
 */
function createMockIndex(mockNamespace: ReturnType<typeof createMockNamespace>) {
  return {
    namespace: jest.fn().mockReturnValue(mockNamespace),
    describeIndexStats: jest.fn().mockResolvedValue({
      namespaces: {},
      dimension: TEST_EMBEDDING_DIMENSIONS,
      indexFullness: 0,
      totalRecordCount: 0,
    }),
  };
}

/**
 * Creates a mock Pinecone client
 */
function createMockPineconeClient(mockIndex: ReturnType<typeof createMockIndex>) {
  return {
    index: jest.fn().mockReturnValue(mockIndex),
  };
}

describe('PineconeVectorStore', () => {
  let service: PineconeVectorStore;
  let mockNamespace: ReturnType<typeof createMockNamespace>;
  let mockIndex: ReturnType<typeof createMockIndex>;
  let mockPineconeClient: ReturnType<typeof createMockPineconeClient>;

  beforeEach(() => {
    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    mockNamespace = createMockNamespace();
    mockIndex = createMockIndex(mockNamespace);
    mockPineconeClient = createMockPineconeClient(mockIndex);

    service = new PineconeVectorStore(
      mockPineconeClient as unknown as Parameters<typeof PineconeVectorStore['prototype']['constructor']>[0],
      'context-ai',
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ==================== Constructor ====================

  describe('constructor', () => {
    it('should create an instance successfully', () => {
      expect(service).toBeDefined();
    });
  });

  // ==================== upsertVectors ====================

  describe('upsertVectors', () => {
    it('should upsert vectors to the correct namespace using sectorId', async () => {
      const input = createTestInput();

      await service.upsertVectors([input]);

      expect(mockPineconeClient.index).toHaveBeenCalledWith({ name: 'context-ai' });
      expect(mockIndex.namespace).toHaveBeenCalledWith(TEST_SECTOR_ID);
      expect(mockNamespace.upsert).toHaveBeenCalledTimes(1);
      expect(mockNamespace.upsert).toHaveBeenCalledWith({
        records: [
          {
            id: TEST_VECTOR_ID,
            values: input.embedding,
            metadata: input.metadata,
          },
        ],
      });
    });

    it('should handle empty input array', async () => {
      await service.upsertVectors([]);

      expect(mockNamespace.upsert).not.toHaveBeenCalled();
    });

    it('should batch upserts when more than 100 vectors', async () => {
      const inputs: VectorUpsertInput[] = Array.from(
        { length: BATCH_TOTAL_VECTORS },
        (_, i) =>
          createTestInput({
            id: `vector-${i}`,
            metadata: {
              sourceId: TEST_SOURCE_ID,
              sectorId: TEST_SECTOR_ID,
              content: `Content ${i}`,
              position: i,
              tokenCount: TOKEN_COUNT,
            },
          }),
      );

      await service.upsertVectors(inputs);

      // 250 vectors / 100 batch size = 3 calls
      const expectedBatchCalls = 3;
      expect(mockNamespace.upsert).toHaveBeenCalledTimes(expectedBatchCalls);

      // Verify batch sizes - upsert receives { records: [...] }
      const firstCall = mockNamespace.upsert.mock.calls[FIRST_BATCH_START][0] as { records: unknown[] };
      const secondCall = mockNamespace.upsert.mock.calls[1][0] as { records: unknown[] };
      const thirdCall = mockNamespace.upsert.mock.calls[2][0] as { records: unknown[] };

      expect(firstCall.records.length).toBe(BATCH_SIZE);
      expect(secondCall.records.length).toBe(BATCH_SIZE);
      expect(thirdCall.records.length).toBe(THIRD_BATCH_SIZE);
    });

    it('should throw an error when upsert fails', async () => {
      mockNamespace.upsert.mockRejectedValueOnce(
        new Error('Pinecone upsert failed'),
      );

      const input = createTestInput();

      await expect(service.upsertVectors([input])).rejects.toThrow(
        'Failed to upsert vectors to Pinecone',
      );
    });

    it('should map inputs correctly to Pinecone format', async () => {
      const metadata: VectorMetadata = {
        sourceId: 'src-1',
        sectorId: TEST_SECTOR_ID,
        content: 'Test content',
        position: POSITION_1,
        tokenCount: TOKEN_COUNT,
      };

      const input = createTestInput({
        id: 'custom-id',
        metadata,
      });

      await service.upsertVectors([input]);

      expect(mockNamespace.upsert).toHaveBeenCalledWith({
        records: [
          {
            id: 'custom-id',
            values: input.embedding,
            metadata,
          },
        ],
      });
    });
  });

  // ==================== vectorSearch ====================

  describe('vectorSearch', () => {
    it('should search vectors in the correct namespace', async () => {
      const embedding = createTestEmbedding();

      mockNamespace.query.mockResolvedValueOnce({
        matches: [
          {
            id: 'match-1',
            score: HIGH_SIMILARITY_SCORE,
            metadata: {
              sourceId: TEST_SOURCE_ID,
              sectorId: TEST_SECTOR_ID,
              content: 'Matched content',
              position: POSITION_0,
              tokenCount: TOKEN_COUNT,
            },
          },
        ],
      });

      const results = await service.vectorSearch(
        embedding,
        TEST_SECTOR_ID,
      );

      expect(mockIndex.namespace).toHaveBeenCalledWith(TEST_SECTOR_ID);
      expect(mockNamespace.query).toHaveBeenCalledWith({
        vector: embedding,
        topK: DEFAULT_LIMIT,
        includeMetadata: true,
      });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('match-1');
      expect(results[0].score).toBe(HIGH_SIMILARITY_SCORE);
      expect(results[0].metadata.content).toBe('Matched content');
    });

    it('should use custom limit and filter by minScore', async () => {
      const embedding = createTestEmbedding();

      mockNamespace.query.mockResolvedValueOnce({
        matches: [
          {
            id: 'match-1',
            score: HIGH_SIMILARITY_SCORE,
            metadata: {
              sourceId: TEST_SOURCE_ID,
              sectorId: TEST_SECTOR_ID,
              content: 'High similarity',
              position: POSITION_0,
              tokenCount: TOKEN_COUNT,
            },
          },
          {
            id: 'match-2',
            score: MEDIUM_SIMILARITY_SCORE,
            metadata: {
              sourceId: TEST_SOURCE_ID,
              sectorId: TEST_SECTOR_ID,
              content: 'Medium similarity',
              position: POSITION_1,
              tokenCount: TOKEN_COUNT,
            },
          },
          {
            id: 'match-3',
            score: LOW_SIMILARITY_SCORE,
            metadata: {
              sourceId: TEST_SOURCE_ID,
              sectorId: TEST_SECTOR_ID,
              content: 'Low similarity',
              position: 2,
              tokenCount: TOKEN_COUNT,
            },
          },
        ],
      });

      const results = await service.vectorSearch(
        embedding,
        TEST_SECTOR_ID,
        CUSTOM_LIMIT,
        CUSTOM_MIN_SCORE,
      );

      expect(mockNamespace.query).toHaveBeenCalledWith({
        vector: embedding,
        topK: CUSTOM_LIMIT,
        includeMetadata: true,
      });

      // match-1 (0.95) and match-2 (0.85) pass the 0.8 threshold
      // match-3 (0.6) does not pass
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('match-1');
      expect(results[1].id).toBe('match-2');
    });

    it('should return empty array when no matches found', async () => {
      const embedding = createTestEmbedding();

      mockNamespace.query.mockResolvedValueOnce({ matches: [] });

      const results = await service.vectorSearch(
        embedding,
        TEST_SECTOR_ID,
      );

      expect(results).toEqual([]);
    });

    it('should handle null matches from Pinecone', async () => {
      const embedding = createTestEmbedding();

      mockNamespace.query.mockResolvedValueOnce({ matches: null });

      const results = await service.vectorSearch(
        embedding,
        TEST_SECTOR_ID,
      );

      expect(results).toEqual([]);
    });

    it('should throw an error when search fails', async () => {
      mockNamespace.query.mockRejectedValueOnce(
        new Error('Pinecone query failed'),
      );

      const embedding = createTestEmbedding();

      await expect(
        service.vectorSearch(embedding, TEST_SECTOR_ID),
      ).rejects.toThrow('Failed to search vectors in Pinecone');
    });

    it('should filter out matches without metadata', async () => {
      const embedding = createTestEmbedding();

      mockNamespace.query.mockResolvedValueOnce({
        matches: [
          {
            id: 'match-1',
            score: HIGH_SIMILARITY_SCORE,
            metadata: {
              sourceId: TEST_SOURCE_ID,
              sectorId: TEST_SECTOR_ID,
              content: 'Valid match',
              position: POSITION_0,
              tokenCount: TOKEN_COUNT,
            },
          },
          {
            id: 'match-2',
            score: MEDIUM_SIMILARITY_SCORE,
            metadata: null,
          },
        ],
      });

      const results = await service.vectorSearch(
        embedding,
        TEST_SECTOR_ID,
      );

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('match-1');
    });
  });

  // ==================== deleteBySourceId ====================

  describe('deleteBySourceId', () => {
    it('should delete vectors by sourceId filter in the correct namespace', async () => {
      await service.deleteBySourceId(TEST_SOURCE_ID, TEST_SECTOR_ID);

      expect(mockIndex.namespace).toHaveBeenCalledWith(TEST_SECTOR_ID);
      expect(mockNamespace.deleteMany).toHaveBeenCalledWith({
        filter: { sourceId: { $eq: TEST_SOURCE_ID } },
      });
    });

    it('should throw an error when deletion fails', async () => {
      mockNamespace.deleteMany.mockRejectedValueOnce(
        new Error('Pinecone delete failed'),
      );

      await expect(
        service.deleteBySourceId(TEST_SOURCE_ID, TEST_SECTOR_ID),
      ).rejects.toThrow('Failed to delete vectors from Pinecone');
    });
  });

  // ==================== healthCheck ====================

  describe('healthCheck', () => {
    it('should return true when Pinecone is accessible', async () => {
      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockIndex.describeIndexStats).toHaveBeenCalled();
    });

    it('should return false when Pinecone is not accessible', async () => {
      mockIndex.describeIndexStats.mockRejectedValueOnce(
        new Error('Connection failed'),
      );

      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });
});

