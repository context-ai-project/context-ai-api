jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(),
}));

import { Imagen3ImageGeneratorService } from '../../../../../../src/modules/capsules/infrastructure/services/imagen3-image-generator.service';
import { GoogleGenAI } from '@google/genai';

describe('Imagen3ImageGeneratorService', () => {
  let service: Imagen3ImageGeneratorService;
  let sleepSpy: jest.SpyInstance;
  const mockGenerateImages = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GCP_PROJECT_ID = 'test-project';

    (GoogleGenAI as jest.Mock).mockImplementation(() => ({
      models: { generateImages: mockGenerateImages },
    }));

    service = new Imagen3ImageGeneratorService();
    sleepSpy = jest
      .spyOn(service as never, 'sleep' as never)
      .mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    delete process.env.GCP_PROJECT_ID;
  });

  it('generates an image buffer from a prompt', async () => {
    const fakeBase64 = Buffer.from('fake-png-data').toString('base64');
    mockGenerateImages.mockResolvedValue({
      generatedImages: [{ image: { imageBytes: fakeBase64 } }],
    });

    const result = await service.generateImage('modern office building');

    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString()).toBe('fake-png-data');
    expect(mockGenerateImages).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.stringContaining('imagen'),
        prompt: expect.stringContaining('modern office building'),
      }),
    );
  });

  it('throws when no images are returned', async () => {
    mockGenerateImages.mockResolvedValue({ generatedImages: [] });

    await expect(service.generateImage('test prompt')).rejects.toThrow(
      'No image generated',
    );
  });

  it('throws on non-rate-limit errors without retrying', async () => {
    mockGenerateImages.mockRejectedValue(new Error('Internal server error'));

    await expect(service.generateImage('test prompt')).rejects.toThrow(
      'Image generation failed',
    );
    expect(mockGenerateImages).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 RESOURCE_EXHAUSTED and succeeds on next attempt', async () => {
    const fakeBase64 = Buffer.from('retry-success').toString('base64');
    mockGenerateImages
      .mockRejectedValueOnce(
        new Error('429 RESOURCE_EXHAUSTED: Quota exceeded'),
      )
      .mockResolvedValueOnce({
        generatedImages: [{ image: { imageBytes: fakeBase64 } }],
      });

    const result = await service.generateImage('office scene');

    expect(result.toString()).toBe('retry-success');
    expect(mockGenerateImages).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalled();
  });

  it('throws after exhausting all 429 retries', async () => {
    mockGenerateImages.mockRejectedValue(
      new Error('429 RESOURCE_EXHAUSTED: Quota exceeded'),
    );

    await expect(service.generateImage('test prompt')).rejects.toThrow(
      'Image generation failed',
    );
    // 1 initial + 3 retries = 4 API calls
    expect(mockGenerateImages).toHaveBeenCalledTimes(4);
  });

  it('pauses when RPM limit (5/min) is reached before the 6th request', async () => {
    const fakeBase64 = Buffer.from('img').toString('base64');
    mockGenerateImages.mockResolvedValue({
      generatedImages: [{ image: { imageBytes: fakeBase64 } }],
    });

    for (let i = 0; i < 6; i++) {
      await service.generateImage(`scene ${i}`);
    }

    // The rate limiter pauses with a wait > 30s (RPM cooldown)
    const rpmPauseCalls = sleepSpy.mock.calls.filter(
      ([ms]: [number]) => ms > 30_000,
    );
    expect(rpmPauseCalls.length).toBeGreaterThanOrEqual(1);
    expect(mockGenerateImages).toHaveBeenCalledTimes(6);
  });
});
