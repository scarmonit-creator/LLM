#!/usr/bin/env node
import { WebSocketServer } from 'ws';
import express from 'express';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

dotenv.config();

const DEFAULT_HISTORY_LIMIT = 500;

function previewPayload(payload, length = 80) {
  try {
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return text.length > length ? `${text.slice(0, length)}…` : text;
  } catch (_error) {
    return '[unserializable payload]';
  }
}

export class AIBridge {
  constructor({ logger = console, historyLimit = DEFAULT_HISTORY_LIMIT } = {}) {
    this.logger = logger;
    this.historyLimit = historyLimit;
    this.clients = new Map(); // clientId -> { ws, meta }
    this.messageQueue = new Map(); // clientId -> envelope[] waiting delivery
    this.history = []; // chronological list of envelopes
  }

  registerClient(ws, registration) {
    const clientId = registration.clientId || randomUUID();
    const meta = {
      id: clientId,
      role: registration.role || 'agent',
      labels: registration.labels || [],
      tools: registration.tools || [],
      intents: registration.intents || [],
      maxConcurrentTasks: registration.maxConcurrentTasks ?? 1,
      lastSeen: new Date().toISOString(),
    };

    this.clients.set(clientId, { ws, meta });
    this.logger.log(
      `[Bridge] Registered ${clientId} (${meta.role}) – ${this.clients.size} connected`
    );

    const queued = this.messageQueue.get(clientId);
    if (queued?.length) {
      queued.forEach((envelope) => {
        this._sendEnvelope(clientId, envelope);
      });
      this.messageQueue.delete(clientId);
    }

    return meta;
  }

  unregisterClient(clientId) {
    if (!this.clients.has(clientId)) return;
    this.clients.delete(clientId);
    this.logger.log(
      `[Bridge] Client disconnected: ${clientId} (${this.clients.size} remaining)`
    );
  }

  listClients() {
    return Array.from(this.clients.values()).map(({ meta }) => meta);
  }

  getHistory({ limit, agentId, taskId, intent } = {}) {
    let result = this.history;
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

  acceptEnvelope(envelope, { allowQueue = true } = {}) {
    const enriched = this._enrichEnvelope(envelope);
    this.history.push(enriched);
    if (this.history.length > this.historyLimit) {
      this.history.splice(0, this.history.length - this.historyLimit);
    }

    if (enriched.to) {
      if (!this._sendEnvelope(enriched.to, enriched) && allowQueue) {
        if (!this.messageQueue.has(enriched.to)) {
          this.messageQueue.set(enriched.to, []);
        }
        this.messageQueue.get(enriched.to).push(enriched);
        this.logger.log(
          `[Bridge] Queued envelope ${enriched.id} for ${enriched.to} (offline)`
        );
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

  /**
   * Expected payload structures for task-related intents:
   *
   * intent: 'task.assign'
   * payload: {
   *   taskDescription: string,
   *   context: object, // e.g., file paths, code snippets, relevant data
   *   successCriteria: string | string[],
   *   // Optional:
   *   toolPermissions: string[], // List of tools the agent is allowed to call
   *   deadline: string, // ISO date string
   * }
   *
   * intent: 'task.progress'
   * payload: {
   *   status: 'in-progress' | 'waiting' | 'blocked',
   *   message: string,
   *   artifacts: object, // e.g., { file: 'path/to/file.js', content: '...' }
   *   // Optional:
   *   eta: string, // Estimated time of arrival for completion
   *   blockingReason: string, // If status is 'blocked'
   * }
   *
   * intent: 'task.complete'
   * payload: {
   *   message: string,
   *   artifacts: object, // Final deliverables
   *   // Optional:
   *   summary: string,
   *   metrics: object, // e.g., performance data, test results
   * }
   *
   * intent: 'task.blocked'
   * payload: {
   *   reason: string,
   *   // Optional:
   *   details: string,
   *   suggestedAction: string,
   * }
   */

  _sendEnvelope(targetId, envelope) {
    const target = this.clients.get(targetId);
    if (!target || target.ws.readyState !== 1) {
      return false;
    }
    try {
      target.ws.send(JSON.stringify({ type: 'envelope', envelope }));
      return true;
    } catch (error) {
      this.logger.error(`[Bridge] Failed to send envelope to ${targetId}: ${error.message}`);
      return false;
    }
  }

  _broadcast(senderId, envelope) {
    this.clients.forEach(({ ws }, clientId) => {
      if (clientId === senderId || ws.readyState !== 1) return;
      try {
        ws.send(JSON.stringify({ type: 'envelope', envelope }));
      } catch (error) {
        this.logger.error(`[Bridge] Failed broadcast to ${clientId}: ${error.message}`);
      }
    });
  }
}

export async function createAIBridgeServer({
  wsPort = Number(process.env.AI_BRIDGE_PORT) || 4567,
  httpPort = Number(process.env.AI_BRIDGE_HTTP_PORT) || 4568,
  historyLimit = DEFAULT_HISTORY_LIMIT,
  logger = console,
} = {}) {
  const bridge = new AIBridge({ logger, historyLimit });
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      wsPort,
      httpPort,
      connectedClients: bridge.clients.size,
      historySize: bridge.history.length,
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
    bridge.history.forEach((envelope) => {
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
  logger.log(`[Bridge] WebSocket listening on ws://localhost:${wss.address().port}`);

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
      if (clientId) {
        bridge.unregisterClient(clientId);
      }
    });

    ws.on('error', (error) => {
      logger.error('[Bridge] WebSocket error:', error.message);
    });
  });

  const httpServer = app.listen(httpPort);
  await once(httpServer, 'listening');
  logger.log(`[Bridge] HTTP API listening on http://localhost:${httpServer.address().port}`);

  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
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

async function startCli() {
  const server = await createAIBridgeServer();
  const banner = `
========================================
   AI Bridge Server
========================================
  WebSocket: ws://localhost:${server.ports.ws}
  HTTP API:  http://localhost:${server.ports.http}

  Health:    http://localhost:${server.ports.http}/health
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
