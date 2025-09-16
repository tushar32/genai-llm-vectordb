-- Migration: 001_initial_setup.sql
-- Enable pgVector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create collections table
CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create embeddings table with optimized structure
CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    document_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for deduplication
    content TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_document_per_collection UNIQUE(collection_id, document_hash)
);

-- Optimized indexes for vector search
CREATE INDEX CONCURRENTLY embeddings_vector_cosine_idx 
ON embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Additional performance indexes
CREATE INDEX embeddings_collection_id_idx ON embeddings(collection_id);
CREATE INDEX embeddings_created_at_idx ON embeddings(created_at);
CREATE INDEX embeddings_metadata_gin_idx ON embeddings USING gin(metadata);

-- Create users table (for multi-tenancy)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    api_key VARCHAR(255) NOT NULL UNIQUE,
    rate_limit_per_hour INTEGER DEFAULT 1000,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create query logs for analytics
CREATE TABLE query_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    collection_id UUID REFERENCES collections(id),
    query_text TEXT NOT NULL,
    query_embedding vector(1536),
    results_count INTEGER,
    response_time_ms INTEGER,
    provider VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Partitioning for query logs (monthly partitions)
CREATE INDEX query_logs_created_at_idx ON query_logs(created_at);
CREATE INDEX query_logs_user_id_idx ON query_logs(user_id);
