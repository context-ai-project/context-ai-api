import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  IsObject,
  MinLength,
  MaxLength,
} from 'class-validator';
import { SourceType, type SourceStatus } from '@shared/types';

// Constants for validation
const MAX_TITLE_LENGTH = 255;

// Example values for documentation
const EXAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000';
const EXAMPLE_DOCUMENT_TITLE = 'Employee Handbook 2024';

// Descriptions
const DESC_DOCUMENT_TITLE = 'Document title';

/**
 * DTO for document upload request
 * Used for Swagger documentation and validation
 */
export class UploadDocumentDto {
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
    enum: SourceType,
    example: 'PDF',
  })
  @IsEnum(SourceType)
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
export class IngestDocumentResponseDto {
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
 * DTO for knowledge source list item
 */
export interface KnowledgeSourceDto {
  id: string;
  title: string;
  sectorId: string;
  sourceType: SourceType;
  status: SourceStatus;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO for a knowledge source detail (with content and fragment count)
 */
export interface KnowledgeSourceDetailDto extends KnowledgeSourceDto {
  content: string;
  fragmentCount: number;
}

/**
 * DTO for error response
 */
export class ErrorResponseDto {
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
