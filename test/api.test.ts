/**
 * @fileoverview API endpoint tests
 */

import request from 'supertest';
import app from '@/app';
import { AskRequest, HealthResponse, ErrorResponse } from '@/types';

describe('RAG API Tests', () => {
  describe('GET /', () => {
    it('should return API information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body.version).toBe('1.0.0');
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/)
        .expect(200);

      const healthResponse: HealthResponse = response.body;
      expect(healthResponse).toHaveProperty('status');
      expect(healthResponse).toHaveProperty('timestamp');
      expect(healthResponse).toHaveProperty('services');
      expect(healthResponse.services).toHaveProperty('database');
      expect(healthResponse.services).toHaveProperty('embedding');
      expect(healthResponse.services).toHaveProperty('llm');
    });
  });

  describe('GET /api/info', () => {
    it('should return system information', async () => {
      const response = await request(app)
        .get('/api/info')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('providers');
    });
  });

  describe('POST /api/ask-json', () => {
    it('should return 400 for missing question', async () => {
      const response = await request(app)
        .post('/api/ask-json')
        .send({})
        .expect(400);

      const errorResponse: ErrorResponse = response.body;
      expect(errorResponse.error).toBe('Validation Error');
      expect(errorResponse.message).toContain('Question is required');
    });

    it('should return 400 for invalid provider', async () => {
      const invalidRequest: Partial<AskRequest> = {
        question: 'Test question',
        provider: 'invalid' as any
      };

      const response = await request(app)
        .post('/api/ask-json')
        .send(invalidRequest)
        .expect(400);

      const errorResponse: ErrorResponse = response.body;
      expect(errorResponse.message).toContain('Provider must be either');
    });

    it('should accept valid question format', async () => {
      const validRequest: AskRequest = {
        question: 'What is artificial intelligence?',
        provider: 'openai',
        limit: 3
      };

      const response = await request(app)
        .post('/api/ask-json')
        .send(validRequest)
        .expect(200);

      expect(response.body).toHaveProperty('answer');
      expect(response.body).toHaveProperty('sources');
      expect(Array.isArray(response.body.sources)).toBe(true);
    });

    it('should handle empty string question', async () => {
      const invalidRequest: AskRequest = {
        question: '   ',
        provider: 'openai'
      };

      const response = await request(app)
        .post('/api/ask-json')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.message).toContain('cannot be empty');
    });

    it('should validate limit parameter', async () => {
      const invalidRequest: AskRequest = {
        question: 'Test question',
        limit: 25 // Above maximum
      };

      const response = await request(app)
        .post('/api/ask-json')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.message).toContain('Limit must be between 1 and 20');
    });
  });

  describe('POST /api/ask', () => {
    it('should return 400 for missing question', async () => {
      const response = await request(app)
        .post('/api/ask')
        .send({})
        .expect(400);

      const errorResponse: ErrorResponse = response.body;
      expect(errorResponse.error).toBe('Validation Error');
    });

    it('should set correct headers for streaming', async () => {
      const validRequest: AskRequest = {
        question: 'Test question'
      };

      const response = await request(app)
        .post('/api/ask')
        .send(validRequest);

      expect(response.headers['content-type']).toMatch(/text\/plain/);
      expect(response.headers['transfer-encoding']).toBe('chunked');
    });

    it('should handle bedrock provider', async () => {
      const validRequest: AskRequest = {
        question: 'Test question',
        provider: 'bedrock'
      };

      const response = await request(app)
        .post('/api/ask')
        .send(validRequest);

      // Should not return validation error
      expect(response.status).not.toBe(400);
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/non-existent-route')
        .expect(404);

      const errorResponse: ErrorResponse = response.body;
      expect(errorResponse.error).toBe('Not Found');
      expect(errorResponse.message).toContain('/non-existent-route');
    });

    it('should return 404 for non-existent API routes', async () => {
      const response = await request(app)
        .post('/api/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/ask-json')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      // Express should handle malformed JSON
      expect(response.status).toBe(400);
    });
  });
});
