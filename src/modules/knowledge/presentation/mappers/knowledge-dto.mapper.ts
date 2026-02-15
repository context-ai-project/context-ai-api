import type { KnowledgeSource } from '../../domain/entities/knowledge-source.entity';
import type {
  KnowledgeSourceDto,
  KnowledgeSourceDetailDto,
} from '../dtos/knowledge.dto';

/**
 * Maps KnowledgeSource domain entities to presentation DTOs.
 *
 * Keeps the controller thin by centralising all DTO-mapping logic here.
 * Follows the same pattern as InteractionDtoMapper and SectorDtoMapper.
 */
export class KnowledgeDtoMapper {
  /**
   * Map a KnowledgeSource → KnowledgeSourceDto (list view)
   */
  static toSourceDto(source: KnowledgeSource): KnowledgeSourceDto {
    return {
      id: source.id ?? '',
      title: source.title,
      sectorId: source.sectorId,
      sourceType: source.sourceType,
      status: source.status,
      metadata: source.metadata ?? null,
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
    };
  }

  /**
   * Map a KnowledgeSource → KnowledgeSourceDetailDto (detail view)
   */
  static toSourceDetailDto(
    source: KnowledgeSource,
    fragmentCount: number,
  ): KnowledgeSourceDetailDto {
    return {
      ...KnowledgeDtoMapper.toSourceDto(source),
      content: source.content,
      fragmentCount,
    };
  }

  /**
   * Map an array of KnowledgeSource entities → KnowledgeSourceDto[]
   */
  static toSourceDtoList(sources: KnowledgeSource[]): KnowledgeSourceDto[] {
    return sources.map((source) => KnowledgeDtoMapper.toSourceDto(source));
  }
}
