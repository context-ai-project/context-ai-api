-- Insert test data with 3072-dimensional embeddings
-- Note: Using zero vectors for now, will be replaced by actual embeddings from the API

BEGIN;

-- Insert test knowledge source
INSERT INTO knowledge_sources (
  id,
  title,
  sector_id,
  source_type,
  content,
  metadata,
  status,
  created_at,
  updated_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'Employee Handbook 2026',
  '550e8400-e29b-41d4-a716-446655440000',
  'PDF',
  'This is the employee handbook for 2026 containing policies and procedures.',
  '{"department": "HR", "version": "2.0", "file_path": "/uploads/handbook-2026.pdf"}',
  'COMPLETED',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert test fragments with 3072-dimensional zero vectors (will be replaced by real embeddings)
INSERT INTO fragments (
  id,
  source_id,
  content,
  embedding,
  position,
  token_count,
  metadata,
  created_at,
  updated_at
) VALUES 
(
  '660e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440001',
  'Vacation Policy: Employees are entitled to 15 days of paid vacation per year. To request vacation, submit a request through the HR portal at least 2 weeks in advance.',
  array_fill(0, ARRAY[3072])::vector(3072),
  0,
  50,
  '{"page": 12, "section": "Time Off"}',
  NOW(),
  NOW()
),
(
  '660e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440001',
  'Sick Leave: Employees receive 10 days of paid sick leave annually. No advance notice required for sick leave, but notify your manager as soon as possible.',
  array_fill(0, ARRAY[3072])::vector(3072),
  1,
  45,
  '{"page": 13, "section": "Time Off"}',
  NOW(),
  NOW()
),
(
  '660e8400-e29b-41d4-a716-446655440003',
  '550e8400-e29b-41d4-a716-446655440001',
  'Work Schedule: Standard work hours are Monday to Friday, 9 AM to 5 PM. Flexible work arrangements may be available upon approval from your supervisor.',
  array_fill(0, ARRAY[3072])::vector(3072),
  2,
  40,
  '{"page": 5, "section": "General Policies"}',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Verify insertion
SELECT 
  '✅ Test data inserted' AS status,
  COUNT(*) AS fragment_count,
  (SELECT COUNT(*) FROM knowledge_sources) AS source_count
FROM fragments;

-- Verify vector dimensions
SELECT 
  'Vector dimensions' AS check,
  vector_dims(embedding) AS dimensions
FROM fragments
LIMIT 1;

