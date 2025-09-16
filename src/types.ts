/**
 * @fileoverview Type definitions for Lambda Function URLs
 * @module Types
 */

export interface LambdaEvent {
  version?: string;
  routeKey?: string;
  rawPath?: string;
  rawQueryString?: string;
  headers?: { [key: string]: string };
  queryStringParameters?: { [key: string]: string } | null;
  pathParameters?: { [key: string]: string } | null;
  body?: string;
  isBase64Encoded?: boolean;
  requestContext?: {
    accountId: string;
    apiId: string;
    domainName: string;
    domainPrefix: string;
    http: {
      method: string;
      path: string;
      protocol: string;
      sourceIp: string;
      userAgent: string;
    };
    requestId: string;
    routeKey: string;
    stage: string;
    time: string;
    timeEpoch: number;
  };
  // Legacy API Gateway format support
  path?: string;
  httpMethod?: string;
  resource?: string;
  multiValueHeaders?: { [key: string]: string[] };
  multiValueQueryStringParameters?: { [key: string]: string[] } | null;
  stageVariables?: { [key: string]: string } | null;
}

export interface LambdaContext {
  callbackWaitsForEmptyEventLoop: boolean;
  functionName: string;
  functionVersion: string;
  invokedFunctionArn: string;
  memoryLimitInMB: string;
  awsRequestId: string;
  logGroupName: string;
  logStreamName: string;
  getRemainingTimeInMillis(): number;
  done(error?: Error, result?: any): void;
  fail(error: Error | string): void;
  succeed(messageOrObject: any): void;
}

export interface StreamingResponse {
  statusCode: number;
  headers: { [key: string]: string };
  body?: string;
  isBase64Encoded?: boolean;
}

export interface DocumentSearchResult {
  id: string;
  content: string;
  metadata: any;
  similarity: number;
}

export interface RAGRequest {
  query: string;
  collection?: string;
  limit?: number;
}

export interface RAGResponse {
  answer: string;
  sources: Array<{
    content: string;
    metadata: any;
    similarity: number;
  }>;
  query: string;
  collection: string;
}

export interface AddDocumentRequest {
  content: string;
  collection?: string;
  metadata?: any;
}

export interface SearchRequest {
  query: string;
  collection?: string;
  limit?: number;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  database: 'connected' | 'disconnected';
  version: string;
}
