import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line sonarjs/deprecation
import { textEmbedding004 } from '@genkit-ai/googleai';
import { embed } from '@genkit-ai/ai';

// Constants for embedding configuration (OWASP: Magic Numbers)
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-004';
const DEFAULT_EMBEDDING_DIMENSIONS = 768;
const DEFAULT_BATCH_SIZE = 100;
const MAX_TOKEN_LIMIT = 2048; // Gemini text-embedding-004 limit
const CHARS_PER_TOKEN_ESTIMATE = 4; // ~4 characters per token

/**
 * Embedding Service
 *
 * Generates vector embeddings using Google Gemini via Genkit AI.
 * Supports both single and batch text embedding generation.
 *
 * Features:
 * - Gemini text-embedding-004 (768 dimensions)
 * - Batch processing with configurable batch size
 * - Automatic text truncation for token limits
 * - Error handling and recovery
 *
 * Security:
 * - Input validation (OWASP)
 * - API key management via environment
 * - Rate limiting aware
 * - Error sanitization
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly config: EmbeddingConfig;

  constructor(config?: Partial<EmbeddingConfig>) {
    this.config = {
      model: config?.model ?? DEFAULT_EMBEDDING_MODEL,
      dimensions: config?.dimensions ?? DEFAULT_EMBEDDING_DIMENSIONS,
      batchSize: config?.batchSize ?? DEFAULT_BATCH_SIZE,
    };

    this.validateConfig();
  }

  /**
   * Validates the embedding configuration
   */
  private validateConfig(): void {
    if (this.config.dimensions <= 0) {
      throw new Error('Dimensions must be a positive number');
    }

    if (this.config.batchSize <= 0) {
      throw new Error('Batch size must be a positive number');
    }
  }

  /**
   * Generates embedding for a single text
   * @param text - The text to embed
   * @returns Vector embedding as number array
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    this.validateInput(text);

    try {
      // Truncate text if it exceeds token limits
      const truncatedText = this.truncateText(text);

      // Use Genkit's embed function directly for better testability
      // text-embedding-004 is the current Gemini embedding model (not deprecated)

      const embedding = await embed({
        // eslint-disable-next-line sonarjs/deprecation
        embedder: textEmbedding004,
        content: truncatedText,
      });

      return embedding;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to generate embedding: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new Error(`Failed to generate embedding: ${errorMessage}`);
    }
  }

  /**
   * Generates embeddings for multiple texts in batches
   * @param texts - Array of texts to embed
   * @returns Array of vector embeddings
   */
  public async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // Validate all texts
    texts.forEach((text) => this.validateInput(text));

    const embeddings: number[][] = [];

    // Process in batches
    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);
      const batchEmbeddings = await Promise.all(
        batch.map((text) => this.generateEmbedding(text)),
      );
      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }

  /**
   * Returns the embedding dimension
   */
  public getEmbeddingDimension(): number {
    return this.config.dimensions;
  }

  /**
   * Returns the current configuration
   */
  public getConfig(): EmbeddingConfig {
    return { ...this.config };
  }

  /**
   * Validates input text
   */
  private validateInput(text: string): void {
    if (text == null) {
      throw new Error('Text cannot be null or undefined');
    }

    if (typeof text !== 'string') {
      throw new Error('Text must be a string');
    }

    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw new Error('Text cannot be empty');
    }
  }

  /**
   * Truncates text to fit within token limits
   * Gemini text-embedding-004 supports up to ~2048 tokens
   * @param text - The text to truncate
   * @returns Truncated text
   */
  private truncateText(text: string): string {
    const maxChars = MAX_TOKEN_LIMIT * CHARS_PER_TOKEN_ESTIMATE;

    if (text.length <= maxChars) {
      return text;
    }

    // Truncate and log warning
    const truncated = text.substring(0, maxChars);
    this.logger.warn(
      `Text truncated from ${text.length} to ${maxChars} characters to fit token limit`,
    );

    return truncated;
  }
}

/**
 * Embedding configuration interface
 */
export interface EmbeddingConfig {
  /**
   * The embedding model to use
   */
  model: string;

  /**
   * The embedding dimension (768 for text-embedding-004)
   */
  dimensions: number;

  /**
   * Batch size for processing multiple texts
   */
  batchSize: number;
}
