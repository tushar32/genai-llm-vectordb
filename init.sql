-- Initialize database with pgvector extension and sample schema

-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the main embedding table (compatible with LangChain)
CREATE TABLE IF NOT EXISTS langchain_pg_embedding (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID,
    embedding vector(1536),  -- OpenAI ada-002 dimension
    document TEXT,
    cmetadata JSONB,
    custom_id VARCHAR
);

-- Create index for faster similarity search
CREATE INDEX IF NOT EXISTS langchain_pg_embedding_embedding_idx 
ON langchain_pg_embedding USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create collection table
CREATE TABLE IF NOT EXISTS langchain_pg_collection (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR,
    cmetadata JSONB
);

-- Insert a default collection
INSERT INTO langchain_pg_collection (name, cmetadata) 
VALUES ('documents', '{}') 
ON CONFLICT DO NOTHING;

-- Sample data for testing (optional)
-- Uncomment the following lines to insert sample documents

/*
INSERT INTO langchain_pg_embedding (embedding, document, cmetadata) VALUES 
(
    '[0.1, 0.2, 0.3]'::vector,
    'Artificial Intelligence (AI) is a branch of computer science that aims to create intelligent machines.',
    '{"source": "ai_basics.txt", "page": 1}'
),
(
    '[0.2, 0.3, 0.4]'::vector,
    'Machine Learning is a subset of AI that enables computers to learn without being explicitly programmed.',
    '{"source": "ml_intro.txt", "page": 1}'
),
(
    '[0.3, 0.4, 0.5]'::vector,
    'Deep Learning uses neural networks with multiple layers to model and understand complex patterns.',
    '{"source": "dl_guide.txt", "page": 1}'
);
*/
