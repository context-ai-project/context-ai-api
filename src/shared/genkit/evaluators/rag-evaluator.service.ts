/**
 * RAG Evaluator Service
 *
 * Implements LLM-as-judge evaluation for RAG (Retrieval-Augmented Generation)
 * query responses. Uses Gemini to evaluate two key dimensions:
 *
 * 1. **Faithfulness**: Is the response grounded in the retrieved context?
 *    - Checks that claims in the response are supported by the context
 *    - Penalizes hallucinated or fabricated information
 *
 * 2. **Relevancy**: Is the response relevant to the user's question?
 *    - Checks that the response actually addresses what was asked
 *    - Penalizes off-topic or tangential responses
 *
 * Both evaluators return a score (0-1), a PASS/FAIL status, and reasoning.
 *
 * Architecture:
 * - Uses the same Genkit instance and Gemini model as the RAG flow
 * - Runs evaluations in parallel for performance
 * - Handles errors gracefully (returns UNKNOWN status on failure)
 * - Uses structured output (Zod schema) for reliable JSON parsing
 */

import type { Genkit } from 'genkit';
import { GENKIT_CONFIG } from '../genkit.config';
import {
  evaluationScoreSchema,
  EVALUATION_CONFIG,
  type EvaluationScore,
  type FaithfulnessInput,
  type RelevancyInput,
  type RagEvaluationResult,
} from './evaluation.types';

/**
 * Prompt template for faithfulness evaluation
 *
 * Instructs the LLM judge to assess whether the response is grounded
 * in the provided context documents.
 */
function buildFaithfulnessPrompt(input: FaithfulnessInput): string {
  const contextBlock = input.context
    .map((c, i) => `[Document ${i + 1}]:\n${c}`)
    .join('\n\n');

  return `You are an expert evaluator assessing the FAITHFULNESS of an AI assistant's response.

FAITHFULNESS measures whether the response is factually grounded in the provided context documents. 
A faithful response only contains claims that are supported by the context.

CONTEXT DOCUMENTS:
${contextBlock}

USER QUESTION:
${input.query}

AI RESPONSE:
${input.response}

EVALUATION CRITERIA:
- Score 1.0: All claims in the response are directly supported by the context
- Score 0.8: Most claims are supported; minor inferences are reasonable
- Score 0.6: Some claims are supported but there are unsupported inferences
- Score 0.4: Significant claims lack context support
- Score 0.2: Most claims are not grounded in the context
- Score 0.0: The response is entirely fabricated or contradicts the context

Special cases:
- If the response says it doesn't have information, and the context truly doesn't contain relevant info, score 1.0
- If the context is empty, any substantive response should score 0.0

Evaluate the faithfulness and respond with a JSON object containing:
- "score": a number between 0.0 and 1.0
- "status": "PASS" if score >= 0.6, "FAIL" if score < 0.6
- "reasoning": a brief explanation (1-2 sentences) of your assessment`;
}

/**
 * Prompt template for relevancy evaluation
 *
 * Instructs the LLM judge to assess whether the response is relevant
 * to the user's original question.
 */
function buildRelevancyPrompt(input: RelevancyInput): string {
  return `You are an expert evaluator assessing the RELEVANCY of an AI assistant's response.

RELEVANCY measures whether the response directly addresses the user's question.
A relevant response is on-topic, answers what was asked, and doesn't include excessive unrelated information.

USER QUESTION:
${input.query}

AI RESPONSE:
${input.response}

EVALUATION CRITERIA:
- Score 1.0: Directly and completely answers the question
- Score 0.8: Answers the question well with minor tangential information
- Score 0.6: Partially addresses the question but misses some aspects
- Score 0.4: Only tangentially related to the question
- Score 0.2: Mostly off-topic with only minor relevance
- Score 0.0: Completely unrelated to the question

Special cases:
- If the response appropriately says it cannot answer, score based on whether that's the correct behavior
- A partial answer is better than no answer (score accordingly)

Evaluate the relevancy and respond with a JSON object containing:
- "score": a number between 0.0 and 1.0
- "status": "PASS" if score >= 0.6, "FAIL" if score < 0.6
- "reasoning": a brief explanation (1-2 sentences) of your assessment`;
}

