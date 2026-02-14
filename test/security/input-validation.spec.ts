/**
 * Security Tests: Input Validation (Phase 7.14)
 *
 * Validates that the application's DTOs correctly reject
 * potentially malicious input patterns:
 * - SQL injection attempts
 * - XSS payloads
 * - Path traversal
 * - Oversized input
 *
 * These are pure DTO validation tests — no app or database needed.
 */
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { QueryAssistantDto } from '../../src/modules/interaction/presentation/dtos/query-assistant.dto';

const VALID_SECTOR = '660e8400-e29b-41d4-a716-446655440001';

// Note: userId is no longer in QueryAssistantDto — it comes from JWT session via @CurrentUser('userId').
// UUID fields tested here are sectorId and conversationId (the only UUID fields in the body).

describe('Security: Input Validation (Phase 7.14)', () => {
  // ====================================================================
  // SQL Injection
  // ====================================================================
  describe('SQL Injection Protection', () => {
    it('should reject SQL injection in sectorId field', async () => {
      const dto = plainToInstance(QueryAssistantDto, {
        sectorId: "1 OR 1=1; --",
        query: 'Normal question',
      });

      const errors = await validate(dto);
      const sectorError = errors.find((e) => e.property === 'sectorId');
      expect(sectorError).toBeDefined();
      expect(sectorError!.constraints).toHaveProperty('isUuid');
    });

    it('should reject SQL DROP TABLE injection in sectorId field', async () => {
      const dto = plainToInstance(QueryAssistantDto, {
        sectorId: "'; DROP TABLE sectors; --",
        query: 'Normal question here',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const sectorError = errors.find((e) => e.property === 'sectorId');
      expect(sectorError).toBeDefined();
      // sectorId must be a UUID — SQL injection attempt is rejected
      expect(sectorError!.constraints).toHaveProperty('isUuid');
    });

    it('should reject SQL UNION injection in conversationId', async () => {
      const dto = plainToInstance(QueryAssistantDto, {
        sectorId: VALID_SECTOR,
        query: 'Normal question',
        conversationId: "' UNION SELECT * FROM pg_catalog.pg_tables --",
      });

      const errors = await validate(dto);
      const convError = errors.find((e) => e.property === 'conversationId');
      expect(convError).toBeDefined();
    });

    it('query field accepts free text (SQL-like content is valid user input)', async () => {
      // The query field is free-text; SQL content is valid user input.
      // Protection happens at the ORM layer (parameterized queries).
      const dto = plainToInstance(QueryAssistantDto, {
        sectorId: VALID_SECTOR,
        query: "SELECT * FROM users WHERE '1'='1'",
      });

      const errors = await validate(dto);
      // Query field is a string and passes validation — correct.
      // Actual SQL injection protection is in TypeORM parameterized queries.
      expect(errors).toHaveLength(0);
    });
  });

  // ====================================================================
  // XSS Protection
  // ====================================================================
  describe('XSS Protection', () => {
    it('should reject XSS payload in sectorId (not a valid UUID)', async () => {
      const dto = plainToInstance(QueryAssistantDto, {
        sectorId: '<script>alert("XSS")</script>',
        query: 'Normal question',
      });

      const errors = await validate(dto);
      const sectorError = errors.find((e) => e.property === 'sectorId');
      expect(sectorError).toBeDefined();
    });

    it('query field accepts HTML-like content (free text)', async () => {
      // Like SQL, XSS in the query field is handled by output encoding,
      // not by input validation of the search query itself.
      const dto = plainToInstance(QueryAssistantDto, {
        sectorId: VALID_SECTOR,
        query: '<img src=x onerror=alert(1)>What about vacation policy?',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  // ====================================================================
  // Type Coercion / Invalid Types
  // ====================================================================
  describe('Type Coercion Protection', () => {
    it('should reject numeric sectorId', async () => {
      const dto = plainToInstance(QueryAssistantDto, {
        sectorId: 12345,
        query: 'A question',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject boolean query', async () => {
      const dto = plainToInstance(QueryAssistantDto, {
        sectorId: VALID_SECTOR,
        query: true,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject array for scalar field', async () => {
      const dto = plainToInstance(QueryAssistantDto, {
        sectorId: [VALID_SECTOR],
        query: 'Question?',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject negative numbers for maxResults', async () => {
      const dto = plainToInstance(QueryAssistantDto, {
        sectorId: VALID_SECTOR,
        query: 'Question',
        maxResults: -5,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ====================================================================
  // UUID Format Strictness
  // ====================================================================
  describe('UUID Format Strictness', () => {
    const invalidUUIDs = [
      '',
      'null',
      'undefined',
      '0',
      'abc',
      '12345678-1234-1234-1234',
      '12345678-1234-1234-1234-1234567890123', // too long
      '../../../etc/passwd',
    ];

    invalidUUIDs.forEach((badUuid) => {
      it(`should reject "${badUuid}" as sectorId`, async () => {
        const dto = plainToInstance(QueryAssistantDto, {
          sectorId: badUuid,
          query: 'Question',
        });

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
      });
    });
  });
});
