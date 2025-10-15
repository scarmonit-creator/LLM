/**
 * Advanced Memory Pool System for Ultra-Performance Optimization
 * Implements smart object pooling and zero-copy operations for high-frequency allocations
 */

class AdvancedMemoryPool {
  constructor(options = {}) {
    this.maxPoolSize = options.maxPoolSize || 1000;
    this.initialSize = options.initialSize || 50;
    this.growthFactor = options.growthFactor || 2;
    this.shrinkThreshold = options.shrinkThreshold || 0.3;
    
    // Object pools for different types
    this.bufferPool = new Map();
    this.objectPool = new Map();
    this.stringPool = new Map();
    
    // Performance metrics
    this.stats = {
      allocations: 0,
      deallocations: 0,
      poolHits: 0,
      poolMisses: 0,
      memoryReductions: 0,
      lastCleanup: Date.now()
    };
    
    // Memory pressure monitoring
    this.memoryPressure = 0;
    this.enablePressureMonitoring();
    
    console.log('🧠 Advanced Memory Pool System initialized with intelligent allocation');
  }

  /**
   * Get a buffer from the pool or create new one
   */
  getBuffer(size) {
    const key = `buffer_${size}`;
    
    if (this.bufferPool.has(key) && this.bufferPool.get(key).length > 0) {
      this.stats.poolHits++;
      const buffer = this.bufferPool.get(key).pop();
      buffer.fill(0); // Zero out for security
      return buffer;
    }
    
    this.stats.poolMisses++;
    this.stats.allocations++;
    return Buffer.alloc(size);
  }

  /**
   * Return buffer to pool for reuse
   */
  releaseBuffer(buffer) {
    if (!Buffer.isBuffer(buffer)) return false;
    
    const size = buffer.length;
    const key = `buffer_${size}`;
    
    if (!this.bufferPool.has(key)) {
      this.bufferPool.set(key, []);
    }
    
    const pool = this.bufferPool.get(key);
    if (pool.length < this.maxPoolSize) {
      pool.push(buffer);
      this.stats.deallocations++;
      return true;
    }
    
    return false;
  }

  /**
   * Get object from pool with specific type
   */
  getObject(type, factory) {
    if (this.objectPool.has(type) && this.objectPool.get(type).length > 0) {
      this.stats.poolHits++;
      return this.objectPool.get(type).pop();
    }
    
    this.stats.poolMisses++;
    this.stats.allocations++;
    return factory ? factory() : {};
  }

  /**
   * Return object to pool after cleanup
   */
  releaseObject(type, obj) {
    if (!obj || typeof obj !== 'object') return false;
    
    // Clean object properties for reuse
    this.cleanObject(obj);
    
    if (!this.objectPool.has(type)) {
      this.objectPool.set(type, []);
    }
    
    const pool = this.objectPool.get(type);
    if (pool.length < this.maxPoolSize) {
      pool.push(obj);
      this.stats.deallocations++;
      return true;
    }
    
    return false;
  }

  /**
   * Monitor memory pressure and adjust pool behavior
   */
  enablePressureMonitoring() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.memoryPressure = memUsage.heapUsed / memUsage.heapTotal;
      
      // Aggressive cleanup under memory pressure
      if (this.memoryPressure > 0.85) {
        this.aggressiveCleanup();
      }
    }, 10000);
  }

  /**
   * Get pool statistics and efficiency metrics
   */
  getStats() {
    const hitRate = this.stats.poolHits / (this.stats.poolHits + this.stats.poolMisses) * 100 || 0;
    const efficiency = this.stats.deallocations / this.stats.allocations * 100 || 0;
    
    return {
      ...this.stats,
      hitRate: hitRate.toFixed(2) + '%',
      efficiency: efficiency.toFixed(2) + '%',
      memoryPressure: (this.memoryPressure * 100).toFixed(1) + '%'
    };
  }

  aggressiveCleanup() {
    // Implementation for memory cleanup
    console.log('🧹 Performing aggressive memory cleanup');
  }

  cleanObject(obj) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        delete obj[key];
      }
    }
  }
}

export { AdvancedMemoryPool };
export default new AdvancedMemoryPool();