/**
 * Default score returned when evaluation fails
 */
function createErrorScore(error: string): EvaluationScore {
  return {
    score: 0,
    status: 'UNKNOWN',
    reasoning: `Evaluation failed: ${error}`,
  };
}

/**
 * Evaluate faithfulness using LLM-as-judge
 *
 * @param ai - Genkit instance
 * @param input - Faithfulness evaluation input
 * @returns Evaluation score with reasoning
 */
async function evaluateFaithfulness(
  ai: Genkit,
  input: FaithfulnessInput,
): Promise<EvaluationScore> {
  try {
    const prompt = buildFaithfulnessPrompt(input);

    const result = await ai.generate({
      model: GENKIT_CONFIG.LLM_MODEL,
      prompt,
      output: {
        schema: evaluationScoreSchema,
      },
      config: {
        temperature: EVALUATION_CONFIG.EVALUATOR_TEMPERATURE,
        maxOutputTokens: EVALUATION_CONFIG.EVALUATOR_MAX_TOKENS,
      },
    });

    // Validate output through Zod for type safety (result.output is typed as any)
    const rawOutput: unknown = result.output;
    if (!rawOutput) {
      return createErrorScore('No structured output returned');
    }

    return evaluationScoreSchema.parse(rawOutput);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown evaluation error';
    return createErrorScore(message);
  }
}

/**
 * Evaluate relevancy using LLM-as-judge
 *
 * @param ai - Genkit instance
 * @param input - Relevancy evaluation input
 * @returns Evaluation score with reasoning
 */
async function evaluateRelevancy(
  ai: Genkit,
  input: RelevancyInput,
): Promise<EvaluationScore> {
  try {
    const prompt = buildRelevancyPrompt(input);

    const result = await ai.generate({
      model: GENKIT_CONFIG.LLM_MODEL,
      prompt,
      output: {
        schema: evaluationScoreSchema,
      },
      config: {
        temperature: EVALUATION_CONFIG.EVALUATOR_TEMPERATURE,
        maxOutputTokens: EVALUATION_CONFIG.EVALUATOR_MAX_TOKENS,
      },
    });

    // Validate output through Zod for type safety (result.output is typed as any)
    const rawOutput: unknown = result.output;
    if (!rawOutput) {
      return createErrorScore('No structured output returned');
    }

    return evaluationScoreSchema.parse(rawOutput);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown evaluation error';
    return createErrorScore(message);
  }
}

/**
 * Create a RAG Evaluator Service
 *
 * Factory function that creates an evaluator service bound to a Genkit instance.
 * The service evaluates RAG responses on faithfulness and relevancy dimensions
 * using LLM-as-judge pattern.
 *
 * Usage:
 * ```typescript
 * const ai = genkit();
 * const evaluator = createRagEvaluatorService(ai);
 * const scores = await evaluator.evaluate({
 *   query: 'How do I request vacation?',
 *   response: 'Submit a request 15 days in advance.',
 *   context: ['Vacation policy: Submit requests 15 days before...'],
 * });
 * ```
 *
 * @param ai - Configured Genkit instance
 * @returns Evaluator service with evaluate method
 */
export function createRagEvaluatorService(ai: Genkit) {
  /**
   * Evaluate a RAG response on both faithfulness and relevancy
   *
   * Runs both evaluations in parallel for performance.
   * If either evaluation fails, it returns an UNKNOWN status for that metric
   * without blocking the other evaluation or the main flow.
   *
   * @param input - The query, response, and context to evaluate
   * @returns Evaluation results for faithfulness and relevancy
   */
  async function evaluate(input: {
    query: string;
    response: string;
    context: string[];
  }): Promise<RagEvaluationResult> {
    const [faithfulness, relevancy] = await Promise.all([
      evaluateFaithfulness(ai, {
        query: input.query,
        response: input.response,
        context: input.context,
      }),
      evaluateRelevancy(ai, {
        query: input.query,
        response: input.response,
      }),
    ]);

    return { faithfulness, relevancy };
  }

  return { evaluate };
}

/**
 * Type for the RAG Evaluator Service
 */
export type RagEvaluatorService = ReturnType<typeof createRagEvaluatorService>;
