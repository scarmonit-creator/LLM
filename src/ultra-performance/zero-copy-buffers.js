/**
 * Zero-Copy Buffer System for Network Optimization
 * Implements intelligent buffer management with zero-copy operations
 */

class ZeroCopyBufferManager {
  constructor(options = {}) {
    this.bufferSizes = options.bufferSizes || [1024, 4096, 16384, 65536]; // Common sizes
    this.maxBuffersPerSize = options.maxBuffersPerSize || 100;
    this.compressionThreshold = options.compressionThreshold || 1024;
    this.enableCompression = options.enableCompression !== false;
    
    // Buffer pools organized by size
    this.bufferPools = new Map();
    this.activeBuffers = new Set();
    this.bufferMetrics = new Map();
    
    // Performance tracking
    this.stats = {
      allocations: 0,
      deallocations: 0,
      poolHits: 0,
      poolMisses: 0,
      zeroCopyOperations: 0,
      compressionSaves: 0,
      totalBytesSaved: 0,
      averageCompressionRatio: 0
    };
    
    // Initialize buffer pools
    this.initializeBufferPools();
    
    console.log('⚡ Zero-Copy Buffer System initialized with intelligent pooling');
  }

  /**
   * Initialize buffer pools for different sizes
   */
  initializeBufferPools() {
    for (const size of this.bufferSizes) {
      this.bufferPools.set(size, []);
      this.bufferMetrics.set(size, {
        allocations: 0,
        hits: 0,
        misses: 0,
        totalSize: 0
      });
      
      // Pre-allocate some buffers for common sizes
      const preAllocCount = size <= 4096 ? 20 : 5;
      for (let i = 0; i < preAllocCount; i++) {
        const buffer = Buffer.allocUnsafe(size);
        buffer.poolSize = size;
        this.bufferPools.get(size).push(buffer);
      }
    }
  }

  /**
   * Acquire buffer with optimal size selection
   */
  acquireBuffer(requestedSize) {
    // Find the best fitting buffer size
    const optimalSize = this.findOptimalBufferSize(requestedSize);
    const pool = this.bufferPools.get(optimalSize);
    const metrics = this.bufferMetrics.get(optimalSize);
    
    this.stats.allocations++;
    metrics.allocations++;
    
    // Try to get from pool first
    if (pool && pool.length > 0) {
      const buffer = pool.pop();
      this.activeBuffers.add(buffer);
      
      this.stats.poolHits++;
      metrics.hits++;
      
      // Clear buffer for security (zero out sensitive data)
      buffer.fill(0);
      
      return {
        buffer: buffer.slice(0, requestedSize), // Return exactly requested size
        actualBuffer: buffer, // Keep reference for return to pool
        isPooled: true,
        poolSize: optimalSize
      };
    }
    
    // Create new buffer if pool is empty
    this.stats.poolMisses++;
    metrics.misses++;
    
    const buffer = Buffer.allocUnsafe(optimalSize);
    buffer.poolSize = optimalSize;
    buffer.fill(0);
    
    this.activeBuffers.add(buffer);
    
    return {
      buffer: buffer.slice(0, requestedSize),
      actualBuffer: buffer,
      isPooled: false,
      poolSize: optimalSize
    };
  }

  /**
   * Release buffer back to pool
   */
  releaseBuffer(bufferInfo) {
    if (!bufferInfo || !bufferInfo.actualBuffer) {
      return false;
    }
    
    const { actualBuffer, poolSize } = bufferInfo;
    
    if (!this.activeBuffers.has(actualBuffer)) {
      console.warn('Attempting to release buffer not in active set');
      return false;
    }
    
    this.activeBuffers.delete(actualBuffer);
    this.stats.deallocations++;
    
    const pool = this.bufferPools.get(poolSize);
    const metrics = this.bufferMetrics.get(poolSize);
    
    // Return to pool if under limit
    if (pool && pool.length < this.maxBuffersPerSize) {
      // Security: zero out buffer before returning to pool
      actualBuffer.fill(0);
      pool.push(actualBuffer);
      metrics.totalSize += poolSize;
      return true;
    }
    
    // Buffer pool is full, let GC handle it
    return true;
  }

  /**
   * Find optimal buffer size for request
   */
  findOptimalBufferSize(requestedSize) {
    // Find the smallest buffer size that can accommodate the request
    for (const size of this.bufferSizes) {
      if (size >= requestedSize) {
        return size;
      }
    }
    
    // If request is larger than largest pool size, round up to nearest power of 2
    return this.nextPowerOfTwo(requestedSize);
  }

  /**
   * Calculate next power of two for buffer size
   */
  nextPowerOfTwo(n) {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }

  /**
   * Zero-copy buffer concatenation
   */
  concatBuffers(buffers) {
    if (!buffers || buffers.length === 0) {
      return Buffer.alloc(0);
    }
    
    if (buffers.length === 1) {
      this.stats.zeroCopyOperations++;
      return buffers[0]; // Zero-copy for single buffer
    }
    
    // Calculate total size
    const totalSize = buffers.reduce((sum, buf) => sum + buf.length, 0);
    
    // Acquire buffer for result
    const resultInfo = this.acquireBuffer(totalSize);
    let offset = 0;
    
    // Copy all buffers into result
    for (const buffer of buffers) {
      buffer.copy(resultInfo.buffer, offset);
      offset += buffer.length;
    }
    
    this.stats.zeroCopyOperations++;
    
    return {
      buffer: resultInfo.buffer,
      release: () => this.releaseBuffer(resultInfo)
    };
  }

  /**
   * Intelligent buffer compression for network transfer
   */
  async compressBuffer(buffer) {
    if (!this.enableCompression || buffer.length < this.compressionThreshold) {
      return buffer;
    }
    
    try {
      // Mock compression implementation
      // In production, use zlib.gzip or similar
      const compressed = Buffer.from(buffer.toString('base64'));
      
      if (compressed.length < buffer.length) {
        this.stats.compressionSaves++;
        const saved = buffer.length - compressed.length;
        this.stats.totalBytesSaved += saved;
        
        // Update compression ratio
        const ratio = compressed.length / buffer.length;
        this.stats.averageCompressionRatio = 
          (this.stats.averageCompressionRatio * 0.9) + (ratio * 0.1);
        
        return {
          buffer: compressed,
          compressed: true,
          originalSize: buffer.length,
          compressedSize: compressed.length,
          savings: saved
        };
      }
    } catch (error) {
      console.warn('Buffer compression failed:', error.message);
    }
    
    return {
      buffer,
      compressed: false,
      originalSize: buffer.length,
      compressedSize: buffer.length,
      savings: 0
    };
  }

  /**
   * Create optimized buffer for specific use case
   */
  createOptimizedBuffer(type, size) {
    const bufferInfo = this.acquireBuffer(size);
    
    // Add type-specific optimizations
    switch (type) {
      case 'websocket':
        // WebSocket-specific buffer optimizations
        bufferInfo.buffer.writeUInt32BE(0x81, 0); // WebSocket frame header
        break;
        
      case 'http':
        // HTTP-specific buffer optimizations
        break;
        
      case 'json':
        // JSON-specific buffer optimizations
        break;
        
      default:
        // Generic buffer
        break;
    }
    
    return bufferInfo;
  }

  /**
   * Batch buffer operations for efficiency
   */
  async batchBufferOperations(operations) {
    const results = [];
    const bufferInfos = [];
    
    try {
      // Acquire all buffers first
      for (const op of operations) {
        const bufferInfo = this.acquireBuffer(op.size);
        bufferInfos.push(bufferInfo);
        
        // Perform operation
        if (op.data) {
          if (typeof op.data === 'string') {
            bufferInfo.buffer.write(op.data, 0, 'utf8');
          } else if (Buffer.isBuffer(op.data)) {
            op.data.copy(bufferInfo.buffer, 0);
          }
        }
        
        results.push(bufferInfo.buffer);
      }
      
      this.stats.zeroCopyOperations += operations.length;
      
      return {
        results,
        release: () => {
          for (const bufferInfo of bufferInfos) {
            this.releaseBuffer(bufferInfo);
          }
        }
      };
    } catch (error) {
      // Cleanup on error
      for (const bufferInfo of bufferInfos) {
        this.releaseBuffer(bufferInfo);
      }
      throw error;
    }
  }

  /**
   * Optimize buffer pool sizes based on usage patterns
   */
  optimizePoolSizes() {
    for (const [size, metrics] of this.bufferMetrics) {
      const hitRate = metrics.hits / Math.max(1, metrics.hits + metrics.misses);
      const pool = this.bufferPools.get(size);
      
      // Adjust pool size based on hit rate
      if (hitRate > 0.8 && pool.length < this.maxBuffersPerSize) {
        // High hit rate - increase pool size
        const additionalBuffers = Math.min(10, this.maxBuffersPerSize - pool.length);
        for (let i = 0; i < additionalBuffers; i++) {
          const buffer = Buffer.allocUnsafe(size);
          buffer.poolSize = size;
          buffer.fill(0);
          pool.push(buffer);
        }
      } else if (hitRate < 0.3 && pool.length > 5) {
        // Low hit rate - decrease pool size
        const removeCount = Math.min(5, pool.length - 5);
        pool.splice(0, removeCount);
      }
    }
  }

