/**
 * Knowledge Source & Fragment Test Fixtures
 *
 * Provides predefined knowledge data for testing.
 *
 * Phase 7.10: Test Data Management
 */

import { SourceType, SourceStatus } from '../../../src/shared/types';
import { TEST_SECTOR_IDS } from '../auth/users.fixture';

// ============================================================================
// Knowledge Source IDs
// ============================================================================

export const TEST_SOURCE_IDS = {
  techManual: 'aaaa1111-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  rrhhPolicy: 'bbbb2222-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  financeGuide: 'cccc3333-cccc-4ccc-cccc-cccccccccccc',
  failedDoc: 'dddd4444-dddd-4ddd-dddd-dddddddddddd',
  pendingDoc: 'eeee5555-eeee-4eee-eeee-eeeeeeeeeeee',
} as const;

// ============================================================================
// Source Fixtures
// ============================================================================

export interface KnowledgeSourceFixture {
  id: string;
  title: string;
  sectorId: string;
  sourceType: SourceType;
  content: string;
  status: SourceStatus;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
}

export const TECH_MANUAL_FIXTURE: KnowledgeSourceFixture = {
  id: TEST_SOURCE_IDS.techManual,
  title: 'Technology Architecture Manual',
  sectorId: TEST_SECTOR_IDS.tech,
  sourceType: SourceType.MARKDOWN,
  content:
    '# Architecture Manual\n\nThis document describes the system architecture.\n\n## Overview\n\nThe system uses NestJS for the backend and Next.js for the frontend.',
  status: SourceStatus.COMPLETED,
  errorMessage: null,
  metadata: { author: 'Tech Team', version: '2.0' },
};

export const RRHH_POLICY_FIXTURE: KnowledgeSourceFixture = {
  id: TEST_SOURCE_IDS.rrhhPolicy,
  title: 'Vacation Policy',
  sectorId: TEST_SECTOR_IDS.rrhh,
  sourceType: SourceType.PDF,
  content:
    'Employees are entitled to 15 vacation days per year. Requests must be submitted at least 2 weeks in advance.',
  status: SourceStatus.COMPLETED,
  errorMessage: null,
  metadata: { department: 'Human Resources', year: 2026 },
};

export const FINANCE_GUIDE_FIXTURE: KnowledgeSourceFixture = {
  id: TEST_SOURCE_IDS.financeGuide,
  title: 'Financial Reporting Guide',
  sectorId: TEST_SECTOR_IDS.finance,
  sourceType: SourceType.MARKDOWN,
  content:
    '# Financial Reporting\n\nQuarterly reports must be submitted by the 15th of the following month.',
  status: SourceStatus.COMPLETED,
  errorMessage: null,
  metadata: null,
};

export const FAILED_DOC_FIXTURE: KnowledgeSourceFixture = {
  id: TEST_SOURCE_IDS.failedDoc,
  title: 'Corrupted Document',
  sectorId: TEST_SECTOR_IDS.tech,
  sourceType: SourceType.PDF,
  content: '',
  status: SourceStatus.FAILED,
  errorMessage: 'Failed to parse PDF: corrupted file',
  metadata: null,
};

export const PENDING_DOC_FIXTURE: KnowledgeSourceFixture = {
  id: TEST_SOURCE_IDS.pendingDoc,
  title: 'Document In Queue',
  sectorId: TEST_SECTOR_IDS.tech,
  sourceType: SourceType.MARKDOWN,
  content: '# Pending\n\nThis document is waiting to be processed.',
  status: SourceStatus.PENDING,
  errorMessage: null,
  metadata: null,
};

export const ALL_SOURCE_FIXTURES: KnowledgeSourceFixture[] = [
  TECH_MANUAL_FIXTURE,
  RRHH_POLICY_FIXTURE,
  FINANCE_GUIDE_FIXTURE,
  FAILED_DOC_FIXTURE,
  PENDING_DOC_FIXTURE,
];

// ============================================================================
// Fragment Fixtures
// ============================================================================

export interface FragmentFixture {
  id: string;
  sourceId: string;
  content: string;
  position: number;
  tokenCount: number;
  metadata: Record<string, unknown> | null;
}

export const TECH_FRAGMENTS: FragmentFixture[] = [
  {
    id: 'f00a0001-0001-4001-a001-000000000001',
    sourceId: TEST_SOURCE_IDS.techManual,
    content:
      'This document describes the system architecture. The system uses NestJS for the backend.',
    position: 0,
    tokenCount: 20,
    metadata: { heading: 'Overview' },
  },
  {
    id: 'f00a0002-0002-4002-a002-000000000002',
    sourceId: TEST_SOURCE_IDS.techManual,
    content: 'Next.js is used for the frontend with TypeScript and Tailwind.',
    position: 1,
    tokenCount: 14,
    metadata: { heading: 'Overview' },
  },
];

export const RRHH_FRAGMENTS: FragmentFixture[] = [
  {
    id: 'f00b0001-0001-4001-a001-000000000001',
    sourceId: TEST_SOURCE_IDS.rrhhPolicy,
    content:
      'Employees are entitled to 15 vacation days per year. Requests must be submitted at least 2 weeks in advance.',
    position: 0,
    tokenCount: 22,
    metadata: { section: 'Vacation Policy' },
  },
];

export const ALL_FRAGMENT_FIXTURES: FragmentFixture[] = [
  ...TECH_FRAGMENTS,
  ...RRHH_FRAGMENTS,
];

// ============================================================================
// Test Document Content (for upload tests)
// ============================================================================

export const SAMPLE_MARKDOWN_CONTENT = `# Sample Test Document

## Introduction

This is a sample test document used for integration and E2E testing.

## Key Points

- Point 1: The system processes documents automatically.
- Point 2: Embeddings are generated for each fragment.
- Point 3: Vector search enables semantic retrieval.

## Conclusion

This document validates the complete ingestion pipeline.
`;

export const SAMPLE_PDF_HEADER = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>\nendobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>\nendobj\n4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 100 700 Td (Test PDF Content) Tj ET\nendstream\nendobj\nxref\n0 5\ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n0\n%%EOF',
);

