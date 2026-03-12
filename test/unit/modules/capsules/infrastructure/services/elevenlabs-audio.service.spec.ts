import { ElevenLabsAudioService } from '../../../../../../src/modules/capsules/infrastructure/services/elevenlabs-audio.service';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const API_KEY = 'test-elevenlabs-key';

function makeService(): ElevenLabsAudioService {
  process.env.ELEVENLABS_API_KEY = API_KEY;
  return new ElevenLabsAudioService();
}

/** Build a fake fetch Response */
function fakeResponse(body: unknown, status = 200): Response {
  const isBuffer = Buffer.isBuffer(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body as unknown,
    text: async () => (isBuffer ? '' : JSON.stringify(body)),
    arrayBuffer: async () => {
      const buf = isBuffer ? body : Buffer.from(JSON.stringify(body as object));
      return (buf as Buffer).buffer.slice(
        (buf as Buffer).byteOffset,
        (buf as Buffer).byteOffset + (buf as Buffer).byteLength,
      );
    },
  } as unknown as Response;
}

describe('ElevenLabsAudioService', () => {
  let service: ElevenLabsAudioService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();
  });

  afterEach(() => {
    delete process.env.ELEVENLABS_API_KEY;
  });

  // ── Constructor ────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('throws when ELEVENLABS_API_KEY is not set', () => {
      delete process.env.ELEVENLABS_API_KEY;
      expect(() => new ElevenLabsAudioService()).toThrow(
        'ELEVENLABS_API_KEY environment variable is required',
      );
    });
  });

  // ── generateAudio ──────────────────────────────────────────────────────────

  describe('generateAudio', () => {
    it('generates audio for short text and returns AudioResult', async () => {
      const fakeAudioBuffer = Buffer.alloc(32_000); // ~2s at 16000 bytes/s
      mockFetch.mockResolvedValue(fakeResponse(fakeAudioBuffer));

      const result = await service.generateAudio('Hello world.', { voiceId: 'voice-1' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/text-to-speech/voice-1'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'xi-api-key': API_KEY }),
        }),
      );
      expect(result.contentType).toBe('audio/mpeg');
      expect(result.durationSeconds).toBe(2);
      expect(result.audioBuffer.length).toBe(32_000);
    });

    it('calls onChunkProgress callback for each chunk', async () => {
      const fakeAudio = Buffer.alloc(16_000);
      mockFetch.mockResolvedValue(fakeResponse(fakeAudio));

      const progressCalls: [number, number][] = [];
      await service.generateAudio('Short text.', { voiceId: 'v1' }, async (done, total) => {
        progressCalls.push([done, total]);
      });

      expect(progressCalls).toEqual([[1, 1]]);
    });

    it('throws when text is empty', async () => {
      await expect(service.generateAudio('', { voiceId: 'v1' })).rejects.toThrow(
        'Text is required',
      );
    });

    it('throws when text is whitespace only', async () => {
      await expect(service.generateAudio('   ', { voiceId: 'v1' })).rejects.toThrow(
        'Text is required',
      );
    });

    it('throws when voiceId is missing', async () => {
      await expect(service.generateAudio('text', { voiceId: '' })).rejects.toThrow(
        'voiceId is required',
      );
    });

    it('throws when ElevenLabs returns non-200 status', async () => {
      mockFetch.mockResolvedValue(fakeResponse({ detail: 'Unauthorized' }, 401));

      await expect(
        service.generateAudio('text', { voiceId: 'v1' }),
      ).rejects.toThrow('ElevenLabs audio generation failed');
    });
  });

  // ── getAvailableVoices ─────────────────────────────────────────────────────

  describe('getAvailableVoices', () => {
    it('maps voice list from API response', async () => {
      mockFetch.mockResolvedValue(
        fakeResponse({
          voices: [
            {
              voice_id: 'v1',
              name: 'Alice',
              category: 'premade',
              description: 'English female',
              preview_url: 'https://preview.url',
              labels: { accent: 'american' },
            },
          ],
        }),
      );

      const voices = await service.getAvailableVoices();

      expect(voices).toHaveLength(1);
      expect(voices[0]).toMatchObject({
        id: 'v1',
        name: 'Alice',
        category: 'premade',
        description: 'English female',
        previewUrl: 'https://preview.url',
        labels: { accent: 'american' },
      });
    });

    it('throws when API returns non-200', async () => {
      mockFetch.mockResolvedValue(fakeResponse('Forbidden', 403));

      await expect(service.getAvailableVoices()).rejects.toThrow(
        'Failed to fetch ElevenLabs voices',
      );
    });
  });

  // ── searchSharedVoices ─────────────────────────────────────────────────────

  describe('searchSharedVoices', () => {
    it('builds correct query URL and maps response', async () => {
      mockFetch.mockResolvedValue(
        fakeResponse({
          voices: [
            {
              voice_id: 'sv1',
              public_owner_id: 'owner-1',
              name: 'Maria',
              language: 'es',
              gender: 'female',
              accent: 'spanish',
              description: 'Spanish narrator',
              preview_url: 'https://preview',
              is_added_by_user: false,
            },
          ],
        }),
      );

      const results = await service.searchSharedVoices('maria');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('shared-voices'),
        expect.anything(),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search=maria'),
        expect.anything(),
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        voiceId: 'sv1',
        publicOwnerId: 'owner-1',
        name: 'Maria',
        language: 'es',
        gender: 'female',
        isAddedByUser: false,
      });
    });

    it('throws when API returns non-200', async () => {
      mockFetch.mockResolvedValue(fakeResponse('Error', 500));

      await expect(service.searchSharedVoices('query')).rejects.toThrow(
        'Failed to search ElevenLabs shared voices',
      );
    });
  });
});
