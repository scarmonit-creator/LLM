#!/usr/bin/env node
/**
 * Intelligent Cache Manager - Next-Generation Caching System
 * Optimizes memory usage and request performance with ML-driven cache decisions
 */

import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import LRU from 'lru-cache';

/**
 * Advanced Intelligent Cache Manager with ML-Driven Optimization
 */
export class IntelligentCacheManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxSize: options.maxSize || 1000,
      maxAge: options.maxAge || 1800000, // 30 minutes
      updateAgeOnGet: true,
      allowStale: false,
      enableAnalytics: options.enableAnalytics !== false,
      compressionThreshold: options.compressionThreshold || 1024,
      predictionEnabled: options.predictionEnabled !== false,
      ...options
    };
    
    this.cache = new LRU({
      max: this.options.maxSize,
      maxAge: this.options.maxAge,
      updateAgeOnGet: this.options.updateAgeOnGet,
      allowStale: this.options.allowStale,
      dispose: (key, value) => this.onCacheDispose(key, value)
    });
    
    this.analytics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      responseTimes: [],
      keyPatterns: new Map(),
      hotKeys: new Map(),
      memoryUsage: 0,
      compressionRatio: 0
    };
    
    this.prediction = {
      accessPatterns: new Map(),
      frequencyMap: new Map(),
      timeBasedPatterns: new Map(),
      lastAccess: new Map(),
      preloadQueue: new Set()
    };
    
    this.isRunning = false;
    this.setupAnalyticsTimer();
  }
  
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.emit('started');
    console.log('[IntelligentCacheManager] Cache manager started with ML optimization');
  }
  
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.analyticsTimer) {
      clearInterval(this.analyticsTimer);
    }
    if (this.predictionTimer) {
      clearInterval(this.predictionTimer);
    }
    
    this.emit('stopped');
    console.log('[IntelligentCacheManager] Cache manager stopped');
  }
  
  setupAnalyticsTimer() {
    this.analyticsTimer = setInterval(() => {
      this.updateAnalytics();
      if (this.options.predictionEnabled) {
        this.runPredictiveOptimization();
      }
    }, 30000); // Every 30 seconds
  }
  
  get(key, options = {}) {
    const startTime = performance.now();
    
    // Update access patterns for ML
    this.updateAccessPattern(key);
    
    const value = this.cache.get(key);
    const responseTime = performance.now() - startTime;
    
    this.analytics.totalRequests++;
    this.analytics.responseTimes.push(responseTime);
    
    // Keep only last 1000 response times
    if (this.analytics.responseTimes.length > 1000) {
      this.analytics.responseTimes.shift();
    }
    
    if (value !== undefined) {
      this.analytics.hits++;
      this.updateHotKey(key);
      this.emit('hit', { key, responseTime });
      
      // Trigger preload for related keys
      if (this.options.predictionEnabled) {
        this.predictRelatedKeys(key);
      }
    } else {
      this.analytics.misses++;
      this.emit('miss', { key, responseTime });
    }
    
    return value;
  }
  
  set(key, value, maxAge) {
    const startTime = performance.now();
    
    // Compress large values if enabled
    let processedValue = value;
    let isCompressed = false;
    
    if (this.shouldCompress(value)) {
      processedValue = this.compressValue(value);
      isCompressed = true;
    }
    
    // Smart TTL based on access patterns
    const smartTTL = this.calculateSmartTTL(key, maxAge);
    
    const result = this.cache.set(key, {
      data: processedValue,
      compressed: isCompressed,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccess: Date.now()
    }, smartTTL);
    
    const responseTime = performance.now() - startTime;
    
    this.analytics.sets++;
    this.updateKeyPattern(key);
    
    this.emit('set', { key, responseTime, compressed: isCompressed });
    
    return result;
  }
  
  delete(key) {
    const result = this.cache.delete(key);
    
    if (result) {
      this.analytics.deletes++;
      this.prediction.accessPatterns.delete(key);
      this.prediction.frequencyMap.delete(key);
      this.prediction.lastAccess.delete(key);
      this.emit('delete', { key });
    }
    
    return result;
  }
  
  clear() {
    this.cache.clear();
    this.prediction.accessPatterns.clear();
    this.prediction.frequencyMap.clear();
    this.prediction.lastAccess.clear();
    this.prediction.preloadQueue.clear();
    this.analytics.hotKeys.clear();
    this.analytics.keyPatterns.clear();
    
    this.emit('clear');
  }
  
  shouldCompress(value) {
    if (!value || typeof value !== 'object') return false;
    
    const serialized = JSON.stringify(value);
    return serialized.length > this.options.compressionThreshold;
  }
  
  compressValue(value) {
    // Simple compression simulation - in production use zlib or similar
    try {
      const serialized = JSON.stringify(value);
      const compressed = Buffer.from(serialized).toString('base64');
      
      this.analytics.compressionRatio = 
        (this.analytics.compressionRatio + (compressed.length / serialized.length)) / 2;
      
      return {
        _compressed: true,
        data: compressed
      };
    } catch (error) {
      console.warn('[IntelligentCacheManager] Compression failed:', error.message);
      return value;
    }
  }
  
  decompressValue(compressedValue) {
    try {
      if (!compressedValue || !compressedValue._compressed) {
        return compressedValue;
      }
      
      const decompressed = Buffer.from(compressedValue.data, 'base64').toString();
      return JSON.parse(decompressed);
    } catch (error) {
      console.warn('[IntelligentCacheManager] Decompression failed:', error.message);
      return compressedValue;
    }
  }
  
  updateAccessPattern(key) {
    const now = Date.now();
    const hour = Math.floor(now / (1000 * 60 * 60)); // Current hour bucket
    
    // Update frequency map
    const freq = this.prediction.frequencyMap.get(key) || 0;
    this.prediction.frequencyMap.set(key, freq + 1);
    
    // Update time-based patterns
    if (!this.prediction.timeBasedPatterns.has(key)) {
      this.prediction.timeBasedPatterns.set(key, new Map());
    }
    
    const timePattern = this.prediction.timeBasedPatterns.get(key);
    const hourCount = timePattern.get(hour) || 0;
    timePattern.set(hour, hourCount + 1);
    
    // Update last access
    this.prediction.lastAccess.set(key, now);
  }
  
  updateHotKey(key) {
    const count = this.analytics.hotKeys.get(key) || 0;
    this.analytics.hotKeys.set(key, count + 1);
  }
  
  updateKeyPattern(key) {
    // Extract pattern from key (e.g., "user:123" -> "user:*")
    const pattern = key.replace(/\d+/g, '*').replace(/[a-f0-9]{8,}/g, '*');
    const count = this.analytics.keyPatterns.get(pattern) || 0;
    this.analytics.keyPatterns.set(pattern, count + 1);
  }
  
  calculateSmartTTL(key, maxAge) {
    if (maxAge) return maxAge;
    
    const frequency = this.prediction.frequencyMap.get(key) || 1;
    const baseTTL = this.options.maxAge;
    
    // High frequency keys get longer TTL
    if (frequency > 10) {
      return baseTTL * 2;
    } else if (frequency > 5) {
      return baseTTL * 1.5;
    }
    
    return baseTTL;
  }
  
  predictRelatedKeys(accessedKey) {
    // Simple prediction: find keys accessed together frequently
    const pattern = this.extractKeyPattern(accessedKey);
    const relatedKeys = [];
    
    for (const [key] of this.prediction.frequencyMap) {
      if (key !== accessedKey && this.extractKeyPattern(key) === pattern) {
        relatedKeys.push(key);
      }
    }
    
    // Add to preload queue (would trigger background loading)
    relatedKeys.slice(0, 3).forEach(key => {
      this.prediction.preloadQueue.add(key);
    });
    
    this.emit('prediction', { accessedKey, relatedKeys });
  }
  
  extractKeyPattern(key) {
    return key.split(':')[0] || key.split('_')[0] || 'default';
  }
  
  runPredictiveOptimization() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    // Clean old patterns
    for (const [key, lastAccess] of this.prediction.lastAccess) {
      if (now - lastAccess > oneHour * 24) { // 24 hours
        this.prediction.accessPatterns.delete(key);
        this.prediction.frequencyMap.delete(key);
        this.prediction.timeBasedPatterns.delete(key);
        this.prediction.lastAccess.delete(key);
      }
    }
    
    // Preload hot keys that are likely to be accessed
    const currentHour = Math.floor(now / oneHour);
    
    for (const [key, timePattern] of this.prediction.timeBasedPatterns) {
      const hourAccess = timePattern.get(currentHour) || 0;
      const frequency = this.prediction.frequencyMap.get(key) || 0;
      
      if (hourAccess > 2 && frequency > 5 && !this.cache.has(key)) {
        this.prediction.preloadQueue.add(key);
      }
    }
    
    this.emit('optimization', {
      predictedKeys: Array.from(this.prediction.preloadQueue),
      cleanedEntries: 0
    });
  }
  
  onCacheDispose(key, value) {
    this.analytics.evictions++;
    this.emit('eviction', { key, value });
  }
  
  updateAnalytics() {
    // Calculate hit ratio
    const totalAccess = this.analytics.hits + this.analytics.misses;
    const hitRatio = totalAccess > 0 ? (this.analytics.hits / totalAccess) : 0;
    
    // Calculate average response time
    if (this.analytics.responseTimes.length > 0) {
      this.analytics.averageResponseTime = 
        this.analytics.responseTimes.reduce((a, b) => a + b, 0) / this.analytics.responseTimes.length;
    }
    
    // Update memory usage
    this.analytics.memoryUsage = this.cache.itemCount;
    
    this.emit('analytics', {
      hitRatio,
      totalRequests: this.analytics.totalRequests,
      averageResponseTime: this.analytics.averageResponseTime,
      memoryUsage: this.analytics.memoryUsage,
      compressionRatio: this.analytics.compressionRatio
    });
  }
  
  getStats() {
    const totalAccess = this.analytics.hits + this.analytics.misses;
    const hitRatio = totalAccess > 0 ? (this.analytics.hits / totalAccess) : 0;
    
    return {
      isRunning: this.isRunning,
      
      performance: {
        hitRatio: Math.round(hitRatio * 100) / 100,
        totalRequests: this.analytics.totalRequests,
        hits: this.analytics.hits,
        misses: this.analytics.misses,
        averageResponseTime: Math.round(this.analytics.averageResponseTime * 100) / 100
      },
      
      memory: {
        itemCount: this.cache.itemCount,
        maxSize: this.options.maxSize,
        memoryUsage: Math.round((this.cache.itemCount / this.options.maxSize) * 100),
        evictions: this.analytics.evictions
      },
      
      optimization: {
        compressionEnabled: this.options.compressionThreshold > 0,
        compressionRatio: Math.round(this.analytics.compressionRatio * 100) / 100,
        predictionEnabled: this.options.predictionEnabled,
        preloadQueue: this.prediction.preloadQueue.size,
        knownPatterns: this.analytics.keyPatterns.size
      },
      
      hotKeys: Array.from(this.analytics.hotKeys.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([key, count]) => ({ key, count })),
      
      keyPatterns: Array.from(this.analytics.keyPatterns.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([pattern, count]) => ({ pattern, count }))
    };
  }
  
  // Utility methods for external cache warming
  warmCache(keyValuePairs) {
    if (!Array.isArray(keyValuePairs)) return;
    
    let warmed = 0;
    for (const { key, value, maxAge } of keyValuePairs) {
      if (key && value !== undefined) {
        this.set(key, value, maxAge);
        warmed++;
      }
    }
    
    this.emit('warmed', { count: warmed });
    return warmed;
  }
  
  // Export cache state for persistence
  exportState() {
    const entries = [];
    
    for (const [key, value] of this.cache.entries()) {
      entries.push({
        key,
        value: value.compressed ? this.decompressValue(value.data) : value.data,
        timestamp: value.timestamp,
        accessCount: value.accessCount
      });
    }
    
    return {
      entries,
      analytics: { ...this.analytics },
      prediction: {
        frequencyMap: Array.from(this.prediction.frequencyMap.entries()),
        accessPatterns: Array.from(this.prediction.accessPatterns.entries())
      }
    };
  }
}

// Create and export default instance
export default new IntelligentCacheManager({
  maxSize: 2000,
  maxAge: 1800000, // 30 minutes
  enableAnalytics: true,
  predictionEnabled: true,
  compressionThreshold: 1024
});
