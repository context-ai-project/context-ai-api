import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Genkit } from 'genkit';
import {
  createRagEvaluatorService,
  type RagEvaluatorService,
  EVALUATION_CONFIG,
} from '@shared/genkit/evaluators';

/**
 * Type for mock generate function
 */
type MockGenerateFn = jest.Mock<
  Promise<{ text: string; output: unknown }>,
  [params: unknown]
>;

describe('RagEvaluatorService', () => {
  let mockGenerate: MockGenerateFn;
  let mockAi: Genkit;
  let evaluator: RagEvaluatorService;

  const sampleFaithfulScore = {
    score: 0.9,
    status: 'PASS' as const,
    reasoning: 'Response accurately reflects the provided context.',
  };

  const sampleRelevancyScore = {
    score: 0.85,
    status: 'PASS' as const,
    reasoning: 'Response directly addresses the user question.',
  };

  beforeEach(() => {
    mockGenerate = jest.fn<
      Promise<{ text: string; output: unknown }>,
      [params: unknown]
    >();

    mockAi = {
      generate: mockGenerate as unknown as Genkit['generate'],
    } as Genkit;

    evaluator = createRagEvaluatorService(mockAi);
  });

  describe('evaluate', () => {
    it('should evaluate both faithfulness and relevancy in parallel', async () => {
      // First call = faithfulness, second call = relevancy
      mockGenerate
        .mockResolvedValueOnce({
          text: JSON.stringify(sampleFaithfulScore),
          output: sampleFaithfulScore,
        })
        .mockResolvedValueOnce({
          text: JSON.stringify(sampleRelevancyScore),
          output: sampleRelevancyScore,
        });

      const result = await evaluator.evaluate({
        query: 'How do I request vacation?',
        response:
          'Submit a vacation request at least 15 days in advance through the HR portal.',
        context: [
          'Vacation policy: All employees must submit vacation requests at least 15 days in advance via the HR portal.',
        ],
      });

      expect(result.faithfulness).toEqual(sampleFaithfulScore);
      expect(result.relevancy).toEqual(sampleRelevancyScore);
      expect(mockGenerate).toHaveBeenCalledTimes(2);
    });

    it('should call generate with correct faithfulness prompt structure', async () => {
      mockGenerate.mockResolvedValue({
        text: JSON.stringify(sampleFaithfulScore),
        output: sampleFaithfulScore,
      });

      await evaluator.evaluate({
        query: 'What is the dress code?',
        response: 'Business casual is required.',
        context: ['Dress code: Business casual is required at all times.'],
      });

      const firstCallArgs = mockGenerate.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const prompt = firstCallArgs.prompt as string;

      // Faithfulness prompt should contain the context, query, and response
      expect(prompt).toContain('FAITHFULNESS');
      expect(prompt).toContain('What is the dress code?');
      expect(prompt).toContain('Business casual is required.');
      expect(prompt).toContain(
        'Dress code: Business casual is required at all times.',
      );
    });

    it('should call generate with correct relevancy prompt structure', async () => {
      mockGenerate.mockResolvedValue({
        text: JSON.stringify(sampleRelevancyScore),
        output: sampleRelevancyScore,
      });

      await evaluator.evaluate({
        query: 'What is the dress code?',
        response: 'Business casual is required.',
        context: ['Dress code: Business casual is required at all times.'],
      });

      const secondCallArgs = mockGenerate.mock.calls[1][0] as Record<
        string,
        unknown
      >;
      const prompt = secondCallArgs.prompt as string;

      // Relevancy prompt should contain the query and response but focus on relevancy
      expect(prompt).toContain('RELEVANCY');
      expect(prompt).toContain('What is the dress code?');
      expect(prompt).toContain('Business casual is required.');
    });

    it('should use low temperature for evaluator consistency', async () => {
      mockGenerate.mockResolvedValue({
        text: JSON.stringify(sampleFaithfulScore),
        output: sampleFaithfulScore,
      });

      await evaluator.evaluate({
        query: 'Test query',
        response: 'Test response',
        context: ['Test context'],
      });

      const firstCallArgs = mockGenerate.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const config = firstCallArgs.config as Record<string, unknown>;

      expect(config.temperature).toBe(EVALUATION_CONFIG.EVALUATOR_TEMPERATURE);
      expect(config.maxOutputTokens).toBe(
        EVALUATION_CONFIG.EVALUATOR_MAX_TOKENS,
      );
    });

    it('should parse JSON from response text with Zod validation', async () => {
      mockGenerate.mockResolvedValue({
        text: JSON.stringify(sampleFaithfulScore),
        output: null,
      });

      const result = await evaluator.evaluate({
        query: 'Test query',
        response: 'Test response',
        context: ['Test context'],
      });

      // Validates that the response text is parsed correctly
      expect(result.faithfulness.score).toBe(sampleFaithfulScore.score);
      expect(result.faithfulness.status).toBe(sampleFaithfulScore.status);
      expect(result.faithfulness.reasoning).toBe(
        sampleFaithfulScore.reasoning,
      );
    });
  });

  describe('error handling', () => {
    it('should return UNKNOWN status when faithfulness evaluation fails', async () => {
      // First call (faithfulness) fails, second call (relevancy) succeeds
      mockGenerate
        .mockRejectedValueOnce(new Error('LLM service unavailable'))
        .mockResolvedValueOnce({
          text: JSON.stringify(sampleRelevancyScore),
          output: sampleRelevancyScore,
        });

      const result = await evaluator.evaluate({
        query: 'Test query',
        response: 'Test response',
        context: ['Test context'],
      });

      expect(result.faithfulness.status).toBe('UNKNOWN');
      expect(result.faithfulness.score).toBe(0);
      expect(result.faithfulness.reasoning).toContain('Evaluation failed');
      expect(result.faithfulness.reasoning).toContain(
        'LLM service unavailable',
      );

      // Relevancy should still succeed
      expect(result.relevancy).toEqual(sampleRelevancyScore);
    });

    it('should return UNKNOWN status when relevancy evaluation fails', async () => {
      // First call (faithfulness) succeeds, second call (relevancy) fails
      mockGenerate
        .mockResolvedValueOnce({
          text: JSON.stringify(sampleFaithfulScore),
          output: sampleFaithfulScore,
        })
        .mockRejectedValueOnce(new Error('Rate limit exceeded'));

      const result = await evaluator.evaluate({
        query: 'Test query',
        response: 'Test response',
        context: ['Test context'],
      });

      expect(result.faithfulness).toEqual(sampleFaithfulScore);

      expect(result.relevancy.status).toBe('UNKNOWN');
      expect(result.relevancy.score).toBe(0);
      expect(result.relevancy.reasoning).toContain('Evaluation failed');
    });

    it('should return UNKNOWN for both when both evaluations fail', async () => {
      mockGenerate.mockRejectedValue(new Error('Service down'));

      const result = await evaluator.evaluate({
        query: 'Test query',
        response: 'Test response',
        context: ['Test context'],
      });

      expect(result.faithfulness.status).toBe('UNKNOWN');
      expect(result.relevancy.status).toBe('UNKNOWN');
    });

    it('should handle empty text response gracefully', async () => {
      mockGenerate.mockResolvedValue({
        text: '',
        output: null,
      });

      const result = await evaluator.evaluate({
        query: 'Test query',
        response: 'Test response',
        context: ['Test context'],
      });

      // Empty text can't be parsed as JSON, so it should return UNKNOWN
      expect(result.faithfulness.status).toBe('UNKNOWN');
      expect(result.faithfulness.reasoning).toContain('Evaluation failed');
    });

    it('should handle non-Error exceptions gracefully', async () => {
      mockGenerate.mockRejectedValue('string error');

      const result = await evaluator.evaluate({
        query: 'Test query',
        response: 'Test response',
        context: ['Test context'],
      });

      expect(result.faithfulness.status).toBe('UNKNOWN');
      expect(result.faithfulness.reasoning).toContain(
        'Unknown evaluation error',
      );
    });
  });

  describe('multiple context documents', () => {
    it('should include all context documents in faithfulness prompt', async () => {
      mockGenerate.mockResolvedValue({
        text: JSON.stringify(sampleFaithfulScore),
        output: sampleFaithfulScore,
      });

      const contexts = [
        'Document 1: Vacation policy details...',
        'Document 2: Employee handbook section...',
        'Document 3: HR guidelines...',
      ];

      await evaluator.evaluate({
        query: 'How do I request vacation?',
        response: 'Follow the HR guidelines to submit your request.',
        context: contexts,
      });

      const firstCallArgs = mockGenerate.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const prompt = firstCallArgs.prompt as string;

      expect(prompt).toContain('[Document 1]');
      expect(prompt).toContain('[Document 2]');
      expect(prompt).toContain('[Document 3]');
      expect(prompt).toContain('Vacation policy details...');
      expect(prompt).toContain('Employee handbook section...');
      expect(prompt).toContain('HR guidelines...');
    });
  });

  describe('evaluation scores', () => {
    it('should return passing evaluation for high-quality response', async () => {
      const highScore = {
        score: 0.95,
        status: 'PASS' as const,
        reasoning:
          'The response is entirely grounded in the provided documentation.',
      };

      mockGenerate.mockResolvedValue({
        text: JSON.stringify(highScore),
        output: highScore,
      });

      const result = await evaluator.evaluate({
        query: 'What is the remote work policy?',
        response:
          'Employees can work remotely up to 3 days per week as stated in the policy.',
        context: [
          'Remote Work Policy: Employees may work from home up to 3 days per week.',
        ],
      });

      expect(result.faithfulness.score).toBeGreaterThanOrEqual(
        EVALUATION_CONFIG.FAITHFULNESS_THRESHOLD,
      );
      expect(result.faithfulness.status).toBe('PASS');
    });

    it('should return failing evaluation for hallucinated response', async () => {
      const lowScore = {
        score: 0.2,
        status: 'FAIL' as const,
        reasoning: 'The response contains claims not found in the context.',
      };

      mockGenerate.mockResolvedValue({
        text: JSON.stringify(lowScore),
        output: lowScore,
      });

      const result = await evaluator.evaluate({
        query: 'What is the remote work policy?',
        response: 'You can work remotely every day with unlimited PTO.',
        context: [
          'Remote Work Policy: Employees may work from home up to 3 days per week.',
        ],
      });

      expect(result.faithfulness.score).toBeLessThan(
        EVALUATION_CONFIG.FAITHFULNESS_THRESHOLD,
      );
      expect(result.faithfulness.status).toBe('FAIL');
    });
  });
});

