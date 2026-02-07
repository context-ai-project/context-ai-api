import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { MessageModel } from './message.model';

/**
 * TypeORM Model for Conversation
 *
 * Maps the domain Conversation entity to database table.
 * Uses snake_case for column names (PostgreSQL convention).
 *
 * Features:
 * - UUID primary key
 * - Soft delete support (deletedAt)
 * - Indexes for query performance
 * - One-to-many relationship with messages
 *
 * Relations:
 * - messages: One conversation has many messages
 */
@Entity('conversations')
@Index(['userId', 'sectorId'])
@Index(['userId'])
@Index(['sectorId'])
@Index(['createdAt'])
export class ConversationModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId!: string;

  @Column({ name: 'sector_id', type: 'uuid' })
  @Index()
  sectorId!: string;

  @OneToMany(() => MessageModel, (message) => message.conversation, {
    cascade: true,
  })
  messages!: MessageModel[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date = new Date();

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date = new Date();

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null = null;
}
