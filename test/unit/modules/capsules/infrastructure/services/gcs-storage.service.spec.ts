import { GcsStorageService } from '../../../../../../src/modules/capsules/infrastructure/services/gcs-storage.service';

// ── Mock @google-cloud/storage ────────────────────────────────────────────────

const mockSave = jest.fn();
const mockGetSignedUrl = jest.fn();
const mockDelete = jest.fn();
const mockFile = jest.fn().mockReturnValue({
  save: mockSave,
  getSignedUrl: mockGetSignedUrl,
  delete: mockDelete,
});
const mockBucket = jest.fn().mockReturnValue({ file: mockFile });

jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({ bucket: mockBucket })),
}));

const BUCKET = 'test-capsules-bucket';

function makeService(): GcsStorageService {
  process.env.GCS_BUCKET_CAPSULES = BUCKET;
  process.env.GCS_PROJECT_ID = 'test-project';
  return new GcsStorageService();
}

describe('GcsStorageService', () => {
  let service: GcsStorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();
  });

  afterEach(() => {
    delete process.env.GCS_BUCKET_CAPSULES;
    delete process.env.GCS_PROJECT_ID;
    delete process.env.GCS_KEY_FILE;
  });

  // ── Constructor ──────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('throws when GCS_BUCKET_CAPSULES is not set', () => {
      delete process.env.GCS_BUCKET_CAPSULES;
      expect(() => new GcsStorageService()).toThrow(
        'GCS_BUCKET_CAPSULES environment variable is required',
      );
    });

    it('initialises without error when bucket env is present', () => {
      expect(() => makeService()).not.toThrow();
    });
  });

  // ── upload ───────────────────────────────────────────────────────────────

  describe('upload', () => {
    it('saves buffer to GCS and returns UploadResult', async () => {
      mockSave.mockResolvedValue(undefined);
      const buffer = Buffer.from('audio data');
      const storagePath = 'capsules/cap-1/audio.mp3';

      const result = await service.upload(buffer, storagePath, 'audio/mpeg');

      expect(mockBucket).toHaveBeenCalledWith(BUCKET);
      expect(mockFile).toHaveBeenCalledWith(storagePath);
      expect(mockSave).toHaveBeenCalledWith(buffer, {
        contentType: 'audio/mpeg',
        resumable: false,
      });
      expect(result).toEqual({
        path: storagePath,
        url: `gs://${BUCKET}/${storagePath}`,
        contentType: 'audio/mpeg',
        sizeBytes: buffer.length,
      });
    });

    it('throws when save fails', async () => {
      mockSave.mockRejectedValue(new Error('GCS network error'));

      await expect(
        service.upload(Buffer.from('x'), 'capsules/x.mp3', 'audio/mpeg'),
      ).rejects.toThrow('GCS upload failed');
    });
  });

  // ── getSignedUrl ─────────────────────────────────────────────────────────

  describe('getSignedUrl', () => {
    it('returns the signed URL from GCS', async () => {
      mockGetSignedUrl.mockResolvedValue(['https://signed.googleapis.com/audio.mp3']);

      const url = await service.getSignedUrl('capsules/cap-1/audio.mp3');

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'read' }),
      );
      expect(url).toBe('https://signed.googleapis.com/audio.mp3');
    });

    it('uses custom expiry when provided', async () => {
      mockGetSignedUrl.mockResolvedValue(['https://signed.url']);
      const spy = mockGetSignedUrl;

      await service.getSignedUrl('capsules/cap-1/audio.mp3', 30);

      const call = spy.mock.calls[0][0] as { expires: number };
      // expiry should be approximately now + 30 * 60 * 1000 ms
      const expectedExpiry = Date.now() + 30 * 60 * 1000;
      expect(call.expires).toBeGreaterThan(expectedExpiry - 5000);
      expect(call.expires).toBeLessThan(expectedExpiry + 5000);
    });

    it('throws when getSignedUrl fails', async () => {
      mockGetSignedUrl.mockRejectedValue(new Error('Permission denied'));

      await expect(
        service.getSignedUrl('capsules/cap-1/audio.mp3'),
      ).rejects.toThrow('GCS signed URL generation failed');
    });
  });

  // ── delete ───────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('calls GCS delete with ignoreNotFound flag', async () => {
      mockDelete.mockResolvedValue(undefined);

      await service.delete('capsules/cap-1/audio.mp3');

      expect(mockDelete).toHaveBeenCalledWith({ ignoreNotFound: true });
    });

    it('throws when delete fails', async () => {
      mockDelete.mockRejectedValue(new Error('Access denied'));

      await expect(service.delete('capsules/cap-1/audio.mp3')).rejects.toThrow(
        'GCS delete failed',
      );
    });
  });
});
