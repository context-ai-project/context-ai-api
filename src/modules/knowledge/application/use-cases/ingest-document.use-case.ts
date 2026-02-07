import { Injectable, Logger, Inject } from '@nestjs/common';
import type { IKnowledgeRepository } from '@modules/knowledge/domain/repositories/knowledge.repository.interface';
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
import {
  Fragment,
  type FragmentMetadata,
} from '@modules/knowledge/domain/entities/fragment.entity';
import type {
  IngestDocumentDto,
  IngestDocumentResult,
} from '@modules/knowledge/application/dtos/ingest-document.dto';

// Constants for validation (OWASP: Magic Numbers)
const MIN_BUFFER_SIZE = 1;
const MIN_TITLE_LENGTH = 1;
const MIN_SECTOR_ID_LENGTH = 1;

/**
 * Use Case: Ingest Document
 *
 * Orchestrates the complete document ingestion process:
 * 1. Validates input
 * 2. Parses document content
 * 3. Creates KnowledgeSource entity
 * 4. Chunks content into fragments
 * 5. Generates embeddings for each fragment
 * 6. Persists source and fragments
 * 7. Updates source status
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

    try {
      // Step 1: Validate input
      this.validateInput(dto);

      // Step 2: Parse document
      this.logger.debug('Parsing document...');
      const parsed = await this.parserService.parse(dto.buffer, dto.sourceType);

      // Step 3: Create KnowledgeSource entity
      this.logger.debug('Creating knowledge source entity...');
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

      // Set status to PROCESSING
      source.markAsProcessing();

      // Step 4: Save source (initial save with PROCESSING status)
      this.logger.debug('Saving knowledge source...');
      const savedSource = await this.repository.saveSource(source);

      if (!savedSource.id) {
        throw new Error('Failed to save knowledge source: ID not generated');
      }

      // Step 5: Chunk content
      this.logger.debug('Chunking content...');
      const chunks: TextChunk[] = this.chunkingService.chunk(parsed.content);
      this.logger.debug(`Created ${chunks.length} chunks`);

      // Step 6: Generate embeddings
      this.logger.debug('Generating embeddings...');
      const chunkTexts: string[] = chunks.map(
        (chunk: TextChunk) => chunk.content,
      );
      const embeddings: number[][] =
        await this.embeddingService.generateDocumentEmbeddings(chunkTexts);

      // Step 7: Create Fragment entities
      this.logger.debug('Creating fragment entities...');
      const fragments: Fragment[] = chunks.map(
        (chunk: TextChunk, index: number) => {
          const content: string = chunk.content;
          const position: number = chunk.position;
          // Safe: index from map() is guaranteed to be valid array index within embeddings array
          // eslint-disable-next-line security/detect-object-injection
          const embeddingAtIndex: number[] = embeddings[index];
          const metadata: FragmentMetadata = {
            startIndex: chunk.startIndex,
            endIndex: chunk.endIndex,
            tokens: chunk.tokens,
          };

          return new Fragment({
            sourceId: savedSource.id!,
            content,
            position,
            embedding: embeddingAtIndex,
            metadata,
          });
        },
      );

      // Step 8: Save fragments
      this.logger.debug('Saving fragments...');
      await this.repository.saveFragments(fragments);

      // Step 9: Update source status to COMPLETED
      this.logger.debug('Updating source status to COMPLETED...');
      savedSource.markAsCompleted();
      await this.repository.saveSource(savedSource);

      // Step 10: Build result
      const result: IngestDocumentResult = {
        sourceId: savedSource.id,
        title: savedSource.title,
        fragmentCount: fragments.length,
        contentSize: Buffer.byteLength(parsed.content, 'utf8'),
        status: 'COMPLETED',
      };

      this.logger.log(
        `Document ingestion completed: ${result.sourceId} (${result.fragmentCount} fragments)`,
      );

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Document ingestion failed: ${errorMessage}`, {
        title: dto.title,
        sectorId: dto.sectorId,
        error: error instanceof Error ? error.stack : undefined,
      });

      // Re-throw the error to be handled by the controller
      throw error;
    }
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
    // Validate title
    if (!dto.title || dto.title.trim().length < MIN_TITLE_LENGTH) {
      throw new Error('Title cannot be empty');
    }

    // Validate sectorId
    if (!dto.sectorId || dto.sectorId.trim().length < MIN_SECTOR_ID_LENGTH) {
      throw new Error('SectorId cannot be empty');
    }

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
