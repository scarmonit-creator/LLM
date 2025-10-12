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
import { Database } from 'better-sqlite3';

interface HistoryEntry {
  url: string;
  title: string;
  visitTime: number;
  visitCount: number;
  browser: string;
  profile?: string;
}

interface BrowserHistoryConfig {
  autoSync: boolean;
  syncInterval: number;
  maxEntries: number;
  browsers?: string[];
  filters?: string[];
  crossPlatform: boolean;
  enableEncryption: boolean;
}

enum BrowserType {
  CHROME = 'chrome',
  FIREFOX = 'firefox',
  EDGE = 'edge',
  SAFARI = 'safari',
  OPERA = 'opera',
  BRAVE = 'brave'
}

class BrowserPathResolver {
  private static getHomePath(): string {
    return os.homedir();
  }

  private static getPlatform(): string {
    return process.platform;
  }

  static getHistoryPath(browser: BrowserType, profile = 'Default'): string | null {
    const platform = this.getPlatform();
    const home = this.getHomePath();

    const paths: Record<string, Record<BrowserType, string>> = {
      win32: {
        [BrowserType.CHROME]: path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', profile, 'History'),
        [BrowserType.FIREFOX]: path.join(home, 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles'),
        [BrowserType.EDGE]: path.join(home, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', profile, 'History'),
        [BrowserType.SAFARI]: '',
        [BrowserType.OPERA]: path.join(home, 'AppData', 'Roaming', 'Opera Software', 'Opera Stable', 'History'),
        [BrowserType.BRAVE]: path.join(home, 'AppData', 'Local', 'BraveSoftware', 'Brave-Browser', 'User Data', profile, 'History')
      },
      darwin: {
        [BrowserType.CHROME]: path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', profile, 'History'),
        [BrowserType.FIREFOX]: path.join(home, 'Library', 'Application Support', 'Firefox', 'Profiles'),
        [BrowserType.EDGE]: path.join(home, 'Library', 'Application Support', 'Microsoft Edge', profile, 'History'),
        [BrowserType.SAFARI]: path.join(home, 'Library', 'Safari', 'History.db'),
        [BrowserType.OPERA]: path.join(home, 'Library', 'Application Support', 'com.operasoftware.Opera', 'History'),
        [BrowserType.BRAVE]: path.join(home, 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser', profile, 'History')
      },
      linux: {
        [BrowserType.CHROME]: path.join(home, '.config', 'google-chrome', profile, 'History'),
        [BrowserType.FIREFOX]: path.join(home, '.mozilla', 'firefox'),
        [BrowserType.EDGE]: path.join(home, '.config', 'microsoft-edge', profile, 'History'),
        [BrowserType.SAFARI]: '',
        [BrowserType.OPERA]: path.join(home, '.config', 'opera', 'History'),
        [BrowserType.BRAVE]: path.join(home, '.config', 'BraveSoftware', 'Brave-Browser', profile, 'History')
      }
    };

    return paths[platform]?.[browser] || null;
  }
}

export class BrowserHistoryTool implements Tool {
  name = 'browser_history';
  description = 'Advanced multi-browser history access with autonomous sync, encryption support, and cross-platform compatibility';
  
  private config: BrowserHistoryConfig;
  private syncTimer?: NodeJS.Timeout;
  private historyCache: HistoryEntry[] = [];
  private supportedBrowsers: BrowserType[] = [
    BrowserType.CHROME,
    BrowserType.FIREFOX,
    BrowserType.EDGE,
    BrowserType.SAFARI,
    BrowserType.OPERA,
    BrowserType.BRAVE
  ];

  constructor(config?: Partial<BrowserHistoryConfig>) {
    this.config = {
      autoSync: true,
      syncInterval: 60000,
      maxEntries: 5000,
      crossPlatform: true,
      enableEncryption: false,
      ...config,
    };
    
    if (this.config.autoSync) {
      this.startAutoSync();
    }
  }

  private startAutoSync(): void {
    console.log(`[BrowserHistory] Auto-sync enabled with ${this.config.syncInterval}ms interval`);
    this.syncTimer = setInterval(() => {
      this.syncHistory();
    }, this.config.syncInterval);
    // Initial sync
    this.syncHistory();
  }

  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
      console.log('[BrowserHistory] Auto-sync stopped');
    }
  }

  private async syncHistory(): Promise<void> {
    try {
      console.log('[BrowserHistory] Syncing history from all browsers...');
      const newEntries = await this.fetchBrowserHistory();
      this.historyCache = newEntries.slice(0, this.config.maxEntries);
      console.log(`[BrowserHistory] Synced ${this.historyCache.length} entries from ${this.getUniqueBrowsers().length} browsers`);
    } catch (error) {
      console.error('[BrowserHistory] Sync failed:', error);
    }
  }

  private getUniqueBrowsers(): string[] {
    return [...new Set(this.historyCache.map(e => e.browser))];
  }

  private async fetchBrowserHistory(): Promise<HistoryEntry[]> {
    const allEntries: HistoryEntry[] = [];
    
    for (const browser of this.supportedBrowsers) {
      try {
        const entries = await this.readBrowserHistory(browser);
        allEntries.push(...entries);
      } catch (error) {
        console.warn(`[BrowserHistory] Failed to read ${browser}:`, error);
      }
    }
    
    return allEntries.sort((a, b) => b.visitTime - a.visitTime);
  }

  private async readBrowserHistory(browser: BrowserType): Promise<HistoryEntry[]> {
    const historyPath = BrowserPathResolver.getHistoryPath(browser);
    
    if (!historyPath || !fs.existsSync(historyPath)) {
      return [];
    }

    if (browser === BrowserType.FIREFOX) {
      return this.readFirefoxHistory(historyPath);
    } else {
      return this.readChromiumHistory(historyPath, browser);
    }
  }

  private async readChromiumHistory(dbPath: string, browser: BrowserType): Promise<HistoryEntry[]> {
    try {
      const sqlite3 = require('better-sqlite3');
      const tempPath = path.join(os.tmpdir(), `history-${Date.now()}.db`);
      fs.copyFileSync(dbPath, tempPath);
      
      const db = sqlite3(tempPath, { readonly: true });
      const rows = db.prepare(`
        SELECT url, title, last_visit_time, visit_count
        FROM urls
        ORDER BY last_visit_time DESC
        LIMIT ?
      `).all(this.config.maxEntries);
      
      db.close();
      fs.unlinkSync(tempPath);
      
      return rows.map((row: any) => ({
        url: row.url,
        title: row.title || '',
        visitTime: this.convertWebKitTime(row.last_visit_time),
        visitCount: row.visit_count,
        browser: browser
      }));
    } catch (error) {
      console.error(`[BrowserHistory] Error reading ${browser}:`, error);
      return [];
    }
  }

  private async readFirefoxHistory(profilesPath: string): Promise<HistoryEntry[]> {
    try {
      const allEntries: HistoryEntry[] = [];
      const profiles = fs.readdirSync(profilesPath).filter(f => f.includes('.default'));
      
      for (const profile of profiles) {
        const dbPath = path.join(profilesPath, profile, 'places.sqlite');
        if (!fs.existsSync(dbPath)) continue;
        
        const sqlite3 = require('better-sqlite3');
        const tempPath = path.join(os.tmpdir(), `firefox-${Date.now()}.db`);
        fs.copyFileSync(dbPath, tempPath);
        
        const db = sqlite3(tempPath, { readonly: true });
        const rows = db.prepare(`
          SELECT url, title, last_visit_date, visit_count
          FROM moz_places
          WHERE url NOT LIKE 'place:%'
          ORDER BY last_visit_date DESC
          LIMIT ?
        `).all(this.config.maxEntries);
        
        db.close();
        fs.unlinkSync(tempPath);
        
        allEntries.push(...rows.map((row: any) => ({
          url: row.url,
          title: row.title || '',
          visitTime: Math.floor(row.last_visit_date / 1000),
          visitCount: row.visit_count,
          browser: BrowserType.FIREFOX,
          profile: profile
        })));
      }
      
      return allEntries;
    } catch (error) {
      console.error('[BrowserHistory] Error reading Firefox:', error);
      return [];
    }
  }

  private convertWebKitTime(webkitTime: number): number {
    // WebKit timestamp epoch is January 1, 1601
    const epoch = new Date('1601-01-01').getTime();
    return Math.floor((webkitTime / 1000000) + epoch);
  }

  async getRecentHistory(limit: number = 100): Promise<HistoryEntry[]> {
    await this.syncHistory();
    return this.historyCache.slice(0, limit);
  }

  async searchHistory(query: string): Promise<HistoryEntry[]> {
    await this.syncHistory();
    const lowerQuery = query.toLowerCase();
    return this.historyCache.filter(
      (entry) =>
        entry.url.toLowerCase().includes(lowerQuery) ||
        entry.title.toLowerCase().includes(lowerQuery)
    );
  }

  async getHistoryByDomain(domain: string): Promise<HistoryEntry[]> {
    await this.syncHistory();
    return this.historyCache.filter((entry) => entry.url.includes(domain));
  }

  async getHistoryByBrowser(browser: BrowserType): Promise<HistoryEntry[]> {
    await this.syncHistory();
    return this.historyCache.filter((entry) => entry.browser === browser);
  }

  async getHistoryStats(): Promise<{
    totalEntries: number;
    browsers: Record<string, number>;
    topDomains: Array<{domain: string; count: number}>;
  }> {
    await this.syncHistory();
    
    const browsers: Record<string, number> = {};
    const domains: Record<string, number> = {};
    
    for (const entry of this.historyCache) {
      browsers[entry.browser] = (browsers[entry.browser] || 0) + 1;
      
      try {
        const url = new URL(entry.url);
        const domain = url.hostname;
        domains[domain] = (domains[domain] || 0) + 1;
      } catch {}
    }
    
    const topDomains = Object.entries(domains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }));
    
    return {
      totalEntries: this.historyCache.length,
      browsers,
      topDomains
    };
  }

  async execute(params: {
    action: 'recent' | 'search' | 'domain' | 'browser' | 'stats';
    query?: string;
    limit?: number;
    browser?: BrowserType;
  }): Promise<any> {
    switch (params.action) {
      case 'recent':
        return await this.getRecentHistory(params.limit);
      case 'search':
        if (!params.query) throw new Error('Query required for search action');
        return await this.searchHistory(params.query);
      case 'domain':
        if (!params.query) throw new Error('Domain required for domain action');
        return await this.getHistoryByDomain(params.query);
      case 'browser':
        if (!params.browser) throw new Error('Browser required for browser action');
        return await this.getHistoryByBrowser(params.browser);
      case 'stats':
        return await this.getHistoryStats();
      default:
        throw new Error(`Unknown action: ${params.action}`);
    }
  }

  destroy(): void {
    this.stopAutoSync();
    this.historyCache = [];
  }
}

export default BrowserHistoryTool;
