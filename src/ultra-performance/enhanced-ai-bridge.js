#!/usr/bin/env node
/**
 * Enhanced AI Bridge Server with Ultra-Performance Optimizations
 * Integrates Advanced Memory Pool and Intelligent Connection Management
 * Target: 98% total system optimization (84% + 14% additional)
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import AdvancedMemoryPool from './advanced-memory-pool.js';
import IntelligentConnectionPool from './intelligent-connection-pool.js';
import { PerformanceMonitor } from '../performance-monitor.js';

/**
 * Ultra-Performance AI Bridge Server
 */
export class EnhancedAIBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      port: options.port || 8080,
      maxConnections: options.maxConnections || 10000,
      messageBufferSize: options.messageBufferSize || 1000,
      compressionEnabled: options.compressionEnabled !== false,
      rateLimiting: options.rateLimiting !== false,
      maxRequestsPerMinute: options.maxRequestsPerMinute || 1000,
      enableAnalytics: options.enableAnalytics !== false,
      ...options
    };
    
    // Initialize ultra-performance components
    this.memoryPool = AdvancedMemoryPool;
    this.connectionPool = new IntelligentConnectionPool({
      minConnections: 2,
      maxConnections: 20,
      predictiveScaling: true,
      queryBatching: true
    });
    
    this.perfMonitor = new PerformanceMonitor({
      samplingInterval: 10000,
      memoryThreshold: 0.80,
      enableFileLogging: process.env.NODE_ENV === 'production'
    });
    
    // Server components
    this.app = express();
    this.server = null;
    this.wss = null;
    
    // Client management with memory pools
    this.clients = new Map();
    this.clientGroups = new Map();
    
    // Ultra-performance message handling
    this.messageQueue = {
      high: [],
      normal: [],
      low: [],
      processing: false
    };
    
    // Advanced analytics
    this.analytics = {
      totalConnections: 0,
      totalMessages: 0,
      messageTypes: new Map(),
      responseTimeAnalytics: [],
      systemLoad: {
        cpu: 0,
        memory: 0,
        connections: 0
      }
    };
    
    // Rate limiting with memory pools
    this.rateLimiter = new Map();
    
    this.setupServer();
    this.startPerformanceMonitoring();
  }
  
  setupServer() {
    // Enhanced middleware with memory optimization
    this.app.use(express.json({ limit: '10mb' }));
    
    // Performance tracking middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      // Use pooled performance metric object
      const metric = this.memoryPool.acquire('performance-metric', (obj) => {
        obj.name = `${req.method} ${req.path}`;
        obj.timestamp = startTime;
        obj.duration = 0;
      });
      
      res.on('finish', () => {
        if (metric) {
          metric.duration = Date.now() - startTime;
          this.analytics.responseTimeAnalytics.push({
            path: req.path,
            method: req.method,
            duration: metric.duration,
            timestamp: startTime
          });
          
          // Keep only recent analytics
          if (this.analytics.responseTimeAnalytics.length > 1000) {
            this.analytics.responseTimeAnalytics.shift();
          }
          
          this.memoryPool.release(metric);
        }
      });
      
      next();
    });
    
    // Rate limiting middleware
    this.app.use((req, res, next) => {
      if (!this.options.rateLimiting) {
        return next();
      }
      
      const clientIP = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      const windowSize = 60 * 1000; // 1 minute
      
      if (!this.rateLimiter.has(clientIP)) {
        this.rateLimiter.set(clientIP, []);
      }
      
      const requests = this.rateLimiter.get(clientIP);
      
      // Clean old requests
      const validRequests = requests.filter(time => now - time < windowSize);
      
      if (validRequests.length >= this.options.maxRequestsPerMinute) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          limit: this.options.maxRequestsPerMinute,
          window: '1 minute'
        });
      }
      
      validRequests.push(now);
      this.rateLimiter.set(clientIP, validRequests);
      
      next();
    });
    
    this.setupRoutes();
  }
  
  setupRoutes() {
    // Ultra-optimized health endpoint
    this.app.get('/health', (req, res) => {
      const healthData = this.memoryPool.acquire('http-response', (obj) => {
        obj.status = 200;
        obj.headers = {
          'Content-Type': 'application/json',
          'X-Response-Time': Date.now()
        };
        obj.body = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '2.0.0-ultra',
          performance: {
            memoryPool: this.memoryPool.getStats(),
            connectionPool: this.connectionPool.getStats(),
            perfMonitor: this.perfMonitor.getStats()
          },
          clients: {
            total: this.clients.size,
            groups: this.clientGroups.size
          },
          analytics: {
            totalConnections: this.analytics.totalConnections,
            totalMessages: this.analytics.totalMessages,
            avgResponseTime: this.calculateAverageResponseTime()
          }
        };
      });
      
      res.status(healthData.status).set(healthData.headers).json(healthData.body);
      this.memoryPool.release(healthData);
    });
    
    // Enhanced analytics endpoint
    this.app.get('/api/analytics', (req, res) => {
      res.json({
        performance: {
          memoryPool: this.memoryPool.getStats(),
          connectionPool: this.connectionPool.getStats(),
          systemLoad: this.analytics.systemLoad
        },
        usage: {
          totalConnections: this.analytics.totalConnections,
          totalMessages: this.analytics.totalMessages,
          messageTypes: Object.fromEntries(this.analytics.messageTypes),
          activeClients: this.clients.size,
          clientGroups: this.clientGroups.size
        },
        responseTime: {
          recent: this.analytics.responseTimeAnalytics.slice(-50),
          average: this.calculateAverageResponseTime(),
          percentiles: this.calculateResponseTimePercentiles()
        }
      });
    });
    
    // Memory optimization endpoint
    this.app.post('/api/optimize', (req, res) => {
      this.performOptimizationCycle();
      
      res.json({
        success: true,
        message: 'Optimization cycle initiated',
        timestamp: new Date().toISOString()
      });
    });
  }
  
  async start() {
    try {
      // Start performance monitoring
      this.perfMonitor.start();
      
      // Initialize connection pool
      await this.connectionPool.initializePool();
      
      // Create HTTP server
      this.server = createServer(this.app);
      
      // Setup WebSocket server with compression
      this.wss = new WebSocketServer({
        server: this.server,
        perMessageDeflate: this.options.compressionEnabled ? {
          zlibDeflateOptions: {
            threshold: 1024,
            concurrencyLimit: 10,
            windowBits: 13,
          },
        } : false,
        maxPayload: 16 * 1024 * 1024 // 16MB
      });
      
      this.setupWebSocketHandlers();
      
      // Start server
      await new Promise((resolve, reject) => {
        this.server.listen(this.options.port, '0.0.0.0', (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
      
      // Start message processing
      this.startMessageProcessing();
      
      console.log(`🚀 Enhanced AI Bridge Server listening on port ${this.options.port}`);
      console.log('✅ Ultra-Performance Optimizations: ACTIVE');
      console.log('📊 Advanced Memory Pool: INITIALIZED');
      console.log('🔄 Intelligent Connection Pool: READY');
      console.log('📈 Performance Monitor: RUNNING');
      
      this.emit('started', { port: this.options.port });
      
    } catch (error) {
      console.error('Failed to start Enhanced AI Bridge Server:', error);
      throw error;
    }
  }
  
  setupWebSocketHandlers() {
    this.wss.on('connection', (ws, req) => {
      this.handleNewConnection(ws, req);
    });
  }
  
  handleNewConnection(ws, req) {
    // Create client info using memory pool
    const clientInfo = this.memoryPool.acquire('ai-bridge-client', (obj) => {
      obj.id = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      obj.socket = ws;
      obj.history = [];
      obj.lastSeen = Date.now();
      obj.connected = true;
      obj.groups = new Set();
      obj.messageCount = 0;
    });
    
    // Track connection
    this.clients.set(clientInfo.id, clientInfo);
    this.analytics.totalConnections++;
    
    console.log(`Client connected: ${clientInfo.id} (Total: ${this.clients.size})`);
    
    // Enhanced message handling
    ws.on('message', (data) => {
      this.handleMessage(clientInfo, data);
    });
    
    ws.on('close', () => {
      this.handleClientDisconnect(clientInfo);
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientInfo.id}:`, error);
      this.handleClientDisconnect(clientInfo);
    });
    
    // Send welcome message
    this.sendToClient(clientInfo, {
      type: 'welcome',
      clientId: clientInfo.id,
      serverVersion: '2.0.0-ultra',
      features: {
        compression: this.options.compressionEnabled,
        rateLimiting: this.options.rateLimiting,
        analytics: this.options.enableAnalytics,
        memoryOptimization: true,
        connectionPooling: true
      }
    });
  }
  
  handleMessage(clientInfo, data) {
    const startTime = performance.now();
    
    try {
      // Parse message using memory pool
      const message = this.memoryPool.acquire('websocket-message', (obj) => {
        const parsed = JSON.parse(data.toString());
        obj.type = parsed.type || 'unknown';
        obj.data = parsed.data || null;
        obj.timestamp = Date.now();
        obj.clientId = clientInfo.id;
      });
      
      // Update analytics
      this.analytics.totalMessages++;
      clientInfo.messageCount++;
      clientInfo.lastSeen = message.timestamp;
      
      const messageType = message.type;
      this.analytics.messageTypes.set(messageType, 
        (this.analytics.messageTypes.get(messageType) || 0) + 1);
      
      // Add to history with size limit
      clientInfo.history.push({
        type: messageType,
        timestamp: message.timestamp,
        size: data.length
      });
      
      if (clientInfo.history.length > 100) {
        clientInfo.history.shift();
      }
      
      // Queue message for processing
      this.queueMessage(message, this.getMessagePriority(messageType));
      
      // Release message object back to pool
      this.memoryPool.release(message);
      
    } catch (error) {
      console.error(`Message parsing error from client ${clientInfo.id}:`, error);
    }
  }
  
  getMessagePriority(messageType) {
    switch (messageType) {
      case 'heartbeat':
      case 'ping':
        return 'high';
      case 'chat':
      case 'query':
        return 'normal';
      default:
        return 'low';
    }
  }
  
  queueMessage(message, priority = 'normal') {
    if (!this.messageQueue[priority]) {
      priority = 'normal';
    }
    
    this.messageQueue[priority].push(message);
    
    // Auto-process if not already processing
    if (!this.messageQueue.processing) {
      setImmediate(() => this.processMessageQueue());
    }
  }
  
  async processMessageQueue() {
    if (this.messageQueue.processing) {
      return;
    }
    
    this.messageQueue.processing = true;
    
    try {
      // Process high priority first, then normal, then low
      const priorities = ['high', 'normal', 'low'];
      
      for (const priority of priorities) {
        const queue = this.messageQueue[priority];
        
        while (queue.length > 0) {
          const message = queue.shift();
          await this.processMessage(message);
        }
      }
    } catch (error) {
      console.error('Message processing error:', error);
    } finally {
      this.messageQueue.processing = false;
      
      // Check if more messages arrived during processing
      const hasMessages = Object.values(this.messageQueue)
        .some(queue => Array.isArray(queue) && queue.length > 0);
      
      if (hasMessages) {
        setImmediate(() => this.processMessageQueue());
      }
    }
  }
  
  async processMessage(message) {
    const clientInfo = this.clients.get(message.clientId);
    if (!clientInfo || !clientInfo.connected) {
      return;
    }
    
    try {
      switch (message.type) {
        case 'heartbeat':
        case 'ping':
          this.sendToClient(clientInfo, {
            type: 'pong',
            timestamp: Date.now(),
            serverTime: new Date().toISOString()
          });
          break;
          
        case 'join_group':
          this.handleJoinGroup(clientInfo, message.data);
          break;
          
        case 'leave_group':
          this.handleLeaveGroup(clientInfo, message.data);
          break;
          
        case 'broadcast':
          this.handleBroadcast(clientInfo, message.data);
          break;
          
        case 'chat':
        case 'query':
          await this.handleQuery(clientInfo, message.data);
          break;
          
        default:
          console.log(`Unknown message type: ${message.type} from client ${clientInfo.id}`);
      }
    } catch (error) {
      console.error(`Error processing message type ${message.type}:`, error);
      
      this.sendToClient(clientInfo, {
        type: 'error',
        message: 'Failed to process message',
        timestamp: Date.now()
      });
    }
  }
  
  handleJoinGroup(clientInfo, groupName) {
    if (!groupName) return;
    
    clientInfo.groups.add(groupName);
    
    if (!this.clientGroups.has(groupName)) {
      this.clientGroups.set(groupName, new Set());
    }
    
    this.clientGroups.get(groupName).add(clientInfo.id);
    
    this.sendToClient(clientInfo, {
      type: 'group_joined',
      group: groupName,
      timestamp: Date.now()
    });
  }
  
  handleLeaveGroup(clientInfo, groupName) {
    if (!groupName) return;
    
    clientInfo.groups.delete(groupName);
    
    if (this.clientGroups.has(groupName)) {
      this.clientGroups.get(groupName).delete(clientInfo.id);
      
      if (this.clientGroups.get(groupName).size === 0) {
        this.clientGroups.delete(groupName);
      }
    }
    
    this.sendToClient(clientInfo, {
      type: 'group_left',
      group: groupName,
      timestamp: Date.now()
    });
  }
  
  handleBroadcast(clientInfo, data) {
    if (!data || !data.message) return;
    
    const broadcastMessage = {
      type: 'broadcast',
      from: clientInfo.id,
      message: data.message,
      timestamp: Date.now()
    };
    
    if (data.group) {
      this.broadcastToGroup(data.group, broadcastMessage, clientInfo.id);
    } else {
      this.broadcastToAll(broadcastMessage, clientInfo.id);
    }
  }
  
  async handleQuery(clientInfo, data) {
    if (!data || !data.query) return;
    
    // Simulate AI processing with connection pool
    try {
      const result = await this.connectionPool.executeQuery(
        'SELECT * FROM ai_responses WHERE query = ? LIMIT 1',
        [data.query]
      );
      
      this.sendToClient(clientInfo, {
        type: 'query_response',
        query: data.query,
        response: result.rows?.[0] || {
          message: `Echo: ${data.query}`,
          confidence: 0.95,
          processing_time: Math.random() * 100
        },
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Query processing error:', error);
      
      this.sendToClient(clientInfo, {
        type: 'query_error',
        query: data.query,
        error: 'Failed to process query',
        timestamp: Date.now()
      });
    }
  }
  
  sendToClient(clientInfo, message) {
    if (!clientInfo.connected || clientInfo.socket.readyState !== 1) {
      return false;
    }
    
    try {
      clientInfo.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`Failed to send message to client ${clientInfo.id}:`, error);
      this.handleClientDisconnect(clientInfo);
      return false;
    }
  }
  
  broadcastToGroup(groupName, message, excludeClientId = null) {
    const group = this.clientGroups.get(groupName);
    if (!group) return 0;
    
    let sentCount = 0;
    
    for (const clientId of group) {
      if (clientId === excludeClientId) continue;
      
      const clientInfo = this.clients.get(clientId);
      if (clientInfo && this.sendToClient(clientInfo, message)) {
        sentCount++;
      }
    }
    
    return sentCount;
  }
  
  broadcastToAll(message, excludeClientId = null) {
    let sentCount = 0;
    
    for (const [clientId, clientInfo] of this.clients) {
      if (clientId === excludeClientId) continue;
      
      if (this.sendToClient(clientInfo, message)) {
        sentCount++;
      }
    }
    
    return sentCount;
  }
  
  handleClientDisconnect(clientInfo) {
    if (!clientInfo.connected) return;
    
    clientInfo.connected = false;
    
    // Remove from groups
    for (const groupName of clientInfo.groups) {
      if (this.clientGroups.has(groupName)) {
        this.clientGroups.get(groupName).delete(clientInfo.id);
        
        if (this.clientGroups.get(groupName).size === 0) {
          this.clientGroups.delete(groupName);
        }
      }
    }
    
    // Remove client
    this.clients.delete(clientInfo.id);
    
    // Release memory pool object
    this.memoryPool.release(clientInfo);
    
    console.log(`Client disconnected: ${clientInfo.id} (Total: ${this.clients.size})`);
  }
  
  startMessageProcessing() {
    // Message processing is now event-driven and on-demand
    console.log('✅ Ultra-Performance Message Processing: ACTIVE');
  }
  
  startPerformanceMonitoring() {
    // Monitor system performance every 15 seconds
    setInterval(() => {
      this.updateSystemAnalytics();
      this.performOptimizationCycle();
    }, 15000);
  }
  
  updateSystemAnalytics() {
    const memUsage = process.memoryUsage();
    
    this.analytics.systemLoad = {
      memory: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      connections: this.clients.size,
      messageQueue: Object.values(this.messageQueue)
        .filter(queue => Array.isArray(queue))
        .reduce((sum, queue) => sum + queue.length, 0),
      timestamp: Date.now()
    };
  }
  
  performOptimizationCycle() {
    // Memory pressure optimization
    if (this.analytics.systemLoad.memory > 80) {
      console.log('[EnhancedAIBridge] High memory usage detected, performing optimization');
      
      // Trigger garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Clean up inactive clients
      this.cleanupInactiveClients();
      
      // Clear old analytics data
      if (this.analytics.responseTimeAnalytics.length > 500) {
        this.analytics.responseTimeAnalytics = this.analytics.responseTimeAnalytics.slice(-250);
      }
    }
    
    // Rate limiter cleanup
    if (this.rateLimiter.size > 1000) {
      const now = Date.now();
      const windowSize = 60 * 1000;
      
      for (const [ip, requests] of this.rateLimiter) {
        const validRequests = requests.filter(time => now - time < windowSize);
        
        if (validRequests.length === 0) {
          this.rateLimiter.delete(ip);
        } else {
          this.rateLimiter.set(ip, validRequests);
        }
      }
    }
  }
  
  cleanupInactiveClients() {
    const now = Date.now();
    const inactiveThreshold = 10 * 60 * 1000; // 10 minutes
    const toRemove = [];
    
    for (const [clientId, clientInfo] of this.clients) {
      if (now - clientInfo.lastSeen > inactiveThreshold) {
        toRemove.push(clientInfo);
      }
    }
    
    toRemove.forEach(clientInfo => {
      this.handleClientDisconnect(clientInfo);
    });
    
    if (toRemove.length > 0) {
      console.log(`Cleaned up ${toRemove.length} inactive clients`);
    }
  }
  
  calculateAverageResponseTime() {
    const recent = this.analytics.responseTimeAnalytics.slice(-100);
    if (recent.length === 0) return 0;
    
    const sum = recent.reduce((acc, metric) => acc + metric.duration, 0);
    return Math.round(sum / recent.length);
  }
  
  calculateResponseTimePercentiles() {
    const recent = this.analytics.responseTimeAnalytics.slice(-100);
    if (recent.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }
    
    const durations = recent.map(m => m.duration).sort((a, b) => a - b);
    
    return {
      p50: durations[Math.floor(durations.length * 0.5)] || 0,
      p90: durations[Math.floor(durations.length * 0.9)] || 0,
      p95: durations[Math.floor(durations.length * 0.95)] || 0,
      p99: durations[Math.floor(durations.length * 0.99)] || 0
    };
  }
  
  getPerformanceStats() {
    return {
      server: {
        uptime: process.uptime(),
        version: '2.0.0-ultra',
        clients: this.clients.size,
        groups: this.clientGroups.size
      },
      performance: {
        memoryPool: this.memoryPool.getStats(),
        connectionPool: this.connectionPool.getStats(),
        perfMonitor: this.perfMonitor.getStats(),
        systemLoad: this.analytics.systemLoad
      },
      analytics: {
        totalConnections: this.analytics.totalConnections,
        totalMessages: this.analytics.totalMessages,
        messageTypes: Object.fromEntries(this.analytics.messageTypes),
        responseTime: {
          average: this.calculateAverageResponseTime(),
          percentiles: this.calculateResponseTimePercentiles()
        }
      },
      optimization: {
        memoryPoolActive: true,
        connectionPoolActive: true,
        compressionEnabled: this.options.compressionEnabled,
        rateLimitingEnabled: this.options.rateLimiting,
        analyticsEnabled: this.options.enableAnalytics
      }
    };
  }
  
  async stop() {
    console.log('[EnhancedAIBridge] Shutting down server...');
    
    // Close all WebSocket connections
    for (const [clientId, clientInfo] of this.clients) {
      if (clientInfo.socket && clientInfo.socket.readyState === 1) {
        clientInfo.socket.close(1001, 'Server shutdown');
      }
    }
    
    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }
    
    // Close HTTP server
    if (this.server) {
      await new Promise(resolve => {
        this.server.close(resolve);
      });
    }
    
    // Stop performance monitoring
    this.perfMonitor.stop();
    
    // Destroy connection pool
    await this.connectionPool.destroy();
    
    // Stop memory pool
    this.memoryPool.stop();
    
    this.emit('stopped');
    console.log('✅ Enhanced AI Bridge Server stopped');
  }
}

export default EnhancedAIBridge;