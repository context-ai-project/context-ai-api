import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ConversationModel } from './conversation.model';

/**
 * TypeORM Model for Message
 *
 * Maps the domain Message entity to database table.
 * Uses snake_case for column names (PostgreSQL convention).
 *
 * Features:
 * - UUID primary key
 * - Enum for role (user, assistant, system)
 * - JSONB for metadata (sources, etc.)
 * - Indexes for query performance
 * - Many-to-one relationship with conversation
 *
 * Relations:
 * - conversation: Many messages belong to one conversation
 *
 * Security:
 * - Content validated at entity layer
 * - Metadata is JSONB for flexibility
 */
@Entity('messages')
@Index(['conversationId'])
@Index(['role'])
@Index(['createdAt'])
export class MessageModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @ManyToOne(() => ConversationModel, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: ConversationModel;

  @Column({
    type: 'enum',
    enum: ['user', 'assistant', 'system'],
  })
  role!: 'user' | 'assistant' | 'system';

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null = null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date = new Date();
}
