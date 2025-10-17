import { test } from 'node:test';
import assert from 'node:assert';
import { ClaudeClient } from '../../src/claude-client.js';

test('ClaudeClient initialization', () => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  const client = new ClaudeClient();

  assert.strictEqual(client.model, 'claude-sonnet-4-5-20250929');
  assert.strictEqual(client.maxTokens, 4096);
  assert.strictEqual(client.temperature, 1.0);
});

test('ClaudeClient throws error without API key', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  assert.throws(() => new ClaudeClient(), /ANTHROPIC_API_KEY environment variable is required/);

  process.env.ANTHROPIC_API_KEY = originalKey;
});

test('ClaudeClient respects custom environment variables', () => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.MODEL = 'claude-3-opus-20240229';
  process.env.MAX_TOKENS = '2048';
  process.env.TEMPERATURE = '0.5';

  const client = new ClaudeClient();

  assert.strictEqual(client.model, 'claude-3-opus-20240229');
  assert.strictEqual(client.maxTokens, 2048);
  assert.strictEqual(client.temperature, 0.5);

  // Reset
  process.env.MODEL = 'claude-sonnet-4-5-20250929';
  process.env.MAX_TOKENS = '4096';
  process.env.TEMPERATURE = '1.0';
});
