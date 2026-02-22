import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../notification.service';
import { InvitationCreatedEvent } from '../../../invitations/domain/events/invitation.events';
import { UserActivatedEvent } from '../../../users/domain/events/user.events';
import { NotificationType } from '@shared/types';
import { UserRepository } from '../../../users/infrastructure/persistence/repositories/user.repository';
import { extractErrorMessage } from '@shared/utils';

/** Admin role name for finding admin users */
const ADMIN_ROLE = 'admin';

/**
 * Notification Listener
 *
 * Listens to domain events and creates in-app notifications.
 * Each handler is asynchronous and non-blocking — failures are logged
 * but do not affect the primary operation.
 *
 * v1.3 Events:
 * - invitation.created  → Notify all admins
 * - user.activated      → Notify all admins
 */
@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Handle invitation.created event
   *
   * Creates a notification for all admin users when a new
   * invitation is sent.
   */
  @OnEvent('invitation.created')
  async handleInvitationCreated(event: InvitationCreatedEvent): Promise<void> {
    try {
      const adminUsers = await this.findAdminUsers();

      const notificationPromises = adminUsers.map((admin) =>
        this.notificationService.create({
          userId: admin.id,
          type: NotificationType.INVITATION_CREATED,
          title: 'New Invitation Sent',
          message: `An invitation was sent to ${event.name} (${event.email}) with role "${event.role}".`,
          metadata: {
            invitationId: event.invitationId,
            name: event.name,
            email: event.email,
            role: event.role,
          },
        }),
      );

      await Promise.all(notificationPromises);

      this.logger.log(
        `Notifications created for invitation.created: ${event.invitationId}`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to handle invitation.created event: ${extractErrorMessage(error)}`,
      );
    }
  }

  /**
   * Handle user.activated event
   *
   * Creates a notification for all admin users when a new user
   * activates their account (first login after invitation).
   */
  @OnEvent('user.activated')
  async handleUserActivated(event: UserActivatedEvent): Promise<void> {
    try {
      const adminUsers = await this.findAdminUsers();

      const notificationPromises = adminUsers.map((admin) =>
        this.notificationService.create({
          userId: admin.id,
          type: NotificationType.USER_ACTIVATED,
          title: 'New User Activated',
          message: `${event.name} (${event.email}) has activated their account.`,
          metadata: {
            userId: event.userId,
            name: event.name,
            email: event.email,
          },
        }),
      );

      await Promise.all(notificationPromises);

      this.logger.log(
        `Notifications created for user.activated: ${event.userId}`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to handle user.activated event: ${extractErrorMessage(error)}`,
      );
    }
  }

  // ==================== Private Helpers ====================

  /**
   * Find all users with admin role.
   * Uses a targeted JOIN query — avoids loading all users into memory.
   */
  private async findAdminUsers(): Promise<{ id: string }[]> {
    return this.userRepository.findByRole(ADMIN_ROLE);
  }
}
