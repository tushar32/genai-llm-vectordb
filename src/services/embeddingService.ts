/**
 * @fileoverview Embedding generation service supporting OpenAI and AWS Bedrock
 * @module EmbeddingService
 */

import OpenAI from 'openai';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { EmbeddingProvider, Embedding, EmbeddingOptions } from '../types/index';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Service for generating text embeddings using various providers
 * 
 * @example
 * ```typescript
 * import embeddingService from '@/services/embeddingService';
 * 
 * // Generate embedding using OpenAI
 * const embedding = await embeddingService.generateEmbedding('Hello world', 'openai');
 * 
 * // Generate embedding using Bedrock
 * const embedding = await embeddingService.generateEmbedding('Hello world', 'bedrock');
 * ```
 */
class EmbeddingService {
  private openai: OpenAI;
  private bedrockClient: BedrockRuntimeClient;

  constructor() {
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });

    // Initialize Bedrock client with default credential chain
    this.bedrockClient = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });

  }

  /**
   * Generate embedding using OpenAI's text-embedding models
   * 
   * @param text - Input text to embed
   * @param options - Embedding generation options
   * @returns Promise resolving to embedding vector
   * 
   * @throws {Error} When OpenAI API call fails
   * 
   * @example
   * ```typescript
   * const embedding = await embeddingService.generateEmbeddingOpenAI(
   *   'Machine learning is fascinating',
   *   { model: 'text-embedding-ada-002' }
   * );
   * ```
   */
  async generateEmbeddingOpenAI(
    text: string, 
    options: EmbeddingOptions = {}
  ): Promise<Embedding> {
    const { model = 'text-embedding-ada-002' } = options;

    try {
      const response = await this.openai.embeddings.create({
        model,
        input: text,
      });
      
      return response.data[0]?.embedding || [];
    } catch (error) {
      console.error('Error generating OpenAI embedding:', error);
      throw new Error(`Failed to generate embedding with OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embedding using AWS Bedrock's Titan embedding model
   * 
   * @param text - Input text to embed
   * @param options - Embedding generation options
   * @returns Promise resolving to embedding vector
   * 
   * @throws {Error} When Bedrock API call fails
   * 
   * @example
   * ```typescript
   * const embedding = await embeddingService.generateEmbeddingBedrock(
   *   'Natural language processing',
   *   { model: 'amazon.titan-embed-text-v1' }
   * );
   * ```
   */
  async generateEmbeddingBedrock(
    text: string, 
    options: EmbeddingOptions = {}
  ): Promise<Embedding> {
    const { model: modelId = 'amazon.titan-embed-text-v1' } = options;

    try {
      const input = {
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          inputText: text,
        }),
      };

      const command = new InvokeModelCommand(input);
      const response = await this.bedrockClient.send(command);
      
      if (!response.body) {
        throw new Error('No response body from Bedrock');
      }

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.embedding || [];
    } catch (error) {
      console.error('Error generating Bedrock embedding:', error);
      throw new Error(`Failed to generate embedding with Bedrock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embedding using the specified provider
   * 
   * @param text - Input text to embed
   * @param provider - Embedding provider ('openai' or 'bedrock')
   * @param options - Embedding generation options
   * @returns Promise resolving to embedding vector
   * 
   * @throws {Error} When embedding generation fails
   * 
   * @example
   * ```typescript
   * // Using OpenAI (default)
   * const embedding1 = await embeddingService.generateEmbedding('Hello world');
   * 
   * // Using Bedrock
   * const embedding2 = await embeddingService.generateEmbedding('Hello world', 'bedrock');
   * 
   * // With custom options
   * const embedding3 = await embeddingService.generateEmbedding(
   *   'Hello world', 
   *   'openai',
   *   { model: 'text-embedding-3-small' }
   * );
   * ```
   */
  async generateEmbedding(
    text: string, 
    provider: EmbeddingProvider = 'openai',
    options: EmbeddingOptions = {}
  ): Promise<Embedding> {
    if (!text || text.trim().length === 0) {
      throw new Error('Input text cannot be empty');
    }

    switch (provider) {
      case 'bedrock':
        return await this.generateEmbeddingBedrock(text, options);
      case 'openai':
      default:
        return await this.generateEmbeddingOpenAI(text, options);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * 
   * @param texts - Array of input texts
   * @param provider - Embedding provider
   * @param options - Embedding generation options
   * @returns Promise resolving to array of embedding vectors
   * 
   * @example
   * ```typescript
   * const texts = ['Hello world', 'Machine learning', 'Natural language processing'];
   * const embeddings = await embeddingService.generateEmbeddingsBatch(texts, 'openai');
   * ```
   */
  async generateEmbeddingsBatch(
    texts: string[],
    provider: EmbeddingProvider = 'openai',
    options: EmbeddingOptions = {}
  ): Promise<Embedding[]> {
    const embeddings: Embedding[] = [];
    
    for (const text of texts) {
      try {
        const embedding = await this.generateEmbedding(text, provider, options);
        embeddings.push(embedding);
      } catch (error) {
        console.error(`Failed to generate embedding for text: "${text.substring(0, 50)}..."`, error);
        // Push empty array for failed embeddings to maintain array length
        embeddings.push([]);
      }
    }
    
    return embeddings;
  }

  /**
   * Get the dimension of embeddings for a given provider and model
   * 
   * @param provider - Embedding provider
   * @param model - Model name (optional)
   * @returns Embedding dimension
   * 
   * @example
   * ```typescript
   * const dimension = embeddingService.getEmbeddingDimension('openai'); // Returns 1536
   * ```
   */
  getEmbeddingDimension(provider: EmbeddingProvider, model?: string): number {
    switch (provider) {
      case 'openai':
        if (model === 'text-embedding-3-small') return 1536;
        if (model === 'text-embedding-3-large') return 3072;
        return 1536; // Default for ada-002
      case 'bedrock':
        return 1536; // Titan embed text v1
      default:
        return 1536;
    }
  }

  /**
   * Validate if an embedding has the correct dimension
   * 
   * @param embedding - Embedding vector to validate
   * @param provider - Expected provider
   * @param model - Expected model (optional)
   * @returns True if embedding dimension is correct
   */
  validateEmbeddingDimension(
    embedding: Embedding, 
    provider: EmbeddingProvider, 
    model?: string
  ): boolean {
    const expectedDimension = this.getEmbeddingDimension(provider, model);
    return embedding.length === expectedDimension;
  }
}

/**
 * Singleton embedding service instance
 */
export default new EmbeddingService();
