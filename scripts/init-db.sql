-- ============================================
-- Context.ai - Database Initialization Script
-- ============================================
-- This script runs automatically when the PostgreSQL container starts for the first time.
-- It sets up the initial schema and permissions.
--
-- NOTE: Vector embeddings are managed by Pinecone (external service).
-- PostgreSQL is used only for relational data (sources, fragments, users, etc.).

-- Create schemas if they don't exist
CREATE SCHEMA IF NOT EXISTS public;

-- Set search path
SET search_path TO public;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON SCHEMA public TO context_ai_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO context_ai_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO context_ai_user;

-- Grant default privileges for future objects created by the owner (e.g. migrations)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO context_ai_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO context_ai_user;

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
    RAISE NOTICE 'Database: context_ai_db';
    RAISE NOTICE 'User: context_ai_user';
    RAISE NOTICE 'Vector embeddings: Managed by Pinecone (external)';
END $$;
