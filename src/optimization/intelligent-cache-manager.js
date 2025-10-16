/**
 * INTELLIGENT CACHE MANAGER
 * Advanced Caching Optimization System
 * 
 * Features:
 * - Multi-tier caching strategy
 * - Intelligent cache warming
 * - Predictive cache preloading
 * - Adaptive cache sizing
 * - Cache hit/miss analysis
 * - Memory pressure adaptation
 * - Performance-based eviction
 * - Real-time optimization
 */

import { LRUCache } from 'lru-cache';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import crypto from 'crypto';

class IntelligentCacheManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // L1 Cache - Hot data (in-memory)
      l1MaxSize: options.l1MaxSize || 1000,
      l1MaxAge: options.l1MaxAge || 5 * 60 * 1000, // 5 minutes
      l1SizeCalculation: options.l1SizeCalculation || ((value) => JSON.stringify(value).length),
      
      // L2 Cache - Warm data (compressed in-memory)
      l2MaxSize: options.l2MaxSize || 5000,
      l2MaxAge: options.l2MaxAge || 30 * 60 * 1000, // 30 minutes
      
      // L3 Cache - Cold data (disk-based for future implementation)
      l3MaxSize: options.l3MaxSize || 50000,
      l3MaxAge: options.l3MaxAge || 24 * 60 * 60 * 1000, // 24 hours
      
      // Performance settings
      enableCompression: options.enableCompression !== false,
      enablePredictive: options.enablePredictive !== false,
      enableWarmup: options.enableWarmup !== false,
      enableAnalytics: options.enableAnalytics !== false,
      
      // Memory management
      memoryThreshold: options.memoryThreshold || 0.8, // 80% memory usage
      adaptiveSizing: options.adaptiveSizing !== false,
      
      // Analytics
      trackingWindow: options.trackingWindow || 60000, // 1 minute
      warmupPatterns: options.warmupPatterns || 10, // Track top 10 patterns
      
      logLevel: options.logLevel || 'info'
    };
    
    // Initialize cache tiers
    this.l1Cache = new LRUCache({
      max: this.options.l1MaxSize,
      maxAge: this.options.l1MaxAge,
      sizeCalculation: this.options.l1SizeCalculation,
      dispose: (value, key, reason) => this.handleL1Eviction(key, value, reason)
    });
    
    this.l2Cache = new LRUCache({
      max: this.options.l2MaxSize,
      maxAge: this.options.l2MaxAge,
      sizeCalculation: (value) => value.compressed ? value.size : JSON.stringify(value).length,
      dispose: (value, key, reason) => this.handleL2Eviction(key, value, reason)
    });
    
    // Analytics and metrics
    this.metrics = {
      hits: { l1: 0, l2: 0, l3: 0 },
      misses: { l1: 0, l2: 0, l3: 0 },
      sets: { l1: 0, l2: 0, l3: 0 },
      evictions: { l1: 0, l2: 0, l3: 0 },
      bytes: { l1: 0, l2: 0, l3: 0 },
      responseTime: [],
      hitRatio: 0,
      efficiency: 100
    };
    
    // Access patterns for predictive caching
    this.accessPatterns = new Map();
    this.keySequences = [];
    this.popularKeys = new Map();
    
    // Warmup queue
    this.warmupQueue = [];
    this.isWarming = false;
    
    this.startAnalytics();
    this.startAdaptiveManagement();
  }
  
  startAnalytics() {
    // Update metrics and patterns periodically
    setInterval(() => {
      this.updateMetrics();
      this.analyzePatterns();
      this.optimizeCache();
    }, this.options.trackingWindow);
  }
  
  startAdaptiveManagement() {
    // Adaptive cache sizing based on memory pressure
    if (this.options.adaptiveSizing) {
      setInterval(() => {
        this.adaptCacheSize();
      }, 30000); // Every 30 seconds
    }
  }
  
  // Primary cache interface
  async get(key, options = {}) {
    const startTime = performance.now();
    const keyHash = this.hashKey(key);
    
    try {
      // Try L1 cache first
      let value = this.l1Cache.get(keyHash);
      if (value !== undefined) {
        this.metrics.hits.l1++;
        this.recordAccess(keyHash, 'l1', performance.now() - startTime);
        return this.deserializeValue(value);
      }
      this.metrics.misses.l1++;
      
      // Try L2 cache
      value = this.l2Cache.get(keyHash);
      if (value !== undefined) {
        this.metrics.hits.l2++;
        
        // Promote to L1 if frequently accessed
        if (this.shouldPromoteToL1(keyHash)) {
          const decompressed = this.decompressValue(value);
          this.l1Cache.set(keyHash, decompressed);
          this.metrics.sets.l1++;
        }
        
        this.recordAccess(keyHash, 'l2', performance.now() - startTime);
        return this.deserializeValue(this.decompressValue(value));
      }
      this.metrics.misses.l2++;
      
      // L3 cache would go here (future implementation)
      this.metrics.misses.l3++;
      
      // Cache miss - record for predictive analysis
      this.recordMiss(keyHash);
      
      return undefined;
    } finally {
      const responseTime = performance.now() - startTime;
      this.metrics.responseTime.push(responseTime);
      
      // Keep only recent response times
      if (this.metrics.responseTime.length > 1000) {
        this.metrics.responseTime.shift();
      }
    }
  }
  
  async set(key, value, options = {}) {
    const keyHash = this.hashKey(key);
    const serialized = this.serializeValue(value);
    const size = this.calculateSize(serialized);
    
    // Always set in L1 for hot data
    this.l1Cache.set(keyHash, serialized, { size });
    this.metrics.sets.l1++;
    
    // Also set in L2 with compression for persistence
    if (this.options.enableCompression && size > 1024) { // Compress larger values
      const compressed = this.compressValue(serialized);
      this.l2Cache.set(keyHash, compressed);
      this.metrics.sets.l2++;
    } else {
      this.l2Cache.set(keyHash, serialized);
      this.metrics.sets.l2++;
    }
    
    // Update access patterns
    this.updateAccessPattern(keyHash);
    
    // Trigger predictive caching if enabled
    if (this.options.enablePredictive) {
      this.triggerPredictiveCaching(keyHash);
    }
    
    return true;
  }
  
  async delete(key) {
    const keyHash = this.hashKey(key);
    
    const deleted = {
      l1: this.l1Cache.delete(keyHash),
      l2: this.l2Cache.delete(keyHash)
    };
    
    return deleted.l1 || deleted.l2;
  }
  
  async clear() {
    this.l1Cache.clear();
    this.l2Cache.clear();
    this.accessPatterns.clear();
    this.keySequences = [];
    this.popularKeys.clear();
    
    // Reset metrics
    Object.keys(this.metrics.hits).forEach(tier => {
      this.metrics.hits[tier] = 0;
      this.metrics.misses[tier] = 0;
      this.metrics.sets[tier] = 0;
      this.metrics.evictions[tier] = 0;
    });
  }
  
  // Cache warming functionality
  async warmCache(patterns = []) {
    if (this.isWarming) {
      return;
    }
    
    this.isWarming = true;
    
    try {
      const warmupTargets = patterns.length > 0 ? patterns : this.generateWarmupTargets();
      
      for (const target of warmupTargets) {
        if (typeof target.loader === 'function') {
          try {
            const value = await target.loader(target.key);
            await this.set(target.key, value, { warmup: true });
            
            if (this.options.logLevel === 'debug') {
              console.log(`Cache warmed: ${target.key}`);
            }
          } catch (error) {
            console.error(`Cache warmup failed for ${target.key}:`, error.message);
          }
        }
      }
      
      this.emit('warmup-completed', { targets: warmupTargets.length });
    } finally {
      this.isWarming = false;
    }
  }
  
  generateWarmupTargets() {
    // Generate warmup targets based on access patterns
    const targets = [];
    const sortedPatterns = Array.from(this.popularKeys.entries())
      .sort((a, b) => b[1].frequency - a[1].frequency)
      .slice(0, this.options.warmupPatterns);
    
    for (const [key, pattern] of sortedPatterns) {
      if (pattern.loader) {
        targets.push({ key, loader: pattern.loader });
      }
    }
    
    return targets;
  }
  
  // Predictive caching
  triggerPredictiveCaching(currentKey) {
    // Analyze sequences to predict next likely keys
    const predictions = this.predictNextKeys(currentKey);
    
    for (const prediction of predictions.slice(0, 3)) { // Top 3 predictions
      if (prediction.confidence > 0.7 && !this.l1Cache.has(prediction.key)) {
        // Queue for background loading
        this.queuePredictiveLoad(prediction.key, prediction.confidence);
      }
    }
  }
  
  predictNextKeys(currentKey) {
    const predictions = [];
    const sequences = this.keySequences.filter(seq => 
      seq.includes(currentKey) && seq.indexOf(currentKey) < seq.length - 1
    );
    
    const nextKeys = new Map();
    
    for (const sequence of sequences) {
      const currentIndex = sequence.indexOf(currentKey);
      if (currentIndex >= 0 && currentIndex < sequence.length - 1) {
        const nextKey = sequence[currentIndex + 1];
        nextKeys.set(nextKey, (nextKeys.get(nextKey) || 0) + 1);
      }
    }
    
    for (const [key, frequency] of nextKeys) {
      const confidence = frequency / sequences.length;
      predictions.push({ key, confidence, frequency });
    }
    
    return predictions.sort((a, b) => b.confidence - a.confidence);
  }
  
  queuePredictiveLoad(key, confidence) {
    // This would be implemented based on application-specific loaders
    const pattern = this.popularKeys.get(key);
    if (pattern && pattern.loader) {
      setTimeout(async () => {
        try {
          const value = await pattern.loader(key);
          await this.set(key, value, { predictive: true, confidence });
        } catch (error) {
          // Ignore predictive loading errors
        }
      }, 0);
    }
  }
  
  // Utility methods
  hashKey(key) {
    if (typeof key === 'string') {
      return key;
    }
    return crypto.createHash('md5').update(JSON.stringify(key)).digest('hex');
  }
  
  serializeValue(value) {
    return value;
  }
  
  deserializeValue(value) {
    return value;
  }
  
  compressValue(value) {
    // Simple compression simulation - in production, use actual compression
    const str = JSON.stringify(value);
    return {
      compressed: true,
      data: str,
      size: Math.floor(str.length * 0.6), // Simulate 40% compression
      originalSize: str.length
    };
  }
  
  decompressValue(value) {
    if (value.compressed) {
      return JSON.parse(value.data);
    }
    return value;
  }
  
  calculateSize(value) {
    if (typeof value === 'string') {
      return value.length;
    }
    return JSON.stringify(value).length;
  }
  
  shouldPromoteToL1(key) {
    const pattern = this.popularKeys.get(key);
    return pattern && pattern.frequency > 5 && pattern.recentAccess > Date.now() - 60000;
  }
  
  // Analytics and optimization
  recordAccess(key, tier, responseTime) {
    // Update access patterns
    const pattern = this.popularKeys.get(key) || {
      frequency: 0,
      lastAccess: 0,
      recentAccess: 0,
      tier: tier
    };
    
    pattern.frequency++;
    pattern.lastAccess = pattern.recentAccess;
    pattern.recentAccess = Date.now();
    pattern.tier = tier;
    
    this.popularKeys.set(key, pattern);
    
    // Update key sequences for pattern analysis
    this.updateKeySequence(key);
  }
  
  recordMiss(key) {
    // Track misses for cache optimization
    const pattern = this.popularKeys.get(key) || {
      frequency: 0,
      misses: 0,
      lastMiss: 0
    };
    
    pattern.misses = (pattern.misses || 0) + 1;
    pattern.lastMiss = Date.now();
    
    this.popularKeys.set(key, pattern);
  }
  
  updateKeySequence(key) {
    // Add to current sequence
    if (this.keySequences.length === 0) {
      this.keySequences = [[key]];
    } else {
      const currentSequence = this.keySequences[this.keySequences.length - 1];
      
      // Start new sequence if last access was more than 10 seconds ago
      const lastPattern = this.popularKeys.get(currentSequence[currentSequence.length - 1]);
      const timeSinceLastAccess = Date.now() - (lastPattern?.recentAccess || 0);
      
      if (timeSinceLastAccess > 10000 || currentSequence.length > 10) {
        this.keySequences.push([key]);
      } else {
        currentSequence.push(key);
      }
    }
    
    // Keep only recent sequences
    if (this.keySequences.length > 100) {
      this.keySequences = this.keySequences.slice(-50);
    }
  }
  
  updateAccessPattern(key) {
    const existing = this.accessPatterns.get(key) || { count: 0, lastAccess: 0 };
    existing.count++;
    existing.lastAccess = Date.now();
    this.accessPatterns.set(key, existing);
    
    // Clean old patterns
    if (this.accessPatterns.size > 10000) {
      this.cleanOldPatterns();
    }
  }
  
  cleanOldPatterns() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    for (const [key, pattern] of this.accessPatterns) {
      if (pattern.lastAccess < cutoff) {
        this.accessPatterns.delete(key);
      }
    }
  }
  
  updateMetrics() {
    // Calculate hit ratio
    const totalHits = Object.values(this.metrics.hits).reduce((a, b) => a + b, 0);
    const totalMisses = Object.values(this.metrics.misses).reduce((a, b) => a + b, 0);
    const totalRequests = totalHits + totalMisses;
    
    this.metrics.hitRatio = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
    
    // Calculate efficiency based on response times
    if (this.metrics.responseTime.length > 0) {
      const avgResponseTime = this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length;
      this.metrics.efficiency = Math.max(0, 100 - (avgResponseTime / 10)); // Efficiency decreases with response time
    }
    
    // Update cache size metrics
    this.metrics.bytes.l1 = this.l1Cache.calculatedSize || 0;
    this.metrics.bytes.l2 = this.l2Cache.calculatedSize || 0;
  }
  
  analyzePatterns() {
    // Identify hot keys that should be promoted
    const hotKeys = Array.from(this.popularKeys.entries())
      .filter(([key, pattern]) => pattern.frequency > 10 && pattern.recentAccess > Date.now() - 300000)
      .sort((a, b) => b[1].frequency - a[1].frequency);
    
    // Ensure hot keys are in L1
    for (const [key, pattern] of hotKeys.slice(0, 20)) {
      if (!this.l1Cache.has(key) && this.l2Cache.has(key)) {
        const value = this.l2Cache.get(key);
        if (value) {
          this.l1Cache.set(key, this.decompressValue(value));
        }
      }
    }
  }
  
  optimizeCache() {
    // Optimize cache performance based on metrics
    if (this.metrics.hitRatio < 50) {
      // Low hit ratio - consider increasing cache size
      this.emit('optimization-suggestion', {
        type: 'size_increase',
        reason: 'low_hit_ratio',
        hitRatio: this.metrics.hitRatio
      });
    }
    
    if (this.metrics.efficiency < 70) {
      // Low efficiency - optimize cache structure
      this.emit('optimization-suggestion', {
        type: 'structure_optimization',
        reason: 'low_efficiency',
        efficiency: this.metrics.efficiency
      });
    }
  }
  
  adaptCacheSize() {
    const memUsage = process.memoryUsage();
    const memoryPressure = memUsage.heapUsed / memUsage.heapTotal;
    
    if (memoryPressure > this.options.memoryThreshold) {
      // High memory pressure - reduce cache size
      const reductionFactor = 0.8;
      this.l1Cache.max = Math.floor(this.l1Cache.max * reductionFactor);
      this.l2Cache.max = Math.floor(this.l2Cache.max * reductionFactor);
      
      this.emit('cache-resized', {
        reason: 'memory_pressure',
        l1Size: this.l1Cache.max,
        l2Size: this.l2Cache.max,
        memoryPressure
      });
    } else if (memoryPressure < 0.5 && this.metrics.hitRatio > 80) {
      // Low memory pressure and good hit ratio - can increase cache size
      const increaseFactor = 1.1;
      this.l1Cache.max = Math.floor(this.l1Cache.max * increaseFactor);
      this.l2Cache.max = Math.floor(this.l2Cache.max * increaseFactor);
      
      this.emit('cache-resized', {
        reason: 'optimization',
        l1Size: this.l1Cache.max,
        l2Size: this.l2Cache.max,
        memoryPressure
      });
    }
  }
  
  // Event handlers
  handleL1Eviction(key, value, reason) {
    this.metrics.evictions.l1++;
    
    // If evicted due to space, ensure it's still available in L2
    if (reason === 'evict' && !this.l2Cache.has(key)) {
      const compressed = this.compressValue(value);
      this.l2Cache.set(key, compressed);
    }
  }
  
  handleL2Eviction(key, value, reason) {
    this.metrics.evictions.l2++;
    // L3 persistence would go here in future implementation
  }
  
  // Public API
  getStats() {
    return {
      metrics: { ...this.metrics },
      sizes: {
        l1: this.l1Cache.size,
        l2: this.l2Cache.size,
        l1Bytes: this.metrics.bytes.l1,
        l2Bytes: this.metrics.bytes.l2
      },
      patterns: {
        totalPatterns: this.accessPatterns.size,
        sequences: this.keySequences.length,
        popularKeys: Array.from(this.popularKeys.entries())
          .sort((a, b) => b[1].frequency - a[1].frequency)
          .slice(0, 10)
      },
      health: {
        hitRatio: this.metrics.hitRatio,
        efficiency: this.metrics.efficiency,
        avgResponseTime: this.metrics.responseTime.length > 0 
          ? this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length 
          : 0
      }
    };
  }
  
  registerLoader(key, loader) {
    // Register data loader for predictive caching and warmup
    const pattern = this.popularKeys.get(key) || { frequency: 0 };
    pattern.loader = loader;
    this.popularKeys.set(key, pattern);
  }
  
  async preload(keys) {
    // Preload specific keys
    const results = [];
    
    for (const key of keys) {
      const pattern = this.popularKeys.get(key);
      if (pattern && pattern.loader) {
        try {
          const value = await pattern.loader(key);
          await this.set(key, value, { preload: true });
          results.push({ key, success: true });
        } catch (error) {
          results.push({ key, success: false, error: error.message });
        }
      } else {
        results.push({ key, success: false, error: 'No loader registered' });
      }
    }
    
    return results;
  }
}

export default IntelligentCacheManager;
export { IntelligentCacheManager };
