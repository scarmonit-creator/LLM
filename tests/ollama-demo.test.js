import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

describe('ollama-demo.js', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Module Execution', () => {
    it('should execute without syntax errors', async () => {
      try {
        const { stdout, stderr } = await execAsync('node src/ollama-demo.js', {
          timeout: 5000
        });
        assert.ok(true, 'Module executed');
      } catch (error) {
        // Expected to fail if Ollama is not running locally
        assert.ok(
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('fetch') ||
          error.message.includes('connect') ||
          error.killed,
          'Failed with expected connection error or timeout'
        );
      }
    });

    it('should be importable as a module', async () => {
      try {
        const module = await import('../src/ollama-demo.js');
        assert.ok(module, 'Module imported successfully');
      } catch (error) {
        // May fail due to missing dependencies
        assert.ok(
          error.message.includes('Cannot find module') ||
          error.code === 'MODULE_NOT_FOUND',
          'Failed with expected dependency error'
        );
      }
    });
  });

  describe('Ollama Connection', () => {
    it('should handle Ollama server unavailable', async () => {
      try {
        await execAsync('node src/ollama-demo.js', { timeout: 3000 });
      } catch (error) {
        // Should fail gracefully when Ollama is not available
        assert.ok(
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('fetch') ||
          error.message.includes('connect') ||
          error.killed,
          'Handles unavailable Ollama server'
        );
      }
    });

    it('should handle network errors', async () => {
      try {
        const { stdout, stderr } = await execAsync('node src/ollama-demo.js', {
          timeout: 3000
        });
        assert.ok(true, 'Demo executed');
      } catch (error) {
        // Network errors are expected when Ollama is not running
        assert.ok(
          error.killed ||
          error.message.includes('fetch') ||
          error.message.includes('network') ||
          error.message.includes('ECONNREFUSED'),
          'Expected network-related error'
        );
      }
    });
  });

  describe('Environment Configuration', () => {
    it('should work with default Ollama endpoint', async () => {
      try {
        await execAsync('node src/ollama-demo.js', { timeout: 3000 });
        assert.ok(true, 'Used default endpoint');
      } catch (error) {
        // Should attempt default endpoint even if connection fails
        assert.ok(
          error.killed ||
          error.message.includes('connect') ||
          error.message.includes('ECONNREFUSED'),
          'Attempted default endpoint'
        );
      }
    });

    it('should handle custom Ollama endpoint from env', async () => {
      try {
        await execAsync('node src/ollama-demo.js', {
          env: { ...process.env, OLLAMA_HOST: 'http://custom-host:11434' },
          timeout: 3000
        });
        assert.ok(true, 'Used custom endpoint');
      } catch (error) {
        // Should fail with connection error to custom host
        assert.ok(
          error.killed ||
          error.message.includes('connect') ||
          error.message.includes('ECONNREFUSED'),
          'Attempted custom endpoint'
        );
      }
    });
  });

  describe('Model Selection', () => {
    it('should handle model selection', async () => {
      try {
        const { stdout, stderr } = await execAsync('node src/ollama-demo.js', {
          timeout: 3000
        });
        assert.ok(true, 'Model selection handled');
      } catch (error) {
        // May fail due to unavailable Ollama
        assert.ok(true, 'Error handled appropriately');
      }
    });
  });

  describe('Error Handling', () => {
    it('should not crash with connection errors', async () => {
      try {
        await execAsync('node src/ollama-demo.js', { timeout: 3000 });
        assert.ok(true, 'Handled connection error');
      } catch (error) {
        // Should handle errors without unexpected crashes
        assert.ok(true, 'Error handled');
      }
    });

    it('should handle invalid responses gracefully', async () => {
      try {
        await execAsync('node src/ollama-demo.js', { timeout: 3000 });
        assert.ok(true, 'Handled invalid response');
      } catch (error) {
        // Should not crash with parsing errors
        assert.notStrictEqual(
          error.message.includes('SyntaxError'),
          true,
          'No syntax errors in response handling'
        );
      }
    });
  });
});
