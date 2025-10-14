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
  trackTimeout,
  clearTrackedTimeout
} from './bridge-demo-production-enhancements.js';

/**
 * OPTIMIZED Production-ready demo script showing Claude Bridge with enhanced reliability
 * Features: error handling, retries, resource cleanup, performance monitoring, graceful shutdown
 * 
 * OPTIMIZATIONS APPLIED:
 * ✅ Resource tracking and cleanup (prevents memory leaks)
 * ✅ Circuit breakers for fault tolerance (prevents cascading failures)
 * ✅ Retry logic with exponential backoff (handles transient failures)
 * ✅ Safe fetch operations with timeouts (prevents hanging requests)
 * ✅ Structured logging with levels (configurable via LOG_LEVEL)
 * ✅ Graceful shutdown handling (SIGINT, SIGTERM, SIGHUP)
 * ✅ Enhanced error boundaries (isolates failures)
 * ✅ Concurrent operations where appropriate (improved performance)
 * ✅ WebSocket state management (prevents invalid operations)
 * ✅ Message queuing for offline clients (reliability)
 */

// Initialize production features
const log = logger(process.env.LOG_LEVEL || 'info');
installProcessGuards();

// Enhanced WebSocket client class with state management
class RobustWebSocketClient {
  constructor(url, clientId) {
    this.url = url;
    this.clientId = clientId;
    this.ws = null;
    this.connected = false;
    this.registered = false;
    this.messageQueue = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
  }

  async connect(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        
        const timeout = trackTimeout(() => {
          this.ws?.terminate();
          reject(new Error(`Connection timeout for ${this.clientId} after ${timeoutMs}ms`));
        }, timeoutMs);

        this.ws.on('open', async () => {
          clearTrackedTimeout(timeout);
          this.connected = true;
          this.reconnectAttempts = 0;
          log.info(`✓ ${this.clientId} WebSocket connected successfully`);
          
          try {
            // Register client with retry
            await this.register();
            
            // Process any queued messages
            this.processMessageQueue();
            
            resolve(this);
          } catch (error) {
            reject(error);
          }
        });

        this.ws.on('error', (error) => {
          clearTrackedTimeout(timeout);
          log.error(`WebSocket error for ${this.clientId}:`, error.message);
          this.connected = false;
          reject(error);
        });

        this.ws.on('close', (code, reason) => {
          this.connected = false;
          this.registered = false;
          log.warn(`${this.clientId} disconnected (code: ${code}, reason: ${reason?.toString() || 'unknown'})`);
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  async register() {
    return new Promise((resolve, reject) => {
      const timeout = trackTimeout(() => {
        reject(new Error(`Registration timeout for ${this.clientId}`));
      }, 5000);
      
      const onMessage = (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'registered') {
            clearTrackedTimeout(timeout);
            this.ws.off('message', onMessage);
            this.registered = true;
            log.info(`✓ ${this.clientId} registered as ${msg.client?.role || 'unknown'}`);
            resolve();
          }
        } catch (error) {
          log.error(`Registration message parse error for ${this.clientId}:`, error.message);
        }
      };
      
      this.ws.on('message', onMessage);
      this.send({ type: 'register', clientId: this.clientId });
    });
  }

  handleMessage(data) {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'envelope') {
        const text = msg.envelope.payload?.text || JSON.stringify(msg.envelope.payload);
        const from = msg.envelope.from || 'unknown';
        log.info(`📨 ${this.clientId} received from ${from}: "${text}"`);
      }
    } catch (error) {
      log.error(`Message parse error for ${this.clientId}:`, error.message);
    }
  }

  send(message) {
    try {
      if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
        log.debug(`Message sent by ${this.clientId}`);
      } else {
        // Queue message for later delivery
        this.messageQueue.push(message);
        log.warn(`${this.clientId} queued message (not connected)`);
      }
    } catch (error) {
      log.error(`Send error for ${this.clientId}:`, error.message);
    }
  }

  processMessageQueue() {
    while (this.messageQueue.length > 0 && this.connected && this.registered) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  close() {
    try {
      this.connected = false;
      this.registered = false;
      if (this.ws) {
        this.ws.close();
        log.debug(`${this.clientId} connection closed`);
      }
    } catch (error) {
      log.error(`Close error for ${this.clientId}:`, error.message);
    }
  }
}

