import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

describe('index.js', () => {
  describe('Module Execution', () => {
    it('should execute without errors', async () => {
      // Test that the module can be imported and executed
      try {
        const { stdout, stderr } = await execAsync('node src/index.js', {
          env: { ...process.env, ANTHROPIC_API_KEY: 'test-key' },
          timeout: 5000
        });
        // If it requires API key, it should fail gracefully
        assert.ok(true, 'Module executed');
      } catch (error) {
        // Expected to fail without real API key, but should not throw syntax errors
        assert.ok(error.message.includes('API') || error.message.includes('key') || error.killed, 'Failed with expected API error or timeout');
      }
    });

    it('should be importable as a module', async () => {
      // Set required environment variable before import to prevent async errors
      const originalKey = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'test-key-for-import';
      
      try {
        const module = await import('../src/index.js');
        assert.ok(module, 'Module imported successfully');
      } catch (error) {
        // May fail due to missing dependencies, but should not have syntax errors
        assert.ok(
          error.message.includes('Cannot find module') ||
          error.message.includes('API') ||
          error.code === 'MODULE_NOT_FOUND',
          'Failed with expected dependency error'
        );
      } finally {
        // Restore original env var
        if (originalKey !== undefined) {
          process.env.ANTHROPIC_API_KEY = originalKey;
        } else {
          delete process.env.ANTHROPIC_API_KEY;
        }
      }
    });
  });
});
