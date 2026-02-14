/**
 * Message Entity
 *
 * Represents a single message in a conversation.
 * Part of the Conversation aggregate but can be used independently.
 */

import { randomUUID } from 'crypto';
import { MessageRole } from '../value-objects/message-role.vo';

export interface MessageProps {
  id?: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

export class Message {
  private readonly _id: string;
  private readonly _conversationId: string;
  private readonly _role: MessageRole;
  private readonly _content: string;
  private readonly _metadata?: Record<string, unknown>;
  private readonly _createdAt: Date;

  constructor(props: MessageProps) {
    this.validateProps(props);

    this._id = props.id ?? randomUUID();
    this._conversationId = props.conversationId;
    this._role = props.role;
    this._content = props.content.trim();
    this._metadata = props.metadata;
    this._createdAt = props.createdAt ?? new Date();
  }

  /**
   * Validate message properties
   */
  private validateProps(props: MessageProps): void {
    if (!props.conversationId || props.conversationId.trim() === '') {
      throw new Error('Conversation ID is required');
    }

    if (!props.content || props.content.trim() === '') {
      throw new Error('Message content is required');
    }

    if (!props.role) {
      throw new Error('Message role is required');
    }
  }

  /**
   * Getters
   */
  get id(): string {
    return this._id;
  }

  get conversationId(): string {
    return this._conversationId;
  }

  get role(): MessageRole {
    return this._role;
  }

  get content(): string {
    return this._content;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this._metadata;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  /**
   * Check if message is from user
   */
  public isFromUser(): boolean {
    return this._role === 'user';
  }

  /**
   * Check if message is from assistant
   */
  public isFromAssistant(): boolean {
    return this._role === 'assistant';
  }

  /**
   * Check if message is a system message
   */
  public isSystemMessage(): boolean {
    return this._role === 'system';
  }

  /**
   * Get content length
   * @planned Phase 6 — Analytics dashboard: message metrics
   */
  public getContentLength(): number {
    return this._content.length;
  }

  /**
   * Get metadata value by key
   */
  public getMetadata(key: string): unknown {
    if (!this._metadata) {
      return undefined;
    }
    const metadataMap = new Map(Object.entries(this._metadata));
    return metadataMap.get(key);
  }

  /**
   * Validate message state
   */
  public isValid(): boolean {
    return this._conversationId.trim() !== '' && this._content.trim() !== '';
  }

  /**
   * Format message for display
   * @planned Phase 6 — Conversation export / admin panel rendering
   */
  public formatForDisplay(): string {
    return `[${this._role}] ${this._content}`;
  }

  /**
   * Format message for prompt context
   */
  public formatForPrompt(): string {
    const roleLabel = this._role.charAt(0).toUpperCase() + this._role.slice(1);
    return `${roleLabel}: ${this._content}`;
  }

  /**
   * Check equality with another message
   */
  public equals(other: Message): boolean {
    return this._id === other.id;
  }

  /**
   * Create a copy with updated metadata
   */
  public withMetadata(metadata: Record<string, unknown>): Message {
    return new Message({
      id: this._id,
      conversationId: this._conversationId,
      role: this._role,
      content: this._content,
      metadata: { ...this._metadata, ...metadata },
      createdAt: this._createdAt,
    });
  }

  /**
   * Convert to plain object
   */
  public toObject(): {
    id: string;
    conversationId: string;
    role: MessageRole;
    content: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
  } {
    return {
      id: this._id,
      conversationId: this._conversationId,
      role: this._role,
      content: this._content,
      metadata: this._metadata,
      createdAt: this._createdAt,
    };
  }
}