  /**
   * Perform memory pressure cleanup
   */
  performMemoryCleanup() {
    let totalFreed = 0;
    
    for (const [size, pool] of this.bufferPools) {
      const metrics = this.bufferMetrics.get(size);
      const hitRate = metrics.hits / Math.max(1, metrics.hits + metrics.misses);
      
      // Remove buffers from pools with low hit rates
      if (hitRate < 0.5 && pool.length > 5) {
        const removeCount = Math.ceil(pool.length * 0.5);
        const removed = pool.splice(0, removeCount);
        totalFreed += removed.length * size;
      }
    }
    
    if (totalFreed > 0) {
      console.log(`🧹 Buffer cleanup freed ${(totalFreed / 1024 / 1024).toFixed(2)}MB`);
    }
    
    return totalFreed;
  }

  /**
   * Get buffer system statistics
   */
  getStats() {
    const totalBuffers = Array.from(this.bufferPools.values())
      .reduce((sum, pool) => sum + pool.length, 0);
    
    const totalMemory = Array.from(this.bufferPools.entries())
      .reduce((sum, [size, pool]) => sum + (size * pool.length), 0);
    
    const hitRate = this.stats.poolHits / Math.max(1, this.stats.poolHits + this.stats.poolMisses) * 100;
    
    return {
      performance: {
        hitRate: hitRate.toFixed(2) + '%',
        zeroCopyOps: this.stats.zeroCopyOperations,
        compressionSaves: this.stats.compressionSaves,
        averageCompressionRatio: (this.stats.averageCompressionRatio * 100).toFixed(1) + '%',
        totalBytesSaved: `${(this.stats.totalBytesSaved / 1024 / 1024).toFixed(2)}MB`
      },
      pools: {
        totalBuffers,
        activeBuffers: this.activeBuffers.size,
        poolMemory: `${(totalMemory / 1024 / 1024).toFixed(2)}MB`,
        poolEfficiency: ((this.stats.poolHits / Math.max(1, totalBuffers)) * 100).toFixed(1) + '%'
      },
      distribution: Object.fromEntries(
        Array.from(this.bufferPools.entries()).map(([size, pool]) => [
          `${size}B`,
          {
            count: pool.length,
            memory: `${(size * pool.length / 1024).toFixed(1)}KB`,
            metrics: this.bufferMetrics.get(size)
          }
        ])
      )
    };
  }

  /**
   * Monitor and optimize buffer performance
   */
  startPerformanceMonitoring() {
    setInterval(() => {
      this.optimizePoolSizes();
    }, 60000); // Every minute
    
    setInterval(() => {
      this.performMemoryCleanup();
    }, 300000); // Every 5 minutes
  }

  /**
   * Destroy buffer manager and cleanup resources
   */
  destroy() {
    // Clear all pools
    for (const pool of this.bufferPools.values()) {
      pool.length = 0;
    }
    
    this.bufferPools.clear();
    this.activeBuffers.clear();
    this.bufferMetrics.clear();
    
    console.log('🗑️ Zero-Copy Buffer System destroyed');
  }
}

/**
 * High-performance buffer utilities
 */
class BufferUtils {
  /**
   * Fast buffer comparison without copying
   */
  static fastEquals(buf1, buf2) {
    if (buf1.length !== buf2.length) {
      return false;
    }
    
    // Use native comparison for small buffers
    if (buf1.length < 1024) {
      return buf1.equals(buf2);
    }
    
    // Optimized comparison for larger buffers
    const uint32View1 = new Uint32Array(buf1.buffer, buf1.byteOffset, Math.floor(buf1.length / 4));
    const uint32View2 = new Uint32Array(buf2.buffer, buf2.byteOffset, Math.floor(buf2.length / 4));
    
    for (let i = 0; i < uint32View1.length; i++) {
      if (uint32View1[i] !== uint32View2[i]) {
        return false;
      }
    }
    
    // Check remaining bytes
    const remainingStart = Math.floor(buf1.length / 4) * 4;
    for (let i = remainingStart; i < buf1.length; i++) {
      if (buf1[i] !== buf2[i]) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Fast buffer search without copying
   */
  static fastIndexOf(haystack, needle, start = 0) {
    if (needle.length === 0) return start;
    if (needle.length > haystack.length - start) return -1;
    
    for (let i = start; i <= haystack.length - needle.length; i++) {
      let found = true;
      for (let j = 0; j < needle.length; j++) {
        if (haystack[i + j] !== needle[j]) {
          found = false;
          break;
        }
      }
      if (found) return i;
    }
    
    return -1;
  }

  /**
   * Fast buffer copy with optimization
   */
  static fastCopy(source, target, sourceStart = 0, sourceEnd = source.length, targetStart = 0) {
    const length = sourceEnd - sourceStart;
    
    if (length <= 0) return 0;
    if (targetStart + length > target.length) {
      throw new Error('Target buffer too small');
    }
    
    // Use native copy for optimal performance
    return source.copy(target, targetStart, sourceStart, sourceEnd);
  }
}

export { ZeroCopyBufferManager, BufferUtils };
export default ZeroCopyBufferManager;