-- ============================================
-- Insert Test Data for Phase 4 Validation
-- ============================================

-- Insert a test knowledge source
INSERT INTO knowledge_sources (
    id,
    title,
    sector_id,
    source_type,
    content,
    status,
    metadata,
    created_at,
    updated_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440001',
    'Vacation Policy 2026',
    '550e8400-e29b-41d4-a716-446655440000',
    'MARKDOWN',
    '# Vacation Policy

## Overview
This document outlines the company''s vacation policy for all employees.

## Vacation Days
- Full-time employees receive 15 vacation days per year
- Part-time employees receive vacation days prorated based on hours worked
- Vacation days accrue monthly at a rate of 1.25 days per month

## Request Process
1. Submit vacation requests at least 15 days in advance
2. Use the HR portal at https://hr.company.com
3. Include desired dates and a brief reason for the request
4. Manager approval is required within 5 business days

## Blackout Periods
- December 20-31 (holiday season)
- End of fiscal year (March 28-31)
- Major product launches (announced 60 days in advance)',
    'COMPLETED',
    '{"pages": 1, "author": "HR Department"}'::jsonb,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert test fragments with embeddings
-- Fragment 1: Overview and vacation days
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
) VALUES (
    '660e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440001',
    '# Vacation Policy

## Overview
This document outlines the company''s vacation policy for all employees.

## Vacation Days
- Full-time employees receive 15 vacation days per year
- Part-time employees receive vacation days prorated based on hours worked
- Vacation days accrue monthly at a rate of 1.25 days per month',
    array_fill(0.1, ARRAY[768])::vector,
    0,
    85,
    '{"section": "overview"}'::jsonb,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Fragment 2: Request process
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
) VALUES (
    '660e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440001',
    '## Request Process
1. Submit vacation requests at least 15 days in advance
2. Use the HR portal at https://hr.company.com
3. Include desired dates and a brief reason for the request
4. Manager approval is required within 5 business days',
    array_fill(0.2, ARRAY[768])::vector,
    1,
    62,
    '{"section": "request-process"}'::jsonb,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Fragment 3: Blackout periods
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
) VALUES (
    '660e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440001',
    '## Blackout Periods
- December 20-31 (holiday season)
- End of fiscal year (March 28-31)
- Major product launches (announced 60 days in advance)',
    array_fill(0.15, ARRAY[768])::vector,
    2,
    42,
    '{"section": "blackout-periods"}'::jsonb,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Verify insertion
SELECT 
    'Test data inserted successfully' as status,
    (SELECT COUNT(*) FROM knowledge_sources WHERE id = '550e8400-e29b-41d4-a716-446655440001') as sources_count,
    (SELECT COUNT(*) FROM fragments WHERE source_id = '550e8400-e29b-41d4-a716-446655440001') as fragments_count;

