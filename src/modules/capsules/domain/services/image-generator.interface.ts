/**
 * Port for AI image generation (Imagen 3).
 *
 * Generates a single illustration from a text prompt.
 * Used to create visual backgrounds for each video scene.
 */
export interface IImageGenerator {
  generateImage(prompt: string): Promise<Buffer>;
}
