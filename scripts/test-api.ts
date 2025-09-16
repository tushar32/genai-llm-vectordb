#!/usr/bin/env ts-node

/**
 * @fileoverview API testing script for manual testing
 */

import axios, { AxiosResponse } from 'axios';
import { AskRequest, AskJsonResponse, HealthResponse } from '../src/types';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  duration?: number;
}

class APITester {
  private results: TestResult[] = [];

  private async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    try {
      await testFn();
      const duration = Date.now() - startTime;
      this.results.push({
        name,
        success: true,
        message: 'Passed',
        duration
      });
      console.log(`✅ ${name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.results.push({
        name,
        success: false,
        message,
        duration
      });
      console.error(`❌ ${name} (${duration}ms): ${message}`);
    }
  }

  async testHealthEndpoint(): Promise<void> {
    await this.runTest('Health Endpoint', async () => {
      const response: AxiosResponse<HealthResponse> = await axios.get(`${API_BASE_URL}/api/health`);
      
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      
      const health = response.data;
      if (!health.status || !health.timestamp || !health.services) {
        throw new Error('Invalid health response structure');
      }
      
      console.log('   Health Status:', health.status);
      console.log('   Services:', health.services);
    });
  }

  async testInfoEndpoint(): Promise<void> {
    await this.runTest('Info Endpoint', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/info`);
      
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      
      const info = response.data;
      console.log('   Version:', info.version);
      console.log('   Environment:', info.environment);
      console.log('   Document Count:', info.database?.documentCount || 'N/A');
    });
  }

  async testAskJsonEndpoint(): Promise<void> {
    await this.runTest('Ask JSON Endpoint', async () => {
      const request: AskRequest = {
        question: 'What is artificial intelligence?',
        provider: 'openai',
        limit: 3
      };

      const response: AxiosResponse<AskJsonResponse> = await axios.post(
        `${API_BASE_URL}/api/ask-json`,
        request
      );
      
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      
      const result = response.data;
      if (!result.answer || !Array.isArray(result.sources)) {
        throw new Error('Invalid response structure');
      }
      
      console.log('   Answer Length:', result.answer.length);
      console.log('   Sources Found:', result.sources.length);
      
      if (result.sources.length > 0) {
        console.log('   Top Similarity:', result.sources[0].similarity);
      }
    });
  }

  async testStreamingEndpoint(): Promise<void> {
    await this.runTest('Streaming Endpoint', async () => {
      const request: AskRequest = {
        question: 'Explain machine learning in simple terms',
        provider: 'openai'
      };

      const response = await axios.post(`${API_BASE_URL}/api/ask`, request, {
        responseType: 'stream',
        timeout: 30000
      });

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      let chunks = 0;
      let totalLength = 0;

      return new Promise<void>((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          chunks++;
          totalLength += chunk.length;
        });

        response.data.on('end', () => {
          console.log('   Chunks Received:', chunks);
          console.log('   Total Length:', totalLength);
          
          if (chunks === 0) {
            reject(new Error('No chunks received'));
          } else {
            resolve();
          }
        });

        response.data.on('error', (error: Error) => {
          reject(error);
        });

        // Timeout after 30 seconds
        setTimeout(() => {
          reject(new Error('Streaming timeout'));
        }, 30000);
      });
    });
  }

  async testInvalidRequest(): Promise<void> {
    await this.runTest('Invalid Request Handling', async () => {
      try {
        await axios.post(`${API_BASE_URL}/api/ask-json`, {});
      } catch (error: any) {
        if (error.response?.status === 400) {
          console.log('   Properly handled invalid request');
          return;
        }
        throw new Error(`Expected 400 status, got ${error.response?.status || 'no response'}`);
      }
      throw new Error('Should have returned 400 for invalid request');
    });
  }

  async testProviderValidation(): Promise<void> {
    await this.runTest('Provider Validation', async () => {
      const request = {
        question: 'Test question',
        provider: 'invalid_provider'
      };

      try {
        await axios.post(`${API_BASE_URL}/api/ask-json`, request);
      } catch (error: any) {
        if (error.response?.status === 400) {
          console.log('   Properly validated provider');
          return;
        }
        throw new Error(`Expected 400 status for invalid provider`);
      }
      throw new Error('Should have returned 400 for invalid provider');
    });
  }

  async testBedrockProvider(): Promise<void> {
    await this.runTest('Bedrock Provider', async () => {
      const request: AskRequest = {
        question: 'What is machine learning?',
        provider: 'bedrock',
        limit: 2
      };

      const response: AxiosResponse<AskJsonResponse> = await axios.post(
        `${API_BASE_URL}/api/ask-json`,
        request
      );
      
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      
      console.log('   Bedrock response received');
    });
  }

  printSummary(): void {
    console.log('\n📊 Test Summary');
    console.log('================');
    
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => r.success === false).length;
    const totalTime = this.results.reduce((sum, r) => sum + (r.duration || 0), 0);
    
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total Time: ${totalTime}ms`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.success)
        .forEach(r => console.log(`   - ${r.name}: ${r.message}`));
    }
    
    console.log(`\n${failed === 0 ? '🎉' : '⚠️'} ${failed === 0 ? 'All tests passed!' : 'Some tests failed'}`);
  }

  async runAllTests(): Promise<void> {
    console.log(`🚀 Testing RAG API at ${API_BASE_URL}\n`);
    
    await this.testHealthEndpoint();
    await this.testInfoEndpoint();
    await this.testInvalidRequest();
    await this.testProviderValidation();
    await this.testAskJsonEndpoint();
    await this.testBedrockProvider();
    await this.testStreamingEndpoint();
    
    this.printSummary();
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new APITester();
  tester.runAllTests().catch(console.error);
}

export { APITester };
