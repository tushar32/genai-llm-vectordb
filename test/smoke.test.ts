import axios from 'axios';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';

describe('Smoke Tests', () => {
  const timeout = 30000; // 30 seconds

  beforeAll(async () => {
    // Wait for API to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));
  });

  test('Health check endpoint responds', async () => {
    const response = await axios.get(`${API_BASE_URL}/api/health`);
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('status', 'healthy');
  }, timeout);

  test('Database connection is working', async () => {
    const response = await axios.get(`${API_BASE_URL}/api/health`);
    expect(response.data).toHaveProperty('database', 'connected');
  }, timeout);

  test('Ask endpoint accepts requests', async () => {
    const testQuery = {
      query: "What is machine learning?",
      collection: "default"
    };

    const response = await axios.post(`${API_BASE_URL}/api/ask-json`, testQuery, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('answer');
  }, timeout);

  test('Vector search returns results', async () => {
    const testQuery = {
      query: "artificial intelligence",
      collection: "default",
      limit: 5
    };

    const response = await axios.post(`${API_BASE_URL}/api/search`, testQuery, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.results)).toBe(true);
  }, timeout);

  test('Streaming endpoint is accessible', async () => {
    const testQuery = {
      query: "What is AI?",
      collection: "default"
    };

    const response = await axios.post(`${API_BASE_URL}/api/ask`, testQuery, {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'stream',
      timeout: 10000
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
  }, timeout);
});
