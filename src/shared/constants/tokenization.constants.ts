/**
 * Tokenization Constants
 *
 * Centralized constants for token estimation across the application.
 * Used by Fragment entity, FragmentMapper, and EmbeddingService.
 *
 * Rough estimate: 1 token ≈ 4 characters for most LLM tokenizers.
 */
export const CHARS_PER_TOKEN_ESTIMATE = 4;
