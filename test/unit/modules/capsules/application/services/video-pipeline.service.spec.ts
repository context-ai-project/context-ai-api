import { VideoPipelineService } from '../../../../../../src/modules/capsules/application/services/video-pipeline.service';
import { Capsule } from '../../../../../../src/modules/capsules/domain/entities/capsule.entity';
import { CapsuleType } from '../../../../../../src/shared/types/enums/capsule-type.enum';
import { CapsuleStatus } from '../../../../../../src/shared/types/enums/capsule-status.enum';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const SCENES = [
  {
    textToNarrate: 'Welcome to the company.',
    visualPrompt: 'modern office',
    titleOverlay: 'Welcome',
  },
  {
    textToNarrate: 'Your benefits include health insurance.',
    visualPrompt: 'team celebrating',
    titleOverlay: 'Benefits',
  },
];

const mockCapsuleRepo = {
  findById: jest.fn(),
  save: jest.fn(),
  findAll: jest.fn(),
  findBySectorId: jest.fn(),
  delete: jest.fn(),
  addSources: jest.fn(),
  getSources: jest.fn(),
  countBySectorAndStatus: jest.fn(),
  countVideoCapsulesThisMonth: jest.fn(),
};

const mockImageGenerator = {
  generateImage: jest.fn(),
};

const mockAudioGenerator = {
  generateAudio: jest.fn(),
  getAvailableVoices: jest.fn(),
  searchSharedVoices: jest.fn(),
};

const mockMediaStorage = {
  upload: jest.fn(),
  getSignedUrl: jest.fn(),
  delete: jest.fn(),
};

const mockVideoRenderer = {
  renderVideo: jest.fn(),
  getRenderStatus: jest.fn(),
};

function makeCapsule(): Capsule {
  const capsule = new Capsule({
    title: 'Test Video',
    sectorId: 'sector-1',
    type: CapsuleType.VIDEO,
    createdBy: 'user-1',
  });
  (capsule as unknown as Record<string, unknown>)['id'] = 'cap-1';
  (capsule as unknown as Record<string, unknown>)['script'] =
    JSON.stringify(SCENES);
  (capsule as unknown as Record<string, unknown>)['status'] =
    CapsuleStatus.GENERATING_ASSETS;
  (capsule as unknown as Record<string, unknown>)['audioVoiceId'] = 'voice-1';
  return capsule;
}

