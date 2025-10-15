/**
 * Type definitions for LLM tools
 * Provides interfaces and types for browser history and other tools
 */

export interface HistoryEntry {
  url: string;
  title: string;
  visitTime: number;
  visitCount: number;
  browser: string;
  profile?: string;
}

export interface BrowserHistoryConfig {
  autoSync?: boolean;
  syncInterval?: number;
  maxEntries?: number;
  browsers?: string[];
  filters?: string[];
  crossPlatform?: boolean;
  enableEncryption?: boolean;
}

export interface Tool {
  name: string;
  description: string;
  execute(params: Record<string, unknown>): Promise<string>;
  destroy?(): void;
}

export interface ToolExecutionParams {
  action: string;
  [key: string]: unknown;
}

export interface ToolResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
}

export enum BrowserType {
  CHROME = 'chrome',
  FIREFOX = 'firefox',
  EDGE = 'edge',
  SAFARI = 'safari',
  OPERA = 'opera',
  BRAVE = 'brave',
}

export interface DatabaseStats {
  totalBrowsers: number;
  supportedBrowsers: string[];
  cachedEntries: number;
  lastSync: number;
  cacheAge: number;
  autoSync: boolean;
  syncInterval: number;
  platform: string;
}

export interface SearchOptions {
  browser?: string;
  maxResults?: number;
  startTime?: number;
  endTime?: number;
}

export default Tool;