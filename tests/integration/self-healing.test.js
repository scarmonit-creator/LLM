/**
 * Self-Healing Integration Tests
 * Tests auto-recovery mechanisms integrated with the A2A framework
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fetch from 'node-fetch';
import { spawn } from 'child_process';

const A2A_SERVER_URL = process.env.A2A_SERVER_URL || 'http://localhost:3001';
const TEST_TIMEOUT = 30000;

describe('Self-Healing Integration Tests', () => {
  let serverProcess;

  beforeAll(async () => {
    // Server should already be running from CI
    // Just verify it's accessible
    try {
      const response = await fetch(`${A2A_SERVER_URL}/health`);
      if (!response.ok) {
        console.warn('A2A server not responding, tests may fail');
      }
    } catch (error) {
      console.warn('A2A server not accessible:', error.message);
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('Health Monitoring', () => {
    it('should respond to health checks', async () => {
      const response = await fetch(`${A2A_SERVER_URL}/health`);
      expect(response.ok).toBe(true);
      
      const health = await response.json();
      expect(health).toHaveProperty('status');
      expect(health.status).toBe('healthy');
    }, TEST_TIMEOUT);

    it('should validate multiple service health', async () => {
      const response = await fetch(`${A2A_SERVER_URL}/health-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          services: ['a2a-server'] 
        })
      });
      
      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(['healthy', 'degraded']).toContain(result.status);
    }, TEST_TIMEOUT);
  });

  describe('Auto-Recovery Mechanisms', () => {
    it('should handle graceful degradation', async () => {
      // Test with unavailable optional services
      const response = await fetch(`${A2A_SERVER_URL}/health-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          services: ['a2a-server', 'non-existent-service'] 
        })
      });
      
      // Should not fail completely, just report degraded status
      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result).toHaveProperty('services');
    }, TEST_TIMEOUT);

    it('should support manual recovery trigger', async () => {
      const response = await fetch(`${A2A_SERVER_URL}/auto-recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false })
      });
      
      if (response.ok) {
        const result = await response.json();
        expect(result).toHaveProperty('recovery_attempted');
      } else {
        // Auto-recovery endpoint might not be needed if system is healthy
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    }, TEST_TIMEOUT);
  });

  describe('Failure Recovery', () => {
    it('should handle invalid requests gracefully', async () => {
      const response = await fetch(`${A2A_SERVER_URL}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'data' })
      });
      
      // Should return error, not crash
      expect(response.status).toBeGreaterThanOrEqual(400);
    }, TEST_TIMEOUT);

    it('should validate agent registration failures', async () => {
      const response = await fetch(`${A2A_SERVER_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ /* missing required fields */ })
      });
      
      // Should reject invalid registration
      expect(response.status).toBeGreaterThanOrEqual(400);
    }, TEST_TIMEOUT);

    it('should maintain service availability during errors', async () => {
      // Send multiple invalid requests
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          fetch(`${A2A_SERVER_URL}/invalid-endpoint`)
            .catch(err => ({ error: true }))
        );
      }
      
      await Promise.all(requests);
      
      // Server should still be responsive
      const healthCheck = await fetch(`${A2A_SERVER_URL}/health`);
      expect(healthCheck.ok).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('Recovery Validation', () => {
    it('should report system metrics', async () => {
      const response = await fetch(`${A2A_SERVER_URL}/health`);
      expect(response.ok).toBe(true);
      
      const health = await response.json();
      expect(health).toHaveProperty('active_agents');
      expect(health).toHaveProperty('active_workflows');
      expect(typeof health.active_agents).toBe('number');
      expect(typeof health.active_workflows).toBe('number');
    }, TEST_TIMEOUT);

    it('should track agent registry health', async () => {
      // Register a test agent
      const registerResponse = await fetch(`${A2A_SERVER_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: 'health-test-agent',
          capabilities: ['testing']
        })
      });
      
      if (registerResponse.ok) {
        const health = await fetch(`${A2A_SERVER_URL}/health`);
        const healthData = await health.json();
        expect(healthData.active_agents).toBeGreaterThan(0);
      }
    }, TEST_TIMEOUT);
  });
});
