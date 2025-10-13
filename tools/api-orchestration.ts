import axios, { AxiosRequestConfig } from 'axios';
import { Tool } from './types.js';

/**
 * API Orchestration Tool - Comprehensive API integration and workflow
 * Enables autonomous API requests, data processing, and system integration
 */
export const apiOrchestration: Tool = {
  name: 'api_orchestration',
  description: 'Make API requests and orchestrate external integrations',
  parameters: {
    type: 'object',
    properties: {
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        description: 'HTTP method',
      },
      url: {
        type: 'string',
        description: 'API endpoint URL',
      },
      headers: {
        type: 'object',
        description: 'HTTP headers',
      },
      body: {
        type: 'object',
        description: 'Request body (for POST, PUT, PATCH)',
      },
      params: {
        type: 'object',
        description: 'URL query parameters',
      },
      timeout: {
        type: 'number',
        description: 'Request timeout in milliseconds (default: 30000)',
      },
      auth: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['basic', 'bearer', 'api_key'],
          },
          token: { type: 'string' },
          username: { type: 'string' },
          password: { type: 'string' },
          apiKey: { type: 'string' },
          apiKeyHeader: { type: 'string' },
        },
        description: 'Authentication configuration',
      },
      retries: {
        type: 'number',
        description: 'Number of retry attempts (default: 0)',
      },
    },
    required: ['method', 'url'],
  },

  async execute(args: any): Promise<any> {
    const {
      method,
      url,
      headers = {},
      body,
      params,
      timeout = 30000,
      auth,
      retries = 0,
    } = args;

    try {
      // Configure authentication
      const authHeaders: any = { ...headers };
      if (auth) {
        switch (auth.type) {
          case 'bearer':
            authHeaders['Authorization'] = `Bearer ${auth.token}`;
            break;
          case 'basic':
            const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
            authHeaders['Authorization'] = `Basic ${credentials}`;
            break;
          case 'api_key':
            const keyHeader = auth.apiKeyHeader || 'X-API-Key';
            authHeaders[keyHeader] = auth.apiKey;
            break;
        }
      }

      // Build request configuration
      const config: AxiosRequestConfig = {
        method,
        url,
        headers: authHeaders,
        timeout,
      };

      if (params) {
        config.params = params;
      }

      if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        config.data = body;
      }

      // Execute request with retry logic
      let lastError: any = null;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const response = await axios(config);
          return {
            success: true,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data,
            url,
            method,
            timestamp: new Date().toISOString(),
          };
        } catch (error: any) {
          lastError = error;
          if (attempt < retries) {
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            continue;
          }
        }
      }

      // If all retries failed
      throw lastError;
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url,
        method,
      };
    }
  },
};

export default apiOrchestration;
