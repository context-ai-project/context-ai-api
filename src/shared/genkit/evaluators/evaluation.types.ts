/**
 * RAG Evaluation Types
 *
 * Defines the types for evaluating RAG query responses.
 * Two evaluation dimensions are supported:
 * - Faithfulness: Is the response grounded in the provided context?
 * - Relevancy: Is the response relevant to the user's question?
 *
 * These evaluations use Gemini LLM-as-judge pattern to score
 * each response on a 0-1 scale with reasoning.
 */

import { z } from 'zod';

/**
 * Evaluation score returned by the LLM judge
 */
export const evaluationScoreSchema = z.object({
  /** Numeric score from 0.0 (worst) to 1.0 (best) */
  score: z.number().min(0).max(1),
  /** Whether the evaluation passes the minimum threshold */
  status: z.enum(['PASS', 'FAIL', 'UNKNOWN']),
  /** Brief reasoning explaining the score */
  reasoning: z.string(),
});

export type EvaluationScore = z.infer<typeof evaluationScoreSchema>;

/**
 * Complete evaluation result for a RAG response
 */
export interface RagEvaluationResult {
  /** Faithfulness score: is the response grounded in the context? */
  faithfulness: EvaluationScore;
  /** Relevancy score: is the response relevant to the question? */
  relevancy: EvaluationScore;
}

/**
 * Input for faithfulness evaluation
 */
export interface FaithfulnessInput {
  /** The user's original question */
  query: string;
  /** The LLM-generated response */
  response: string;
  /** The context documents used to generate the response */
  context: string[];
}

/**
 * Input for relevancy evaluation
 */
export interface RelevancyInput {
  /** The user's original question */
  query: string;
  /** The LLM-generated response */
  response: string;
}

/**
 * Configuration for evaluation thresholds
 */
export const EVALUATION_CONFIG = {
  /** Minimum score to pass faithfulness evaluation */
  FAITHFULNESS_THRESHOLD: 0.6,
  /** Minimum score to pass relevancy evaluation */
  RELEVANCY_THRESHOLD: 0.6,
  /** Temperature for the evaluator LLM (low for consistency) */
  EVALUATOR_TEMPERATURE: 0.1,
  /** Max output tokens for evaluation responses */
  EVALUATOR_MAX_TOKENS: 512,
} as const;
