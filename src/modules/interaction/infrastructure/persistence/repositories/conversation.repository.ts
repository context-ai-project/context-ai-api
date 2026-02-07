import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, LessThan } from 'typeorm';
import type { IConversationRepository } from '../../../domain/repositories/conversation.repository.interface';
import { Conversation } from '../../../domain/entities/conversation.entity';
import { Message } from '../../../domain/entities/message.entity';
import { ConversationModel } from '../models/conversation.model';
import { MessageModel } from '../models/message.model';
import { ConversationMapper } from '../mappers/conversation.mapper';
import { MessageMapper } from '../mappers/message.mapper';

// Constants for pagination and active conversation detection
const DEFAULT_PAGE_LIMIT = 50;
const DEFAULT_ACTIVITY_THRESHOLD_HOURS = 24;
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_HOUR =
  MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR;

/**
 * TypeORM Conversation Repository Implementation
 *
 * Implements the IConversationRepository interface using TypeORM.
 * Manages persistence for Conversation and Message entities.
 *
 * Features:
 * - PostgreSQL with TypeORM
 * - Transaction support
 * - Soft delete support for conversations
 * - Cascade delete for messages
 * - Activity tracking (active conversations)
 * - Efficient queries with joins and indexes
 *
 * Security:
 * - Input validation in domain layer
 * - Parameterized queries (SQL injection prevention)
 * - Transaction isolation
 *
 * Performance:
 * - Indexed queries (user_id, sector_id, created_at)
 * - Selective field loading
 * - Pagination support
 */
@Injectable()
export class ConversationRepository implements IConversationRepository {
  constructor(
    @InjectRepository(ConversationModel)
    private readonly conversationRepository: Repository<ConversationModel>,
    @InjectRepository(MessageModel)
    private readonly messageRepository: Repository<MessageModel>,
    private readonly dataSource: DataSource,
  ) {}

  // ==================== Conversation Operations ====================

  /**
   * Save a conversation (create or update)
   */
  async save(conversation: Conversation): Promise<Conversation> {
    const model = ConversationMapper.toModel(conversation);
    const saved = await this.conversationRepository.save(model, {
      reload: true,
    });
    return ConversationMapper.toDomain(saved);
  }

  /**
   * Find a conversation by ID
   */
  async findById(id: string): Promise<Conversation | undefined> {
    const model = await this.conversationRepository.findOne({
      where: { id },
      relations: ['messages'],
      order: {
        messages: {
          createdAt: 'ASC',
        },
      },
    });

    return model ? ConversationMapper.toDomain(model) : undefined;
  }

  /**
   * Find all conversations for a user
   */
  async findByUserId(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      includeInactive?: boolean;
    },
  ): Promise<Conversation[]> {
    const query = this.conversationRepository
      .createQueryBuilder('conversation')
      .where('conversation.user_id = :userId', { userId })
      .orderBy('conversation.updated_at', 'DESC')
      .limit(options?.limit ?? DEFAULT_PAGE_LIMIT)
      .offset(options?.offset ?? 0);

    // Filter out soft deleted conversations unless explicitly included
    if (!options?.includeInactive) {
      query.andWhere('conversation.deleted_at IS NULL');
    }

    const models = await query.getMany();
    return ConversationMapper.toDomainList(models);
  }

  /**
   * Find all conversations for a sector
   */
  async findBySectorId(
    sectorId: string,
    options?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<Conversation[]> {
    const models = await this.conversationRepository.find({
      where: {
        sectorId,
        deletedAt: IsNull(),
      },
      order: {
        updatedAt: 'DESC',
      },
      take: options?.limit ?? DEFAULT_PAGE_LIMIT,
      skip: options?.offset ?? 0,
    });

    return ConversationMapper.toDomainList(models);
  }

  /**
   * Find a conversation by user and sector
   * Returns the most recent active conversation
   */
  async findByUserAndSector(
    userId: string,
    sectorId: string,
  ): Promise<Conversation | undefined> {
    const model = await this.conversationRepository.findOne({
      where: {
        userId,
        sectorId,
        deletedAt: IsNull(),
      },
      relations: ['messages'],
      order: {
        updatedAt: 'DESC',
        messages: {
          createdAt: 'ASC',
        },
      },
    });

    return model ? ConversationMapper.toDomain(model) : undefined;
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(
    conversationId: string,
    message: Message,
  ): Promise<Conversation> {
    // Verify conversation exists
    const conversation = await this.findById(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    // Save message
    const messageModel = MessageMapper.toModel(message);
    await this.messageRepository.save(messageModel);

    // Update conversation updated_at timestamp
    await this.conversationRepository.update(conversationId, {
      updatedAt: new Date(),
    });

    // Return updated conversation
    return this.findById(conversationId) as Promise<Conversation>;
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(
    conversationId: string,
    options?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<Message[]> {
    const models = await this.messageRepository.find({
      where: {
        conversationId,
      },
      order: {
        createdAt: 'ASC',
      },
      take: options?.limit,
      skip: options?.offset ?? 0,
    });

    return MessageMapper.toDomainList(models);
  }

  /**
   * Delete a conversation (soft delete)
   */
  async delete(id: string): Promise<void> {
    await this.conversationRepository.softDelete(id);
  }

  /**
   * Count conversations for a user
   */
  async countByUserId(userId: string): Promise<number> {
    return this.conversationRepository.count({
      where: {
        userId,
        deletedAt: IsNull(),
      },
    });
  }

  /**
   * Find active conversations (with recent messages)
   */
  async findActiveConversations(
    userId: string,
    hoursThreshold?: number,
  ): Promise<Conversation[]> {
    const threshold = hoursThreshold ?? DEFAULT_ACTIVITY_THRESHOLD_HOURS;
    const cutoffDate = new Date(Date.now() - threshold * MILLISECONDS_PER_HOUR);

    const models = await this.conversationRepository.find({
      where: {
        userId,
        deletedAt: IsNull(),
        updatedAt: LessThan(cutoffDate) as unknown as Date,
      },
      relations: ['messages'],
      order: {
        updatedAt: 'DESC',
        messages: {
          createdAt: 'ASC',
        },
      },
    });

    return ConversationMapper.toDomainList(models);
  }

  /**
   * Execute operations in a transaction
   */
  async transaction<T>(
    operation: (repository: IConversationRepository) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create a transactional repository instance
      const transactionalRepo = new ConversationRepository(
        queryRunner.manager.getRepository(ConversationModel),
        queryRunner.manager.getRepository(MessageModel),
        this.dataSource,
      );

      const result = await operation(transactionalRepo);

      await queryRunner.commitTransaction();
      return result;
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
