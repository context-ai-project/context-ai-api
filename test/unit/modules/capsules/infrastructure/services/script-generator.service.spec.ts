jest.mock('@shared/genkit/capsules-genkit.config', () => ({
  getCapsuleGenkitInstance: jest.fn(),
}));

import { ScriptGeneratorService } from '../../../../../../src/modules/capsules/infrastructure/services/script-generator.service';
import { getCapsuleGenkitInstance } from '../../../../../../src/shared/genkit/capsules-genkit.config';

const mockVectorStore = {
  vectorSearch: jest.fn(),
};

const mockEmbeddingService = {
  generateEmbedding: jest.fn(),
};

const mockGenerate = jest.fn();

describe('ScriptGeneratorService', () => {
  let service: ScriptGeneratorService;

  beforeEach(() => {
    jest.clearAllMocks();
    (getCapsuleGenkitInstance as jest.Mock).mockReturnValue({
      generate: mockGenerate,
    });
    service = new ScriptGeneratorService(
      mockVectorStore as never,
      mockEmbeddingService as never,
    );
  });

  describe('generate() — audio script', () => {
    it('generates a plain-text script for audio capsules', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2]);
      mockVectorStore.vectorSearch.mockResolvedValue([
        {
          metadata: {
            sourceId: 'src-1',
            content: 'Important document content.',
          },
        },
      ]);
      mockGenerate
        .mockResolvedValueOnce({ text: 'A well-crafted audio script.' })
        .mockResolvedValueOnce({ text: 'Short description.' });

      const result = await service.generate({
        sourceIds: ['src-1'],
        sectorId: 'sector-1',
        introText: 'Introduction text',
      });

      expect(result.script).toBe('A well-crafted audio script.');
      expect(result.description).toBe('Short description.');
      expect(mockGenerate).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateVideoScript() — structured scenes', () => {
    const VALID_SCENES = [
      {
        textToNarrate: 'Welcome to the company',
        visualPrompt: 'modern office building',
        titleOverlay: 'Welcome',
      },
      {
        textToNarrate: 'Here are your benefits',
        visualPrompt: 'team celebrating together',
        titleOverlay: 'Benefits',
      },
    ];

    it('generates structured scenes JSON and a description', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2]);
      mockVectorStore.vectorSearch.mockResolvedValue([
        {
          metadata: {
            sourceId: 'src-1',
            content: 'Company benefits overview.',
          },
        },
      ]);
      mockGenerate
        .mockResolvedValueOnce({ text: JSON.stringify(VALID_SCENES) })
        .mockResolvedValueOnce({ text: 'Video about company benefits.' });

      const result = await service.generateVideoScript({
        sourceIds: ['src-1'],
        sectorId: 'sector-1',
        introText: 'Welcome video',
      });

      expect(result.scenes).toHaveLength(2);
      expect(result.scenes[0].textToNarrate).toBe('Welcome to the company');
      expect(result.scenes[0].visualPrompt).toBe('modern office building');
      expect(result.scriptJson).toBe(JSON.stringify(VALID_SCENES));
      expect(result.description).toBe('Video about company benefits.');
    });

    it('throws when LLM returns invalid scenes JSON', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2]);
      mockVectorStore.vectorSearch.mockResolvedValue([]);
      mockGenerate.mockResolvedValueOnce({ text: 'not valid JSON' });

      await expect(
        service.generateVideoScript({
          sourceIds: ['src-1'],
          sectorId: 'sector-1',
        }),
      ).rejects.toThrow('Failed to generate video script');
    });

    it('throws when LLM returns empty scenes array', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2]);
      mockVectorStore.vectorSearch.mockResolvedValue([]);
      mockGenerate.mockResolvedValueOnce({ text: '[]' });

      await expect(
        service.generateVideoScript({
          sourceIds: ['src-1'],
          sectorId: 'sector-1',
        }),
      ).rejects.toThrow('Failed to generate video script');
    });
  });
});