describe('VideoPipelineService', () => {
  let service: VideoPipelineService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VideoPipelineService(
      mockCapsuleRepo as never,
      mockImageGenerator as never,
      mockAudioGenerator as never,
      mockMediaStorage as never,
      mockVideoRenderer as never,
    );
  });

  it('runs the full pipeline: images (sequential) + audio → render → download → complete', async () => {
    const capsule = makeCapsule();
    mockCapsuleRepo.findById.mockResolvedValue(capsule);
    mockCapsuleRepo.save.mockImplementation((c: Capsule) =>
      Promise.resolve(c),
    );

    mockImageGenerator.generateImage.mockResolvedValue(
      Buffer.from('fake-img'),
    );
    mockMediaStorage.upload.mockResolvedValue({
      path: 'capsules/cap-1/temp/img.png',
      url: 'https://storage.example.com/img.png',
      contentType: 'image/png',
      sizeBytes: 1024,
    });
    mockMediaStorage.getSignedUrl.mockResolvedValue(
      'https://storage.example.com/signed/audio.mp3',
    );
    mockAudioGenerator.generateAudio.mockResolvedValue({
      audioBuffer: Buffer.from('fake-audio'),
      durationSeconds: 16,
      contentType: 'audio/mpeg',
    });
    mockVideoRenderer.renderVideo.mockResolvedValue('render-id-1');
    mockVideoRenderer.getRenderStatus.mockResolvedValue({
      status: 'done',
      url: 'https://cdn.shotstack.io/final.mp4',
    });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(Buffer.from('mp4-data')),
    });
    mockMediaStorage.delete.mockResolvedValue(undefined);

    await service.processVideo('cap-1', 'voice-1');

    expect(mockImageGenerator.generateImage).toHaveBeenCalledTimes(2);
    expect(mockAudioGenerator.generateAudio).toHaveBeenCalledTimes(1);
    expect(mockVideoRenderer.renderVideo).toHaveBeenCalledTimes(1);
    expect(mockVideoRenderer.getRenderStatus).toHaveBeenCalledWith(
      'render-id-1',
    );

    const savedCapsule = mockCapsuleRepo.save.mock.calls.at(-1)?.[0] as Capsule;
    expect(savedCapsule.status).toBe(CapsuleStatus.COMPLETED);
    expect(savedCapsule.videoUrl).toBeTruthy();
  });

  it('generates images sequentially, not in parallel', async () => {
    const capsule = makeCapsule();
    mockCapsuleRepo.findById.mockResolvedValue(capsule);
    mockCapsuleRepo.save.mockImplementation((c: Capsule) =>
      Promise.resolve(c),
    );

    const callOrder: number[] = [];
    mockImageGenerator.generateImage.mockImplementation(
      (prompt: string) =>
        new Promise<Buffer>((resolve) => {
          const idx = prompt === 'modern office' ? 0 : 1;
          callOrder.push(idx);
          resolve(Buffer.from(`img-${idx}`));
        }),
    );
    mockMediaStorage.upload.mockResolvedValue({
      path: 'p',
      url: 'u',
      contentType: 'image/png',
      sizeBytes: 100,
    });
    mockMediaStorage.getSignedUrl.mockResolvedValue('https://signed');
    mockAudioGenerator.generateAudio.mockResolvedValue({
      audioBuffer: Buffer.from('audio'),
      durationSeconds: 10,
      contentType: 'audio/mpeg',
    });
    mockVideoRenderer.renderVideo.mockResolvedValue('r1');
    mockVideoRenderer.getRenderStatus.mockResolvedValue({
      status: 'done',
      url: 'https://cdn.shotstack.io/final.mp4',
    });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(Buffer.from('mp4')),
    });
    mockMediaStorage.delete.mockResolvedValue(undefined);

    await service.processVideo('cap-1', 'voice-1');

    expect(callOrder).toEqual([0, 1]);
  });

  it('marks capsule as FAILED when image generation fails', async () => {
    const capsule = makeCapsule();
    mockCapsuleRepo.findById.mockResolvedValue(capsule);
    mockCapsuleRepo.save.mockImplementation((c: Capsule) =>
      Promise.resolve(c),
    );
    mockImageGenerator.generateImage.mockRejectedValue(
      new Error('Image API down'),
    );

    await service.processVideo('cap-1', 'voice-1');

    const lastSave = mockCapsuleRepo.save.mock.calls.at(-1)?.[0] as Capsule;
    expect(lastSave.status).toBe(CapsuleStatus.FAILED);
  });

  it('marks capsule as FAILED when Shotstack render fails', async () => {
    const capsule = makeCapsule();
    mockCapsuleRepo.findById.mockResolvedValue(capsule);
    mockCapsuleRepo.save.mockImplementation((c: Capsule) =>
      Promise.resolve(c),
    );
    mockImageGenerator.generateImage.mockResolvedValue(
      Buffer.from('fake-img'),
    );
    mockMediaStorage.upload.mockResolvedValue({
      path: 'p',
      url: 'https://url',
      contentType: 'image/png',
      sizeBytes: 100,
    });
    mockMediaStorage.getSignedUrl.mockResolvedValue('https://signed-audio');
    mockAudioGenerator.generateAudio.mockResolvedValue({
      audioBuffer: Buffer.from('audio'),
      durationSeconds: 10,
      contentType: 'audio/mpeg',
    });
    mockVideoRenderer.renderVideo.mockResolvedValue('render-fail');
    mockVideoRenderer.getRenderStatus.mockResolvedValue({
      status: 'failed',
      errorMessage: 'Render crashed',
    });
    mockMediaStorage.delete.mockResolvedValue(undefined);

    await service.processVideo('cap-1', 'voice-1');

    const lastSave = mockCapsuleRepo.save.mock.calls.at(-1)?.[0] as Capsule;
    expect(lastSave.status).toBe(CapsuleStatus.FAILED);
  });

  it('throws when capsule is not found', async () => {
    mockCapsuleRepo.findById.mockResolvedValue(null);

    await expect(
      service.processVideo('nonexistent', 'voice-1'),
    ).rejects.toThrow('not found');
  });
});
