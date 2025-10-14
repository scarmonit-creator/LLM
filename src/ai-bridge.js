#!/usr/bin/env node
import { WebSocketServer } from 'ws';
import express from 'express';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

dotenv.config();

const DEFAULT_HISTORY_LIMIT = Number(process.env.AI_BRIDGE_HISTORY_LIMIT) || 500;
const MAX_QUEUE_PER_CLIENT = Number(process.env.AI_BRIDGE_MAX_QUEUE) || 1000;
const TOKEN_AUTH_ENABLED = process.env.AI_BRIDGE_AUTH_TOKEN ? true : false;
const ALLOWED_ORIGINS = (process.env.AI_BRIDGE_CORS_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim());

function previewPayload(payload, length = 80) {
  try {
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return text.length > length ? `${text.slice(0, length)}…` : text;
  } catch (_error) {
    return '[unserializable payload]';
  }
}

class CircularBuffer {
  constructor(limit) {
    this.limit = limit;
    this.buf = [];
  }
  push(item) {
    this.buf.push(item);
    if (this.buf.length > this.limit) this.buf.splice(0, this.buf.length - this.limit);
  }
  toArray() {
    return this.buf.slice();
  }
  filter(fn) {
    return this.buf.filter(fn);
  }
  get length() {
    return this.buf.length;
  }
}

export class AIBridge {
  constructor({ logger = console, historyLimit = DEFAULT_HISTORY_LIMIT } = {}) {
    this.logger = logger;
    this.historyLimit = historyLimit;
    this.clients = new Map(); // clientId -> { ws, meta }
    this.messageQueue = new Map(); // clientId -> envelope[] waiting delivery
    this.history = new CircularBuffer(historyLimit); // chronological list of envelopes
    this.startTime = Date.now();
    this.stats = {
      messagesProcessed: 0,
      totalConnections: 0,
      errors: 0,
      lastError: null
    };
    // Cleanup timer
    const interval = Number(process.env.AI_BRIDGE_CLEANUP_INTERVAL_MS) || 30000;
    this.cleanupTimer = setInterval(() => this._cleanup(), interval);
    this.cleanupTimer.unref?.();
  }

  _isOriginAllowed(origin) {
    if (!origin || ALLOWED_ORIGINS.includes('*')) return true;
    return ALLOWED_ORIGINS.includes(origin);
  }

  _authOk(token) {
    if (!TOKEN_AUTH_ENABLED) return true;
    return token === process.env.AI_BRIDGE_AUTH_TOKEN;
  }

  registerClient(ws, registration) {
    if (!this._authOk(registration?.authToken)) {
      ws.send(JSON.stringify({ type: 'error', error: 'unauthorized' }));
      ws.close(1008, 'Unauthorized');
      return {};
    }

    const clientId = registration.clientId || randomUUID();
    const meta = {
      id: clientId,
      role: registration.role || 'agent',
      labels: registration.labels || [],
      tools: registration.tools || [],
      intents: registration.intents || [],
      maxConcurrentTasks: registration.maxConcurrentTasks ?? 1,
      lastSeen: new Date().toISOString(),
      connectedAt: new Date().toISOString()
    };

    this.clients.set(clientId, { ws, meta });
    this.stats.totalConnections++;
    this.logger.log(
      `[Bridge] Registered ${clientId} (${meta.role}) – ${this.clients.size} connected`
    );

    const queued = this.messageQueue.get(clientId);
    if (queued?.length) {
      queued.splice(0, MAX_QUEUE_PER_CLIENT).forEach((envelope) => {
        this._sendEnvelope(clientId, envelope);
      });
      this.messageQueue.delete(clientId);
    }

    return meta;
  }

  unregisterClient(clientId) {
    if (!this.clients.has(clientId)) return;
    this.clients.delete(clientId);
    this.logger.log(`[Bridge] Client disconnected: ${clientId} (${this.clients.size} remaining)`);
  }

  listClients() {
    return Array.from(this.clients.values()).map(({ meta }) => meta);
  }

  getHistory({ limit, agentId, taskId, intent } = {}) {
    let result = this.history.toArray();
    if (agentId) {
      result = result.filter((item) => item.from === agentId || item.to === agentId);
    }
    if (taskId) {
      result = result.filter((item) => item.taskId === taskId);
    }
    if (intent) {
      result = result.filter((item) => item.intent === intent);
    }
    const max = Number.isFinite(limit) ? Number(limit) : this.historyLimit;
    return result.slice(-max);
  }

