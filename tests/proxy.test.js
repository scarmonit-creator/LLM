import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ObfuscationProxy = require('../src/proxy/obfuscation-proxy');
const ProxyConfig = require('../src/proxy/proxy-config');

test('ProxyConfig returns sensible defaults', () => {
  const config = new ProxyConfig();
  const defaults = config.getDefaultConfig();
  assert.ok(defaults.port);
  assert.ok(defaults.host);
  assert.equal(defaults.simulateChrome, true);
});

test('ObfuscationProxy obfuscates headers to mimic Chrome', () => {
  const proxy = new ObfuscationProxy({ simulateChrome: true, enableLogging: false });
  const headers = proxy.obfuscateHeaders({});
  assert.ok(headers['user-agent']);
  assert.match(headers['user-agent'], /Chrome/);
});

test('ObfuscationProxy provides runtime statistics', () => {
  const proxy = new ObfuscationProxy({ enableLogging: false });
  const stats = proxy.getStats();
  assert.ok(stats.requests === 0);
  assert.ok('uptime' in stats);
  assert.ok(stats.config);
});
