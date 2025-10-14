#!/usr/bin/env node

/**
 * Intelligent Garbage Collection Optimizer
 * Proactive memory management inspired by V8 and Node.js internals
 */

import { EventEmitter } from 'node:events';
import { performance } from 'node:perf_hooks';

/**
 * Smart GC optimizer that monitors memory pressure and optimizes collection timing
 * Reduces GC pause times and improves overall performance
 */
class GCOptimizer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration with performance-tuned defaults
    this.memoryPressureThreshold = options.memoryPressureThreshold ?? 0.8;
    this.criticalMemoryThreshold = options.criticalMemoryThreshold ?? 0.95;
    this.gcCooldownMs = options.gcCooldownMs ?? 30000; // 30 seconds
    this.monitoringInterval = options.monitoringInterval ?? 5000; // 5 seconds
    this.maxGCAttempts = options.maxGCAttempts ?? 3;
    
    // State tracking
    this.lastGCTime = 0;
    this.lastMemoryCheck = 0;
    this.gcAttempts = 0;
    this.memoryHistory = [];
    this.maxHistoryLength = 60; // Keep 5 minutes of history
    
    // Performance metrics
    this.statistics = {
      totalGCTriggers: 0,
      manualGCCount: 0,
      automaticGCCount: 0,
      memoryReclaimed: 0,
      totalGCTime: 0,
      maxGCTime: 0,
      avgGCTime: 0,
      memoryLeakAlerts: 0,
      pressureAlerts: 0
    };
    
    // Memory pressure levels
    this.PRESSURE_LEVELS = {
      LOW: 'low',
      MODERATE: 'moderate', 
      HIGH: 'high',
      CRITICAL: 'critical'
    };
    
    this.isMonitoring = false;
    this.monitoringTimer = null;
    
    // Check if GC is available
    this.gcAvailable = typeof global.gc === 'function';
    
    if (!this.gcAvailable) {
      this.emit('warning', {
        message: 'global.gc not available. Run with --expose-gc for optimal performance',
        suggestion: 'node --expose-gc your-app.js'
      });
    }
  }
  
  /**
   * Start memory monitoring and automatic GC optimization
   */
  startMonitoring() {
    if (this.isMonitoring) {
      this.emit('warning', { message: 'Monitoring already active' });
      return;
    }
    
    this.isMonitoring = true;
    this.monitoringTimer = setInterval(() => {
      this.checkMemoryPressure();
    }, this.monitoringInterval);
    
    // Don't keep process alive
    this.monitoringTimer.unref();
    
    this.emit('monitoring_started', {
      interval: this.monitoringInterval,
      gcAvailable: this.gcAvailable
    });
  }
  
  /**
   * Stop memory monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    
    this.emit('monitoring_stopped', {
      statistics: this.getStatistics()
    });
  }
  
  /**
   * Check current memory pressure and take action if needed
   */
  checkMemoryPressure() {
    const memoryUsage = process.memoryUsage();
    const now = Date.now();
    
    // Calculate memory pressure metrics
    const heapRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;
    const rssRatio = memoryUsage.rss / (memoryUsage.rss + memoryUsage.external);
    const pressureLevel = this.calculatePressureLevel(heapRatio, rssRatio);
    
    // Store memory history for trend analysis
    this.memoryHistory.push({
      timestamp: now,
      memoryUsage,
      heapRatio,
      rssRatio,
      pressureLevel
    });
    
    // Trim history
    if (this.memoryHistory.length > this.maxHistoryLength) {
      this.memoryHistory.shift();
    }
    
    this.lastMemoryCheck = now;
    
    // Emit pressure events
    this.emit('memory_check', {
      memoryUsage,
      pressureLevel,
      heapRatio,
      rssRatio
    });
    
    // Take action based on pressure level
    this.handleMemoryPressure(pressureLevel, memoryUsage);
    
    // Check for memory leaks
    this.detectMemoryLeaks();
  }
  
  /**
   * Calculate memory pressure level based on various metrics
   */
  calculatePressureLevel(heapRatio, rssRatio) {
    const maxRatio = Math.max(heapRatio, rssRatio);
    
    if (maxRatio >= this.criticalMemoryThreshold) {
      return this.PRESSURE_LEVELS.CRITICAL;
    } else if (maxRatio >= this.memoryPressureThreshold) {
      return this.PRESSURE_LEVELS.HIGH;
    } else if (maxRatio >= 0.6) {
      return this.PRESSURE_LEVELS.MODERATE;
    }
    
    return this.PRESSURE_LEVELS.LOW;
  }
  
  /**
   * Handle different memory pressure levels
   */
  handleMemoryPressure(pressureLevel, memoryUsage) {
    switch (pressureLevel) {
      case this.PRESSURE_LEVELS.CRITICAL:
        this.statistics.pressureAlerts++;
        this.emit('critical_pressure', { memoryUsage, pressureLevel });
        this.forceGC('critical_pressure');
        break;
        
      case this.PRESSURE_LEVELS.HIGH:
        this.statistics.pressureAlerts++;
        this.emit('high_pressure', { memoryUsage, pressureLevel });
        if (this.shouldTriggerGC()) {
          this.scheduleGC('high_pressure');
        }
        break;
        
      case this.PRESSURE_LEVELS.MODERATE:
        this.emit('moderate_pressure', { memoryUsage, pressureLevel });
        if (this.shouldTriggerGC() && this.gcAttempts === 0) {
          this.scheduleGC('moderate_pressure');
        }
        break;
        
      default:
        // Low pressure - reset GC attempt counter
        this.gcAttempts = 0;
        break;
    }
  }
  
  /**
   * Determine if GC should be triggered based on timing and attempts
   */
  shouldTriggerGC() {
    const now = Date.now();
    return (
      this.gcAvailable &&
      now - this.lastGCTime >= this.gcCooldownMs &&
      this.gcAttempts < this.maxGCAttempts
    );
  }
  
  /**
   * Schedule GC for next tick to avoid blocking current operations
   */
  scheduleGC(reason) {
    process.nextTick(() => {
      this.performGC(reason, false);
    });
  }
  
  /**
   * Force immediate GC for critical situations
   */
  forceGC(reason) {
    this.performGC(reason, true);
  }
  
  /**
   * Perform garbage collection with performance monitoring
   */
  performGC(reason, isForced = false) {
    if (!this.gcAvailable) {
      this.emit('gc_unavailable', { reason });
      return false;
    }
    
    const beforeMemory = process.memoryUsage();
    const gcStartTime = performance.now();
    
    try {
      // Perform GC
      global.gc();
      
      const gcEndTime = performance.now();
      const gcDuration = gcEndTime - gcStartTime;
      const afterMemory = process.memoryUsage();
      
      // Calculate memory reclaimed
      const memoryReclaimed = beforeMemory.heapUsed - afterMemory.heapUsed;
      
      // Update statistics
      this.statistics.totalGCTriggers++;
      this.statistics.totalGCTime += gcDuration;
      this.statistics.memoryReclaimed += Math.max(0, memoryReclaimed);
      this.statistics.maxGCTime = Math.max(this.statistics.maxGCTime, gcDuration);
      this.statistics.avgGCTime = this.statistics.totalGCTime / this.statistics.totalGCTriggers;
      
      if (isForced) {
        this.statistics.manualGCCount++;
      } else {
        this.statistics.automaticGCCount++;
      }
      
      this.lastGCTime = Date.now();
      this.gcAttempts++;
      
      this.emit('gc_completed', {
        reason,
        isForced,
        duration: gcDuration,
        memoryReclaimed,
        beforeMemory,
        afterMemory,
        success: true
      });
      
      return true;
      
    } catch (error) {
      this.emit('gc_error', {
        reason,
        error: error.message,
        success: false
      });
      
      return false;
    }
  }
  
  /**
   * Detect potential memory leaks by analyzing memory growth trends
   */
  detectMemoryLeaks() {
    if (this.memoryHistory.length < 10) return;
    
    // Analyze last 10 memory snapshots
    const recentHistory = this.memoryHistory.slice(-10);
    const firstSnapshot = recentHistory[0];
    const lastSnapshot = recentHistory[recentHistory.length - 1];
    
    const memoryGrowth = lastSnapshot.memoryUsage.heapUsed - firstSnapshot.memoryUsage.heapUsed;
    const timeSpan = lastSnapshot.timestamp - firstSnapshot.timestamp;
    const growthRate = memoryGrowth / timeSpan; // bytes per ms
    
    // Check for sustained memory growth (>1MB per minute)
    const suspiciousGrowthRate = (1024 * 1024) / (60 * 1000); // 1MB per minute
    
    if (growthRate > suspiciousGrowthRate) {
      this.statistics.memoryLeakAlerts++;
      
      this.emit('memory_leak_warning', {
        growthRate: growthRate * 60 * 1000, // bytes per minute
        memoryGrowth,
        timeSpan,
        currentHeapUsed: lastSnapshot.memoryUsage.heapUsed,
        recommendation: 'Consider profiling application for memory leaks'
      });
    }
  }
  
  /**
   * Get comprehensive GC optimizer statistics
   */
  getStatistics() {
    const currentMemory = process.memoryUsage();
    const uptime = process.uptime() * 1000; // Convert to ms
    
    return {
      ...this.statistics,
      currentMemory,
      uptime,
      gcAvailable: this.gcAvailable,
      isMonitoring: this.isMonitoring,
      lastGCTime: this.lastGCTime,
      timeSinceLastGC: Date.now() - this.lastGCTime,
      memoryHistoryLength: this.memoryHistory.length,
      gcEfficiency: this.statistics.totalGCTriggers > 0 
        ? this.statistics.memoryReclaimed / this.statistics.totalGCTriggers 
        : 0,
      configuration: {
        memoryPressureThreshold: this.memoryPressureThreshold,
        criticalMemoryThreshold: this.criticalMemoryThreshold,
        gcCooldownMs: this.gcCooldownMs,
        monitoringInterval: this.monitoringInterval
      }
    };
  }
  
  /**
   * Get current memory pressure assessment
   */
  getCurrentPressure() {
    const memoryUsage = process.memoryUsage();
    const heapRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;
    const rssRatio = memoryUsage.rss / (memoryUsage.rss + memoryUsage.external);
    const pressureLevel = this.calculatePressureLevel(heapRatio, rssRatio);
    
    return {
      memoryUsage,
      heapRatio,
      rssRatio,
      pressureLevel,
      shouldTriggerGC: this.shouldTriggerGC()
    };
  }
  
  /**
   * Manually trigger GC with reason
   */
  triggerGC(reason = 'manual') {
    return this.performGC(reason, true);
  }
  
  /**
   * Reset statistics and state
   */
  reset() {
    this.statistics = {
      totalGCTriggers: 0,
      manualGCCount: 0,
      automaticGCCount: 0,
      memoryReclaimed: 0,
      totalGCTime: 0,
      maxGCTime: 0,
      avgGCTime: 0,
      memoryLeakAlerts: 0,
      pressureAlerts: 0
    };
    
    this.memoryHistory.length = 0;
    this.lastGCTime = 0;
    this.gcAttempts = 0;
    
    this.emit('reset', { timestamp: Date.now() });
  }
  
  /**
   * Cleanup and destroy optimizer
   */
  destroy() {
    this.stopMonitoring();
    this.reset();
    this.removeAllListeners();
    
    this.emit('destroyed', {
      finalStatistics: this.getStatistics()
    });
  }
}

/**
 * Global GC optimizer instance for easy access
 */
let globalOptimizer = null;

/**
 * Get or create global GC optimizer instance
 */
function getGlobalOptimizer(options = {}) {
  if (!globalOptimizer) {
    globalOptimizer = new GCOptimizer(options);
    
    // Auto-start monitoring in production
    if (process.env.NODE_ENV === 'production') {
      globalOptimizer.startMonitoring();
    }
  }
  
  return globalOptimizer;
}

/**
 * Quick utility functions
 */
const GCUtils = {
  /**
   * Check if GC is available
   */
  isGCAvailable: () => typeof global.gc === 'function',
  
  /**
   * Get current memory usage summary
   */
  getMemorySummary: () => {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100, // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100, // MB
      rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100, // MB
      external: Math.round(usage.external / 1024 / 1024 * 100) / 100, // MB
      heapRatio: Math.round(usage.heapUsed / usage.heapTotal * 10000) / 100 // %
    };
  },
  
  /**
   * Force immediate GC if available
   */
  forceGC: (reason = 'utility') => {
    if (GCUtils.isGCAvailable()) {
      global.gc();
      return true;
    }
    return false;
  }
};

export { GCOptimizer, getGlobalOptimizer, GCUtils };