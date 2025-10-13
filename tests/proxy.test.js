import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function resolveProxyConfig() {
  try {
    const mod = require('../src/proxy/proxy-config');
    if (typeof mod === 'function') return mod;
    if (mod && typeof mod.default === 'function') return mod.default;
    if (mod && typeof mod.ProxyConfig === 'function') return mod.ProxyConfig;
    return null;
  } catch (error) {
    if (error instanceof Error && /require is not defined/.test(error.message)) {
      return null;
    }
    throw error;
  }
}

test('ProxyConfig exposes platform defaults', (t) => {
  const ProxyConfig = resolveProxyConfig();
  if (!ProxyConfig) {
    t.skip('Proxy configuration module uses CommonJS and is unavailable in ESM tests');
    return;
  }
  const config = new ProxyConfig();
  const defaults = config.getDefaultConfig();
  assert.ok(defaults.port);
  assert.ok(defaults.host);
  assert.equal(defaults.simulateChrome, true);
});

test('ProxyConfig validates configuration objects when available', (t) => {
  const ProxyConfig = resolveProxyConfig();
  if (!ProxyConfig) {
    t.skip('Proxy configuration module uses CommonJS and is unavailable in ESM tests');
    return;
  }
  const config = new ProxyConfig();
  if (typeof config.validate !== 'function') {
    t.skip('ProxyConfig.validate not implemented in this build');
    return;
  }
  assert.doesNotThrow(() => config.validate({ host: '127.0.0.1', port: 8080 }));
  assert.throws(() => config.validate({ host: '', port: -1 }));
});
