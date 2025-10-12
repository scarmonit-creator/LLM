/**
 * Browser History Tool Tests
 * Tests for autonomous browser history syncing capabilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import BrowserHistoryTool from '../tools/browser-history';

describe('BrowserHistoryTool', () => {
  let historyTool;

  beforeEach(() => {
    historyTool = new BrowserHistoryTool({ autoSync: false });
  });

  afterEach(() => {
    if (historyTool) {
      historyTool.destroy();
    }
  });

  describe('Initialization', () => {
    it('should create a browser history tool instance', () => {
      expect(historyTool).toBeDefined();
      expect(historyTool.name).toBe('browser_history');
    });

    it('should accept configuration options', () => {
      const customTool = new BrowserHistoryTool({
        autoSync: true,
        syncInterval: 30000,
        maxEntries: 500,
      });
      expect(customTool).toBeDefined();
      customTool.destroy();
    });

    it('should start auto-sync when enabled', () => {
      const autoSyncTool = new BrowserHistoryTool({ autoSync: true, syncInterval: 1000 });
      expect(autoSyncTool).toBeDefined();
      autoSyncTool.destroy();
    });
  });

  describe('History Retrieval', () => {
    it('should get recent history', async () => {
      const result = await historyTool.getRecentHistory(10);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should search history by query', async () => {
      const result = await historyTool.searchHistory('github');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter history by domain', async () => {
      const result = await historyTool.getHistoryByDomain('github.com');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Tool Execution', () => {
    it('should execute recent action', async () => {
      const result = await historyTool.execute({
        action: 'recent',
        limit: 50,
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it('should execute search action', async () => {
      const result = await historyTool.execute({
        action: 'search',
        query: 'test',
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it('should execute domain action', async () => {
      const result = await historyTool.execute({
        action: 'domain',
        query: 'example.com',
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it('should throw error for unknown action', async () => {
      await expect(
        historyTool.execute({ action: 'invalid' })
      ).rejects.toThrow();
    });

    it('should throw error when query is missing for search', async () => {
      await expect(
        historyTool.execute({ action: 'search' })
      ).rejects.toThrow('Query required for search action');
    });

    it('should throw error when domain is missing for domain action', async () => {
      await expect(
        historyTool.execute({ action: 'domain' })
      ).rejects.toThrow('Domain required for domain action');
    });
  });

  describe('Auto-sync Management', () => {
    it('should stop auto-sync', () => {
      const autoSyncTool = new BrowserHistoryTool({ autoSync: true, syncInterval: 1000 });
      autoSyncTool.stopAutoSync();
      // Should not throw
      autoSyncTool.destroy();
    });

    it('should handle multiple stop calls gracefully', () => {
      historyTool.stopAutoSync();
      historyTool.stopAutoSync(); // Should not throw
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      historyTool.destroy();
      // Tool should be cleaned up without errors
      expect(() => historyTool.destroy()).not.toThrow();
    });
  });
});
