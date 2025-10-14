#!/usr/bin/env node
import { WebSocketServer } from 'ws';
import express from 'express';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { EventEmitter } from 'node:events';

// Phase 2 Optimizations
import { ObjectPoolFactory } from './memory/object-pool.js';
import { getGlobalOptimizer, GCUtils } from './memory/gc-optimizer.js';
import { WorkerPool } from './workers/worker-pool.js';

dotenv.config();

// Constants optimized for performance
const DEFAULT_HISTORY_LIMIT = 500;
const UI_UPDATE_COALESCING_TIME = 200;
const MAX_CONCURRENT_CONNECTIONS = 1000;
const MESSAGE_BATCH_SIZE = 10;
const HEARTBEAT_INTERVAL = 30000;
const CLEANUP_INTERVAL = 60000;

// Memory-efficient payload preview function
function previewPayload(payload, length = 80) {
  try {
    if (typeof payload === 'string') {
      return payload.length > length ? payload.slice(0, length) + '…' : payload;
    }
    const text = JSON.stringify(payload);
    return text.length > length ? text.slice(0, length) + '…' : text;
  } catch {
    return '[unserializable payload]';
  }
}

// Enhanced client metadata with pooled objects
class ClientMetadata {
  constructor(registration) {
    this.id = registration.clientId || randomUUID();
    this.role = registration.role || 'agent';
    this.labels = new Set(registration.labels || []);
    this.tools = new Set(registration.tools || []);
    this.intents = new Set(registration.intents || []);
    this.maxConcurrentTasks = registration.maxConcurrentTasks ?? 1;
    this.lastSeen = Date.now();
    this.messageCount = 0;
    this.errorCount = 0;
    this.connectionTime = Date.now();
  }

  updateLastSeen() {
    this.lastSeen = Date.now();
  }

  toJSON() {
    return {
      id: this.id,
      role: this.role,
      labels: Array.from(this.labels),
      tools: Array.from(this.tools),
      intents: Array.from(this.intents),
      maxConcurrentTasks: this.maxConcurrentTasks,
      lastSeen: new Date(this.lastSeen).toISOString(),
      messageCount: this.messageCount,
      errorCount: this.errorCount,
      uptime: Date.now() - this.connectionTime
    };
  }
}

// Enhanced circular buffer with object pooling
class CircularBuffer {
  constructor(capacity) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  push(item) {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    
    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  toArray() {
    if (this.size === 0) return [];
    
    const result = new Array(this.size);
    for (let i = 0; i < this.size; i++) {
      const index = (this.head + i) % this.capacity;
      result[i] = this.buffer[index];
    }
    return result;
  }

  filter(predicate, limit) {
    const result = [];
    let count = 0;
    
    for (let i = this.size - 1; i >= 0 && count < limit; i--) {
      const index = (this.head + i) % this.capacity;
      const item = this.buffer[index];
      if (predicate(item)) {
        result.unshift(item);
        count++;
      }
    }
    return result;
  }

  get length() {
    return this.size;
  }
}

// Enhanced message queue with object pooling
class MessageQueue {
  constructor() {
    this.queues = new Map();
    this.batchTimer = null;
    this.pendingBatches = new Set();
    
    // Object pools for performance
    this.arrayPool = ObjectPoolFactory.createArrayPool(0, { initialSize: 10, maxSize: 50 });
  }

  enqueue(clientId, envelope) {
    if (!this.queues.has(clientId)) {
      this.queues.set(clientId, this.arrayPool.acquire());
    }
    this.queues.get(clientId).push(envelope);
    this._scheduleBatchProcess();
  }

  dequeue(clientId) {
    const queue = this.queues.get(clientId);
    if (!queue || queue.length === 0) return [];
    
    const batch = queue.splice(0, MESSAGE_BATCH_SIZE);
    if (queue.length === 0) {
      this.arrayPool.release(queue);
      this.queues.delete(clientId);
    }
    return batch;
  }