// Enhanced demo orchestrator
class OptimizedDemoOrchestrator {
  constructor() {
    this.server = null;
    this.clients = new Map();
    this.serverCircuit = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 5000 });
    this.httpCircuit = createCircuitBreaker({ failureThreshold: 5, cooldownMs: 3000 });
  }

  async startServer() {
    log.info('🚀 Starting bridge server with fault tolerance...');
    
    try {
      this.server = await withRetries(() => 
        this.serverCircuit.exec(() => createAIBridgeServer({ wsPort: 0, httpPort: 0 })), 
        { 
          retries: 3, 
          baseDelayMs: 1000,
          onRetry: ({ attempt, err }) => log.warn(`Server start retry ${attempt}:`, err.message)
        }
      );

      log.info(`✓ Bridge server running on:`);
      log.info(`  WebSocket: ws://localhost:${this.server.ports.ws}`);
      log.info(`  HTTP API:  http://localhost:${this.server.ports.http}`);
      
      return this.server;
    } catch (error) {
      log.error('Failed to start server after retries:', error.message);
      throw error;
    }
  }

  async connectClients() {
    const clientIds = ['claude-main', 'gemini-1', 'ollama-local', 'perplexity-1'];
    log.info(`🔗 Connecting ${clientIds.length} clients concurrently...`);
    
    // Connect all clients in parallel for better performance
    const connectionPromises = clientIds.map(async (id) => {
      try {
        const client = new RobustWebSocketClient(`ws://localhost:${this.server.ports.ws}`, id);
        await client.connect();
        this.clients.set(id, client);
        return { id, success: true };
      } catch (error) {
        log.error(`Failed to connect ${id}:`, error.message);
        return { id, success: false, error };
      }
    });

    const results = await Promise.allSettled(connectionPromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    
    log.info(`✓ Connected ${successful}/${clientIds.length} clients successfully`);
    
    if (successful === 0) {
      throw new Error('No clients connected successfully');
    }
    
    return successful;
  }

  async broadcastMessages() {
    log.info('--- 📡 Broadcasting Messages with Enhanced Delivery ---');
    
    const messages = [
      {
        clientId: 'claude-main',
        delay: 0,
        envelope: {
          intent: 'agent.message',
          payload: { text: 'Claude here: Starting optimized code analysis on auth module.' },
        }
      },
      {
        clientId: 'gemini-1',
        delay: 500, 
        envelope: {
          intent: 'agent.message',
          to: 'ollama-local',
          payload: { text: 'Gemini to Ollama: Can you validate the enhanced code patterns locally?' },
        }
      },
      {
        clientId: 'ollama-local',
        delay: 1000,
        envelope: {
          intent: 'agent.message',
          payload: { text: 'Ollama: Enhanced pattern validation complete. Optimized factory method detected with resource cleanup.' },
        }
      },
      {
        clientId: 'perplexity-1',
        delay: 1500,
        envelope: {
          intent: 'agent.message', 
          payload: { text: 'Perplexity: Found 5 production-ready best practices for this enhanced pattern in recent literature.' },
        }
      }
    ];

    // Send messages with proper timing and error handling
    const sendPromises = messages.map(async (msgConfig) => {
      try {
        if (msgConfig.delay > 0) {
          await new Promise(resolve => trackTimeout(resolve, msgConfig.delay));
        }
        
        const client = this.clients.get(msgConfig.clientId);
        if (client && client.connected) {
          client.send({ type: 'envelope', envelope: msgConfig.envelope });
          log.debug(`✓ Message dispatched by ${msgConfig.clientId}`);
        } else {
          log.warn(`⚠️ Client ${msgConfig.clientId} not available for message delivery`);
        }
      } catch (error) {
        log.error(`Failed to send message from ${msgConfig.clientId}:`, error.message);
      }
    });

    await Promise.allSettled(sendPromises);
    log.info('✓ All messages dispatched');
  }

  async checkAPIHealth() {
    log.info('--- 🏥 HTTP API Health Check with Circuit Breaker ---');
    
    try {
      // Health endpoint
      const health = await this.httpCircuit.exec(async () => {
        const response = await safeFetch(`http://localhost:${this.server.ports.http}/health`, {}, 5000);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.json();
      });
      log.info(`✓ Health Status: ${health.status}, ${health.connectedClients} clients connected`);

      // Agents endpoint
      const agentList = await this.httpCircuit.exec(async () => {
        const response = await safeFetch(`http://localhost:${this.server.ports.http}/agents`, {}, 5000);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.json();
      });
      log.info(`✓ Active Agents: ${agentList.agents.map(a => a.id).join(', ')}`);

      // Message history
      const history = await this.httpCircuit.exec(async () => {
        const response = await safeFetch(`http://localhost:${this.server.ports.http}/history?limit=5`, {}, 5000);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.json();
      });
      
      log.info(`✓ Message History (last ${history.history.length} messages):`);
      history.history.forEach((env, index) => {
        const text = env.payload?.text || JSON.stringify(env.payload).substring(0, 50);
        const timestamp = new Date(env.timestamp).toLocaleTimeString();
        log.info(`  ${index + 1}. [${timestamp}] ${env.from}: "${text}..."`);
      });

    } catch (error) {
      log.error('API health check failed:', error.message);
      if (this.httpCircuit.state === 'OPEN') {
        log.warn('⚠️ HTTP Circuit breaker is OPEN - API temporarily unavailable');
      }
    }
  }

  async gracefulShutdown() {
    log.info('--- 🛑 Initiating Graceful Shutdown ---');
    
    try {
      // Close all client connections with timeout
      const closePromises = Array.from(this.clients.entries()).map(async ([id, client]) => {
        try {
          client.close();
          log.debug(`✓ Closed ${id}`);
        } catch (error) {
          log.warn(`Error closing ${id}:`, error.message);
        }
      });
      
      await Promise.allSettled(closePromises);
      this.clients.clear();
      log.info('✓ All client connections closed');
      
      // Close server
      if (this.server) {
        await this.server.close();
        log.info('✓ Bridge server stopped');
      }
      
      // Clean up all tracked resources (timeouts, intervals, listeners)
      cleanup();
      log.info('✓ All resources cleaned up');
      
    } catch (error) {
      log.error('Error during shutdown:', error.message);
      // Force cleanup anyway
      cleanup();
    }
  }
}

