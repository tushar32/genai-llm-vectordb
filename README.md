# RAG API with TypeScript, pgVector & Streaming

A production-ready TypeScript application that provides RAG (Retrieval-Augmented Generation) capabilities using pgVector for vector similarity search and streaming responses from OpenAI/Bedrock.

## Features

- 🔍 **Vector Similarity Search**: Query pgVector database for relevant documents
- 🤖 **Multiple LLM Providers**: Support for OpenAI and AWS Bedrock
- 📡 **Streaming Responses**: Real-time token streaming to frontend
- ☁️ **Serverless Ready**: Deploy with AWS Lambda + Function URLs
- 🌍 **Global CDN**: Optional CloudFront integration for low latency
- 🔒 **Secure**: Environment-based configuration

## Architecture

```
Frontend → API Gateway/CloudFront → Lambda → pgVector DB
                                         ↓
                                   OpenAI/Bedrock
```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL with pgVector extension
- OpenAI API key or AWS Bedrock access
- AWS CLI configured (for deployment)

### Local Development

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Test the API:**
   ```bash
   # Health check
   curl http://localhost:3000/api/health
   
   # Ask question (streaming)
   curl -X POST http://localhost:3000/api/ask \
     -H "Content-Type: application/json" \
     -d '{"question": "What is machine learning?"}'
   
   # Ask question (JSON response)
   curl -X POST http://localhost:3000/api/ask-json \
     -H "Content-Type: application/json" \
     -d '{"question": "What is machine learning?"}'
   ```

### Serverless Deployment

1. **Deploy to AWS Lambda:**
   ```bash
   npm run deploy
   ```

2. **Deploy with CloudFront (optional):**
   ```bash
   DEPLOY_CLOUDFRONT=true ./deploy.sh
   ```

## API Endpoints

### POST /api/ask
Streams the response in real-time as plain text.

**Request:**
```json
{
  "question": "What is artificial intelligence?",
  "provider": "openai",  // or "bedrock"
  "limit": 5             // number of similar docs to retrieve
}
```

**Response:** Streaming plain text

### POST /api/ask-json
Returns the complete response as JSON.

**Request:** Same as above

**Response:**
```json
{
  "answer": "Artificial intelligence is...",
  "sources": [
    {
      "id": 1,
      "content": "Document excerpt...",
      "similarity": 0.85,
      "metadata": {}
    }
  ]
}
```

### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": "connected",
    "embedding": "available",
    "llm": "available"
  }
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `vectordb` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | - |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `AWS_REGION` | AWS region | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | AWS access key | - |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | - |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |

### Database Setup

Ensure your PostgreSQL database has the pgVector extension:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

The application expects a table structure compatible with LangChain's pgVector integration:

```sql
CREATE TABLE langchain_pg_embedding (
    uuid UUID PRIMARY KEY,
    collection_id UUID,
    embedding vector(1536),  -- Adjust dimension based on your model
    document TEXT,
    cmetadata JSONB
);
```

## Frontend Integration

### JavaScript/React Example

```javascript
// Streaming response
const response = await fetch('/api/ask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: 'What is AI?' })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  console.log(chunk); // Display in UI
}
```

### React Hook Example

```javascript
import { useState } from 'react';

function useStreamingChat() {
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const askQuestion = async (question) => {
    setLoading(true);
    setResponse('');

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        setResponse(prev => prev + chunk);
      }
    } finally {
      setLoading(false);
    }
  };

  return { response, loading, askQuestion };
}
```

## Project Structure

```
src/
├── config/
│   └── database.js          # Database connection & vector search
├── services/
│   ├── embeddingService.js  # OpenAI/Bedrock embedding generation
│   └── llmService.js        # LLM streaming responses
├── controllers/
│   └── ragController.js     # API endpoints logic
├── routes/
│   └── index.js            # Route definitions
├── app.js                  # Express application setup
├── server.js               # Local development server
└── handler.js              # Lambda handler for serverless
```

## Deployment Options

### 1. AWS Lambda + Function URLs
- Serverless, pay-per-request
- Built-in HTTPS and CORS
- Response streaming support

### 2. Lambda + API Gateway
- More advanced routing and authentication
- Custom domain support
- Request/response transformations

### 3. Lambda + CloudFront
- Global edge locations
- Caching for static content
- Custom SSL certificates

## Performance Considerations

- **Cold Starts**: Use provisioned concurrency for consistent performance
- **Memory**: Increase Lambda memory for faster embedding generation
- **Timeout**: Adjust based on your document retrieval and LLM response times
- **Connection Pooling**: Database connections are pooled for efficiency

## Security Best Practices

- Store API keys in AWS Secrets Manager
- Use IAM roles instead of access keys when possible
- Enable VPC for database connections
- Implement rate limiting and authentication
- Use HTTPS everywhere

## Monitoring

- CloudWatch logs for debugging
- X-Ray for distributed tracing
- Custom metrics for response times
- Health check endpoint for uptime monitoring

## License

MIT
