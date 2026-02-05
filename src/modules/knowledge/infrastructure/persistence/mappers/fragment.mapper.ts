import {
  Fragment,
  FragmentMetadata,
} from '@modules/knowledge/domain/entities/fragment.entity';
import { FragmentModel } from '@modules/knowledge/infrastructure/persistence/models/fragment.model';

// Default embedding dimension for temporary embeddings
const DEFAULT_EMBEDDING_DIMENSION = 768;

/**
 * Fragment Mapper
 *
 * Converts between domain entities and TypeORM models.
 * Handles pgvector embedding conversions.
 *
 * Responsibilities:
 * - Map TypeORM model to domain entity
 * - Map domain entity to TypeORM model
 * - Convert embeddings between number[] and pgvector string format
 * - Preserve domain logic encapsulation
 *
 * pgvector Format:
 * - Storage: '[0.1, 0.2, 0.3]' (string)
 * - Domain: [0.1, 0.2, 0.3] (number[])
 */
export class FragmentMapper {
  /**
   * Converts TypeORM model to domain entity
   * @param model - The TypeORM model
   * @returns Domain entity
   */
  static toDomain(model: FragmentModel): Fragment {
    // Parse embedding (can be null if not yet processed)
    // Use a temporary valid embedding for construction if null
    const parsedEmbedding = this.parseEmbedding(model.embedding);
    const tempEmbedding =
      parsedEmbedding ?? Array(DEFAULT_EMBEDDING_DIMENSION).fill(0);

    const fragment = new Fragment({
      sourceId: model.sourceId,
      content: model.content,
      position: model.position,
      embedding: tempEmbedding as number[],
      metadata: model.metadata as FragmentMetadata | undefined,
    });

    // Set persisted fields using Reflect to avoid type errors
    Reflect.set(fragment, 'id', model.id);
    Reflect.set(fragment, 'tokenCount', model.tokenCount);
    Reflect.set(fragment, 'createdAt', model.createdAt);
    Reflect.set(fragment, 'updatedAt', model.updatedAt);

    // If embedding was null in DB, set it back to null after construction
    if (model.embedding === null) {
      Reflect.set(fragment, 'embedding', null);
    }

    return fragment;
  }

  /**
   * Converts domain entity to TypeORM model
   * @param entity - The domain entity
   * @returns TypeORM model
   */
  static toModel(entity: Fragment): FragmentModel {
    const model = new FragmentModel();

    model.id = entity.id ?? '';
    model.sourceId = entity.sourceId;
    model.content = entity.content;
    model.embedding = this.serializeEmbedding(entity.embedding);
    model.position = entity.position;
    model.tokenCount = Reflect.get(entity, 'tokenCount') as number;
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

  /**
   * Parses pgvector string to number array
   * @param embedding - The pgvector string (e.g., '[0.1, 0.2, 0.3]')
   * @returns Number array or null
   */
  private static parseEmbedding(embedding: string | null): number[] | null {
    if (!embedding) {
      return null;
    }

    try {
      // pgvector stores as '[0.1, 0.2, 0.3]' string
      const parsed = JSON.parse(embedding) as unknown;

      // Type guard to ensure it's a number array
      if (
        Array.isArray(parsed) &&
        parsed.every((item): item is number => typeof item === 'number')
      ) {
        return parsed;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Serializes number array to pgvector string format
   * @param embedding - The number array
   * @returns pgvector string (e.g., '[0.1, 0.2, 0.3]') or null
   */
  private static serializeEmbedding(embedding: number[] | null): string | null {
    if (!embedding) {
      return null;
    }

    // pgvector expects '[0.1, 0.2, 0.3]' format
    return JSON.stringify(embedding);
  }
}
