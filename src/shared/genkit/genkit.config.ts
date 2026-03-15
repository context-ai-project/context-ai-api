/**
 * Google Genkit Configuration
 *
 * This module configures Google Genkit with:
 * - Gemini 2.5 Flash for LLM operations
 * - gemini-embedding-001 for embeddings (3072 dimensions)
 *
 * Authentication:
 * - Production (Cloud Run): Uses Application Default Credentials (ADC)
 *   from the service account automatically.
 * - Local: Uses ADC from `gcloud auth application-default login`.
 *
 * Environment variables:
 * - GCP_PROJECT_ID: Google Cloud project ID (required)
 * - GCP_LOCATION: Vertex AI region (defaults to europe-west1)
 */

import { genkit as genkitCore, type Genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/google-genai';

const DEFAULT_LOCATION = 'europe-west1';

/**
 * Initialize Genkit with Vertex AI plugin
 *
 * @returns Configured Genkit instance
 */
export function genkit(): Genkit {
  return genkitCore({
    plugins: [
      vertexAI({
        projectId: process.env.GCP_PROJECT_ID,
        location: process.env.GCP_LOCATION ?? DEFAULT_LOCATION,
      }),
    ],
  });
}

/**
 * Configuration constants for Genkit models
 */
export const GENKIT_CONFIG = {
  /**
   * Default LLM model for chat and RAG responses
   * Using Gemini 2.5 Flash via Vertex AI
   */
  LLM_MODEL: 'vertexai/gemini-2.5-flash' as const,

  /**
   * Default embedding model for vector generation
   * Produces 3072-dimensional vectors
   */
  EMBEDDING_MODEL: 'vertexai/gemini-embedding-001' as const,

  /**
   * Embedding dimensions
   */
  EMBEDDING_DIMENSIONS: 3072,

  /**
   * Default generation parameters
   */
  GENERATION_DEFAULTS: {
    temperature: 0.7,
    maxOutputTokens: 2048,
    topK: 40,
    topP: 0.95,
  },

  /**
   * Conservative generation for factual responses (RAG)
   */
  RAG_GENERATION_CONFIG: {
    temperature: 0.3,
    maxOutputTokens: 1024,
    topK: 20,
    topP: 0.9,
  },
} as const;

/**
 * Type for Genkit configuration
 */
export type GenkitConfig = typeof GENKIT_CONFIG;

/**
 * Export singleton instance for convenience
 * Note: This should be used cautiously as it creates a single instance
 * For testing, prefer using the genkit() function to create fresh instances
 */
let genkitInstance: Genkit | null = null;

export function getGenkitInstance(): Genkit {
  if (!genkitInstance) {
    genkitInstance = genkit();
  }
  return genkitInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetGenkitInstance(): void {
  genkitInstance = null;
}
