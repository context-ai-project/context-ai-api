import { BadRequestException } from '@nestjs/common';
import { CapsulesController } from '../../../../../src/modules/capsules/presentation/capsules.controller';
import { Capsule } from '../../../../../src/modules/capsules/domain/entities/capsule.entity';
import { CapsuleType } from '../../../../../src/shared/types/enums/capsule-type.enum';
import { CapsuleStatus } from '../../../../../src/shared/types/enums/capsule-status.enum';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCapsule(overrides: Partial<Record<string, unknown>> = {}): Capsule {
  const c = new Capsule({
    title: 'Test Capsule',
    sectorId: 'sector-1',
    type: CapsuleType.AUDIO,
    createdBy: 'user-1',
  });
  Object.assign(c as unknown as Record<string, unknown>, {
    id: 'cap-1',
    status: CapsuleStatus.DRAFT,
    audioUrl: null,
    videoUrl: null,
    generationMetadata: null,
    sources: [],
    ...overrides,
  });
  return c;
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockCreateUC = { execute: jest.fn() };
const mockListUC = { execute: jest.fn() };
const mockGetUC = { execute: jest.fn() };
const mockUpdateUC = { execute: jest.fn() };
const mockDeleteUC = { execute: jest.fn() };
const mockPublishUC = { execute: jest.fn() };
const mockArchiveUC = { execute: jest.fn() };
const mockGenerateScriptUC = { execute: jest.fn() };
const mockGenerateAudioUC = { startAndProcess: jest.fn() };
const mockGenerateVideoUC = {
  execute: jest.fn(),
  getQuotaInfo: jest.fn(),
};
const mockAudioGenerator = {
  getAvailableVoices: jest.fn(),
  searchSharedVoices: jest.fn(),
};
const mockMediaStorage = {
  getSignedUrl: jest.fn(),
};

const mockReq = { user: { userId: 'user-1' } };

function makeController(): CapsulesController {
  return new CapsulesController(
    mockCreateUC as never,
    mockListUC as never,
    mockGetUC as never,
    mockUpdateUC as never,
    mockDeleteUC as never,
    mockPublishUC as never,
    mockArchiveUC as never,
    mockGenerateScriptUC as never,
    mockGenerateAudioUC as never,
    mockGenerateVideoUC as never,
    mockAudioGenerator as never,
    mockMediaStorage as never,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CapsulesController', () => {
  let controller: CapsulesController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = makeController();
  });

  // ── POST /capsules ────────────────────────────────────────────────────────

  describe('create', () => {
    it('delegates to CreateCapsuleUseCase and returns mapped DTO', async () => {
      const capsule = makeCapsule();
      mockCreateUC.execute.mockResolvedValue(capsule);

      const result = await controller.create(
        {
          title: 'Test Capsule',
          sectorId: 'sector-1',
          sourceIds: ['doc-1'],
          type: CapsuleType.AUDIO,
        },
        mockReq,
      );

      expect(mockCreateUC.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Capsule',
          sectorId: 'sector-1',
          createdBy: 'user-1',
          type: CapsuleType.AUDIO,
        }),
      );
      expect(result).toMatchObject({ id: 'cap-1', title: 'Test Capsule' });
    });

    it('defaults to AUDIO type when type not provided', async () => {
      const capsule = makeCapsule();
      mockCreateUC.execute.mockResolvedValue(capsule);

      await controller.create(
        { title: 'T', sectorId: 's', sourceIds: [] },
        mockReq,
      );

      expect(mockCreateUC.execute).toHaveBeenCalledWith(
        expect.objectContaining({ type: CapsuleType.AUDIO }),
      );
    });
  });

  // ── GET /capsules ─────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns paginated list from use case', async () => {
      const capsule = makeCapsule();
      mockListUC.execute.mockResolvedValue({
        data: [capsule],
        total: 1,
        page: 1,
        limit: 20,
      });

      const result = await controller.list();

      expect(mockListUC.execute).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 20 }),
      );
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('parses page and limit query params', async () => {
      mockListUC.execute.mockResolvedValue({ data: [], total: 0, page: 2, limit: 5 });

      await controller.list(undefined, undefined, undefined, undefined, '2', '5');

      expect(mockListUC.execute).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, limit: 5 }),
      );
    });

    it('passes onlyActive flag when truthy string', async () => {
      mockListUC.execute.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

      await controller.list(undefined, undefined, undefined, undefined, undefined, undefined, 'true');

      expect(mockListUC.execute).toHaveBeenCalledWith(
        expect.objectContaining({ onlyActive: true }),
      );
    });
  });

  // ── GET /capsules/voices ──────────────────────────────────────────────────

  describe('getVoices', () => {
    it('maps IAudioGenerator voices to DTOs', async () => {
      mockAudioGenerator.getAvailableVoices.mockResolvedValue([
        { id: 'v1', name: 'Alice', category: 'premade', previewUrl: 'http://preview', labels: { accent: 'american' } },
      ]);

      const result = await controller.getVoices();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'v1', name: 'Alice', category: 'premade' });
    });
  });

  // ── GET /capsules/voices/search ───────────────────────────────────────────

  describe('searchSharedVoices', () => {
    it('returns mapped shared voices for valid query', async () => {
      mockAudioGenerator.searchSharedVoices = jest.fn().mockResolvedValue([
        {
          voiceId: 'sv1',
          publicOwnerId: 'owner-1',
          name: 'Maria',
          language: 'es',
          gender: 'female',
        },
      ]);

      const result = await controller.searchSharedVoices('maria');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        voiceId: 'sv1',
        name: 'Maria',
        language: 'es',
      });
    });

    it('throws BadRequestException for empty query', async () => {
      await expect(controller.searchSharedVoices('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.searchSharedVoices('   ')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── GET /capsules/quota ───────────────────────────────────────────────────

  describe('getQuota', () => {
    it('delegates to GenerateVideoUseCase.getQuotaInfo', async () => {
      mockGenerateVideoUC.getQuotaInfo.mockResolvedValue({ used: 3, limit: 20, remaining: 17 });

      const result = await controller.getQuota();

      expect(result).toEqual({ used: 3, limit: 20, remaining: 17 });
    });
  });

  // ── GET /capsules/:id ─────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns capsule DTO', async () => {
      const capsule = makeCapsule();
      mockGetUC.execute.mockResolvedValue(capsule);

      const result = await controller.getById('cap-1');

      expect(mockGetUC.execute).toHaveBeenCalledWith('cap-1');
      expect(result).toMatchObject({ id: 'cap-1' });
    });
  });

  // ── PATCH /capsules/:id ───────────────────────────────────────────────────

  describe('update', () => {
    it('delegates to UpdateCapsuleUseCase and returns DTO', async () => {
      const capsule = makeCapsule({ title: 'Updated' });
      mockUpdateUC.execute.mockResolvedValue(capsule);

      const result = await controller.update('cap-1', { title: 'Updated' });

      expect(mockUpdateUC.execute).toHaveBeenCalledWith(
        expect.objectContaining({ capsuleId: 'cap-1', title: 'Updated' }),
      );
      expect(result).toMatchObject({ id: 'cap-1' });
    });
  });

  // ── DELETE /capsules/:id ──────────────────────────────────────────────────

  describe('delete', () => {
    it('delegates to DeleteCapsuleUseCase', async () => {
      mockDeleteUC.execute.mockResolvedValue(undefined);
      await expect(controller.delete('cap-1')).resolves.toBeUndefined();
      expect(mockDeleteUC.execute).toHaveBeenCalledWith('cap-1');
    });
  });

  // ── POST /capsules/:id/publish ────────────────────────────────────────────

  describe('publish', () => {
    it('returns published capsule DTO', async () => {
      const capsule = makeCapsule({ status: CapsuleStatus.ACTIVE });
      mockPublishUC.execute.mockResolvedValue(capsule);

      const result = await controller.publish('cap-1');

      expect(result).toMatchObject({ id: 'cap-1' });
    });
  });

  // ── POST /capsules/:id/archive ────────────────────────────────────────────

  describe('archive', () => {
    it('returns archived capsule DTO', async () => {
      const capsule = makeCapsule({ status: CapsuleStatus.ARCHIVED });
      mockArchiveUC.execute.mockResolvedValue(capsule);

      const result = await controller.archive('cap-1');

      expect(result).toMatchObject({ id: 'cap-1' });
    });
  });

  // ── POST /capsules/:id/generate-script ───────────────────────────────────

  describe('generateScript', () => {
    it('calls use case with id and optional language', async () => {
      mockGenerateScriptUC.execute.mockResolvedValue({ script: 'My script' });

      const result = await controller.generateScript('cap-1', { language: 'es' });

      expect(mockGenerateScriptUC.execute).toHaveBeenCalledWith('cap-1', 'es');
      expect(result).toEqual({ script: 'My script' });
    });

    it('passes undefined language when not provided', async () => {
      mockGenerateScriptUC.execute.mockResolvedValue({ script: 'Script' });

      await controller.generateScript('cap-1', {});

      expect(mockGenerateScriptUC.execute).toHaveBeenCalledWith('cap-1', undefined);
    });
  });

  // ── POST /capsules/:id/generate (audio vs video routing) ─────────────────

  describe('generate', () => {
    it('throws BadRequestException when voiceId is missing', async () => {
      await expect(
        controller.generate('cap-1', { voiceId: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('routes to audio pipeline for AUDIO capsule', async () => {
      const capsule = makeCapsule({ type: CapsuleType.AUDIO });
      mockGetUC.execute.mockResolvedValue(capsule);
      mockGenerateAudioUC.startAndProcess.mockResolvedValue(undefined);

      await controller.generate('cap-1', { voiceId: 'voice-1' });

      expect(mockGenerateAudioUC.startAndProcess).toHaveBeenCalledWith('cap-1', 'voice-1');
      expect(mockGenerateVideoUC.execute).not.toHaveBeenCalled();
    });

    it('routes to video pipeline for VIDEO capsule', async () => {
      const capsule = makeCapsule({ type: CapsuleType.VIDEO });
      mockGetUC.execute.mockResolvedValue(capsule);
      mockGenerateVideoUC.execute.mockResolvedValue(undefined);

      await controller.generate('cap-1', { voiceId: 'voice-2' });

      expect(mockGenerateVideoUC.execute).toHaveBeenCalledWith('cap-1', 'voice-2');
      expect(mockGenerateAudioUC.startAndProcess).not.toHaveBeenCalled();
    });

    it('saves updated script before generating when script is provided', async () => {
      const capsule = makeCapsule({ type: CapsuleType.AUDIO });
      mockGetUC.execute.mockResolvedValue(capsule);
      mockUpdateUC.execute.mockResolvedValue(capsule);
      mockGenerateAudioUC.startAndProcess.mockResolvedValue(undefined);

      await controller.generate('cap-1', { voiceId: 'v1', script: '  Updated script  ' });

      expect(mockUpdateUC.execute).toHaveBeenCalledWith(
        expect.objectContaining({ capsuleId: 'cap-1', script: 'Updated script' }),
      );
    });
  });

  // ── GET /capsules/:id/status ──────────────────────────────────────────────

  describe('getStatus', () => {
    it('returns basic status without progress', async () => {
      const capsule = makeCapsule({ status: CapsuleStatus.GENERATING_ASSETS });
      mockGetUC.execute.mockResolvedValue(capsule);

      const result = await controller.getStatus('cap-1');

      expect(result.capsuleId).toBe('cap-1');
      expect(result.status).toBe(CapsuleStatus.GENERATING_ASSETS);
      expect(result.progress).toBeUndefined();
    });

    it('exposes progress and step from generationMetadata', async () => {
      const capsule = makeCapsule({
        status: CapsuleStatus.RENDERING,
        generationMetadata: { progress: 65, step: 'RENDERING' },
      });
      mockGetUC.execute.mockResolvedValue(capsule);

      const result = await controller.getStatus('cap-1');

      expect(result.progress).toBe(65);
      expect(result.currentStep).toBe('RENDERING');
    });

    it('exposes errorMessage from metadata when status is FAILED', async () => {
      const capsule = makeCapsule({
        status: CapsuleStatus.FAILED,
        generationMetadata: { error: { reason: 'Shotstack timeout' } },
      });
      mockGetUC.execute.mockResolvedValue(capsule);

      const result = await controller.getStatus('cap-1');

      expect(result.errorMessage).toBe('Shotstack timeout');
    });

    it('exposes audioUrl and videoUrl when present', async () => {
      const capsule = makeCapsule({
        status: CapsuleStatus.COMPLETED,
        audioUrl: 'capsules/cap-1/audio.mp3',
        videoUrl: 'capsules/cap-1/video.mp4',
      });
      mockGetUC.execute.mockResolvedValue(capsule);

      const result = await controller.getStatus('cap-1');

      expect(result.audioUrl).toBe('capsules/cap-1/audio.mp3');
      expect(result.videoUrl).toBe('capsules/cap-1/video.mp4');
    });
  });

  // ── GET /capsules/:id/download/:type ─────────────────────────────────────

  describe('getDownloadUrl', () => {
    it('returns signed URL for audio type', async () => {
      const capsule = makeCapsule({ audioUrl: 'capsules/cap-1/audio.mp3' });
      mockGetUC.execute.mockResolvedValue(capsule);
      mockMediaStorage.getSignedUrl.mockResolvedValue('https://signed.url/audio.mp3');

      const result = await controller.getDownloadUrl('cap-1', 'audio');

      expect(mockMediaStorage.getSignedUrl).toHaveBeenCalledWith(
        'capsules/cap-1/audio.mp3',
      );
      expect(result.url).toBe('https://signed.url/audio.mp3');
    });

    it('returns signed URL for video type', async () => {
      const capsule = makeCapsule({ videoUrl: 'capsules/cap-1/video.mp4' });
      mockGetUC.execute.mockResolvedValue(capsule);
      mockMediaStorage.getSignedUrl.mockResolvedValue('https://signed.url/video.mp4');

      const result = await controller.getDownloadUrl('cap-1', 'video');

      expect(mockMediaStorage.getSignedUrl).toHaveBeenCalledWith(
        'capsules/cap-1/video.mp4',
      );
    });

    it('throws BadRequestException for unknown type', async () => {
      const capsule = makeCapsule();
      mockGetUC.execute.mockResolvedValue(capsule);

      await expect(controller.getDownloadUrl('cap-1', 'pdf')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
