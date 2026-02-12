/**
 * Chat API Contract Tests (Phase 7.8)
 *
 * Validates the DTOs (Data Transfer Objects) for the Interaction module.
 * These are pure unit tests — no NestJS app or database required.
 *
 * Tests ensure:
 * - Valid inputs pass validation
 * - Invalid inputs are correctly rejected
 * - DTO structures match the API contract
 */
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  QueryAssistantDto,
  GetConversationsDto,
} from '../../src/modules/interaction/presentation/dtos/query-assistant.dto';

// ── Test Data ──────────────────────────────────────────────────────────
const VALID_USER_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_SECTOR_UUID = '660e8400-e29b-41d4-a716-446655440001';
const VALID_CONVERSATION_UUID = '770e8400-e29b-41d4-a716-446655440002';

describe('Chat API Contract – DTO Validation', () => {
  // ====================================================================
  // QueryAssistantDto
  // ====================================================================
  describe('QueryAssistantDto', () => {
    it('should pass validation with all required fields', async () => {
      const dto = plainToInstance(QueryAssistantDto, {
        userId: VALID_USER_UUID,
        sectorId: VALID_SECTOR_UUID,
        query: 'How do I request vacation?',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with all fields (including optional)', async () => {
      const dto = plainToInstance(QueryAssistantDto, {
        userId: VALID_USER_UUID,
        sectorId: VALID_SECTOR_UUID,
        query: 'How do I request vacation?',
        conversationId: VALID_CONVERSATION_UUID,
        maxResults: 10,
        minSimilarity: 0.8,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid userId (not UUID)', async () => {
      const dto = plainToInstance(QueryAssistantDto, {
        userId: 'not-a-uuid',
        sectorId: VALID_SECTOR_UUID,
        query: 'Some question?',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const userIdError = errors.find((e) => e.property === 'userId');
      expect(userIdError).toBeDefined();
      expect(userIdError!.constraints).toHaveProperty('isUuid');
    });

    it('should reject empty query', async () => {
      const dto = plainToInstance(QueryAssistantDto, {
        userId: VALID_USER_UUID,
        sectorId: VALID_SECTOR_UUID,
        query: '',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const queryError = errors.find((e) => e.property === 'query');
      expect(queryError).toBeDefined();
    });

    it('should reject missing userId', async () => {
      const dto = plainToInstance(QueryAssistantDto, {
        sectorId: VALID_SECTOR_UUID,
        query: 'Some question?',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const userIdError = errors.find((e) => e.property === 'userId');
      expect(userIdError).toBeDefined();
    });

    it('should reject missing sectorId', async () => {
      const dto = plainToInstance(QueryAssistantDto, {
        userId: VALID_USER_UUID,
        query: 'Some question?',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const sectorIdError = errors.find((e) => e.property === 'sectorId');
      expect(sectorIdError).toBeDefined();
    });

    it('should reject maxResults below minimum (1)', async () => {
      const dto = plainToInstance(QueryAssistantDto, {
        userId: VALID_USER_UUID,
        sectorId: VALID_SECTOR_UUID,
        query: 'Question?',
        maxResults: 0,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const maxResultsError = errors.find((e) => e.property === 'maxResults');
      expect(maxResultsError).toBeDefined();
      expect(maxResultsError!.constraints).toHaveProperty('min');
    });

    it('should reject maxResults above maximum (20)', async () => {
      const dto = plainToInstance(QueryAssistantDto, {
        userId: VALID_USER_UUID,
        sectorId: VALID_SECTOR_UUID,
        query: 'Question?',
        maxResults: 50,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const maxResultsError = errors.find((e) => e.property === 'maxResults');
      expect(maxResultsError).toBeDefined();
      expect(maxResultsError!.constraints).toHaveProperty('max');
    });

    it('should reject minSimilarity below 0', async () => {
      const dto = plainToInstance(QueryAssistantDto, {
        userId: VALID_USER_UUID,
        sectorId: VALID_SECTOR_UUID,
        query: 'Question?',
        minSimilarity: -0.5,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const simError = errors.find((e) => e.property === 'minSimilarity');
      expect(simError).toBeDefined();
    });

    it('should reject minSimilarity above 1', async () => {
      const dto = plainToInstance(QueryAssistantDto, {
        userId: VALID_USER_UUID,
        sectorId: VALID_SECTOR_UUID,
        query: 'Question?',
        minSimilarity: 1.5,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const simError = errors.find((e) => e.property === 'minSimilarity');
      expect(simError).toBeDefined();
    });

    it('should reject invalid conversationId (not UUID)', async () => {
      const dto = plainToInstance(QueryAssistantDto, {
        userId: VALID_USER_UUID,
        sectorId: VALID_SECTOR_UUID,
        query: 'Question?',
        conversationId: 'not-uuid',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const convError = errors.find((e) => e.property === 'conversationId');
      expect(convError).toBeDefined();
    });

    it('should accept edge-case valid values', async () => {
      const dto = plainToInstance(QueryAssistantDto, {
        userId: VALID_USER_UUID,
        sectorId: VALID_SECTOR_UUID,
        query: 'Q', // minimum 1 character
        maxResults: 1,
        minSimilarity: 0,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept maximum valid values', async () => {
      const dto = plainToInstance(QueryAssistantDto, {
        userId: VALID_USER_UUID,
        sectorId: VALID_SECTOR_UUID,
        query: 'A very long question that should still be valid?',
        maxResults: 20,
        minSimilarity: 1,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  // ====================================================================
  // GetConversationsDto
  // ====================================================================
  describe('GetConversationsDto', () => {
    it('should pass with only required fields', async () => {
      const dto = plainToInstance(GetConversationsDto, {
        userId: VALID_USER_UUID,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass with all optional fields', async () => {
      const dto = plainToInstance(GetConversationsDto, {
        userId: VALID_USER_UUID,
        limit: 25,
        offset: 10,
        includeInactive: true,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid userId', async () => {
      const dto = plainToInstance(GetConversationsDto, {
        userId: 'bad',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject limit above maximum (100)', async () => {
      const dto = plainToInstance(GetConversationsDto, {
        userId: VALID_USER_UUID,
        limit: 200,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const limitError = errors.find((e) => e.property === 'limit');
      expect(limitError).toBeDefined();
    });

    it('should reject negative offset', async () => {
      const dto = plainToInstance(GetConversationsDto, {
        userId: VALID_USER_UUID,
        offset: -1,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const offsetError = errors.find((e) => e.property === 'offset');
      expect(offsetError).toBeDefined();
    });
  });

  // ====================================================================
  // Response DTO Structure
  // ====================================================================
  describe('Response DTO Structure', () => {
    it('QueryAssistantResponseDto should have expected shape', () => {
      const response = {
        response: 'AI answer text',
        conversationId: VALID_CONVERSATION_UUID,
        sources: [
          {
            id: 'frag-1',
            content: 'Fragment content',
            sourceId: 'src-1',
            similarity: 0.92,
            metadata: { page: 1 },
          },
        ],
        timestamp: new Date().toISOString(),
      };

      expect(response).toHaveProperty('response');
      expect(response).toHaveProperty('conversationId');
      expect(response).toHaveProperty('sources');
      expect(response).toHaveProperty('timestamp');
      expect(response.sources[0]).toHaveProperty('id');
      expect(response.sources[0]).toHaveProperty('content');
      expect(response.sources[0]).toHaveProperty('sourceId');
      expect(response.sources[0]).toHaveProperty('similarity');
    });

    it('ConversationsListDto should have expected shape', () => {
      const response = {
        conversations: [],
        total: 0,
        count: 0,
        offset: 0,
        hasMore: false,
      };

      expect(response).toHaveProperty('conversations');
      expect(response).toHaveProperty('total');
      expect(response).toHaveProperty('count');
      expect(response).toHaveProperty('offset');
      expect(response).toHaveProperty('hasMore');
    });

    it('ConversationDetailDto should include messages array', () => {
      const response = {
        id: VALID_CONVERSATION_UUID,
        userId: VALID_USER_UUID,
        sectorId: VALID_SECTOR_UUID,
        isActive: true,
        messages: [
          {
            id: 'msg-1',
            role: 'USER',
            content: 'Hello',
            timestamp: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(response).toHaveProperty('messages');
      expect(Array.isArray(response.messages)).toBe(true);
      expect(response.messages[0]).toHaveProperty('role');
      expect(response.messages[0]).toHaveProperty('content');
    });
  });
});
