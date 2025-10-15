/**
 * Multi-Tier Cache System
 * 
 * Implements L1/L2/L3 caching architecture for lightning-fast performance:
 * - L1: In-memory hot cache (sub-millisecond access)
 * - L2: Compressed memory cache (fast access with space efficiency)
 * - L3: Persistent disk cache (durable storage)
 * - Target: >95% cache hit rate (up from 85%)
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  hitCount: number;
  size: number;
  compressed?: boolean;
}

export interface CacheMetrics {
  l1: { hits: number; misses: number; size: number; entries: number };
  l2: { hits: number; misses: number; size: number; entries: number };
  l3: { hits: number; misses: number; size: number; entries: number };
  totalHitRate: number;
  memoryEfficiency: number;
}

class L1Cache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private maxEntries: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize: number = 50 * 1024 * 1024, maxEntries: number = 10000) { // 50MB, 10k entries
    this.maxSize = maxSize;
    this.maxEntries = maxEntries;
  }

  get<T = any>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    entry.hitCount++;
    this.hits++;
    return entry.value;
  }

  set<T = any>(key: string, value: T, ttl: number = 300000): boolean { // 5 minutes default
    const size = this.estimateSize(value);
    
    // Check if we have space
    if (this.cache.size >= this.maxEntries || this.getCurrentSize() + size > this.maxSize) {
      if (!this.evictLRU(size)) {
        return false; // Could not make space
      }
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl,
      hitCount: 0,
      size
    };

    this.cache.set(key, entry);
    return true;
  }

  private evictLRU(requiredSize: number): boolean {
    // Sort by hit count and timestamp (LRU with popularity)
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => {
        // Prioritize eviction by lowest hit count, then oldest timestamp
        if (a.hitCount !== b.hitCount) {
          return a.hitCount - b.hitCount;
        }
        return a.timestamp - b.timestamp;
      });

    let freedSize = 0;
    let evicted = 0;

    for (const [key, entry] of entries) {
      this.cache.delete(key);
      freedSize += entry.size;
      evicted++;
      
      if (freedSize >= requiredSize || evicted >= this.cache.size * 0.1) {
        break; // Freed enough space or evicted 10% of cache
      }
    }

    console.log(`L1 evicted ${evicted} entries, freed ${(freedSize / 1024 / 1024).toFixed(2)}MB`);
    return freedSize >= requiredSize;
  }

  private estimateSize(value: any): number {
    return JSON.stringify(value).length * 2; // Rough estimate
  }

  private getCurrentSize(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  getMetrics(): { hits: number; misses: number; size: number; entries: number } {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.getCurrentSize(),
      entries: this.cache.size
    };
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

class L2Cache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private maxEntries: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize: number = 200 * 1024 * 1024, maxEntries: number = 50000) { // 200MB, 50k entries
    this.maxSize = maxSize;
    this.maxEntries = maxEntries;
  }

  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    entry.hitCount++;
    this.hits++;

    // Decompress if necessary
    if (entry.compressed) {
      try {
        const decompressed = await gunzip(entry.value as Buffer);
        return JSON.parse(decompressed.toString());
      } catch (error) {
        console.error('L2 decompression error:', error);
        this.cache.delete(key);
        return null;
      }
    }

    return entry.value;
  }

  async set<T = any>(key: string, value: T, ttl: number = 900000): Promise<boolean> { // 15 minutes default
    const serialized = JSON.stringify(value);
    const originalSize = serialized.length * 2;
    
    // Compress large values
    let finalValue: any = value;
    let compressed = false;
    let finalSize = originalSize;

    if (originalSize > 10240) { // Compress values > 10KB
      try {
        const compressedBuffer = await gzip(serialized);
        if (compressedBuffer.length < originalSize * 0.8) { // Only if >20% compression
          finalValue = compressedBuffer;
          compressed = true;
          finalSize = compressedBuffer.length;
        }
      } catch (error) {
        console.warn('L2 compression failed:', error);
      }
    }

    // Check if we have space
    if (this.cache.size >= this.maxEntries || this.getCurrentSize() + finalSize > this.maxSize) {
      if (!await this.evictLRU(finalSize)) {
        return false;
      }
    }

    const entry: CacheEntry = {
      key,
      value: finalValue,
      timestamp: Date.now(),
      ttl,
      hitCount: 0,
      size: finalSize,
      compressed
    };

    this.cache.set(key, entry);
    return true;
  }

  private async evictLRU(requiredSize: number): Promise<boolean> {
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => {
        // LRU with hit count weighting
        const aScore = a.hitCount / (Date.now() - a.timestamp);
        const bScore = b.hitCount / (Date.now() - b.timestamp);
        return aScore - bScore;
      });

    let freedSize = 0;
    let evicted = 0;

    for (const [key, entry] of entries) {
      this.cache.delete(key);
      freedSize += entry.size;
      evicted++;
      
      if (freedSize >= requiredSize) break;
    }

    console.log(`L2 evicted ${evicted} entries, freed ${(freedSize / 1024 / 1024).toFixed(2)}MB`);
    return freedSize >= requiredSize;
  }

  private getCurrentSize(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  getMetrics(): { hits: number; misses: number; size: number; entries: number } {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.getCurrentSize(),
      entries: this.cache.size
    };
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

class L3Cache {
  private cacheDir: string;
  private index = new Map<string, { file: string; timestamp: number; ttl: number; size: number }>();
  private hits = 0;
  private misses = 0;
  private maxSize: number;

  constructor(cacheDir: string = '.cache/l3', maxSize: number = 1024 * 1024 * 1024) { // 1GB
    this.cacheDir = cacheDir;
    this.maxSize = maxSize;
    this.initializeCache();
  }

  private async initializeCache(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      await this.loadIndex();
    } catch (error) {
      console.error('L3 cache initialization error:', error);
    }
  }

  private async loadIndex(): Promise<void> {
    try {
      const indexPath = path.join(this.cacheDir, 'index.json');
      const indexData = await fs.readFile(indexPath, 'utf-8');
      const indexEntries = JSON.parse(indexData);
      
      this.index = new Map(indexEntries);
      
      // Clean up expired entries
      await this.cleanupExpired();
    } catch (error) {
      // Index doesn't exist yet, that's fine
      console.log('Creating new L3 cache index');
    }
  }

  private async saveIndex(): Promise<void> {
    try {
      const indexPath = path.join(this.cacheDir, 'index.json');
      const indexData = JSON.stringify(Array.from(this.index.entries()));
      await fs.writeFile(indexPath, indexData);
    } catch (error) {
      console.error('Failed to save L3 index:', error);
    }
  }

  private generateCacheKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  async get<T = any>(key: string): Promise<T | null> {
    const cacheKey = this.generateCacheKey(key);
    const meta = this.index.get(key);
    
    if (!meta) {
      this.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() > meta.timestamp + meta.ttl) {
      await this.delete(key);
      this.misses++;
      return null;
    }

    try {
      const filePath = path.join(this.cacheDir, meta.file);
      const compressedData = await fs.readFile(filePath);
      const decompressed = await gunzip(compressedData);
      const value = JSON.parse(decompressed.toString());
      
      this.hits++;
      return value;
    } catch (error) {
      console.error('L3 read error:', error);
      await this.delete(key);
      this.misses++;
      return null;
    }
  }

  async set<T = any>(key: string, value: T, ttl: number = 3600000): Promise<boolean> { // 1 hour default
    const cacheKey = this.generateCacheKey(key);
    const fileName = `${cacheKey}.gz`;
    const filePath = path.join(this.cacheDir, fileName);
    
    try {
      // Serialize and compress
      const serialized = JSON.stringify(value);
      const compressed = await gzip(serialized);
      const size = compressed.length;

      // Check if we have space
      if (this.getCurrentSize() + size > this.maxSize) {
        await this.evictLRU(size);
      }

      // Write to disk
      await fs.writeFile(filePath, compressed);
      
      // Update index
      this.index.set(key, {
        file: fileName,
        timestamp: Date.now(),
        ttl,
        size
      });
      
      await this.saveIndex();
      return true;
    } catch (error) {
      console.error('L3 write error:', error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    const meta = this.index.get(key);
    if (!meta) return false;

    try {
      const filePath = path.join(this.cacheDir, meta.file);
      await fs.unlink(filePath);
      this.index.delete(key);
      await this.saveIndex();
      return true;
    } catch (error) {
      console.error('L3 delete error:', error);
      return false;
    }
  }

  private getCurrentSize(): number {
    let totalSize = 0;
    for (const meta of this.index.values()) {
      totalSize += meta.size;
    }
    return totalSize;
  }

  private async evictLRU(requiredSize: number): Promise<void> {
    const entries = Array.from(this.index.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp); // Oldest first

    let freedSize = 0;
    let evicted = 0;

    for (const [key] of entries) {
      const meta = this.index.get(key);
      if (meta) {
        await this.delete(key);
        freedSize += meta.size;
        evicted++;
        
        if (freedSize >= requiredSize) break;
      }
    }

    console.log(`L3 evicted ${evicted} entries, freed ${(freedSize / 1024 / 1024).toFixed(2)}MB`);
  }

  private async cleanupExpired(): Promise<void> {
    const now = Date.now();
    const expired: string[] = [];

    for (const [key, meta] of this.index.entries()) {
      if (now > meta.timestamp + meta.ttl) {
        expired.push(key);
      }
    }

    for (const key of expired) {
      await this.delete(key);
    }

    if (expired.length > 0) {
      console.log(`L3 cleaned up ${expired.length} expired entries`);
    }
  }

  getMetrics(): { hits: number; misses: number; size: number; entries: number } {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.getCurrentSize(),
      entries: this.index.size
    };
  }

  async clear(): Promise<void> {
    try {
      // Remove all cache files
      for (const meta of this.index.values()) {
        const filePath = path.join(this.cacheDir, meta.file);
        try {
          await fs.unlink(filePath);
        } catch (error) {
          // File might already be deleted
        }
      }
      
      this.index.clear();
      await this.saveIndex();
      this.hits = 0;
      this.misses = 0;
    } catch (error) {
      console.error('L3 clear error:', error);
    }
  }
}

export class MultiTierCache extends EventEmitter {
  private l1: L1Cache;
  private l2: L2Cache;
  private l3: L3Cache;
  private config: {
    enableL1: boolean;
    enableL2: boolean;
    enableL3: boolean;
    promotionThreshold: number;
    metricsInterval: number;
  };

  constructor() {
    super();
    
    this.config = {
      enableL1: true,
      enableL2: true,
      enableL3: true,
      promotionThreshold: 5, // Promote to higher tier after 5 hits
      metricsInterval: 30000 // 30 seconds
    };

    this.l1 = new L1Cache();
    this.l2 = new L2Cache();
    this.l3 = new L3Cache();
    
    this.startMetricsReporting();
  }

  private startMetricsReporting(): void {
    setInterval(() => {
      const metrics = this.getMetrics();
      this.emit('metrics', metrics);
    }, this.config.metricsInterval);
  }

  async get<T = any>(key: string): Promise<T | null> {
    const startTime = performance.now();
    let result: T | null = null;
    let tier = '';

    try {
      // L1 Cache (fastest)
      if (this.config.enableL1) {
        result = this.l1.get<T>(key);
        if (result !== null) {
          tier = 'L1';
          return result;
        }
      }

      // L2 Cache (compressed memory)
      if (this.config.enableL2) {
        result = await this.l2.get<T>(key);
        if (result !== null) {
          tier = 'L2';
          // Promote to L1 for hot data
          if (this.config.enableL1) {
            this.l1.set(key, result, 300000); // 5 minutes in L1
          }
          return result;
        }
      }

      // L3 Cache (persistent disk)
      if (this.config.enableL3) {
        result = await this.l3.get<T>(key);
        if (result !== null) {
          tier = 'L3';
          // Promote to L2 and potentially L1
          if (this.config.enableL2) {
            await this.l2.set(key, result, 900000); // 15 minutes in L2
          }
          if (this.config.enableL1) {
            this.l1.set(key, result, 300000); // 5 minutes in L1
          }
          return result;
        }
      }

      return null;
    } finally {
      const duration = performance.now() - startTime;
      this.emit('access', { key, tier, duration, hit: result !== null });
    }
  }

  async set<T = any>(key: string, value: T, ttl?: number): Promise<boolean> {
    const promises: Promise<boolean>[] = [];
    
    // Set in all enabled tiers with appropriate TTLs
    if (this.config.enableL1) {
      promises.push(Promise.resolve(this.l1.set(key, value, ttl || 300000)));
    }
    
    if (this.config.enableL2) {
      promises.push(this.l2.set(key, value, ttl || 900000));
    }
    
    if (this.config.enableL3) {
      promises.push(this.l3.set(key, value, ttl || 3600000));
    }

    const results = await Promise.allSettled(promises);
    const successes = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    
    return successes > 0; // Success if at least one tier succeeded
  }

  async delete(key: string): Promise<boolean> {
    const promises: Promise<boolean>[] = [];
    
    if (this.config.enableL1) {
      this.l1.delete(key);
    }
    
    if (this.config.enableL2) {
      this.l2.delete(key);
    }
    
    if (this.config.enableL3) {
      promises.push(this.l3.delete(key));
    }

    await Promise.allSettled(promises);
    return true;
  }

  getMetrics(): CacheMetrics {
    const l1Metrics = this.l1.getMetrics();
    const l2Metrics = this.l2.getMetrics();
    const l3Metrics = this.l3.getMetrics();
    
    const totalHits = l1Metrics.hits + l2Metrics.hits + l3Metrics.hits;
    const totalMisses = l1Metrics.misses + l2Metrics.misses + l3Metrics.misses;
    const totalRequests = totalHits + totalMisses;
    
    const totalHitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
    const memoryEfficiency = (l1Metrics.size + l2Metrics.size) / (1024 * 1024); // MB

    return {
      l1: l1Metrics,
      l2: l2Metrics,
      l3: l3Metrics,
      totalHitRate,
      memoryEfficiency
    };
  }

  async clear(): Promise<void> {
    this.l1.clear();
    this.l2.clear();
    await this.l3.clear();
  }

  // Performance optimization method
  async optimize(): Promise<{ cacheHitRate: number; memoryFreed: number }> {
    const beforeMetrics = this.getMetrics();
    const beforeMemory = process.memoryUsage().heapUsed;
    
    // Trigger cleanup in all tiers
    await this.l3.cleanupExpired();
    
    // Wait for operations to settle
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const afterMetrics = this.getMetrics();
    const afterMemory = process.memoryUsage().heapUsed;
    
    return {
      cacheHitRate: afterMetrics.totalHitRate,
      memoryFreed: beforeMemory - afterMemory
    };
  }
}

// Singleton instance
let multiTierCacheInstance: MultiTierCache | null = null;

export function getCache(): MultiTierCache {
  if (!multiTierCacheInstance) {
    multiTierCacheInstance = new MultiTierCache();
  }
  return multiTierCacheInstance;
}

export function destroyCache(): Promise<void> {
  if (multiTierCacheInstance) {
    return multiTierCacheInstance.clear().then(() => {
      multiTierCacheInstance = null;
    });
  }
  return Promise.resolve();
}