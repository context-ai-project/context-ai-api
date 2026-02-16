import { Injectable, Logger, Inject } from '@nestjs/common';
import type { IKnowledgeRepository } from '@modules/knowledge/domain/repositories/knowledge.repository.interface';
import type {
  IVectorStore,
  VectorUpsertInput,
} from '@modules/knowledge/domain/services/vector-store.interface';
import { DocumentParserService } from '@modules/knowledge/infrastructure/services/document-parser.service';
import {
  ChunkingService,
  type TextChunk,
} from '@modules/knowledge/infrastructure/services/chunking.service';
import { EmbeddingService } from '@modules/knowledge/infrastructure/services/embedding.service';
import {
  KnowledgeSource,
  type SourceMetadata,
} from '@modules/knowledge/domain/entities/knowledge-source.entity';
import { Fragment } from '@modules/knowledge/domain/entities/fragment.entity';
import type {
  IngestDocumentDto,
  IngestDocumentResult,
} from '@modules/knowledge/application/dtos/ingest-document.dto';
import { SourceStatus } from '@shared/types';
import { extractErrorMessage, extractErrorStack } from '@shared/utils';
import { requireNonEmpty } from '@shared/validators';

// Constants for validation (OWASP: Magic Numbers)
const MIN_BUFFER_SIZE = 1;

/**
 * Parameter object for vector store upsert operation.
 * Groups related parameters that always travel together.
 */
interface VectorIndexPayload {
  fragments: Fragment[];
  embeddings: number[][];
  sourceId: string;
  sectorId: string;
}

/**
 * Use Case: Ingest Document
 *
 * Orchestrates the complete document ingestion process:
 * 1. Validates input
 * 2. Parses document content
 * 3. Creates KnowledgeSource entity
 * 4. Chunks content into fragments
 * 5. Generates embeddings for each fragment
 * 6. Persists source and fragments to PostgreSQL
 * 7. Upserts embeddings to Pinecone vector store
 * 8. Updates source status
 *
 * @example
 * ```typescript
 * const result = await ingestDocumentUseCase.execute({
 *   title: "Employee Handbook",
 *   sectorId: "hr-sector-123",
 *   sourceType: SourceType.PDF,
 *   buffer: pdfBuffer,
 * });
 * ```
 */
@Injectable()
export class IngestDocumentUseCase {
  private readonly logger = new Logger(IngestDocumentUseCase.name);