  _scheduleBatchProcess() {
    if (this.batchTimer) return;
    
    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
    }, UI_UPDATE_COALESCING_TIME);
  }

  clear(clientId) {
    const queue = this.queues.get(clientId);
    if (queue) {
      this.arrayPool.release(queue);
      this.queues.delete(clientId);
    }
  }

  size() {
    return this.queues.size;
  }
}

// Enhanced AI Bridge with Phase 2 optimizations
export class EnhancedAIBridge extends EventEmitter {
  constructor({ logger = console, historyLimit = DEFAULT_HISTORY_LIMIT } = {}) {
    super();
    this.logger = logger;
    this.clients = new Map();
    this.messageQueue = new MessageQueue();
    this.history = new CircularBuffer(historyLimit);
    
    // Phase 2: Object pools for hot paths
    this.envelopePool = ObjectPoolFactory.createObjectPool({
      id: null,
      timestamp: null,
      intent: null,
      taskId: null,
      channel: 'default',
      priority: 'normal',
      from: null,
      role: 'agent',
      to: null,
      replyTo: null,
      context: {},
      payload: {},
      tools: [],
      attachments: [],
      trace: {},
      _processingTime: 0
    }, { initialSize: 20, maxSize: 100 });
    
    // Phase 2: GC optimizer
    this.gcOptimizer = getGlobalOptimizer({
      memoryPressureThreshold: 0.75,
      criticalMemoryThreshold: 0.9,
      gcCooldownMs: 15000
    });
    
    // Phase 2: Worker pool for CPU-intensive tasks
    this.workerPool = new WorkerPool({
      maxWorkers: Math.min(4, require('os').cpus().length),
      taskTimeout: 10000
    });
    
    this.metrics = {
      totalMessages: 0,
      totalConnections: 0,
      totalErrors: 0,
      startTime: Date.now(),
      pooledEnvelopes: 0,
      gcTriggers: 0,
      workerTasks: 0
    };
    
    // Start optimizations in production
    if (process.env.NODE_ENV === 'production') {
      this.gcOptimizer.startMonitoring();
    }
    
    // Setup event handlers
    this.setupOptimizationHandlers();
    
    // Periodic cleanup
    this.cleanupTimer = setInterval(() => this._performCleanup(), CLEANUP_INTERVAL);
    this.heartbeatTimer = setInterval(() => this._checkHeartbeats(), HEARTBEAT_INTERVAL);
  }
  
  setupOptimizationHandlers() {
    // GC optimizer events
    this.gcOptimizer.on('gc_completed', (data) => {
      this.metrics.gcTriggers++;
      this.logger.log(`[Bridge] GC completed: ${data.duration.toFixed(2)}ms, reclaimed: ${Math.round(data.memoryReclaimed/1024/1024)}MB`);
    });
    
    this.gcOptimizer.on('critical_pressure', () => {
      this.logger.warn('[Bridge] Critical memory pressure detected');
      this.emit('memory_pressure', { level: 'critical' });
    });
    
    // Worker pool events
    this.workerPool.on('task_completed', (data) => {
      this.metrics.workerTasks++;
    });
    
    this.workerPool.on('task_error', (data) => {
      this.logger.error(`[Bridge] Worker task failed: ${data.error}`);
    });
  }

  registerClient(ws, registration) {
    if (this.clients.size >= MAX_CONCURRENT_CONNECTIONS) {
      throw new Error('Maximum concurrent connections exceeded');
    }

    const meta = new ClientMetadata(registration);
    this.clients.set(meta.id, { ws, meta });
    this.metrics.totalConnections++;
    
    this.logger.log(
      `[Bridge] Registered ${meta.id} (${meta.role}) – ${this.clients.size} connected`
    );

    const queued = this.messageQueue.dequeue(meta.id);
    if (queued.length > 0) {
      this._sendBatch(meta.id, queued);
    }

    this.emit('clientRegistered', meta);
    return meta;
  }

