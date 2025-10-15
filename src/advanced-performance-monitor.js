import EventEmitter from 'events';
import os from 'os';
import { performance } from 'perf_hooks';

/**
 * Advanced Performance Monitor with Real-time Optimization
 * Features: Memory leak detection, CPU optimization, auto-scaling recommendations
 */
export class AdvancedPerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      samplingInterval: options.samplingInterval || 5000, // 5 seconds
      memoryThreshold: options.memoryThreshold || 0.85, // 85%
      cpuThreshold: options.cpuThreshold || 0.8, // 80%
      enableAutoGC: options.enableAutoGC || true,
      enableCPUOptimization: options.enableCPUOptimization || true,
      maxSamples: options.maxSamples || 1000,
      alertThreshold: options.alertThreshold || 5, // 5 consecutive alerts
      ...options
    };
    
    this.metrics = {
      memory: [],
      cpu: [],
      eventLoop: [],
      gc: [],
      requests: new Map(),
      alerts: [],
      performance: {
        totalSamples: 0,
        totalAlerts: 0,
        memoryLeaks: 0,
        gcTriggers: 0,
        optimizations: 0
      }
    };
    
    this.isMonitoring = false;
    this.intervalId = null;
    this.consecutiveAlerts = 0;
    
    // Bind methods
    this.sample = this.sample.bind(this);
    this.cleanup = this.cleanup.bind(this);
  }
  
  /**
   * Start monitoring with advanced features
   */
  start() {
    if (this.isMonitoring) return;
    
    console.log('📊 Advanced Performance Monitor: Starting ultra-performance monitoring');
    
    this.isMonitoring = true;
    this.intervalId = setInterval(this.sample, this.options.samplingInterval);
    
    // Enable performance hooks
    this.setupPerformanceHooks();
    
    // Setup GC monitoring if available
    if (global.gc && this.options.enableAutoGC) {
      console.log('   ⚙️  Auto GC optimization enabled');
    }
    
    this.emit('monitoring-started');
  }
  
  /**
   * Stop monitoring and cleanup
   */
  stop() {
    if (!this.isMonitoring) return;
    
    console.log('📊 Advanced Performance Monitor: Stopping');
    
    this.isMonitoring = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.emit('monitoring-stopped');
  }
  
  /**
   * Setup performance hooks for detailed monitoring
   */
  setupPerformanceHooks() {
    // Monitor process performance
    if (process.versions && process.versions.node) {
      const nodeVersion = process.versions.node.split('.').map(Number);
      if (nodeVersion[0] >= 16) {
        // Use performance measurement API for Node.js 16+
        this.setupAdvancedMetrics();
      }
    }
  }
  
  /**
   * Setup advanced metrics collection
   */
  setupAdvancedMetrics() {
    // Monitor garbage collection if available
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_GC_MONITORING) {
      try {
        const v8 = require('v8');
        setInterval(() => {
          const heapStats = v8.getHeapStatistics();
          this.recordGCStats(heapStats);
        }, this.options.samplingInterval * 2);
      } catch (error) {
        console.log('   ⚠️  V8 heap statistics not available');
      }
    }
  }
  
  /**
   * Record garbage collection statistics
   */
  recordGCStats(heapStats) {
    const gcMetric = {
      timestamp: Date.now(),
      totalHeapSize: heapStats.total_heap_size,
      usedHeapSize: heapStats.used_heap_size,
      heapSizeLimit: heapStats.heap_size_limit,
      mallocedMemory: heapStats.malloced_memory,
      externalMemory: heapStats.external_memory
    };
    
    this.metrics.gc.push(gcMetric);
    
    // Keep only recent GC stats
    if (this.metrics.gc.length > this.options.maxSamples) {
      this.metrics.gc.shift();
    }
    
    // Check for memory pressure
    const memoryPressure = gcMetric.usedHeapSize / gcMetric.totalHeapSize;
    if (memoryPressure > this.options.memoryThreshold && this.options.enableAutoGC) {
      this.triggerGarbageCollection('High memory pressure detected');
    }
  }
  
  /**
   * Trigger garbage collection with optimization
   */
  triggerGarbageCollection(reason = 'Manual trigger') {
    if (!global.gc) return false;
    
    const beforeMemory = process.memoryUsage();
    const startTime = performance.now();
    
    try {
      global.gc();
      const afterMemory = process.memoryUsage();
      const duration = performance.now() - startTime;
      
      const memoryFreed = beforeMemory.heapUsed - afterMemory.heapUsed;
      
      this.metrics.performance.gcTriggers++;
      
      console.log(`♻️  GC Triggered (${reason}): Freed ${Math.round(memoryFreed / 1024 / 1024)}MB in ${duration.toFixed(2)}ms`);
      
      this.emit('gc-triggered', {
        reason,
        memoryFreed,
        duration,
        beforeMemory,
        afterMemory
      });
      
      return true;
    } catch (error) {
      console.error('❌ GC Trigger failed:', error.message);
      return false;
    }
  }
  
  /**
   * Sample system metrics with advanced analysis
   */
  sample() {
    const timestamp = Date.now();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Memory metrics
    const memoryMetric = {
      timestamp,
      ...memoryUsage,
      pressure: memoryUsage.heapUsed / memoryUsage.heapTotal,
      external: memoryUsage.external
    };
    
    this.metrics.memory.push(memoryMetric);
    
    // CPU metrics
    const cpuMetric = {
      timestamp,
      user: cpuUsage.user,
      system: cpuUsage.system,
      loadAverage: os.loadavg(),
      cpuCount: os.cpus().length
    };
    
    this.metrics.cpu.push(cpuMetric);
    
    // Event loop lag
    const eventLoopStart = performance.now();
    setImmediate(() => {
      const lag = performance.now() - eventLoopStart;
      this.metrics.eventLoop.push({
        timestamp,
        lag: lag
      });
      
      // Keep only recent samples
      if (this.metrics.eventLoop.length > this.options.maxSamples) {
        this.metrics.eventLoop.shift();
      }
    });
    
    // Keep only recent samples
    if (this.metrics.memory.length > this.options.maxSamples) {
      this.metrics.memory.shift();
    }
    if (this.metrics.cpu.length > this.options.maxSamples) {
      this.metrics.cpu.shift();
    }
    
    this.metrics.performance.totalSamples++;
    
    // Analyze metrics for optimization opportunities
    this.analyzeMetrics(memoryMetric, cpuMetric);
  }
  
  /**
   * Analyze metrics for optimization opportunities
   */
  analyzeMetrics(memoryMetric, cpuMetric) {
    const alerts = [];
    
    // Memory analysis
    if (memoryMetric.pressure > this.options.memoryThreshold) {
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: `High memory pressure: ${(memoryMetric.pressure * 100).toFixed(1)}%`,
        value: memoryMetric.pressure,
        threshold: this.options.memoryThreshold
      });
      
      // Auto-trigger GC if enabled
      if (this.options.enableAutoGC && memoryMetric.pressure > 0.9) {
        this.triggerGarbageCollection('Critical memory pressure');
      }
    }
    
    // CPU analysis
    const avgLoad = cpuMetric.loadAverage[0];
    const cpuPressure = avgLoad / cpuMetric.cpuCount;
    
    if (cpuPressure > this.options.cpuThreshold) {
      alerts.push({
        type: 'cpu',
        severity: 'warning',
        message: `High CPU load: ${(cpuPressure * 100).toFixed(1)}%`,
        value: cpuPressure,
        threshold: this.options.cpuThreshold
      });
    }
    
    // Memory leak detection
    if (this.metrics.memory.length >= 10) {
      const recentMemory = this.metrics.memory.slice(-10);
      const memoryTrend = this.calculateTrend(recentMemory, 'heapUsed');
      
      if (memoryTrend > 1024 * 1024 * 10) { // 10MB increase trend
        alerts.push({
          type: 'memory-leak',
          severity: 'critical',
          message: `Potential memory leak detected: ${Math.round(memoryTrend / 1024 / 1024)}MB trend`,
          value: memoryTrend,
          threshold: 1024 * 1024 * 10
        });
        
        this.metrics.performance.memoryLeaks++;
      }
    }
    
    // Process alerts
    if (alerts.length > 0) {
      this.processAlerts(alerts);
    } else {
      this.consecutiveAlerts = 0;
    }
  }
  
  /**
   * Calculate trend for a specific metric
   */
  calculateTrend(samples, property) {
    if (samples.length < 2) return 0;
    
    const first = samples[0][property];
    const last = samples[samples.length - 1][property];
    
    return (last - first) / samples.length; // Average change per sample
  }
  
  /**
   * Process alerts and trigger optimizations
   */
  processAlerts(alerts) {
    this.consecutiveAlerts++;
    
    for (const alert of alerts) {
      this.metrics.alerts.push({
        ...alert,
        timestamp: Date.now(),
        consecutive: this.consecutiveAlerts
      });
      
      // Emit alert event
      this.emit('alert', alert);
      
      // Auto-optimization
      if (this.consecutiveAlerts >= this.options.alertThreshold) {
        this.triggerOptimization(alert);
      }
    }
    
    // Keep only recent alerts
    if (this.metrics.alerts.length > this.options.maxSamples) {
      this.metrics.alerts.shift();
    }
    
    this.metrics.performance.totalAlerts++;
  }
  
  /**
   * Trigger automatic optimization based on alerts
   */
  triggerOptimization(alert) {
    console.log(`⚡ Auto-optimization triggered for: ${alert.type}`);
    
    switch (alert.type) {
      case 'memory':
      case 'memory-leak':
        this.optimizeMemory();
        break;
      case 'cpu':
        this.optimizeCPU();
        break;
      default:
        console.log(`   ⚠️  No optimization available for: ${alert.type}`);
    }
    
    this.metrics.performance.optimizations++;
    this.consecutiveAlerts = 0; // Reset counter after optimization
  }
  
  /**
   * Memory optimization procedures
   */
  optimizeMemory() {
    console.log('   💾 Executing memory optimization...');
    
    // Force garbage collection
    if (global.gc) {
      this.triggerGarbageCollection('Auto-optimization');
    }
    
    // Clear caches if available
    this.emit('optimize-memory', {
      action: 'clear-caches',
      timestamp: Date.now()
    });
    
    console.log('   ✅ Memory optimization completed');
  }
  
  /**
   * CPU optimization procedures
   */
  optimizeCPU() {
    console.log('   🔧 Executing CPU optimization...');
    
    // Reduce sampling frequency temporarily
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(this.sample, this.options.samplingInterval * 2);
      
      // Reset to normal frequency after 1 minute
      setTimeout(() => {
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = setInterval(this.sample, this.options.samplingInterval);
        }
      }, 60000);
    }
    
    this.emit('optimize-cpu', {
      action: 'reduce-sampling',
      timestamp: Date.now()
    });
    
    console.log('   ✅ CPU optimization completed');
  }
  
  /**
   * Measure operation performance
   */
  measureOperation(name, operation) {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    try {
      const result = operation();
      
      if (result && typeof result.then === 'function') {
        // Handle async operations
        return result.then(asyncResult => {
          this.recordOperation(name, startTime, startMemory);
          return asyncResult;
        }).catch(error => {
          this.recordOperation(name, startTime, startMemory, error);
          throw error;
        });
      } else {
        // Handle sync operations
        this.recordOperation(name, startTime, startMemory);
        return result;
      }
    } catch (error) {
      this.recordOperation(name, startTime, startMemory, error);
      throw error;
    }
  }
  
  /**
   * Record operation metrics
   */
  recordOperation(name, startTime, startMemory, error = null) {
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    
    const operationMetric = {
      name,
      duration: endTime - startTime,
      memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
      success: !error,
      error: error ? error.message : null,
      timestamp: Date.now()
    };
    
    if (!this.metrics.requests.has(name)) {
      this.metrics.requests.set(name, []);
    }
    
    const operations = this.metrics.requests.get(name);
    operations.push(operationMetric);
    
    // Keep only recent operations
    if (operations.length > 100) {
      operations.shift();
    }
    
    // Emit performance data
    this.emit('operation-measured', operationMetric);
  }
  
  /**
   * Get comprehensive statistics
   */
  getStats() {
    const currentMemory = process.memoryUsage();
    const currentCPU = os.loadavg();
    
    // Calculate averages
    const avgMemoryPressure = this.metrics.memory.length > 0
      ? this.metrics.memory.reduce((sum, m) => sum + m.pressure, 0) / this.metrics.memory.length
      : 0;
    
    const avgEventLoopLag = this.metrics.eventLoop.length > 0
      ? this.metrics.eventLoop.reduce((sum, e) => sum + e.lag, 0) / this.metrics.eventLoop.length
      : 0;
    
    return {
      isMonitoring: this.isMonitoring,
      samplingInterval: this.options.samplingInterval,
      totalSamples: this.metrics.performance.totalSamples,
      totalAlerts: this.metrics.performance.totalAlerts,
      memoryLeaks: this.metrics.performance.memoryLeaks,
      gcTriggers: this.metrics.performance.gcTriggers,
      optimizations: this.metrics.performance.optimizations,
      current: {
        memory: currentMemory,
        memoryPressure: currentMemory.heapUsed / currentMemory.heapTotal,
        cpu: currentCPU,
        eventLoopLag: this.metrics.eventLoop.length > 0 ? this.metrics.eventLoop[this.metrics.eventLoop.length - 1].lag : 0
      },
      averages: {
        memoryPressure: avgMemoryPressure,
        eventLoopLag: avgEventLoopLag
      },
      recentAlerts: this.metrics.alerts.slice(-10),
      operations: Object.fromEntries(this.metrics.requests),
      recommendations: this.generateRecommendations()
    };
  }
  
  /**
   * Generate optimization recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Memory recommendations
    if (this.metrics.performance.memoryLeaks > 0) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        message: 'Memory leaks detected - Review object lifecycle and cleanup',
        action: 'Enable more frequent GC or review memory usage patterns'
      });
    }
    
    // Performance recommendations
    const avgEventLoopLag = this.metrics.eventLoop.length > 0
      ? this.metrics.eventLoop.reduce((sum, e) => sum + e.lag, 0) / this.metrics.eventLoop.length
      : 0;
    
    if (avgEventLoopLag > 10) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: `High event loop lag: ${avgEventLoopLag.toFixed(2)}ms`,
        action: 'Consider using worker threads for CPU-intensive tasks'
      });
    }
    
    // GC recommendations
    if (this.metrics.performance.gcTriggers > 50) {
      recommendations.push({
        type: 'gc',
        priority: 'low',
        message: 'High GC activity detected',
        action: 'Consider optimizing memory allocation patterns'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Cleanup resources
   */
  cleanup() {
    this.stop();
    this.metrics.memory = [];
    this.metrics.cpu = [];
    this.metrics.eventLoop = [];
    this.metrics.gc = [];
    this.metrics.requests.clear();
    this.metrics.alerts = [];
  }
}

export default AdvancedPerformanceMonitor;
