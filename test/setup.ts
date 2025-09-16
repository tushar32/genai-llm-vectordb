/**
 * @fileoverview Test setup and mocks for Jest
 */

import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Mock external services for testing
jest.mock('@/services/embeddingService', () => ({
  generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
  generateEmbeddingsBatch: jest.fn().mockResolvedValue([[0.1, 0.2], [0.3, 0.4]]),
  getEmbeddingDimension: jest.fn().mockReturnValue(1536),
  validateEmbeddingDimension: jest.fn().mockReturnValue(true)
}));

jest.mock('@/services/llmService', () => ({
  buildRAGPrompt: jest.fn().mockReturnValue('Mocked RAG prompt'),
  streamResponse: jest.fn().mockImplementation(async function* () {
    yield 'Mocked ';
    yield 'response ';
    yield 'text';
  }),
  generateResponse: jest.fn().mockResolvedValue('Mocked complete response'),
  validatePromptLength: jest.fn().mockReturnValue(true),
  getAvailableModels: jest.fn().mockReturnValue(['gpt-3.5-turbo'])
}));

jest.mock('@/config/database', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  similaritySearch: jest.fn().mockResolvedValue([
    {
      document: 'Sample document content for testing',
      similarity: 0.85,
      cmetadata: { source: 'test.txt', page: 1 },
      uuid: 'test-uuid-123'
    }
  ]),
  insertDocument: jest.fn().mockResolvedValue('test-uuid-123'),
  getDocumentCount: jest.fn().mockResolvedValue(100),
  testConnection: jest.fn().mockResolvedValue(true),
  close: jest.fn().mockResolvedValue(undefined)
}));

// Global test timeout
jest.setTimeout(10000);
