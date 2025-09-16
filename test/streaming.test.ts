import axios from 'axios';

const FUNCTION_URL = process.env.FUNCTION_URL || 'https://your-function-url.lambda-url.us-east-1.on.aws/';

describe('Lambda Function URL Streaming Tests', () => {
  const timeout = 60000; // 60 seconds for streaming

  test('Health check works with Function URL', async () => {
    const response = await axios.get(`${FUNCTION_URL}api/health`);
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('status', 'healthy');
  }, timeout);

  test('Streaming ask endpoint returns chunked response', async () => {
    const testQuery = {
      query: "What is artificial intelligence?",
      collection: "default"
    };

    const response = await axios.post(`${FUNCTION_URL}api/ask`, testQuery, {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'stream',
      timeout: 30000
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');

    // Collect streaming chunks
    const chunks: string[] = [];
    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk: Buffer) => {
        chunks.push(chunk.toString());
      });

      response.data.on('end', () => {
        expect(chunks.length).toBeGreaterThan(0);
        const fullResponse = chunks.join('');
        expect(fullResponse.length).toBeGreaterThan(10);
        resolve(fullResponse);
      });

      response.data.on('error', reject);
    });
  }, timeout);

  test('JSON ask endpoint returns complete response', async () => {
    const testQuery = {
      query: "What is machine learning?",
      collection: "default"
    };

    const response = await axios.post(`${FUNCTION_URL}api/ask-json`, testQuery, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('answer');
    expect(response.data).toHaveProperty('sources');
    expect(response.data).toHaveProperty('query', testQuery.query);
  }, timeout);

  test('Vector search endpoint works', async () => {
    const testQuery = {
      query: "artificial intelligence",
      collection: "default",
      limit: 5
    };

    const response = await axios.post(`${FUNCTION_URL}api/search`, testQuery, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('results');
    expect(Array.isArray(response.data.results)).toBe(true);
    expect(response.data).toHaveProperty('count');
  }, timeout);

  test('Add document endpoint works', async () => {
    const testDoc = {
      content: "This is a test document about streaming in Lambda Function URLs.",
      collection: "test",
      metadata: {
        title: "Test Document",
        type: "test"
      }
    };

    const response = await axios.post(`${FUNCTION_URL}api/documents`, testDoc, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('id');
    expect(response.data).toHaveProperty('message', 'Document added successfully');
  }, timeout);
});
