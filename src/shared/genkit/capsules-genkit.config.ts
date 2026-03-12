/**
 * Capsules Genkit Configuration
 *
 * Re-exports the shared Genkit singleton (GOOGLE_API_KEY) so that the
 * Capsules module (ScriptGeneratorService, Imagen 3) uses the same instance
 * as the RAG/Knowledge pipeline — no separate key or instance required.
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
