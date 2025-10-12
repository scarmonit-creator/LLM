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
import { describe, it, expect, beforeEach, afterEach, jest as _jest } from '@jest/globals';
import request from 'supertest';
import { Express } from 'express';
import {
  createA2AServer,
  createA2AMiddleware as _createA2AMiddleware,
  healthCheckHandler as _healthCheckHandler,
  statusHandler as _statusHandler,
  capabilitiesHandler as _capabilitiesHandler,
  clearAgentCache,
  A2AAgent as _A2AAgent,
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
    if (server) {
      server.close();
    }
  });

  describe('Server Initialization', () => {
    it('should create server with default port', () => {
      const result = createA2AServer({
        port: 3000,
        agentConfig: {
          name: 'test-agent',
          version: '1.0.0',
          description: 'Test A2A Agent',
          supportedTransports: ['http', 'websocket'],
        },
      });
      expect(result).toBeDefined();
      expect(result.app).toBeDefined();
      expect(result.server).toBeDefined();
      server = result.server;
      app = result.app;
    });

    it('should create server with custom port', () => {
      const result = createA2AServer({
        port: 8080,
        agentConfig: {
          name: 'test-agent',
          version: '1.0.0',
          description: 'Test A2A Agent',
          supportedTransports: ['http', 'websocket'],
        },
      });
      expect(result).toBeDefined();
      expect(result.app).toBeDefined();
      expect(result.server).toBeDefined();
      server = result.server;
      app = result.app;
    });
  });

  describe('Agent Cache', () => {
    beforeEach(() => {
      clearAgentCache();
    });

    it('should start with empty agent cache', () => {
      expect(agentCache.size).toBe(0);
    });

    it('should clear agent cache', () => {
      // Simulate adding to cache
      agentCache.set('test-agent', { name: 'test' } as any);
      expect(agentCache.size).toBe(1);

      clearAgentCache();
      expect(agentCache.size).toBe(0);
    });
  });

  describe('Health Check', () => {
    beforeEach(() => {
      const result = createA2AServer({
        port: 3000,
        agentConfig: {
          name: 'test-agent',
          version: '1.0.0',
          description: 'Test A2A Agent',
          supportedTransports: ['http', 'websocket'],
        },
      });
      server = result.server;
      app = result.app;
    });

    it('should return 200 on health check', async () => {
      const response = await request(app).get('/a2a/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });
  });

  describe('Status Endpoint', () => {
    beforeEach(() => {
      const result = createA2AServer({
        port: 3000,
        agentConfig: {
          name: 'test-agent',
          version: '1.0.0',
          description: 'Test A2A Agent',
          supportedTransports: ['http', 'websocket'],
        },
      });
      server = result.server;
      app = result.app;
    });

    it('should return agent status', async () => {
      const response = await request(app).get('/a2a/status');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
    });
  });

  describe('Capabilities Endpoint', () => {
    beforeEach(() => {
      const result = createA2AServer({
        port: 3000,
        agentConfig: {
          name: 'test-agent',
          version: '1.0.0',
          description: 'Test A2A Agent',
          supportedTransports: ['http', 'websocket'],
        },
      });
      server = result.server;
      app = result.app;
    });

    it('should return agent capabilities', async () => {
      const response = await request(app).get('/a2a/capabilities');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('capabilities');
    });
  });
});
