/**
 * Conversation Entity (Aggregate Root)
 *
 * Represents a conversation between a user and the assistant.
 * Manages messages and conversation lifecycle.
 */

import { randomUUID } from 'crypto';
import { Message } from './message.entity';

// Constants
const DEFAULT_ACTIVITY_THRESHOLD_HOURS = 24;
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

export interface ConversationProps {
  id?: string;
  userId: string;
  sectorId: string;
  messages?: Message[];
  createdAt?: Date;
  updatedAt?: Date;
}

export class Conversation {
  private readonly _id: string;
  private readonly _userId: string;
  private readonly _sectorId: string;
  private readonly _messages: Message[];
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: ConversationProps) {
    this.validateProps(props);

    this._id = props.id ?? randomUUID();
    this._userId = props.userId;
    this._sectorId = props.sectorId;
    this._messages = props.messages ?? [];
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
  }

  /**
   * Validate conversation properties
   */
  private validateProps(props: ConversationProps): void {
    if (!props.userId || props.userId.trim() === '') {
      throw new Error('User ID is required');
    }

    if (!props.sectorId || props.sectorId.trim() === '') {
      throw new Error('Sector ID is required');
    }
  }

  /**
   * Getters
   */
  get id(): string {
    return this._id;
  }

  get userId(): string {
    return this._userId;
  }

  get sectorId(): string {
    return this._sectorId;
  }

  get messages(): Message[] {
    // Return a copy to prevent external modification
    return [...this._messages];
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Add a message to the conversation
   */
  public addMessage(message: Message): void {
    // Verify message belongs to this conversation
    if (message.conversationId !== this._id) {
      throw new Error('Message does not belong to this conversation');
    }

    this._messages.push(message);
    this._updatedAt = new Date();
  }

  /**
   * Get message count
   */
  public getMessageCount(): number {
    return this._messages.length;
  }

  /**
   * Check if conversation has messages
   */
  public hasMessages(): boolean {
    return this._messages.length > 0;
  }

  /**
   * Get conversation context for RAG prompt
   * Returns formatted message history
   *
   * @param maxMessages - Maximum number of recent messages to include
   */
  public getContextForPrompt(maxMessages?: number): string {
    const messagesToInclude = maxMessages
      ? this._messages.slice(-maxMessages)
      : this._messages;

    return messagesToInclude.map((msg) => msg.formatForPrompt()).join('\n');
  }

  /**
   * Get last N messages
   */
  public getLastMessages(count: number): Message[] {
    return this._messages.slice(-count);
  }

  /**
   * Get last user message
   */
  public getLastUserMessage(): Message | undefined {
    for (let i = this._messages.length - 1; i >= 0; i--) {
      // Safe: iterating over known array
      // eslint-disable-next-line security/detect-object-injection
      if (this._messages[i].isFromUser()) {
        // eslint-disable-next-line security/detect-object-injection
        return this._messages[i];
      }
    }
    return undefined;
  }

  /**
   * Get last assistant message
   */
  public getLastAssistantMessage(): Message | undefined {
    for (let i = this._messages.length - 1; i >= 0; i--) {
      // Safe: iterating over known array
      // eslint-disable-next-line security/detect-object-injection
      if (this._messages[i].isFromAssistant()) {
        // eslint-disable-next-line security/detect-object-injection
        return this._messages[i];
      }
    }
    return undefined;
  }

  /**
   * Validate conversation state
   */
  public isValid(): boolean {
    return (
      this._userId.trim() !== '' &&
      this._sectorId.trim() !== '' &&
      this._messages.every((msg) => msg.isValid())
    );
  }

  /**
   * Check equality with another conversation
   */
  public equals(other: Conversation): boolean {
    return this._id === other.id;
  }

  /**
   * Check if conversation is active (has recent messages)
   */
  public isActive(
    hoursThreshold: number = DEFAULT_ACTIVITY_THRESHOLD_HOURS,
  ): boolean {
    if (this._messages.length === 0) {
      return false;
    }

    const lastMessage = this._messages[this._messages.length - 1];
    const millisecondsPerHour =
      MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
    const hoursSinceLastMessage =
      (Date.now() - lastMessage.createdAt.getTime()) / millisecondsPerHour;

    return hoursSinceLastMessage < hoursThreshold;
  }

  /**
   * Get conversation duration in milliseconds
   */
  public getDuration(): number {
    if (this._messages.length === 0) {
      return 0;
    }

    const firstMessage = this._messages[0];
    const lastMessage = this._messages[this._messages.length - 1];

    return lastMessage.createdAt.getTime() - firstMessage.createdAt.getTime();
  }

  /**
   * Count messages by role
   */
  public countMessagesByRole(role: 'user' | 'assistant' | 'system'): number {
    return this._messages.filter((msg) => msg.role === role).length;
  }

  /**
   * Convert to plain object
   */
  public toObject(): {
    id: string;
    userId: string;
    sectorId: string;
    messages: ReturnType<Message['toObject']>[];
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this._id,
      userId: this._userId,
      sectorId: this._sectorId,
      messages: this._messages.map((msg) => msg.toObject()),
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