  unregisterClient(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    this.clients.delete(clientId);
    this.messageQueue.clear(clientId);
    
    this.logger.log(`[Bridge] Client disconnected: ${clientId} (${this.clients.size} remaining)`);
    this.emit('clientDisconnected', clientId);
  }

  listClients() {
    return Array.from(this.clients.values()).map(({ meta }) => meta.toJSON());
  }

  getHistory({ limit = this.history.capacity, agentId, taskId, intent } = {}) {
    const maxLimit = Math.min(limit, this.history.length);
    
    if (!agentId && !taskId && !intent) {
      return this.history.toArray().slice(-maxLimit);
    }

    return this.history.filter(item => {
      return (!agentId || item.from === agentId || item.to === agentId) &&
             (!taskId || item.taskId === taskId) &&
             (!intent || item.intent === intent);
    }, maxLimit);
  }

  acceptEnvelope(envelope, { allowQueue = true } = {}) {
    try {
      const enriched = this._enrichEnvelope(envelope);
      this.history.push(enriched);
      this.metrics.totalMessages++;

      // Async processing for heavy payloads
      if (this._shouldOffloadProcessing(enriched)) {
        this._processEnvelopeAsync(enriched, allowQueue);
      } else {
        this._processEnvelopeSync(enriched, allowQueue);
      }

      this.logger.log(
        `[Bridge] Envelope ${enriched.intent || 'agent.message'} from ${enriched.from} -> ${
          enriched.to || 'broadcast'
        }: ${previewPayload(enriched.payload)}`
      );

      this.emit('envelopeProcessed', enriched);
      return enriched;
    } catch (error) {
      this.metrics.totalErrors++;
      this.logger.error(`[Bridge] Error processing envelope: ${error.message}`);
      throw error;
    }
  }
  
  _shouldOffloadProcessing(envelope) {
    // Offload if payload is large or contains complex data
    const payloadSize = JSON.stringify(envelope.payload).length;
    return payloadSize > 10000 || 
           envelope.intent === 'data.transform' ||
           envelope.intent === 'analysis.process';
  }
  
  async _processEnvelopeAsync(enriched, allowQueue) {
    try {
      // Offload heavy processing to worker pool
      if (enriched.intent === 'data.transform') {
        const result = await this.workerPool.execute({
          operation: 'transform',
          data: enriched.payload
        });
        enriched.payload = result;
      }
      
      this._processEnvelopeSync(enriched, allowQueue);
    } catch (error) {
      this.logger.error(`[Bridge] Async processing failed: ${error.message}`);
      this._processEnvelopeSync(enriched, allowQueue);
    }
  }
  
  _processEnvelopeSync(enriched, allowQueue) {
    if (enriched.to) {
      if (!this._sendEnvelope(enriched.to, enriched) && allowQueue) {
        this.messageQueue.enqueue(enriched.to, enriched);
        this.logger.log(`[Bridge] Queued envelope ${enriched.id} for ${enriched.to} (offline)`);
      }
    } else {
      this._broadcast(enriched.from, enriched);
    }
  }

  _enrichEnvelope(envelope) {
    const now = Date.now();
    const timestamp = new Date(now).toISOString();
    
    // Use pooled envelope object
    const enriched = this.envelopePool.acquire();
    this.metrics.pooledEnvelopes++;
    
    // Reset and populate
    Object.assign(enriched, {
      id: envelope.id || randomUUID(),
      timestamp: envelope.timestamp || timestamp,
      intent: envelope.intent || 'agent.message',
      taskId: envelope.taskId ?? null,
      channel: envelope.channel || 'default',
      priority: envelope.priority ?? 'normal',
      from: envelope.from || 'unknown',
      role: envelope.role || this.clients.get(envelope.from)?.meta.role || 'agent',
      to: envelope.to ?? null,
      replyTo: envelope.replyTo ?? null,
      context: envelope.context ?? {},
      payload: envelope.payload ?? {},
      tools: envelope.tools ?? [],
      attachments: envelope.attachments ?? [],
      trace: envelope.trace ?? {},
      _processingTime: now
    });
    
    return enriched;
  }

