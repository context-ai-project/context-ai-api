import { NotFoundException, BadRequestException } from '@nestjs/common';
import { GenerateAudioUseCase } from '../../../../../src/modules/capsules/application/use-cases/generate-audio.use-case';
import { Capsule } from '../../../../../src/modules/capsules/domain/entities/capsule.entity';
import { CapsuleType } from '../../../../../src/shared/types/enums/capsule-type.enum';
import { CapsuleStatus } from '../../../../../src/shared/types/enums/capsule-status.enum';

const mockRepository = {
  save: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  findBySectorId: jest.fn(),
  delete: jest.fn(),
  addSources: jest.fn(),
  getSources: jest.fn(),
  countBySectorAndStatus: jest.fn(),
};

const mockAudioGenerator = {
  generateAudio: jest.fn(),
  getAvailableVoices: jest.fn(),
};

const mockMediaStorage = {
  upload: jest.fn(),
  getSignedUrl: jest.fn(),
  delete: jest.fn(),
};

const makeCapsule = (withScript = true): Capsule => {
  const capsule = new Capsule({
    title: 'Test Capsule',
    sectorId: 'sector-1',
    type: CapsuleType.AUDIO,
    createdBy: 'user-1',
  });
  const m = capsule as unknown as Record<string, unknown>;
  m['id'] = 'cap-1';
  if (withScript) m['script'] = 'The narrative script to synthesize.';
  return capsule;
};

/** Flush all pending microtasks so fire-and-forget pipelines complete in tests */
const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('GenerateAudioUseCase', () => {
  let useCase: GenerateAudioUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GenerateAudioUseCase(
      mockRepository as any,
      mockAudioGenerator as any,
      mockMediaStorage as any,
    );
  });

  it('completes the full audio generation pipeline', async () => {
    const capsule = makeCapsule();
    mockRepository.findById.mockResolvedValue(capsule);
    mockRepository.save.mockResolvedValue(capsule);

    mockAudioGenerator.generateAudio.mockResolvedValue({
      audioBuffer: Buffer.from('fake-mp3'),
      durationSeconds: 120,
      contentType: 'audio/mpeg',
    });
    mockMediaStorage.upload.mockResolvedValue({
      path: 'capsules/cap-1/audio.mp3',
      url: 'gs://bucket/capsules/cap-1/audio.mp3',
      contentType: 'audio/mpeg',
      sizeBytes: 8,
    });

    // startAndProcess kicks off phase 1 (sync) then phase 2 (background)
    await useCase.startAndProcess('cap-1', 'voice-id-abc');
    // Flush microtasks to let the background pipeline finish
    await flushPromises();

    // Phase 1 (1 save: GENERATING) + Phase 2 (3 saves: progress/upload/COMPLETED)
    expect(mockRepository.save).toHaveBeenCalledTimes(4);
    expect(mockAudioGenerator.generateAudio).toHaveBeenCalledWith(
      'The narrative script to synthesize.',
      { voiceId: 'voice-id-abc' },
      expect.any(Function), // progress callback
    );
    expect(mockMediaStorage.upload).toHaveBeenCalledTimes(1);
    expect(capsule.status).toBe(CapsuleStatus.COMPLETED);
    // audioUrl is the GCS storage path (signed URLs are generated on-demand)
    expect(capsule.audioUrl).toBe('capsules/cap-1/audio.mp3');
    expect(capsule.durationSeconds).toBe(120);
  });

  it('throws NotFoundException when capsule not found', async () => {
    mockRepository.findById.mockResolvedValue(null);

    // Phase 1 (validation) throws synchronously → startAndProcess rejects
    await expect(useCase.startAndProcess('missing', 'voice-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws BadRequestException when capsule has no script', async () => {
    const capsule = makeCapsule(false);
    mockRepository.findById.mockResolvedValue(capsule);

    await expect(useCase.startAndProcess('cap-1', 'voice-id')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('marks capsule as FAILED when audio generation throws', async () => {
    const capsule = makeCapsule();
    mockRepository.findById.mockResolvedValue(capsule);
    mockRepository.save.mockResolvedValue(capsule);
    mockAudioGenerator.generateAudio.mockRejectedValue(
      new Error('ElevenLabs API error'),
    );

    // Phase 2 runs in the background — startAndProcess itself does NOT re-throw
    await useCase.startAndProcess('cap-1', 'voice-id');
    await flushPromises();

    expect(capsule.status).toBe(CapsuleStatus.FAILED);
    // Phase 1 (1: GENERATING) + Phase 2 (2: initial progress + FAILED)
    expect(mockRepository.save).toHaveBeenCalledTimes(3);
  });
});
