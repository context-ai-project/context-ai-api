import { describe, it, expect, beforeEach } from '@jest/globals';
import { Message } from '@modules/interaction/domain/entities/message.entity';
import { MessageRole } from '@modules/interaction/domain/value-objects/message-role.vo';

describe('Message Entity', () => {
  let validProps: {
    conversationId: string;
    role: MessageRole;
    content: string;
  };

  beforeEach(() => {
    validProps = {
      conversationId: 'conv-123',
      role: 'user',
      content: 'How do I request vacation?',
    };
  });

  describe('Creation', () => {
    it('should create a message with valid data', () => {
      const message = new Message(validProps);

      expect(message).toBeDefined();
      expect(message.conversationId).toBe(validProps.conversationId);
      expect(message.role).toBe(validProps.role);
      expect(message.content).toBe(validProps.content);
      expect(message.createdAt).toBeInstanceOf(Date);
    });

    it('should generate an ID if not provided', () => {
      const message = new Message(validProps);

      expect(message.id).toBeDefined();
      expect(typeof message.id).toBe('string');
      expect(message.id.length).toBeGreaterThan(0);
    });

    it('should use provided ID if given', () => {
      const customId = 'msg-custom-123';
      const message = new Message({ ...validProps, id: customId });

      expect(message.id).toBe(customId);
    });

    it('should throw error if conversationId is empty', () => {
      expect(() => {
        new Message({ ...validProps, conversationId: '' });
      }).toThrow('Conversation ID is required');
    });

    it('should throw error if content is empty', () => {
      expect(() => {
        new Message({ ...validProps, content: '' });
      }).toThrow('Message content is required');
    });

    it('should throw error if content is only whitespace', () => {
      expect(() => {
        new Message({ ...validProps, content: '   ' });
      }).toThrow('Message content is required');
    });
  });

  describe('Message Roles', () => {
    it('should accept user role', () => {
      const message = new Message({ ...validProps, role: 'user' });
      expect(message.role).toBe('user');
    });

    it('should accept assistant role', () => {
      const message = new Message({ ...validProps, role: 'assistant' });
      expect(message.role).toBe('assistant');
    });

    it('should accept system role', () => {
      const message = new Message({ ...validProps, role: 'system' });
      expect(message.role).toBe('system');
    });

    it('should determine if message is from user', () => {
      const userMessage = new Message({ ...validProps, role: 'user' });
      const assistantMessage = new Message({
        ...validProps,
        role: 'assistant',
      });

      expect(userMessage.isFromUser()).toBe(true);
      expect(assistantMessage.isFromUser()).toBe(false);
    });

    it('should determine if message is from assistant', () => {
      const userMessage = new Message({ ...validProps, role: 'user' });
      const assistantMessage = new Message({
        ...validProps,
        role: 'assistant',
      });

      expect(userMessage.isFromAssistant()).toBe(false);
      expect(assistantMessage.isFromAssistant()).toBe(true);
    });

    it('should determine if message is system message', () => {
      const systemMessage = new Message({ ...validProps, role: 'system' });
      const userMessage = new Message({ ...validProps, role: 'user' });

      expect(systemMessage.isSystemMessage()).toBe(true);
      expect(userMessage.isSystemMessage()).toBe(false);
    });
  });

  describe('Content Management', () => {
    it('should get content length', () => {
      const message = new Message({
        ...validProps,
        content: 'Hello world',
      });

      expect(message.getContentLength()).toBe(11);
    });

    it('should trim content whitespace', () => {
      const message = new Message({
        ...validProps,
        content: '  Hello world  ',
      });

      expect(message.content).toBe('Hello world');
    });

    it('should preserve newlines in content', () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const message = new Message({ ...validProps, content });

      expect(message.content).toBe(content);
      expect(message.content.split('\n')).toHaveLength(3);
    });
  });

  describe('Metadata', () => {
    it('should store optional metadata', () => {
      const metadata = {
        sentiment: 0.8,
        intent: 'question',
        sourceFragments: ['frag-1', 'frag-2'],
      };

      const message = new Message({ ...validProps, metadata });

      expect(message.metadata).toEqual(metadata);
    });

    it('should handle messages without metadata', () => {
      const message = new Message(validProps);

      expect(message.metadata).toBeUndefined();
    });

    it('should get metadata value', () => {
      const message = new Message({
        ...validProps,
        metadata: { sentiment: 0.8, intent: 'question' },
      });

      expect(message.getMetadata('sentiment')).toBe(0.8);
      expect(message.getMetadata('intent')).toBe('question');
      expect(message.getMetadata('nonexistent')).toBeUndefined();
    });
  });

  describe('Validation', () => {
    it('should validate message state', () => {
      const message = new Message(validProps);

      expect(message.isValid()).toBe(true);
    });

    it('should validate message with all roles', () => {
      const userMsg = new Message({ ...validProps, role: 'user' });
      const assistantMsg = new Message({ ...validProps, role: 'assistant' });
      const systemMsg = new Message({ ...validProps, role: 'system' });

      expect(userMsg.isValid()).toBe(true);
      expect(assistantMsg.isValid()).toBe(true);
      expect(systemMsg.isValid()).toBe(true);
    });

    it('should validate message with metadata', () => {
      const message = new Message({
        ...validProps,
        metadata: { sentiment: 0.8 },
      });

      expect(message.isValid()).toBe(true);
    });
  });

  describe('Formatting', () => {
    it('should format message for display', () => {
      const message = new Message({
        ...validProps,
        role: 'user',
        content: 'How do I request vacation?',
      });

      const formatted = message.formatForDisplay();

      expect(formatted).toContain('user');
      expect(formatted).toContain('How do I request vacation?');
    });

    it('should format message for prompt context', () => {
      const userMessage = new Message({
        ...validProps,
        role: 'user',
        content: 'What is the policy?',
      });

      const assistantMessage = new Message({
        ...validProps,
        role: 'assistant',
        content: 'The policy is...',
      });

      expect(userMessage.formatForPrompt()).toBe('User: What is the policy?');
      expect(assistantMessage.formatForPrompt()).toBe(
        'Assistant: The policy is...',
      );
    });
  });

  describe('Equality', () => {
    it('should be equal to message with same ID', () => {
      const id = 'msg-123';
      const msg1 = new Message({ ...validProps, id });
      const msg2 = new Message({ ...validProps, id });

      expect(msg1.equals(msg2)).toBe(true);
    });

    it('should not be equal to message with different ID', () => {
      const msg1 = new Message({ ...validProps, id: 'msg-1' });
      const msg2 = new Message({ ...validProps, id: 'msg-2' });

      expect(msg1.equals(msg2)).toBe(false);
    });
  });

  describe('Timestamps', () => {
    it('should track creation time', () => {
      const beforeCreate = new Date();
      const message = new Message(validProps);
      const afterCreate = new Date();

      expect(message.createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime(),
      );
      expect(message.createdAt.getTime()).toBeLessThanOrEqual(
        afterCreate.getTime(),
      );
    });
  });

  describe('Content Constraints', () => {
    it('should accept content up to reasonable length', () => {
      const longContent = 'a'.repeat(10000);
      const message = new Message({ ...validProps, content: longContent });

      expect(message.content).toBe(longContent);
      expect(message.getContentLength()).toBe(10000);
    });

    it('should handle special characters', () => {
      const content = 'Hello! @user #tag $100 & more...';
      const message = new Message({ ...validProps, content });

      expect(message.content).toBe(content);
    });

    it('should handle unicode characters', () => {
      const content = 'Hello 👋 Español ñ 中文';
      const message = new Message({ ...validProps, content });

      expect(message.content).toBe(content);
    });
  });
});

