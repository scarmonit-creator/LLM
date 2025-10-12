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
import { Database as _Database } from 'better-sqlite3';

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
          const profilesPath = path.join(home, 'Library/Application Support/Firefox/Profiles');
          this.addFirefoxProfiles(profilesPath, paths);
        } else if (platform === 'win32') {
          const profilesPath = path.join(home, 'AppData/Roaming/Mozilla/Firefox/Profiles');
          this.addFirefoxProfiles(profilesPath, paths);
        } else {
          const profilesPath = path.join(home, '.mozilla/firefox');
          this.addFirefoxProfiles(profilesPath, paths);
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
    }

    return paths.filter((p) => fs.existsSync(p));
  }

  private addFirefoxProfiles(profilesPath: string, paths: string[]): void {
    try {
      if (!fs.existsSync(profilesPath)) return;
      const profiles = fs.readdirSync(profilesPath);
      for (const profile of profiles) {
        if (profile.endsWith('.default') || profile.includes('default')) {
          const historyPath = path.join(profilesPath, profile, 'places.sqlite');
          if (fs.existsSync(historyPath)) {
            paths.push(historyPath);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading Firefox profiles: ${error}`);
    }
  }

  async getHistory(browser?: string, limit?: number): Promise<HistoryEntry[]> {
    const entries: HistoryEntry[] = [];
    const browsersToSearch = browser
      ? [browser]
      : this.config.browsers || Object.values(BrowserType);

    for (const browserType of browsersToSearch) {
      const browserPaths = this.getBrowserPaths(browserType);

      for (const dbPath of browserPaths) {
        try {
          const browserEntries = await this.readBrowserHistory(dbPath, browserType);
          entries.push(...browserEntries);
        } catch (error) {
          console.error(`Error reading ${browserType} history: ${error}`);
        }
      }
    }

    // Sort by visit time and limit results
    const sorted = entries.sort((a, b) => b.visitTime - a.visitTime);
    const maxLimit = limit || this.config.maxEntries;
    return sorted.slice(0, maxLimit);
  }

  private async readBrowserHistory(dbPath: string, browserType: string): Promise<HistoryEntry[]> {
    return new Promise((resolve, reject) => {
      try {
        // Create a temporary copy to avoid locks
        const tempPath = path.join(os.tmpdir(), `history_${Date.now()}.db`);
        fs.copyFileSync(dbPath, tempPath);

        const Database = require('better-sqlite3');
        const db = new Database(tempPath, { readonly: true });

        let query: string;
        let rows: any[];

        if (browserType === BrowserType.FIREFOX) {
          query = `
            SELECT url, title, last_visit_date / 1000000 as visit_time, visit_count
            FROM moz_places
            WHERE visit_count > 0
            ORDER BY visit_time DESC
          `;
          rows = db.prepare(query).all();
        } else if (browserType === BrowserType.SAFARI) {
          query = `
            SELECT url, title, visit_time, visit_count
            FROM history_items
            ORDER BY visit_time DESC
          `;
          rows = db.prepare(query).all();
        } else {
          // Chrome-based browsers
          query = `
            SELECT url, title, last_visit_time, visit_count
            FROM urls
            ORDER BY last_visit_time DESC
          `;
          rows = db.prepare(query).all();
        }

        db.close();
        fs.unlinkSync(tempPath);

        const entries: HistoryEntry[] = rows.map((row: any) => ({
          url: row.url,
          title: row.title || '',
          visitTime: this.normalizeTimestamp(row.visit_time || row.last_visit_time, browserType),
          visitCount: row.visit_count,
          browser: browserType,
        }));

        resolve(this.applyFilters(entries));
      } catch (error) {
        reject(error);
      }
    });
  }

  private normalizeTimestamp(timestamp: number, browserType: string): number {
    // Chrome uses microseconds since 1601-01-01
    if (
      browserType === BrowserType.CHROME ||
      browserType === BrowserType.EDGE ||
      browserType === BrowserType.BRAVE
    ) {
      const epochDelta = 11644473600000000; // microseconds between 1601 and 1970
      return Math.floor((timestamp - epochDelta) / 1000);
    }
    // Firefox uses microseconds since epoch
    if (browserType === BrowserType.FIREFOX) {
      return Math.floor(timestamp / 1000);
    }
    // Safari uses seconds since 2001-01-01
    if (browserType === BrowserType.SAFARI) {
      return timestamp + 978307200000;
    }
    return timestamp;
  }

  private applyFilters(entries: HistoryEntry[]): HistoryEntry[] {
    if (!this.config.filters || this.config.filters.length === 0) {
      return entries;
    }

    return entries.filter((entry) => {
      return this.config.filters!.some((filter) => {
        return entry.url.includes(filter) || entry.title.includes(filter);
      });
    });
  }

  async searchHistory(query: string, limit?: number): Promise<HistoryEntry[]> {
    const allHistory = await this.getHistory(undefined, undefined);
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
