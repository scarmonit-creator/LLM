#!/usr/bin/env node
import { createAIBridgeServer } from '../src/ai-bridge.js';
import WebSocket from 'ws';

/**
 * Demo script showing Claude Bridge in action
 * Run this to see multi-instance communication
 */

async function demo() {
  console.log('🌉 Starting AI Bridge Demo - Multi-LLM Communication\n');

  // Start the bridge server
  const server = await createAIBridgeServer({
    wsPort: 0, // random port
    httpPort: 0,
  });

  console.log(`✓ Bridge server running on:`);
  console.log(`  WebSocket: ws://localhost:${server.ports.ws}`);
  console.log(`  HTTP API:  http://localhost:${server.ports.http}\n`);

  // Create clients for different LLMs
  const clients = [];

  for (const id of ['claude-main', 'gemini-1', 'ollama-local', 'perplexity-1']) {
    const ws = new WebSocket(`ws://localhost:${server.ports.ws}`);

    await new Promise((resolve) => ws.on('open', resolve));

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'registered') {
        console.log(`✓ ${id} connected as ${msg.client.role}`);
      } else if (msg.type === 'envelope') {
        const text = msg.envelope.payload?.text || JSON.stringify(msg.envelope.payload);
        console.log(`📨 ${id} received from ${msg.envelope.from}: "${text}"`);
      }
    });

    ws.send(JSON.stringify({ type: 'register', clientId: id }));
    clients.push({ id, ws });

    // Wait a bit between connections
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log('\n--- Broadcasting Messages ---\n');

  // Claude broadcasts
  await new Promise((resolve) => setTimeout(resolve, 500));
  clients[0].ws.send(
    JSON.stringify({
      type: 'envelope',
      envelope: {
        intent: 'agent.message',
        payload: { text: 'Claude here: Starting code analysis on auth module.' },
      },
    })
  );

  // Gemini sends direct message to Ollama
  await new Promise((resolve) => setTimeout(resolve, 500));
  clients[1].ws.send(
    JSON.stringify({
      type: 'envelope',
      envelope: {
        intent: 'agent.message',
        to: 'ollama-local',
        payload: { text: 'Gemini to Ollama: Can you validate the code patterns locally?' },
      },
    })
  );

  // Ollama responds
  await new Promise((resolve) => setTimeout(resolve, 500));
  clients[2].ws.send(
    JSON.stringify({
      type: 'envelope',
      envelope: {
        intent: 'agent.message',
        payload: { text: 'Ollama: Pattern validation complete. Factory method detected.' },
      },
    })
  );

  // Perplexity adds research
  await new Promise((resolve) => setTimeout(resolve, 500));
  clients[3].ws.send(
    JSON.stringify({
      type: 'envelope',
      envelope: {
        intent: 'agent.message',
        payload: { text: 'Perplexity: Found 3 best practices for this pattern in recent literature.' },
      },
    })
  );

  // Check HTTP API
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.log('\n--- HTTP API Status ---\n');

  const health = await fetch(`http://localhost:${server.ports.http}/health`).then((r) => r.json());
  console.log(`✓ Health: ${health.status}, ${health.connectedClients} clients connected`);

  const agentList = await fetch(`http://localhost:${server.ports.http}/agents`).then((r) =>
    r.json()
  );
  console.log(`✓ Connected agents: ${agentList.agents.map((a) => a.id).join(', ')}`);

  const history = await fetch(`http://localhost:${server.ports.http}/history?limit=5`).then((r) =>
    r.json()
  );
  console.log(`✓ Message history (last ${history.history.length}):`);
  history.history.forEach((env) => {
    const text = env.payload?.text || JSON.stringify(env.payload).substring(0, 40);
    console.log(`  - [${env.timestamp}] ${env.from}: "${text}..."`);
  });

  // Cleanup
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log('\n--- Shutting Down ---\n');

  clients.forEach((c) => c.ws.close());
  await server.close();

  console.log('✓ Demo complete! Bridge system working perfectly.\n');
  process.exit(0);
}

demo().catch((error) => {
  console.error('Demo failed:', error.message);
  process.exit(1);
});