  getStats() {
    const uptime = Date.now() - this.startTime;
    return {
      ...this.stats,
      uptime: Math.floor(uptime / 1000),
      connectedClients: this.clients.size,
      queuedMessages: Array.from(this.messageQueue.values()).reduce((sum, queue) => sum + queue.length, 0),
      historySize: this.history.length,
      messagesPerSecond: this.stats.messagesProcessed / (uptime / 1000) || 0
    };
  }

  acceptEnvelope(envelope, { allowQueue = true } = {}) {
    try {
      const enriched = this._enrichEnvelope(envelope);
      this.history.push(enriched);
      this.stats.messagesProcessed++;

      if (enriched.to) {
        if (!this._sendEnvelope(enriched.to, enriched) && allowQueue) {
          const q = this.messageQueue.get(enriched.to) || [];
          if (q.length >= MAX_QUEUE_PER_CLIENT) {
            q.shift(); // drop oldest
          }
          q.push(enriched);
          this.messageQueue.set(enriched.to, q);
          this.logger.log(`[Bridge] Queued envelope ${enriched.id} for ${enriched.to} (offline)`);
        }
      } else {
        this._broadcast(enriched.from, enriched);
      }

      this.logger.log(
        `[Bridge] Envelope ${enriched.intent || 'agent.message'} from ${enriched.from} -> ${
          enriched.to || 'broadcast'
        }: ${previewPayload(enriched.payload)}`
      );

      return enriched;
    } catch (error) {
      this.stats.errors++;
      this.stats.lastError = error.message;
      this.logger.error(`[Bridge] Error processing envelope: ${error.message}`);
      throw error;
    }
  }

  _cleanup() {
    // remove queues for disconnected clients
    for (const [clientId, queue] of this.messageQueue.entries()) {
      const client = this.clients.get(clientId);
      if (!client || client.ws.readyState !== 1) {
        if (queue.length > MAX_QUEUE_PER_CLIENT) queue.splice(0, queue.length - MAX_QUEUE_PER_CLIENT);
      }
    }
    // expire clients not seen for 10 minutes
    const ttlMs = Number(process.env.AI_BRIDGE_CLIENT_TTL_MS) || 10 * 60 * 1000;
    const now = Date.now();
    for (const [clientId, { meta }] of this.clients.entries()) {
      if (meta.lastSeen && now - Date.parse(meta.lastSeen) > ttlMs) {
        this.logger.log(`[Bridge] Expiring idle client ${clientId}`);
        this.unregisterClient(clientId);
      }
    }
  }

  _enrichEnvelope(envelope) {
    const now = new Date().toISOString();
    return {
      id: envelope.id || randomUUID(),
      timestamp: envelope.timestamp || now,
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
    };
  }

  _sendEnvelope(targetId, envelope) {
    const target = this.clients.get(targetId);
    if (!target || target.ws.readyState !== 1) {
      return false;
    }
    try {
      // Minimal wrapper to reduce JSON size
      target.ws.send(JSON.stringify(['env', envelope]));
      return true;
    } catch (error) {
      this.logger.error(`[Bridge] Failed to send envelope to ${targetId}: ${error.message}`);
      this.stats.errors++;
      this.stats.lastError = error.message;
      return false;
    }
  }

  _broadcast(senderId, envelope) {
    for (const [clientId, { ws }] of this.clients.entries()) {
      if (clientId === senderId || ws.readyState !== 1) continue;
      try {
        ws.send(JSON.stringify(['env', envelope]));
      } catch (error) {
        this.logger.error(`[Bridge] Failed broadcast to ${clientId}: ${error.message}`);
        this.stats.errors++;
        this.stats.lastError = error.message;
      }
    }
  }
}