  constructor(
    @Inject('IKnowledgeRepository')
    private readonly repository: IKnowledgeRepository,
    @Inject('IVectorStore')
    private readonly vectorStore: IVectorStore,
    private readonly parserService: DocumentParserService,
    private readonly chunkingService: ChunkingService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * Executes the document ingestion process
   *
   * @param dto - Document ingestion data
   * @returns Ingestion result with source ID and statistics
   * @throws {Error} If validation fails or any processing step fails
   */
  async execute(dto: IngestDocumentDto): Promise<IngestDocumentResult> {
    this.logger.log(`Starting document ingestion: ${dto.title}`);
    let savedSource: KnowledgeSource | undefined;

    try {
      this.validateInput(dto);

      const parsed = await this.parseDocument(dto);
      savedSource = await this.createAndPersistSource(dto, parsed);
      const { chunks, embeddings } = await this.chunkAndEmbed(parsed.content);
      const savedFragments = await this.persistFragments(
        chunks,
        savedSource.id!,
      );
      await this.upsertToVectorStore({
        fragments: savedFragments,
        embeddings,
        sourceId: savedSource.id!,
        sectorId: dto.sectorId,
      });
      await this.markSourceCompleted(savedSource);

      return this.buildResult(
        savedSource,
        savedFragments.length,
        parsed.content,
      );
    } catch (error: unknown) {
      // Mark the source as FAILED if it was already persisted
      if (savedSource) {
        try {
          savedSource.markAsFailed(extractErrorMessage(error));
          await this.repository.saveSource(savedSource);
        } catch (statusError: unknown) {
          this.logger.error(
            `Failed to mark source ${savedSource.id} as FAILED: ${extractErrorMessage(statusError)}`,
          );
        }
      }

      this.logger.error(
        `Document ingestion failed: ${extractErrorMessage(error)}`,
        {
          title: dto.title,
          sectorId: dto.sectorId,
          error: extractErrorStack(error),
        },
      );
      throw error;
    }
  }

  /**
   * Parses the raw document buffer into structured content
   */
  private async parseDocument(
    dto: IngestDocumentDto,
  ): Promise<{ content: string; metadata: Record<string, unknown> }> {
    this.logger.debug('Parsing document...');
    return this.parserService.parse(dto.buffer, dto.sourceType);
  }

  /**
   * Creates a KnowledgeSource entity and persists it with PROCESSING status
   */
  private async createAndPersistSource(
    dto: IngestDocumentDto,
    parsed: { content: string; metadata: Record<string, unknown> },
  ): Promise<KnowledgeSource> {
    this.logger.debug('Creating and saving knowledge source...');
    const source = new KnowledgeSource({
      title: dto.title,
      sectorId: dto.sectorId,
      sourceType: dto.sourceType,
      content: parsed.content,
      metadata: {
        ...dto.metadata,
        ...parsed.metadata,
      } as SourceMetadata,
    });
    source.markAsProcessing();

    const savedSource = await this.repository.saveSource(source);
    if (!savedSource.id) {
      throw new Error('Failed to save knowledge source: ID not generated');
    }
    return savedSource;
  }

  /**
   * Chunks the content and generates embeddings in parallel-ready steps
   */
  private async chunkAndEmbed(
    content: string,
  ): Promise<{ chunks: TextChunk[]; embeddings: number[][] }> {
    this.logger.debug('Chunking content...');
    const chunks: TextChunk[] = this.chunkingService.chunk(content);
    this.logger.debug(`Created ${chunks.length} chunks`);

    this.logger.debug('Generating embeddings...');
    const chunkTexts: string[] = chunks.map(
      (chunk: TextChunk) => chunk.content,
    );
    const embeddings: number[][] =
      await this.embeddingService.generateDocumentEmbeddings(chunkTexts);

    return { chunks, embeddings };
  }

  /**
   * Creates Fragment entities and saves them to PostgreSQL
   */
  private async persistFragments(
    chunks: TextChunk[],
    sourceId: string,
  ): Promise<Fragment[]> {
    this.logger.debug('Creating and saving fragment entities...');
    const fragments: Fragment[] = chunks.map(
      (chunk: TextChunk) =>
        new Fragment({
          sourceId,
          content: chunk.content,
          position: chunk.position,
          tokenCount: chunk.tokens,
          metadata: {
            startIndex: chunk.startIndex,
            endIndex: chunk.endIndex,
            tokens: chunk.tokens,
          },
        }),
    );
    return this.repository.saveFragments(fragments);
  }

  /**
   * Upserts fragment embeddings to Pinecone vector store.
   * Uses fragment.position as a stable key to align embeddings with fragments,
   * ensuring correct mapping even if the repository reorders fragments.
   */
  private async upsertToVectorStore(
    payload: VectorIndexPayload,
  ): Promise<void> {
    this.logger.debug('Upserting embeddings to Pinecone...');

    const { fragments, embeddings, sourceId, sectorId } = payload;

    if (embeddings.length !== fragments.length) {
      throw new Error(
        `Embedding/fragment count mismatch: got ${embeddings.length} embeddings for ${fragments.length} fragments`,
      );
    }

    // Build map keyed by position (stable across reordering) instead of index
    const embeddingsMap = new Map(embeddings.map((e, i) => [i, e]));

    // Sort fragments by position to align with original embedding order
    const orderedFragments = [...fragments].sort(
      (a, b) => a.position - b.position,
    );

    const vectorInputs: VectorUpsertInput[] = orderedFragments.map(
      (fragment: Fragment, index: number) => ({
        id: fragment.id!,
        embedding: embeddingsMap.get(index)!,
        metadata: {
          sourceId,
          sectorId,
          content: fragment.content,
          position: fragment.position,
          tokenCount: fragment.tokenCount,
        },
      }),
    );
    await this.vectorStore.upsertVectors(vectorInputs);
  }

  /**
   * Marks source as COMPLETED and rethrows on failure so the execute-level
   * error handler can mark the source as FAILED.
   */
  private async markSourceCompleted(
    savedSource: KnowledgeSource,
  ): Promise<void> {
    this.logger.debug('Updating source status to COMPLETED...');
    savedSource.markAsCompleted();
    await this.repository.saveSource(savedSource);
  }

  /**
   * Builds the final ingestion result DTO.
   * Derives status from the actual saved source entity rather than hardcoding.
   */
  private buildResult(
    savedSource: KnowledgeSource,
    fragmentCount: number,
    content: string,
  ): IngestDocumentResult {
    const result: IngestDocumentResult = {
      sourceId: savedSource.id!,
      title: savedSource.title,
      fragmentCount,
      contentSize: Buffer.byteLength(content, 'utf8'),
      status:
        (savedSource.status as SourceStatus.COMPLETED | SourceStatus.FAILED) ??
        SourceStatus.COMPLETED,
    };

    this.logger.log(
      `Document ingestion completed: ${result.sourceId} (${result.fragmentCount} fragments)`,
    );

    return result;
  }

  /**
   * Validates the input DTO
   *
   * @param dto - Document ingestion data
   * @throws {Error} If validation fails
   *
   * Security: Input validation to prevent injection and malformed data
   */
  private validateInput(dto: IngestDocumentDto): void {
    requireNonEmpty(dto.title, 'Title');
    requireNonEmpty(dto.sectorId, 'SectorId');

    // Validate buffer
    if (!dto.buffer || dto.buffer.length < MIN_BUFFER_SIZE) {
      throw new Error('Buffer cannot be empty');
    }

    // Validate source type
    if (!dto.sourceType) {
      throw new Error('SourceType is required');
    }
  }
}
