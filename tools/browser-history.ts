/**
 * Enhanced Browser History Tool
 * Multi-browser, cross-platform history access with autonomous sync
 * Integrates capabilities from: HackBrowserData, browser-history, 1History,
 * AutoBrowse, ArchiveBox, stagehand, browser-use
 */
import { Tool } from './types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface HistoryEntry {
  url: string;
  title: string;
  visitTime: number;
  visitCount: number;
  browser: string;
  profile?: string;
}

interface BrowserHistoryConfig {
  autoSync?: boolean;
  syncInterval?: number;
  maxEntries?: number;
  browsers?: string[];
  filters?: string[];
  crossPlatform?: boolean;
  enableEncryption?: boolean;
}

enum BrowserType {
  CHROME = 'chrome',
  FIREFOX = 'firefox',
  EDGE = 'edge',
  SAFARI = 'safari',
  OPERA = 'opera',
  BRAVE = 'brave',
}

export default class BrowserHistoryTool implements Tool {
  name = 'browser_history';
  description =
    'Access browser history across Chrome, Firefox, Safari, Edge, Brave, and Opera. ' +
    'Supports multi-profile, cross-platform access with autonomous sync. ' +
    'Can search, filter, and retrieve recent browsing history.';

  private config: BrowserHistoryConfig;
  private syncTimer?: NodeJS.Timeout;

  constructor(config: BrowserHistoryConfig = {}) {
    this.config = {
      autoSync: config.autoSync ?? true,
      syncInterval: config.syncInterval ?? 300000,
      maxEntries: config.maxEntries ?? 1000,
      browsers: config.browsers ?? Object.values(BrowserType),
      filters: config.filters ?? [],
      crossPlatform: config.crossPlatform ?? true,
      enableEncryption: config.enableEncryption ?? false,
    };

    if (this.config.autoSync) {
      this.startAutoSync();
    }
  }

  private getBrowserPaths(browserType: string): string[] {
    const platform = os.platform();
    const home = os.homedir();
    const paths: string[] = [];

    switch (browserType) {
      case BrowserType.CHROME:
        if (platform === 'darwin') {
          paths.push(path.join(home, 'Library/Application Support/Google/Chrome/Default/History'));
        } else if (platform === 'win32') {
          paths.push(path.join(home, 'AppData/Local/Google/Chrome/User Data/Default/History'));
        } else {
          paths.push(path.join(home, '.config/google-chrome/Default/History'));
        }
        break;

      case BrowserType.FIREFOX:
        if (platform === 'darwin') {
          const profileDir = path.join(home, 'Library/Application Support/Firefox/Profiles');
          if (fs.existsSync(profileDir)) {
            const profiles = fs.readdirSync(profileDir).filter((f) => f.includes('.default'));
            profiles.forEach((p) => {
              paths.push(path.join(profileDir, p, 'places.sqlite'));
            });
          }
        } else if (platform === 'win32') {
          const profileDir = path.join(home, 'AppData/Roaming/Mozilla/Firefox/Profiles');
          if (fs.existsSync(profileDir)) {
            const profiles = fs.readdirSync(profileDir).filter((f) => f.includes('.default'));
            profiles.forEach((p) => {
              paths.push(path.join(profileDir, p, 'places.sqlite'));
            });
          }
        } else {
          const profileDir = path.join(home, '.mozilla/firefox');
          if (fs.existsSync(profileDir)) {
            const profiles = fs.readdirSync(profileDir).filter((f) => f.includes('.default'));
            profiles.forEach((p) => {
              paths.push(path.join(profileDir, p, 'places.sqlite'));
            });
          }
        }
        break;

      case BrowserType.EDGE:
        if (platform === 'darwin') {
          paths.push(path.join(home, 'Library/Application Support/Microsoft Edge/Default/History'));
        } else if (platform === 'win32') {
          paths.push(path.join(home, 'AppData/Local/Microsoft/Edge/User Data/Default/History'));
        }
        break;

      case BrowserType.SAFARI:
        if (platform === 'darwin') {
          paths.push(path.join(home, 'Library/Safari/History.db'));
        }
        break;

      case BrowserType.BRAVE:
        if (platform === 'darwin') {
          paths.push(
            path.join(
              home,
              'Library/Application Support/BraveSoftware/Brave-Browser/Default/History'
            )
          );
        } else if (platform === 'win32') {
          paths.push(
            path.join(home, 'AppData/Local/BraveSoftware/Brave-Browser/User Data/Default/History')
          );
        } else {
          paths.push(path.join(home, '.config/BraveSoftware/Brave-Browser/Default/History'));
        }
        break;

      case BrowserType.OPERA:
        if (platform === 'darwin') {
          paths.push(
            path.join(home, 'Library/Application Support/com.operasoftware.Opera/History')
          );
        } else if (platform === 'win32') {
          paths.push(path.join(home, 'AppData/Roaming/Opera Software/Opera Stable/History'));
        } else {
          paths.push(path.join(home, '.config/opera/History'));
        }
        break;
    }

    return paths.filter((p) => fs.existsSync(p));
  }

