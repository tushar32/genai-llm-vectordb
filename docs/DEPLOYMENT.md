# Deployment Guide

## Prerequisites

- Node.js 18+ and npm
- Docker Desktop (for local database)
- AWS CLI configured (for serverless deployment)
- OpenAI API key or AWS Bedrock access

## Local Development

### 1. Environment Setup

```bash
# Install dependencies
npm install

# Create environment file from template
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` file with your local database credentials:
```env
# Database Configuration (for local Docker)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vectordb
DB_USER=postgres
DB_PASSWORD=postgres

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-key

# AWS Bedrock Configuration (optional)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0

# Application Configuration
PORT=3000
NODE_ENV=development
```

### 3. Start Local Database

Start PostgreSQL with pgVector using Docker:
```bash
# Start only the database (not the API)
npm run db:up

# Verify database is running
docker ps
```

### 4. Run Database Migrations

```bash
# Run all pending migrations to set up schema
npm run migrate:latest

# Check migration status
npm run migrate:status

# Optional: Add sample data
npm run seed:run
```

### 5. Start Lambda Function Locally

```bash
# Build TypeScript code
npm run build

# Start Lambda function with serverless offline
npm run dev
```

This will start your Lambda function at `http://localhost:3000` with streaming support.

### 6. Test the API

```bash
# Health check
curl http://localhost:3000/health

# Test streaming RAG endpoint
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"query": "What is artificial intelligence?"}'

# Run automated tests
npm test
```

### 7. Stop Services

```bash
# Stop the database
npm run db:down

# Stop serverless offline (Ctrl+C in terminal)
```

## Docker Deployment

### 1. Build Container

```bash
docker build -t rag-api .
```

### 2. Run with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

### 3. Environment Configuration

Create `.env` file or use environment variables in `docker-compose.yml`:

```yaml
services:
  api:
    environment:
      - DB_HOST=postgres
      - OPENAI_API_KEY=${OPENAI_API_KEY}
```

## Production Deployment (AWS Lambda + CloudFront)

### 1. Configure AWS Credentials

```bash
aws configure
# Or use environment variables
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
```

### 2. Set Production Environment Variables

For staging deployment, set these environment variables in your terminal:
```bash
# Database (use RDS/Aurora for production)
export DB_HOST=your-rds-endpoint.amazonaws.com
export DB_PORT=5432
export DB_NAME=vectordb
export DB_USER=postgres
export DB_PASSWORD=your_secure_password

# API Keys
export OPENAI_API_KEY=sk-your-production-key
export AWS_REGION=us-east-1
export BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
```

### 3. Deploy to Staging

```bash
# Deploy to staging environment
npm run deploy:staging
```

### 4. Deploy to Production

```bash
# Deploy to production environment
npm run deploy:production
```

### 5. Run Database Migrations in Production

After deployment, run migrations on your production database:
```bash
# Set production database connection
export DB_HOST=your-rds-endpoint.amazonaws.com
export DB_USER=postgres
export DB_PASSWORD=your_secure_password

# Run migrations
npm run migrate:latest
```

### 6. Get Lambda Function URL

After deployment, you'll get a Lambda Function URL that supports streaming:
```
https://abc123.lambda-url.us-east-1.on.aws/
```

This URL can be used directly or behind CloudFront for global distribution.

## CloudFront CDN Setup

### 1. Deploy CloudFront Distribution

```bash
# Get Lambda Function URL from deployment
FUNCTION_URL=$(npx serverless info --stage prod | grep "url:" | awk '{print $2}')

# Deploy CloudFront
aws cloudformation deploy \
  --template-file cloudfront-config.yml \
  --stack-name rag-api-cloudfront-prod \
  --parameter-overrides \
    LambdaFunctionUrl=$FUNCTION_URL \
    Stage=prod
```

### 2. Get CloudFront URL

```bash
aws cloudformation describe-stacks \
  --stack-name rag-api-cloudfront-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' \
  --output text
```

## Production Considerations

