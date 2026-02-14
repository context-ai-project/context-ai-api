import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { MessageRole } from '../../domain/value-objects/message-role.vo';
import { getAllMessageRoles } from '../../domain/value-objects/message-role.vo';

// Example timestamps
const EXAMPLE_TIMESTAMP = '2024-01-15T10:30:00Z';

// Descriptions
const DESC_OPTIONAL_METADATA = 'Optional metadata';

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
    example: 'user',
    enum: getAllMessageRoles(),
  })
  @IsIn(getAllMessageRoles())
  role!: MessageRole;

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
