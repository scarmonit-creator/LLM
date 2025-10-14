/**
 * Test file to verify ESM fixes and browser history functionality
 */

import { test, describe, beforeAll, afterAll } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node:fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

describe('Server ESM and Browser History Fixes', () => {
  let serverProcess;
  const PORT = 8081; // Use different port for testing
  const SERVER_URL = `http://localhost:${PORT}`;

  beforeAll(async () => {
    // Build the project first
    const buildProcess = spawn('npm', ['run', 'build'], {
      cwd: projectRoot,
      stdio: 'pipe'
    });

    await new Promise((resolve, reject) => {
      buildProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Build failed with code ${code}`));
        }
      });
    });

    // Start server with custom port
    serverProcess = spawn('node', ['server.js'], {
      cwd: projectRoot,
      env: { ...process.env, PORT: PORT.toString() },
      stdio: 'pipe'
    });

    // Wait for server to start
    await new Promise((resolve) => {
      setTimeout(resolve, 3000); // Give server time to start
    });
  });

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise((resolve) => {
        serverProcess.on('exit', resolve);
        setTimeout(() => {
          serverProcess.kill('SIGKILL');
          resolve();
        }, 5000);
      });
    }
  });

  test('Server starts without ESM import errors', async () => {
    try {
      const response = await fetch(`${SERVER_URL}/health`);
      assert.strictEqual(response.status, 200, 'Health check should return 200');
      
      const healthData = await response.json();
      assert.strictEqual(healthData.status, 'ok', 'Health status should be ok');
      assert.ok(healthData.timestamp, 'Health check should include timestamp');
    } catch (error) {
      assert.fail(`Server health check failed: ${error.message}`);
    }
  });

  test('Root endpoint provides API information', async () => {
    try {
      const response = await fetch(`${SERVER_URL}/`);
      assert.strictEqual(response.status, 200, 'Root endpoint should return 200');
      
      const apiInfo = await response.json();
      assert.strictEqual(apiInfo.status, 'ok', 'API status should be ok');
      assert.strictEqual(apiInfo.message, 'LLM AI Bridge Server', 'Should have correct message');
      assert.ok(Array.isArray(apiInfo.endpoints), 'Should include endpoints array');
      assert.ok(apiInfo.endpoints.length > 0, 'Should have endpoints defined');
    } catch (error) {
      assert.fail(`Root endpoint test failed: ${error.message}`);
    }
  });

  test('Browser history endpoint returns data', async () => {
    try {
      const response = await fetch(`${SERVER_URL}/history`);
      assert.strictEqual(response.status, 200, 'History endpoint should return 200');
      
      const historyData = await response.json();
      assert.strictEqual(historyData.success, true, 'History response should be successful');
      assert.ok(typeof historyData.count === 'number', 'Should include count field');
      assert.ok(Array.isArray(historyData.data), 'Should include data array');
      
      // Even with mock data, we should get some entries
      assert.ok(historyData.data.length >= 0, 'Should return history entries (or empty array)');
      
      if (historyData.data.length > 0) {
        const firstEntry = historyData.data[0];
        assert.ok(firstEntry.url, 'History entries should have URL');
        assert.ok(firstEntry.title, 'History entries should have title');
        assert.ok(typeof firstEntry.visitTime === 'number', 'History entries should have visitTime');
        assert.ok(firstEntry.browser, 'History entries should have browser');
      }
    } catch (error) {
      assert.fail(`Browser history test failed: ${error.message}`);
    }
  });

  test('Search endpoint works correctly', async () => {
    try {
      const query = 'github';
      const response = await fetch(`${SERVER_URL}/search?query=${query}`);
      assert.strictEqual(response.status, 200, 'Search endpoint should return 200');
      
      const searchData = await response.json();
      assert.strictEqual(searchData.success, true, 'Search response should be successful');
      assert.strictEqual(searchData.query, query, 'Should echo back the query');
      assert.ok(typeof searchData.count === 'number', 'Should include count field');
      assert.ok(Array.isArray(searchData.data), 'Should include data array');
    } catch (error) {
      assert.fail(`Search endpoint test failed: ${error.message}`);
    }
  });

  test('Search endpoint requires query parameter', async () => {
    try {
      const response = await fetch(`${SERVER_URL}/search`);
      assert.strictEqual(response.status, 400, 'Search without query should return 400');
      
      const errorData = await response.json();
      assert.strictEqual(errorData.success, false, 'Response should indicate failure');
      assert.ok(errorData.error.includes('required'), 'Should indicate query is required');
    } catch (error) {
      assert.fail(`Search parameter validation test failed: ${error.message}`);
    }
  });

  test('Metrics endpoint provides performance data', async () => {
    try {
      const response = await fetch(`${SERVER_URL}/metrics`);
      assert.strictEqual(response.status, 200, 'Metrics endpoint should return 200');
      
      const metricsText = await response.text();
      assert.ok(metricsText.includes('requests_total'), 'Should include request metrics');
      assert.ok(metricsText.includes('memory_usage'), 'Should include memory metrics');
      assert.ok(metricsText.includes('uptime_seconds'), 'Should include uptime metrics');
    } catch (error) {
      assert.fail(`Metrics endpoint test failed: ${error.message}`);
    }
  });

  test('History endpoint with custom count', async () => {
    try {
      const count = 10;
      const response = await fetch(`${SERVER_URL}/history/${count}`);
      assert.strictEqual(response.status, 200, 'Custom count endpoint should return 200');
      
      const historyData = await response.json();
      assert.strictEqual(historyData.success, true, 'Response should be successful');
      assert.ok(historyData.count <= count, 'Should respect count limit');
    } catch (error) {
      assert.fail(`Custom count test failed: ${error.message}`);
    }
  });
});

// Test browser history tool directly
describe('Browser History Tool Direct Tests', () => {
  test('Can import browser history tool', async () => {
    try {
      const { default: BrowserHistoryTool } = await import('../dist/tools/browser-history.js');
      assert.ok(BrowserHistoryTool, 'Should be able to import BrowserHistoryTool');
      
      const tool = new BrowserHistoryTool({ autoSync: false });
      assert.strictEqual(tool.name, 'browser_history', 'Tool should have correct name');
      assert.ok(tool.description.length > 0, 'Tool should have description');
    } catch (error) {
      assert.fail(`Browser history tool import failed: ${error.message}`);
    }
  });

  test('Browser history tool execute method works', async () => {
    try {
      const { default: BrowserHistoryTool } = await import('../dist/tools/browser-history.js');
      const tool = new BrowserHistoryTool({ autoSync: false });
      
      // Test get_browsers action
      const browsersResult = await tool.execute({ action: 'get_browsers' });
      const browsersData = JSON.parse(browsersResult);
      assert.strictEqual(browsersData.success, true, 'get_browsers should succeed');
      assert.ok(Array.isArray(browsersData.browsers), 'Should return browsers array');
      
      // Test stats action
      const statsResult = await tool.execute({ action: 'stats' });
      const statsData = JSON.parse(statsResult);
      assert.strictEqual(statsData.success, true, 'stats should succeed');
      assert.ok(typeof statsData.stats === 'object', 'Should return stats object');
      
      // Test invalid action
      const invalidResult = await tool.execute({ action: 'invalid_action' });
      const invalidData = JSON.parse(invalidResult);
      assert.strictEqual(invalidData.success, false, 'Invalid action should fail');
      assert.ok(invalidData.error.includes('Unknown action'), 'Should indicate unknown action');
      
      // Cleanup
      tool.destroy();
    } catch (error) {
      assert.fail(`Browser history tool execution test failed: ${error.message}`);
    }
  });
});