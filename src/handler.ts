/**
 * @fileoverview Lambda handler with streaming response support
 * @module Handler
 */

import util from 'util';
import stream from 'stream';
import DatabaseService from './config/database';
import EmbeddingService from './services/embeddingService';
import LLMService from './services/llmService';

const { Readable } = stream;
const pipeline = util.promisify(stream.pipeline);

// AWS Lambda streaming response is available as awslambda.streamifyResponse
/* global awslambda */

// Initialize services
const dbService = DatabaseService;
const embeddingService = EmbeddingService;
const llmService = LLMService;

/**
 * Parse request body from Lambda event
 */
function parseRequestBody(event: any): any {
  try {
    if (event.body) {
      return event.isBase64Encoded 
        ? JSON.parse(Buffer.from(event.body, 'base64').toString())
        : JSON.parse(event.body);
    }
    return {};
  } catch (error) {
    console.error('Error parsing request body:', error);
    return {};
  }
}


/**
 * Main Lambda handler with streaming response support
 */
export const handler = awslambda.streamifyResponse(async (event, responseStream, _context) => {
  console.log('Lambda streaming request:', {
    path: event.path,
    method: event.requestContext?.http?.method || event.httpMethod,
    headers: event.headers
  });

  try {
    const method = event.requestContext?.http?.method || event.httpMethod;
    const path = event.path;

    // Set streaming headers
    responseStream.setContentType('text/plain; charset=utf-8');

    if (path === '/health' && method === 'GET') {
      const isHealthy = await dbService.raw('SELECT 1').then(() => true).catch(() => false);
      
      const healthResponse = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        database: isHealthy ? 'connected' : 'disconnected',
        version: process.env.npm_package_version || '1.0.0'
      };
      
      responseStream.write(JSON.stringify(healthResponse));
      responseStream.end();
      return;
    }

    if (path === '/ask' && method === 'POST') {
      const body = parseRequestBody(event);
      const { query, collection = 'default', limit = 5 } = body;

      if (!query) {
        responseStream.write('Error: Query parameter is required');
        responseStream.end();
        return;
      }

      // Generate query embedding
      const queryEmbedding = await embeddingService.generateEmbedding(query);
      
      // Search for relevant documents
      const searchResults = await dbService.raw(
        `SELECT document, cmetadata, 1 - (embedding <=> ?::vector) as similarity 
         FROM embeddings 
         WHERE 1 - (embedding <=> ?::vector) > 0.5 
         ORDER BY embedding <=> ?::vector 
         LIMIT ?`,
        [`[${queryEmbedding.join(',')}]`, `[${queryEmbedding.join(',')}]`, `[${queryEmbedding.join(',')}]`, limit]
      );

      if (searchResults.rows?.length === 0) {
        responseStream.write('No relevant documents found for your query.');
        responseStream.end();
        return;
      }

      // Build RAG prompt with retrieved documents
      const ragPrompt = llmService.buildRAGPrompt(query, searchResults.rows.map((result: any) => ({
        document: result.document,
        metadata: result.cmetadata
      })));

      // Use pipeline for streaming response with automatic backpressure
      try {
        await llmService.streamToPipeline(ragPrompt, responseStream);
      } catch (error) {
        console.error('Pipeline streaming error:', error);
        responseStream.write(`\n\nError: ${error instanceof Error ? error.message : 'Unknown streaming error'}`);
      }
      
      responseStream.end();
      return;
    }

    responseStream.write(`Method ${method} not allowed for path ${path}`);
    responseStream.end();

  } catch (error) {
    console.error('Handler error:', error);
    responseStream.write(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    responseStream.end();
  }
});
