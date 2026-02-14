import { describe, it, expect, beforeEach } from '@jest/globals';
import { Conversation } from '@modules/interaction/domain/entities/conversation.entity';
import { Message } from '@modules/interaction/domain/entities/message.entity';

describe('Conversation Entity', () => {
  let validProps: {
    userId: string;
    sectorId: string;
  };

  beforeEach(() => {
    validProps = {
      userId: 'user-123',
      sectorId: 'sector-456',
    };
  });

  describe('Creation', () => {
    it('should create a conversation with valid data', () => {
      const conversation = new Conversation(validProps);

      expect(conversation).toBeDefined();
      expect(conversation.userId).toBe(validProps.userId);
      expect(conversation.sectorId).toBe(validProps.sectorId);
      expect(conversation.messages).toEqual([]);
      expect(conversation.createdAt).toBeInstanceOf(Date);
    });

    it('should generate an ID if not provided', () => {
      const conversation = new Conversation(validProps);

      expect(conversation.id).toBeDefined();
      expect(typeof conversation.id).toBe('string');
      expect(conversation.id.length).toBeGreaterThan(0);
    });

    it('should use provided ID if given', () => {
      const customId = 'conv-custom-123';
      const conversation = new Conversation({ ...validProps, id: customId });

      expect(conversation.id).toBe(customId);
    });

    it('should throw error if userId is empty', () => {
      expect(() => {
        new Conversation({ ...validProps, userId: '' });
      }).toThrow('User ID is required');
    });

    it('should throw error if sectorId is empty', () => {
      expect(() => {
        new Conversation({ ...validProps, sectorId: '' });
      }).toThrow('Sector ID is required');
    });
  });

  describe('Messages Management', () => {
    it('should add a message to the conversation', () => {
      const conversation = new Conversation(validProps);
      const message = new Message({
        conversationId: conversation.id,
        role: 'user',
        content: 'Hello, how can I request vacation?',
      });

      conversation.addMessage(message);

      expect(conversation.messages).toHaveLength(1);
      expect(conversation.messages[0]).toBe(message);
    });

    it('should maintain message order', () => {
      const conversation = new Conversation(validProps);
      const message1 = new Message({
        conversationId: conversation.id,
        role: 'user',
        content: 'First message',
      });
      const message2 = new Message({
        conversationId: conversation.id,
        role: 'assistant',
        content: 'Second message',
      });

      conversation.addMessage(message1);
      conversation.addMessage(message2);

      expect(conversation.messages).toHaveLength(2);
      expect(conversation.messages[0]).toBe(message1);
      expect(conversation.messages[1]).toBe(message2);
    });

    it('should throw error when adding message from different conversation', () => {
      const conversation = new Conversation(validProps);
      const message = new Message({
        conversationId: 'different-conv-id',
        role: 'user',
        content: 'Test',
      });

      expect(() => {
        conversation.addMessage(message);
      }).toThrow('Message does not belong to this conversation');
    });

    it('should get message count', () => {
      const conversation = new Conversation(validProps);

      expect(conversation.getMessageCount()).toBe(0);

      conversation.addMessage(
        new Message({
          conversationId: conversation.id,
          role: 'user',
          content: 'Test',
        }),
      );

      expect(conversation.getMessageCount()).toBe(1);
    });

    it('should check if conversation has messages', () => {
      const conversation = new Conversation(validProps);

      expect(conversation.hasMessages()).toBe(false);

      conversation.addMessage(
        new Message({
          conversationId: conversation.id,
          role: 'user',
          content: 'Test',
        }),
      );

      expect(conversation.hasMessages()).toBe(true);
    });
  });

  describe('Last Message Queries', () => {
    it('should return last user message', () => {
      const conversation = new Conversation(validProps);

      conversation.addMessage(
        new Message({
          conversationId: conversation.id,
          role: 'user',
          content: 'First user message',
        }),
      );
      conversation.addMessage(
        new Message({
          conversationId: conversation.id,
          role: 'assistant',
          content: 'Assistant reply',
        }),
      );
      conversation.addMessage(
        new Message({
          conversationId: conversation.id,
          role: 'user',
          content: 'Second user message',
        }),
      );

      const lastUserMsg = conversation.getLastUserMessage();

      expect(lastUserMsg).toBeDefined();
      expect(lastUserMsg!.content).toBe('Second user message');
      expect(lastUserMsg!.isFromUser()).toBe(true);
    });

    it('should return last assistant message', () => {
      const conversation = new Conversation(validProps);

      conversation.addMessage(
        new Message({
          conversationId: conversation.id,
          role: 'user',
          content: 'User question',
        }),
      );
      conversation.addMessage(
        new Message({
          conversationId: conversation.id,
          role: 'assistant',
          content: 'First assistant reply',
        }),
      );
      conversation.addMessage(
        new Message({
          conversationId: conversation.id,
          role: 'user',
          content: 'Follow-up',
        }),
      );
      conversation.addMessage(
        new Message({
          conversationId: conversation.id,
          role: 'assistant',
          content: 'Second assistant reply',
        }),
      );

      const lastAssistantMsg = conversation.getLastAssistantMessage();

      expect(lastAssistantMsg).toBeDefined();
      expect(lastAssistantMsg!.content).toBe('Second assistant reply');
      expect(lastAssistantMsg!.isFromAssistant()).toBe(true);
    });

    it('should return undefined when no user messages exist', () => {
      const conversation = new Conversation(validProps);

      conversation.addMessage(
        new Message({
          conversationId: conversation.id,
          role: 'assistant',
          content: 'Only assistant here',
        }),
      );

      expect(conversation.getLastUserMessage()).toBeUndefined();
    });

    it('should return undefined when no assistant messages exist', () => {
      const conversation = new Conversation(validProps);

      conversation.addMessage(
        new Message({
          conversationId: conversation.id,
          role: 'user',
          content: 'Only user here',
        }),
      );

      expect(conversation.getLastAssistantMessage()).toBeUndefined();
    });

    it('should return undefined for empty conversation', () => {
      const conversation = new Conversation(validProps);

      expect(conversation.getLastUserMessage()).toBeUndefined();
      expect(conversation.getLastAssistantMessage()).toBeUndefined();
    });
  });

  describe('Conversation Context', () => {
    it('should get conversation context for RAG', () => {
      const conversation = new Conversation(validProps);
      
      conversation.addMessage(
        new Message({
          conversationId: conversation.id,
          role: 'user',
          content: 'What is the vacation policy?',
        }),
      );
      
      conversation.addMessage(
        new Message({
          conversationId: conversation.id,
          role: 'assistant',
          content: 'You need to request 15 days in advance.',
        }),
      );

      const context = conversation.getContextForPrompt();

      expect(context).toContain('What is the vacation policy?');
      expect(context).toContain('You need to request 15 days in advance.');
    });

    it('should limit context to last N messages', () => {
      const conversation = new Conversation(validProps);

      for (let i = 1; i <= 10; i++) {
        conversation.addMessage(
          new Message({
            conversationId: conversation.id,
            role: i % 2 === 1 ? 'user' : 'assistant',
            content: `Message content ${i}`,
          }),
        );
      }

      const context = conversation.getContextForPrompt(4);
      const lines = context.split('\n').filter((line) => line.trim());

      // Should include last 4 messages (messages 7, 8, 9, 10)
      expect(lines.length).toBe(4);
      expect(context).toContain('content 7'); // First of last 4
      expect(context).toContain('content 9'); // Middle of last 4
      expect(context).not.toContain('content 6'); // Not in last 4
      expect(context).not.toContain('content 5'); // Not in last 4
      expect(context).not.toContain('content 2'); // Not in last 4
    });
  });

  describe('Validation', () => {
    it('should validate conversation state', () => {
      const conversation = new Conversation(validProps);

      expect(conversation.isValid()).toBe(true);
    });

    it('should validate conversation with messages', () => {
      const conversation = new Conversation(validProps);
      conversation.addMessage(
        new Message({
          conversationId: conversation.id,
          role: 'user',
          content: 'Test message',
        }),
      );

      expect(conversation.isValid()).toBe(true);
    });
  });

  describe('Equality', () => {
    it('should be equal to conversation with same ID', () => {
      const id = 'conv-123';
      const conv1 = new Conversation({ ...validProps, id });
      const conv2 = new Conversation({ ...validProps, id });

      expect(conv1.equals(conv2)).toBe(true);
    });

    it('should not be equal to conversation with different ID', () => {
      const conv1 = new Conversation({ ...validProps, id: 'conv-1' });
      const conv2 = new Conversation({ ...validProps, id: 'conv-2' });

      expect(conv1.equals(conv2)).toBe(false);
    });
  });

  describe('Timestamps', () => {
    it('should track creation time', () => {
      const beforeCreate = new Date();
      const conversation = new Conversation(validProps);
      const afterCreate = new Date();

      expect(conversation.createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime(),
      );
      expect(conversation.createdAt.getTime()).toBeLessThanOrEqual(
        afterCreate.getTime(),
      );
    });

    it('should update updatedAt when adding messages', () => {
      const conversation = new Conversation(validProps);
      const initialUpdatedAt = conversation.updatedAt;

      // Wait a bit to ensure time difference
      setTimeout(() => {
        conversation.addMessage(
          new Message({
            conversationId: conversation.id,
            role: 'user',
            content: 'Test',
          }),
        );

        expect(conversation.updatedAt.getTime()).toBeGreaterThanOrEqual(
          initialUpdatedAt.getTime(),
        );
      }, 10);
    });
  });
});

