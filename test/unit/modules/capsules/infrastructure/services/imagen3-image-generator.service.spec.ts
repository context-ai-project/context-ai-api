jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(),
}));

import { Imagen3ImageGeneratorService } from '../../../../../../src/modules/capsules/infrastructure/services/imagen3-image-generator.service';
import { GoogleGenAI } from '@google/genai';

describe('Imagen3ImageGeneratorService', () => {
  let service: Imagen3ImageGeneratorService;
  const mockGenerateImages = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_CAPSULES_API_KEY = 'test-api-key';

    (GoogleGenAI as jest.Mock).mockImplementation(() => ({
      models: { generateImages: mockGenerateImages },
    }));

    service = new Imagen3ImageGeneratorService();
  });

  afterEach(() => {
    delete process.env.GOOGLE_CAPSULES_API_KEY;
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
        prompt: 'modern office building',
      }),
    );
  });

  it('throws when no images are returned', async () => {
    mockGenerateImages.mockResolvedValue({ generatedImages: [] });

    await expect(service.generateImage('test prompt')).rejects.toThrow(
      'No image generated',
    );
  });

  it('throws when API call fails', async () => {
    mockGenerateImages.mockRejectedValue(new Error('API rate limit'));

    await expect(service.generateImage('test prompt')).rejects.toThrow(
      'Image generation failed',
    );
  });

  it('throws if GOOGLE_CAPSULES_API_KEY is not set', () => {
    delete process.env.GOOGLE_CAPSULES_API_KEY;
    expect(() => new Imagen3ImageGeneratorService()).toThrow(
      'GOOGLE_CAPSULES_API_KEY',
    );
  });
});
