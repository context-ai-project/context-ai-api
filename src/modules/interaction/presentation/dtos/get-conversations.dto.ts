import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsBoolean, IsOptional, Min, Max } from 'class-validator';

// Constants for validation
const MIN_PAGE_LIMIT = 1;
const MAX_PAGE_LIMIT = 100;
const DEFAULT_PAGE_LIMIT = 10;

/**
 * DTO for Get Conversations Request (Query Parameters)
 *
 * Used to list conversations for a user with pagination.
 * Note: userId is extracted from the JWT session via @CurrentUser('userId')
 * and is NOT part of the query parameters.
 */
export class GetConversationsDto {
  // userId is extracted from the JWT session via @CurrentUser('userId')
  // and is NOT accepted from query parameters for security reasons

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
