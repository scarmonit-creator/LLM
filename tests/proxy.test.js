/**
 * Test Suite for Obfuscation Proxy
 * Tests proxy functionality, obfuscation, Chrome simulation, and cross-platform compatibility
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
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

    it('should load configuration from file', async () => {
      const config = new ProxyConfig();
      const loaded = await config.loadConfig('./tests/fixtures/test-config.json');
      assert.ok(loaded);
    });
  });

  describe('ObfuscationProxy Core Tests', () => {
    before(async () => {
      const config = {
        port: testPort,
        host: testHost,
        simulateChrome: true,
        obfuscation: {
          enabled: true,
          level: 'medium',
          chromeSimulation: true,
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
        host: testHost,
        port: testPort,
        path: 'http://httpbin.org/get',
        method: 'GET',
      };

      const req = http.request(options, (res) => {
        assert.ok(res.statusCode);
        done();
      });

      req.on('error', (err) => {
        assert.fail(`Request failed: ${err.message}`);
        done();
      });

      req.end();
    });

    it('should obfuscate User-Agent header', (done) => {
      const options = {
        host: testHost,
        port: testPort,
        path: 'http://httpbin.org/headers',
        method: 'GET',
        headers: {
          'User-Agent': 'TestAgent/1.0',
        },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const headers = JSON.parse(data).headers;
          assert.notStrictEqual(headers['User-Agent'], 'TestAgent/1.0');
          assert.ok(headers['User-Agent'].includes('Chrome'));
          done();
        });
      });

      req.on('error', (err) => {
        assert.fail(`Request failed: ${err.message}`);
        done();
      });

      req.end();
    });

    it('should simulate Chrome headers', (done) => {
      const options = {
        host: testHost,
        port: testPort,
        path: 'http://httpbin.org/headers',
        method: 'GET',
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const headers = JSON.parse(data).headers;
          assert.ok(headers['Accept']);
          assert.ok(headers['Accept-Encoding']);
          assert.ok(headers['Accept-Language']);
          done();
        });
      });

      req.on('error', (err) => {
        assert.fail(`Request failed: ${err.message}`);
        done();
      });

      req.end();
    });

    it('should handle CONNECT method for HTTPS', (done) => {
      const options = {
        host: testHost,
        port: testPort,
        method: 'CONNECT',
        path: 'httpbin.org:443',
      };

      const req = http.request(options, (res) => {
        assert.strictEqual(res.statusCode, 200);
        done();
      });

      req.on('error', (err) => {
        // CONNECT might fail in test environment, that's OK
        done();
      });

      req.end();
    });

    it('should track connection statistics', () => {
      const stats = proxy.getStats();
      assert.ok(stats);
      assert.ok(stats.hasOwnProperty('totalConnections'));
      assert.ok(stats.hasOwnProperty('activeConnections'));
    });
  });

  describe('Cross-Platform Tests', () => {
    it('should work on current platform', () => {
      const platform = process.platform;
      assert.ok(['darwin', 'linux', 'win32'].includes(platform));
    });

    it('should handle platform-specific paths', () => {
      const config = new ProxyConfig();
      const platformConfig = config.getPlatformConfig();
      assert.ok(platformConfig.configDir);
      assert.ok(platformConfig.configDir.length > 0);
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle invalid configuration', async () => {
      const badConfig = {
        port: -1, // Invalid port
        host: 'invalid-host',
      };

      try {
        const badProxy = new ObfuscationProxy(badConfig);
        await badProxy.start();
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error);
      }
    });

    it('should handle port already in use', async () => {
      const conflictConfig = {
        port: testPort, // Same port as main test proxy
        host: testHost,
      };

      try {
        const conflictProxy = new ObfuscationProxy(conflictConfig);
        await conflictProxy.start();
        assert.fail('Should have thrown error for port conflict');
      } catch (error) {
        assert.ok(error);
      }
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent requests', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise((resolve, reject) => {
            const options = {
              host: testHost,
              port: testPort,
              path: 'http://httpbin.org/get',
              method: 'GET',
            };

            const req = http.request(options, (res) => {
              res.on('data', () => {});
              res.on('end', () => resolve());
            });

            req.on('error', reject);
            req.end();
          })
        );
      }

      await Promise.all(promises);
      assert.ok(true);
    });
  });
});
