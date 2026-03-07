import { CapsuleDtoMapper } from '../../../../../../src/modules/capsules/presentation/mappers/capsule-dto.mapper';
import { Capsule } from '../../../../../../src/modules/capsules/domain/entities/capsule.entity';
import { CapsuleType } from '../../../../../../src/shared/types/enums/capsule-type.enum';
import { CapsuleStatus } from '../../../../../../src/shared/types/enums/capsule-status.enum';

describe('CapsuleDtoMapper', () => {
  const now = new Date('2025-01-15T10:00:00Z');

  function makeCapsule(overrides: Partial<Record<string, unknown>> = {}): Capsule {
    const c = new Capsule({
      title: 'Policy Audio',
      sectorId: 'sector-1',
      type: CapsuleType.AUDIO,
      createdBy: 'user-1',
    });
    (c as any).id = 'cap-1';
    (c as any).status = CapsuleStatus.COMPLETED;
    (c as any).createdAt = now;
    (c as any).updatedAt = now;
    (c as any).sources = [];
    Object.assign(c, overrides);
    return c;
  }

  it('maps entity to response DTO with required fields', () => {
    const capsule = makeCapsule();
    const dto = CapsuleDtoMapper.toResponse(capsule);

    expect(dto.id).toBe('cap-1');
    expect(dto.title).toBe('Policy Audio');
    expect(dto.sectorId).toBe('sector-1');
    expect(dto.type).toBe(CapsuleType.AUDIO);
    expect(dto.status).toBe(CapsuleStatus.COMPLETED);
    expect(dto.createdBy).toBe('user-1');
    expect(dto.createdAt).toBe(now.toISOString());
    expect(dto.updatedAt).toBe(now.toISOString());
  });

  it('includes optional fields when set', () => {
    const capsule = makeCapsule({
      description: 'A policy summary',
      introText: 'Intro',
      script: 'Script text',
      audioUrl: '/path/audio.mp3',
      durationSeconds: 120,
      audioVoiceId: 'voice-1',
      language: 'es-ES',
      generationMetadata: { progress: 100 },
      publishedAt: now,
    });
    (capsule as any).videoUrl = null;
    (capsule as any).thumbnailUrl = null;
    const dto = CapsuleDtoMapper.toResponse(capsule);

    expect(dto.description).toBe('A policy summary');
    expect(dto.introText).toBe('Intro');
    expect(dto.script).toBe('Script text');
    expect(dto.audioUrl).toBe('/path/audio.mp3');
    expect(dto.durationSeconds).toBe(120);
    expect(dto.audioVoiceId).toBe('voice-1');
    expect(dto.language).toBe('es-ES');
    expect(dto.generationMetadata).toEqual({ progress: 100 });
    expect(dto.publishedAt).toBe(now.toISOString());
  });

  it('maps sources when present', () => {
    const capsule = makeCapsule();
    (capsule as any).sources = [
      { id: 'src-1', title: 'Doc 1', sourceType: 'PDF' },
      { id: 'src-2', title: 'Doc 2', sourceType: 'PDF' },
    ];
    const dto = CapsuleDtoMapper.toResponse(capsule);

    expect(dto.sources).toHaveLength(2);
    expect(dto.sources).toEqual([
      { id: 'src-1', title: 'Doc 1', sourceType: 'PDF' },
      { id: 'src-2', title: 'Doc 2', sourceType: 'PDF' },
    ]);
  });

  it('omits sources when empty', () => {
    const capsule = makeCapsule();
    (capsule as any).sources = [];
    const dto = CapsuleDtoMapper.toResponse(capsule);
    expect(dto.sources).toBeUndefined();
  });
});
