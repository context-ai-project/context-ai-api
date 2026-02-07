-- ============================================
-- Context.ai - Manual Table Creation Script
-- ============================================
-- This script creates all tables for Phase 3 (Knowledge) and Phase 4 (Interaction)

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create migrations tracking table
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    "timestamp" BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    UNIQUE ("timestamp")
);

-- ============================================
-- PHASE 3: KNOWLEDGE TABLES
-- ============================================

-- Create knowledge_sources table
CREATE TABLE IF NOT EXISTS knowledge_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    sector_id UUID NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    metadata JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- Create fragments table
CREATE TABLE IF NOT EXISTS fragments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL,
    content TEXT NOT NULL,
    embedding vector(768),
    position INTEGER NOT NULL,
    token_count INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fragments_source_id FOREIGN KEY (source_id) 
        REFERENCES knowledge_sources(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for knowledge_sources
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_sector_id ON knowledge_sources(sector_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_status ON knowledge_sources(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_source_type ON knowledge_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_deleted_at ON knowledge_sources(deleted_at) WHERE deleted_at IS NULL;

-- Create indexes for fragments
CREATE INDEX IF NOT EXISTS idx_fragments_source_id ON fragments(source_id);
CREATE INDEX IF NOT EXISTS idx_fragments_embedding_cosine ON fragments USING hnsw (embedding vector_cosine_ops);

-- ============================================
-- PHASE 4: INTERACTION TABLES
-- ============================================

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    sector_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_messages_conversation_id FOREIGN KEY (conversation_id)
        REFERENCES conversations(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user_id_sector_id ON conversations(user_id, sector_id);
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at ON conversations(deleted_at) WHERE deleted_at IS NULL;

-- Create indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- ============================================
-- TRIGGERS
-- ============================================

-- Create update_updated_at_column function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic updated_at
DROP TRIGGER IF EXISTS update_knowledge_sources_updated_at ON knowledge_sources;
CREATE TRIGGER update_knowledge_sources_updated_at
    BEFORE UPDATE ON knowledge_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_fragments_updated_at ON fragments;
CREATE TRIGGER update_fragments_updated_at
    BEFORE UPDATE ON fragments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RECORD MIGRATIONS
-- ============================================

INSERT INTO migrations ("timestamp", name) VALUES 
    (1707265200000, 'CreateKnowledgeTables1707265200000'),
    (1738972800000, 'CreateInteractionTables1738972800000')
ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICATION
-- ============================================

-- Show created tables
SELECT 
    'Tables created successfully' as status,
    COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name IN ('knowledge_sources', 'fragments', 'conversations', 'messages');

