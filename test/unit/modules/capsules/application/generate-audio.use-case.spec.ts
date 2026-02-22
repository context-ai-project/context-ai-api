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
    mockMediaStorage.getSignedUrl.mockResolvedValue(
      'https://storage.googleapis.com/signed-url',
    );

    await useCase.execute('cap-1', 'voice-id-abc');

    expect(mockRepository.save).toHaveBeenCalledTimes(2); // GENERATING + COMPLETED
    expect(mockAudioGenerator.generateAudio).toHaveBeenCalledWith(
      'The narrative script to synthesize.',
      { voiceId: 'voice-id-abc' },
    );
    expect(mockMediaStorage.upload).toHaveBeenCalledTimes(1);
    expect(capsule.status).toBe(CapsuleStatus.COMPLETED);
    expect(capsule.audioUrl).toBe('https://storage.googleapis.com/signed-url');
    expect(capsule.durationSeconds).toBe(120);
  });

  it('throws NotFoundException when capsule not found', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing', 'voice-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws BadRequestException when capsule has no script', async () => {
    const capsule = makeCapsule(false);
    mockRepository.findById.mockResolvedValue(capsule);

    await expect(useCase.execute('cap-1', 'voice-id')).rejects.toThrow(
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

    await expect(useCase.execute('cap-1', 'voice-id')).rejects.toThrow(
      'ElevenLabs API error',
    );

    expect(capsule.status).toBe(CapsuleStatus.FAILED);
    // save called twice: GENERATING + FAILED
    expect(mockRepository.save).toHaveBeenCalledTimes(2);
  });
});
