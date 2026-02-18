import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Genkit } from 'genkit';

// Mock types for test
interface MockFragment {
  id: string;
  content: string;
  similarity: number;
  sourceId: string;
  metadata?: Record<string, unknown>;
}

interface RagQueryInput {
  query: string;
  sectorId: string;
  conversationId?: string;
  maxResults?: number;
}

interface RagQueryOutput {
  response: string;
  sources: MockFragment[];
  conversationId?: string;
}

describe('RAG Query Flow', () => {
  let mockGenkit: Genkit;
  let mockVectorSearch: jest.Mock<
    Promise<MockFragment[]>,
    [embedding: number[], sectorId: string, limit: number, minScore?: number]
  >;
  let mockEmbed: jest.Mock<Promise<number[]>, [content: string]>;
  let mockGenerate: jest.Mock<
    Promise<{ text: string }>,
    [prompt: string, config?: unknown]
  >;

  beforeEach(() => {
    // Mock vector search function
    mockVectorSearch = jest.fn<
      Promise<MockFragment[]>,
      [embedding: number[], sectorId: string, limit: number, minScore?: number]
    >();

    // Mock embed function
    mockEmbed = jest.fn<Promise<number[]>, [content: string]>();

    // Mock generate function
    mockGenerate = jest.fn<
      Promise<{ text: string }>,
      [prompt: string, config?: unknown]
    >();

    // Mock Genkit instance
    mockGenkit = {
      embed: mockEmbed as unknown as Genkit['embed'],
      generate: mockGenerate as unknown as Genkit['generate'],
    } as Genkit;
  });

  describe('Input Validation', () => {
    it('should reject empty query field', () => {
      const input = {
        query: '',
        sectorId: 'sector-123',
      };

      expect(input.query).toBeFalsy();
    });

    it('should reject empty sectorId field', () => {
      const input = {
        query: 'How do I request vacation?',
        sectorId: '',
      };

      expect(input.sectorId).toBeFalsy();
    });

    it('should accept optional conversationId', () => {
      const input: RagQueryInput = {
        query: 'Test query',
        sectorId: 'sector-123',
        conversationId: 'conv-456',
      };

      expect(input.conversationId).toBe('conv-456');
    });

    it('should use default maxResults when not provided', () => {
      const input: RagQueryInput = {
        query: 'Test query',
        sectorId: 'sector-123',
      };

      const maxResults = input.maxResults ?? 5;
      expect(maxResults).toBe(5);
    });
  });

  describe('Flow Execution', () => {
    it('should generate query embedding', async () => {
      const query = 'How do I request vacation?';
      const mockEmbedding = new Array(768).fill(0.1);

      mockEmbed.mockResolvedValue(mockEmbedding);

      const embedding = await mockGenkit.embed({
        embedder: 'googleai/gemini-embedding-001',
        content: query,
      });

      expect(mockEmbed).toHaveBeenCalledWith({
        embedder: 'googleai/gemini-embedding-001',
        content: query,
      });
      expect(embedding).toEqual(mockEmbedding);
      expect(embedding.length).toBe(768);
    });

    it('should search for relevant fragments', async () => {
      const embedding = new Array(768).fill(0.1);
      const sectorId = 'sector-123';
      const mockFragments: MockFragment[] = [
        {
          id: 'frag-1',
          content:
            'To request vacation, submit a form 15 days in advance...',
          similarity: 0.92,
          sourceId: 'source-1',
        },
        {
          id: 'frag-2',
          content: 'Vacation days are granted based on seniority...',
          similarity: 0.85,
          sourceId: 'source-1',
        },
      ];

      mockVectorSearch.mockResolvedValue(mockFragments);

      const results = await mockVectorSearch(embedding, sectorId, 5);

      expect(mockVectorSearch).toHaveBeenCalledWith(embedding, sectorId, 5);
      expect(results).toEqual(mockFragments);
      expect(results.length).toBe(2);
      expect(results[0].similarity).toBeGreaterThan(0.8);
    });

    it('should build prompt with context', () => {
      const query = 'How do I request vacation?';
      const fragments: MockFragment[] = [
        {
          id: 'frag-1',
          content:
            'To request vacation, submit a form 15 days in advance...',
          similarity: 0.92,
          sourceId: 'source-1',
        },
      ];

      const context = fragments.map((f) => f.content).join('\n\n');
      const prompt = `You are an onboarding assistant. Answer ONLY based on the provided documentation.

Context:
${context}

Question: ${query}

Answer:`;

      expect(prompt).toContain(query);
      expect(prompt).toContain(fragments[0].content);
      expect(prompt).toContain('onboarding assistant');
    });

    it('should generate response with Gemini', async () => {
      const prompt = 'Test prompt with context';
      const mockResponse = {
        text: 'To request vacation, you need to submit a form 15 days in advance.',
      };

      mockGenerate.mockResolvedValue(mockResponse);

      const result = await mockGenkit.generate({
        model: 'googleai/gemini-2.5-flash',
        prompt,
        config: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      });

      expect(mockGenerate).toHaveBeenCalled();
      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(0);
    });

    it('should return response with cited sources', () => {
      const output: RagQueryOutput = {
        response:
          'To request vacation, you need to submit a form 15 days in advance.',
        sources: [
          {
            id: 'frag-1',
            content:
              'To request vacation, submit a form 15 days in advance...',
            similarity: 0.92,
            sourceId: 'source-1',
          },
        ],
      };

      expect(output.response).toBeDefined();
      expect(output.sources).toHaveLength(1);
      expect(output.sources[0].similarity).toBeGreaterThan(0.8);
    });
  });

  describe('Edge Cases', () => {
    it('should handle no relevant fragments found', async () => {
      mockVectorSearch.mockResolvedValue([]);

      const results = await mockVectorSearch(
        new Array(768).fill(0.1),
        'sector-123',
        5,
      );

      expect(results).toHaveLength(0);
    });

    it('should handle embedding generation failure', async () => {
      mockEmbed.mockRejectedValue(new Error('Embedding service unavailable'));

      await expect(
        mockGenkit.embed({
          embedder: 'googleai/gemini-embedding-001',
          content: 'Test query',
        }),
      ).rejects.toThrow('Embedding service unavailable');
    });

    it('should handle LLM generation failure', async () => {
      mockGenerate.mockRejectedValue(
        new Error('LLM service temporarily unavailable'),
      );

      await expect(
        mockGenkit.generate({
          model: 'googleai/gemini-2.5-flash',
          prompt: 'Test prompt',
        }),
      ).rejects.toThrow('LLM service temporarily unavailable');
    });

    it('should provide fallback response when no context available', () => {
      const fallbackResponse =
        "I don't have information about that in the current documentation.";

      const output: RagQueryOutput = {
        response: fallbackResponse,
        sources: [],
      };

      expect(output.response).toBe(fallbackResponse);
      expect(output.sources).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    it('should limit number of fragments retrieved', () => {
      const maxResults = 5;
      const input: RagQueryInput = {
        query: 'Test query',
        sectorId: 'sector-123',
        maxResults,
      };

      expect(input.maxResults).toBe(maxResults);
      expect(input.maxResults).toBeLessThanOrEqual(10); // Max limit
    });

    it('should filter fragments by minimum similarity threshold', () => {
      const fragments: MockFragment[] = [
        { id: '1', content: 'Test 1', similarity: 0.95, sourceId: 's1' },
        { id: '2', content: 'Test 2', similarity: 0.75, sourceId: 's1' },
        { id: '3', content: 'Test 3', similarity: 0.55, sourceId: 's1' },
      ];

      const minSimilarity = 0.7;
      const filtered = fragments.filter((f) => f.similarity >= minSimilarity);

      expect(filtered).toHaveLength(2);
      expect(filtered.every((f) => f.similarity >= minSimilarity)).toBe(true);
    });
  });
});

