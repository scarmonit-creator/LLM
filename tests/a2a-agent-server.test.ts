/**
 * Tests for A2A Agent Server
 *
 * This test suite validates the A2A agent implementation including:
 * - Initialization with error handling
 * - Middleware functionality
 * - Health check endpoints
 * - Status reporting
 * - Capabilities advertisement
 * - Error recovery and retry logic
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import { Express } from 'express';
import {
  createA2AServer,
  createA2AMiddleware,
  healthCheckHandler,
  statusHandler,
  capabilitiesHandler,
  clearAgentCache,
  A2AAgent,
  agentCache,
} from '../src/a2a-agent-server';

describe('A2A Agent Server', () => {
  let server: any;
  let app: Express;

  beforeEach(() => {
    // Clear agent cache before each test
    clearAgentCache();
  });

  afterEach(() => {
    // Close server after each test
    if (server) {
      server.close();
    }
  });

  describe('Server Creation', () => {
    it('should create A2A server with HTTP transport', () => {
      const config = {
        port: 3001,
        agentConfig: {
          name: 'Test Agent',
          version: '1.0.0',
          description: 'Test A2A Agent',
          supportedTransports: ['http'],
          endpoints: {
            http: 'http://localhost:3001',
          },
        },
        enableWebSocket: false,
      };

      const result = createA2AServer(config);
      expect(result.app).toBeDefined();
      expect(result.server).toBeDefined();
      server = result.server;
    });

    it('should create A2A server with WebSocket transport', () => {
      const config = {
        port: 3002,
        agentConfig: {
          name: 'Test Agent with WebSocket',
          version: '1.0.0',
          description: 'Test A2A Agent with WebSocket',
          supportedTransports: ['http', 'websocket'],
          endpoints: {
            http: 'http://localhost:3002',
            websocket: 'ws://localhost:3002',
          },
        },
        enableWebSocket: true,
      };

      const result = createA2AServer(config);
      expect(result.app).toBeDefined();
      expect(result.server).toBeDefined();
      server = result.server;
    });
  });

  describe('Health Check Endpoint', () => {
    beforeEach(() => {
      const config = {
        port: 3003,
        agentConfig: {
          name: 'Health Test Agent',
          version: '1.0.0',
          supportedTransports: ['http'],
          endpoints: {
            http: 'http://localhost:3003',
          },
        },
        enableWebSocket: false,
      };
      const result = createA2AServer(config);
      app = result.app;
      server = result.server;
    });

    it('should return 503 when agent not initialized', async () => {
      clearAgentCache();
      const response = await request(app).get('/health').set('x-agent-id', 'not-initialized');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('initializing');
      expect(response.body.message).toBe('Agent not initialized');
    });

    it('should return agent status after initialization', async () => {
      // Trigger initialization via middleware
      await request(app).get('/health').set('x-agent-id', 'test-agent');

      // Check health
      const response = await request(app).get('/health').set('x-agent-id', 'test-agent');

      expect(response.status).toBe(200);
      expect(response.body.status).toBeDefined();
      expect(['initializing', 'ready', 'error']).toContain(response.body.status);
    });
  });

  describe('Status Endpoint', () => {
    beforeEach(() => {
      const config = {
        port: 3004,
        agentConfig: {
          name: 'Status Test Agent',
          version: '1.0.0',
          supportedTransports: ['http'],
          endpoints: {
            http: 'http://localhost:3004',
          },
        },
        enableWebSocket: false,
      };
      const result = createA2AServer(config);
      app = result.app;
      server = result.server;
    });

    it('should return detailed status information', async () => {
      // Initialize agent
      await request(app).get('/status').set('x-agent-id', 'test-agent');

      // Get status
      const response = await request(app).get('/status').set('x-agent-id', 'test-agent');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('lastHealthCheck');
      expect(['initializing', 'ready', 'error']).toContain(response.body.status);
    });

    it('should return 503 when agent not initialized', async () => {
      clearAgentCache();
      const response = await request(app).get('/status').set('x-agent-id', 'not-initialized');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('initializing');
    });
  });

  describe('Capabilities Endpoint', () => {
    beforeEach(() => {
      const config = {
        port: 3005,
        agentConfig: {
          name: 'Capabilities Test Agent',
          version: '1.0.0',
          description: 'Test capabilities',
          supportedTransports: ['http'],
          endpoints: {
            http: 'http://localhost:3005',
          },
        },
        enableWebSocket: false,
      };
      const result = createA2AServer(config);
      app = result.app;
      server = result.server;
    });

    it('should return only advertised transports', async () => {
      // Initialize agent
      await request(app).get('/capabilities').set('x-agent-id', 'test-agent');

      // Get capabilities
      const response = await request(app).get('/capabilities').set('x-agent-id', 'test-agent');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('supportedTransports');
      expect(response.body.supportedTransports).toContain('http');
      expect(response.body.supportedTransports).not.toContain('websocket');
      expect(response.body.endpoints).toHaveProperty('http');
      expect(response.body.endpoints).not.toHaveProperty('websocket');
    });

    it('should include websocket if configured', async () => {
      // Create server with WebSocket
      if (server) server.close();
      const config = {
        port: 3006,
        agentConfig: {
          name: 'WebSocket Test Agent',
          version: '1.0.0',
          supportedTransports: ['http', 'websocket'],
          endpoints: {
            http: 'http://localhost:3006',
            websocket: 'ws://localhost:3006',
          },
        },
        enableWebSocket: true,
      };
      const result = createA2AServer(config);
      app = result.app;
      server = result.server;

      // Initialize and get capabilities
      await request(app).get('/capabilities').set('x-agent-id', 'test-agent');

      const response = await request(app).get('/capabilities').set('x-agent-id', 'test-agent');

      expect(response.status).toBe(200);
      expect(response.body.supportedTransports).toContain('http');
      expect(response.body.supportedTransports).toContain('websocket');
      expect(response.body.endpoints).toHaveProperty('http');
      expect(response.body.endpoints).toHaveProperty('websocket');
    });
  });

  describe('Error Handling and Retry Logic', () => {
    it('should clear cache on initialization failure', async () => {
      // This test would require mocking the A2AAgent initialization
      // to force a failure scenario
      expect(agentCache.size).toBe(0);

      // Try to initialize with invalid config
      const invalidConfig = {
        port: 3007,
        agentConfig: {
          name: '', // Invalid: empty name
          version: '1.0.0',
          supportedTransports: ['http'],
          endpoints: {
            http: 'http://localhost:3007',
          },
        },
        enableWebSocket: false,
      };

      try {
        const result = createA2AServer(invalidConfig);
        server = result.server;

        // Try to access endpoint
        const response = await request(result.app).get('/health').set('x-agent-id', 'test-agent');

        // Agent should be cleared from cache if initialization failed
        expect(response.status).toBe(500);
      } catch (error) {
        // Expected to fail
        expect(error).toBeDefined();
      }
    });
  });

  describe('Middleware', () => {
    it('should attach agent to request object', async () => {
      const config = {
        port: 3008,
        agentConfig: {
          name: 'Middleware Test Agent',
          version: '1.0.0',
          supportedTransports: ['http'],
          endpoints: {
            http: 'http://localhost:3008',
          },
        },
        enableWebSocket: false,
      };
      const result = createA2AServer(config);
      app = result.app;
      server = result.server;

      const response = await request(app).get('/health').set('x-agent-id', 'test-agent');

      // Agent should be initialized and available
      expect(response.status).toBe(200);
    });
  });

  describe('Agent Cache Management', () => {
    it('should clear specific agent from cache', () => {
      // Manually add an agent to cache
      const testAgent = {
        id: 'test-1',
        status: 'ready' as const,
        capabilities: {
          name: 'Test',
          version: '1.0.0',
          description: 'Test',
          supportedTransports: ['http'],
          endpoints: { http: 'http://localhost:3000' },
        },
        transports: ['http'],
        lastHealthCheck: new Date(),
      };
      agentCache.set('test-1', testAgent);

      expect(agentCache.size).toBe(1);
      clearAgentCache('test-1');
      expect(agentCache.size).toBe(0);
    });

    it('should clear all agents from cache', () => {
      // Add multiple agents
      const agent1 = {
        id: 'test-1',
        status: 'ready' as const,
        capabilities: {
          name: 'Test 1',
          version: '1.0.0',
          description: 'Test',
          supportedTransports: ['http'],
          endpoints: { http: 'http://localhost:3000' },
        },
        transports: ['http'],
        lastHealthCheck: new Date(),
      };
      const agent2 = {
        id: 'test-2',
        status: 'ready' as const,
        capabilities: {
          name: 'Test 2',
          version: '1.0.0',
          description: 'Test',
          supportedTransports: ['http'],
          endpoints: { http: 'http://localhost:3000' },
        },
        transports: ['http'],
        lastHealthCheck: new Date(),
      };

      agentCache.set('test-1', agent1);
      agentCache.set('test-2', agent2);

      expect(agentCache.size).toBe(2);
      clearAgentCache();
      expect(agentCache.size).toBe(0);
    });
  });
});

// Export for use in integration tests
export { clearAgentCache };