  _sendEnvelope(targetId, envelope) {
    const target = this.clients.get(targetId);
    if (!target || target.ws.readyState !== 1) {
      return false;
    }

    try {
      target.ws.send(JSON.stringify({ type: 'envelope', envelope }));
      target.meta.messageCount++;
      target.meta.updateLastSeen();
      
      // Release pooled envelope after sending
      if (envelope._isPooled) {
        this.envelopePool.release(envelope);
      }
      
      return true;
    } catch (error) {
      target.meta.errorCount++;
      this.logger.error(`[Bridge] Failed to send envelope to ${targetId}: ${error.message}`);
      return false;
    }
  }

  _sendBatch(targetId, envelopes) {
    const target = this.clients.get(targetId);
    if (!target || target.ws.readyState !== 1) {
      return false;
    }

    try {
      target.ws.send(JSON.stringify({ 
        type: 'batch', 
        envelopes: envelopes 
      }));
      target.meta.messageCount += envelopes.length;
      target.meta.updateLastSeen();
      
      // Release pooled envelopes
      envelopes.forEach(envelope => {
        if (envelope._isPooled) {
          this.envelopePool.release(envelope);
        }
      });
      
      return true;
    } catch (error) {
      target.meta.errorCount++;
      this.logger.error(`[Bridge] Failed to send batch to ${targetId}: ${error.message}`);
      return false;
    }
  }

  _broadcast(senderId, envelope) {
    let successCount = 0;
    let errorCount = 0;

    this.clients.forEach(({ ws, meta }, clientId) => {
      if (clientId === senderId || ws.readyState !== 1) return;
      
      try {
        ws.send(JSON.stringify({ type: 'envelope', envelope }));
        meta.messageCount++;
        meta.updateLastSeen();
        successCount++;
      } catch (error) {
        meta.errorCount++;
        errorCount++;
        this.logger.error(`[Bridge] Failed broadcast to ${clientId}: ${error.message}`);
      }
    });
    
    // Release pooled envelope after broadcast
    if (envelope._isPooled) {
      this.envelopePool.release(envelope);
    }

    this.logger.log(`[Bridge] Broadcast completed: ${successCount} successful, ${errorCount} failed`);
  }

