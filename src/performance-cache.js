import LRU from 'lru-cache';

/**
 * Advanced Performance Cache System
 * Optimizes memory usage and response times with intelligent caching
 */
export class PerformanceCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || 1000 * 60 * 15; // 15 minutes default
    
    // Main LRU cache for frequently accessed data
    this.cache = new LRU({
      max: this.maxSize,
      ttl: this.ttl,
      allowStale: true,
      updateAgeOnGet: true,
      updateAgeOnHas: true
    });
    
    // Separate cache for browser history with different TTL
    this.historyCache = new LRU({
      max: 500,
      ttl: 1000 * 60 * 5, // 5 minutes for browser history
      allowStale: false
    });
    
    // Performance metrics cache
    this.metricsCache = new LRU({
      max: 100,
      ttl: 1000 * 30, // 30 seconds for metrics
      allowStale: true
    });
    
    // Query result cache for search operations
    this.queryCache = new LRU({
      max: 200,
      ttl: 1000 * 60 * 10, // 10 minutes for search results
      allowStale: true
    });
    
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      clears: 0,
      memoryUsage: 0
    };
    
    // Setup memory monitoring
    this.setupMemoryMonitoring();
  }
  
  setupMemoryMonitoring() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const heapPressure = memUsage.heapUsed / memUsage.heapTotal;
      
      // If memory pressure is high, clear older entries
      if (heapPressure > 0.8) {
        this.cache.clear();
        this.historyCache.purgeStale();
        this.queryCache.purgeStale();
        console.log('🧹 Cache cleared due to high memory pressure');
      }
      
      this.stats.memoryUsage = memUsage.heapUsed;
    }, 30000); // Check every 30 seconds
  }
  
  // General cache operations
  get(key) {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.stats.hits++;
      return value;
    }
    this.stats.misses++;
    return undefined;
  }
  
  set(key, value, ttl) {
    this.cache.set(key, value, { ttl });
    this.stats.sets++;
    return true;
  }
  
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) this.stats.deletes++;
    return deleted;
  }
  
  // Browser history specific caching
  getHistory(key) {
    const value = this.historyCache.get(key);
    if (value !== undefined) {
      this.stats.hits++;
      return value;
    }
    this.stats.misses++;
    return undefined;
  }
  
  setHistory(key, value) {
    this.historyCache.set(key, value);
    this.stats.sets++;
    return true;
  }
  
  // Metrics caching
  getMetrics(key) {
    const value = this.metricsCache.get(key);
    if (value !== undefined) {
      this.stats.hits++;
      return value;
    }
    this.stats.misses++;
    return undefined;
  }
  
  setMetrics(key, value) {
    this.metricsCache.set(key, value);
    this.stats.sets++;
    return true;
  }
  
  // Query caching with smart key generation
  getQuery(queryString, count = 50) {
    const key = `query:${queryString}:${count}`;
    const value = this.queryCache.get(key);
    if (value !== undefined) {
      this.stats.hits++;
      return value;
    }
    this.stats.misses++;
    return undefined;
  }
  
  setQuery(queryString, count, results) {
    const key = `query:${queryString}:${count}`;
    this.queryCache.set(key, results);
    this.stats.sets++;
    return true;
  }
  
  // Cache warming for frequently accessed data
  warmCache(dataLoader) {
    const commonQueries = [
      'github',
      'perplexity',
      'fly.io',
      'claude',
      'optimization',
      'deploy'
    ];
    
    commonQueries.forEach(async query => {
      try {
        const results = await dataLoader(query, 25);
        this.setQuery(query, 25, results);
      } catch (error) {
        console.warn(`Cache warming failed for query: ${query}`, error.message);
      }
    });
  }
  
  // Intelligent cache preloading based on usage patterns
  async preloadFrequentData(historyTool) {
    try {
      // Preload recent history
      const recentHistory = await historyTool.getRecentHistory(100);
      this.setHistory('recent:100', recentHistory);
      
      // Preload smaller chunks
      this.setHistory('recent:50', recentHistory.slice(0, 50));
      this.setHistory('recent:25', recentHistory.slice(0, 25));
      
      console.log('✅ Cache preloaded with recent browser history');
    } catch (error) {
      console.warn('Cache preload failed:', error.message);
    }
  }
  
  // Cache invalidation strategies
  invalidatePattern(pattern) {
    let invalidated = 0;
    
    // Invalidate from all caches
    [this.cache, this.historyCache, this.metricsCache, this.queryCache].forEach(cache => {
      for (const key of cache.keys()) {
        if (key.includes(pattern)) {
          cache.delete(key);
          invalidated++;
        }
      }
    });
    
    console.log(`🗑️ Invalidated ${invalidated} cache entries matching pattern: ${pattern}`);
    return invalidated;
  }
  
  // Smart cache cleanup
  cleanup() {
    // Force cleanup of stale entries
    this.cache.purgeStale();
    this.historyCache.purgeStale();
    this.metricsCache.purgeStale();
    this.queryCache.purgeStale();
    
    this.stats.clears++;
    console.log('🧹 Cache cleanup completed');
  }
  
  // Cache statistics and health metrics
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      sizes: {
        main: this.cache.size,
        history: this.historyCache.size,
        metrics: this.metricsCache.size,
        query: this.queryCache.size
      },
      memoryMB: Math.round(this.stats.memoryUsage / 1024 / 1024),
      efficiency: hitRate > 70 ? 'excellent' : hitRate > 50 ? 'good' : 'needs_improvement'
    };
  }
  
  // Clear all caches
  clearAll() {
    this.cache.clear();
    this.historyCache.clear();
    this.metricsCache.clear();
    this.queryCache.clear();
    this.stats.clears++;
    console.log('🧹 All caches cleared');
  }
  
  // Export cache state for debugging
  exportState() {
    return {
      timestamp: new Date().toISOString(),
      stats: this.getStats(),
      keys: {
        main: Array.from(this.cache.keys()),
        history: Array.from(this.historyCache.keys()),
        metrics: Array.from(this.metricsCache.keys()),
        query: Array.from(this.queryCache.keys())
      }
    };
  }
}

// Singleton instance for global use
export const performanceCache = new PerformanceCache({
  maxSize: 2000,
  ttl: 1000 * 60 * 20 // 20 minutes
});

export default PerformanceCache;