import { Injectable, Optional } from '@nestjs/common';

// Constants for chunking configuration (OWASP: Magic Numbers)
const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_OVERLAP = 50;
const DEFAULT_MIN_CHUNK_SIZE = 100;
const TOKENS_PER_WORD_ESTIMATE = 1.3; // Average: 1.3 tokens per word (accounts for punctuation, subwords)

/**
 * Chunking Service
 *
 * Implements sliding window algorithm to split text into overlapping chunks.
 * Used for preparing documents for vector embedding and RAG retrieval.
 *
 * Algorithm:
 * - Splits text into chunks of ~500 tokens
 * - Maintains 50 token overlap between consecutive chunks
 * - Ensures chunks meet minimum size requirements
 *
 * Security:
 * - Input validation (OWASP)
 * - Bounded operations (no ReDoS)
 * - Memory efficient processing
 */
@Injectable()
export class ChunkingService {
  private readonly config: ChunkingConfig;

  constructor(@Optional() config?: Partial<ChunkingConfig>) {
    this.config = {
      chunkSize: config?.chunkSize ?? DEFAULT_CHUNK_SIZE,
      overlap: config?.overlap ?? DEFAULT_OVERLAP,
      minChunkSize: config?.minChunkSize ?? DEFAULT_MIN_CHUNK_SIZE,
    };

    this.validateConfig();
  }

  /**
   * Validates the chunking configuration
   */
  private validateConfig(): void {
    if (this.config.overlap >= this.config.chunkSize) {
      throw new Error('Overlap must be less than chunk size');
    }

    if (this.config.chunkSize <= this.config.minChunkSize) {
      throw new Error('Chunk size must be greater than min chunk size');
    }
  }

  /**
   * Chunks text into overlapping segments using sliding window
   * @param text - The text to chunk
   * @returns Array of text chunks with metadata
   */
  public chunk(text: string): TextChunk[] {
    this.validateInput(text);

    const normalizedText = this.normalizeText(text);
    const tokens = this.tokenize(normalizedText);
    const chunks: TextChunk[] = [];

    let position = 0;
    let startTokenIndex = 0;
    let currentCharIndex = 0;

    while (startTokenIndex < tokens.length) {
      const endTokenIndex = Math.min(
        startTokenIndex + this.config.chunkSize,
        tokens.length,
      );

      const chunkTokens = tokens.slice(startTokenIndex, endTokenIndex);
      const chunkText = chunkTokens.join(' ');

      // Calculate character positions
      const startIndex = currentCharIndex;
      const endIndex = currentCharIndex + chunkText.length;

      chunks.push({
        content: chunkText,
        position,
        tokens: chunkTokens.length,
        startIndex,
        endIndex,
      });

      position++;

      // Move to next chunk with overlap
      const step = this.config.chunkSize - this.config.overlap;

      // Calculate new character index
      // Move forward by step tokens plus spaces
      if (startTokenIndex + step < tokens.length) {
        const tokensToSkip = tokens.slice(
          startTokenIndex,
          startTokenIndex + step,
        );
        // Each token + 1 space (except last)
        currentCharIndex += tokensToSkip.reduce(
          (acc, token) => acc + token.length + 1,
          0,
        );
      }

      startTokenIndex += step;

      // Check if remaining text is too small
      const remainingTokens = tokens.length - startTokenIndex;
      if (
        remainingTokens > 0 &&
        remainingTokens < this.config.minChunkSize &&
        chunks.length > 0
      ) {
        // Merge small remainder with last chunk
        const lastChunk = chunks[chunks.length - 1];
        const remainingText = tokens.slice(startTokenIndex).join(' ');
        lastChunk.content += ' ' + remainingText;
        lastChunk.tokens += remainingTokens;
        lastChunk.endIndex = lastChunk.startIndex + lastChunk.content.length;
        break;
      }
    }

    return chunks;
  }

  /**
   * Estimates token count for text
   * Uses approximation: ~1.3 tokens per word (accounts for punctuation, subwords)
   * @param text - The text to estimate
   * @returns Estimated token count
   */
  public estimateTokens(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }

    // Rough estimation: split by whitespace and punctuation
    const words = text.split(/\s+/).filter((word) => word.length > 0);

    return Math.ceil(words.length * TOKENS_PER_WORD_ESTIMATE);
  }

  /**
   * Returns the current configuration
   */
  public getConfig(): ChunkingConfig {
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
   * Normalizes text for consistent chunking
   * @param text - The text to normalize
   * @returns Normalized text
   */
  private normalizeText(text: string): string {
    return (
      text
        .trim()
        // Normalize line breaks
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        // Reduce multiple spaces to single space
        .replace(/\s+/g, ' ')
        // Normalize multiple line breaks
        .replace(/\n{3,}/g, '\n\n')
    );
  }

  /**
   * Tokenizes text into words
   * Simple whitespace tokenization for chunking purposes
   * @param text - The text to tokenize
   * @returns Array of tokens
   */
  private tokenize(text: string): string[] {
    // Split by whitespace and filter empty strings
    // Bounded operation - no ReDoS risk (OWASP)
    return text.split(/\s+/).filter((token) => token.length > 0);
  }
}

/**
 * Chunking configuration interface
 */
export interface ChunkingConfig {
  /**
   * Target size for each chunk in tokens
   */
  chunkSize: number;

  /**
   * Number of tokens to overlap between consecutive chunks
   */
  overlap: number;

  /**
   * Minimum size for a chunk (prevents tiny last chunks)
   */
  minChunkSize: number;
}

/**
 * Text chunk with metadata
 */
export interface TextChunk {
  /**
   * The chunk content
   */
  content: string;

  /**
   * Position/index of this chunk in the sequence
   */
  position: number;

  /**
   * Estimated number of tokens in this chunk
   */
  tokens: number;

  /**
   * Start character index in original text
   */
  startIndex: number;

  /**
   * End character index in original text
   */
  endIndex: number;
}
