# RAG API Documentation

## Overview

The RAG (Retrieval-Augmented Generation) API provides intelligent question-answering capabilities by combining vector similarity search with large language models. It supports both streaming and JSON responses using OpenAI and AWS Bedrock providers.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://your-lambda-url.amazonaws.com`

## Authentication

Currently, no authentication is required. API keys for OpenAI/Bedrock are configured server-side.

## Endpoints

### GET /api/health

Health check endpoint to verify system status.

**Response**
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

**Status Codes**
- `200` - All services healthy
- `503` - One or more services unhealthy
- `500` - Internal server error

### GET /api/info

System information and statistics.

**Response**
```json
{
  "version": "1.0.0",
  "environment": "development",
  "database": {
    "documentCount": 1250,
    "tableName": "langchain_pg_embedding"
  },
  "providers": {
    "embedding": ["openai", "bedrock"],
    "llm": ["openai", "bedrock"]
  },
  "models": {
    "openai": ["gpt-3.5-turbo", "gpt-4"],
    "bedrock": ["anthropic.claude-3-sonnet-20240229-v1:0"]
  }
}
```

### POST /api/ask

Streaming RAG endpoint that returns real-time text chunks.

**Request Body**
```json
{
  "question": "What is machine learning?",
  "provider": "openai",
  "limit": 5
}
```

**Parameters**
- `question` (required): User's question
- `provider` (optional): LLM provider (`"openai"` or `"bedrock"`, default: `"openai"`)
- `limit` (optional): Number of similar documents to retrieve (1-20, default: 5)

**Response**
- Content-Type: `text/plain; charset=utf-8`
- Transfer-Encoding: `chunked`
- Streaming text response

**Example**
```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is artificial intelligence?",
    "provider": "openai",
    "limit": 3
  }'
```

### POST /api/ask-json

Non-streaming RAG endpoint that returns complete JSON response with sources.

**Request Body**
```json
{
  "question": "Explain neural networks",
  "provider": "bedrock",
  "limit": 5
}
```

**Response**
```json
{
  "answer": "Neural networks are computational models inspired by biological neural networks...",
  "sources": [
    {
      "id": 1,
      "content": "A neural network is a series of algorithms...",
      "similarity": 0.89,
      "metadata": {
        "source": "neural_networks.pdf",
        "page": 1
      }
    }
  ]
}
```

**Status Codes**
- `200` - Success
- `400` - Invalid request parameters
- `500` - Internal server error

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "details": "Stack trace (development only)"
}
```

## Rate Limits

No rate limits are currently enforced, but consider implementing them for production use.

## Examples

### JavaScript/Fetch

```javascript
// Streaming request
const response = await fetch('/api/ask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: 'What is quantum computing?',
    provider: 'openai'
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  console.log(chunk);
}
```

```javascript
// JSON request
const response = await fetch('/api/ask-json', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: 'Explain machine learning algorithms',
    limit: 3
  })
});

const data = await response.json();
console.log(data.answer);
console.log(data.sources);
```

### Python

```python
import requests
import json

# JSON request
response = requests.post('http://localhost:3000/api/ask-json', 
  json={
    'question': 'What is deep learning?',
    'provider': 'openai',
    'limit': 5
  }
)

data = response.json()
print(data['answer'])
for source in data['sources']:
    print(f"Source {source['id']}: {source['similarity']}")
```

### cURL

```bash
# Health check
curl http://localhost:3000/api/health

# Streaming request
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is AI?", "provider": "openai"}'

# JSON request
curl -X POST http://localhost:3000/api/ask-json \
  -H "Content-Type: application/json" \
  -d '{"question": "Explain transformers", "limit": 3}' | jq
```

## WebSocket Support

WebSocket support is not currently implemented but could be added for real-time bidirectional communication.

## Deployment

The API can be deployed as:
- **Local Development**: Node.js server
- **AWS Lambda**: Serverless deployment with Function URLs
- **Docker**: Containerized deployment
- **CloudFront**: Global CDN with Lambda backend

See deployment documentation for specific instructions.
