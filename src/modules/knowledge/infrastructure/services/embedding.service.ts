import { Injectable, Logger } from '@nestjs/common';
import { genkit, Genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Constants for embedding configuration (OWASP: Magic Numbers)
const DEFAULT_EMBEDDING_MODEL = 'googleai/text-embedding-005';
const DEFAULT_EMBEDDING_DIMENSIONS = 768;
const DEFAULT_BATCH_SIZE = 100;
const MAX_TOKEN_LIMIT = 2048; // Gemini text-embedding-005 limit
const CHARS_PER_TOKEN_ESTIMATE = 4; // ~4 characters per token

// Supported dimensions for text-embedding-005 (OWASP: Magic Numbers)
const SUPPORTED_DIMENSIONS_256 = 256;
const SUPPORTED_DIMENSIONS_512 = 512;
const SUPPORTED_DIMENSIONS_768 = 768;
const SUPPORTED_DIMENSIONS_1536 = 1536;
const SUPPORTED_DIMENSIONS = [
  SUPPORTED_DIMENSIONS_256,
  SUPPORTED_DIMENSIONS_512,
  SUPPORTED_DIMENSIONS_768,
  SUPPORTED_DIMENSIONS_1536,
];

/**
 * Task types for text-embedding-005
 * Optimizes embedding quality for specific use cases
 */
export enum EmbeddingTaskType {
  /**
   * Use for generating embeddings of documents to be stored in a vector database
   * Optimizes for similarity search and retrieval
   */
  RETRIEVAL_DOCUMENT = 'RETRIEVAL_DOCUMENT',

  /**
   * Use for generating embeddings of search queries
   * Optimizes for matching against stored document embeddings
   */
  RETRIEVAL_QUERY = 'RETRIEVAL_QUERY',

  /**
   * Use for semantic similarity tasks
   */
  SEMANTIC_SIMILARITY = 'SEMANTIC_SIMILARITY',

  /**
   * Use for classification tasks
   */
  CLASSIFICATION = 'CLASSIFICATION',

  /**
   * Use for clustering tasks
   */
  CLUSTERING = 'CLUSTERING',
}

/**
 * Embedding Service
 *
 * Generates vector embeddings using Google Gemini via Genkit AI.
 * Supports both single and batch text embedding generation.
 *
 * Features:
 * - Gemini text-embedding-005 (768 dimensions by default)
 * - Flexible output dimensionality (256, 512, 768, or 1536)
 * - Task-specific optimization (RETRIEVAL_DOCUMENT, RETRIEVAL_QUERY, etc.)
 * - Batch processing with configurable batch size
 * - Automatic text truncation for token limits
 * - Error handling and recovery
 *
 * Usage:
 * ```typescript
 * // For indexing documents
 * const docEmbedding = await service.generateDocumentEmbedding(documentText);
 *
 * // For search queries
 * const queryEmbedding = await service.generateQueryEmbedding(searchQuery);
 * ```
 *
 * pgvector Integration:
 * - Ensure your pgvector column dimensions match the configured dimensions (768 by default)
 * - Use RETRIEVAL_DOCUMENT taskType for indexing documents
 * - Use RETRIEVAL_QUERY taskType for search queries
 * - Example: `CREATE TABLE embeddings (id SERIAL PRIMARY KEY, vector vector(768));`
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
  private ai: Genkit | null = null;

  constructor(config?: Partial<EmbeddingConfig>) {
    this.config = {
      model: config?.model ?? DEFAULT_EMBEDDING_MODEL,
      dimensions: config?.dimensions ?? DEFAULT_EMBEDDING_DIMENSIONS,
      batchSize: config?.batchSize ?? DEFAULT_BATCH_SIZE,
      apiKey: config?.apiKey ?? process.env.GOOGLE_GENAI_API_KEY,
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

    // Validate supported dimensions for text-embedding-005
    if (!SUPPORTED_DIMENSIONS.includes(this.config.dimensions)) {
      throw new Error(
        `Invalid dimensions. text-embedding-005 supports: ${SUPPORTED_DIMENSIONS.join(', ')}`,
      );
    }
  }

  /**
   * Lazy initialization of Genkit AI instance
   * This allows for better testability and resource management
   */
  private getAI(): Genkit {
    if (!this.ai) {
      if (!this.config.apiKey) {
        throw new Error(
          'GOOGLE_GENAI_API_KEY environment variable is required',
        );
      }

      this.ai = genkit({
        plugins: [
          googleAI({
            apiKey: this.config.apiKey,
          }),
        ],
      });

      this.logger.log(
        `Genkit AI initialized with ${this.config.model} (${this.config.dimensions}D)`,
      );
    }

    return this.ai;
  }

  /**
   * Generates embedding for a single text with optional task type
   * @param text - The text to embed
   * @param taskType - Optional task type for optimization
   * @returns Vector embedding as number array
   */
  public async generateEmbedding(
    text: string,
    taskType?: EmbeddingTaskType,
  ): Promise<number[]> {
    this.validateInput(text);

    try {
      // Truncate text if it exceeds token limits
      const truncatedText = this.truncateText(text);

      // Use modern Genkit API with string references
      const ai = this.getAI();
      const options: Record<string, unknown> = {
        outputDimensionality: this.config.dimensions,
      };

      // Add taskType if provided
      if (taskType) {
        options.taskType = taskType;
      }

      const result = await ai.embed({
        embedder: this.config.model,
        content: truncatedText,
        options,
      });

      // Extract the embedding array from the result
      // Genkit returns an array of objects with { embedding: number[] }
      if (Array.isArray(result) && result.length > 0 && result[0].embedding) {
        return result[0].embedding;
      }

      throw new Error('Invalid embedding response format');
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
   * Generates embedding optimized for document indexing
   * Use this method when storing documents in pgvector for retrieval
   * @param text - The document text to embed
   * @returns Vector embedding as number array
   */
  public async generateDocumentEmbedding(text: string): Promise<number[]> {
    return this.generateEmbedding(text, EmbeddingTaskType.RETRIEVAL_DOCUMENT);
  }

  /**
   * Generates embedding optimized for search queries
   * Use this method when generating embeddings for user queries
   * @param text - The search query to embed
   * @returns Vector embedding as number array
   */
  public async generateQueryEmbedding(text: string): Promise<number[]> {
    return this.generateEmbedding(text, EmbeddingTaskType.RETRIEVAL_QUERY);
  }

  /**
   * Generates embeddings for multiple texts in batches
   * @param texts - Array of texts to embed
   * @param taskType - Optional task type for optimization
   * @returns Array of vector embeddings
   */
  public async generateEmbeddings(
    texts: string[],
    taskType?: EmbeddingTaskType,
  ): Promise<number[][]> {
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
        batch.map((text) => this.generateEmbedding(text, taskType)),
      );
      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }

  /**
   * Generates embeddings for multiple documents optimized for indexing
   * @param texts - Array of document texts to embed
   * @returns Array of vector embeddings
   */
  public async generateDocumentEmbeddings(
    texts: string[],
  ): Promise<number[][]> {
    return this.generateEmbeddings(texts, EmbeddingTaskType.RETRIEVAL_DOCUMENT);
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
  public getConfig(): Omit<EmbeddingConfig, 'apiKey'> {
    // Exclude apiKey for security
    return {
      model: this.config.model,
      dimensions: this.config.dimensions,
      batchSize: this.config.batchSize,
    };
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
   * Gemini text-embedding-005 supports up to ~2048 tokens
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
   * The embedding model to use (e.g., 'googleai/text-embedding-005')
   */
  model: string;

  /**
   * The embedding dimension (256, 512, 768, or 1536 for text-embedding-005)
   */
  dimensions: number;

  /**
   * Batch size for processing multiple texts
   */
  batchSize: number;

  /**
   * Google GenAI API key (optional, falls back to env var)
   */
  apiKey?: string;
}
