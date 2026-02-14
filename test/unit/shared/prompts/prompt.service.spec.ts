import { describe, it, expect } from '@jest/globals';
import {
  PromptService,
  PromptType,
  PromptContext,
  defaultPromptService,
} from '@shared/prompts';

describe('PromptService', () => {
  let promptService: PromptService;

  beforeEach(() => {
    promptService = new PromptService();
  });

  describe('buildPrompt', () => {
    it('should build basic onboarding prompt without context', () => {
      const context: PromptContext = {
        query: 'How do I request vacation?',
        fragments: [
          {
            id: 'frag-1',
            content: 'Vacation requests must be submitted 15 days in advance.',
            similarity: 0.9,
            sourceId: 'source-1',
          },
        ],
      };

      const prompt = promptService.buildPrompt(
        PromptType.ONBOARDING,
        context,
      );

      expect(prompt).toContain('onboarding assistant');
      expect(prompt).toContain('How do I request vacation?');
      expect(prompt).toContain(
        'Vacation requests must be submitted 15 days in advance',
      );
      expect(prompt).toContain('DOCUMENTATION CONTEXT');
    });

    it('should build prompt with conversation history', () => {
      const context: PromptContext = {
        query: 'What about remote work?',
        fragments: [
          {
            id: 'frag-1',
            content: 'Remote work is allowed 2 days per week.',
            similarity: 0.85,
            sourceId: 'source-1',
          },
        ],
        conversationHistory: [
          'User: How do I request vacation?',
          'Assistant: You need to submit the request 15 days in advance.',
        ],
      };

      const prompt = promptService.buildPrompt(
        PromptType.ONBOARDING,
        context,
      );

      expect(prompt).toContain('CONVERSATION HISTORY');
      expect(prompt).toContain('How do I request vacation?');
      expect(prompt).toContain(
        'You need to submit the request 15 days in advance',
      );
      expect(prompt).toContain('What about remote work?');
    });

    it('should handle no fragments scenario', () => {
      const context: PromptContext = {
        query: 'Unknown topic',
        fragments: [],
      };

      const prompt = promptService.buildPrompt(
        PromptType.ONBOARDING,
        context,
      );

      expect(prompt).toContain('No relevant documentation found');
      expect(prompt).toContain('Unknown topic');
    });

    it('should build policy-specific prompts', () => {
      const context: PromptContext = {
        query: 'What is the dress code?',
        fragments: [
          {
            id: 'frag-1',
            content: 'Business casual is the standard dress code.',
            similarity: 0.9,
            sourceId: 'source-1',
          },
        ],
      };

      const prompt = promptService.buildPrompt(PromptType.POLICY, context);

      expect(prompt).toContain('policy');
      expect(prompt).toContain('dress code');
    });

    it('should build procedure-specific prompts', () => {
      const context: PromptContext = {
        query: 'How to submit expenses?',
        fragments: [
          {
            id: 'frag-1',
            content: 'Submit expenses through the finance portal.',
            similarity: 0.88,
            sourceId: 'source-1',
          },
        ],
      };

      const prompt = promptService.buildPrompt(PromptType.PROCEDURE, context);

      expect(prompt).toContain('procedure');
      expect(prompt).toContain('step-by-step');
    });

    it('should number documentation fragments', () => {
      const context: PromptContext = {
        query: 'Test query',
        fragments: [
          {
            id: 'frag-1',
            content: 'First fragment',
            similarity: 0.9,
            sourceId: 'source-1',
          },
          {
            id: 'frag-2',
            content: 'Second fragment',
            similarity: 0.85,
            sourceId: 'source-2',
          },
          {
            id: 'frag-3',
            content: 'Third fragment',
            similarity: 0.8,
            sourceId: 'source-3',
          },
        ],
      };

      const prompt = promptService.buildPrompt(
        PromptType.ONBOARDING,
        context,
      );

      expect(prompt).toContain('[1] First fragment');
      expect(prompt).toContain('[2] Second fragment');
      expect(prompt).toContain('[3] Third fragment');
    });

    it('should include system instructions', () => {
      const context: PromptContext = {
        query: 'Test',
        fragments: [],
      };

      const prompt = promptService.buildPrompt(
        PromptType.ONBOARDING,
        context,
      );

      expect(prompt).toContain('IMPORTANT INSTRUCTIONS');
      expect(prompt).toContain('Answer ONLY based on');
      expect(prompt).toContain('professional tone');
    });
  });

  describe('buildContextSection', () => {
    it('should format fragments with numbering', () => {
      const fragments = [
        {
          id: 'frag-1',
          content: 'Content 1',
          similarity: 0.9,
          sourceId: 'source-1',
        },
        {
          id: 'frag-2',
          content: 'Content 2',
          similarity: 0.85,
          sourceId: 'source-2',
        },
      ];

      const contextSection = promptService.buildContextSection(fragments);

      expect(contextSection).toContain('[1]');
      expect(contextSection).toContain('[2]');
      expect(contextSection).toContain('Content 1');
      expect(contextSection).toContain('Content 2');
    });

    it('should return fallback message for empty fragments', () => {
      const contextSection = promptService.buildContextSection([]);

      expect(contextSection).toBe('No relevant documentation found.');
    });
  });

  describe('buildConversationSection', () => {
    it('should format conversation history', () => {
      const history = [
        'User: First question',
        'Assistant: First answer',
        'User: Second question',
      ];

      const section = promptService.buildConversationSection(history);

      expect(section).toContain('CONVERSATION HISTORY');
      expect(section).toContain('First question');
      expect(section).toContain('First answer');
      expect(section).toContain('Second question');
    });

    it('should return empty string for no history', () => {
      const section = promptService.buildConversationSection([]);

      expect(section).toBe('');
    });

    it('should return empty string for undefined history', () => {
      const section = promptService.buildConversationSection(undefined);

      expect(section).toBe('');
    });
  });

  describe('Prompt Type Variations', () => {
    const baseContext: PromptContext = {
      query: 'Test query',
      fragments: [
        {
          id: 'frag-1',
          content: 'Test content',
          similarity: 0.9,
          sourceId: 'source-1',
        },
      ],
    };

    it('should have different system prompts for different types', () => {
      const onboardingPrompt = promptService.buildPrompt(
        PromptType.ONBOARDING,
        baseContext,
      );
      const policyPrompt = promptService.buildPrompt(
        PromptType.POLICY,
        baseContext,
      );
      const procedurePrompt = promptService.buildPrompt(
        PromptType.PROCEDURE,
        baseContext,
      );
      const generalPrompt = promptService.buildPrompt(
        PromptType.GENERAL,
        baseContext,
      );

      expect(onboardingPrompt).not.toBe(policyPrompt);
      expect(policyPrompt).not.toBe(procedurePrompt);
      expect(procedurePrompt).not.toBe(generalPrompt);
    });

    it('should use default type when not specified', () => {
      const defaultPrompt = promptService.buildPrompt(
        PromptType.GENERAL,
        baseContext,
      );

      expect(defaultPrompt).toContain('assistant');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long fragment content', () => {
      const longContent = 'A'.repeat(5000);
      const context: PromptContext = {
        query: 'Test',
        fragments: [
          {
            id: 'frag-1',
            content: longContent,
            similarity: 0.9,
            sourceId: 'source-1',
          },
        ],
      };

      const prompt = promptService.buildPrompt(
        PromptType.ONBOARDING,
        context,
      );

      expect(prompt).toContain(longContent);
      expect(prompt.length).toBeGreaterThan(5000);
    });

    it('should handle special characters in query', () => {
      const context: PromptContext = {
        query: 'What about "special" & <characters>?',
        fragments: [],
      };

      const prompt = promptService.buildPrompt(
        PromptType.ONBOARDING,
        context,
      );

      expect(prompt).toContain('What about "special" & <characters>?');
    });

    it('should handle fragments with metadata', () => {
      const context: PromptContext = {
        query: 'Test',
        fragments: [
          {
            id: 'frag-1',
            content: 'Content',
            similarity: 0.9,
            sourceId: 'source-1',
            metadata: { page: 1, section: 'intro' },
          },
        ],
      };

      const prompt = promptService.buildPrompt(
        PromptType.ONBOARDING,
        context,
      );

      expect(prompt).toContain('Content');
    });
  });

  describe('getSystemPrompt', () => {
    it('should return the system prompt for a valid type', () => {
      const prompt = promptService.getSystemPrompt(PromptType.ONBOARDING);

      expect(prompt).toContain('onboarding assistant');
      expect(prompt).toContain('IMPORTANT INSTRUCTIONS');
    });

    it('should return different prompts for each type', () => {
      const onboarding = promptService.getSystemPrompt(PromptType.ONBOARDING);
      const policy = promptService.getSystemPrompt(PromptType.POLICY);
      const procedure = promptService.getSystemPrompt(PromptType.PROCEDURE);
      const general = promptService.getSystemPrompt(PromptType.GENERAL);

      expect(onboarding).not.toBe(policy);
      expect(policy).not.toBe(procedure);
      expect(procedure).not.toBe(general);
    });

    it('should throw for an unknown prompt type', () => {
      expect(() =>
        promptService.getSystemPrompt('unknown' as PromptType),
      ).toThrow('Unknown prompt type: unknown');
    });
  });

  describe('getAvailableTypes', () => {
    it('should return all prompt types', () => {
      const types = promptService.getAvailableTypes();

      expect(types).toContain(PromptType.ONBOARDING);
      expect(types).toContain(PromptType.POLICY);
      expect(types).toContain(PromptType.PROCEDURE);
      expect(types).toContain(PromptType.GENERAL);
      expect(types).toHaveLength(4);
    });
  });

  describe('buildPrompt error handling', () => {
    it('should throw for an unknown prompt type', () => {
      const context: PromptContext = {
        query: 'Test',
        fragments: [],
      };

      expect(() =>
        promptService.buildPrompt('invalid' as PromptType, context),
      ).toThrow('Unknown prompt type: invalid');
    });
  });

  describe('defaultPromptService', () => {
    it('should be a PromptService instance', () => {
      expect(defaultPromptService).toBeInstanceOf(PromptService);
    });

    it('should be functional', () => {
      const types = defaultPromptService.getAvailableTypes();

      expect(types).toHaveLength(4);
    });
  });
});

