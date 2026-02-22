import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@shared/types';

/**
 * DTO for notification response
 */
export class NotificationResponseDto {
  @ApiProperty({ description: 'Notification ID' })
  id!: string;

  @ApiProperty({
    description: 'Notification type',
    enum: NotificationType,
  })
  type!: NotificationType;

  @ApiProperty({ description: 'Notification title' })
  title!: string;

  @ApiProperty({ description: 'Notification message' })
  message!: string;

  @ApiProperty({ description: 'Whether the notification has been read' })
  isRead!: boolean;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: Record<string, unknown> | null;

  @ApiProperty({ description: 'Created date' })
  createdAt!: Date;
}

/**
 * DTO for unread count response
 */
export class UnreadCountResponseDto {
  @ApiProperty({
    description: 'Number of unread notifications',
    example: 3,
  })
  count!: number;
}
