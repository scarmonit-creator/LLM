#!/usr/bin/env node

/**
 * Advanced Object Pool Implementation for Memory Optimization
 * Inspired by high-performance systems like V8 and Chromium
 */

import { EventEmitter } from 'node:events';

/**
 * High-performance object pool with intelligent memory management
 * Reduces GC pressure and improves memory allocation patterns
 */
class ObjectPool extends EventEmitter {
  constructor(createFn, resetFn, options = {}) {
    super();
    
    this.createFn = createFn;
    this.resetFn = resetFn;
    
    // Configuration with performance-optimized defaults
    this.initialSize = options.initialSize ?? 10;
    this.maxSize = options.maxSize ?? 100;
    this.growthFactor = options.growthFactor ?? 1.5;
    this.shrinkThreshold = options.shrinkThreshold ?? 0.25;
    this.maxIdleTime = options.maxIdleTime ?? 300000; // 5 minutes
    
    // Pool storage using Map for O(1) operations
    this.available = [];
    this.acquired = new Map(); // object -> acquisition time
    this.statistics = {
      created: 0,
      acquired: 0,
      released: 0,
      reused: 0,
      destroyed: 0,
      maxSize: 0,
      totalLifetime: 0
    };
    
    // Performance monitoring
    this.lastCleanup = Date.now();
    this.cleanupInterval = options.cleanupInterval ?? 60000; // 1 minute
    
    this.initialize();
    this.startMaintenanceTimer();
  }
  
  /**
   * Initialize pool with pre-allocated objects
   */
  initialize() {
    for (let i = 0; i < this.initialSize; i++) {
      const obj = this.createFn();
      this.available.push({
        object: obj,
        createdAt: Date.now(),
        lastUsed: Date.now()
      });
      this.statistics.created++;
    }
    
    this.emit('initialized', {
      initialSize: this.initialSize,
      availableCount: this.available.length
    });
  }
  
  /**
   * Acquire an object from the pool
   * @returns {*} Object from pool or newly created
   */
  acquire() {
    const now = Date.now();
    let poolItem;
    
    // Try to get from available pool first
    if (this.available.length > 0) {
      poolItem = this.available.pop();
      poolItem.lastUsed = now;
      this.statistics.reused++;
    } else {
      // Create new object if pool is empty
      const obj = this.createFn();
      poolItem = {
        object: obj,
        createdAt: now,
        lastUsed: now
      };
      this.statistics.created++;
    }
    
    // Track acquisition
    this.acquired.set(poolItem.object, {
      poolItem,
      acquiredAt: now
    });
    
    this.statistics.acquired++;
    this.statistics.maxSize = Math.max(this.statistics.maxSize, this.acquired.size);
    
    this.emit('acquired', {
      object: poolItem.object,
      poolSize: this.size,
      acquiredCount: this.acquired.size
    });
    
    return poolItem.object;
  }
  
  /**
   * Release an object back to the pool
   * @param {*} obj Object to release
   * @returns {boolean} True if successfully released
   */
  release(obj) {
    const acquisitionInfo = this.acquired.get(obj);
    if (!acquisitionInfo) {
      this.emit('error', new Error('Attempted to release object not acquired from pool'));
      return false;
    }
    
    const { poolItem, acquiredAt } = acquisitionInfo;
    const now = Date.now();
    
    // Remove from acquired tracking
    this.acquired.delete(obj);
    
    // Reset object state
    try {
      this.resetFn(obj);
    } catch (error) {
      this.emit('error', new Error(`Reset function failed: ${error.message}`));
      this.statistics.destroyed++;
      return false;
    }
    
    // Update statistics
    this.statistics.released++;
    this.statistics.totalLifetime += now - acquiredAt;
    poolItem.lastUsed = now;
    
    // Return to pool if within size limits
    if (this.available.length < this.maxSize) {
      this.available.push(poolItem);
      this.emit('released', {
        object: obj,
        poolSize: this.size,
        utilizationTime: now - acquiredAt
      });
    } else {
      // Pool is full, destroy object
      this.statistics.destroyed++;
      this.emit('destroyed', { object: obj, reason: 'pool_full' });
    }
    
    return true;
  }
  
