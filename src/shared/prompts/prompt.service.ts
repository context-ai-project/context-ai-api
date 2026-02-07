/**
 * Prompt Engineering Service
 *
 * Centralizes prompt template management and construction for RAG.
 * Provides different prompt types for various use cases.
 *
 * Features:
 * - Multiple prompt templates (onboarding, policy, procedure, general)
 * - Conversation history integration
 * - Fragment context formatting
 * - Extensible design for new prompt types
 *
 * Usage:
 * ```typescript
 * const promptService = new PromptService();
 * const prompt = promptService.buildPrompt(PromptType.ONBOARDING, {
 *   query: 'How do I request vacation?',
 *   fragments: [...],
 *   conversationHistory: [...]
 * });
 * ```
 */

/**
 * Available prompt types
 */
export enum PromptType {
  ONBOARDING = 'onboarding',
  POLICY = 'policy',
  PROCEDURE = 'procedure',
  GENERAL = 'general',
}

/**
 * Fragment result from vector search
 */
export interface FragmentResult {
  id: string;
  content: string;
  similarity: number;
  sourceId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Context for building prompts
 */
export interface PromptContext {
  query: string;
  fragments: FragmentResult[];
  conversationHistory?: string[];
}

/**
 * System prompts for different types
 */
const SYSTEM_PROMPTS: Record<PromptType, string> = {
  [PromptType.ONBOARDING]: `You are an onboarding assistant for the company. Your role is to help new employees understand company policies, procedures, and guidelines.

IMPORTANT INSTRUCTIONS:
- Answer ONLY based on the provided documentation context below
- If the context doesn't contain the answer, say: "I don't have information about that in the current documentation."
- Be concise and clear in your response
- Reference the documentation sources when applicable
- Use a friendly, professional tone
- Focus on helping employees get started smoothly`,

  [PromptType.POLICY]: `You are a company policy assistant. Your role is to help employees understand company policies and regulations.

IMPORTANT INSTRUCTIONS:
- Answer ONLY based on the provided documentation context below
- If the context doesn't contain the answer, say: "I don't have information about that in the current documentation."
- Be precise and accurate when explaining policies
- Reference specific policy sections when applicable
- Use a clear, professional tone
- Highlight important policy requirements or restrictions`,

  [PromptType.PROCEDURE]: `You are a procedure assistant. Your role is to help employees follow company procedures correctly.

IMPORTANT INSTRUCTIONS:
- Answer ONLY based on the provided documentation context below
- If the context doesn't contain the answer, say: "I don't have information about that in the current documentation."
- Provide step-by-step guidance when explaining procedures
- Be specific and actionable in your instructions
- Reference documentation sections when applicable
- Use a clear, instructional tone`,

  [PromptType.GENERAL]: `You are a company assistant. Your role is to help employees with questions about the company.

IMPORTANT INSTRUCTIONS:
- Answer ONLY based on the provided documentation context below
- If the context doesn't contain the answer, say: "I don't have information about that in the current documentation."
- Be helpful and informative
- Reference the documentation sources when applicable
- Use a friendly, professional tone`,
};

/**
 * Prompt Service
 */
export class PromptService {
  /**
   * Build a complete prompt from context
   *
   * @param type - The type of prompt to build
   * @param context - The context including query, fragments, and history
   * @returns Formatted prompt string
   */
  buildPrompt(type: PromptType, context: PromptContext): string {
    // Safe: PromptType is a controlled enum
    // eslint-disable-next-line security/detect-object-injection
    const systemPrompt = SYSTEM_PROMPTS[type];
    const conversationSection = this.buildConversationSection(
      context.conversationHistory,
    );
    const contextSection = this.buildContextSection(context.fragments);

    const parts: string[] = [systemPrompt];

    // Add conversation history if present
    if (conversationSection) {
      parts.push(conversationSection);
    }

    // Add documentation context
    parts.push('DOCUMENTATION CONTEXT:');
    parts.push(contextSection);

    // Add user question
    parts.push('');
    parts.push('USER QUESTION:');
    parts.push(context.query);

    // Add response prompt
    parts.push('');
    parts.push('ANSWER:');

    return parts.join('\n');
  }

  /**
   * Build the context section from fragments
   *
   * @param fragments - Array of relevant fragments
   * @returns Formatted context string
   */
  buildContextSection(fragments: FragmentResult[]): string {
    if (fragments.length === 0) {
      return 'No relevant documentation found.';
    }

    return fragments
      .map((fragment, index) => {
        const number = index + 1;
        return `[${number}] ${fragment.content}`;
      })
      .join('\n\n');
  }

  /**
   * Build the conversation history section
   *
   * @param history - Array of conversation messages
   * @returns Formatted history string or empty if no history
   */
  buildConversationSection(history: string[] | undefined): string {
    if (!history || history.length === 0) {
      return '';
    }

    const historyText = history.join('\n');
    return `\nCONVERSATION HISTORY:\n${historyText}\n`;
  }

  /**
   * Get system prompt for a specific type
   *
   * @param type - The prompt type
   * @returns System prompt string
   */
  getSystemPrompt(type: PromptType): string {
    // Safe: PromptType is a controlled enum
    // eslint-disable-next-line security/detect-object-injection
    return SYSTEM_PROMPTS[type];
  }

  /**
   * Get all available prompt types
   *
   * @returns Array of prompt types
   */
  getAvailableTypes(): PromptType[] {
    return Object.values(PromptType);
  }
}

/**
 * Default prompt service instance
 */
export const defaultPromptService = new PromptService();
