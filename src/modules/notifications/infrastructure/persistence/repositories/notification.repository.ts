import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationModel } from '../models/notification.model';

/** Default limit for notification queries */
const DEFAULT_NOTIFICATION_LIMIT = 20;

/**
 * Notification Repository
 *
 * Handles persistence operations for Notification entities.
 */
@Injectable()
export class NotificationRepository {
  constructor(
    @InjectRepository(NotificationModel)
    private readonly repository: Repository<NotificationModel>,
  ) {}

  /**
   * Find notifications for a user, ordered by most recent
   */
  async findByUserId(
    userId: string,
    limit: number = DEFAULT_NOTIFICATION_LIMIT,
  ): Promise<NotificationModel[]> {
    return this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Count unread notifications for a user
   */
  async countUnread(userId: string): Promise<number> {
    return this.repository.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(id: string, userId: string): Promise<void> {
    await this.repository.update({ id, userId }, { isRead: true });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.repository.update({ userId, isRead: false }, { isRead: true });
  }

  /**
   * Create a new notification
   */
  async create(
    notification: Partial<NotificationModel>,
  ): Promise<NotificationModel> {
    const model = this.repository.create(notification);
    return this.repository.save(model);
  }
}
