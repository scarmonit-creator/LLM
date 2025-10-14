/**
 * Agent-to-Agent Self-Test Framework
 * Comprehensive integration test for A2A protocol, AI workflow orchestration,
 * and self-healing automation capabilities
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { spawn } from 'child_process';
import WebSocket from 'ws';
import fetch from 'node-fetch';
import { ClaudeClient } from '../../src/claude-client.js';
import { OllamaDemo } from '../../src/ollama-demo.js';

const A2A_PORT = process.env.A2A_PORT || 3001;
const BRIDGE_WS_PORT = process.env.BRIDGE_WS_PORT || 8080;
const TEST_TIMEOUT = 60000;

let a2aServer;
let bridgeServer;
let claudeClient;
let ollamaClient;

describe('Agent-to-Agent Self-Test Framework', () => {
  beforeAll(async () => {
    // Initialize Claude client
    if (process.env.ANTHROPIC_API_KEY) {
      claudeClient = new ClaudeClient();
    }
    
    // Initialize Ollama client
    ollamaClient = new OllamaDemo();
    
    // Start A2A server
    a2aServer = spawn('node', ['src/a2a-agent-server.js'], {
      env: { ...process.env, A2A_PORT },
      stdio: 'pipe'
    });
    
    // Start AI Bridge
    bridgeServer = spawn('node', ['src/ai-bridge.js'], {
      env: { ...process.env, BRIDGE_WS_PORT },
      stdio: 'pipe'
    });
    
    // Wait for servers to start
    await new Promise(resolve => setTimeout(resolve, 5000));
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (a2aServer) a2aServer.kill();
    if (bridgeServer) bridgeServer.kill();
  });

  describe('A2A Protocol Communication', () => {
    it('should establish agent-to-agent handshake', async () => {
      const response = await fetch(`http://localhost:${A2A_PORT}/health`);
      expect(response.status).toBe(200);
      
      const health = await response.json();
      expect(health.status).toBe('healthy');
      expect(health.protocol).toBe('MCP');
    }, TEST_TIMEOUT);

    it('should handle agent message routing', async () => {
      const message = {
        type: 'query',
        from: 'test-agent-1',
        to: 'test-agent-2',
        payload: { question: 'What is 2+2?' }
      };
      
      const response = await fetch(`http://localhost:${A2A_PORT}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.delivered).toBe(true);
    }, TEST_TIMEOUT);

    it('should perform multi-agent collaboration', async () => {
      const collaboration = {
        type: 'collaborative-task',
        agents: ['claude-agent', 'ollama-agent'],
        task: 'Analyze and summarize test data',
        data: { test: 'sample data for collaboration' }
      };
      
      const response = await fetch(`http://localhost:${A2A_PORT}/collaborate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collaboration)
      });
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.collaboration_id).toBeDefined();
      expect(result.participating_agents).toHaveLength(2);
    }, TEST_TIMEOUT);
  });

  describe('AI Workflow Orchestration', () => {
    it('should orchestrate multi-LLM workflow', async () => {
      const workflow = {
        id: 'test-workflow-1',
        steps: [
          { provider: 'ollama', action: 'analyze', model: 'llama2' },
          { provider: 'claude', action: 'refine' },
          { provider: 'ollama', action: 'validate' }
        ],
        input: 'Test input for workflow orchestration'
      };
      
      const response = await fetch(`http://localhost:${A2A_PORT}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflow)
      });
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.workflow_id).toBe('test-workflow-1');
      expect(result.status).toBe('initiated');
    }, TEST_TIMEOUT);

    it('should handle workflow failure and retry', async () => {
      const failingWorkflow = {
        id: 'test-workflow-fail',
        steps: [
          { provider: 'invalid-provider', action: 'test' }
        ],
        input: 'Test failure handling',
        retry_policy: { max_retries: 3, backoff: 'exponential' }
      };
      
      const response = await fetch(`http://localhost:${A2A_PORT}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(failingWorkflow)
      });
      
      // Should handle failure gracefully
      const result = await response.json();
      expect(result.status).toMatch(/failed|retrying/);
      expect(result.retry_count).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('WebSocket AI Bridge Integration', () => {
    it('should connect to AI Bridge via WebSocket', (done) => {
      const ws = new WebSocket(`ws://localhost:${BRIDGE_WS_PORT}`);
      
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'ping', agent: 'test-agent' }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        expect(message.type).toBe('pong');
        ws.close();
        done();
      });
      
      ws.on('error', (error) => {
        done(error);
      });
    }, TEST_TIMEOUT);

    it('should broadcast to multiple connected agents', (done) => {
      const agents = [];
      let messagesReceived = 0;
      
      for (let i = 0; i < 3; i++) {
        const ws = new WebSocket(`ws://localhost:${BRIDGE_WS_PORT}`);
        agents.push(ws);
        
        ws.on('message', (data) => {
          const message = JSON.parse(data);
          if (message.type === 'broadcast') {
            messagesReceived++;
            if (messagesReceived === 3) {
              agents.forEach(a => a.close());
              done();
            }
          }
        });
      }
      
      setTimeout(() => {
        agents[0].send(JSON.stringify({ type: 'broadcast', message: 'Test broadcast' }));
      }, 1000);
    }, TEST_TIMEOUT);
  });

  describe('Self-Healing Automation', () => {
    it('should detect and recover from service failures', async () => {
      const healthCheck = {
        services: ['a2a-server', 'ai-bridge', 'ollama'],
        recovery_enabled: true
      };
      
      const response = await fetch(`http://localhost:${A2A_PORT}/health-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(healthCheck)
      });
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.services).toBeDefined();
      expect(result.all_healthy).toBeDefined();
    }, TEST_TIMEOUT);

    it('should perform automated dependency recovery', async () => {
      const recovery = {
        component: 'ollama',
        issue: 'connection_timeout',
        auto_fix: true
      };
      
      const response = await fetch(`http://localhost:${A2A_PORT}/auto-recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recovery)
      });
      
      const result = await response.json();
      expect(result.recovery_attempted).toBe(true);
      expect(result.recovery_strategy).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('End-to-End AI Agent Flow', () => {
    it('should execute complete A2A -> Bridge -> LLM flow', async () => {
      const e2eRequest = {
        agent_id: 'test-orchestrator',
        workflow: {
          name: 'e2e-test-flow',
          steps: [
            { stage: 'a2a-routing', action: 'route_to_specialist' },
            { stage: 'bridge-coordination', action: 'coordinate_llms' },
            { stage: 'llm-execution', action: 'execute_query' },
            { stage: 'response-aggregation', action: 'aggregate_results' }
          ]
        },
        query: 'Explain quantum computing in simple terms'
      };
      
      const response = await fetch(`http://localhost:${A2A_PORT}/e2e-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(e2eRequest)
      });
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.workflow_completed).toBe(true);
      expect(result.steps_executed).toBe(4);
      expect(result.final_response).toBeDefined();
    }, TEST_TIMEOUT * 2);
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent agent requests', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => ({
        id: `concurrent-${i}`,
        type: 'query',
        payload: { question: `Test question ${i}` }
      }));
      
      const promises = concurrentRequests.map(req =>
        fetch(`http://localhost:${A2A_PORT}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req)
        })
      );
      
      const responses = await Promise.all(promises);
      const successfulResponses = responses.filter(r => r.status === 200);
      
      expect(successfulResponses.length).toBeGreaterThanOrEqual(8);
    }, TEST_TIMEOUT);

    it('should maintain performance under load', async () => {
      const startTime = Date.now();
      const loadTest = Array.from({ length: 50 }, (_, i) => ({
        agent: `load-test-agent-${i}`,
        action: 'health-check'
      }));
      
      await Promise.all(loadTest.map(req =>
        fetch(`http://localhost:${A2A_PORT}/health`)
      ));
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // Should complete in under 10s
    }, TEST_TIMEOUT);
  });
});

export { A2A_PORT, BRIDGE_WS_PORT, TEST_TIMEOUT };
