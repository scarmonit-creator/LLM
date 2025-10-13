#!/usr/bin/env node
import WebSocket from 'ws';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Claude Bridge Client - Connects a Claude terminal to the bridge server
 * Enables this Claude instance to send/receive messages from other Claudes
 */

const BRIDGE_URL = process.env.BRIDGE_URL || 'ws://localhost:3456';
const CLIENT_ID = process.env.CLAUDE_CLIENT_ID || `claude-${randomUUID().substring(0, 8)}`;

class BridgeClient {
  constructor(url, clientId) {
    this.url = url;
    this.clientId = clientId;
    this.ws = null;
    this.connected = false;
    this.messageHandlers = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        console.log(`[Bridge] Connected to ${this.url}`);
        // Register with server
        this.ws.send(
          JSON.stringify({
            type: 'register',
            clientId: this.clientId,
          })
        );
      });

      this.ws.on('message', (data) => {
        try {
          const payload = JSON.parse(data.toString());

          if (payload.type === 'registered') {
            this.connected = true;
            console.log(`[Bridge] Registered as ${payload.clientId}`);
            console.log(`[Bridge] Connected clients: ${payload.connectedClients.join(', ')}`);
            if (payload.history.length > 0) {
              console.log(`[Bridge] Last ${payload.history.length} messages:`);
              payload.history.forEach((msg) => {
                console.log(`  [${msg.timestamp}] ${msg.from}: ${msg.message.substring(0, 60)}...`);
              });
            }
            resolve();
            return;
          }

          if (payload.type === 'error') {
            console.error(`[Bridge] Error: ${payload.error}`);
            return;
          }

          // Handle incoming messages
          if (payload.message) {
            this.messageHandlers.forEach((handler) => handler(payload));
          }
        } catch (error) {
          console.error('[Bridge] Error processing message:', error.message);
        }
      });

      this.ws.on('close', () => {
        this.connected = false;
        console.log('[Bridge] Disconnected from server');
      });

      this.ws.on('error', (error) => {
        console.error('[Bridge] Connection error:', error.message);
        reject(error);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Connection timeout'));
        }
      }, 5000);
    });
  }

  send(message, to = null) {
    if (!this.connected) {
      throw new Error('Not connected to bridge');
    }

    this.ws.send(
      JSON.stringify({
        type: 'message',
        message,
        to,
      })
    );
  }

  broadcast(message) {
    this.send(message, null);
  }

  onMessage(handler) {
    this.messageHandlers.push(handler);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }

  query() {
    if (!this.connected) {
      throw new Error('Not connected to bridge');
    }

    this.ws.send(
      JSON.stringify({
        type: 'query',
        limit: 50,
      })
    );
  }
}

async function main() {
  const rl = readline.createInterface({ input, output, terminal: true });

  console.log('========================================');
  console.log('  Claude Bridge Client');
  console.log(`  Client ID: ${CLIENT_ID}`);
  console.log('========================================\n');

  const client = new BridgeClient(BRIDGE_URL, CLIENT_ID);

  // Handle incoming messages
  client.onMessage((payload) => {
    console.log(`\n[${payload.from}] ${payload.message}\n`);
    rl.prompt();
  });

  try {
    await client.connect();
  } catch (error) {
    console.error(`Failed to connect: ${error.message}`);
    console.error('Make sure the bridge server is running: npm run bridge:server');
    process.exit(1);
  }

  console.log('\nCommands:');
  console.log('  @<id> <message>   Send direct message to client <id>');
  console.log('  @all <message>    Broadcast to all clients');
  console.log('  :clients          List connected clients');
  console.log('  :quit             Disconnect and exit\n');

  const shutdown = () => {
    console.log('\nDisconnecting...');
    client.disconnect();
    rl.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    console.log();
    shutdown();
  });

  while (true) {
    const inputLine = await rl.question(`${CLIENT_ID}> `);
    const trimmed = inputLine.trim();

    if (!trimmed) continue;

    // Handle commands
    if (trimmed.startsWith(':')) {
      const command = trimmed.slice(1).toLowerCase();
      switch (command) {
        case 'quit':
        case 'exit':
          shutdown();
          return;
        case 'clients':
          client.query();
          break;
        default:
          console.log(`Unknown command: ${command}`);
      }
      continue;
    }

    // Handle direct messages
    if (trimmed.startsWith('@')) {
      const spaceIdx = trimmed.indexOf(' ');
      if (spaceIdx === -1) {
        console.log('Usage: @<id> <message> or @all <message>');
        continue;
      }

      const target = trimmed.substring(1, spaceIdx);
      const message = trimmed.substring(spaceIdx + 1);

      try {
        if (target === 'all') {
          client.broadcast(message);
          console.log('[Sent to all]');
        } else {
          client.send(message, target);
          console.log(`[Sent to ${target}]`);
        }
      } catch (error) {
        console.error(`Error: ${error.message}`);
      }
      continue;
    }

    // Default: broadcast message
    try {
      client.broadcast(trimmed);
      console.log('[Broadcast]');
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