  async getHistory(browser?: string, limit?: number): Promise<HistoryEntry[]> {
    const allHistory: HistoryEntry[] = [];
    const browsers = browser ? [browser] : this.config.browsers || [];

    for (const browserType of browsers) {
      const paths = this.getBrowserPaths(browserType);

      for (const dbPath of paths) {
        try {
          const history = await this.readBrowserHistory(dbPath, browserType);
          allHistory.push(...history);
        } catch (error) {
          console.error(`Error reading ${browserType} history:`, error);
        }
      }
    }

    // Sort by visit time, most recent first
    allHistory.sort((a, b) => b.visitTime - a.visitTime);

    // Apply filters
    const filtered = this.applyFilters(allHistory);

    // Apply limit
    return filtered.slice(0, limit || this.config.maxEntries);
  }

  private async readBrowserHistory(dbPath: string, browserType: string): Promise<HistoryEntry[]> {
    const history: HistoryEntry[] = [];

    // Create a temporary copy to avoid lock issues
    const tempPath = `${dbPath}.tmp.${Date.now()}`;
    fs.copyFileSync(dbPath, tempPath);

    try {
      // Dynamic require to handle optional dependency
      const Database = require('better-sqlite3');
      const db = new Database(tempPath, { readonly: true });

      let rows: any[];

      if (browserType === BrowserType.FIREFOX) {
        rows = db
          .prepare(
            `SELECT url, title, visit_count as visitCount, last_visit_date as visitTime 
             FROM moz_places 
             WHERE visit_count > 0 
             ORDER BY last_visit_date DESC 
             LIMIT ?`
          )
          .all(this.config.maxEntries || 1000);

        // Firefox stores timestamps in microseconds
        rows = rows.map((row: any) => ({
          ...row,
          visitTime: Math.floor(row.visitTime / 1000),
        }));
      } else if (browserType === BrowserType.SAFARI) {
        rows = db
          .prepare(
            `SELECT url, visit_count as visitCount, visit_time as visitTime 
             FROM history_visits 
             JOIN history_items ON history_visits.history_item = history_items.id 
             ORDER BY visit_time DESC 
             LIMIT ?`
          )
          .all(this.config.maxEntries || 1000);

        // Safari uses Core Data timestamp (seconds since 2001-01-01)
        rows = rows.map((row: any) => ({
          ...row,
          title: '',
          visitTime: Math.floor((row.visitTime + 978307200) * 1000),
        }));
      } else {
        // Chromium-based browsers (Chrome, Edge, Brave, Opera)
        rows = db
          .prepare(
            `SELECT url, title, visit_count as visitCount, last_visit_time as visitTime 
             FROM urls 
             ORDER BY last_visit_time DESC 
             LIMIT ?`
          )
          .all(this.config.maxEntries || 1000);

        // Chromium stores timestamps in microseconds since 1601-01-01
        rows = rows.map((row: any) => ({
          ...row,
          visitTime: Math.floor(row.visitTime / 1000 - 11644473600000),
        }));
      }

      db.close();

      history.push(
        ...rows.map((row: any) => ({
          url: row.url,
          title: row.title || '',
          visitTime: row.visitTime,
          visitCount: row.visitCount,
          browser: browserType,
          profile: path.basename(path.dirname(dbPath)),
        }))
      );
    } catch (error) {
      console.error(`Error reading database ${dbPath}:`, error);
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tempPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    return history;
  }

  private applyFilters(history: HistoryEntry[]): HistoryEntry[] {
    if (!this.config.filters || this.config.filters.length === 0) {
      return history;
    }

    return history.filter((entry) => {
      return this.config.filters!.every((filter) => {
        const regex = new RegExp(filter, 'i');
        return regex.test(entry.url) || regex.test(entry.title);
      });
    });
  }

  async searchHistory(query: string, limit?: number): Promise<HistoryEntry[]> {
    const allHistory = await this.getHistory();
    const searchLower = query.toLowerCase();

    const filtered = allHistory.filter(
      (entry) =>
        entry.url.toLowerCase().includes(searchLower) ||
        entry.title.toLowerCase().includes(searchLower)
    );

    return filtered.slice(0, limit || this.config.maxEntries);
  }

  private startAutoSync(): void {
    if (this.config.autoSync && !this.syncTimer) {
      this.syncTimer = setInterval(() => {
        this.getHistory().catch((error) => {
          console.error('Auto-sync error:', error);
        });
      }, this.config.syncInterval);
    }
  }

  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  private updateConfig(newConfig: BrowserHistoryConfig): void {
    this.config = { ...this.config, ...newConfig };

    if (this.config.autoSync) {
      this.stopAutoSync();
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  // Tool interface execute method
  async execute(args: any): Promise<any> {
    const action = args.action || 'get_history';

    switch (action) {
      case 'get_history':
        return await this.getHistory(args.browser, args.limit);
      case 'search_history':
        if (!args.query) {
          throw new Error('Query parameter required for search_history');
        }
        return await this.searchHistory(args.query, args.limit);
      case 'start_sync':
        this.startAutoSync();
        return { success: true, message: 'Auto-sync started' };
      case 'stop_sync':
        this.stopAutoSync();
        return { success: true, message: 'Auto-sync stopped' };
      case 'update_config':
        if (!args.config) {
          throw new Error('Config parameter required for update_config');
        }
        this.updateConfig(args.config);
        return { success: true, message: 'Configuration updated' };
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // Cleanup method
  destroy(): void {
    this.stopAutoSync();
  }
}
