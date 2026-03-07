import { Capsule } from '@modules/capsules/domain/entities/capsule.entity';
import { CapsuleModel } from '../models/capsule.model';

/**
 * CapsuleMapper
 *
 * Converts between Capsule domain entities and TypeORM CapsuleModel.
 * Follows the same pattern as SectorMapper.
 */
export class CapsuleMapper {
  static toDomain(model: CapsuleModel): Capsule {
    const capsule = new Capsule({
      title: model.title,
      sectorId: model.sectorId,
      // model.type is a string stored in DB matching the enum — safe cast via unknown
      type: model.type as unknown as Capsule['type'],
      createdBy: model.createdBy,
    });

    // Hydrate persisted fields that the constructor doesn't set
    const m = capsule as unknown as Record<string, unknown>;
    m['id'] = model.id;
    m['description'] = model.description;
    m['status'] = model.status;
    m['introText'] = model.introText;
    m['script'] = model.script;
    m['audioUrl'] = model.audioUrl;
    m['videoUrl'] = model.videoUrl;
    m['thumbnailUrl'] = model.thumbnailUrl;
    m['durationSeconds'] = model.durationSeconds;
    m['audioVoiceId'] = model.audioVoiceId;
    m['language'] = model.language;
    m['generationMetadata'] = model.generationMetadata;
    m['publishedAt'] = model.publishedAt;
    m['createdAt'] = model.createdAt;
    m['updatedAt'] = model.updatedAt;
    m['sources'] = [];

    return capsule;
  }

  static toModel(entity: Capsule): CapsuleModel {
    const model = new CapsuleModel();

    if (entity.id) model.id = entity.id;
    model.title = entity.title;
    model.description = entity.description;
    model.sectorId = entity.sectorId;
    model.type = entity.type;
    model.status = entity.status;
    model.introText = entity.introText;
    model.script = entity.script;
    model.audioUrl = entity.audioUrl;
    model.videoUrl = entity.videoUrl;
    model.thumbnailUrl = entity.thumbnailUrl;
    model.durationSeconds = entity.durationSeconds;
    model.audioVoiceId = entity.audioVoiceId;
    model.language = entity.language;
    model.generationMetadata = entity.generationMetadata;
    model.createdBy = entity.createdBy;
    model.publishedAt = entity.publishedAt;
    model.createdAt = entity.createdAt;
    model.updatedAt = entity.updatedAt;

    return model;
  }

  static toDomainArray(models: CapsuleModel[]): Capsule[] {
    return models.map((m) => this.toDomain(m));
  }
}
