const mockPostRender = jest.fn();
const mockGetRender = jest.fn();

jest.mock('shotstack-sdk', () => {
  const actual = jest.requireActual('shotstack-sdk');
  return {
    ...actual,
    ApiClient: {
      instance: {
        authentications: { DeveloperKey: { apiKey: '' } },
        basePath: '',
      },
    },
    EditApi: jest.fn().mockImplementation(() => ({
      postRender: mockPostRender,
      getRender: mockGetRender,
    })),
  };
});

import { ShotstackRendererService } from '../../../../../../src/modules/capsules/infrastructure/services/shotstack-renderer.service';

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

  describe('renderVideo()', () => {
    it('submits a render and returns the render ID', async () => {
      mockPostRender.mockResolvedValue({
        response: { id: 'render-123', status: 'queued' },
      });

      const renderId = await service.renderVideo({
        scenes: [
          {
            textToNarrate: 'Welcome',
            visualPrompt: 'office',
            titleOverlay: 'Welcome',
            imageUrl: 'https://gcs.example.com/img1.png',
          },
        ],
        audioUrl: 'https://gcs.example.com/audio.mp3',
      });

      expect(renderId).toBe('render-123');
      expect(mockPostRender).toHaveBeenCalledTimes(1);
    });

    it('throws when API fails', async () => {
      mockPostRender.mockRejectedValue(new Error('API error'));

      await expect(
        service.renderVideo({
          scenes: [
            {
              textToNarrate: 'Hi',
              visualPrompt: 'img',
              titleOverlay: 'Title',
              imageUrl: 'https://example.com/img.png',
            },
          ],
          audioUrl: 'https://example.com/audio.mp3',
        }),
      ).rejects.toThrow('Shotstack render submission failed');
    });
  });

  describe('getRenderStatus()', () => {
    it('returns done with URL when render is complete', async () => {
      mockGetRender.mockResolvedValue({
        response: { status: 'done', url: 'https://cdn.shotstack.io/video.mp4' },
      });

      const status = await service.getRenderStatus('render-123');

      expect(status.status).toBe('done');
      expect(status.url).toBe('https://cdn.shotstack.io/video.mp4');
    });

    it('returns rendering status when in progress', async () => {
      mockGetRender.mockResolvedValue({
        response: { status: 'rendering' },
      });

      const status = await service.getRenderStatus('render-123');

      expect(status.status).toBe('rendering');
      expect(status.url).toBeUndefined();
    });

    it('returns failed status with error', async () => {
      mockGetRender.mockResolvedValue({
        response: { status: 'failed', error: 'Render timeout' },
      });

      const status = await service.getRenderStatus('render-123');

      expect(status.status).toBe('failed');
      expect(status.errorMessage).toBe('Render timeout');
    });
  });

  it('throws if SHOTSTACK_API_KEY is not set', () => {
    delete process.env.SHOTSTACK_API_KEY;
    expect(() => new ShotstackRendererService()).toThrow('SHOTSTACK_API_KEY');
  });
});
