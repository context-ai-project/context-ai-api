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

// Re-export split DTOs so existing imports keep working
export { MessageDto } from './message.dto';
export {
  ConversationSummaryDto,
  ConversationsListDto,
  ConversationDetailDto,
} from './conversation.dto';
export { GetConversationsDto } from './get-conversations.dto';

// Constants for validation
const MIN_QUERY_LENGTH = 1;
const MIN_RESULTS = 1;
const MAX_RESULTS = 20;
const MIN_SIMILARITY = 0;
const MAX_SIMILARITY = 1;

// Example UUIDs for documentation
const EXAMPLE_SECTOR_UUID = '660e8400-e29b-41d4-a716-446655440001';
const EXAMPLE_CONVERSATION_UUID = '770e8400-e29b-41d4-a716-446655440002';

// Example timestamps
const EXAMPLE_TIMESTAMP = '2024-01-15T10:30:00Z';

/**
 * DTO for Query Assistant Request
 *
 * Represents the input for querying the RAG assistant.
 * Note: userId is extracted from the JWT session via @CurrentUser('userId')
 * and is NOT part of the request body.
 *
 * Validation:
 * - sectorId: Required UUID
 * - query: Required, non-empty string
 * - conversationId: Optional UUID
 * - maxResults: Optional, 1-20
 * - minSimilarity: Optional, 0-1
 */
export class QueryAssistantDto {
  // userId is extracted from the JWT session via @CurrentUser('userId')
  // and is NOT accepted from the request body for security reasons

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
 * DTO for a single evaluation score
 */
export class EvaluationScoreDto {
  @ApiProperty({
    description: 'Evaluation score from 0.0 to 1.0',
    example: 0.85,
    minimum: 0,
    maximum: 1,
  })
  score!: number;

  @ApiProperty({
    description: 'Evaluation status',
    example: 'PASS',
    enum: ['PASS', 'FAIL', 'UNKNOWN'],
  })
  status!: string;

  @ApiProperty({
    description: 'Brief reasoning for the score',
    example:
      'The response accurately reflects the vacation policy documented in the context.',
  })
  reasoning!: string;
}

/**
 * DTO for RAG evaluation results
 *
 * Contains Faithfulness and Relevancy scores for each RAG response.
 * - Faithfulness: Is the response grounded in the retrieved context?
 * - Relevancy: Is the response relevant to the user question?
 */
export class EvaluationResultDto {
  @ApiProperty({
    description:
      'Faithfulness score — measures if the response is grounded in the context',
    type: EvaluationScoreDto,
  })
  faithfulness!: EvaluationScoreDto;

  @ApiProperty({
    description:
      'Relevancy score — measures if the response addresses the question',
    type: EvaluationScoreDto,
  })
  relevancy!: EvaluationScoreDto;
}

/**
 * Section types for structured responses
 */
export type SectionType = 'info' | 'steps' | 'warning' | 'tip';

/**
 * Response types to distinguish between normal responses and fallbacks
 */
export enum RagResponseType {
  /** Response with documentary context */
  ANSWER = 'answer',
  /** No relevant documents found */
  NO_CONTEXT = 'no_context',
  /** Error during processing */
  ERROR = 'error',
}

/**
 * DTO for a single section in a structured response
 */
export class ResponseSectionDto {
  @ApiProperty({ description: 'Section title', example: 'Vacation Policy' })
  title!: string;

  @ApiProperty({
    description: 'Section content (supports markdown)',
    example:
      'You must submit a request through the HR portal at least **15 days** in advance.',
  })
  content!: string;

  @ApiProperty({
    description: 'Section type',
    enum: ['info', 'steps', 'warning', 'tip'],
    example: 'info',
  })
  type!: SectionType;
}

/**
 * DTO for the structured part of the response
 */
export class StructuredResponseDto {
  @ApiProperty({
    description: 'Brief 1-2 sentence answer',
    example:
      'To request vacation, submit a request through the HR portal at least 15 days in advance.',
  })
  summary!: string;

  @ApiProperty({
    description: 'Detailed information organized into sections',
    type: [ResponseSectionDto],
    isArray: true,
  })
  sections!: ResponseSectionDto[];

  @ApiProperty({
    description: 'Key takeaways as bullet points',
    type: [String],
    required: false,
    example: ['Submit 15 days in advance', 'Include desired dates'],
  })
  keyPoints?: string[];

  @ApiProperty({
    description: 'Related topics the user might want to explore',
    type: [String],
    required: false,
    example: ['Sick leave policy', 'Remote work guidelines'],
  })
  relatedTopics?: string[];
}

/**
 * DTO for Query Assistant Response
 *
 * Represents the output from the RAG assistant.
 * v1.3: Added responseType and structured fields.
 */
export class QueryAssistantResponseDto {
  @ApiProperty({
    description:
      'Assistant response to the query (plain text, backward compatible)',
    example:
      'To request vacation, you need to submit a request through the HR portal at least 15 days in advance. The request should include your desired dates and a brief reason.',
  })
  response!: string;

  @ApiProperty({
    description:
      'Type of response: "answer" (with context), "no_context" (no docs found), "error"',
    enum: RagResponseType,
    example: RagResponseType.ANSWER,
  })
  responseType!: RagResponseType;

  @ApiProperty({
    description:
      'Structured response with sections, key points, and related topics. Present only when responseType is "answer" and structured output succeeded.',
    type: StructuredResponseDto,
    required: false,
  })
  structured?: StructuredResponseDto;

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

  @ApiProperty({
    description:
      'RAG evaluation scores (faithfulness and relevancy). May be absent if evaluation was skipped or failed.',
    type: EvaluationResultDto,
    required: false,
  })
  evaluation?: EvaluationResultDto;
}
