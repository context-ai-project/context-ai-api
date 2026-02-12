/**
 * Conversation & Message Test Fixtures
 *
 * Provides predefined interaction data for testing.
 *
 * Phase 7.10: Test Data Management
 */

import { TEST_USER_IDS, TEST_SECTOR_IDS } from '../auth/users.fixture';
import { TEST_SOURCE_IDS } from '../knowledge/sources.fixture';

// ============================================================================
// Conversation IDs
// ============================================================================

export const TEST_CONVERSATION_IDS = {
  techChat: 'conv-1111-1111-4111-a111-111111111111',
  rrhhChat: 'conv-2222-2222-4222-a222-222222222222',
  emptyChat: 'conv-3333-3333-4333-a333-333333333333',
} as const;

// ============================================================================
// Conversation Fixtures
// ============================================================================

export interface ConversationFixture {
  id: string;
  userId: string;
  sectorId: string;
}

export const TECH_CONVERSATION_FIXTURE: ConversationFixture = {
  id: TEST_CONVERSATION_IDS.techChat,
  userId: TEST_USER_IDS.regularUser,
  sectorId: TEST_SECTOR_IDS.tech,
};

export const RRHH_CONVERSATION_FIXTURE: ConversationFixture = {
  id: TEST_CONVERSATION_IDS.rrhhChat,
  userId: TEST_USER_IDS.regularUser,
  sectorId: TEST_SECTOR_IDS.rrhh,
};

export const EMPTY_CONVERSATION_FIXTURE: ConversationFixture = {
  id: TEST_CONVERSATION_IDS.emptyChat,
  userId: TEST_USER_IDS.viewer,
  sectorId: TEST_SECTOR_IDS.tech,
};

export const ALL_CONVERSATION_FIXTURES: ConversationFixture[] = [
  TECH_CONVERSATION_FIXTURE,
  RRHH_CONVERSATION_FIXTURE,
  EMPTY_CONVERSATION_FIXTURE,
];

// ============================================================================
// Message Fixtures
// ============================================================================

export interface MessageFixture {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, unknown> | null;
}

export const TECH_MESSAGES: MessageFixture[] = [
  {
    id: 'msg-0001-0001-4001-a001-000000000001',
    conversationId: TEST_CONVERSATION_IDS.techChat,
    role: 'user',
    content: 'What technology stack does the system use?',
    metadata: null,
  },
  {
    id: 'msg-0002-0002-4002-a002-000000000002',
    conversationId: TEST_CONVERSATION_IDS.techChat,
    role: 'assistant',
    content:
      'The system uses NestJS for the backend and Next.js for the frontend, with TypeScript and Tailwind CSS.',
    metadata: {
      sources: [
        {
          fragmentId: 'frag-tech-0001-0001-0001-000000000001',
          sourceId: TEST_SOURCE_IDS.techManual,
          similarity: 0.95,
          content: 'The system uses NestJS for the backend.',
        },
      ],
    },
  },
];

export const RRHH_MESSAGES: MessageFixture[] = [
  {
    id: 'msg-0003-0003-4003-a003-000000000003',
    conversationId: TEST_CONVERSATION_IDS.rrhhChat,
    role: 'user',
    content: 'How many vacation days do employees get?',
    metadata: null,
  },
  {
    id: 'msg-0004-0004-4004-a004-000000000004',
    conversationId: TEST_CONVERSATION_IDS.rrhhChat,
    role: 'assistant',
    content: 'Employees are entitled to 15 vacation days per year.',
    metadata: {
      sources: [
        {
          fragmentId: 'frag-rrhh-0001-0001-0001-000000000001',
          sourceId: TEST_SOURCE_IDS.rrhhPolicy,
          similarity: 0.92,
          content: 'Employees are entitled to 15 vacation days per year.',
        },
      ],
    },
  },
];

export const ALL_MESSAGE_FIXTURES: MessageFixture[] = [
  ...TECH_MESSAGES,
  ...RRHH_MESSAGES,
];

// ============================================================================
// Query test payloads
// ============================================================================

export const SAMPLE_QUERY_PAYLOADS = {
  techQuestion: {
    message: 'What technology stack does the system use?',
    sectorId: TEST_SECTOR_IDS.tech,
  },
  rrhhQuestion: {
    message: 'How many vacation days do employees get?',
    sectorId: TEST_SECTOR_IDS.rrhh,
  },
  emptyQuestion: {
    message: '',
    sectorId: TEST_SECTOR_IDS.tech,
  },
  missingSector: {
    message: 'Test query without sector',
  },
} as const;

