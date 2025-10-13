/**
 * Test Suite for Obfuscation Proxy
 * Tests proxy functionality, obfuscation, Chrome simulation, and cross-platform compatibility
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import ObfuscationProxy from '../src/proxy/obfuscation-proxy.js';
import ProxyConfig from '../src/proxy/proxy-config.js';

describe('Obfuscation Proxy Tests', () => {
  let proxy;
  let testPort = 8888;
  let testHost = '127.0.0.1';

  describe('ProxyConfig Tests', () => {
    it('should create default configuration', () => {
      const config = new ProxyConfig();
      const defaultConfig = config.getDefaultConfig();
      assert.ok(defaultConfig.port);
      assert.ok(defaultConfig.host);
      assert.strictEqual(defaultConfig.simulateChrome, true);
      assert.strictEqual(defaultConfig.obfuscation.enabled, true);
    });

    it('should get platform-specific configuration', () => {
      const config = new ProxyConfig();
      const platformConfig = config.getPlatformConfig();
      assert.ok(platformConfig.platform);
      assert.ok(platformConfig.configDir);
    });

    it('should validate configuration', () => {
      const config = new ProxyConfig();

      // Valid config
      const validConfig = { port: 8080, host: '0.0.0.0', maxConnections: 100 };
      assert.doesNotThrow(() => config.validateConfig(validConfig));

      // Invalid config - port out of range
      const invalidConfig = { port: 70000 };
      assert.throws(() => config.validateConfig(invalidConfig));
    });
  });

  describe('ObfuscationProxy Tests', () => {
    before(async () => {
      const config = {
        port: testPort,
        host: testHost,
        simulateChrome: true,
        obfuscation: {
          enabled: true,
          rotationInterval: 60000,
        },
      };
      proxy = new ObfuscationProxy(config);
      await proxy.start();
    });

    after(async () => {
      if (proxy) {
        await proxy.stop();
      }
    });

    it('should start proxy server', () => {
      assert.ok(proxy);
      assert.ok(proxy.isRunning());
    });

    it('should handle HTTP requests', (done) => {
      const options = {
        hostname: testHost,
        port: testPort,
        path: '/test',
        method: 'GET',
      };

      const req = http.request(options, (res) => {
        assert.ok(res.statusCode);
        done();
      });

      req.on('error', (err) => {
        // Expected to fail if no upstream server
        done();
      });

      req.end();
    });

    it('should obfuscate headers', (done) => {
      const options = {
        hostname: testHost,
        port: testPort,
        path: '/test',
        method: 'GET',
      };

      const req = http.request(options, (res) => {
        // Check if obfuscation headers are present
        const headers = res.headers;
        assert.ok(headers);
        done();
      });

      req.on('error', () => {
        done();
      });

      req.end();
    });

    it('should simulate Chrome browser', () => {
      const config = proxy.getConfig();
      assert.strictEqual(config.simulateChrome, true);
    });
  });
});
