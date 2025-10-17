import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';

import { createAIBridgeServer } from '../src/ai-bridge.js';

async function connectClient(port, registration = {}) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await once(ws, 'open');

  // Set up message handler BEFORE sending registration to avoid race condition
  const registrationPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('register timeout')), 5000);
    const handler = (raw) => {
      clearTimeout(timer);
      try {
        const payload = JSON.parse(raw.toString());
        if (payload.type !== 'registered') {
          reject(new Error('Unexpected registration response'));
          return;
        }
        ws.off('message', handler);
        ws.off('error', errorHandler);
        resolve(payload);
      } catch (error) {
        reject(error);
      }
    };
    const errorHandler = (error) => {
      clearTimeout(timer);
      ws.off('message', handler);
      reject(error);
    };
    ws.on('message', handler);
    ws.once('error', errorHandler);
  });

  // Now send registration
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

  await registrationPromise;
  return ws;
}

async function waitForEnvelope(ws, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', handler);
      reject(new Error('Timed out waiting for envelope'));
    }, timeoutMs);

    const handler = (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        // Support both old format {type: 'envelope', envelope: ...} and new format ['env', ...]
        let envelope;
        if (Array.isArray(payload) && payload[0] === 'env') {
          envelope = payload[1];
        } else if (payload.type === 'envelope') {
          envelope = payload.envelope;
        }

        if (envelope && predicate(envelope)) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(envelope);
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

    // Give the server a moment to queue the message
    await new Promise(resolve => setTimeout(resolve, 50));

    // Create a WebSocket and set up message listener BEFORE registration completes
    const ws = new WebSocket(`ws://127.0.0.1:${server.ports.ws}`);
    await once(ws, 'open');

    // Set up envelope listener immediately
    const envelopePromise = waitForEnvelope(
      ws,
      (msg) => msg.intent === 'task.assign' && msg.from === 'orchestrator',
      3000
    );

    // Now register (which triggers queued message delivery)
    ws.send(JSON.stringify({
      type: 'register',
      clientId: 'docs',
      role: 'documentation',
    }));

    // Wait for registration response
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('register timeout')), 5000);
      const handler = (raw) => {
        const payload = JSON.parse(raw.toString());
        if (payload.type === 'registered') {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve();
        }
      };
      ws.on('message', handler);
    });

    docAgent = ws;

    // Now wait for the queued envelope
    const envelope = await envelopePromise;

    assert.equal(envelope.payload.goal, 'Write documentation');
    assert.equal(envelope.to, 'docs');
  } finally {
    orchestrator?.close();
    docAgent?.close();
    await server.close();
  }
});
