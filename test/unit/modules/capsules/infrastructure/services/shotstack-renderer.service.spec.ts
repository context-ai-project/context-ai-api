import { ShotstackRendererService } from '../../../../../../src/modules/capsules/infrastructure/services/shotstack-renderer.service';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const SCENE = {
  textToNarrate: 'Hi',
  visualPrompt: 'office',
  titleOverlay: 'Slide 1',
  imageUrl: 'https://example.com/img.png',
};

const TIMELINE = {
  scenes: [SCENE],
  audioUrl: 'https://example.com/audio.mp3',
  audioDurationSeconds: 10,
};

function makeOkResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
    json: async () => body as unknown,
  } as unknown as Response;
}

function makeErrorResponse(status: number, body: string): Response {
  return {
    ok: false,
    status,
    statusText: String(status),
    text: async () => body,
    json: async () => ({ message: body }),
  } as unknown as Response;
}

describe('ShotstackRendererService', () => {
  let service: ShotstackRendererService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SHOTSTACK_API_KEY = 'test-key';
    process.env.SHOTSTACK_ENVIRONMENT = 'stage';
    service = new ShotstackRendererService();
  });

  afterEach(() => {
    delete process.env.SHOTSTACK_API_KEY;
    delete process.env.SHOTSTACK_ENVIRONMENT;
  });

  it('throws if SHOTSTACK_API_KEY is not set', () => {
    delete process.env.SHOTSTACK_API_KEY;
    expect(() => new ShotstackRendererService()).toThrow('SHOTSTACK_API_KEY');
  });

  // ── renderVideo ────────────────────────────────────────────────────────────

  describe('renderVideo()', () => {
    it('submits a render and returns the render ID', async () => {
      mockFetch.mockResolvedValue(
        makeOkResponse({ response: { id: 'render-123', status: 'queued' } }),
      );

      const renderId = await service.renderVideo(TIMELINE);

      expect(renderId).toBe('render-123');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/render'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'x-api-key': 'test-key' }),
        }),
      );
    });

    it('throws when API returns non-2xx status', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(403, 'Forbidden'));

      await expect(service.renderVideo(TIMELINE)).rejects.toThrow(
        'Shotstack render submission failed',
      );
    });

    it('throws when API returns no render ID', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ response: {} }));

      await expect(service.renderVideo(TIMELINE)).rejects.toThrow(
        'no render ID',
      );
    });
  });

  // ── getRenderStatus ────────────────────────────────────────────────────────

  describe('getRenderStatus()', () => {
    it('returns done with URL when render is complete', async () => {
      mockFetch.mockResolvedValue(
        makeOkResponse({
          response: { status: 'done', url: 'https://cdn.shotstack.io/video.mp4' },
        }),
      );

      const status = await service.getRenderStatus('render-123');

      expect(status.status).toBe('done');
      expect(status.url).toBe('https://cdn.shotstack.io/video.mp4');
    });

    it('returns rendering status when in progress', async () => {
      mockFetch.mockResolvedValue(
        makeOkResponse({ response: { status: 'rendering' } }),
      );

      const status = await service.getRenderStatus('render-123');

      expect(status.status).toBe('rendering');
      expect(status.url).toBeUndefined();
    });

    it('returns failed status with error message from response body', async () => {
      mockFetch.mockResolvedValue(
        makeOkResponse({
          response: { status: 'failed', error: 'Render timeout' },
        }),
      );

      const status = await service.getRenderStatus('render-123');

      expect(status.status).toBe('failed');
      expect(status.errorMessage).toBe('Render timeout');
    });

    it('returns failed status when API responds with non-2xx', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(403, 'Forbidden'));

      const status = await service.getRenderStatus('render-123');

      expect(status.status).toBe('failed');
      expect(status.errorMessage).toMatch(/403/);
    });
  });
});
