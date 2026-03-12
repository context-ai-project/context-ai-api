/**
 * Represents a single scene in a video capsule's structured script.
 *
 * Each scene maps to:
 * - One AI-generated illustration (via visualPrompt → Imagen 3)
 * - One segment of narration (textToNarrate → ElevenLabs TTS)
 * - One text overlay (titleOverlay → Shotstack text track)
 */
export interface VideoScene {
  textToNarrate: string;
  visualPrompt: string;
  titleOverlay: string;
}

export function isVideoSceneArray(value: unknown): value is VideoScene[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return false;
  return value.every(
    (item: unknown) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).textToNarrate === 'string' &&
      typeof (item as Record<string, unknown>).visualPrompt === 'string' &&
      typeof (item as Record<string, unknown>).titleOverlay === 'string',
  );
}

export function parseVideoScenes(script: string): VideoScene[] {
  const parsed: unknown = JSON.parse(script);
  if (!isVideoSceneArray(parsed)) {
    throw new Error(
      'Invalid video script: expected a non-empty JSON array of scenes with textToNarrate, visualPrompt, and titleOverlay',
    );
  }
  return parsed;
}
