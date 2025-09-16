# Architecture Documentation

## System Overview

The RAG API is built using a modular TypeScript architecture that separates concerns across different layers:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   Lambda/Server │
│   (React/JS)    │───▶│   (Optional)    │───▶│   (Node.js/TS)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                       ┌─────────────────┐            │
                       │   CloudFront    │◀───────────┘
                       │   (Global CDN)  │
                       └─────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │   OpenAI API    │    │   AWS Bedrock   │
│   + pgVector    │    │   (Embeddings   │    │   (Embeddings   │
│   (Vector DB)   │    │    + LLM)       │    │    + LLM)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## System Architecture

This RAG (Retrieval-Augmented Generation) API is built with Node.js, TypeScript, and uses PostgreSQL with the pgVector extension for vector similarity search. The system uses AWS Lambda Function URLs for direct streaming without API Gateway.

## Core Components

### 1. Lambda Function URL Handler
- Direct HTTP handling with streaming support

### 2. pgVector Database
- PostgreSQL with vector similarity search

### 3. Embedding Service
- OpenAI and AWS Bedrock integration

### 4. LLM Service
- Streaming response generation

### 5. CloudFront Distribution
- Global CDN with Lambda Function URL as origin

### 6. Application Layer (`src/app.ts`)
- Express.js application setup
- Middleware configuration (CORS, JSON parsing)
- Error handling
- Route mounting

### 7. Controllers (`src/controllers/`)
- **RAGController**: Handles API requests and responses
- Input validation
- Business logic orchestration
- Response formatting

### 8. Services (`src/services/`)
- **EmbeddingService**: Generates embeddings using OpenAI/Bedrock
- **LLMService**: Handles streaming responses from language models
- Provider abstraction layer

### 9. Configuration (`src/config/`)
- **Database**: Knex.js query builder with PostgreSQL + pgVector
- High-performance vector operations
- Connection pooling and migrations
- Optimized similarity search functions

### 5. Types (`src/types/`)
- Comprehensive TypeScript type definitions
- Request/response interfaces
- Configuration types

## Data Flow

### RAG Request Processing

1. **Request Validation**
   ```typescript
   POST /api/ask
   {
     "question": "What is machine learning?",
     "provider": "openai",
     "limit": 5
   }
   ```

2. **Embedding Generation**
   ```typescript
   const embedding = await embeddingService.generateEmbedding(question, provider);
   // Returns: [0.1, 0.2, 0.3, ..., 0.n] (1536-dimensional vector)
   ```

3. **Vector Similarity Search**
   ```typescript
   // High-performance Knex.js vector search
   const results = await searchSimilarEmbeddings(
     queryEmbedding,
     collectionId,
     5,
     0.8
   );
   
   // Equivalent SQL generated:
   // SELECT id, content, metadata,
   //        1 - (embedding <=> $1) as similarity
   // FROM embeddings
   // WHERE embedding <=> $1 < $2
   // ORDER BY embedding <=> $1
   // LIMIT $3
   ```

4. **Context Building**
   ```typescript
   const prompt = `
   System: You are a helpful AI assistant...
   
   Context:
   Document 1: [Retrieved content]
   Document 2: [Retrieved content]
   
   Question: ${question}
   Answer:`;
   ```

5. **Streaming Response**
   ```typescript
   for await (const chunk of llmService.streamResponse(prompt, provider)) {
     res.write(chunk); // Stream to client
   }
   ```

## Database Schema

### Enhanced Schema with Knex.js Migrations

The database now uses a comprehensive schema managed through Knex.js migrations:

```sql
-- Collections table for organizing embeddings
CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Main embeddings table with optimized structure
CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    document_hash VARCHAR(64) NOT NULL, -- SHA-256 for deduplication
    content TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint for deduplication
    CONSTRAINT unique_document_per_collection UNIQUE(collection_id, document_hash)
);

-- Users table for API key management
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    api_key VARCHAR(255) NOT NULL UNIQUE,
    rate_limit_per_hour INTEGER DEFAULT 1000,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Query logs for analytics
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

-- Backward compatibility table
CREATE TABLE langchain_pg_embedding (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    cmetadata JSONB DEFAULT '{}'
);

-- Optimized indexes for performance
CREATE INDEX CONCURRENTLY embeddings_vector_cosine_idx 
ON embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX embeddings_collection_id_idx ON embeddings(collection_id);
CREATE INDEX embeddings_created_at_idx ON embeddings(created_at);
CREATE INDEX embeddings_metadata_gin_idx ON embeddings USING gin(metadata);
```

### Key Performance Features

- **Deduplication**: SHA-256 hashing prevents duplicate documents
- **Collections**: Logical grouping of embeddings
- **Optimized Indexes**: IVFFlat for vector search, GIN for metadata
- **Analytics**: Query logging for performance monitoring
- **Multi-tenancy**: User management with API keys

## Deployment Architectures

### 1. Local Development
```
┌─────────────────┐    ┌─────────────────┐
│   Node.js       │    │   PostgreSQL    │
│   (Port 3000)   │───▶│   (Port 5432)   │
│   TypeScript    │    │   + pgVector    │
└─────────────────┘    └─────────────────┘
```

### 2. AWS Lambda Serverless
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CloudFront    │    │   Lambda        │    │   RDS/Aurora    │
│   (Global CDN)  │───▶│   Function URL  │───▶│   PostgreSQL    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   OpenAI/       │
                       │   Bedrock APIs  │
                       └─────────────────┘
```

### 3. Container Deployment
```
┌─────────────────┐    ┌─────────────────┐
│   Docker        │    │   Docker        │
│   (API Server)  │───▶│   (PostgreSQL)  │
│   Port 3000     │    │   Port 5432     │
└─────────────────┘    └─────────────────┘
```

## Performance Considerations

### Vector Search Optimization
- **Index Type**: IVFFlat for approximate nearest neighbor search
- **Lists Parameter**: Configured based on dataset size
- **Similarity Threshold**: Filters low-quality matches

### Connection Pooling
```typescript
const pool = new Pool({
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle connections
  connectionTimeoutMillis: 2000
});
```

### Streaming Benefits
- **Reduced Latency**: Users see responses immediately
- **Better UX**: Progressive content loading
- **Memory Efficiency**: No need to buffer complete responses

## Security Considerations

### API Security
- Input validation and sanitization
- Rate limiting (recommended for production)
- CORS configuration
- Environment variable protection

### Database Security
- Connection string encryption
- SQL injection prevention via Knex.js parameterized queries
- Network isolation (VPC for AWS deployments)
- Migration-based schema management

### API Key Management
- Server-side key storage
- AWS Secrets Manager integration (recommended)
- Key rotation policies

## Monitoring and Observability

### Logging
```typescript
console.error('Error in RAG ask endpoint:', error);
// Structured logging recommended for production
```

### Health Checks
- Database connectivity
- External API availability
- System resource monitoring

### Metrics (Recommended)
- Request latency
- Token usage
- Vector search performance
- Error rates

## Scalability Patterns

### Horizontal Scaling
- Multiple Lambda instances (serverless)
- Load balancer distribution
- Database read replicas

### Caching Strategies
- Embedding caching for repeated queries
- Response caching for common questions
- CDN caching for static content

### Database Scaling
- Connection pooling
- Read replicas for vector searches
- Partitioning by collection_id

## Error Handling

### Graceful Degradation
```typescript
try {
  const embedding = await embeddingService.generateEmbedding(question);
} catch (error) {
  // Fallback to keyword search or cached responses
}
```

### Circuit Breaker Pattern
- Prevent cascade failures
- Automatic recovery
- Fallback mechanisms

## Development Workflow

### TypeScript Benefits
- Compile-time error detection
- Enhanced IDE support
- Better refactoring capabilities
- Self-documenting code

### Testing Strategy
- Unit tests for services
- Integration tests for API endpoints
- Mock external dependencies
- Performance testing for vector operations