  /**
   * Force release of all acquired objects
   * Use with caution in production
   */
  releaseAll() {
    const objects = Array.from(this.acquired.keys());
    let releasedCount = 0;
    
    for (const obj of objects) {
      if (this.release(obj)) {
        releasedCount++;
      }
    }
    
    this.emit('releaseAll', { count: releasedCount });
    return releasedCount;
  }
  
  /**
   * Perform maintenance: cleanup idle objects and optimize pool size
   */
  performMaintenance() {
    const now = Date.now();
    const initialCount = this.available.length;
    
    // Remove idle objects
    this.available = this.available.filter(poolItem => {
      if (now - poolItem.lastUsed > this.maxIdleTime) {
        this.statistics.destroyed++;
        return false;
      }
      return true;
    });
    
    const removedIdle = initialCount - this.available.length;
    
    // Shrink pool if utilization is low
    const utilizationRatio = this.acquired.size / (this.acquired.size + this.available.length);
    if (utilizationRatio < this.shrinkThreshold && this.available.length > this.initialSize) {
      const targetSize = Math.max(this.initialSize, Math.ceil(this.available.length * 0.7));
      const toRemove = this.available.length - targetSize;
      
      if (toRemove > 0) {
        this.available.splice(0, toRemove);
        this.statistics.destroyed += toRemove;
      }
    }
    
    this.lastCleanup = now;
    
    this.emit('maintenance', {
      removedIdle,
      currentSize: this.available.length,
      utilization: utilizationRatio
    });
  }
  
  /**
   * Start automatic maintenance timer
   */
  startMaintenanceTimer() {
    this.maintenanceTimer = setInterval(() => {
      this.performMaintenance();
    }, this.cleanupInterval);
    
    // Don't keep process alive just for maintenance
    this.maintenanceTimer.unref();
  }
  
  /**
   * Stop maintenance and cleanup resources
   */
  destroy() {
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = null;
    }
    
    // Force release all objects
    this.releaseAll();
    
    // Clear pools
    this.available.length = 0;
    this.acquired.clear();
    
    this.emit('destroyed', { statistics: this.getStatistics() });
    this.removeAllListeners();
  }
  
  /**
   * Get comprehensive pool statistics
   */
  getStatistics() {
    const avgLifetime = this.statistics.released > 0 
      ? this.statistics.totalLifetime / this.statistics.released 
      : 0;
    
    return {
      ...this.statistics,
      available: this.available.length,
      acquired: this.acquired.size,
      total: this.available.length + this.acquired.size,
      utilization: this.acquired.size / (this.available.length + this.acquired.size || 1),
      hitRate: this.statistics.acquired > 0 ? this.statistics.reused / this.statistics.acquired : 0,
      averageLifetime: avgLifetime,
      uptime: Date.now() - (this.lastCleanup - this.cleanupInterval)
    };
  }
  
  /**
   * Get current pool size
   */
  get size() {
    return this.available.length + this.acquired.size;
  }
  
  /**
   * Check if pool is healthy
   */
  get isHealthy() {
    const stats = this.getStatistics();
    return (
      stats.available >= 0 &&
      stats.acquired >= 0 &&
      stats.hitRate > 0.5 && // At least 50% hit rate
      stats.utilization < 0.9 // Not over-utilized
    );
  }
}

/**
 * Factory for creating specialized object pools
 */
class ObjectPoolFactory {
  static createBufferPool(bufferSize, options = {}) {
    return new ObjectPool(
      () => Buffer.alloc(bufferSize),
      (buffer) => buffer.fill(0),
      { ...options, initialSize: 5 }
    );
  }
  
  static createArrayPool(initialLength = 0, options = {}) {
    return new ObjectPool(
      () => new Array(initialLength),
      (arr) => {
        arr.length = 0;
        return arr;
      },
      options
    );
  }
  
  static createObjectPool(template = {}, options = {}) {
    return new ObjectPool(
      () => ({ ...template }),
      (obj) => {
        // Reset to template state
        for (const key in obj) {
          if (!(key in template)) {
            delete obj[key];
          }
        }
        Object.assign(obj, template);
        return obj;
      },
      options
    );
  }
  
  static createMapPool(options = {}) {
    return new ObjectPool(
      () => new Map(),
      (map) => {
        map.clear();
        return map;
      },
      options
    );
  }
  
  static createSetPool(options = {}) {
    return new ObjectPool(
      () => new Set(),
      (set) => {
        set.clear();
        return set;
      },
      options
    );
  }
}

export { ObjectPool, ObjectPoolFactory };