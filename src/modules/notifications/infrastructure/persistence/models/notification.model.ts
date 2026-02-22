import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { NotificationType } from '@shared/types';
import { UserModel } from '../../../../users/infrastructure/persistence/models/user.model';

// Column type constants
const VARCHAR_TYPE = 'varchar';
const TIMESTAMP_TZ = 'timestamp with time zone';
const STRING_255 = 255;
const STRING_50 = 50;

/**
 * TypeORM Model for Notification
 *
 * Maps to the `notifications` database table.
 * Designed as a generic notification system reusable in v2.
 *
 * Relationships:
 * - ManyToOne with UserModel (user_id)
 */
@Entity('notifications')
@Index(['userId', 'isRead'])
@Index(['userId', 'createdAt'])
export class NotificationModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserModel)
  @JoinColumn({ name: 'user_id' })
  user!: UserModel;

  @Column({ type: VARCHAR_TYPE, length: STRING_50 })
  type!: NotificationType;

  @Column({ type: VARCHAR_TYPE, length: STRING_255 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: TIMESTAMP_TZ })
  createdAt!: Date;
}
