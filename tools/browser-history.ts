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
  BRAVE = 'brave',
}

class BrowserHistoryManager {
  private config: BrowserHistoryConfig;
  private syncTimer?: NodeJS.Timeout;

  constructor(config: Partial<BrowserHistoryConfig> = {}) {
    this.config = {
      autoSync: config.autoSync ?? true,
      syncInterval: config.syncInterval ?? 300000,
      maxEntries: config.maxEntries ?? 1000,
      browsers: config.browsers ?? Object.values(BrowserType),
      filters: config.filters ?? [],
      crossPlatform: config.crossPlatform ?? true,
      enableEncryption: config.enableEncryption ?? false,
    };
  }

  private getBrowserPaths(browserType: string): string[] {
    const platform = os.platform();
    const home = os.homedir();
    const paths: string[] = [];

    switch (browserType) {
      case BrowserType.CHROME:
        if (platform === 'darwin') {
          paths.push(
            path.join(home, 'Library/Application Support/Google/Chrome/Default/History'),
          );
        } else if (platform === 'win32') {
          paths.push(
            path.join(
              home,
              'AppData/Local/Google/Chrome/User Data/Default/History',
            ),
          );
        } else {
          paths.push(path.join(home, '.config/google-chrome/Default/History'));
        }
        break;

      case BrowserType.FIREFOX:
        if (platform === 'darwin') {
          paths.push(
            path.join(home, 'Library/Application Support/Firefox/Profiles'),
          );
        } else if (platform === 'win32') {
          paths.push(path.join(home, 'AppData/Roaming/Mozilla/Firefox/Profiles'));
        } else {
          paths.push(path.join(home, '.mozilla/firefox'));
        }
        break;

      case BrowserType.EDGE:
        if (platform === 'darwin') {
          paths.push(
            path.join(home, 'Library/Application Support/Microsoft Edge/Default/History'),
          );
        } else if (platform === 'win32') {
          paths.push(
            path.join(
              home,
              'AppData/Local/Microsoft/Edge/User Data/Default/History',
            ),
          );
        } else {
          paths.push(path.join(home, '.config/microsoft-edge/Default/History'));
        }
        break;

      case BrowserType.SAFARI:
        if (platform === 'darwin') {
          paths.push(path.join(home, 'Library/Safari/History.db'));
        }
        break;

      case BrowserType.OPERA:
        if (platform === 'darwin') {
          paths.push(
            path.join(home, 'Library/Application Support/com.operasoftware.Opera/History'),
          );
        } else if (platform === 'win32') {
          paths.push(
            path.join(
              home,
              'AppData/Roaming/Opera Software/Opera Stable/History',
            ),
          );
        } else {
          paths.push(path.join(home, '.config/opera/History'));
        }
        break;

      case BrowserType.BRAVE:
        if (platform === 'darwin') {
          paths.push(
            path.join(home, 'Library/Application Support/BraveSoftware/Brave-Browser/Default/History'),
          );
        } else if (platform === 'win32') {
          paths.push(
            path.join(
              home,
              'AppData/Local/BraveSoftware/Brave-Browser/User Data/Default/History',
            ),
          );
        } else {
          paths.push(path.join(home, '.config/BraveSoftware/Brave-Browser/Default/History'));
        }
        break;
    }

    return paths.filter((p) => fs.existsSync(p));
  }

  private async readChromeHistory(
    historyPath: string,
    browserType: string,
  ): Promise<HistoryEntry[]> {
    const entries: HistoryEntry[] = [];

    try {
      const tempPath = path.join(os.tmpdir(), `history-${Date.now()}.db`);
      fs.copyFileSync(historyPath, tempPath);

      const sqlite3 = await import('better-sqlite3');
      const db = sqlite3.default(tempPath, { readonly: true });

      const rows = db
        .prepare(
          `
        SELECT url, title, last_visit_time, visit_count
        FROM urls
        ORDER BY last_visit_time DESC
        LIMIT ?
      `,
        )
        .all(this.config.maxEntries);

      for (const row: unknown) {
        const r = row as {
          url: string;
          title: string;
          last_visit_time: number;
          visit_count: number;
        };
        entries.push({
          url: r.url,
          title: r.title || '',
          visitTime: r.last_visit_time,
          visitCount: r.visit_count,
          browser: browserType,
        });
      }

      db.close();
      fs.unlinkSync(tempPath);
    } catch (error) {
      console.error(`Error reading ${browserType} history:`, error);
    }

    return entries;
  }

