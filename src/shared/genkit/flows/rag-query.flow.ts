/**
 * RAG Query Flow
 *
 * This flow implements the RAG (Retrieval-Augmented Generation) pattern:
 * 1. Generate embedding for user query
 * 2. Search for relevant fragments in vector database
 * 3. Build prompt with context from retrieved fragments
 * 4. Generate response using Gemini LLM
 * 5. Return response with cited sources
 */

import { z } from 'zod';
import { genkit, GENKIT_CONFIG } from '../genkit.config';
import {
  createRagEvaluatorService,
  type RagEvaluationResult,
} from '../evaluators';

/**
 * Constants for RAG configuration
 */
const RAG_CONFIG = {
  DEFAULT_MAX_RESULTS: 5,
  MAX_RESULTS_LIMIT: 10,
  DEFAULT_MIN_SIMILARITY: 0.7,
  MIN_SIMILARITY_RANGE: { min: 0, max: 1 },
} as const;

/**
 * Input schema for RAG query
 */
export const ragQueryInputSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  sectorId: z.string().min(1, 'Sector ID is required'),
  conversationId: z.string().optional(),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(RAG_CONFIG.MAX_RESULTS_LIMIT)
    .default(RAG_CONFIG.DEFAULT_MAX_RESULTS),
  minSimilarity: z
    .number()
    .min(RAG_CONFIG.MIN_SIMILARITY_RANGE.min)
    .max(RAG_CONFIG.MIN_SIMILARITY_RANGE.max)
    .default(RAG_CONFIG.DEFAULT_MIN_SIMILARITY),
});

export type RagQueryInput = z.infer<typeof ragQueryInputSchema>;

/**
 * Fragment result from vector search
 */