export async function createAIBridgeServer({
  wsPort = Number(process.env.AI_BRIDGE_PORT) || Number(process.env.PORT) || 4567,
  httpPort = Number(process.env.AI_BRIDGE_HTTP_PORT) || Number(process.env.PORT) || 4568,
  historyLimit = DEFAULT_HISTORY_LIMIT,
  logger = console,
} = {}) {
  const bridge = new AIBridge({ logger, historyLimit });
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Basic rate limiting
  const limiter = rateLimit({
    windowMs: Number(process.env.AI_BRIDGE_RATE_WINDOW_MS) || 60 * 1000,
    max: Number(process.env.AI_BRIDGE_RATE_MAX) || 120,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // CORS
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes('*') || (origin && ALLOWED_ORIGINS.includes(origin))) {
      res.header('Access-Control-Allow-Origin', origin || '*');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  // Simple auth middleware for HTTP
  app.use((req, res, next) => {
    if (!TOKEN_AUTH_ENABLED) return next();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (token === process.env.AI_BRIDGE_AUTH_TOKEN) return next();
    return res.status(401).json({ error: 'unauthorized' });
  });

  // Health endpoint
  app.get('/health', (req, res) => {
    const stats = bridge.getStats();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      wsPort,
      httpPort,
      connectedClients: bridge.clients.size,
      historySize: bridge.history.length,
      uptime: stats.uptime,
      version: '1.1.0',
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Status endpoint
  app.get('/api/status', (req, res) => {
    const stats = bridge.getStats();
    res.json({
      service: 'AI Bridge Server',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.1.0',
      uptime: stats.uptime,
      performance: {
        connectedClients: stats.connectedClients,
        messagesProcessed: stats.messagesProcessed,
        messagesPerSecond: Number(stats.messagesPerSecond.toFixed(2)),
        queuedMessages: stats.queuedMessages,
        errors: stats.errors,
        lastError: stats.lastError
      },
      websocket: { port: wsPort, enabled: true, connections: stats.connectedClients },
      http: { port: httpPort, enabled: true },
      storage: { historySize: stats.historySize, historyLimit },
      environment: process.env.NODE_ENV || 'development'
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
    bridge.history.toArray().forEach((envelope) => {
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

  // Single port mode
  const deploymentPort = Number(process.env.PORT);
  if (deploymentPort) {
    httpPort = deploymentPort;
    wsPort = deploymentPort;
  }

  // WebSocket server with permessage-deflate compression
  const wss = new WebSocketServer({
    port: wsPort,
    perMessageDeflate: {
      zlibDeflateOptions: { level: 6 },
      zlibInflateOptions: { chunkSize: 16 * 1024 },
      clientNoContextTakeover: true,
      serverNoContextTakeover: true,
      concurrencyLimit: 10,
      threshold: 1024, // only compress bigger frames
    },
  });
  await once(wss, 'listening');
  logger.log(`[Bridge] WebSocket listening on ws://localhost:${wss.address().port}`);

  wss.on('connection', (ws, req) => {
    const origin = req.headers.origin;
    if (!this?._isOriginAllowed?.(origin)) {
      ws.close(1008, 'Origin not allowed');
      return;
    }

    let clientId = null;

    ws.on('message', (raw) => {
      let payload;
      try {
        payload = JSON.parse(raw.toString());
      } catch (_error) {
        logger.error('[Bridge] Received invalid JSON payload');
        bridge.stats.errors++;
        bridge.stats.lastError = 'Invalid JSON payload';
        return;
      }

      if (payload.type === 'register') {
        const meta = bridge.registerClient(ws, payload);
        clientId = meta.id;
        ws.send(
          JSON.stringify({
            type: 'registered',
            client: meta,
            history: bridge.getHistory({ limit: 10 }),
          })
        );
        return;
      }

      if (payload.type === 'heartbeat') {
        if (clientId && bridge.clients.has(clientId)) {
          bridge.clients.get(clientId).meta.lastSeen = new Date().toISOString();
        }
        return;
      }

      if (payload.type === 'envelope' && payload.envelope) {
        bridge.acceptEnvelope({ ...payload.envelope, from: payload.envelope.from || clientId });
        return;
      }

      logger.warn('[Bridge] Unknown payload type:', payload?.type);
    });

    ws.on('close', () => {
      if (clientId) bridge.unregisterClient(clientId);
    });

    ws.on('error', (error) => {
      logger.error('[Bridge] WebSocket error:', error.message);
      bridge.stats.errors++;
      bridge.stats.lastError = error.message;
    });
  });

  const httpServer = app.listen(httpPort);
  await once(httpServer, 'listening');
  logger.log(`[Bridge] HTTP API listening on http://localhost:${httpServer.address().port}`);

  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    clearInterval(bridge.cleanupTimer);
    await new Promise((resolve) => wss.close(resolve));
    await new Promise((resolve) => httpServer.close(resolve));
  }

  return {
    bridge,
    wss,
    httpServer,
    ports: { ws: wss.address().port, http: httpServer.address().port },
    close,
  };
}

async function startCli() {
  const server = await createAIBridgeServer();
  const banner = `
========================================
   AI Bridge Server v1.1.0
========================================
  WebSocket: ws://localhost:${server.ports.ws}
  HTTP API:  http://localhost:${server.ports.http}

  Health:    http://localhost:${server.ports.http}/health
  Status:    http://localhost:${server.ports.http}/api/status
  Agents:    http://localhost:${server.ports.http}/agents
  History:   http://localhost:${server.ports.http}/history
  Tasks:     http://localhost:${server.ports.http}/tasks
========================================
`;
  console.log(banner);
  console.log('[Bridge] Waiting for agents to connect…');

  const shutdown = async () => {
    console.log('\n[Bridge] Shutting down AI Bridge…');
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
    console.error('Fatal error starting AI Bridge:', error.message);
    process.exit(1);
  });
}
