import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';

import { createAIBridgeServer } from '../src/ai-bridge.js';

async function connectClient(port, registration = {}) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await once(ws, 'open');
  ws.send(
    JSON.stringify({
      type: 'register',
      clientId: registration.clientId,
      role: registration.role,
      labels: registration.labels,
      tools: registration.tools,
      intents: registration.intents,
    })
  );

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('register timeout')), 2000);
    ws.once('message', (raw) => {
      clearTimeout(timer);
      const payload = JSON.parse(raw.toString());
      if (payload.type !== 'registered') {
        reject(new Error('Unexpected registration response'));
        return;
      }
      resolve(payload);
    });
    ws.once('error', reject);
  });

  return ws;
}

async function waitForEnvelope(ws, predicate, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', handler);
      reject(new Error('Timed out waiting for envelope'));
    }, timeoutMs);

    const handler = (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        if (payload.type === 'envelope' && predicate(payload.envelope)) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(payload.envelope);
        }
      } catch (error) {
        clearTimeout(timer);
        ws.off('message', handler);
        reject(error);
      }
    };

    ws.on('message', handler);
  });
}

test('broadcast envelopes reach all connected agents', async () => {
  const server = await createAIBridgeServer({
    wsPort: 0,
    httpPort: 0,
    historyLimit: 50,
    logger: { log: () => {}, error: () => {} },
  });
  let coder;
  let reviewer;

  try {
    coder = await connectClient(server.ports.ws, { clientId: 'coder', role: 'coder' });
    reviewer = await connectClient(server.ports.ws, { clientId: 'reviewer', role: 'reviewer' });

    coder.send(
      JSON.stringify({
        type: 'envelope',
        envelope: {
          intent: 'task.update',
          taskId: 'task-1',
          payload: { summary: 'Draft created' },
          from: 'coder',
        },
      })
    );

    const envelope = await waitForEnvelope(
      reviewer,
      (msg) => msg.intent === 'task.update' && msg.from === 'coder'
    );

    assert.equal(envelope.taskId, 'task-1');
    assert.equal(envelope.payload.summary, 'Draft created');
    assert.equal(envelope.to, null);

    const historyResponse = await fetch(
      `http://127.0.0.1:${server.ports.http}/history?limit=5`
    ).then((res) => res.json());
    assert.equal(historyResponse.history.at(-1).intent, 'task.update');
  } finally {
    coder?.close();
    reviewer?.close();
    await server.close();
  }
});

test('direct envelopes queue for offline agents', async () => {
  const server = await createAIBridgeServer({
    wsPort: 0,
    httpPort: 0,
    historyLimit: 50,
    logger: { log: () => {}, error: () => {} },
  });
  let orchestrator;
  let docAgent;

  try {
    orchestrator = await connectClient(server.ports.ws, {
      clientId: 'orchestrator',
      role: 'orchestrator',
    });

    orchestrator.send(
      JSON.stringify({
        type: 'envelope',
        envelope: {
          intent: 'task.assign',
          taskId: 'task-2',
          to: 'docs',
          payload: { goal: 'Write documentation' },
          from: 'orchestrator',
        },
      })
    );

    docAgent = await connectClient(server.ports.ws, { clientId: 'docs', role: 'documentation' });
    const envelope = await waitForEnvelope(
      docAgent,
      (msg) => msg.intent === 'task.assign' && msg.from === 'orchestrator'
    );

    assert.equal(envelope.payload.goal, 'Write documentation');
    assert.equal(envelope.to, 'docs');
  } finally {
    orchestrator?.close();
    docAgent?.close();
    await server.close();
  }
});
