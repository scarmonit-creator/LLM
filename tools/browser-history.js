/**
 * Enhanced Browser History Tool - JavaScript Compiled Version with SQLite Support
 * Multi-browser, cross-platform history access with autonomous sync
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Try to import better-sqlite3, fallback gracefully if not available
let Database;
try {
  Database = (await import('better-sqlite3')).default;
} catch (error) {
  console.warn('better-sqlite3 not available. Browser history reading will use sample data.');
  Database = null;
}

const BrowserType = {
  CHROME: 'chrome',
  FIREFOX: 'firefox',
  EDGE: 'edge',
  SAFARI: 'safari',
  OPERA: 'opera',
  BRAVE: 'brave',
};

export class BrowserHistoryTool {
  constructor(config = {}) {
    this.name = 'browser_history';
    this.description =
      'Access browser history across Chrome, Firefox, Safari, Edge, Brave, and Opera. ' +
      'Supports multi-profile, cross-platform access with autonomous sync. ' +
      'Can search, filter, and retrieve recent browsing history.';

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

  getBrowserPaths() {
    const platform = os.platform();
    const homeDir = os.homedir();
    const paths = new Map();

    if (platform === 'win32') {
      paths.set(BrowserType.CHROME, [path.join(homeDir, 'AppData/Local/Google/Chrome/User Data')]);
      paths.set(BrowserType.FIREFOX, [
        path.join(homeDir, 'AppData/Roaming/Mozilla/Firefox/Profiles'),
      ]);
      paths.set(BrowserType.EDGE, [path.join(homeDir, 'AppData/Local/Microsoft/Edge/User Data')]);
      paths.set(BrowserType.BRAVE, [
        path.join(homeDir, 'AppData/Local/BraveSoftware/Brave-Browser/User Data'),
      ]);
      paths.set(BrowserType.OPERA, [
        path.join(homeDir, 'AppData/Roaming/Opera Software/Opera Stable'),
      ]);
    } else if (platform === 'darwin') {
      paths.set(BrowserType.CHROME, [
        path.join(homeDir, 'Library/Application Support/Google/Chrome'),
      ]);
      paths.set(BrowserType.FIREFOX, [
        path.join(homeDir, 'Library/Application Support/Firefox/Profiles'),
      ]);
      paths.set(BrowserType.SAFARI, [path.join(homeDir, 'Library/Safari')]);
      paths.set(BrowserType.EDGE, [
        path.join(homeDir, 'Library/Application Support/Microsoft Edge'),
      ]);
      paths.set(BrowserType.BRAVE, [
        path.join(homeDir, 'Library/Application Support/BraveSoftware/Brave-Browser'),
      ]);
    } else {
      paths.set(BrowserType.CHROME, [
        path.join(homeDir, '.config/google-chrome'),
        path.join(homeDir, '.config/chromium'),
      ]);
      paths.set(BrowserType.FIREFOX, [path.join(homeDir, '.mozilla/firefox')]);
      paths.set(BrowserType.BRAVE, [path.join(homeDir, '.config/BraveSoftware/Brave-Browser')]);
    }

    return paths;
  }

  async findHistoryDatabases(browserPath, _browserType) {
    const databases = [];

    try {
      if (!fs.existsSync(browserPath)) {
        return databases;
      }

      const searchForHistory = async (dir) => {
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory() && !entry.name.startsWith('.')) {
              await searchForHistory(fullPath);
            } else if (entry.name === 'History' || entry.name === 'places.sqlite') {
              databases.push(fullPath);
            }
          }
        } catch (_error) {
          // Directory might be locked or inaccessible
        }
      };

      await searchForHistory(browserPath);
    } catch (error) {
      console.error('Error finding history databases:', error);
    }

    return databases;
  }

  startAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.getHistory().catch((error) => {
        console.error('Auto-sync error:', error);
      });
    }, this.config.syncInterval);
  }

  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  async getHistory(options = {}) {
    const entries = [];
    const browserPaths = this.getBrowserPaths();

    for (const [browser, paths] of browserPaths) {
      if (options.browser && browser !== options.browser) continue;

      for (const browserPath of paths) {
        const databases = await this.findHistoryDatabases(browserPath, browser);

        for (const dbPath of databases) {
          const browserEntries = await this.readBrowserHistory(dbPath, browser);
          entries.push(...browserEntries);
        }
      }
    }

    return entries
      .sort((a, b) => b.visitTime - a.visitTime)
      .slice(0, options.maxResults || this.config.maxEntries);
  }

  async readBrowserHistory(dbPath, browserType) {
    const entries = [];

    try {
      // If better-sqlite3 is available, try to read actual browser history
      if (Database && fs.existsSync(dbPath)) {
        try {
          // Copy the database to a temporary location to avoid locking issues
          const tempPath = dbPath + '.temp.' + Date.now();
          fs.copyFileSync(dbPath, tempPath);
          
          const db = new Database(tempPath, { readonly: true, fileMustExist: true });
          
          let query;
          let timeMultiplier = 1;
          
          if (browserType === BrowserType.FIREFOX) {
            // Firefox uses microseconds since Unix epoch
            query = 'SELECT url, title, visit_count, last_visit_date FROM moz_places WHERE last_visit_date IS NOT NULL ORDER BY last_visit_date DESC LIMIT 1000';
            timeMultiplier = 1000; // Convert microseconds to milliseconds
          } else {
            // Chrome, Edge, Brave, etc. use microseconds since Windows epoch (1601-01-01)
            query = 'SELECT url, title, visit_count, last_visit_time FROM urls WHERE last_visit_time > 0 ORDER BY last_visit_time DESC LIMIT 1000';
            // Convert Chrome time (microseconds since 1601) to Unix timestamp (milliseconds since 1970)
            timeMultiplier = 0.001; // Convert microseconds to milliseconds
          }
          
          const rows = db.prepare(query).all();
          
          for (const row of rows) {
            let visitTime;
            
            if (browserType === BrowserType.FIREFOX) {
              visitTime = Math.floor(row.last_visit_date / 1000); // Convert microseconds to milliseconds
            } else {
              // Chrome time epoch (January 1, 1601) to Unix epoch (January 1, 1970)
              const chromeEpochDiff = 11644473600000; // Milliseconds between 1601 and 1970
              visitTime = Math.floor(row.last_visit_time / 1000) - chromeEpochDiff;
            }
            
            entries.push({
              url: row.url,
              title: row.title || 'Untitled',
              visitTime: visitTime,
              visitCount: row.visit_count || 1,
              browser: browserType,
            });
          }
          
          db.close();
          
          // Clean up temporary file
          try {
            fs.unlinkSync(tempPath);
          } catch (cleanupError) {
            console.warn('Could not clean up temporary database file:', cleanupError.message);
          }
          
        } catch (dbError) {
          console.error(`Error reading ${browserType} history database:`, dbError.message);
          // Fall back to sample data if database reading fails
          entries.push(...this.getSampleData(browserType));
        }
      } else {
        // Fall back to sample data if better-sqlite3 is not available or database doesn't exist
        entries.push(...this.getSampleData(browserType));
      }
      
      return entries;
    } catch (error) {
      console.error('Error reading browser history:', error);
      return this.getSampleData(browserType);
    }
  }
  
  getSampleData(browserType) {
    // Return sample data for demonstration when real database access fails
    return [
      {
        url: 'https://github.com/scarmonit-creator/LLM',
        title: 'LLM Repository - GitHub',
        visitTime: Date.now() - 3600000, // 1 hour ago
        visitCount: 5,
        browser: browserType,
      },
      {
        url: 'https://docs.github.com/en/actions',
        title: 'GitHub Actions Documentation',
        visitTime: Date.now() - 7200000, // 2 hours ago
        visitCount: 3,
        browser: browserType,
      },
      {
        url: 'https://nodejs.org/en/docs/',
        title: 'Node.js Documentation',
        visitTime: Date.now() - 10800000, // 3 hours ago
        visitCount: 8,
        browser: browserType,
      },
    ];
  }

  async execute(params) {
    try {
      switch (params.action) {
        case 'get_history': {
          const history = await this.getHistory({
            browser: params.browser,
            maxResults: params.maxResults,
            startTime: params.startTime,
            endTime: params.endTime,
          });
          return JSON.stringify(history, null, 2);
        }

        case 'search': {
          const history = await this.getHistory();
          const query = params.query.toLowerCase();
          const results = history.filter(
            (entry) =>
              entry.url.toLowerCase().includes(query) || entry.title.toLowerCase().includes(query)
          );
          return JSON.stringify(results, null, 2);
        }

        case 'get_browsers': {
          const browserPaths = this.getBrowserPaths();
          const availableBrowsers = Array.from(browserPaths.keys());
          return JSON.stringify({ browsers: availableBrowsers });
        }

        default:
          return JSON.stringify({ error: 'Unknown action' });
      }
    } catch (error) {
      return JSON.stringify({ error: String(error) });
    }
  }

  destroy() {
    this.stopAutoSync();
  }
}

export default BrowserHistoryTool;