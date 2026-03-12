/**
 * Capsules Genkit Configuration
 *
 * Separate Genkit instance for the Capsules module, using a dedicated
 * Google API key (GOOGLE_CAPSULES_API_KEY) to isolate quota and billing
 * from the RAG chat pipeline.
 *
 * Used by:
 * - ScriptGeneratorService (script + structured scenes generation)
 * - Imagen3ImageGeneratorService (scene illustration generation)
 */

import { genkit as genkitCore, type Genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

function validateCapsuleEnvironment(): void {
  if (!process.env.GOOGLE_CAPSULES_API_KEY) {
    throw new Error(
      'GOOGLE_CAPSULES_API_KEY environment variable is required for capsule generation. ' +
        'Please add it to your .env file.',
    );
  }
}

function createCapsuleGenkit(): Genkit {
  validateCapsuleEnvironment();

  return genkitCore({
    plugins: [
      googleAI({
        apiKey: process.env.GOOGLE_CAPSULES_API_KEY,
      }),
    ],
  });
}

let capsuleGenkitInstance: Genkit | null = null;

export function getCapsuleGenkitInstance(): Genkit {
  if (!capsuleGenkitInstance) {
    capsuleGenkitInstance = createCapsuleGenkit();
  }
  return capsuleGenkitInstance;
}

export function resetCapsuleGenkitInstance(): void {
  capsuleGenkitInstance = null;
}
