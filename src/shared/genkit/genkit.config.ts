/**
 * Google Genkit Configuration
 *
 * This module configures Google Genkit with:
 * - Gemini 1.5 Pro for LLM operations
 * - gemini-embedding-001 for embeddings (3072 dimensions)
 *
 * Environment variables required:
 * - GOOGLE_API_KEY: API key for Google AI services
 * - GENKIT_ENV: Environment (dev/prod, optional)
 */

import { genkit as genkitCore, type Genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Validate required environment variables
 */
function validateEnvironment(): void {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error(
      'GOOGLE_API_KEY environment variable is required. ' +
        'Please add it to your .env file.',
    );
  }
}

/**
 * Initialize Genkit with Google AI plugin
 *
 * @returns Configured Genkit instance
 */
export function genkit(): Genkit {
  // Validate environment before initialization
  validateEnvironment();

  return genkitCore({
    plugins: [
      googleAI({
        apiKey: process.env.GOOGLE_API_KEY,
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
   * Using Gemini 2.5 Flash - latest stable model (Feb 2026)
   */
  LLM_MODEL: 'googleai/gemini-2.5-flash' as const,

  /**
   * Default embedding model for vector generation
   * Produces 3072-dimensional vectors
   */
  EMBEDDING_MODEL: 'googleai/gemini-embedding-001' as const,

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
