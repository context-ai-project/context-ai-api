import { Injectable, Logger } from '@nestjs/common';
import { NotificationRepository } from '../infrastructure/persistence/repositories/notification.repository';
import { NotificationResponseDto } from '../presentation/dtos/notification.dto';
import { NotificationType } from '@shared/types';
import { NotificationModel } from '../infrastructure/persistence/models/notification.model';

/**
 * Notification Service
 *
 * Manages in-app notifications:
 * - Creates notifications (from event listeners)
 * - Lists notifications for a user
 * - Marks notifications as read
 * - Counts unread notifications
 *
 * Designed for extensibility (v2: document events, etc.)
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  /**
   * Create a new notification
   *
   * Called by event listeners, not directly by controllers.
   */
  async create(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<NotificationModel> {
    const notification = await this.notificationRepository.create({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      metadata: params.metadata ?? null,
      isRead: false,
    });

    this.logger.debug(
      `Notification created: ${notification.id} for user ${params.userId}`,
    );

    return notification;
  }

  /**
   * Get notifications for a user
   */
  async getUserNotifications(
    userId: string,
    limit?: number,
  ): Promise<NotificationResponseDto[]> {
    const notifications = await this.notificationRepository.findByUserId(
      userId,
      limit,
    );
    return notifications.map((n) => this.toResponseDto(n));
  }

  /**
   * Count unread notifications for a user
   */
  async countUnread(userId: string): Promise<number> {
    return this.notificationRepository.countUnread(userId);
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(id: string, userId: string): Promise<void> {
    await this.notificationRepository.markAsRead(id, userId);
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.markAllAsRead(userId);
  }

  // ==================== Private Helpers ====================

  private toResponseDto(model: NotificationModel): NotificationResponseDto {
    return {
      id: model.id,
      type: model.type,
      title: model.title,
      message: model.message,
      isRead: model.isRead,
      metadata: model.metadata,
      createdAt: model.createdAt,
    };
  }
}
