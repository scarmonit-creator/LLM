/**
 * Test Suite for Obfuscation Proxy
 * Tests proxy functionality, obfuscation, Chrome simulation, and cross-platform compatibility
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const https = require('https');
const ObfuscationProxy = require('../src/proxy/obfuscation-proxy');
const ProxyConfig = require('../src/proxy/proxy-config');

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
      const validResult = config.validateConfig(validConfig);
      assert.strictEqual(validResult.valid, true);
      assert.strictEqual(validResult.errors.length, 0);

      // Invalid config - bad port
      const invalidConfig = { port: 99999, host: '0.0.0.0' };
      const invalidResult = config.validateConfig(invalidConfig);
      assert.strictEqual(invalidResult.valid, false);
      assert.ok(invalidResult.errors.length > 0);
    });

    it('should merge configurations', () => {
      const config = new ProxyConfig();
      const userConfig = {
        port: 9090,
        simulateChrome: false,
      };

      const merged = config.mergeConfig(userConfig);
      assert.strictEqual(merged.port, 9090);
      assert.strictEqual(merged.simulateChrome, false);
      assert.ok(merged.obfuscation); // Should still have default obfuscation config
    });

    it('should provide preset configurations', () => {
      const config = new ProxyConfig();

      const stealthConfig = config.getPresetConfig('stealth');
      assert.strictEqual(stealthConfig.simulateChrome, true);
      assert.strictEqual(stealthConfig.obfuscation.enabled, true);
      assert.strictEqual(stealthConfig.enableLogging, false);

      const perfConfig = config.getPresetConfig('performance');
      assert.strictEqual(perfConfig.maxConnections, 200);

      const devConfig = config.getPresetConfig('development');
      assert.strictEqual(devConfig.obfuscation.enabled, false);
    });
  });

  describe('ObfuscationProxy Core Tests', () => {
    before(async () => {
      // Create proxy instance for testing
      proxy = new ObfuscationProxy({
        port: testPort,
        host: testHost,
        enableLogging: false,
      });
    });

    after(async () => {
      // Clean up
      if (proxy) {
        await proxy.stop();
      }
    });

    it('should create proxy instance', () => {
      assert.ok(proxy);
      assert.strictEqual(proxy.config.port, testPort);
      assert.strictEqual(proxy.config.host, testHost);
    });

    it('should generate obfuscation key', () => {
      const key = ObfuscationProxy.generateKey();
      assert.ok(key);
      assert.strictEqual(typeof key, 'string');
      assert.strictEqual(key.length, 64); // 32 bytes = 64 hex chars
    });

    it('should obfuscate data', () => {
      const testData = Buffer.from('Hello, World!');
      const obfuscated = proxy.obfuscateData(testData);

      assert.ok(Buffer.isBuffer(obfuscated));
      assert.strictEqual(obfuscated.length, testData.length);

      // Obfuscated data should be different from original
      // (unless obfuscationKey is not set)
      if (proxy.config.obfuscationKey) {
        assert.notDeepStrictEqual(obfuscated, testData);
      }
    });

    it('should obfuscate headers for Chrome simulation', () => {
      const headers = {
        'user-agent': 'Test Agent',
        host: 'example.com',
      };

      const obfuscated = proxy.obfuscateHeaders(headers);

      assert.ok(obfuscated['user-agent']);
      assert.ok(obfuscated['user-agent'].includes('Chrome'));
      assert.ok(obfuscated['accept']);
      assert.ok(obfuscated['sec-ch-ua']);
      assert.ok(obfuscated['sec-fetch-dest']);
    });

    it('should start and stop proxy server', async () => {
      // Start proxy
      await proxy.start();
      assert.ok(proxy.server);
      assert.ok(proxy.server.listening);

      // Get stats
      const stats = proxy.getStats();
      assert.ok(stats);
      assert.strictEqual(stats.requests, 0);
      assert.strictEqual(stats.activeConnections, 0);

      // Stop proxy
      await proxy.stop();
      assert.strictEqual(proxy.server.listening, false);
    });
  });

  describe('Proxy Functionality Tests', () => {
    let testServer;
    let testServerPort = 9999;

    before(async () => {
      // Create a simple test HTTP server
      testServer = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Test response from server');
      });

      await new Promise((resolve) => {
        testServer.listen(testServerPort, resolve);
      });

      // Start proxy
      proxy = new ObfuscationProxy({
        port: testPort,
        host: testHost,
        enableLogging: false,
      });

      await proxy.start();
    });

    after(async () => {
      // Clean up
      if (proxy) {
        await proxy.stop();
      }
      if (testServer) {
        await new Promise((resolve) => {
          testServer.close(resolve);
        });
      }
    });

    it('should proxy HTTP requests', (done) => {
      const options = {
        hostname: testHost,
        port: testPort,
        path: `http://localhost:${testServerPort}/`,
        method: 'GET',
      };

      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          assert.ok(data);
          done();
        });
      });

      req.on('error', (err) => {
        done(err);
      });

      req.end();
    });

    it('should track statistics', async () => {
      const stats = proxy.getStats();
      assert.ok(stats);
      assert.ok(stats.requests >= 0);
      assert.ok(stats.bytesTransferred >= 0);
      assert.ok(stats.uptime >= 0);
      assert.ok(stats.config);
      assert.strictEqual(stats.config.port, testPort);
    });
  });

  describe('Cross-Platform Tests', () => {
    it('should detect current platform', () => {
      const config = new ProxyConfig();
      assert.ok(config.platform);
      assert.ok(
        ['win32', 'darwin', 'linux', 'android'].includes(config.platform) ||
          config.platform.startsWith('linux')
      );
    });

    it('should provide platform-specific config directory', () => {
      const config = new ProxyConfig();
      const configDir = config.getConfigDirectory();
      assert.ok(configDir);
      assert.ok(typeof configDir === 'string');
    });
  });

  describe('Security Tests', () => {
    it('should remove proxy-specific headers', () => {
      const headers = {
        'user-agent': 'Test',
        'proxy-connection': 'keep-alive',
        'proxy-authorization': 'Basic abc123',
      };

      const proxy = new ObfuscationProxy({ enableLogging: false });
      const cleaned = proxy.obfuscateHeaders(headers);

      assert.ok(!cleaned['proxy-connection']);
      assert.ok(!cleaned['proxy-authorization']);
    });

    it('should generate unique obfuscation keys', () => {
      const key1 = ObfuscationProxy.generateKey();
      const key2 = ObfuscationProxy.generateKey();

      assert.notStrictEqual(key1, key2);
    });
  });
});

console.log('\n🧪 Running Obfuscation Proxy Tests...');
console.log('━'.repeat(60));
console.log('✅ All proxy tests configured');
console.log('📊 Testing cross-platform support, obfuscation, and Chrome simulation');
console.log('━'.repeat(60));
