/**
 * @fileoverview LLM service for generating streaming responses using OpenAI and AWS Bedrock
 * @module LLMService
 */

import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { LLMProvider, RetrievedDocument, StreamingOptions, RAGPromptOptions } from '../types/index';
import { pipeline, Transform, Readable } from 'stream';
import { promisify } from 'util';
import dotenv from 'dotenv';

const pipelineAsync = promisify(pipeline);

dotenv.config();

/**
 * Service for generating LLM responses with streaming support
 * 
 * @example
 * ```typescript
 * import llmService from '@/services/llmService';
 * 
 * // Build RAG prompt
 * const prompt = llmService.buildRAGPrompt('What is AI?', retrievedDocs);
 * 
 * // Stream response
 * for await (const chunk of llmService.streamResponse(prompt, 'openai')) {
 *   console.log(chunk);
 * }
 * ```
 */
class LLMService {
  private bedrockClient: BedrockRuntimeClient;

  constructor() {
    // Initialize Bedrock client with default AWS credential chain
    // This will automatically use:
    // 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
    // 2. AWS credentials file (~/.aws/credentials)
    // 3. IAM roles (when running on EC2/Lambda)
    // 4. AWS SSO credentials
    this.bedrockClient = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  /**
   * Build a RAG (Retrieval-Augmented Generation) prompt from question and retrieved documents
   * 
   * @param question - User's question
   * @param retrievedDocs - Documents retrieved from vector search
   * @param options - Prompt building options
   * @returns Formatted RAG prompt
   * 
   * @example
   * ```typescript
   * const prompt = llmService.buildRAGPrompt(
   *   'What is machine learning?',
   *   retrievedDocs,
   *   {
   *     systemTemplate: 'You are an AI assistant specialized in technology.',
   *     maxContextLength: 4000
   *   }
   * );
   * ```
   */
  buildRAGPrompt(
    question: string,
    retrievedDocs: RetrievedDocument[],
    options: RAGPromptOptions = {}
  ): string {
    const {
      systemTemplate = 'You are a helpful AI assistant. Use the following context to answer the user\'s question. If the answer cannot be found in the context, say so clearly.',
      contextTemplate = 'Document {index}:\n{content}',
      maxContextLength = 8000
    } = options;

    let context = '';
    let currentLength = 0;

    for (let i = 0; i < retrievedDocs.length; i++) {
      const doc = retrievedDocs[i];
      if (!doc?.document) continue;
      
      const docText = contextTemplate
        .replace('{index}', (i + 1).toString())
        .replace('{content}', doc.document);
      
      // Check if adding this document would exceed max length
      if (currentLength + docText.length > maxContextLength) {
        break;
      }
      
      context += docText + '\n\n';
      currentLength += docText.length;
    }

    return `${systemTemplate}

Context:
${context}

Question: ${question}

Answer:`;
  }


  /**
   * Stream response from AWS Bedrock's Claude model
   * 
   * @param prompt - Input prompt
   * @param options - Streaming options
   * @returns Async generator yielding text chunks
   * 
   * @throws {Error} When Bedrock API call fails
   * 
   * @example
   * ```typescript
   * for await (const chunk of llmService.streamResponseBedrock(prompt)) {
   *   process.stdout.write(chunk);
   * }
   * ```
   */
  async *streamResponseBedrock(
    prompt: string,
    options: StreamingOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const {
      maxTokens = 1000,
      temperature = 0.7,
      stop
    } = options;

    const modelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';

    try {
      const input = {
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: maxTokens,
          temperature,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          stop_sequences: stop,
        }),
      };

      const command = new InvokeModelWithResponseStreamCommand(input);
      const response = await this.bedrockClient.send(command);

      if (!response.body) {
        throw new Error('No response body from Bedrock');
      }

      for await (const event of response.body) {
        if (event.chunk && event.chunk.bytes) {
          try {
            const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
            
            // Handle different event types from Bedrock streaming
            if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
              yield chunk.delta.text;
            }
          } catch (parseError) {
            console.warn('Failed to parse Bedrock chunk:', parseError);
            continue;
          }
        }
      }
    } catch (error) {
      console.error('Error streaming Bedrock response:', error);
      throw new Error(`Failed to stream response from Bedrock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stream response using Bedrock as the default provider
   * 
   * @param prompt - Input prompt
   * @param provider - LLM provider ('bedrock' is default)
   * @param options - Streaming options
   * @returns Async generator yielding text chunks
   * 
   * @throws {Error} When streaming fails
   * 
   * @example
   * ```typescript
   * // Stream from Bedrock (default)
   * for await (const chunk of llmService.streamResponse(prompt)) {
   *   console.log(chunk);
   * }
   * 
   * // Stream from Bedrock with options
   * for await (const chunk of llmService.streamResponse(prompt, 'bedrock', {
   *   maxTokens: 500,
   *   temperature: 0.5
   * })) {
   *   console.log(chunk);
   * }
   * ```
   */
  async *streamResponse(
    prompt: string,
    provider: LLMProvider = 'bedrock',
    options: StreamingOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('Prompt cannot be empty');
    }

    switch (provider) {
      case 'bedrock':
      default:
        yield* this.streamResponseBedrock(prompt, options);
        break;
    }
  }

  /**
   * Create a streaming pipeline from Bedrock to response using Node.js pipeline()
   * This provides better backpressure handling and error management
   * 
   * @param prompt - Input prompt
   * @param responseStream - Target writable stream
   * @param options - Streaming options
   * @returns Promise that resolves when pipeline completes
   * 
   * @example
   * ```typescript
   * await llmService.streamToPipeline(prompt, responseStream);
   * ```
   */
  async streamToPipeline(
    prompt: string, 
    responseStream: NodeJS.WritableStream,
    options: StreamingOptions = {}
  ): Promise<void> {
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('Prompt cannot be empty');
    }

    const {
      maxTokens = 4000,
      temperature = 0.7,
      topP = 0.9
    } = options;

    const modelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';
    
    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const command = new InvokeModelWithResponseStreamCommand({
      modelId,
      body,
      contentType: 'application/json',
      accept: 'application/json'
    });

    try {
      const response = await this.bedrockClient.send(command);
      
      if (!response.body) {
        throw new Error('No response body from Bedrock');
      }

      // Create transform stream to parse Bedrock chunks
      const bedrockParser = new Transform({
        objectMode: false,
        transform(chunk: any, encoding: BufferEncoding, callback: Function) {
          try {
            const chunkStr = chunk.toString();
            const lines = chunkStr.split('\n').filter((line: string) => line.trim());
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6);
                if (jsonStr === '[DONE]') {
                  callback();
                  return;
                }
                
                try {
                  const parsed = JSON.parse(jsonStr);
                  if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                    this.push(parsed.delta.text);
                  }
                } catch (parseError) {
                  console.warn('Failed to parse Bedrock chunk:', parseError);
                  // Continue processing other chunks
                }
              }
            }
            callback();
          } catch (error) {
            callback(error);
          }
        }
      });

      // Create pipeline: Bedrock Stream -> Parser -> Response Stream
      // Pipeline automatically handles backpressure and error propagation
      await pipelineAsync(
        Readable.from(response.body),
        bedrockParser,
        responseStream
      );

    } catch (error) {
      console.error('Error in Bedrock pipeline:', error);
      throw new Error(`Failed to stream response from Bedrock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a complete (non-streaming) response
   * 
   * @param prompt - Input prompt
   * @param provider - LLM provider
   * @param options - Generation options
   * @returns Promise resolving to complete response text
   * 
   * @example
   * ```typescript
   * const response = await llmService.generateResponse(
   *   'Explain quantum computing',
   *   'openai',
   *   { maxTokens: 500 }
   * );
   * ```
   */
  async generateResponse(
    prompt: string,
    provider: LLMProvider = 'openai',
    options: StreamingOptions = {}
  ): Promise<string> {
    let fullResponse = '';
    
    for await (const chunk of this.streamResponse(prompt, provider, options)) {
      fullResponse += chunk;
    }
    
    return fullResponse;
  }

  /**
   * Validate prompt length against model limits
   * 
   * @param prompt - Prompt to validate
   * @param provider - LLM provider
   * @param model - Specific model (optional)
   * @returns True if prompt is within limits
   */
  validatePromptLength(
    prompt: string,
    provider: LLMProvider,
    model?: string
  ): boolean {
    // Rough token estimation (1 token ≈ 4 characters)
    const estimatedTokens = Math.ceil(prompt.length / 4);
    
    let maxTokens: number;
    
    switch (provider) {
      case 'openai':
        if (model?.includes('gpt-4')) {
          maxTokens = model.includes('32k') ? 32000 : 8000;
        } else {
          maxTokens = 4000; // GPT-3.5-turbo
        }
        break;
      case 'bedrock':
        maxTokens = 100000; // Claude models
        break;
      default:
        maxTokens = 4000;
    }
    
    return estimatedTokens <= maxTokens * 0.8; // Leave 20% buffer for response
  }

  /**
   * Get available models for a provider
   * 
   * @param provider - LLM provider
   * @returns Array of available model names
   */
  getAvailableModels(provider: LLMProvider): string[] {
    switch (provider) {
      case 'openai':
        return [
          'gpt-3.5-turbo',
          'gpt-3.5-turbo-16k',
          'gpt-4',
          'gpt-4-32k',
          'gpt-4-turbo-preview'
        ];
      case 'bedrock':
        return [
          'anthropic.claude-3-sonnet-20240229-v1:0',
          'anthropic.claude-3-haiku-20240307-v1:0',
          'anthropic.claude-v2:1',
          'anthropic.claude-instant-v1'
        ];
      default:
        return [];
    }
  }
}

/**
 * Singleton LLM service instance
 */
export default new LLMService();
