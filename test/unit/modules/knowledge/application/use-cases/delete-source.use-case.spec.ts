import { DeleteSourceUseCase } from '../../../../../../src/modules/knowledge/application/use-cases/delete-source.use-case';
import { IKnowledgeRepository } from '../../../../../../src/modules/knowledge/domain/repositories/knowledge.repository.interface';
import { IVectorStore } from '../../../../../../src/modules/knowledge/domain/services/vector-store.interface';
import { KnowledgeSource } from '../../../../../../src/modules/knowledge/domain/entities/knowledge-source.entity';
import { SourceType } from '@shared/types';
import type {
  DeleteSourceDto,
  DeleteSourceResult,
} from '../../../../../../src/modules/knowledge/application/dtos/delete-source.dto';

describe('DeleteSourceUseCase', () => {
  let useCase: DeleteSourceUseCase;
  let mockRepository: jest.Mocked<IKnowledgeRepository>;
  let mockVectorStore: jest.Mocked<IVectorStore>;

  const mockSourceId = '550e8400-e29b-41d4-a716-446655440000';
  const mockSectorId = '660e8400-e29b-41d4-a716-446655440001';

  beforeEach(() => {
    // Mock Repository
    mockRepository = {
      saveSource: jest.fn(),
      findSourceById: jest.fn(),
      findSourcesBySector: jest.fn(),
      findSourcesByStatus: jest.fn(),
      softDeleteSource: jest.fn(),
      deleteSource: jest.fn(),
      countSourcesBySector: jest.fn(),
      saveFragments: jest.fn(),
      findFragmentById: jest.fn(),
      findFragmentsBySource: jest.fn(),
      deleteFragmentsBySource: jest.fn(),
      countFragmentsBySource: jest.fn(),
      transaction: jest.fn().mockImplementation(async (cb: () => Promise<void>) => cb()),
    } as unknown as jest.Mocked<IKnowledgeRepository>;

    // Mock Vector Store
    mockVectorStore = {
      upsertVectors: jest.fn().mockResolvedValue(undefined),
      vectorSearch: jest.fn(),
      deleteBySourceId: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IVectorStore>;

    useCase = new DeleteSourceUseCase(mockRepository, mockVectorStore);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function createMockSource(overrides?: Partial<KnowledgeSource>): KnowledgeSource {
    const source = new KnowledgeSource({
      title: 'Test Document',
      sectorId: mockSectorId,
      sourceType: SourceType.PDF,
      content: 'Test content for the document',
    });
    Reflect.set(source, 'id', mockSourceId);
    Reflect.set(source, 'status', 'COMPLETED');

    if (overrides) {
      for (const [key, value] of Object.entries(overrides)) {
        Reflect.set(source, key, value);
      }
    }

    return source;
  }

  describe('execute', () => {
    it('should successfully delete source, fragments, and vectors', async () => {
      const dto: DeleteSourceDto = {
        sourceId: mockSourceId,
        sectorId: mockSectorId,
      };

      const mockSource = createMockSource();
      const fragmentCount = 5;

      mockRepository.findSourceById.mockResolvedValue(mockSource);
      mockRepository.countFragmentsBySource.mockResolvedValue(fragmentCount);
      mockRepository.deleteFragmentsBySource.mockResolvedValue(undefined);
      mockRepository.softDeleteSource.mockResolvedValue(undefined);

      const result: DeleteSourceResult = await useCase.execute(dto);

      expect(result.sourceId).toBe(mockSourceId);
      expect(result.fragmentsDeleted).toBe(fragmentCount);
      expect(result.vectorsDeleted).toBe(true);
    });

    it('should call deleteBySourceId on vector store with correct parameters', async () => {
      const dto: DeleteSourceDto = {
        sourceId: mockSourceId,
        sectorId: mockSectorId,
      };

      mockRepository.findSourceById.mockResolvedValue(createMockSource());
      mockRepository.countFragmentsBySource.mockResolvedValue(3);

      await useCase.execute(dto);

      expect(mockVectorStore.deleteBySourceId).toHaveBeenCalledWith(
        mockSourceId,
        mockSectorId,
      );
      expect(mockVectorStore.deleteBySourceId).toHaveBeenCalledTimes(1);
    });

    it('should delete fragments from PostgreSQL', async () => {
      const dto: DeleteSourceDto = {
        sourceId: mockSourceId,
        sectorId: mockSectorId,
      };

      mockRepository.findSourceById.mockResolvedValue(createMockSource());
      mockRepository.countFragmentsBySource.mockResolvedValue(10);

      await useCase.execute(dto);

      expect(mockRepository.deleteFragmentsBySource).toHaveBeenCalledWith(
        mockSourceId,
      );
    });

    it('should soft delete the source from PostgreSQL', async () => {
      const dto: DeleteSourceDto = {
        sourceId: mockSourceId,
        sectorId: mockSectorId,
      };

      mockRepository.findSourceById.mockResolvedValue(createMockSource());
      mockRepository.countFragmentsBySource.mockResolvedValue(2);

      await useCase.execute(dto);

      expect(mockRepository.softDeleteSource).toHaveBeenCalledWith(
        mockSourceId,
      );
    });

    it('should throw error if source is not found', async () => {
      const nonExistentId = '770e8400-e29b-41d4-a716-446655440099';
      const dto: DeleteSourceDto = {
        sourceId: nonExistentId,
        sectorId: mockSectorId,
      };

      mockRepository.findSourceById.mockResolvedValue(null);

      await expect(useCase.execute(dto)).rejects.toThrow(
        `Knowledge source not found: ${nonExistentId}`,
      );

      expect(mockVectorStore.deleteBySourceId).not.toHaveBeenCalled();
      expect(mockRepository.deleteFragmentsBySource).not.toHaveBeenCalled();
      expect(mockRepository.softDeleteSource).not.toHaveBeenCalled();
    });

    it('should throw error if source is already deleted', async () => {
      const dto: DeleteSourceDto = {
        sourceId: mockSourceId,
        sectorId: mockSectorId,
      };

      const deletedSource = createMockSource({ status: 'DELETED' });
      Reflect.set(deletedSource, 'deletedAt', new Date());
      mockRepository.findSourceById.mockResolvedValue(deletedSource);

      await expect(useCase.execute(dto)).rejects.toThrow(
        'Knowledge source is already deleted',
      );

      expect(mockVectorStore.deleteBySourceId).not.toHaveBeenCalled();
    });

    it('should handle vector store deletion failure gracefully', async () => {
      const dto: DeleteSourceDto = {
        sourceId: mockSourceId,
        sectorId: mockSectorId,
      };

      mockRepository.findSourceById.mockResolvedValue(createMockSource());
      mockRepository.countFragmentsBySource.mockResolvedValue(3);
      mockVectorStore.deleteBySourceId.mockRejectedValue(
        new Error('Pinecone connection failed'),
      );

      const result = await useCase.execute(dto);

      // Should still delete from PostgreSQL
      expect(mockRepository.deleteFragmentsBySource).toHaveBeenCalled();
      expect(mockRepository.softDeleteSource).toHaveBeenCalled();
      // But report that vectors were not deleted
      expect(result.vectorsDeleted).toBe(false);
    });

    it('should delete vectors BEFORE fragments for data consistency', async () => {
      const dto: DeleteSourceDto = {
        sourceId: mockSourceId,
        sectorId: mockSectorId,
      };

      const callOrder: string[] = [];

      mockRepository.findSourceById.mockResolvedValue(createMockSource());
      mockRepository.countFragmentsBySource.mockResolvedValue(2);
      mockVectorStore.deleteBySourceId.mockImplementation(async () => {
        callOrder.push('vectorStore.deleteBySourceId');
      });
      mockRepository.deleteFragmentsBySource.mockImplementation(async () => {
        callOrder.push('repository.deleteFragmentsBySource');
      });
      mockRepository.softDeleteSource.mockImplementation(async () => {
        callOrder.push('repository.softDeleteSource');
      });

      await useCase.execute(dto);

      expect(callOrder).toEqual([
        'vectorStore.deleteBySourceId',
        'repository.deleteFragmentsBySource',
        'repository.softDeleteSource',
      ]);
    });
  });

  describe('input validation', () => {
    it('should throw error if sourceId is empty', async () => {
      const dto: DeleteSourceDto = {
        sourceId: '',
        sectorId: mockSectorId,
      };

      await expect(useCase.execute(dto)).rejects.toThrow(
        'SourceId is required',
      );
    });

    it('should throw error if sectorId is empty', async () => {
      const dto: DeleteSourceDto = {
        sourceId: mockSourceId,
        sectorId: '',
      };

      await expect(useCase.execute(dto)).rejects.toThrow(
        'SectorId is required',
      );
    });
  });
});

