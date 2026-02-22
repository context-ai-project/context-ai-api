import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Presentation
import { NotificationController } from './presentation/notification.controller';

// Application
import { NotificationService } from './application/notification.service';
import { NotificationListener } from './application/listeners/notification.listener';

// Infrastructure
import { NotificationModel } from './infrastructure/persistence/models/notification.model';
import { NotificationRepository } from './infrastructure/persistence/repositories/notification.repository';

// External Dependencies
import { UsersModule } from '../users/users.module';

/**
 * Notifications Module (v1.3)
 *
 * Provides in-app notification system:
 * - Event listeners create notifications automatically
 * - REST API for user to read/manage notifications
 *
 * Dependencies:
 * - UsersModule: UserRepository (for finding admin users in listeners)
 *
 * Extensibility:
 * - Add new listeners for v2 events (document processing, etc.)
 * - Add new NotificationType entries to the enum
 */
@Module({
  imports: [TypeOrmModule.forFeature([NotificationModel]), UsersModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationRepository,
    NotificationListener,
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
