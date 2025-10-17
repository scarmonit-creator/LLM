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
    const result = await historyTool.getHistory({ maxResults: 10 });
    assert.ok(Array.isArray(result));
  });

  await t.test('should search history by query', async () => {
    const result = await historyTool.searchHistory('github');
    assert.ok(Array.isArray(result));
  });

  await t.test('should get history with filters', async () => {
    const resultStr = await historyTool.execute({
      action: 'get_history',
      maxResults: 10,
    });
    const result = JSON.parse(resultStr);
    assert.ok(result.success);
    assert.ok(Array.isArray(result.data));
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

  await t.test('should execute get_history action', async () => {
    const resultStr = await historyTool.execute({ action: 'get_history', maxResults: 5 });
    const result = JSON.parse(resultStr);
    assert.ok(result.success);
    assert.ok(Array.isArray(result.data));
  });

  await t.test('should execute search action', async () => {
    const resultStr = await historyTool.execute({
      action: 'search',
      query: 'test',
      maxResults: 5,
    });
    const result = JSON.parse(resultStr);
    assert.ok(result.success);
    assert.ok(Array.isArray(result.data));
  });

  await t.test('should execute sync action', async () => {
    const resultStr = await historyTool.execute({ action: 'sync' });
    const result = JSON.parse(resultStr);
    assert.ok(result.success);
  });

  await t.test('should execute stats action', async () => {
    const resultStr = await historyTool.execute({ action: 'stats' });
    const result = JSON.parse(resultStr);
    assert.ok(result.success);
    assert.ok(result.stats);
  });

  await t.test('should require query for search', async () => {
    const resultStr = await historyTool.execute({ action: 'search' });
    const result = JSON.parse(resultStr);
    assert.ok(!result.success);
    assert.ok(result.error);
  });

  await t.test('should handle unknown action', async () => {
    const resultStr = await historyTool.execute({ action: 'invalid_action' });
    const result = JSON.parse(resultStr);
    assert.ok(!result.success);
    assert.match(result.error, /Unknown action/);
  });
});

test('BrowserHistoryTool - Auto-sync', async (t) => {
  await t.test('should handle sync manually', async () => {
    const historyTool = new BrowserHistoryTool({ autoSync: false });
    const resultStr = await historyTool.execute({ action: 'sync' });
    const result = JSON.parse(resultStr);
    assert.ok(result.success);
    historyTool.destroy();
  });

  await t.test('should get stats about sync state', async () => {
    const historyTool = new BrowserHistoryTool({ autoSync: true, syncInterval: 60000 });
    const resultStr = await historyTool.execute({ action: 'stats' });
    const result = JSON.parse(resultStr);
    assert.ok(result.success);
    assert.strictEqual(result.stats.autoSync, true);
    assert.strictEqual(result.stats.syncInterval, 60000);
    historyTool.destroy();
  });
});
