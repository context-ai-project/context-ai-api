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
  IsBoolean,
} from 'class-validator';

// Constants for validation
const MIN_QUERY_LENGTH = 1;
const MIN_RESULTS = 1;
const MAX_RESULTS = 20;
const MIN_SIMILARITY = 0;
const MAX_SIMILARITY = 1;
const MIN_PAGE_LIMIT = 1;
const MAX_PAGE_LIMIT = 100;
const DEFAULT_PAGE_LIMIT = 10;

// Example UUIDs for documentation
const EXAMPLE_USER_UUID = '550e8400-e29b-41d4-a716-446655440000';
const EXAMPLE_SECTOR_UUID = '660e8400-e29b-41d4-a716-446655440001';
const EXAMPLE_CONVERSATION_UUID = '770e8400-e29b-41d4-a716-446655440002';

// Descriptions for API documentation
const DESC_USER_ID = 'User ID';
const DESC_SECTOR_ID = 'Sector ID';
const DESC_CONVERSATION_ID = 'Conversation ID';
const DESC_IS_ACTIVE = 'Conversation is active';
const DESC_OPTIONAL_METADATA = 'Optional metadata';

// Example timestamps
const EXAMPLE_TIMESTAMP = '2024-01-15T10:30:00Z';

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
    example: EXAMPLE_TIMESTAMP,
  })
  timestamp!: Date;
}

/**
 * DTO for Get Conversations Request (Query Parameters)
 *
 * Used to list conversations for a user with pagination.
 */
export class GetConversationsDto {
  @ApiProperty({
    description: 'User ID to filter conversations',
    example: EXAMPLE_USER_UUID,
    required: true,
  })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({
    description: 'Number of conversations to return',
    example: DEFAULT_PAGE_LIMIT,
    minimum: MIN_PAGE_LIMIT,
    maximum: MAX_PAGE_LIMIT,
    required: false,
    default: DEFAULT_PAGE_LIMIT,
  })
  @IsNumber()
  @Min(MIN_PAGE_LIMIT)
  @Max(MAX_PAGE_LIMIT)
  @IsOptional()
  limit?: number;

  @ApiProperty({
    description: 'Number of conversations to skip (for pagination)',
    example: 0,
    minimum: 0,
    required: false,
    default: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  offset?: number;

  @ApiProperty({
    description: 'Include inactive conversations',
    example: false,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  includeInactive?: boolean;
}

/**
 * DTO for Message in Conversation Response
 */
export class MessageDto {
  @ApiProperty({
    description: 'Message ID',
    example: 'aa0e8400-e29b-41d4-a716-446655440005',
  })
  id!: string;

  @ApiProperty({
    description: 'Message role',
    example: 'USER',
    enum: ['USER', 'ASSISTANT', 'SYSTEM'],
  })
  role!: string;

  @ApiProperty({
    description: 'Message content',
    example: 'How do I request vacation?',
  })
  content!: string;

  @ApiProperty({
    description: 'Message timestamp',
    example: EXAMPLE_TIMESTAMP,
  })
  timestamp!: Date;

  @ApiProperty({
    description: DESC_OPTIONAL_METADATA,
    example: { sources: [] },
    required: false,
  })
  metadata?: Record<string, unknown>;
}

/**
 * DTO for Conversation Summary (List view)
 */
export class ConversationSummaryDto {
  @ApiProperty({
    description: DESC_CONVERSATION_ID,
    example: EXAMPLE_CONVERSATION_UUID,
  })
  id!: string;

  @ApiProperty({
    description: DESC_USER_ID,
    example: EXAMPLE_USER_UUID,
  })
  userId!: string;

  @ApiProperty({
    description: DESC_SECTOR_ID,
    example: EXAMPLE_SECTOR_UUID,
  })
  sectorId!: string;

  @ApiProperty({
    description: 'Conversation title (optional)',
    example: 'Vacation Policy Questions',
    required: false,
  })
  title?: string;

  @ApiProperty({
    description: DESC_IS_ACTIVE,
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'Number of messages in conversation',
    example: 5,
  })
  messageCount!: number;

  @ApiProperty({
    description: 'Last message preview',
    example: 'To request vacation, you need to...',
    required: false,
  })
  lastMessagePreview?: string;

  @ApiProperty({
    description: 'Conversation created timestamp',
    example: '2024-01-15T10:00:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Conversation last updated timestamp',
    example: EXAMPLE_TIMESTAMP,
  })
  updatedAt!: Date;
}

/**
 * DTO for Conversations List Response
 */
export class ConversationsListDto {
  @ApiProperty({
    description: 'Array of conversations',
    type: [ConversationSummaryDto],
    isArray: true,
  })
  conversations!: ConversationSummaryDto[];

  @ApiProperty({
    description: 'Total number of conversations',
    example: 42,
  })
  total!: number;

  @ApiProperty({
    description: 'Number of conversations returned',
    example: 10,
  })
  count!: number;

  @ApiProperty({
    description: 'Current offset',
    example: 0,
  })
  offset!: number;

  @ApiProperty({
    description: 'Has more conversations',
    example: true,
  })
  hasMore!: boolean;
}

/**
 * DTO for Full Conversation with Messages Response
 */
export class ConversationDetailDto {
  @ApiProperty({
    description: DESC_CONVERSATION_ID,
    example: EXAMPLE_CONVERSATION_UUID,
  })
  id!: string;

  @ApiProperty({
    description: DESC_USER_ID,
    example: EXAMPLE_USER_UUID,
  })
  userId!: string;

  @ApiProperty({
    description: DESC_SECTOR_ID,
    example: EXAMPLE_SECTOR_UUID,
  })
  sectorId!: string;

  @ApiProperty({
    description: 'Conversation title (optional)',
    example: 'Vacation Policy Questions',
    required: false,
  })
  title?: string;

  @ApiProperty({
    description: DESC_IS_ACTIVE,
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'Array of messages',
    type: [MessageDto],
    isArray: true,
  })
  messages!: MessageDto[];

  @ApiProperty({
    description: 'Conversation created timestamp',
    example: '2024-01-15T10:00:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Conversation last updated timestamp',
    example: EXAMPLE_TIMESTAMP,
  })
  updatedAt!: Date;

  // Removed metadata property - Conversation entity doesn't have metadata
  // Message entities have metadata, which is included in MessageDto
}
