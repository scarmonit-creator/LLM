#!/usr/bin/env node
/**
 * Advanced Performance Monitor for LLM AI Bridge
 * Real-time performance tracking, memory optimization, and automated alerts
 */

import { performance, PerformanceObserver } from 'perf_hooks';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

/**
 * Real-time Performance Monitor with Advanced Analytics
 */
export class PerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      samplingInterval: options.samplingInterval || 5000, // 5 seconds
      memoryThreshold: options.memoryThreshold || 0.85, // 85% memory usage
      responseTimeThreshold: options.responseTimeThreshold || 1000, // 1 second
      maxHistorySize: options.maxHistorySize || 1000,
      enableFileLogging: options.enableFileLogging || false,
      logFilePath: options.logFilePath || './performance.log',
      ...options
    };
    
    this.metrics = {
      startTime: Date.now(),
      samples: [],
      alerts: [],
      totalRequests: 0,
      errorCount: 0,
      slowRequests: 0,
      memoryLeaks: []
    };
    
    this.baseline = null;
    this.isMonitoring = false;
    
    this.setupPerformanceObserver();
  }
  
  setupPerformanceObserver() {
    this.perfObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      
      entries.forEach((entry) => {
        this.processPerformanceEntry(entry);
      });
    });
    
    // Monitor all performance entry types
    try {
      this.perfObserver.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
    } catch (error) {
      console.warn('[PerformanceMonitor] Some performance entry types not supported:', error.message);
      // Fallback to basic measurement
      this.perfObserver.observe({ type: 'measure', buffered: true });
    }
  }
  
  processPerformanceEntry(entry) {
    const metric = {
      name: entry.name,
      duration: entry.duration,
      startTime: entry.startTime,
      entryType: entry.entryType,
      timestamp: Date.now()
    };
    
    // Track slow operations
    if (entry.duration > this.options.responseTimeThreshold) {
      this.metrics.slowRequests++;
      this.emit('slow-operation', metric);
      
      this.addAlert({
        type: 'performance',
        severity: 'warning',
        message: `Slow operation detected: ${entry.name} took ${entry.duration.toFixed(2)}ms`,
        metric
      });
    }
    
    // Store in history with size limit
    this.metrics.samples.push(metric);
    if (this.metrics.samples.length > this.options.maxHistorySize) {
      this.metrics.samples.shift();
    }
  }
  
  start() {
    if (this.isMonitoring) {
      console.warn('[PerformanceMonitor] Already monitoring');
      return;
    }
    
    this.isMonitoring = true;
    this.baseline = this.captureBaseline();
    
    // Start periodic sampling
    this.samplingTimer = setInterval(() => {
      this.collectSample();
    }, this.options.samplingInterval);
    
    console.log('[PerformanceMonitor] Started performance monitoring');
    this.emit('started');
  }
  
  stop() {
    if (!this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = false;
    
    if (this.samplingTimer) {
      clearInterval(this.samplingTimer);
    }
    
    if (this.perfObserver) {
      this.perfObserver.disconnect();
    }
    
    console.log('[PerformanceMonitor] Stopped performance monitoring');
    this.emit('stopped');
  }
  
  captureBaseline() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      timestamp: Date.now(),
      memory: {
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime()
    };
  }
  
  collectSample() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const sample = {
      timestamp: Date.now(),
      memory: {
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        usage: memUsage.heapUsed / memUsage.heapTotal
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      eventLoopDelay: this.measureEventLoopDelay()
    };
    
    // Check memory threshold
    if (sample.memory.usage > this.options.memoryThreshold) {
      this.handleMemoryAlert(sample);
    }
    
    // Detect memory leaks
    this.detectMemoryLeak(sample);
    
    // Emit sample for real-time monitoring
    this.emit('sample', sample);
    
    // Log to file if enabled
    if (this.options.enableFileLogging) {
      this.logToFile(sample);
    }
  }
  
  measureEventLoopDelay() {
    const start = performance.now();
    setImmediate(() => {
      const delay = performance.now() - start;
      this.emit('event-loop-delay', delay);
    });
    return 0; // Placeholder for immediate return
  }
  
  handleMemoryAlert(sample) {
    const alert = {
      type: 'memory',
      severity: 'critical',
      message: `High memory usage detected: ${Math.round(sample.memory.usage * 100)}%`,
      sample,
      timestamp: Date.now()
    };
    
    this.addAlert(alert);
    this.emit('memory-alert', alert);
    
    // Trigger garbage collection if possible
    if (global.gc) {
      console.log('[PerformanceMonitor] Triggering garbage collection');
      global.gc();
    }
  }
  
  detectMemoryLeak(sample) {
    // Simple memory leak detection based on sustained growth
    const recentSamples = this.metrics.samples.slice(-20); // Last 20 samples
    
    if (recentSamples.length >= 20) {
      const memoryTrend = this.calculateMemoryTrend(recentSamples);
      
      if (memoryTrend.slope > 0.1 && memoryTrend.correlation > 0.8) {
        const leak = {
          timestamp: Date.now(),
          trend: memoryTrend,
          sample
        };
        
        this.metrics.memoryLeaks.push(leak);
        
        this.addAlert({
          type: 'memory-leak',
          severity: 'critical',
          message: `Potential memory leak detected: ${memoryTrend.slope.toFixed(4)} MB/sample`,
          leak
        });
        
        this.emit('memory-leak', leak);
      }
    }
  }
  
  calculateMemoryTrend(samples) {
    const n = samples.length;
    const x = samples.map((_, i) => i);
    const y = samples.map(s => s.memory.heapUsed / (1024 * 1024)); // Convert to MB
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate correlation coefficient
    const meanX = sumX / n;
    const meanY = sumY / n;
    
    const numerator = x.reduce((acc, xi, i) => acc + (xi - meanX) * (y[i] - meanY), 0);
    const denomX = Math.sqrt(x.reduce((acc, xi) => acc + (xi - meanX) ** 2, 0));
    const denomY = Math.sqrt(y.reduce((acc, yi) => acc + (yi - meanY) ** 2, 0));
    
    const correlation = numerator / (denomX * denomY);
    
    return { slope, intercept, correlation };
  }
  
  addAlert(alert) {
    this.metrics.alerts.push(alert);
    
    // Keep only recent alerts
    if (this.metrics.alerts.length > 100) {
      this.metrics.alerts.shift();
    }
    
    console.warn(`[PerformanceMonitor] ALERT [${alert.severity}]: ${alert.message}`);
  }
  
  async logToFile(sample) {
    try {
      const logEntry = {
        timestamp: new Date(sample.timestamp).toISOString(),
        ...sample
      };
      
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.options.logFilePath, logLine);
    } catch (error) {
      console.error('[PerformanceMonitor] Failed to write to log file:', error);
    }
  }
  
  getStats() {
    const uptime = Date.now() - this.metrics.startTime;
    const recentSamples = this.metrics.samples.slice(-20);
    
    let avgMemoryUsage = 0;
    let avgResponseTime = 0;
    
    if (recentSamples.length > 0) {
      avgMemoryUsage = recentSamples.reduce((acc, s) => acc + s.memory?.usage || 0, 0) / recentSamples.length;
    }
    
    const performanceSamples = this.metrics.samples.filter(s => s.duration !== undefined);
    if (performanceSamples.length > 0) {
      avgResponseTime = performanceSamples.reduce((acc, s) => acc + s.duration, 0) / performanceSamples.length;
    }
    
    return {
      uptime: Math.floor(uptime / 1000),
      isMonitoring: this.isMonitoring,
      totalSamples: this.metrics.samples.length,
      totalAlerts: this.metrics.alerts.length,
      memoryLeaks: this.metrics.memoryLeaks.length,
      totalRequests: this.metrics.totalRequests,
      errorCount: this.metrics.errorCount,
      slowRequests: this.metrics.slowRequests,
      avgMemoryUsage: Math.round(avgMemoryUsage * 100),
      avgResponseTime: Math.round(avgResponseTime),
      recentAlerts: this.metrics.alerts.slice(-5),
      currentMemory: process.memoryUsage(),
      baseline: this.baseline
    };
  }
  
  // Utility method for measuring operation performance
  measureOperation(name, operation) {
    const startMark = `${name}-start`;
    const endMark = `${name}-end`;
    const measureName = `${name}-duration`;
    
    performance.mark(startMark);
    
    const result = operation();
    
    if (result && typeof result.then === 'function') {
      // Handle async operations
      return result.then((res) => {
        performance.mark(endMark);
        performance.measure(measureName, startMark, endMark);
        return res;
      }).catch((error) => {
        performance.mark(endMark);
        performance.measure(measureName, startMark, endMark);
        throw error;
      });
    } else {
      // Handle sync operations
      performance.mark(endMark);
      performance.measure(measureName, startMark, endMark);
      return result;
    }
  }
}

// Export default instance
export default new PerformanceMonitor();
