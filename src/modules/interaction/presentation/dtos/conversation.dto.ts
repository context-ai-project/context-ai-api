import { ApiProperty } from '@nestjs/swagger';
import { MessageDto } from './message.dto';

// Example UUIDs for documentation
const EXAMPLE_USER_UUID = '550e8400-e29b-41d4-a716-446655440000';
const EXAMPLE_SECTOR_UUID = '660e8400-e29b-41d4-a716-446655440001';
const EXAMPLE_CONVERSATION_UUID = '770e8400-e29b-41d4-a716-446655440002';

// Example timestamps
const EXAMPLE_TIMESTAMP = '2024-01-15T10:30:00Z';

// Descriptions
const DESC_USER_ID = 'User ID';
const DESC_SECTOR_ID = 'Sector ID';
const DESC_CONVERSATION_ID = 'Conversation ID';
const DESC_IS_ACTIVE = 'Conversation is active';

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
}
