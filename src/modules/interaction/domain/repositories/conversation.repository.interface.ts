/**
 * Conversation Repository Interface
 *
 * Defines the contract for persistence operations on conversations.
 * This is a Domain layer interface - implementations live in Infrastructure layer.
 */

import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';

export interface IConversationRepository {
  /**
   * Save a conversation (create or update)
   * @param conversation - The conversation to save
   * @returns The saved conversation with updated timestamps
   */
  save(conversation: Conversation): Promise<Conversation>;

  /**
   * Find a conversation by ID
   * @param id - The conversation ID
   * @returns The conversation if found, undefined otherwise
   */
  findById(id: string): Promise<Conversation | undefined>;

  /**
   * Find all conversations for a user
   * @param userId - The user ID
   * @param options - Optional pagination and filtering
   * @returns Array of conversations
   */
  findByUserId(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      includeInactive?: boolean;
    },
  ): Promise<Conversation[]>;

  /**
   * Find all conversations for a sector
   * @param sectorId - The sector ID
   * @param options - Optional pagination and filtering
   * @returns Array of conversations
   */
  findBySectorId(
    sectorId: string,
    options?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<Conversation[]>;

  /**
   * Find a conversation by user and sector
   * Useful for getting or creating a conversation for a specific context
   * @param userId - The user ID
   * @param sectorId - The sector ID
   * @returns The most recent active conversation if found, undefined otherwise
   */
  findByUserAndSector(
    userId: string,
    sectorId: string,
  ): Promise<Conversation | undefined>;

  /**
   * Add a message to a conversation
   * @param conversationId - The conversation ID
   * @param message - The message to add
   * @returns The updated conversation
   */
  addMessage(conversationId: string, message: Message): Promise<Conversation>;

  /**
   * Get messages for a conversation
   * @param conversationId - The conversation ID
   * @param options - Optional pagination
   * @returns Array of messages
   */
  getMessages(
    conversationId: string,
    options?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<Message[]>;

  /**
   * Delete a conversation (soft delete)
   * @param id - The conversation ID
   */
  delete(id: string): Promise<void>;

  /**
   * Count conversations for a user
   * @param userId - The user ID
   * @returns The number of conversations
   */
  countByUserId(userId: string): Promise<number>;

  /**
   * Count all non-deleted conversations across all users
   * Used by admin dashboard for global stats
   * @returns The total number of active conversations
   */
  countAll(): Promise<number>;

  /**
   * Find active conversations (with recent messages)
   * @param userId - The user ID
   * @param hoursThreshold - Hours since last message to consider active
   * @returns Array of active conversations
   */
  findActiveConversations(
    userId: string,
    hoursThreshold?: number,
  ): Promise<Conversation[]>;

  /**
   * Execute operations in a transaction
   * @param operation - The operations to execute within the transaction
   * @returns The result of the operations
   */
  transaction<T>(
    operation: (repository: IConversationRepository) => Promise<T>,
  ): Promise<T>;
}
