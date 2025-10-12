/**
 * Browser History Tool Tests
 * Tests for autonomous browser history syncing capabilities
 */

import { test } from 'node:test';
import assert from 'node:assert';
import BrowserHistoryTool from '../dist/tools/browser-history.js';

test('BrowserHistoryTool - Initialization', async (t) => {
  await t.test('should create a browser history tool instance', () => {
    const historyTool = new BrowserHistoryTool({ autoSync: false });
    assert.ok(historyTool);
    assert.strictEqual(historyTool.name, 'browser_history');
    historyTool.destroy();
  });

  await t.test('should accept configuration options', () => {
    const customTool = new BrowserHistoryTool({
      autoSync: true,
      syncInterval: 30000,
      maxEntries: 500,
    });
    assert.ok(customTool);
    customTool.destroy();
  });

  await t.test('should start auto-sync when enabled', () => {
    const autoSyncTool = new BrowserHistoryTool({ autoSync: true, syncInterval: 1000 });
    assert.ok(autoSyncTool);
    autoSyncTool.destroy();
  });
});

test('BrowserHistoryTool - History Retrieval', async (t) => {
  let historyTool;

  t.beforeEach(() => {
    historyTool = new BrowserHistoryTool({ autoSync: false });
  });

  t.afterEach(() => {
    if (historyTool) {
      historyTool.destroy();
    }
  });

  await t.test('should get recent history', async () => {
    const result = await historyTool.getRecentHistory(10);
    assert.ok(Array.isArray(result));
  });

  await t.test('should search history by query', async () => {
    const result = await historyTool.searchHistory('github');
    assert.ok(Array.isArray(result));
  });

  await t.test('should filter history by domain', async () => {
    const result = await historyTool.getHistoryByDomain('github.com');
    assert.ok(Array.isArray(result));
  });
});

test('BrowserHistoryTool - Tool Execution', async (t) => {
  let historyTool;

  t.beforeEach(() => {
    historyTool = new BrowserHistoryTool({ autoSync: false });
  });

  t.afterEach(() => {
    if (historyTool) {
      historyTool.destroy();
    }
  });

  await t.test('should execute recent action', async () => {
    const result = await historyTool.execute({
      action: 'recent',
      limit: 50,
    });
    assert.ok(Array.isArray(result));
  });

  await t.test('should execute search action', async () => {
    const result = await historyTool.execute({
      action: 'search',
      query: 'test',
    });
    assert.ok(Array.isArray(result));
  });

  await t.test('should execute domain action', async () => {
    const result = await historyTool.execute({
      action: 'domain',
      query: 'example.com',
    });
    assert.ok(Array.isArray(result));
  });

  await t.test('should throw error for unknown action', async () => {
    await assert.rejects(
      async () => historyTool.execute({ action: 'invalid' }),
      /Unknown action/
    );
  });

  await t.test('should throw error when query is missing for search', async () => {
    await assert.rejects(
      async () => historyTool.execute({ action: 'search' }),
      /Query required for search action/
    );
  });

  await t.test('should throw error when domain is missing for domain action', async () => {
    await assert.rejects(
      async () => historyTool.execute({ action: 'domain' }),
      /Domain required for domain action/
    );
  });
});

test('BrowserHistoryTool - Auto-sync Management', async (t) => {
  await t.test('should stop auto-sync', () => {
    const autoSyncTool = new BrowserHistoryTool({ autoSync: true, syncInterval: 1000 });
    autoSyncTool.stopAutoSync();
    autoSyncTool.destroy();
  });

  await t.test('should handle multiple stop calls gracefully', () => {
    const historyTool = new BrowserHistoryTool({ autoSync: false });
    historyTool.stopAutoSync();
    historyTool.stopAutoSync(); // Should not throw
    historyTool.destroy();
  });
});

test('BrowserHistoryTool - Cleanup', async (t) => {
  await t.test('should clean up resources on destroy', () => {
    const historyTool = new BrowserHistoryTool({ autoSync: false });
    historyTool.destroy();
    // Tool should be cleaned up without errors
    assert.doesNotThrow(() => historyTool.destroy());
  });
});
