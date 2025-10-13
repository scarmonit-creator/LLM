#!/usr/bin/env node
import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';
import express from 'express';
import dotenv from 'dotenv';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

dotenv.config();

function previewMessage(message, length = 60) {
  if (typeof message === 'string') {
    return message.length > length ? `${message.slice(0, length)}...` : message;
  }
  const payload = JSON.stringify(message);
  return payload.length > length ? `${payload.slice(0, length)}...` : payload;
}

export class ClaudeBridge {
  constructor({ logger = console } = {}) {
    this.logger = logger;
    this.clients = new Map(); // clientId -> ws connection
    this.messageQueue = new Map(); // clientId -> message[]
    this.conversationHistory = []; // global conversation log
  }

  registerClient(ws, clientId) {
    this.clients.set(clientId, ws);
    this.logger.log(`[Bridge] Client registered: ${clientId} (${this.clients.size} total)`);

    if (this.messageQueue.has(clientId)) {
      const queued = this.messageQueue.get(clientId);
      queued.forEach((msg) => {
        try {
          ws.send(JSON.stringify(msg));
        } catch (error) {
          this.logger.error(`[Bridge] Failed to flush queued message for ${clientId}: ${error.message}`);
        }
      });
      this.messageQueue.delete(clientId);
    }
  }

  unregisterClient(clientId) {
    this.clients.delete(clientId);
    this.logger.log(`[Bridge] Client disconnected: ${clientId} (${this.clients.size} remaining)`);
  }

  broadcast(senderId, message) {
    const envelope = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      from: senderId,
      message,
    };

    this.conversationHistory.push(envelope);

    this.clients.forEach((ws, clientId) => {
      if (clientId !== senderId && ws.readyState === 1) {
        try {
          ws.send(JSON.stringify(envelope));
        } catch (error) {
          this.logger.error(`[Bridge] Failed to broadcast to ${clientId}: ${error.message}`);
        }
      }
    });

    this.logger.log(`[Bridge] Broadcast from ${senderId}: ${previewMessage(message)}`);
  }

  sendTo(targetId, message, senderId = 'bridge') {
    const envelope = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      from: senderId,
      to: targetId,
      message,
    };

    const target = this.clients.get(targetId);
    if (target && target.readyState === 1) {
      try {
        target.send(JSON.stringify(envelope));
        this.logger.log(`[Bridge] Direct message ${senderId} -> ${targetId}`);
      } catch (error) {
        this.logger.error(`[Bridge] Failed to send direct message to ${targetId}: ${error.message}`);
      }
      return;
    }

    if (!this.messageQueue.has(targetId)) {
      this.messageQueue.set(targetId, []);
    }
    this.messageQueue.get(targetId).push(envelope);
    this.logger.log(`[Bridge] Queued message for offline client ${targetId}`);
  }

  getHistory(limit = 50) {
    return this.conversationHistory.slice(-limit);
  }

  listClients() {
    return Array.from(this.clients.keys());
  }
}

export async function createBridgeServer({
  wsPort = Number(process.env.BRIDGE_PORT) || 3456,
  httpPort = Number(process.env.BRIDGE_HTTP_PORT) || 3457,
  logger = console,
  historySnapshotSize = 10,
} = {}) {
  const bridge = new ClaudeBridge({ logger });
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', clients: bridge.clients.size });
  });

  app.get('/clients', (req, res) => {
    res.json({ clients: bridge.listClients() });
  });

  app.get('/history', (req, res) => {
    const limit = parseInt(req.query.limit, 10);
    res.json({ history: bridge.getHistory(Number.isFinite(limit) ? limit : 50) });
  });

  app.post('/broadcast', (req, res) => {
    const { message, from } = req.body ?? {};
    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }
    bridge.broadcast(from || 'api', message);
    return res.json({ status: 'sent' });
  });

  app.post('/send', (req, res) => {
    const { to, message, from } = req.body ?? {};
    if (!to || !message) {
      return res.status(400).json({ error: 'Recipient and message required' });
    }
    bridge.sendTo(to, message, from || 'api');
    return res.json({ status: 'sent' });
  });

  const wss = new WebSocketServer({ port: wsPort });
  await once(wss, 'listening');
  logger.log(`[Bridge] WebSocket listening on ws://localhost:${wss.address().port}`);

  wss.on('connection', (ws) => {
    let clientId = null;

    ws.on('message', (data) => {
      try {
        const payload = JSON.parse(data.toString());

        if (payload.type === 'register') {
          clientId = payload.clientId || randomUUID();
          bridge.registerClient(ws, clientId);
          ws.send(
            JSON.stringify({
              type: 'registered',
              clientId,
              connectedClients: bridge.listClients(),
              history: bridge.getHistory(historySnapshotSize),
            }),
          );
          return;
        }

        if (payload.type === 'message') {
          if (!clientId) {
            ws.send(JSON.stringify({ type: 'error', error: 'Not registered' }));
            return;
          }

          if (payload.to) {
            bridge.sendTo(payload.to, payload.message, clientId);
          } else {
            bridge.broadcast(clientId, payload.message);
          }
          return;
        }

        if (payload.type === 'query') {
          ws.send(
            JSON.stringify({
              type: 'query_response',
              clients: bridge.listClients(),
              history: bridge.getHistory(payload.limit || 50),
            }),
          );
        }
      } catch (error) {
        logger.error('[Bridge] Error processing message:', error.message);
        ws.send(JSON.stringify({ type: 'error', error: error.message }));
      }
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

    await new Promise((resolve) => {
      wss.close(() => resolve());
    });

    await new Promise((resolve) => {
      httpServer.close(() => resolve());
    });
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

async function startCliServer() {
  const server = await createBridgeServer();
  const banner = `
========================================
  Claude Bridge Server
========================================
  WebSocket: ws://localhost:${server.ports.ws}
  HTTP API:  http://localhost:${server.ports.http}

  Status:    http://localhost:${server.ports.http}/health
  Clients:   http://localhost:${server.ports.http}/clients
  History:   http://localhost:${server.ports.http}/history
========================================
`;

  console.log(banner);
  console.log('[Bridge] Waiting for Claude instances to connect...');

  const shutdown = async () => {
    console.log('\n[Bridge] Shutting down bridge...');
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

const modulePath = fileURLToPath(import.meta.url);
const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPath && modulePath === entryPath) {
  startCliServer().catch((error) => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
}
