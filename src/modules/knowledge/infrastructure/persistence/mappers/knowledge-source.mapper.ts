import {
  KnowledgeSource,
  SourceMetadata,
} from '@modules/knowledge/domain/entities/knowledge-source.entity';
import { KnowledgeSourceModel } from '@modules/knowledge/infrastructure/persistence/models/knowledge-source.model';
import { SourceStatus } from '@context-ai/shared';

/**
 * Knowledge Source Mapper
 *
 * Converts between domain entities and TypeORM models.
 * Follows Clean Architecture principles (Dependency Inversion).
 *
 * Responsibilities:
 * - Map TypeORM model to domain entity
 * - Map domain entity to TypeORM model
 * - Handle type conversions
 * - Preserve domain logic encapsulation
 */
export class KnowledgeSourceMapper {
  /**
   * Converts TypeORM model to domain entity
   * @param model - The TypeORM model
   * @returns Domain entity
   */
  static toDomain(model: KnowledgeSourceModel): KnowledgeSource {
    const source = new KnowledgeSource({
      title: model.title,
      sectorId: model.sectorId,
      sourceType: model.sourceType,
      content: model.content,
      metadata: model.metadata as SourceMetadata | undefined,
    });

    // Set persisted fields using Reflect to avoid type errors
    Reflect.set(source, 'id', model.id);
    Reflect.set(source, 'status', model.status);
    Reflect.set(source, 'createdAt', model.createdAt);
    Reflect.set(source, 'updatedAt', model.updatedAt);
    Reflect.set(source, 'deletedAt', model.deletedAt ?? undefined);

    return source;
  }

  /**
   * Converts domain entity to TypeORM model
   * @param entity - The domain entity
   * @returns TypeORM model
   */
  static toModel(entity: KnowledgeSource): KnowledgeSourceModel {
    const model = new KnowledgeSourceModel();

    model.id = entity.id ?? '';
    model.title = entity.title;
    model.sectorId = entity.sectorId;
    model.sourceType = entity.sourceType;
    model.content = entity.content;
    model.status = entity.status as SourceStatus;
    model.metadata = (entity.metadata as Record<string, unknown>) ?? null;
    model.createdAt = entity.createdAt;
    model.updatedAt = entity.updatedAt;
    model.deletedAt = entity.deletedAt ?? null;

    return model;
  }

  /**
   * Converts array of TypeORM models to domain entities
   * @param models - Array of TypeORM models
   * @returns Array of domain entities
   */
  static toDomainArray(models: KnowledgeSourceModel[]): KnowledgeSource[] {
    return models.map((model) => this.toDomain(model));
  }
}
