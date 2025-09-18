/**
 * @fileoverview HTTP server wrapper for Lambda handler - enables local testing of Lambda streaming
 * This allows testing the actual Lambda handler locally with AWS Lambda Web Adapter
 * @module LambdaServer
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import the core handler logic (not the Lambda-wrapped version)
import { handleRequest } from './handler';

const PORT = process.env.PORT || 8080;

/**
 * Convert HTTP request to Lambda event format
 */
function httpRequestToLambdaEvent(req: IncomingMessage, body: string): any {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const queryParams = Object.fromEntries(url.searchParams.entries());
  
  return {
    httpMethod: req.method || 'GET',
    path: url.pathname,
    queryStringParameters: Object.keys(queryParams).length > 0 ? queryParams : null,
    multiValueQueryStringParameters: null,
    headers: req.headers,
    multiValueHeaders: null,
    body: body || null,
    isBase64Encoded: false,
    pathParameters: null,
    stageVariables: null,
    requestContext: {
      requestId: `local-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      stage: 'local',
      resourceId: 'local',
      resourcePath: url.pathname,
      httpMethod: req.method || 'GET',
      requestTime: new Date().toISOString(),
      protocol: 'HTTP/1.1',
      accountId: '123456789012',
      apiId: 'local',
      identity: {
        sourceIp: req.socket.remoteAddress || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'local-test'
      },
      http: {
        method: req.method || 'GET',
        path: url.pathname,
        protocol: 'HTTP/1.1',
        sourceIp: req.socket.remoteAddress || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'local-test'
      }
    }
  };
}

/**
 * Mock Lambda context
 */
function createMockLambdaContext(): any {
  return {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'rag-api-local',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:rag-api-local',
    memoryLimitInMB: '2048',
    awsRequestId: `local-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    logGroupName: '/aws/lambda/rag-api-local',
    logStreamName: `2024/01/01/[$LATEST]${Math.random().toString(36).substring(2, 11)}`,
    getRemainingTimeInMillis: () => 900000, // 15 minutes
    done: () => {},
    fail: () => {},
    succeed: () => {}
  };
}

/**
 * Mock response stream that writes to HTTP response
 */
class MockResponseStream {
  private response: ServerResponse;
  private contentType: string = 'text/plain';

  constructor(response: ServerResponse) {
    this.response = response;
  }

  setContentType(contentType: string) {
    this.contentType = contentType;
    this.response.setHeader('Content-Type', contentType);
  }

  write(chunk: string | Buffer) {
    if (!this.response.headersSent) {
      this.response.setHeader('Content-Type', this.contentType);
      this.response.setHeader('Cache-Control', 'no-cache');
      this.response.setHeader('Connection', 'keep-alive');
      this.response.writeHead(200);
    }
    this.response.write(chunk);
  }

  end() {
    this.response.end();
  }
}

/**
 * HTTP Server that wraps Lambda handler
 */
const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // Collect request body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        // Convert HTTP request to Lambda event
        const lambdaEvent = httpRequestToLambdaEvent(req, body);
        const lambdaContext = createMockLambdaContext();
        
        // Create mock response stream
        const responseStream = new MockResponseStream(res);
        
        console.log('Invoking Lambda handler with event:', {
          method: lambdaEvent.httpMethod,
          path: lambdaEvent.path,
          headers: lambdaEvent.headers
        });

        // Call your actual Lambda handler logic
        try {
          await handleRequest(lambdaEvent, responseStream, lambdaContext);
        } catch (handlerError) {
          console.error('Handler execution error:', handlerError);
          if (!res.headersSent) {
            responseStream.setContentType('application/json');
            responseStream.write(JSON.stringify({
              error: 'HandlerError',
              message: handlerError instanceof Error ? handlerError.message : 'Handler execution failed'
            }));
          }
          responseStream.end();
        }
        
      } catch (error) {
        console.error('Lambda handler error:', error);
        
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'InternalServerError',
            message: error instanceof Error ? error.message : 'Unknown error'
          }));
        } else {
          res.end();
        }
      }
    });

  } catch (error) {
    console.error('Server error:', error);
    
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'ServerError',
        message: error instanceof Error ? error.message : 'Unknown server error'
      }));
    }
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Lambda handler server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🤖 Ask endpoint: http://localhost:${PORT}/ask`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⚡ Testing actual Lambda streaming handler locally!`);
});

export default server;
