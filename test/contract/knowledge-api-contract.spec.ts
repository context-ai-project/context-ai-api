/**
 * Knowledge API Contract Tests (Phase 7.8)
 *
 * Validates the DTOs and response structures for the Knowledge module.
 * These are pure unit tests — no NestJS app or database required.
 *
 * Tests ensure:
 * - IngestDocumentDto / IngestDocumentResult match the API contract
 * - DeleteSourceDto / DeleteSourceResult match the API contract
 * - SourceType and SourceStatus enums are exhaustive
 */
import {
  IngestDocumentDto,
  IngestDocumentResult,
} from '../../src/modules/knowledge/application/dtos/ingest-document.dto';
import {
  DeleteSourceDto,
  DeleteSourceResult,
} from '../../src/modules/knowledge/application/dtos/delete-source.dto';
import { SourceType } from '../../src/shared/types/enums/source-type.enum';
import { SourceStatus } from '../../src/shared/types/enums/source-status.enum';

// ── Test Data ──────────────────────────────────────────────────────────
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_SECTOR_UUID = '660e8400-e29b-41d4-a716-446655440001';

describe('Knowledge API Contract – DTO & Enum Validation', () => {
  // ====================================================================
  // SourceType enum
  // ====================================================================
  describe('SourceType enum', () => {
    it('should contain exactly PDF, MARKDOWN, URL', () => {
      expect(Object.values(SourceType)).toEqual(
        expect.arrayContaining(['PDF', 'MARKDOWN', 'URL']),
      );
      expect(Object.values(SourceType)).toHaveLength(3);
    });

    it('should expose correct string values', () => {
      expect(SourceType.PDF).toBe('PDF');
      expect(SourceType.MARKDOWN).toBe('MARKDOWN');
      expect(SourceType.URL).toBe('URL');
    });
  });

  // ====================================================================
  // SourceStatus enum
  // ====================================================================
  describe('SourceStatus enum', () => {
    it('should contain all lifecycle statuses', () => {
      expect(Object.values(SourceStatus)).toEqual(
        expect.arrayContaining([
          'PENDING',
          'PROCESSING',
          'COMPLETED',
          'FAILED',
          'DELETED',
        ]),
      );
      expect(Object.values(SourceStatus)).toHaveLength(5);
    });
  });

  // ====================================================================
  // IngestDocumentDto contract
  // ====================================================================
  describe('IngestDocumentDto', () => {
    it('should accept a valid minimal ingest request', () => {
      const dto: IngestDocumentDto = {
        title: 'Company Handbook',
        sectorId: VALID_SECTOR_UUID,
        sourceType: SourceType.PDF,
        buffer: Buffer.from('dummy pdf content'),
      };

      expect(dto.title).toBe('Company Handbook');
      expect(dto.sectorId).toBe(VALID_SECTOR_UUID);
      expect(dto.sourceType).toBe(SourceType.PDF);
      expect(Buffer.isBuffer(dto.buffer)).toBe(true);
      expect(dto.metadata).toBeUndefined();
    });

    it('should accept optional metadata', () => {
      const dto: IngestDocumentDto = {
        title: 'Policy doc',
        sectorId: VALID_SECTOR_UUID,
        sourceType: SourceType.MARKDOWN,
        buffer: Buffer.from('# Policy'),
        metadata: { author: 'HR', version: '2.0' },
      };

      expect(dto.metadata).toEqual({ author: 'HR', version: '2.0' });
    });

    it('should support all SourceType values', () => {
      for (const type of Object.values(SourceType)) {
        const dto: IngestDocumentDto = {
          title: `Doc (${type})`,
          sectorId: VALID_SECTOR_UUID,
          sourceType: type,
          buffer: Buffer.from('content'),
        };

        expect(dto.sourceType).toBe(type);
      }
    });
  });

  // ====================================================================
  // IngestDocumentResult contract
  // ====================================================================
  describe('IngestDocumentResult', () => {
    it('should have the expected shape on success', () => {
      const result: IngestDocumentResult = {
        sourceId: VALID_UUID,
        title: 'Handbook',
        fragmentCount: 12,
        contentSize: 35400,
        status: 'COMPLETED',
      };

      expect(result).toMatchObject({
        sourceId: expect.any(String),
        title: expect.any(String),
        fragmentCount: expect.any(Number),
        contentSize: expect.any(Number),
        status: 'COMPLETED',
      });
      expect(result.errorMessage).toBeUndefined();
    });

    it('should have the expected shape on failure', () => {
      const result: IngestDocumentResult = {
        sourceId: VALID_UUID,
        title: 'Bad PDF',
        fragmentCount: 0,
        contentSize: 0,
        status: 'FAILED',
        errorMessage: 'Unable to parse PDF',
      };

      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toBe('Unable to parse PDF');
      expect(result.fragmentCount).toBe(0);
    });

    it('status field should only allow COMPLETED or FAILED', () => {
      const validStatuses: IngestDocumentResult['status'][] = [
        'COMPLETED',
        'FAILED',
      ];
      expect(validStatuses).toContain('COMPLETED');
      expect(validStatuses).toContain('FAILED');
    });
  });

  // ====================================================================
  // DeleteSourceDto contract
  // ====================================================================
  describe('DeleteSourceDto', () => {
    it('should require sourceId and sectorId', () => {
      const dto: DeleteSourceDto = {
        sourceId: VALID_UUID,
        sectorId: VALID_SECTOR_UUID,
      };

      expect(dto.sourceId).toBe(VALID_UUID);
      expect(dto.sectorId).toBe(VALID_SECTOR_UUID);
    });
  });

  // ====================================================================
  // DeleteSourceResult contract
  // ====================================================================
  describe('DeleteSourceResult', () => {
    it('should have expected shape on successful delete', () => {
      const result: DeleteSourceResult = {
        sourceId: VALID_UUID,
        fragmentsDeleted: 12,
        vectorsDeleted: true,
      };

      expect(result).toMatchObject({
        sourceId: expect.any(String),
        fragmentsDeleted: expect.any(Number),
        vectorsDeleted: true,
      });
    });

    it('should handle partial failure (vectors not deleted)', () => {
      const result: DeleteSourceResult = {
        sourceId: VALID_UUID,
        fragmentsDeleted: 12,
        vectorsDeleted: false,
      };

      expect(result.vectorsDeleted).toBe(false);
      expect(result.fragmentsDeleted).toBe(12);
    });

    it('should handle zero fragments deleted', () => {
      const result: DeleteSourceResult = {
        sourceId: VALID_UUID,
        fragmentsDeleted: 0,
        vectorsDeleted: true,
      };

      expect(result.fragmentsDeleted).toBe(0);
    });
  });
});
