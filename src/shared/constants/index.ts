export { CHARS_PER_TOKEN_ESTIMATE } from './tokenization.constants';

/**
 * Number of characters shown for IDs (userId, jti, etc.) in logs.
 * Shows only the first N characters followed by '...' to avoid
 * logging full UUIDs/tokens while still allowing log correlation.
 */
export const LOG_ID_PREFIX = 8;
