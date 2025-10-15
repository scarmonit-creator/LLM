import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { spawn } from 'node:child_process';

describe('History Endpoint Integration Tests', () => {
  let serverProcess;
  const port = 3001;
  const baseUrl = `http://localhost:${port}`;

  before(async () => {
    // Start the server with PORT=3001
    return new Promise((resolve, reject) => {
      serverProcess = spawn('node', ['server.js'], {
        env: { ...process.env, PORT: port.toString() },
        stdio: 'pipe'
      });

      let startupOutput = '';
      
      const timeout = setTimeout(() => {
        reject(new Error('Server failed to start within 10 seconds'));
      }, 10000);

      serverProcess.stdout.on('data', (data) => {
        startupOutput += data.toString();
        if (startupOutput.includes('listening') || startupOutput.includes('started')) {
          clearTimeout(timeout);
          // Give it a moment to fully initialize
          setTimeout(resolve, 1000);
        }
      });

      serverProcess.stderr.on('data', (data) => {
        const errorMsg = data.toString();
        if (errorMsg.includes('EADDRINUSE')) {
          clearTimeout(timeout);
          reject(new Error(`Port ${port} is already in use (EADDRINUSE)`));
        }
      });

      serverProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill('SIGINT');
      // Wait for graceful shutdown
      return new Promise((resolve) => {
        serverProcess.on('exit', () => {
          resolve();
        });
        // Force kill after 5 seconds if graceful shutdown fails
        setTimeout(() => {
          serverProcess.kill('SIGKILL');
          resolve();
        }, 5000);
      });
    }
  });

  test('GET /history should return an array', async () => {
    const response = await fetch(`${baseUrl}/history`);
    assert.strictEqual(response.status, 200);
    
    const data = await response.json();
    assert.ok(Array.isArray(data), 'Response should be an array');
  });

  test('GET /history should return history entries with expected structure', async () => {
    const response = await fetch(`${baseUrl}/history`);
    const data = await response.json();
    
    // If there are entries, verify structure
    if (data.length > 0) {
      const entry = data[0];
      assert.ok('url' in entry || 'title' in entry || 'visitTime' in entry,
        'History entry should have expected fields');
    }
  });

  test('GET /history with limit parameter should work', async () => {
    const limit = 5;
    const response = await fetch(`${baseUrl}/history?limit=${limit}`);
    assert.strictEqual(response.status, 200);
    
    const data = await response.json();
    assert.ok(Array.isArray(data), 'Response should be an array');
    assert.ok(data.length <= limit, `Should return at most ${limit} entries`);
  });

  test('Server should start on specified PORT without EADDRINUSE', async () => {
    // This test verifies the server started successfully (checked in before hook)
    // If we got here, the server started without EADDRINUSE error
    assert.ok(true, 'Server started successfully on PORT 3001');
  });

  test('Server should handle requests without crashing', async () => {
    // Make multiple requests to ensure stability
    for (let i = 0; i < 3; i++) {
      const response = await fetch(`${baseUrl}/history`);
      assert.strictEqual(response.status, 200);
    }
  });
});
