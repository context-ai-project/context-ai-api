import { CapsuleMapper } from '../../../../../../../src/modules/capsules/infrastructure/persistence/mappers/capsule.mapper';
import { CapsuleModel } from '../../../../../../../src/modules/capsules/infrastructure/persistence/models/capsule.model';
import { Capsule } from '../../../../../../../src/modules/capsules/domain/entities/capsule.entity';
import { CapsuleType } from '../../../../../../../src/shared/types/enums/capsule-type.enum';
import { CapsuleStatus } from '../../../../../../../src/shared/types/enums/capsule-status.enum';

describe('CapsuleMapper', () => {
  const now = new Date();

  describe('toDomain', () => {
    it('maps model to domain entity with all fields', () => {
      const model = {
        id: 'cap-uuid',
        title: 'Policy Audio',
        description: 'Desc',
        sectorId: 'sector-uuid',
        type: CapsuleType.AUDIO,
        status: CapsuleStatus.DRAFT,
        introText: 'Intro',
        script: 'Script text',
        audioUrl: '/path/audio.mp3',
        videoUrl: null,
        thumbnailUrl: null,
        durationSeconds: 120,
        audioVoiceId: 'voice-1',
        language: 'es-ES',
        generationMetadata: { progress: 100 },
        createdBy: 'user-1',
        publishedAt: null,
        createdAt: now,
        updatedAt: now,
      } as CapsuleModel;

      const entity = CapsuleMapper.toDomain(model);

      expect(entity).toBeInstanceOf(Capsule);
      expect(entity.id).toBe('cap-uuid');
      expect(entity.title).toBe('Policy Audio');
      expect(entity.description).toBe('Desc');
      expect(entity.sectorId).toBe('sector-uuid');
      expect(entity.type).toBe(CapsuleType.AUDIO);
      expect(entity.status).toBe(CapsuleStatus.DRAFT);
      expect(entity.introText).toBe('Intro');
      expect(entity.script).toBe('Script text');
      expect(entity.audioUrl).toBe('/path/audio.mp3');
      expect(entity.durationSeconds).toBe(120);
      expect(entity.audioVoiceId).toBe('voice-1');
      expect(entity.language).toBe('es-ES');
      expect(entity.generationMetadata).toEqual({ progress: 100 });
      expect(entity.createdBy).toBe('user-1');
      expect(entity.publishedAt).toBeNull();
      expect(entity.createdAt).toBe(now);
      expect(entity.updatedAt).toBe(now);
      expect(entity.sources).toEqual([]);
    });
  });

  describe('toModel', () => {
    it('maps domain entity to model', () => {
      const entity = new Capsule({
        title: 'Title',
        sectorId: 'sector-1',
        type: CapsuleType.AUDIO,
        createdBy: 'user-1',
      });
      (entity as any).id = 'cap-1';
      (entity as any).description = 'Desc';
      (entity as any).status = CapsuleStatus.COMPLETED;
      (entity as any).script = 'Script';
      (entity as any).audioUrl = '/audio.mp3';
      (entity as any).durationSeconds = 90;
      (entity as any).language = 'en-US';
      (entity as any).createdAt = now;
      (entity as any).updatedAt = now;

      const model = CapsuleMapper.toModel(entity);

      expect(model).toBeInstanceOf(CapsuleModel);
      expect(model.id).toBe('cap-1');
      expect(model.title).toBe('Title');
      expect(model.description).toBe('Desc');
      expect(model.sectorId).toBe('sector-1');
      expect(model.type).toBe(CapsuleType.AUDIO);
      expect(model.status).toBe(CapsuleStatus.COMPLETED);
      expect(model.script).toBe('Script');
      expect(model.audioUrl).toBe('/audio.mp3');
      expect(model.durationSeconds).toBe(90);
      expect(model.language).toBe('en-US');
      expect(model.createdBy).toBe('user-1');
    });
  });

  describe('toDomainArray', () => {
    it('maps array of models to array of entities', () => {
      const models = [
        { id: '1', title: 'AAA', sectorId: 's', type: CapsuleType.AUDIO, status: CapsuleStatus.DRAFT, createdBy: 'u', createdAt: now, updatedAt: now } as CapsuleModel,
        { id: '2', title: 'BBB', sectorId: 's', type: CapsuleType.AUDIO, status: CapsuleStatus.DRAFT, createdBy: 'u', createdAt: now, updatedAt: now } as CapsuleModel,
      ];

      const entities = CapsuleMapper.toDomainArray(models);

      expect(entities).toHaveLength(2);
      expect(entities[0]).toBeInstanceOf(Capsule);
      expect(entities[0].id).toBe('1');
      expect(entities[1].id).toBe('2');
    });
  });
});
