import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  IsObject,
  MinLength,
  MaxLength,
} from 'class-validator';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiProperty,
} from '@nestjs/swagger';
import { IngestDocumentUseCase } from '../application/use-cases/ingest-document.use-case';
import type {
  IngestDocumentDto,
  IngestDocumentResult,
} from '../application/dtos/ingest-document.dto';
import { SourceType } from '@shared/types';

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
 * DTO for document upload request
 * Used for Swagger documentation and validation
 */
class UploadDocumentDto {
  @ApiProperty({
    description: DESC_DOCUMENT_TITLE,
    example: EXAMPLE_DOCUMENT_TITLE,
    minLength: 1,
    maxLength: MAX_TITLE_LENGTH,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_TITLE_LENGTH)
  title!: string;

  @ApiProperty({
    description: 'Sector/context identifier',
    example: EXAMPLE_UUID,
    format: 'uuid',
  })
  @IsUUID()
  sectorId!: string;

  @ApiProperty({
    description: 'Source type',
    enum: ['PDF', 'MARKDOWN', 'URL'],
    example: 'PDF',
  })
  @IsEnum(['PDF', 'MARKDOWN', 'URL'])
  sourceType!: SourceType;

  @ApiProperty({
    description: 'Optional metadata for the document',
    required: false,
    example: { author: 'HR Department', version: '1.0' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for successful document ingestion response
 */
class IngestDocumentResponseDto {
  @ApiProperty({
    description: 'Created knowledge source ID',
    example: EXAMPLE_UUID,
  })
  sourceId!: string;

  @ApiProperty({
    description: DESC_DOCUMENT_TITLE,
    example: EXAMPLE_DOCUMENT_TITLE,
  })
  title!: string;

  @ApiProperty({
    description: 'Number of fragments created',
    example: 15,
  })
  fragmentCount!: number;

  @ApiProperty({
    description: 'Content size in bytes',
    example: 45678,
  })
  contentSize!: number;

  @ApiProperty({
    description: 'Processing status',
    example: 'COMPLETED',
    enum: ['COMPLETED', 'FAILED'],
  })
  status!: string;

  @ApiProperty({
    description: 'Error message if processing failed',
    required: false,
    example: null,
  })
  errorMessage?: string;
}

/**
 * DTO for error response
 */
class ErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  statusCode!: number;

  @ApiProperty({
    description: 'Error message',
    example: 'File is required',
  })
  message!: string;

  @ApiProperty({
    description: 'Error type',
    example: 'Bad Request',
  })
  error!: string;
}

/**
 * Knowledge Controller
 *
 * Handles HTTP requests for knowledge management operations.
 * Provides endpoints for document ingestion and retrieval.
 *
 * @version 1.0.0
 */
@ApiTags('Knowledge')
@Controller('knowledge')
export class KnowledgeController {
  private readonly logger = new Logger(KnowledgeController.name);

  constructor(private readonly ingestDocumentUseCase: IngestDocumentUseCase) {}

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
  @ApiOperation({
    summary: 'Upload and ingest a document',
    description:
      'Uploads a document (PDF, Markdown, or text), parses it, generates embeddings, ' +
      'and stores it in the knowledge base for RAG retrieval. ' +
      'The document is chunked into fragments with overlapping context for better retrieval accuracy.',
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
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Document ingestion failed: ${errorMessage}`, {
        title: dto.title,
        sourceType: dto.sourceType,
        error: error instanceof Error ? error.stack : undefined,
      });

      // Re-throw to be handled by NestJS exception filters
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
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(dto.sectorId.trim())) {
      throw new BadRequestException('SectorId must be a valid UUID');
    }

    // Validate sourceType
    const validSourceTypes = ['PDF', 'MARKDOWN', 'URL'];
    const sourceTypeStr = String(dto.sourceType);
    if (!dto.sourceType || !validSourceTypes.includes(sourceTypeStr)) {
      throw new BadRequestException(
        `SourceType must be one of: ${validSourceTypes.join(', ')}`,
      );
    }
  }
}
