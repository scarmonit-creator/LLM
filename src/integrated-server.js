#!/usr/bin/env node

// Integrated Production Server for LLM Framework
// Combines AI Bridge + MCP Server + Performance Dashboard + Security Hardening

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import compression from 'compression';
import { config } from 'dotenv';
import { PerformanceDashboard } from './monitoring/performance-dashboard.js';
import { SecurityHardening } from './security/security-hardening.js';
import { LLMMCPServer } from './mcp-server/server.js';

config();

// Server configuration
const CONFIG = {
  HTTP_PORT: parseInt(process.env.PORT || '8080'),
  DASHBOARD_PORT: parseInt(process.env.DASHBOARD_PORT || '8081'),
  MCP_PORT: parseInt(process.env.MCP_PORT || '3001'),
  WS_PORT: parseInt(process.env.WS_PORT || '8082'),
  NODE_ENV: process.env.NODE_ENV || 'development'
};

class IntegratedLLMServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.wss = null;
    this.dashboard = null;
    this.security = null;
    this.mcpServer = null;
    this.clients = new Map();
    this.messageHistory = [];
    this.performance = {
      startTime: Date.now(),
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0
    };

    this.setupComponents();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupGracefulShutdown();
  }

  setupComponents() {
    // Initialize performance dashboard
    this.dashboard = new PerformanceDashboard(CONFIG.DASHBOARD_PORT);
    
    // Initialize security hardening
    this.security = new SecurityHardening({
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: process.env.NODE_ENV === 'production' ? 100 : 1000,
        skipSuccessfulRequests: false,
        skipFailedRequests: false
      },
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
        credentials: true
      }
    });

    // Initialize MCP server
    this.mcpServer = new LLMMCPServer({
      port: CONFIG.MCP_PORT,
      enableHTTP: true,
      enableStdio: process.env.MCP_ENABLE_STDIO !== 'false',
      enableAuth: process.env.NODE_ENV === 'production',
      apiKey: process.env.MCP_API_KEY,
      rateLimit: {
        windowMs: 60000,
        max: 50
      },
      tools: {
        claude: true,
        jules: true,
        ollama: true,
        rag: true,
        browserHistory: true,
        knowledgeGraph: true,
        aiBridge: true
      }
    });
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(...this.security.getSecurityMiddleware());
    
    // Performance monitoring middleware
    this.app.use(this.dashboard.getExpressMiddleware());
    
    // Basic middleware
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const memUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.1.0',
        uptime: Math.round(uptime),
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(memUsage.heapTotal / 1024 / 1024)
        },
        performance: {
          requests: this.performance.requestCount,
          errors: this.performance.errorCount,
          averageResponseTime: this.performance.averageResponseTime
        },
        services: {
          aibridge: { status: 'operational', clients: this.clients.size },
          dashboard: { status: 'operational', port: CONFIG.DASHBOARD_PORT },
          mcp: { status: 'operational', port: CONFIG.MCP_PORT },
          websocket: { status: 'operational', port: CONFIG.WS_PORT }
        }
      });
    });

    // Detailed system status
    this.app.get('/api/status', (req, res) => {
      res.json({
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          cpus: require('os').cpus().length,
          totalMemory: Math.round(require('os').totalmem() / 1024 / 1024),
          freeMemory: Math.round(require('os').freemem() / 1024 / 1024),
          loadAverage: require('os').loadavg()
        },
        application: {
          uptime: process.uptime(),
          pid: process.pid,
          memoryUsage: process.memoryUsage(),
          activeHandles: process._getActiveHandles().length,
          activeRequests: process._getActiveRequests().length
        },
        websocket: {
          totalClients: this.clients.size,
          messageHistory: this.messageHistory.length
        },
        security: this.security.getSecurityStatus()
      });
    });

    // AI Bridge WebSocket proxy endpoint
    this.app.post('/api/bridge/message', (req, res) => {
      try {
        const { message, metadata } = req.body;
        
        if (!message) {
          return res.status(400).json({ error: 'Message is required' });
        }

        // Broadcast to all connected WebSocket clients
        const messageData = {
          id: Date.now().toString(),
          message,
          metadata: {
            timestamp: Date.now(),
            source: 'http-api',
            ...metadata
          }
        };

        this.broadcastMessage(messageData);
        this.messageHistory.push(messageData);
        
        // Keep history reasonable size
        if (this.messageHistory.length > 1000) {
          this.messageHistory.shift();
        }

        res.json({ success: true, messageId: messageData.id });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get message history
    this.app.get('/api/bridge/history', (req, res) => {
      const limit = parseInt(req.query.limit as string) || 100;
      res.json({
        messages: this.messageHistory.slice(-limit),
        total: this.messageHistory.length
      });
    });

    // Prometheus metrics
    this.app.get('/metrics', (req, res) => {
      const metrics = this.generatePrometheusMetrics();
      res.set('Content-Type', 'text/plain');
      res.send(metrics);
    });
  }

  setupWebSocket() {
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/ws',
      perMessageDeflate: true
    });

    this.wss.on('connection', (ws, req) => {
      const clientId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      const clientIP = req.socket.remoteAddress;
      
      console.log(`🔗 Client connected: ${clientId} (${clientIP})`);
      
      this.clients.set(clientId, {
        ws,
        ip: clientIP,
        connectedAt: Date.now(),
        messageCount: 0
      });

      // Send connection confirmation
      ws.send(JSON.stringify({
        type: 'connection',
        clientId,
        timestamp: Date.now(),
        message: 'Connected to LLM AI Bridge'
      }));

      // Handle messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Update client stats
          const client = this.clients.get(clientId);
          if (client) {
            client.messageCount++;
          }
          
          // Process and broadcast message
          this.handleWebSocketMessage(clientId, message);
        } catch (error) {
          console.error('WebSocket message error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
            timestamp: Date.now()
          }));
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        console.log(`🔌 Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for ${clientId}:`, error);
        this.clients.delete(clientId);
      });
    });
  }

  handleWebSocketMessage(clientId, message) {
    // Add metadata and broadcast
    const enrichedMessage = {
      ...message,
      clientId,
      timestamp: Date.now(),
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5)
    };

    this.broadcastMessage(enrichedMessage);
    this.messageHistory.push(enrichedMessage);
    
    // Maintain history size
    if (this.messageHistory.length > 1000) {
      this.messageHistory.shift();
    }
  }

  broadcastMessage(message) {
    const messageStr = JSON.stringify(message);
    
    for (const [clientId, client] of this.clients.entries()) {
      try {
        if (client.ws.readyState === 1) { // OPEN
          client.ws.send(messageStr);
        }
      } catch (error) {
        console.error(`Broadcast error to ${clientId}:`, error);
        this.clients.delete(clientId);
      }
    }
  }

  generatePrometheusMetrics() {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    return `
# HELP llm_server_uptime_seconds Server uptime in seconds
# TYPE llm_server_uptime_seconds counter
llm_server_uptime_seconds ${uptime}

# HELP llm_server_memory_usage_bytes Memory usage in bytes
# TYPE llm_server_memory_usage_bytes gauge
llm_server_memory_usage_bytes{type="heap_used"} ${memUsage.heapUsed}
llm_server_memory_usage_bytes{type="heap_total"} ${memUsage.heapTotal}
llm_server_memory_usage_bytes{type="external"} ${memUsage.external}
llm_server_memory_usage_bytes{type="rss"} ${memUsage.rss}

# HELP llm_websocket_clients_total Number of connected WebSocket clients
# TYPE llm_websocket_clients_total gauge
llm_websocket_clients_total ${this.clients.size}

# HELP llm_messages_total Total messages processed
# TYPE llm_messages_total counter
llm_messages_total ${this.messageHistory.length}

# HELP llm_http_requests_total Total HTTP requests
# TYPE llm_http_requests_total counter
llm_http_requests_total ${this.performance.requestCount}

# HELP llm_http_errors_total Total HTTP errors
# TYPE llm_http_errors_total counter
llm_http_errors_total ${this.performance.errorCount}
    `.trim();
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`🔄 Received ${signal}, shutting down gracefully...`);
      
      // Stop accepting new connections
      this.server.close(() => {
        console.log('✅ HTTP server closed');
      });
      
      // Close WebSocket connections
      if (this.wss) {
        for (const [clientId, client] of this.clients.entries()) {
          client.ws.terminate();
        }
        this.wss.close();
        console.log('✅ WebSocket server closed');
      }
      
      // Shutdown other components
      if (this.dashboard) {
        this.dashboard.stop();
        console.log('✅ Performance dashboard stopped');
      }
      
      if (this.mcpServer) {
        await this.mcpServer.shutdown();
        console.log('✅ MCP server stopped');
      }
      
      console.log('🎯 Graceful shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', (error) => {
      console.error('🚨 Uncaught exception:', error);
      shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason, promise) => {
      console.error('🚨 Unhandled rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }

  async start() {
    try {
      console.log('🚀 Starting Integrated LLM Server...');
      console.log(`📊 Environment: ${CONFIG.NODE_ENV}`);
      console.log(`🎯 Version: 2.1.0`);
      
      // Start performance dashboard
      this.dashboard.start();
      console.log(`📊 Performance Dashboard: http://localhost:${CONFIG.DASHBOARD_PORT}`);
      
      // Start MCP server
      await this.mcpServer.startHTTP();
      await this.mcpServer.startStdio();
      console.log(`🔧 MCP Server: http://localhost:${CONFIG.MCP_PORT}`);
      
      // Start security cleanup
      this.security.startPeriodicCleanup();
      console.log('🛡️ Security hardening active');
      
      // Start main HTTP server
      this.server.listen(CONFIG.HTTP_PORT, () => {
        console.log(`🌐 HTTP Server: http://localhost:${CONFIG.HTTP_PORT}`);
        console.log(`🔗 WebSocket: ws://localhost:${CONFIG.HTTP_PORT}/ws`);
        console.log('\n🎉 All services operational!');
        console.log('\n📋 Available endpoints:');
        console.log(`   • Health: http://localhost:${CONFIG.HTTP_PORT}/health`);
        console.log(`   • Status: http://localhost:${CONFIG.HTTP_PORT}/api/status`);
        console.log(`   • Metrics: http://localhost:${CONFIG.HTTP_PORT}/metrics`);
        console.log(`   • Dashboard: http://localhost:${CONFIG.DASHBOARD_PORT}`);
        console.log(`   • MCP API: http://localhost:${CONFIG.MCP_PORT}/health`);
      });
    } catch (error) {
      console.error('🚨 Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start the integrated server
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new IntegratedLLMServer();
  server.start().catch(console.error);
}

export { IntegratedLLMServer };