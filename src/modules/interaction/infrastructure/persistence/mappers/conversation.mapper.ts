import {
  Conversation,
  ConversationProps,
} from '@modules/interaction/domain/entities/conversation.entity';
import { ConversationModel } from '../models/conversation.model';
import { MessageMapper } from './message.mapper';

/**
 * Conversation Mapper
 *
 * Converts between domain Conversation entities and TypeORM ConversationModels.
 * Follows Clean Architecture principles (Dependency Inversion).
 *
 * Responsibilities:
 * - Map TypeORM model to domain entity
 * - Map domain entity to TypeORM model
 * - Handle nested Message entities/models
 * - Preserve domain logic encapsulation
 */
export class ConversationMapper {
  /**
   * Converts TypeORM model to domain entity
   * @param model - The TypeORM model
   * @returns Domain entity
   */
  static toDomain(model: ConversationModel): Conversation {
    // Map messages if they are loaded
    const messages = model.messages
      ? MessageMapper.toDomainList(model.messages)
      : [];

    const conversationProps: ConversationProps = {
      id: model.id,
      userId: model.userId,
      sectorId: model.sectorId,
      messages,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };

    return new Conversation(conversationProps);
  }

  /**
   * Converts domain entity to TypeORM model
   * @param entity - The domain entity
   * @returns TypeORM model
   */
  static toModel(entity: Conversation): ConversationModel {
    const model = new ConversationModel();

    // Set ID only if it exists (for updates)
    if (entity.id) {
      model.id = entity.id;
    }

    model.userId = entity.userId;
    model.sectorId = entity.sectorId;
    model.createdAt = entity.createdAt;
    model.updatedAt = entity.updatedAt;

    // Map messages
    model.messages = MessageMapper.toModelList(entity.messages);

    return model;
  }

  /**
   * Converts array of models to array of domain entities
   * @param models - Array of TypeORM models
   * @returns Array of domain entities
   */
  static toDomainList(models: ConversationModel[]): Conversation[] {
    return models.map((model) => ConversationMapper.toDomain(model));
  }

  /**
   * Converts array of entities to array of models
   * @param entities - Array of domain entities
   * @returns Array of TypeORM models
   */
  static toModelList(entities: Conversation[]): ConversationModel[] {
    return entities.map((entity) => ConversationMapper.toModel(entity));
  }
}
