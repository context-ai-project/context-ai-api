/**
 * Message Role Value Object
 *
 * Represents the role of a message in a conversation.
 * Using a string literal union type for type safety.
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Message Role Constants
 */
export const MESSAGE_ROLES = {
  USER: 'user' as MessageRole,
  ASSISTANT: 'assistant' as MessageRole,
  SYSTEM: 'system' as MessageRole,
} as const;

/**
 * Validate if a string is a valid MessageRole
 */
export function isValidMessageRole(role: string): role is MessageRole {
  return role === 'user' || role === 'assistant' || role === 'system';
}

/**
 * Get all valid message roles
 */
export function getAllMessageRoles(): MessageRole[] {
  return ['user', 'assistant', 'system'];
}
