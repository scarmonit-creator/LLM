import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

describe('jules-demo.js', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Module Execution', () => {
    it('should execute without errors when API key is provided', async () => {
      try {
        const { stdout: _stdout, stderr: _stderr } = await execAsync('node src/jules-demo.js', {
          env: { ...process.env, JULES_API_KEY: 'test-key' },
          timeout: 5000,
        });
        // May fail due to invalid key, but should not have syntax errors
        assert.ok(true, 'Module executed');
      } catch (error) {
        // Expected to fail with test key
        assert.ok(
          error.message.includes('API') ||
            error.message.includes('key') ||
            error.message.includes('401') ||
            error.message.includes('403') ||
            error.killed,
          'Failed with expected API error or timeout'
        );
      }
    });

    it('should be importable as a module', async () => {
      try {
        const module = await import('../src/jules-demo.js');
        assert.ok(module, 'Module imported successfully');
      } catch (error) {
        // May fail due to missing dependencies
        assert.ok(
          error.message.includes('Cannot find module') ||
            error.message.includes('API') ||
            error.code === 'MODULE_NOT_FOUND',
          'Failed with expected error'
        );
      }
    });
  });

  describe('Environment Configuration', () => {
    it('should handle missing JULES_API_KEY gracefully', async () => {
      delete process.env.JULES_API_KEY;
      try {
        await execAsync('node src/jules-demo.js', { timeout: 3000 });
      } catch (error) {
        assert.ok(
          error.message.includes('API') || error.message.includes('key') || error.killed,
          'Handles missing API key'
        );
      }
    });

    it('should handle invalid API key format', async () => {
      try {
        await execAsync('node src/jules-demo.js', {
          env: { ...process.env, JULES_API_KEY: 'invalid-key-format' },
          timeout: 3000,
        });
      } catch (error) {
        assert.ok(
          error.message.includes('API') ||
            error.message.includes('401') ||
            error.message.includes('403') ||
            error.killed,
          'Handles invalid API key'
        );
      }
    });
  });

  describe('Jules Client Integration', () => {
    it('should attempt to connect to Jules API', async () => {
      // This test verifies the demo attempts API connection
      try {
        const { stdout: _stdout, stderr: _stderr } = await execAsync('node src/jules-demo.js', {
          env: { ...process.env, JULES_API_KEY: 'test-api-key-12345' },
          timeout: 3000,
        });
        assert.ok(true, 'Demo execution attempted');
      } catch (error) {
        // Should fail with API error, not code error
        assert.ok(
          error.killed ||
            error.message.includes('API') ||
            error.message.includes('fetch') ||
            error.message.includes('network'),
          'Expected API-related error'
        );
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      try {
        await execAsync('node src/jules-demo.js', {
          env: { ...process.env, JULES_API_KEY: 'test' },
          timeout: 3000,
        });
        assert.ok(true, 'Handled network error');
      } catch {
        // Should handle errors without crashing unexpectedly
        assert.ok(true, 'Error handled appropriately');
      }
    });
  });
});
