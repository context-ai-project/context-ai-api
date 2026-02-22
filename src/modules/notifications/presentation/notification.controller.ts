import {
  Controller,
  Get,
  Patch,
  Param,
  Logger,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { NotificationService } from '../application/notification.service';
import {
  NotificationResponseDto,
  UnreadCountResponseDto,
} from './dtos/notification.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ValidatedUser } from '../../auth/types/jwt-payload.type';
import { isValidUUID } from '@shared/validators';
import { extractErrorMessage, extractErrorStack } from '@shared/utils';

// API description constants
const API_AUTH_DESC = 'Authentication required';
const EXAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000';

/**
 * Notification Controller
 *
 * Endpoints for user notifications:
 * - GET    /notifications           → List my notifications
 * - GET    /notifications/unread-count → Get unread count
 * - PATCH  /notifications/:id/read  → Mark one as read
 * - PATCH  /notifications/read-all  → Mark all as read
 */
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly notificationService: NotificationService) {}

  // ==================== LIST NOTIFICATIONS ====================

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get my notifications',
    description: 'Returns the latest notifications for the current user.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of notifications',
    type: [NotificationResponseDto],
  })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  async listNotifications(
    @CurrentUser() user: ValidatedUser,
  ): Promise<NotificationResponseDto[]> {
    try {
      return await this.notificationService.getUserNotifications(user.userId);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to list notifications: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      throw error;
    }
  }

  // ==================== UNREAD COUNT ====================

  @Get('unread-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get unread notification count',
    description: 'Returns the number of unread notifications.',
  })
  @ApiResponse({
    status: 200,
    description: 'Unread count',
    type: UnreadCountResponseDto,
  })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  async getUnreadCount(
    @CurrentUser() user: ValidatedUser,
  ): Promise<UnreadCountResponseDto> {
    try {
      const count = await this.notificationService.countUnread(user.userId);
      return { count };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to get unread count: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      throw error;
    }
  }

  // ==================== MARK AS READ ====================

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark notification as read',
    description: 'Marks a single notification as read.',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification UUID',
    example: EXAMPLE_UUID,
  })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: ValidatedUser,
  ): Promise<{ success: boolean }> {
    this.validateUUID(id, 'id');

    try {
      await this.notificationService.markAsRead(id, user.userId);
      return { success: true };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to mark notification as read: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      throw error;
    }
  }

  // ==================== MARK ALL AS READ ====================

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Marks all notifications for the current user as read.',
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
  })
  @ApiUnauthorizedResponse({ description: API_AUTH_DESC })
  async markAllAsRead(
    @CurrentUser() user: ValidatedUser,
  ): Promise<{ success: boolean }> {
    try {
      await this.notificationService.markAllAsRead(user.userId);
      return { success: true };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to mark all notifications as read: ${extractErrorMessage(error)}`,
        extractErrorStack(error),
      );
      throw error;
    }
  }

  // ==================== Private Helpers ====================

  private validateUUID(value: string, fieldName: string): void {
    if (!isValidUUID(value)) {
      throw new BadRequestException(`${fieldName} must be a valid UUID`);
    }
  }
}
