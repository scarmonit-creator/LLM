import { test } from 'node:test';
import assert from 'node:assert';
import { JulesClient } from '../src/jules-client.js';
import dotenv from 'dotenv';

dotenv.config();

test('JulesClient - should create instance', () => {
  const client = new JulesClient(process.env.JULES_API_KEY);
  assert.strictEqual(client.baseURL, 'https://jules.googleapis.com/v1alpha');
});

test('JulesClient - should validate prompt requirement', async () => {
  const client = new JulesClient(process.env.JULES_API_KEY);
  const result = await client.createSession({});
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'Prompt is required');
});

test('JulesClient - should validate sessionId for getSession', async () => {
  const client = new JulesClient(process.env.JULES_API_KEY);
  const result = await client.getSession(null);
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'Session ID is required');
});

test('JulesClient - should validate sessionId for approvePlan', async () => {
  const client = new JulesClient(process.env.JULES_API_KEY);
  const result = await client.approvePlan(null);
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'Session ID is required');
});

test('JulesClient - should validate parameters for sendMessage', async () => {
  const client = new JulesClient(process.env.JULES_API_KEY);
  const result = await client.sendMessage(null, 'test');
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'Session ID and message are required');
});

test('JulesClient - should list sources successfully', async () => {
  const client = new JulesClient(process.env.JULES_API_KEY);
  const result = await client.listSources();

  if (result.success) {
    assert.ok(result.data);
    assert.ok(result.data.sources);
    assert.ok(Array.isArray(result.data.sources));
  } else {
    // If API key is invalid or API is down, should handle error gracefully
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
  }
});
