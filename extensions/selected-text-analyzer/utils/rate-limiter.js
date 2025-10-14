// Advanced Rate Limiter with Sliding Window
// Prevents resource abuse and ensures stable performance

class RateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 100;
    this.windowSize = options.windowSize || 60000; // 1 minute
    this.windows = new Map();
    this.cleanupInterval = options.cleanupInterval || 120000; // 2 minutes
    
    // Metrics tracking
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      uniqueKeys: 0,
      cleanupRuns: 0
    };
    
    this.startCleanupCycle();
    
    console.log('🚦 RateLimiter initialized:', {
      maxRequests: this.maxRequests,
      windowSize: this.windowSize + 'ms',
      cleanupInterval: this.cleanupInterval + 'ms'
    });
  }

  /**
   * Check if request is allowed for given key
   * @param {string} key - Unique identifier (usually tabId or userId)
   * @returns {boolean} True if request is allowed
   */
  isAllowed(key) {
    const now = Date.now();
    const windowStart = now - this.windowSize;
    
    // Initialize window for new key
    if (!this.windows.has(key)) {
      this.windows.set(key, []);
      this.metrics.uniqueKeys++;
    }
    
    const window = this.windows.get(key);
    
    // Remove requests outside current window (sliding window)
    const validRequests = window.filter(timestamp => timestamp > windowStart);
    this.windows.set(key, validRequests);
    
    this.metrics.totalRequests++;
    
    // Check if under limit
    if (validRequests.length < this.maxRequests) {
      validRequests.push(now);
      return true;
    }
    
    this.metrics.blockedRequests++;
    console.warn(`⚠️ Rate limit exceeded for key: ${key} (${validRequests.length}/${this.maxRequests})`);
    return false;
  }

  /**
   * Get remaining requests for a key
   * @param {string} key - Unique identifier
   * @returns {number} Number of remaining requests
   */
  getRemainingRequests(key) {
    if (!this.windows.has(key)) {
      return this.maxRequests;
    }
    
    const now = Date.now();
    const windowStart = now - this.windowSize;
    const window = this.windows.get(key);
    const validRequests = window.filter(timestamp => timestamp > windowStart);
    
    return Math.max(0, this.maxRequests - validRequests.length);
  }

  /**
   * Get time until next request is allowed
   * @param {string} key - Unique identifier
   * @returns {number} Milliseconds until next request allowed (0 if allowed now)
   */
  getTimeUntilReset(key) {
    if (!this.windows.has(key)) {
      return 0;
    }
    
    const window = this.windows.get(key);
    if (window.length < this.maxRequests) {
      return 0;
    }
    
    const oldestRequest = Math.min(...window);
    const resetTime = oldestRequest + this.windowSize;
    
    return Math.max(0, resetTime - Date.now());
  }

  /**
   * Get current status for a key
   * @param {string} key - Unique identifier
   * @returns {object} Status information
   */
  getStatus(key) {
    const remaining = this.getRemainingRequests(key);
    const timeUntilReset = this.getTimeUntilReset(key);
    
    return {
      key,
      remaining,
      used: this.maxRequests - remaining,
      limit: this.maxRequests,
      timeUntilReset,
      isAllowed: remaining > 0,
      windowSize: this.windowSize
    };
  }

  /**
   * Get all active keys and their status
   * @returns {Array} Array of status objects for all keys
   */
  getAllStatus() {
    return Array.from(this.windows.keys()).map(key => this.getStatus(key));
  }

  /**
   * Get rate limiter statistics
   * @returns {object} Performance and usage statistics
   */
  getStats() {
    const blockRate = this.metrics.totalRequests > 0 
      ? (this.metrics.blockedRequests / this.metrics.totalRequests) * 100 
      : 0;
    
    return {
      totalRequests: this.metrics.totalRequests,
      blockedRequests: this.metrics.blockedRequests,
      blockRate: Math.round(blockRate * 100) / 100,
      uniqueKeys: this.metrics.uniqueKeys,
      activeWindows: this.windows.size,
      cleanupRuns: this.metrics.cleanupRuns,
      config: {
        maxRequests: this.maxRequests,
        windowSize: this.windowSize,
        cleanupInterval: this.cleanupInterval
      }
    };
  }

  /**
   * Start automatic cleanup cycle for expired windows
   */
  startCleanupCycle() {
    setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Clean up expired windows and empty entries
   * @returns {number} Number of keys cleaned
   */
  cleanup() {
    const now = Date.now();
    const cutoff = now - (this.windowSize * 2); // Keep 2x window for safety
    let cleanedKeys = 0;
    
    for (const [key, window] of this.windows.entries()) {
      // Filter out very old requests
      const validRequests = window.filter(timestamp => timestamp > cutoff);
      
      if (validRequests.length === 0) {
        this.windows.delete(key);
        cleanedKeys++;
      } else if (validRequests.length !== window.length) {
        this.windows.set(key, validRequests);
      }
    }
    
    if (cleanedKeys > 0) {
      this.metrics.cleanupRuns++;
      console.log(`🧹 Rate limiter cleaned ${cleanedKeys} expired keys`);
    }
    
    return cleanedKeys;
  }

  /**
   * Reset limits for specific key (admin function)
   * @param {string} key - Key to reset
   * @returns {boolean} True if key was reset
   */
  resetKey(key) {
    if (this.windows.has(key)) {
      this.windows.delete(key);
      console.log(`🔄 Reset rate limit for key: ${key}`);
      return true;
    }
    return false;
  }

  /**
   * Reset all rate limits (admin function)
   */
  resetAll() {
    const keyCount = this.windows.size;
    this.windows.clear();
    console.log(`🔄 Reset all rate limits (${keyCount} keys)`);
  }

  /**
   * Update configuration
   * @param {object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    if (newConfig.maxRequests) this.maxRequests = newConfig.maxRequests;
    if (newConfig.windowSize) this.windowSize = newConfig.windowSize;
    if (newConfig.cleanupInterval) this.cleanupInterval = newConfig.cleanupInterval;
    
    console.log('🔧 Rate limiter configuration updated:', {
      maxRequests: this.maxRequests,
      windowSize: this.windowSize,
      cleanupInterval: this.cleanupInterval
    });
  }

  /**
   * Create a rate limited version of a function
   * @param {string} key - Rate limit key
   * @param {Function} fn - Function to rate limit
   * @returns {Function} Rate limited function
   */
  wrap(key, fn) {
    return async (...args) => {
      if (!this.isAllowed(key)) {
        const timeUntilReset = this.getTimeUntilReset(key);
        throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(timeUntilReset / 1000)}s`);
      }
      
      return await fn(...args);
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RateLimiter;
} else if (typeof window !== 'undefined') {
  window.RateLimiter = RateLimiter;
}