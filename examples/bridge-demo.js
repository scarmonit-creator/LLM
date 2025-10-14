#!/usr/bin/env node
import { createAIBridgeServer } from '../src/ai-bridge.js';
import WebSocket from 'ws';
import { 
  safeFetch, 
  withRetries, 
  createCircuitBreaker, 
  logger, 
  installProcessGuards,
  cleanup,
  trackTimeout
} from './bridge-demo-production-enhancements.js';

/**
 * Production-ready demo script showing Claude Bridge with enhanced reliability
 * Features: error handling, retries, resource cleanup, performance monitoring
 */

// Initialize production features
const log = logger(process.env.LOG_LEVEL || 'info');
installProcessGuards();

// Circuit breaker for server operations
const serverCircuit = createCircuitBreaker(async (config) => {
  return await createAIBridgeServer(config);
}, 3, 5000);

// Circuit breaker for WebSocket connections
const wsCircuit = createCircuitBreaker(async (url) => {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    const timeout = trackTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);
    ws.on('open', () => {
      clearTimeout(timeout);
      resolve();
    });
    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
  return ws;
}, 3, 5000);

async function demo() {
  log.info('🌉 Starting AI Bridge Demo - Production-Ready Multi-LLM Communication\n');

  let server;
  const clients = [];

  try {
    // Start the bridge server with circuit breaker
    log.info('🚀 Starting bridge server...');
    server = await withRetries(() => serverCircuit.exec({
      wsPort: 0, // random port
      httpPort: 0,
    }), 3, 1000)();

    log.info(`✓ Bridge server running on:`);
    log.info(`  WebSocket: ws://localhost:${server.ports.ws}`);
    log.info(`  HTTP API:  http://localhost:${server.ports.http}\n`);

    // Create clients for different LLMs with enhanced error handling
    const clientIds = ['claude-main', 'gemini-1', 'ollama-local', 'perplexity-1'];
    
    for (const id of clientIds) {
      try {
        log.debug(`Connecting client: ${id}`);
        
        const ws = await withRetries(() => wsCircuit.exec(`ws://localhost:${server.ports.ws}`), 3, 500)();

        // Enhanced message handling with error boundaries
        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'registered') {
              log.info(`✓ ${id} connected as ${msg.client.role}`);
            } else if (msg.type === 'envelope') {
              const text = msg.envelope.payload?.text || JSON.stringify(msg.envelope.payload);
              log.info(`📨 ${id} received from ${msg.envelope.from}: "${text}"`);
            }
          } catch (error) {
            log.error(`Message parsing error for ${id}:`, error.message);
          }
        });

        ws.on('error', (error) => {
          log.error(`WebSocket error for ${id}:`, error.message);
        });

        ws.on('close', (code, reason) => {
          log.warn(`${id} disconnected:`, { code, reason: reason?.toString() });
        });

        // Register with retry logic
        await withRetries(() => {
          return new Promise((resolve, reject) => {
            const timeout = trackTimeout(() => reject(new Error('Registration timeout')), 5000);
            
            const onRegistered = (data) => {
              try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'registered') {
                  clearTimeout(timeout);
                  ws.off('message', onRegistered);
                  resolve();
                }
              } catch (e) {
                // Continue listening
              }
            };
            
            ws.on('message', onRegistered);
            ws.send(JSON.stringify({ type: 'register', clientId: id }));
          });
        }, 3, 500)();

        clients.push({ id, ws });
        log.debug(`${id} successfully connected and registered`);

        // Wait between connections to prevent overwhelming
        await new Promise(resolve => trackTimeout(resolve, 300));

      } catch (error) {
        log.error(`Failed to connect ${id}:`, error.message);
        // Continue with other clients
      }
    }

    if (clients.length === 0) {
      throw new Error('No clients successfully connected');
    }

    log.info('\n--- Broadcasting Messages ---\n');

    // Enhanced message broadcasting with error handling
    const sendMessage = async (clientIndex, message, delay = 500) => {
      await new Promise(resolve => trackTimeout(resolve, delay));
      try {
        if (clients[clientIndex] && clients[clientIndex].ws.readyState === WebSocket.OPEN) {
          clients[clientIndex].ws.send(JSON.stringify({
            type: 'envelope',
            envelope: message
          }));
          log.debug(`Message sent by ${clients[clientIndex].id}`);
        } else {
          log.warn(`Client ${clientIndex} not available for sending`);
        }
      } catch (error) {
        log.error(`Failed to send message from client ${clientIndex}:`, error.message);
      }
    };

    // Claude broadcasts with error handling
    await sendMessage(0, {
      intent: 'agent.message',
      payload: { text: 'Claude here: Starting code analysis on auth module.' }
    });

    // Gemini sends direct message to Ollama
    await sendMessage(1, {
      intent: 'agent.message', 
      to: 'ollama-local',
      payload: { text: 'Gemini to Ollama: Can you validate the code patterns locally?' }
    });

    // Ollama responds
    await sendMessage(2, {
      intent: 'agent.message',
      payload: { text: 'Ollama: Pattern validation complete. Factory method detected.' }
    });

    // Perplexity adds research
    await sendMessage(3, {
      intent: 'agent.message', 
      payload: { text: 'Perplexity: Found 3 best practices for this pattern in recent literature.' }
    });

    // Check HTTP API with enhanced error handling
    await new Promise(resolve => trackTimeout(resolve, 500));
    log.info('\n--- HTTP API Status ---\n');

    try {
      // Health check with circuit breaker
      const healthCheck = createCircuitBreaker(async (url) => {
        const response = await safeFetch(url, {}, 5000);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      });

      const health = await healthCheck.exec(`http://localhost:${server.ports.http}/health`);
      log.info(`✓ Health: ${health.status}, ${health.connectedClients} clients connected`);

      const agentList = await healthCheck.exec(`http://localhost:${server.ports.http}/agents`);
      log.info(`✓ Connected agents: ${agentList.agents.map((a) => a.id).join(', ')}`);

      const history = await healthCheck.exec(`http://localhost:${server.ports.http}/history?limit=5`);
      log.info(`✓ Message history (last ${history.history.length}):`);
      history.history.forEach((env) => {
        const text = env.payload?.text || JSON.stringify(env.payload).substring(0, 40);
        log.info(`  - [${env.timestamp}] ${env.from}: "${text}..."`);
      });

    } catch (error) {
      log.error('HTTP API check failed:', error.message);
    }

    // Graceful completion
    await new Promise(resolve => trackTimeout(resolve, 1000));
    log.info('\n--- Shutting Down ---\n');

  } catch (error) {
    log.error('Demo failed:', error.message);
    throw error;
  } finally {
    // Enhanced cleanup
    try {
      log.info('🧹 Cleaning up resources...');
      
      // Close all client connections
      clients.forEach((client) => {
        try {
          if (client.ws && client.ws.readyState === WebSocket.OPEN) {
            client.ws.close();
            log.debug(`Closed connection for ${client.id}`);
          }
        } catch (error) {
          log.warn(`Error closing ${client.id}:`, error.message);
        }
      });
      
      // Close server
      if (server) {
        await server.close();
        log.info('✓ Server closed');
      }
      
      // Clean up all tracked resources
      cleanup();
      
      log.info('✓ Demo complete! Bridge system working with enhanced reliability.\n');
    } catch (error) {
      log.error('Cleanup error:', error.message);
    }
  }
}

// Enhanced error handling for the main execution
async function main() {
  try {
    await withRetries(demo, 2, 2000)();
    process.exit(0);
  } catch (error) {
    log.error('Critical demo failure:', error.message);
    cleanup();
    process.exit(1);
  }
}

main();
