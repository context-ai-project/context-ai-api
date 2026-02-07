-- Final Migration: Remove ALL indexes and migrate to 3072 dimensions

BEGIN;

-- Step 1: Drop ALL embedding-related indexes
DROP INDEX IF EXISTS idx_fragments_embedding_cosine CASCADE;
DROP INDEX IF EXISTS fragments_embedding_idx CASCADE;
DROP INDEX IF EXISTS idx_fragments_embedding CASCADE;

-- Step 2: Clear existing data
TRUNCATE TABLE fragments CASCADE;
TRUNCATE TABLE knowledge_sources CASCADE;

-- Step 3: Alter column to support 3072-dimensional vectors
ALTER TABLE fragments 
ALTER COLUMN embedding TYPE vector(3072);

-- Step 4: Verify the changes
SELECT 'Column type updated' AS step, udt_name AS type
FROM information_schema.columns
WHERE table_name = 'fragments' AND column_name = 'embedding';

-- Step 5: Verify no embedding indexes exist
SELECT 'Remaining indexes' AS step, indexname
FROM pg_indexes
WHERE tablename = 'fragments';

COMMIT;

-- Success message
SELECT '✅ Migration completed successfully: 3072 dimensions enabled, no HNSW index' AS result;

