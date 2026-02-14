import { Injectable, Logger, Inject } from '@nestjs/common';
import type { IKnowledgeRepository } from '@modules/knowledge/domain/repositories/knowledge.repository.interface';
import type { IVectorStore } from '@modules/knowledge/domain/services/vector-store.interface';
import type {
  DeleteSourceDto,
  DeleteSourceResult,
} from '@modules/knowledge/application/dtos/delete-source.dto';
import { isValidUUID, requireNonEmpty } from '@shared/validators';
import { extractErrorMessage } from '@shared/utils';

/**
 * Use Case: Delete Knowledge Source
 *
 * Orchestrates the complete deletion of a knowledge source:
 * 1. Validates input and finds the source
 * 2. Deletes vectors from Pinecone (via IVectorStore)
 * 3. Deletes fragments from PostgreSQL
 * 4. Soft-deletes the source from PostgreSQL
 *
 * Deletion Order (critical for data consistency):
 * - Vectors (Pinecone) → Fragments (PostgreSQL) → Source (PostgreSQL)
 * - If Pinecone deletion fails, PostgreSQL cleanup still proceeds
 *   (orphaned vectors in Pinecone are acceptable; orphaned fragments are not)
 *
 * @example
 * ```typescript
 * const result = await deleteSourceUseCase.execute({
 *   sourceId: 'source-uuid-123',
 *   sectorId: 'sector-uuid-456',
 * });
 * ```
 */
@Injectable()
export class DeleteSourceUseCase {
  private readonly logger = new Logger(DeleteSourceUseCase.name);

  constructor(
    @Inject('IKnowledgeRepository')
    private readonly repository: IKnowledgeRepository,
    @Inject('IVectorStore')
    private readonly vectorStore: IVectorStore,
  ) {}

  /**
   * Executes the knowledge source deletion process
   *
   * @param dto - Deletion request with sourceId and sectorId
   * @returns Deletion result with statistics
   * @throws {Error} If source not found, already deleted, or validation fails
   */
  async execute(dto: DeleteSourceDto): Promise<DeleteSourceResult> {
    this.logger.log(`Starting source deletion: ${dto.sourceId}`);

    // Step 1: Validate input
    this.validateInput(dto);

    // Step 2: Find the source
    const source = await this.repository.findSourceById(dto.sourceId);

    if (!source) {
      throw new Error(`Knowledge source not found: ${dto.sourceId}`);
    }

    if (source.isDeleted()) {
      throw new Error('Knowledge source is already deleted');
    }

    // Step 3: Count fragments before deletion (for reporting)
    const fragmentCount = await this.repository.countFragmentsBySource(
      dto.sourceId,
    );

    // Step 4: Delete vectors from Pinecone (best-effort)
    let vectorsDeleted = false;
    try {
      await this.vectorStore.deleteBySourceId(dto.sourceId, dto.sectorId);
      vectorsDeleted = true;
      this.logger.debug(
        `Vectors deleted from Pinecone for source ${dto.sourceId}`,
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to delete vectors from Pinecone for source ${dto.sourceId}: ${extractErrorMessage(error)}. Continuing with PostgreSQL cleanup.`,
      );
    }

    // Step 5 & 6: Delete fragments and soft-delete source within a transaction
    // to ensure atomicity — if either step fails, both are rolled back.
    await this.repository.transaction(async () => {
      await this.repository.deleteFragmentsBySource(dto.sourceId);
      this.logger.debug(
        `${fragmentCount} fragments deleted from PostgreSQL for source ${dto.sourceId}`,
      );

      await this.repository.softDeleteSource(dto.sourceId);
      this.logger.log(
        `Source ${dto.sourceId} soft-deleted successfully (${fragmentCount} fragments, vectors: ${vectorsDeleted ? 'cleaned' : 'failed'})`,
      );
    });

    return {
      sourceId: dto.sourceId,
      fragmentsDeleted: fragmentCount,
      vectorsDeleted,
    };
  }

  /**
   * Validates the input DTO
   *
   * @param dto - Deletion request to validate
   * @throws {Error} If validation fails
   */
  private validateInput(dto: DeleteSourceDto): void {
    requireNonEmpty(dto.sourceId, 'SourceId');
    requireNonEmpty(dto.sectorId, 'SectorId');

    if (!isValidUUID(dto.sourceId)) {
      throw new Error('SourceId must be a valid UUID');
    }

    if (!isValidUUID(dto.sectorId)) {
      throw new Error('SectorId must be a valid UUID');
    }
  }
}
