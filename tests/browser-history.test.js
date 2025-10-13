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
    const result = await historyTool.getHistory(undefined, 10);
    assert.ok(Array.isArray(result));
  });

  await t.test('should search history by query', async () => {
    const result = await historyTool.searchHistory('github');
    assert.ok(Array.isArray(result));
  });

  await t.test('should get history with filters', async () => {
    const result = await historyTool.execute({
      action: 'get_history',
      limit: 10,
    });
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

  await t.test('should execute get_history action', async () => {
    const result = await historyTool.execute({ action: 'get_history', limit: 5 });
    assert.ok(Array.isArray(result));
  });

  await t.test('should execute search_history action', async () => {
    const result = await historyTool.execute({
      action: 'search_history',
      query: 'test',
      limit: 5,
    });
    assert.ok(Array.isArray(result));
  });

  await t.test('should execute start_sync action', async () => {
    const result = await historyTool.execute({ action: 'start_sync' });
    assert.ok(result.success);
  });

  await t.test('should execute stop_sync action', async () => {
    const result = await historyTool.execute({ action: 'stop_sync' });
    assert.ok(result.success);
  });

  await t.test('should require query for search_history', async () => {
    await assert.rejects(
      async () => {
        await historyTool.execute({ action: 'search_history' });
      },
      { message: 'Query parameter required for search_history' }
    );
  });

  await t.test('should handle unknown action', async () => {
    await assert.rejects(
      async () => {
        await historyTool.execute({ action: 'invalid_action' });
      },
      { message: /Unknown action/ }
    );
  });
});

test('BrowserHistoryTool - Auto-sync', async (t) => {
  await t.test('should stop auto-sync via execute', async () => {
    const historyTool = new BrowserHistoryTool({ autoSync: true, syncInterval: 1000 });
    const result = await historyTool.execute({ action: 'stop_sync' });
    assert.ok(result.success);
    historyTool.destroy();
  });

  await t.test('should start auto-sync via execute', async () => {
    const historyTool = new BrowserHistoryTool({ autoSync: false });
    const result = await historyTool.execute({ action: 'start_sync' });
    assert.ok(result.success);
    historyTool.destroy();
  });
});
