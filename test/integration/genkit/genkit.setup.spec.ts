import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { genkit, GENKIT_CONFIG } from '@shared/genkit/genkit.config';

describe('Genkit Setup Integration Tests', () => {
  let ai: ReturnType<typeof genkit>;

  beforeAll(() => {
    // Ensure required environment variables are set
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error(
        'GOOGLE_API_KEY environment variable is required for Genkit tests',
      );
    }
    ai = genkit();
  });

  afterAll(() => {
    // Clean up any pending operations
    jest.clearAllTimers();
  });

  describe('Configuration', () => {
    it('should initialize Genkit successfully', () => {
      expect(ai).toBeDefined();
      expect(GENKIT_CONFIG.LLM_MODEL).toBe('googleai/gemini-1.5-pro');
      expect(GENKIT_CONFIG.EMBEDDING_MODEL).toBe(
        'googleai/gemini-embedding-001',
      );
      expect(GENKIT_CONFIG.EMBEDDING_DIMENSIONS).toBe(768);
    });
  });

  describe('Basic Connectivity', () => {
    it('should generate text with Gemini', async () => {
      const result = await ai.generate({
        model: GENKIT_CONFIG.LLM_MODEL,
        prompt: 'Say "OK" in one word.',
        config: {
          temperature: 0,
          maxOutputTokens: 5,
        },
      });

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(typeof result.text).toBe('string');
      expect(result.text.length).toBeGreaterThan(0);
    }, 15000); // Reduced timeout

    it('should generate embeddings with correct dimensions', async () => {
      const result = await ai.embed({
        embedder: GENKIT_CONFIG.EMBEDDING_MODEL,
        content: 'Test embedding',
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(GENKIT_CONFIG.EMBEDDING_DIMENSIONS);
      expect(typeof result[0]).toBe('number');
    }, 15000); // Reduced timeout
  });
});

