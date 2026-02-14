import {
  Message,
  MessageProps,
} from '@modules/interaction/domain/entities/message.entity';
import { MessageModel } from '../models/message.model';
import {
  MessageRole,
  isValidMessageRole,
} from '@modules/interaction/domain/value-objects/message-role.vo';

/**
 * Message Mapper
 *
 * Converts between domain Message entities and TypeORM MessageModels.
 * Follows Clean Architecture principles (Dependency Inversion).
 *
 * Responsibilities:
 * - Map TypeORM model to domain entity
 * - Map domain entity to TypeORM model
 * - Handle type conversions
 * - Preserve domain logic encapsulation
 */
export class MessageMapper {
  /**
   * Converts TypeORM model to domain entity
   * @param model - The TypeORM model
   * @returns Domain entity
   */
  static toDomain(model: MessageModel): Message {
    // Widen to string for runtime validation — DB could have corrupt data
    const rawRole: string = String(model.role);
    if (!isValidMessageRole(rawRole)) {
      throw new Error(
        `Invalid message role in database: "${rawRole}". Expected: user, assistant, or system`,
      );
    }
    const role: MessageRole = rawRole;
    const metadata: Record<string, unknown> | undefined = model.metadata
      ? model.metadata
      : undefined;

    const messageProps: MessageProps = {
      id: model.id,
      conversationId: model.conversationId,
      role,
      content: model.content,
      metadata,
      createdAt: model.createdAt,
    };

    return new Message(messageProps);
  }

  /**
   * Converts domain entity to TypeORM model
   * @param entity - The domain entity
   * @returns TypeORM model
   */
  static toModel(entity: Message): MessageModel {
    const model = new MessageModel();

    // Set ID only if it exists (for updates)
    if (entity.id) {
      model.id = entity.id;
    }

    model.conversationId = entity.conversationId;
    model.role = entity.role;
    model.content = entity.content;
    model.metadata = entity.metadata ?? null;
    model.createdAt = entity.createdAt;

    return model;
  }

  /**
   * Converts array of models to array of domain entities
   * @param models - Array of TypeORM models
   * @returns Array of domain entities
   */
  static toDomainList(models: MessageModel[]): Message[] {
    return models.map((model) => MessageMapper.toDomain(model));
  }

  /**
   * Converts array of entities to array of models
   * @param entities - Array of domain entities
   * @returns Array of TypeORM models
   */
  static toModelList(entities: Message[]): MessageModel[] {
    return entities.map((entity) => MessageMapper.toModel(entity));
  }
}
