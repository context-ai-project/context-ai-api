import { Capsule } from '../../domain/entities/capsule.entity';
import { CapsuleResponseDto } from '../dtos/capsule.dto';

/**
 * CapsuleDtoMapper
 *
 * Converts Capsule domain entities to API response DTOs.
 * Keeps the presentation layer decoupled from domain internals.
 */
export class CapsuleDtoMapper {
  static toResponse(capsule: Capsule): CapsuleResponseDto {
    const dto = new CapsuleResponseDto();

    dto.id = capsule.id!;
    dto.title = capsule.title;
    if (capsule.description) dto.description = capsule.description;
    dto.sectorId = capsule.sectorId;
    dto.type = capsule.type;
    dto.status = capsule.status;
    if (capsule.introText) dto.introText = capsule.introText;
    if (capsule.script) dto.script = capsule.script;
    if (capsule.audioUrl) dto.audioUrl = capsule.audioUrl;
    if (capsule.videoUrl) dto.videoUrl = capsule.videoUrl;
    if (capsule.thumbnailUrl) dto.thumbnailUrl = capsule.thumbnailUrl;
    if (capsule.durationSeconds !== null)
      dto.durationSeconds = capsule.durationSeconds ?? undefined;
    if (capsule.audioVoiceId) dto.audioVoiceId = capsule.audioVoiceId;
    if (capsule.language) dto.language = capsule.language;
    if (capsule.generationMetadata)
      dto.generationMetadata = capsule.generationMetadata;
    dto.createdBy = capsule.createdBy;
    if (capsule.publishedAt)
      dto.publishedAt = capsule.publishedAt.toISOString();
    dto.createdAt = capsule.createdAt.toISOString();
    dto.updatedAt = capsule.updatedAt.toISOString();

    if (capsule.sources?.length) {
      dto.sources = capsule.sources.map((s) => ({
        id: s.id,
        title: s.title,
        sourceType: s.sourceType,
      }));
    }

    return dto;
  }
}
