-- ============================================
-- Context.ai - Database Initialization Script
-- ============================================
-- This script runs automatically when the PostgreSQL container starts for the first time.
-- It enables the pgvector extension and sets up the initial schema.

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify pgvector installation
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Create schemas if they don't exist
CREATE SCHEMA IF NOT EXISTS public;

-- Set search path
SET search_path TO public;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON SCHEMA public TO context_ai_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO context_ai_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO context_ai_user;

-- Create function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Context.ai database initialized successfully';
    RAISE NOTICE 'pgvector extension enabled';
    RAISE NOTICE 'Database: context_ai_db';
    RAISE NOTICE 'User: context_ai_user';
END $$;

