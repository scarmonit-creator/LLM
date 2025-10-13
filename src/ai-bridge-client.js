#!/usr/bin/env node
import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

export class AIBridgeClient {
  constructor({
    url = process.env.AI_BRIDGE_URL || 'ws://localhost:4567',
    clientId = process.env.AGENT_ID || `agent-${randomUUID().slice(0, 8)}`,
    role = process.env.AGENT_ROLE || 'agent',
    labels = [],
    tools = [],
    intents = [],
  } = {}) {
    this.url = url;
    this.clientId = clientId;
    this.role = role;
    this.labels = labels;
    this.tools = tools;
    this.intents = intents;
    this.ws = null;
    this.connected = false;
    this.handlers = new Set();
  }

  async connect({ timeoutMs = 5000 } = {}) {
    this.ws = new WebSocket(this.url);

    const registerPayload = {
      type: 'register',
      clientId: this.clientId,
      role: this.role,
      labels: this.labels,
      tools: this.tools,
      intents: this.intents,
    };

    const registerPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.ws?.terminate();
        reject(new Error('Timed out connecting to bridge'));
      }, timeoutMs);

      this.ws.on('open', () => {
        this.ws.send(JSON.stringify(registerPayload));
      });

      this.ws.on('message', (data) => {
        try {
          const payload = JSON.parse(data.toString());
          if (payload.type === 'registered') {
            clearTimeout(timer);
            this.connected = true;
            resolve(payload);
          } else if (payload.type === 'envelope') {
            this.handlers.forEach((handler) => handler(payload.envelope));
          }
        } catch (_error) {
          // ignore malformed payloads for now
        }
      });

      this.ws.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });

    return registerPromise;
  }

  onEnvelope(handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  sendEnvelope(envelope) {
    if (!this.connected || !this.ws || this.ws.readyState !== 1) {
      throw new Error('Bridge client not connected');
    }
    const payload = {
      type: 'envelope',
      envelope: {
        ...envelope,
        from: envelope.from || this.clientId,
      },
    };
    this.ws.send(JSON.stringify(payload));
  }

  broadcast(payload) {
    this.sendEnvelope({ intent: 'agent.message', payload });
  }

  sendTo(targetId, payload, extras = {}) {
    this.sendEnvelope({ intent: 'agent.message', to: targetId, payload, ...extras });
  }

  close() {
    this.connected = false;
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function startCli() {
  const rl = readline.createInterface({ input, output, terminal: true });
  const client = new AIBridgeClient();

  console.log('========================================');
  console.log('  AI Bridge Agent Client');
  console.log(`  Agent ID: ${client.clientId}`);
  console.log(`  Role:     ${client.role}`);
  console.log('========================================\n');

  try {
    await client.connect();
    console.log(`[Bridge] Connected to ${client.url}`);
  } catch (error) {
    console.error(`Failed to connect: ${error.message}`);
    process.exit(1);
  }

  client.onEnvelope((envelope) => {
    console.log(`\n[${envelope.intent}] from ${envelope.from}:`);
    console.log(JSON.stringify(envelope.payload, null, 2));
    rl.prompt();
  });

  const promptLoop = async () => {
    const line = await rl.question(`${client.clientId}> `);
    const trimmed = line.trim();
    if (!trimmed) {
      return promptLoop();
    }

    if (trimmed === ':quit' || trimmed === ':exit') {
      client.close();
      rl.close();
      process.exit(0);
    }

    if (trimmed === ':help') {
      console.log('Commands:');
      console.log('  @<id> <message>  send direct message');
      console.log('  :quit            exit');
      console.log('  :help            show commands');
      return promptLoop();
    }

    if (trimmed.startsWith('@')) {
      const [targetToken, ...rest] = trimmed.split(' ');
      const targetId = targetToken.slice(1);
      const message = rest.join(' ');
      client.sendTo(targetId, { text: message });
    } else {
      client.broadcast({ text: trimmed });
    }

    return promptLoop();
  };

  promptLoop();
}

const modulePath = fileURLToPath(import.meta.url);
const scriptPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (scriptPath && modulePath === scriptPath) {
  startCli().catch((error) => {
    console.error('Fatal error in AI Bridge client:', error.message);
    process.exit(1);
  });
}
