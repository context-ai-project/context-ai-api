/**
 * RAG Query Flow
 *
 * This flow implements the RAG (Retrieval-Augmented Generation) pattern:
 * 1. Generate embedding for user query
 * 2. Search for relevant fragments in vector database
 * 3. Build prompt with context from retrieved fragments
 * 4. Generate response using Gemini LLM with structured output
 * 5. Return response with cited sources and response type
 *
 * v1.3 improvements:
 * - Structured output using Genkit output.schema (Feature 4)
 * - Intelligent fallback with LLM-generated responses (Feature 3)
 * - Response type metadata (answer / no_context / error)
 */

import { z } from 'zod';
import { genkit, GENKIT_CONFIG } from '../genkit.config';
import {
  createRagEvaluatorService,
  type RagEvaluationResult,
} from '../evaluators';
import {
  structuredRagResponseSchema,
  RagResponseType,
  type StructuredRagResponse,
} from '../schemas/structured-response.schema';

// Re-export for consumers
export { RagResponseType } from '../schemas/structured-response.schema';
export type { StructuredRagResponse } from '../schemas/structured-response.schema';

/**
 * Constants for RAG configuration
 */
const RAG_CONFIG = {
  DEFAULT_MAX_RESULTS: 5,
  MAX_RESULTS_LIMIT: 10,
  DEFAULT_MIN_SIMILARITY: 0.55,
  MIN_SIMILARITY_RANGE: { min: 0, max: 1 },
  /** Queries with fewer words than this threshold trigger Query Expansion */
  QUERY_EXPANSION_WORD_THRESHOLD: 10,
  /** Max length for an expanded query (sanity check) */
  MAX_EXPANDED_QUERY_LENGTH: 500,
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
 * Output schema for RAG query (Zod v4 — used for internal validation)
 *
 * Note: The `structured` field is typed as `unknown` here because
 * its actual Zod v3 schema is used separately in `ai.generate()`.
 * The `StructuredRagResponse` TypeScript type provides compile-time safety.
 */
export const ragQueryOutputSchema = z.object({
  response: z.string(),
  responseType: z.enum([
    RagResponseType.ANSWER,
    RagResponseType.NO_CONTEXT,
    RagResponseType.ERROR,
  ]),
  structured: z.unknown().optional(),
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
export type RagQueryOutput = Omit<
  z.infer<typeof ragQueryOutputSchema>,
  'structured'
> & {
  structured?: StructuredRagResponse;
  evaluation?: RagEvaluationResult;
};

/**
 * Vector search function type
 * This will be injected as a dependency
 *
 * @param embedding - Query embedding vector
 * @param sectorId - Sector ID (Pinecone namespace)
 * @param limit - Maximum number of results
 * @param minScore - Minimum similarity score threshold (passed through to Pinecone)
 */
export type VectorSearchFn = (
  embedding: number[],
  sectorId: string,
  limit: number,
  minScore?: number,
) => Promise<FragmentResult[]>;

/**
 * Build structured prompt with context for normal responses
 */
function buildStructuredPrompt(
  query: string,
  fragments: FragmentResult[],
): string {
  const context = fragments
    .map((f, index) => `[${index + 1}] ${f.content}`)
    .join('\n\n');

  return `You are an onboarding assistant for the company. Answer the following question based ONLY on the provided documentation.

DOCUMENTATION CONTEXT:
${context}

USER QUESTION:
${query}

INSTRUCTIONS:
- Provide a brief summary (1-2 sentences) directly answering the question
- Organize detailed information into logical sections
- Each section should have a type: "info" (general), "steps" (procedures), "warning" (important notes), "tip" (helpful advice)
- Include key takeaways as bullet points when relevant
- Suggest related topics the user might want to explore
- Use markdown formatting within section content
- Respond in the SAME LANGUAGE as the user's question
- If the documentation doesn't fully cover the topic, be transparent about it`;
}

/**
 * Build fallback prompt when no relevant context is found (Feature 3)
 *
 * Instead of returning a static string, the LLM generates a contextual,
 * empathetic response in the user's language.
 */
function buildFallbackPrompt(query: string, sectorName?: string): string {
  const sectorContext = sectorName
    ? `The user is asking in the context of the "${sectorName}" department/sector.`
    : '';

  return `You are an onboarding assistant for a company. The user asked a question, but there are NO relevant documents available to answer it.

${sectorContext}

USER QUESTION: "${query}"

INSTRUCTIONS:
- Acknowledge that you don't have specific information about this topic in the available documentation
- Be empathetic and helpful in your response
- Suggest general alternatives (e.g., contact HR, check the company intranet, ask their manager)
- If the question seems related to common onboarding topics, mention that the documentation might not have been uploaded yet
- Keep the response concise (2-3 sentences max)
- Respond in the SAME LANGUAGE as the user's question

RESPONSE:`;
}

/**
 * Build prompt for Query Expansion (v1.3 — Retrieval Improvement)
 *
 * Takes a short/ambiguous user query and asks the LLM to produce an enriched
 * version with synonyms, related terms, and contextual clues. The expanded
 * query is then embedded to improve vector search recall.
 *
 * The LLM must return ONLY the expanded query — no explanations.
 */
function buildQueryExpansionPrompt(query: string): string {
  return `You are a query expansion assistant for a company knowledge base. Your job is to ENRICH a user's short question so that a vector similarity search can find more relevant documents.

USER QUERY: "${query}"

INSTRUCTIONS:
- Add synonyms, related terms, and contextual keywords that documents might contain
- Keep the original intent intact
- Include the original keywords
- Add domain-specific variations (e.g., "holidays" → "holidays, public holidays, national holidays, bank holidays, non-working days, calendar")
- Respond in the SAME LANGUAGE as the user's query
- Return ONLY the expanded query text, nothing else — no explanations, no quotes
- Keep it to a single paragraph (max 50 words)

EXPANDED QUERY:`;
}

/**
 * Fallback response when LLM also fails (last resort)
 */
const STATIC_FALLBACK_RESPONSE =
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
 * - Structured output with Genkit output.schema (v1.3)
 * - Intelligent fallback responses with LLM (v1.3)
 * - Response type metadata (v1.3)
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
   * Expand short/ambiguous queries using the LLM (v1.3 — Retrieval Improvement)
   *
   * Short queries like "festivos nacionales" produce generic embeddings that may
   * miss relevant documents. This function detects short queries (< QUERY_EXPANSION_WORD_THRESHOLD
   * words) and uses the LLM to enrich them with synonyms and contextual terms,
   * producing a richer embedding that improves vector search recall.
   *
   * For longer, descriptive queries the original text is returned unchanged
   * to avoid unnecessary latency.
   *
   * @param query - Original user query
   * @returns Expanded query (or original if long enough or expansion fails)
   */
  async function maybeExpandQuery(query: string): Promise<string> {
    const wordCount = query.trim().split(/\s+/).length;

    if (wordCount >= RAG_CONFIG.QUERY_EXPANSION_WORD_THRESHOLD) {
      return query; // Query is descriptive enough — skip expansion
    }

    try {
      const prompt = buildQueryExpansionPrompt(query);
      const result = await ai.generate({
        model: GENKIT_CONFIG.LLM_MODEL,
        prompt,
        config: {
          ...GENKIT_CONFIG.RAG_GENERATION_CONFIG,
          maxOutputTokens: 100, // Expanded queries are short
        },
      });

      const expanded = result.text.trim();
      // Sanity check: expanded query should be non-empty and not excessively long
      if (
        expanded.length > 0 &&
        expanded.length < RAG_CONFIG.MAX_EXPANDED_QUERY_LENGTH
      ) {
        return expanded;
      }
      return query;
    } catch {
      // If expansion fails, silently fall back to the original query
      return query;
    }
  }

  /**
   * Generate an intelligent fallback response using the LLM (Feature 3)
   *
   * When no relevant documents are found, instead of returning a static string,
   * we ask the LLM to generate a contextual, empathetic response in the user's language.
   *
   * Falls back to a static response if the LLM call fails.
   */
  async function generateFallbackResponse(
    query: string,
    sectorName?: string,
  ): Promise<string> {
    try {
      const prompt = buildFallbackPrompt(query, sectorName);
      const result = await ai.generate({
        model: GENKIT_CONFIG.LLM_MODEL,
        prompt,
        config: {
          ...GENKIT_CONFIG.RAG_GENERATION_CONFIG,
          maxOutputTokens: 256, // Keep fallback responses short
        },
      });
      return result.text;
    } catch {
      // If LLM fails, degrade gracefully to static fallback
      return STATIC_FALLBACK_RESPONSE;
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

    // Step 2: Query Expansion — enrich short queries for better retrieval
    const searchQuery = await maybeExpandQuery(validatedInput.query);

    // Step 2b: If query was expanded, regenerate embedding with enriched query
    let finalEmbedding = queryEmbedding;
    if (searchQuery !== validatedInput.query) {
      const expandedEmbedding = await ai.embed({
        embedder: GENKIT_CONFIG.EMBEDDING_MODEL,
        content: searchQuery,
      });
      if (
        Array.isArray(expandedEmbedding) &&
        expandedEmbedding.length > 0 &&
        Array.isArray(expandedEmbedding[0].embedding)
      ) {
        finalEmbedding = expandedEmbedding[0].embedding;
      }
    }

    // Step 3: Search for relevant fragments (minSimilarity passed to Pinecone)
    const relevantFragments = await vectorSearch(
      finalEmbedding,
      validatedInput.sectorId,
      validatedInput.maxResults,
      validatedInput.minSimilarity,
    );

    // Step 4: Handle no relevant fragments case (Feature 3 — Intelligent Fallback)
    if (relevantFragments.length === 0) {
      const fallbackResponse = await generateFallbackResponse(
        validatedInput.query,
      );

      return {
        response: fallbackResponse,
        responseType: RagResponseType.NO_CONTEXT,
        sources: [],
        conversationId: validatedInput.conversationId,
        timestamp: new Date(),
        metadata: {
          model: GENKIT_CONFIG.LLM_MODEL,
          temperature: GENKIT_CONFIG.RAG_GENERATION_CONFIG.temperature,
          fragmentsRetrieved: 0,
          fragmentsUsed: 0,
        },
      };
    }

    // Step 5: Build prompt and generate structured response (Feature 4)
    const prompt = buildStructuredPrompt(
      validatedInput.query,
      relevantFragments,
    );

    let responseText: string;
    let structured: StructuredRagResponse | undefined;

    try {
      // Use Genkit Structured Output — LLM returns validated JSON
      // Cast generate to bypass TS2589 deep type instantiation with Zod v3/v4 interop
      type GenerateFn = (opts: Record<string, unknown>) => Promise<{
        output: StructuredRagResponse;
        text: string;
      }>;
      const generate = ai.generate.bind(ai) as unknown as GenerateFn;

      const result = await generate({
        model: GENKIT_CONFIG.LLM_MODEL,
        prompt,
        output: { schema: structuredRagResponseSchema },
        config: GENKIT_CONFIG.RAG_GENERATION_CONFIG,
      });

      structured = result.output;
      // Use summary as the plain text response for backward compatibility
      responseText = structured?.summary ?? result.text;
    } catch {
      // Fallback: if structured output fails, use plain text generation
      const result = await ai.generate({
        model: GENKIT_CONFIG.LLM_MODEL,
        prompt,
        config: GENKIT_CONFIG.RAG_GENERATION_CONFIG,
      });
      responseText = result.text;
    }

    // Step 6: Evaluate response quality (faithfulness + relevancy)
    const evaluation = await runEvaluations(
      validatedInput.query,
      responseText,
      relevantFragments,
    );

    // Step 7: Return structured output with evaluation scores
    return {
      response: responseText,
      responseType: RagResponseType.ANSWER,
      structured,
      sources: relevantFragments,
      conversationId: validatedInput.conversationId,
      timestamp: new Date(),
      metadata: {
        model: GENKIT_CONFIG.LLM_MODEL,
        temperature: GENKIT_CONFIG.RAG_GENERATION_CONFIG.temperature,
        fragmentsRetrieved: relevantFragments.length,
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