  private async readFirefoxHistory(
    profilePath: string,
  ): Promise<HistoryEntry[]> {
    const entries: HistoryEntry[] = [];

    try {
      const profiles = fs.readdirSync(profilePath);

      for (const profile of profiles) {
        const placesPath = path.join(profilePath, profile, 'places.sqlite');

        if (fs.existsSync(placesPath)) {
          const tempPath = path.join(os.tmpdir(), `places-${Date.now()}.db`);
          fs.copyFileSync(placesPath, tempPath);

          const sqlite3 = await import('better-sqlite3');
          const db = sqlite3.default(tempPath, { readonly: true });

          const rows = db
            .prepare(
              `
            SELECT p.url, p.title, h.visit_date, p.visit_count
            FROM moz_places p
            JOIN moz_historyvisits h ON p.id = h.place_id
            ORDER BY h.visit_date DESC
            LIMIT ?
          `,
            )
            .all(this.config.maxEntries);

          for (const row: unknown) {
            const r = row as {
              url: string;
              title: string;
              visit_date: number;
              visit_count: number;
            };
            entries.push({
              url: r.url,
              title: r.title || '',
              visitTime: r.visit_date,
              visitCount: r.visit_count,
              browser: BrowserType.FIREFOX,
              profile,
            });
          }

          db.close();
          fs.unlinkSync(tempPath);
        }
      }
    } catch (error) {
      console.error('Error reading Firefox history:', error);
    }

    return entries;
  }

  async getAllHistory(): Promise<HistoryEntry[]> {
    const allEntries: HistoryEntry[] = [];

    for (const browser of this.config.browsers || []) {
      const paths = this.getBrowserPaths(browser);

      for (const browserPath of paths) {
        if (browser === BrowserType.FIREFOX) {
          const entries = await this.readFirefoxHistory(browserPath);
          allEntries.push(...entries);
        } else {
          const entries = await this.readChromeHistory(browserPath, browser);
          allEntries.push(...entries);
        }
      }
    }

    allEntries.sort((a, b) => b.visitTime - a.visitTime);

    return allEntries.slice(0, this.config.maxEntries);
  }

  startAutoSync(): void {
    if (this.config.autoSync && !this.syncTimer) {
      this.syncTimer = setInterval(() => {
        this.getAllHistory().catch((err) =>
          console.error('Auto-sync error:', err),
        );
      }, this.config.syncInterval);
    }
  }

  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }
}

export const browserHistoryTool: Tool = {
  name: 'browser_history',
  description:
    'Access and analyze browser history from Chrome, Firefox, Edge, Safari, Opera, and Brave browsers. Supports multi-browser, cross-platform access with autonomous sync.',
  schema: {
    type: 'object',
    properties: {
      browser: {
        type: 'string',
        enum: Object.values(BrowserType),
        description: 'Browser to read history from',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of entries to return',
        default: 100,
      },
      autoSync: {
        type: 'boolean',
        description: 'Enable automatic history synchronization',
        default: false,
      },
    },
  },
  execute: async (params: Record<string, unknown>) => {
    const config: Partial<BrowserHistoryConfig> = {
      maxEntries: (params.limit as number) || 100,
      autoSync: (params.autoSync as boolean) || false,
      browsers: params.browser ? [params.browser as string] : undefined,
    };

    const manager = new BrowserHistoryManager(config);

    if (config.autoSync) {
      manager.startAutoSync();
    }

    const history = await manager.getAllHistory();

    return {
      success: true,
      data: history,
      message: `Retrieved ${history.length} history entries`,
    };
  },
};
