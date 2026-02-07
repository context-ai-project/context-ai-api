import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MinLength,
} from 'class-validator';

// Constants for validation
const MIN_QUERY_LENGTH = 1;
const MIN_RESULTS = 1;
const MAX_RESULTS = 20;
const MIN_SIMILARITY = 0;
const MAX_SIMILARITY = 1;

// Example UUIDs for documentation
const EXAMPLE_USER_UUID = '550e8400-e29b-41d4-a716-446655440000';
const EXAMPLE_SECTOR_UUID = '660e8400-e29b-41d4-a716-446655440001';
const EXAMPLE_CONVERSATION_UUID = '770e8400-e29b-41d4-a716-446655440002';

/**
 * DTO for Query Assistant Request
 *
 * Represents the input for querying the RAG assistant.
 *
 * Validation:
 * - userId: Required UUID
 * - sectorId: Required UUID
 * - query: Required, non-empty string
 * - conversationId: Optional UUID
 * - maxResults: Optional, 1-20
 * - minSimilarity: Optional, 0-1
 */
export class QueryAssistantDto {
  @ApiProperty({
    description: 'User ID requesting the query',
    example: EXAMPLE_USER_UUID,
    required: true,
  })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({
    description: 'Sector ID for knowledge context',
    example: EXAMPLE_SECTOR_UUID,
    required: true,
  })
  @IsUUID()
  @IsNotEmpty()
  sectorId!: string;

  @ApiProperty({
    description: 'User query/question',
    example: 'How do I request vacation?',
    required: true,
    minLength: MIN_QUERY_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(MIN_QUERY_LENGTH)
  query!: string;

  @ApiProperty({
    description: 'Optional conversation ID to continue existing conversation',
    example: EXAMPLE_CONVERSATION_UUID,
    required: false,
  })
  @IsUUID()
  @IsOptional()
  conversationId?: string;

  @ApiProperty({
    description: 'Maximum number of knowledge fragments to retrieve',
    example: 5,
    minimum: MIN_RESULTS,
    maximum: MAX_RESULTS,
    required: false,
    default: 5,
  })
  @IsNumber()
  @Min(MIN_RESULTS)
  @Max(MAX_RESULTS)
  @IsOptional()
  maxResults?: number;

  @ApiProperty({
    description: 'Minimum similarity threshold (0-1) for fragments',
    example: 0.7,
    minimum: MIN_SIMILARITY,
    maximum: MAX_SIMILARITY,
    required: false,
    default: 0.7,
  })
  @IsNumber()
  @Min(MIN_SIMILARITY)
  @Max(MAX_SIMILARITY)
  @IsOptional()
  minSimilarity?: number;
}

/**
 * Source fragment in response
 */
export class SourceFragmentDto {
  @ApiProperty({
    description: 'Fragment ID',
    example: '880e8400-e29b-41d4-a716-446655440003',
  })
  id!: string;

  @ApiProperty({
    description: 'Fragment content',
    example: 'Vacation requests must be submitted 15 days in advance...',
  })
  content!: string;

  @ApiProperty({
    description: 'Source document ID',
    example: '990e8400-e29b-41d4-a716-446655440004',
  })
  sourceId!: string;

  @ApiProperty({
    description: 'Similarity score (0-1)',
    example: 0.92,
    minimum: 0,
    maximum: 1,
  })
  similarity!: number;

  @ApiProperty({
    description: 'Optional metadata',
    example: { page: 5, section: 'policies' },
    required: false,
  })
  metadata?: Record<string, unknown>;
}

/**
 * DTO for Query Assistant Response
 *
 * Represents the output from the RAG assistant.
 */
export class QueryAssistantResponseDto {
  @ApiProperty({
    description: 'Assistant response to the query',
    example:
      'To request vacation, you need to submit a request through the HR portal at least 15 days in advance. The request should include your desired dates and a brief reason.',
  })
  response!: string;

  @ApiProperty({
    description: 'Conversation ID',
    example: EXAMPLE_CONVERSATION_UUID,
  })
  conversationId!: string;

  @ApiProperty({
    description: 'Source fragments used to generate the response',
    type: [SourceFragmentDto],
    isArray: true,
  })
  sources!: SourceFragmentDto[];

  @ApiProperty({
    description: 'Response timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  timestamp!: Date;
}
