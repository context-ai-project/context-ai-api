/**
 * Capsules Genkit Configuration
 *
 * Re-exports the shared Genkit singleton (Vertex AI) so that the
 * Capsules module (ScriptGeneratorService) uses the same instance
 * as the RAG/Knowledge pipeline.
 *
 * Used by:
 * - ScriptGeneratorService (script + structured scenes generation)
 */

import { getGenkitInstance, resetGenkitInstance } from './genkit.config';
import type { Genkit } from 'genkit';

export function getCapsuleGenkitInstance(): Genkit {
  return getGenkitInstance();
}

/** Alias so tests that reset the capsule instance also reset the shared one. */
export function resetCapsuleGenkitInstance(): void {
  resetGenkitInstance();
}
