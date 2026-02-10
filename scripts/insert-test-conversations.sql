-- Insert test conversations for Phase 5 endpoint validation
-- Run this script to create test data with real UUIDs

BEGIN;

-- Clean up any existing test data (optional)
DELETE FROM messages WHERE conversation_id IN (
  SELECT id FROM conversations WHERE user_id = '550e8400-e29b-41d4-a716-446655440999'
);
DELETE FROM conversations WHERE user_id = '550e8400-e29b-41d4-a716-446655440999';

-- Insert test conversations (without metadata column)
INSERT INTO conversations (id, user_id, sector_id, created_at, updated_at, deleted_at)
VALUES
  -- Active conversation 1
  (
    '660e8400-e29b-41d4-a716-446655440101',
    '550e8400-e29b-41d4-a716-446655440999',
    '440e8400-e29b-41d4-a716-446655440000',
    NOW() - INTERVAL '1 hour',
    NOW(),
    NULL
  ),
  -- Active conversation 2
  (
    '660e8400-e29b-41d4-a716-446655440102',
    '550e8400-e29b-41d4-a716-446655440999',
    '440e8400-e29b-41d4-a716-446655440000',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '30 minutes',
    NULL
  ),
  -- Inactive conversation (soft-deleted)
  (
    '660e8400-e29b-41d4-a716-446655440103',
    '550e8400-e29b-41d4-a716-446655440999',
    '440e8400-e29b-41d4-a716-446655440000',
    NOW() - INTERVAL '1 week',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
  );

-- Insert messages for conversation 1
INSERT INTO messages (id, conversation_id, role, content, metadata, created_at)
VALUES
  (
    '770e8400-e29b-41d4-a716-446655440201',
    '660e8400-e29b-41d4-a716-446655440101',
    'user',
    'How many vacation days do I have?',
    '{"sentiment": "neutral"}',
    NOW() - INTERVAL '55 minutes'
  ),
  (
    '770e8400-e29b-41d4-a716-446655440202',
    '660e8400-e29b-41d4-a716-446655440101',
    'assistant',
    'According to our vacation policy, employees are entitled to 15 days of paid vacation per year.',
    '{"sources": ["vacation-policy.md"], "confidence": 0.95}',
    NOW() - INTERVAL '54 minutes'
  ),
  (
    '770e8400-e29b-41d4-a716-446655440203',
    '660e8400-e29b-41d4-a716-446655440101',
    'user',
    'How do I request vacation?',
    '{"sentiment": "neutral"}',
    NOW() - INTERVAL '5 minutes'
  ),
  (
    '770e8400-e29b-41d4-a716-446655440204',
    '660e8400-e29b-41d4-a716-446655440101',
    'assistant',
    'Requests must be submitted 15 days in advance through the HR portal.',
    '{"sources": ["vacation-policy.md"], "confidence": 0.92}',
    NOW()
  );

-- Insert messages for conversation 2
INSERT INTO messages (id, conversation_id, role, content, metadata, created_at)
VALUES
  (
    '770e8400-e29b-41d4-a716-446655440301',
    '660e8400-e29b-41d4-a716-446655440102',
    'user',
    'Can I work remotely?',
    '{"sentiment": "neutral"}',
    NOW() - INTERVAL '2 hours'
  ),
  (
    '770e8400-e29b-41d4-a716-446655440302',
    '660e8400-e29b-41d4-a716-446655440102',
    'assistant',
    'Yes, our company supports remote work. Please check the remote work guidelines for details.',
    '{"sources": ["remote-work.md"], "confidence": 0.88}',
    NOW() - INTERVAL '30 minutes'
  );

-- Insert messages for inactive conversation 3
INSERT INTO messages (id, conversation_id, role, content, metadata, created_at)
VALUES
  (
    '770e8400-e29b-41d4-a716-446655440401',
    '660e8400-e29b-41d4-a716-446655440103',
    'user',
    'Old question',
    '{}',
    NOW() - INTERVAL '1 week'
  );

COMMIT;

-- Verify data insertion
SELECT
  '✅ Test conversations inserted' as status,
  COUNT(DISTINCT c.id) as total_conversations,
  COUNT(DISTINCT CASE WHEN c.deleted_at IS NULL THEN c.id END) as active_conversations,
  COUNT(m.id) as total_messages
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE c.user_id = '550e8400-e29b-41d4-a716-446655440999';

-- Display conversation details
SELECT
  c.id,
  c.user_id,
  c.sector_id,
  c.deleted_at IS NULL as is_active,
  COUNT(m.id) as message_count,
  c.created_at,
  c.updated_at
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE c.user_id = '550e8400-e29b-41d4-a716-446655440999'
GROUP BY c.id, c.user_id, c.sector_id, c.deleted_at, c.created_at, c.updated_at
ORDER BY c.created_at DESC;