### 1. Database Migration in Production

```bash
# Run migrations on production database
NODE_ENV=production npm run migrate:latest

# Verify migration status
NODE_ENV=production npm run migrate:status

# For RDS/Aurora deployments
DB_HOST=your-rds-endpoint.amazonaws.com npm run migrate:latest
```

### 2. Database Optimization

The Knex.js migration already includes optimized indexes:
```sql
-- Vector search optimization (automatically created by migration)
CREATE INDEX CONCURRENTLY embeddings_vector_cosine_idx 
ON embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Additional indexes for performance
CREATE INDEX embeddings_collection_id_idx ON embeddings(collection_id);
CREATE INDEX embeddings_metadata_gin_idx ON embeddings USING gin(metadata);
```

### 3. Connection Pooling with Knex.js

Production configuration in `knexfile.ts`:
```typescript
production: {
  client: 'postgresql',
  connection: {
    // RDS/Aurora connection details
  },
  pool: {
    min: 2,
    max: 20                   // Adjust based on Lambda concurrency
  },
  acquireConnectionTimeout: 60000,
  createTimeoutMillis: 30000,
  destroyTimeoutMillis: 5000,
  idleTimeoutMillis: 30000
}
```

### 3. Monitoring Setup

Add CloudWatch logging:
```yaml
# serverless.yml
provider:
  logs:
    httpApi: true
  tracing:
    lambda: true
```

### 4. Security Hardening

```yaml
# serverless.yml
provider:
  iam:
    role:
      statements:
        - Effect: Allow
          Action:
            - bedrock:InvokeModel
            - bedrock:InvokeModelWithResponseStream
          Resource: 
            - "arn:aws:bedrock:*:*:model/*"
```

## Environment-Specific Configurations

### Development
```env
NODE_ENV=development
LOG_LEVEL=debug
DB_SSL=false
```

### Staging
```env
NODE_ENV=staging
LOG_LEVEL=info
DB_SSL=true
```

### Production
```env
NODE_ENV=production
LOG_LEVEL=warn
DB_SSL=true
CORS_ORIGIN=https://yourdomain.com
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Check database connectivity
   psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;"
   ```

2. **pgVector Extension Missing**
   ```sql
   -- Install pgVector extension
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

3. **Lambda Cold Starts**
   ```yaml
   # Add provisioned concurrency
   functions:
     api:
       provisionedConcurrency: 2
   ```

4. **Memory Issues**
   ```yaml
   # Increase Lambda memory
   provider:
     memorySize: 1024
     timeout: 30
   ```

### Debugging

Enable debug logging:
```env
DEBUG=rag-api:*
LOG_LEVEL=debug
```

Check Lambda logs:
```bash
npx serverless logs -f api --tail
```

## Performance Optimization

### 1. Vector Search Tuning

```sql
-- Adjust lists parameter based on dataset size
-- Rule of thumb: lists = sqrt(total_rows)
ALTER INDEX langchain_pg_embedding_embedding_idx 
SET (lists = 1000);
```

### 2. Connection Optimization

```typescript
// Use connection pooling
const pool = new Pool({
  max: 20,
  min: 5,
  acquire: 30000,
  idle: 10000
});
```

### 3. Caching Strategy

Implement Redis caching:
```typescript
// Cache embeddings for repeated queries
const cachedEmbedding = await redis.get(`embedding:${hash(question)}`);
```

## Backup and Recovery

### Database Backup

```bash
# Backup with vector data
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup.sql

# Restore
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < backup.sql
```

### Lambda Deployment Rollback

```bash
# Rollback to previous version
npx serverless rollback --timestamp timestamp
```

## Cost Optimization

### AWS Lambda
- Use ARM64 architecture for better price/performance
- Optimize memory allocation
- Implement request batching

### Database
- Use Aurora Serverless for variable workloads
- Implement read replicas for scaling
- Archive old embeddings

### API Costs
- Cache frequent queries
- Implement rate limiting
- Use smaller embedding models when appropriate
