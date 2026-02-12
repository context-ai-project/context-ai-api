import {
  Fragment,
  FragmentMetadata,
} from '@modules/knowledge/domain/entities/fragment.entity';
import { FragmentModel } from '@modules/knowledge/infrastructure/persistence/models/fragment.model';

// Token estimation constant (words per token ratio)
const WORDS_PER_TOKEN_RATIO = 0.75;

/**
 * Fragment Mapper
 *
 * Converts between domain entities and TypeORM models.
 *
 * Responsibilities:
 * - Map TypeORM model to domain entity
 * - Map domain entity to TypeORM model
 * - Preserve domain logic encapsulation
 *
 * Note: Vector embeddings are managed externally by IVectorStore (Pinecone).
 * The mapper no longer handles embedding serialization/deserialization.
 */
export class FragmentMapper {
  /**
   * Converts TypeORM model to domain entity
   * @param model - The TypeORM model
   * @returns Domain entity
   */
  static toDomain(model: FragmentModel): Fragment {
    const fragment = new Fragment({
      sourceId: model.sourceId,
      content: model.content,
      position: model.position,
      tokenCount: model.tokenCount,
      metadata: model.metadata as FragmentMetadata | undefined,
    });

    // Set persisted fields using Reflect to avoid type errors
    Reflect.set(fragment, 'id', model.id);
    Reflect.set(fragment, 'createdAt', model.createdAt);
    Reflect.set(fragment, 'updatedAt', model.updatedAt);

    return fragment;
  }

  /**
   * Converts domain entity to TypeORM model
   * @param entity - The domain entity
   * @returns TypeORM model
   */
  static toModel(entity: Fragment): FragmentModel {
    const model = new FragmentModel();

    // Only set id if it exists (for updates), let TypeORM generate it for new entities
    if (entity.id) {
      model.id = entity.id;
    }
    model.sourceId = entity.sourceId;
    model.content = entity.content;
    model.position = entity.position;

    // Use entity tokenCount, or calculate if not set
    model.tokenCount =
      entity.tokenCount ??
      Math.ceil(entity.content.split(/\s+/).length / WORDS_PER_TOKEN_RATIO);

    model.metadata = (entity.metadata as Record<string, unknown>) ?? null;
    model.createdAt = entity.createdAt;
    model.updatedAt = Reflect.get(entity, 'updatedAt') as Date;

    return model;
  }

  /**
   * Converts array of TypeORM models to domain entities
   * @param models - Array of TypeORM models
   * @returns Array of domain entities
   */
  static toDomainArray(models: FragmentModel[]): Fragment[] {
    return models.map((model) => this.toDomain(model));
  }
}
