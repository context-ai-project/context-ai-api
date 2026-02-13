import {
  Controller,
  Post,
  Delete,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  NotFoundException,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { IngestDocumentUseCase } from '../application/use-cases/ingest-document.use-case';
import { DeleteSourceUseCase } from '../application/use-cases/delete-source.use-case';
import type {
  IngestDocumentDto,
  IngestDocumentResult,
} from '../application/dtos/ingest-document.dto';
import type { DeleteSourceResult } from '../application/dtos/delete-source.dto';
import {
  UploadDocumentDto,
  IngestDocumentResponseDto,
  ErrorResponseDto,
} from './dtos/knowledge.dto';
import { SourceType } from '@shared/types';
import { isValidUUID } from '@shared/validators';
import { extractErrorMessage, extractErrorStack } from '@shared/utils';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';

/**
 * Uploaded file interface
 * Represents the structure of an uploaded file from Multer
 */
interface UploadedFileData {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

// Constants for file validation (OWASP: Magic Numbers)
const BYTES_IN_KB = 1024;
const KB_IN_MB = 1024;
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * KB_IN_MB * BYTES_IN_KB; // 10MB
const MAX_TITLE_LENGTH = 255;

// MIME types
const MIME_PDF = 'application/pdf';
const MIME_MARKDOWN = 'text/markdown';
const MIME_TEXT = 'text/plain';
const ALLOWED_MIME_TYPES = [MIME_PDF, MIME_MARKDOWN, MIME_TEXT];

// Example UUIDs for documentation
const EXAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000';
const EXAMPLE_DOCUMENT_TITLE = 'Employee Handbook 2024';

// API descriptions
const DESC_DOCUMENT_TITLE = 'Document title';

/**
 * Knowledge Controller
 *
 * Handles HTTP requests for knowledge management operations.
 * Provides endpoints for document ingestion and retrieval.
 *
 * Authorization:
 * - All endpoints require JWT authentication
 * - Document upload requires 'knowledge:create' permission
 *
 * @version 1.0.0
 */
@ApiTags('Knowledge')
@ApiBearerAuth()
@Controller('knowledge')
export class KnowledgeController {
  private readonly logger = new Logger(KnowledgeController.name);

  constructor(
    private readonly ingestDocumentUseCase: IngestDocumentUseCase,
    private readonly deleteSourceUseCase: DeleteSourceUseCase,
  ) {}

  /**
   * Upload and ingest a document into the knowledge base
   *
   * Accepts PDF, Markdown, or plain text files, processes them,
   * generates embeddings, and stores them for RAG retrieval.
   *
   * @param file - The uploaded file
   * @param dto - Document metadata
   * @returns Ingestion result with source ID and statistics
   */
  @Post('documents/upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @RequirePermissions(['knowledge:create'])
  @ApiOperation({
    summary: 'Upload and ingest a document',
    description:
      'Uploads a document (PDF, Markdown, or text), parses it, generates embeddings, ' +
      'and stores it in the knowledge base for RAG retrieval. ' +
      'The document is chunked into fragments with overlapping context for better retrieval accuracy. ' +
      '\n\n**Required Permission:** knowledge:create',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'title', 'sectorId', 'sourceType'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Document file (PDF, Markdown, or text)',
        },
        title: {
          type: 'string',
          description: DESC_DOCUMENT_TITLE,
          example: EXAMPLE_DOCUMENT_TITLE,
          minLength: 1,
          maxLength: MAX_TITLE_LENGTH,
        },
        sectorId: {
          type: 'string',
          format: 'uuid',
          description: 'Sector/context identifier',
          example: EXAMPLE_UUID,
        },
        sourceType: {
          type: 'string',
          enum: ['PDF', 'MARKDOWN', 'URL'],
          description: 'Type of document',
          example: 'PDF',
        },
        metadata: {
          type: 'object',
          description: 'Optional metadata (JSON)',
          example: { author: 'HR Department', version: '1.0' },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Document successfully ingested',
    type: IngestDocumentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request (missing file, invalid format, etc.)',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - Missing or invalid JWT token',
  })
  @ApiForbiddenResponse({
    description: 'Access denied - Requires knowledge:create permission',
  })
  @ApiResponse({
    status: 413,
    description: 'File too large (max 10MB)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during processing',
    type: ErrorResponseDto,
  })
  async uploadDocument(
    @UploadedFile() uploadedFile: UploadedFileData | undefined,
    @Body() dto: UploadDocumentDto,
  ): Promise<IngestDocumentResponseDto> {
    this.logger.log(
      `Upload request received: ${dto.title} (${dto.sourceType})`,
    );

    // Validate file presence
    if (!uploadedFile) {
      throw new BadRequestException('File is required');
    }

    // Validate file size
    const fileSize: number = uploadedFile.size;
    if (fileSize > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB`,
      );
    }

    // Validate MIME type
    const fileMimeType = String(uploadedFile.mimetype);
    const allowedTypes: string[] = ALLOWED_MIME_TYPES;
    if (!allowedTypes.includes(fileMimeType)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
      );
    }

    // Validate required fields
    this.validateUploadDto(dto);

    try {
      // Build IngestDocumentDto
      const fileBuffer: Buffer = uploadedFile.buffer;
      const sourceType: SourceType = dto.sourceType;
      const ingestDto: IngestDocumentDto = {
        title: dto.title.trim(),
        sectorId: dto.sectorId.trim(),
        sourceType,
        buffer: fileBuffer,
        metadata: dto.metadata,
      };

      // Execute use case
      const result: IngestDocumentResult =
        await this.ingestDocumentUseCase.execute(ingestDto);

      this.logger.log(
        `Document ingested successfully: ${result.sourceId} (${result.fragmentCount} fragments)`,
      );

      return result;
    } catch (error: unknown) {
      this.logger.error(
        `Document ingestion failed: ${extractErrorMessage(error)}`,
        {
          title: dto.title,
          sourceType: dto.sourceType,
          error: extractErrorStack(error),
        },
      );

      // Re-throw to be handled by NestJS exception filters
      throw error;
    }
  }

  /**
   * Delete a knowledge source and its associated data
   *
   * Removes the source, all fragments from PostgreSQL,
   * and all vector embeddings from Pinecone.
   *
   * @param sourceId - The knowledge source ID to delete
   * @param sectorId - The sector ID for Pinecone namespace targeting
   * @returns Deletion result with statistics
   */
  @Delete('documents/:sourceId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['knowledge:delete'])
  @ApiOperation({
    summary: 'Delete a knowledge source',
    description:
      'Deletes a knowledge source, its fragments from PostgreSQL, ' +
      'and its vector embeddings from Pinecone. ' +
      'The operation is idempotent — deleting an already-deleted source returns an error. ' +
      '\n\n**Required Permission:** knowledge:delete',
  })
  @ApiParam({
    name: 'sourceId',
    description: 'Knowledge source UUID',
    example: EXAMPLE_UUID,
  })
  @ApiQuery({
    name: 'sectorId',
    description: 'Sector UUID for Pinecone namespace',
    example: EXAMPLE_UUID,
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Source successfully deleted',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request (missing sectorId, invalid UUID)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Knowledge source not found',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - Missing or invalid JWT token',
  })
  @ApiForbiddenResponse({
    description: 'Access denied - Requires knowledge:delete permission',
  })
  async deleteDocument(
    @Param('sourceId') sourceId: string,
    @Query('sectorId') sectorId: string,
  ): Promise<DeleteSourceResult> {
    this.logger.log(`Delete request received for source: ${sourceId}`);

    // Validate sectorId query parameter
    if (!sectorId || sectorId.trim().length === 0) {
      throw new BadRequestException('sectorId query parameter is required');
    }

    if (!isValidUUID(sourceId)) {
      throw new BadRequestException('sourceId must be a valid UUID');
    }

    if (!isValidUUID(sectorId)) {
      throw new BadRequestException('sectorId must be a valid UUID');
    }

    try {
      const result = await this.deleteSourceUseCase.execute({
        sourceId: sourceId.trim(),
        sectorId: sectorId.trim(),
      });

      this.logger.log(
        `Source deleted successfully: ${result.sourceId} (${result.fragmentsDeleted} fragments, vectors: ${result.vectorsDeleted ? 'cleaned' : 'failed'})`,
      );

      return result;
    } catch (error: unknown) {
      const errorMessage = extractErrorMessage(error);

      // Map domain errors to HTTP errors
      if (errorMessage.includes('not found')) {
        throw new NotFoundException(errorMessage);
      }

      if (errorMessage.includes('already deleted')) {
        throw new BadRequestException(errorMessage);
      }

      this.logger.error(`Source deletion failed: ${errorMessage}`, {
        sourceId,
        sectorId,
        error: extractErrorStack(error),
      });

      throw error;
    }
  }

  /**
   * Validates the upload DTO
   *
   * @param dto - Upload DTO to validate
   * @throws {BadRequestException} If validation fails
   *
   * Security: Input validation to prevent injection and malformed data
   */
  private validateUploadDto(dto: UploadDocumentDto): void {
    // Validate title
    if (!dto.title || dto.title.trim().length === 0) {
      throw new BadRequestException('Title is required');
    }

    if (dto.title.length > MAX_TITLE_LENGTH) {
      throw new BadRequestException(
        `Title must be ${MAX_TITLE_LENGTH} characters or less`,
      );
    }

    // Validate sectorId
    if (!dto.sectorId || dto.sectorId.trim().length === 0) {
      throw new BadRequestException('SectorId is required');
    }

    // Basic UUID format validation (after trimming)
    if (!isValidUUID(dto.sectorId)) {
      throw new BadRequestException('SectorId must be a valid UUID');
    }

    // Validate sourceType using SourceType enum (single source of truth)
    const validSourceTypes = Object.values(SourceType) as string[];
    const sourceTypeStr = String(dto.sourceType);
    if (!dto.sourceType || !validSourceTypes.includes(sourceTypeStr)) {
      throw new BadRequestException(
        `SourceType must be one of: ${validSourceTypes.join(', ')}`,
      );
    }
  }
}
