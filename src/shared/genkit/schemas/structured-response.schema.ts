/**
 * Structured Response Schema
 *
 * Defines the Zod schema for Genkit Structured Output.
 * The LLM returns JSON validated against this schema, enabling
 * the frontend to render responses with sections, key points,
 * and related topics.
 *
 * IMPORTANT: Uses `zod/v3` for Genkit compatibility.
 * Genkit v1.x depends on Zod v3 internally. Since our project uses Zod v4,
 * we import from `zod/v3` (backward-compat module shipped by Zod v4)
 * so that `output.schema` in `ai.generate()` receives a Zod v3 schema.
 *
 * @see https://examples.genkit.dev/structured-output
 */

import { z } from 'zod/v3';

/**
 * Section types for structured responses
 */
export const SECTION_TYPES = ['info', 'steps', 'warning', 'tip'] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

/**
 * Response types to distinguish between normal responses and fallbacks
 */
export enum RagResponseType {
  /** Response with documentary context */
  ANSWER = 'answer',
  /** No relevant documents found */
  NO_CONTEXT = 'no_context',
  /** Error during processing */
  ERROR = 'error',
}

/**
 * Schema for a single section in a structured response
 *
 * Uses Zod v3 for Genkit compatibility.
 */
export const responseSectionSchema = z.object({
  title: z.string().describe('Section title'),
  content: z.string().describe('Section content (supports markdown)'),
  type: z
    .enum(SECTION_TYPES)
    .describe(
      'Section type: "info" for general information, "steps" for procedures, "warning" for important notes, "tip" for helpful advice',
    ),
});

export type ResponseSection = z.infer<typeof responseSectionSchema>;

/**
 * Schema for the structured RAG response from the LLM
 *
 * Used as `output.schema` in Genkit `ai.generate()` to ensure
 * the LLM returns well-structured JSON responses.
 *
 * Uses Zod v3 for Genkit compatibility.
 */
export const structuredRagResponseSchema = z.object({
  summary: z
    .string()
    .describe('Brief 1-2 sentence answer directly addressing the question'),
  sections: z
    .array(responseSectionSchema)
    .describe('Detailed information organized into logical sections'),
  keyPoints: z
    .array(z.string())
    .optional()
    .describe('Key takeaways as bullet points'),
  relatedTopics: z
    .array(z.string())
    .optional()
    .describe('Related topics the user might want to explore'),
});

export type StructuredRagResponse = z.infer<typeof structuredRagResponseSchema>;