// Main optimized demo function
async function optimizedDemo() {
  const orchestrator = new OptimizedDemoOrchestrator();
  
  try {
    log.info('🌉 Starting OPTIMIZED AI Bridge Demo - Production-Ready Multi-LLM Communication\n');
    
    // Start server with enhanced error handling
    await orchestrator.startServer();
    
    // Connect all clients concurrently
    const connectedCount = await orchestrator.connectClients();
    
    // Wait for all registrations to stabilize
    log.info('⏳ Allowing registrations to stabilize...');
    await new Promise(resolve => trackTimeout(resolve, 1500));
    
    // Broadcast messages with coordinated timing
    await orchestrator.broadcastMessages();
    
    // Allow messages to propagate
    log.info('⏳ Allowing messages to propagate...');
    await new Promise(resolve => trackTimeout(resolve, 3000));
    
    // Comprehensive API health check
    await orchestrator.checkAPIHealth();
    
    // Brief pause before shutdown
    await new Promise(resolve => trackTimeout(resolve, 1000));
    
    log.info('\n✅ Demo execution completed successfully');
    
  } catch (error) {
    log.error('❌ Demo execution failed:', error.message);
    throw error;
  } finally {
    // Always perform graceful shutdown
    await orchestrator.gracefulShutdown();
  }
}

// Enhanced main execution with comprehensive error handling
async function main() {
  try {
    // Run demo with retries for transient failures
    await withRetries(optimizedDemo, { 
      retries: 2, 
      baseDelayMs: 2000,
      onRetry: ({ attempt, err }) => {
        log.warn(`Demo retry ${attempt} due to:`, err.message);
      }
    });
    
    log.info('🎉 OPTIMIZED Bridge demo completed successfully with enhanced reliability!\n');
    process.exit(0);
    
  } catch (error) {
    log.error('💥 Critical demo failure after retries:', error.message);
    log.error('Stack trace:', error.stack);
    
    // Emergency cleanup
    cleanup();
    process.exit(1);
  }
}

// Additional error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason);
  cleanup();
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  cleanup();
  process.exit(1);
});

// Start the optimized demo
main();