export const fragmentSchema = z.object({
  id: z.string(),
  content: z.string(),
  similarity: z.number(),
  sourceId: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type FragmentResult = z.infer<typeof fragmentSchema>;

/**
 * Output schema for RAG query
 */
export const ragQueryOutputSchema = z.object({
  response: z.string(),
  sources: z.array(fragmentSchema),
  conversationId: z.string().optional(),
  timestamp: z.date(),
  metadata: z
    .object({
      model: z.string(),
      temperature: z.number(),
      fragmentsRetrieved: z.number(),
      fragmentsUsed: z.number(),
    })
    .optional(),
});

/**
 * RAG query output type, extended with optional evaluation result.
 * Evaluation is typed as a plain interface (not Zod) because it's produced
 * by the evaluator service after response generation, not part of the
 * core RAG schema validated on output.
 */
export type RagQueryOutput = z.infer<typeof ragQueryOutputSchema> & {
  evaluation?: RagEvaluationResult;
};

/**
 * Vector search function type
 * This will be injected as a dependency
 */
export type VectorSearchFn = (
  embedding: number[],
  sectorId: string,
  limit: number,
) => Promise<FragmentResult[]>;

/**
 * Build system prompt with context
 */
function buildPrompt(query: string, fragments: FragmentResult[]): string {
  const context =
    fragments.length > 0
      ? fragments.map((f, index) => `[${index + 1}] ${f.content}`).join('\n\n')
      : 'No relevant documentation found.';

  return `You are an onboarding assistant for the company. Your role is to help employees understand company policies, procedures, and guidelines.

IMPORTANT INSTRUCTIONS:
- Answer ONLY based on the provided documentation context below
- If the context doesn't contain the answer, say: "I don't have information about that in the current documentation."
- Be concise and clear in your response
- Reference the documentation sources when applicable
- Use a friendly, professional tone

DOCUMENTATION CONTEXT:
${context}

USER QUESTION:
${query}

ANSWER:`;
}

/**
 * Fallback response when no relevant context is found
 */
const FALLBACK_RESPONSE =
  "I don't have information about that in the current documentation. Please contact HR or your manager for more specific guidance.";

/**
 * RAG Query Service
 *
 * This service implements the RAG (Retrieval-Augmented Generation) pattern.
 * It's designed to be used by the QueryAssistant use case.
 *
 * Features:
 * - Vector search for relevant fragments
 * - Context-aware prompt building
 * - Response generation with Gemini LLM
 * - Automatic evaluation with Faithfulness and Relevancy metrics
 *
 * @param vectorSearch - Function to search for relevant fragments (injected dependency)
 */
export function createRagQueryService(vectorSearch: VectorSearchFn) {
  const ai = genkit();
  const evaluator = createRagEvaluatorService(ai);

  /**
   * Run evaluations in parallel without blocking the main flow.
   * Returns undefined if evaluation fails.
   */
  async function runEvaluations(
    query: string,
    response: string,
    fragments: FragmentResult[],
  ): Promise<RagEvaluationResult | undefined> {
    try {
      const contextTexts = fragments.map((f) => f.content);
      return await evaluator.evaluate({
        query,
        response,
        context: contextTexts,
      });
    } catch {
      // Evaluation failure should not block the main RAG flow
      return undefined;
    }
  }

  /**
   * Execute RAG query
   */
  async function executeQuery(input: RagQueryInput): Promise<RagQueryOutput> {
    // Validate input
    const validatedInput = ragQueryInputSchema.parse(input);

    // Step 1: Generate query embedding
    const embeddingResult = await ai.embed({
      embedder: GENKIT_CONFIG.EMBEDDING_MODEL,
      content: validatedInput.query,
    });

    // Extract embedding array from result
    if (!Array.isArray(embeddingResult) || embeddingResult.length === 0) {
      throw new Error('Failed to generate query embedding');
    }

    const queryEmbedding = embeddingResult[0].embedding;

    if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
      throw new Error('Invalid embedding format received');
    }

    // Step 2: Search for relevant fragments
    const allFragments = await vectorSearch(
      queryEmbedding,
      validatedInput.sectorId,
      validatedInput.maxResults,
    );

    // Step 3: Filter fragments by similarity threshold
    const relevantFragments = allFragments.filter(
      (f) => f.similarity >= validatedInput.minSimilarity,
    );

    // Step 4: Handle no relevant fragments case
    if (relevantFragments.length === 0) {
      return {
        response: FALLBACK_RESPONSE,
        sources: [],
        conversationId: validatedInput.conversationId,
        timestamp: new Date(),
        metadata: {
          model: GENKIT_CONFIG.LLM_MODEL,
          temperature: GENKIT_CONFIG.RAG_GENERATION_CONFIG.temperature,
          fragmentsRetrieved: allFragments.length,
          fragmentsUsed: 0,
        },
      };
    }

    // Step 5: Build prompt with context
    const prompt = buildPrompt(validatedInput.query, relevantFragments);

    // Step 6: Generate response with Gemini
    const result = await ai.generate({
      model: GENKIT_CONFIG.LLM_MODEL,
      prompt,
      config: GENKIT_CONFIG.RAG_GENERATION_CONFIG,
    });

    // Step 7: Evaluate response quality (faithfulness + relevancy)
    const evaluation = await runEvaluations(
      validatedInput.query,
      result.text,
      relevantFragments,
    );

    // Step 8: Return structured output with evaluation scores
    return {
      response: result.text,
      sources: relevantFragments,
      conversationId: validatedInput.conversationId,
      timestamp: new Date(),
      metadata: {
        model: GENKIT_CONFIG.LLM_MODEL,
        temperature: GENKIT_CONFIG.RAG_GENERATION_CONFIG.temperature,
        fragmentsRetrieved: allFragments.length,
        fragmentsUsed: relevantFragments.length,
      },
      evaluation,
    };
  }

  return {
    executeQuery,
  };
}

/**
 * RAG Query Service type
 */
export type RagQueryService = ReturnType<typeof createRagQueryService>;
