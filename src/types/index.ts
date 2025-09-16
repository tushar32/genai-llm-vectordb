/**
 * @fileoverview Type definitions for the RAG API application
 * @author RAG API Team
 * @version 1.0.0
 */

// Removed express dependency - using native types instead

/**
 * Supported LLM providers
 */
export type LLMProvider = 'openai' | 'bedrock';

/**
 * Supported embedding providers
 */
export type EmbeddingProvider = 'openai' | 'bedrock';

/**
 * Vector embedding representation
 */
export type Embedding = number[];

/**
 * Document metadata structure
 */
export interface DocumentMetadata {
  source?: string;
  page?: number;
  chunk_id?: string;
  [key: string]: any;
}

/**
 * Retrieved document from vector search
 */
export interface RetrievedDocument {
  /** Document content */
  document: string;
  /** Similarity score (0-1, higher is more similar) */
  similarity: number;
  /** Document metadata */
  cmetadata: DocumentMetadata;
  /** Unique document identifier */
  uuid?: string;
}

/**
 * Request body for ask endpoints
 */
export interface AskRequest {
  /** User question */
  question: string;
  /** LLM provider to use */
  provider?: LLMProvider;
  /** Number of similar documents to retrieve */
  limit?: number;
}

/**
 * Source information in response
 */
export interface SourceInfo {
  /** Source identifier */
  id: number;
  /** Truncated content preview */
  content: string;
  /** Similarity score */
  similarity: number;
  /** Document metadata */
  metadata: DocumentMetadata;
}

/**
 * JSON response structure
 */
export interface AskJsonResponse {
  /** Generated answer */
  answer: string;
  /** Source documents used */
  sources: SourceInfo[];
}

/**
 * Health check response
 */
export interface HealthResponse {
  /** Service status */
  status: 'healthy' | 'unhealthy';
  /** Response timestamp */
  timestamp: string;
  /** Service availability status */
  services: {
    database: 'connected' | 'disconnected';
    embedding: 'available' | 'unavailable';
    llm: 'available' | 'unavailable';
  };
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  /** Error type */
  error: string;
  /** Error message */
  message: string;
  /** Additional error details (development only) */
  details?: any;
}

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * OpenAI configuration
 */
export interface OpenAIConfig {
  apiKey: string;
  embeddingModel?: string;
  chatModel?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * AWS Bedrock configuration
 */
export interface BedrockConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  embeddingModelId?: string;
  chatModelId?: string;
}

/**
 * Application configuration
 */
export interface AppConfig {
  port: number;
  nodeEnv: string;
  database: DatabaseConfig;
  openai: OpenAIConfig;
  bedrock: BedrockConfig;
}

/**
 * Generic request interface
 */
export interface TypedRequest<T = any> {
  body: T;
  headers: { [key: string]: string };
  method: string;
  path: string;
}

/**
 * Generic response interface
 */
export interface TypedResponse<T = any> {
  json(body: T): any;
  status(code: number): any;
}

/**
 * Streaming chunk data
 */
export interface StreamChunk {
  /** Text content */
  content: string;
  /** Chunk metadata */
  metadata?: {
    model?: string;
    provider?: LLMProvider;
    timestamp?: string;
  };
}

/**
 * LLM streaming options
 */
export interface StreamingOptions {
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature for randomness (0-1) */
  temperature?: number;
  /** Top-p sampling parameter (0-1) */
  topP?: number;
  /** Stop sequences */
  stop?: string[];
}

/**
 * Vector search options
 */
export interface VectorSearchOptions {
  /** Table name to search in */
  tableName?: string;
  /** Number of results to return */
  limit?: number;
  /** Minimum similarity threshold */
  threshold?: number;
}

/**
 * Embedding generation options
 */
export interface EmbeddingOptions {
  /** Model to use for embedding */
  model?: string;
  /** Input text preprocessing */
  preprocess?: boolean;
}

/**
 * RAG prompt building options
 */
export interface RAGPromptOptions {
  /** System message template */
  systemTemplate?: string;
  /** Context template */
  contextTemplate?: string;
  /** Maximum context length */
  maxContextLength?: number;
}

/**
 * Lambda event context (for serverless deployment)
 */
export interface LambdaContext {
  requestId: string;
  functionName: string;
  functionVersion: string;
  invokedFunctionArn: string;
  memoryLimitInMB: string;
  awsRequestId: string;
  logGroupName: string;
  logStreamName: string;
  getRemainingTimeInMillis(): number;
}

/**
 * Lambda event structure
 */
export interface LambdaEvent {
  httpMethod: string;
  path: string;
  queryStringParameters?: { [key: string]: string };
  headers: { [key: string]: string };
  body?: string;
  isBase64Encoded: boolean;
  requestContext: {
    requestId: string;
    http: {
      method: string;
      path: string;
      protocol: string;
      sourceIp: string;
      userAgent: string;
    };
  };
}