  _performCleanup() {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000;
    let cleanedCount = 0;

    this.clients.forEach(({ ws, meta }, clientId) => {
      if (now - meta.lastSeen > staleThreshold && ws.readyState !== 1) {
        this.unregisterClient(clientId);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      this.logger.log(`[Bridge] Cleanup completed: removed ${cleanedCount} stale connections`);
    }

    // Trigger GC if memory pressure is high
    const memoryUsage = process.memoryUsage();
    const heapRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;
    
    if (heapRatio > 0.8) {
      this.gcOptimizer.triggerGC('cleanup_high_memory');
    }
  }

  _checkHeartbeats() {
    const now = Date.now();
    const heartbeatThreshold = HEARTBEAT_INTERVAL * 2;

    this.clients.forEach(({ ws, meta }, clientId) => {
      if (now - meta.lastSeen > heartbeatThreshold) {
        this.logger.warn(`[Bridge] Client ${clientId} missed heartbeat, last seen: ${new Date(meta.lastSeen).toISOString()}`);
        
        if (ws.readyState === 1) {
          try {
            ws.ping();
          } catch (error) {
            this.logger.error(`[Bridge] Failed to ping ${clientId}: ${error.message}`);
            this.unregisterClient(clientId);
          }
        }
      }
    });
  }

  getMetrics() {
    const now = Date.now();
    const gcStats = this.gcOptimizer.getStatistics();
    const workerStats = this.workerPool.getStatistics();
    const poolStats = {
      envelopes: this.envelopePool.getStatistics(),
      arrays: this.messageQueue.arrayPool.getStatistics()
    };
    
    return {
      ...this.metrics,
      uptime: now - this.metrics.startTime,
      connectedClients: this.clients.size,
      queuedMessages: Array.from(this.messageQueue.queues.values()).reduce((sum, queue) => sum + queue.length, 0),
      historySize: this.history.length,
      memoryUsage: process.memoryUsage(),
      memoryPressure: GCUtils.getMemorySummary(),
      gcOptimizer: gcStats,
      workerPool: workerStats,
      objectPools: poolStats
    };
  }

  async destroy() {
    clearInterval(this.cleanupTimer);
    clearInterval(this.heartbeatTimer);
    
    // Shutdown worker pool
    await this.workerPool.shutdown(5000);
    
    // Stop GC optimizer
    this.gcOptimizer.stopMonitoring();
    
    // Clean up object pools
    this.envelopePool.destroy();
    this.messageQueue.arrayPool.destroy();
    
    this.clients.clear();
    this.messageQueue.queues.clear();
    this.removeAllListeners();
  }
}

export async function createEnhancedAIBridgeServer({
  wsPort = Number(process.env.AI_BRIDGE_PORT) || 4567,
  httpPort = Number(process.env.AI_BRIDGE_HTTP_PORT) || 4568,
  historyLimit = DEFAULT_HISTORY_LIMIT,
  logger = console,
} = {}) {
  const bridge = new EnhancedAIBridge({ logger, historyLimit });
  const app = express();
  app.use(express.json());

  // Enhanced health endpoint with optimization metrics
  app.get('/health', (req, res) => {
    const metrics = bridge.getMetrics();
    res.json({
      status: 'ok',
      version: '2.1.0-optimized',
      wsPort,
      httpPort,
      ...metrics
    });
  });

  app.get('/metrics', (req, res) => {
    res.json(bridge.getMetrics());
  });

  app.get('/optimization', (req, res) => {
    const metrics = bridge.getMetrics();
    res.json({
      memoryOptimization: {
        gcOptimizer: metrics.gcOptimizer,
        objectPools: metrics.objectPools,
        memoryPressure: metrics.memoryPressure
      },
      cpuOptimization: {
        workerPool: metrics.workerPool
      },
      performance: {
        pooledEnvelopes: metrics.pooledEnvelopes,
        gcTriggers: metrics.gcTriggers,
        workerTasks: metrics.workerTasks
      }
    });
  });

  app.get('/agents', (req, res) => {
    res.json({ agents: bridge.listClients() });
  });

  app.get('/history', (req, res) => {
    const { limit, agentId, taskId, intent } = req.query;
    res.json({
      history: bridge.getHistory({
        limit: limit ? Number(limit) : undefined,
        agentId,
        taskId,
        intent,
      }),
    });
  });

  app.post('/broadcast', (req, res) => {
    const envelope = bridge.acceptEnvelope({
      ...req.body,
      from: req.body?.from || 'api',
    });
    res.status(202).json({ status: 'queued', envelope });
  });

  app.post('/send', (req, res) => {
    if (!req.body?.to) {
      return res.status(400).json({ error: 'Recipient `to` is required' });
    }
    const envelope = bridge.acceptEnvelope({
      ...req.body,
      from: req.body?.from || 'api',
    });
    res.status(202).json({ status: 'queued', envelope });
  });

  app.get('/tasks', (req, res) => {
    const tasks = new Map();
    bridge.getHistory().forEach((envelope) => {
      if (!envelope.taskId) return;
      const task = tasks.get(envelope.taskId) || {
        taskId: envelope.taskId,
        intents: new Set(),
        lastUpdate: envelope.timestamp,
        participants: new Set(),
        lastEnvelope: envelope,
      };
      task.intents.add(envelope.intent);
      task.participants.add(envelope.from);
      task.participants.add(envelope.to);
      task.lastUpdate = envelope.timestamp;
      task.lastEnvelope = envelope;
      tasks.set(envelope.taskId, task);
    });

    res.json({
      tasks: Array.from(tasks.values()).map((task) => ({
        taskId: task.taskId,
        intents: Array.from(task.intents),
        participants: Array.from(task.participants).filter(Boolean),
        lastUpdate: task.lastUpdate,
        lastEnvelope: task.lastEnvelope,
      })),
    });
  });

  const wss = new WebSocketServer({ port: wsPort });
  await once(wss, 'listening');
  logger.log(`[Bridge] Enhanced WebSocket listening on ws://localhost:${wss.address().port}`);

  wss.on('connection', (ws) => {
    let clientId = null;

    ws.on('message', (raw) => {
      let payload;
      try {
        payload = JSON.parse(raw.toString());
      } catch (_error) {
        logger.error('[Bridge] Received invalid JSON payload');
        return;
      }

      if (payload.type === 'register') {
        try {
          const meta = bridge.registerClient(ws, payload);
          clientId = meta.id;
          ws.send(
            JSON.stringify({
              type: 'registered',
              client: meta.toJSON(),
              history: bridge.getHistory({ limit: 10 }),
            })
          );
        } catch (error) {
          ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
        return;
      }

      if (payload.type === 'heartbeat') {
        if (clientId && bridge.clients.has(clientId)) {
          bridge.clients.get(clientId).meta.updateLastSeen();
        }
        ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
        return;
      }

      if (payload.type === 'envelope' && payload.envelope) {
        bridge.acceptEnvelope({ ...payload.envelope, from: payload.envelope.from || clientId });
        return;
      }

      logger.warn('[Bridge] Unknown payload type:', payload?.type);
    });

    ws.on('close', () => {
      if (clientId) {
        bridge.unregisterClient(clientId);
      }
    });

    ws.on('error', (error) => {
      logger.error('[Bridge] WebSocket error:', error.message);
    });

    ws.on('pong', () => {
      if (clientId && bridge.clients.has(clientId)) {
        bridge.clients.get(clientId).meta.updateLastSeen();
      }
    });
  });

  const httpServer = app.listen(httpPort);
  await once(httpServer, 'listening');
  logger.log(`[Bridge] Enhanced HTTP API listening on http://localhost:${httpServer.address().port}`);

  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    await bridge.destroy();
    await new Promise((resolve) => wss.close(resolve));
    await new Promise((resolve) => httpServer.close(resolve));
  }

  return {
    bridge,
    wss,
    httpServer,
    ports: {
      ws: wss.address().port,
      http: httpServer.address().port,
    },
    close,
  };
}

// CLI startup with enhanced banner
async function startCli() {
  const server = await createEnhancedAIBridgeServer();
  const banner = `
========================================
   AI Bridge Server v2.1.0 ENHANCED
========================================
  WebSocket: ws://localhost:${server.ports.ws}
  HTTP API:  http://localhost:${server.ports.http}

  Health:      http://localhost:${server.ports.http}/health
  Metrics:     http://localhost:${server.ports.http}/metrics
  Optimization: http://localhost:${server.ports.http}/optimization
  Agents:      http://localhost:${server.ports.http}/agents
  History:     http://localhost:${server.ports.http}/history
  Tasks:       http://localhost:${server.ports.http}/tasks

  🚀 Phase 2 Optimizations Active:
     • Object Pooling
     • GC Optimization  
     • Worker Pool
========================================
`;
  console.log(banner);
  console.log('[Bridge] Enhanced AI Bridge with Phase 2 optimizations ready…');

  const shutdown = async () => {
    console.log('\n[Bridge] Shutting down Enhanced AI Bridge…');
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

const modulePath = fileURLToPath(import.meta.url);
const scriptPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (scriptPath && modulePath === scriptPath) {
  startCli().catch((error) => {
    console.error('Fatal error starting Enhanced AI Bridge:', error.message);
    process.exit(1);
  });
}