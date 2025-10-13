import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { setTimeout as delay } from 'node:timers/promises';

import { createBridgeServer } from '../src/claude-bridge.js';

const silentLogger = {
  log: () => {},
  error: () => {},
};

async function waitForMessage(ws, predicate = () => true, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    let timer;

    const handleError = (error) => {
      clearTimeout(timer);
      ws.off('message', handler);
      ws.off('error', handleError);
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const handler = (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        if (predicate(payload)) {
          clearTimeout(timer);
          ws.off('message', handler);
          ws.off('error', handleError);
          resolve(payload);
        }
      } catch (error) {
        clearTimeout(timer);
        ws.off('message', handler);
        ws.off('error', handleError);
        reject(error);
      }
    };

    timer = setTimeout(() => {
      ws.off('message', handler);
      ws.off('error', handleError);
      reject(new Error('Timed out waiting for message'));
    }, timeoutMs);

    ws.on('message', handler);
    ws.once('error', handleError);
  });
}

async function registerClient(port, clientId) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await once(ws, 'open');
  ws.send(
    JSON.stringify({
      type: 'register',
      clientId,
    }),
  );

  const pending = [];
  await waitForMessage(ws, (payload) => {
    if (payload.type === 'registered') {
      return true;
    }
    pending.push(payload);
    return false;
  });

  return { ws, pending };
}

test('broadcast delivers messages to all other connected clients', async () => {
  const server = await createBridgeServer({ wsPort: 0, httpPort: 0, logger: silentLogger });
  let clientA;
  let clientB;

  try {
    ({ ws: clientA } = await registerClient(server.ports.ws, 'claude-a'));
    ({ ws: clientB } = await registerClient(server.ports.ws, 'claude-b'));

    const messagePromise = waitForMessage(
      clientB,
      (payload) => payload.message === 'Hello from A' && payload.from === 'claude-a',
    );

    clientA.send(
      JSON.stringify({
        type: 'message',
        message: 'Hello from A',
      }),
    );

    const payload = await messagePromise;
    assert.equal(payload.from, 'claude-a');
    assert.equal(payload.message, 'Hello from A');
  } finally {
    clientA?.terminate();
    clientB?.terminate();
    await server.close();
  }
});

test('direct messages queue for offline recipients and flush on reconnect', async () => {
  const server = await createBridgeServer({ wsPort: 0, httpPort: 0, logger: silentLogger });
  let clientA;
  let clientC;
  let pending;

  try {
    ({ ws: clientA } = await registerClient(server.ports.ws, 'claude-a'));

    clientA.send(
      JSON.stringify({
        type: 'message',
        to: 'claude-c',
        message: 'Queued hello',
      }),
    );

    await delay(50);

    ({ ws: clientC, pending } = await registerClient(server.ports.ws, 'claude-c'));

    let payload = pending.find((msg) => msg.message === 'Queued hello' && msg.from === 'claude-a');
    if (!payload) {
      payload = await waitForMessage(
        clientC,
        (msg) => msg.message === 'Queued hello' && msg.from === 'claude-a',
      );
    }

    assert.ok(payload, 'Expected queued message to arrive');
    assert.equal(payload.from, 'claude-a');
    assert.equal(payload.to, 'claude-c');
    assert.equal(payload.message, 'Queued hello');
  } finally {
    clientA?.terminate();
    clientC?.terminate();
    await server.close();
  }
});
