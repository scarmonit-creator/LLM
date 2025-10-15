#!/usr/bin/env node
/**
 * ULTRA-OPTIMIZED Performance Monitor for LLM AI Bridge
 * Real-time performance tracking, automated optimization, and predictive analytics
 * Advanced memory management and system resource optimization
 */

import { performance, PerformanceObserver } from 'perf_hooks';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import cluster from 'cluster';
import v8 from 'v8';

/**
 * Advanced Performance Monitor with Autonomous Optimization
 */
export class OptimizedPerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      samplingInterval: options.samplingInterval || 5000,
      memoryThreshold: options.memoryThreshold || 0.85,
      cpuThreshold: options.cpuThreshold || 0.8,
      responseTimeThreshold: options.responseTimeThreshold || 500,
      maxHistorySize: options.maxHistorySize || 500,
      enableFileLogging: options.enableFileLogging || false,
      enableAutonomousOptimization: options.enableAutonomousOptimization || true,
      optimizationInterval: options.optimizationInterval || 60000, // 1 minute
      predictiveAnalysis: options.predictiveAnalysis || true,
      ...options
    };
    
    this.metrics = {
      startTime: Date.now(),
      samples: new Map(), // Use Map for better performance
      alerts: [],
      totalRequests: 0,
      errorCount: 0,
      slowRequests: 0,
      memoryLeaks: [],
      optimizations: [],
      predictions: []
    };
    
    this.baseline = null;
    this.isMonitoring = false;
    this.lastOptimization = 0;
    this.performanceHistory = new Array(100).fill(null);
    this.historyIndex = 0;
    
    // V8 heap statistics for advanced monitoring
    this.heapStats = {
      initial: null,
      current: null,
      trend: []
    };
    
    this.setupPerformanceObserver();
    this.setupAutonomousOptimization();
  }
  
  setupPerformanceObserver() {
    this.perfObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      
      for (const entry of entries) {
        this.processPerformanceEntry(entry);
      }
    });
    
    // Monitor all performance entry types with error handling
    const entryTypes = ['measure', 'navigation', 'resource', 'paint', 'mark'];
    
    for (const type of entryTypes) {
      try {
        this.perfObserver.observe({ type, buffered: true });
      } catch (error) {
        console.warn(`[OptimizedPerformanceMonitor] Cannot observe ${type}:`, error.message);
      }
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
    
    // Use Map for O(1) lookups
    const key = `${entry.name}-${entry.entryType}`;
    this.metrics.samples.set(key, metric);
    
    // Maintain size limit efficiently
    if (this.metrics.samples.size > this.options.maxHistorySize) {
      const firstKey = this.metrics.samples.keys().next().value;
      this.metrics.samples.delete(firstKey);
    }
    
    // Performance analysis and optimization
    this.analyzePerformance(metric);
    
    // Track slow operations with immediate optimization
    if (entry.duration > this.options.responseTimeThreshold) {
      this.metrics.slowRequests++;
      this.handleSlowOperation(metric);
    }
  }
  
  analyzePerformance(metric) {
    // Store in circular buffer for trend analysis
    this.performanceHistory[this.historyIndex] = {
      duration: metric.duration,
      timestamp: metric.timestamp,
      name: metric.name
    };
    this.historyIndex = (this.historyIndex + 1) % 100;
    
    // Predictive analysis
    if (this.options.predictiveAnalysis) {
      this.performPredictiveAnalysis(metric);
    }
  }
  
  performPredictiveAnalysis(metric) {
    const recentMetrics = this.performanceHistory.filter(m => m && m.timestamp > Date.now() - 300000); // Last 5 minutes
    
    if (recentMetrics.length > 10) {
      const avgDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length;
      const trend = this.calculatePerformanceTrend(recentMetrics);
      
      // Predict performance degradation
      if (trend > 0.1 && avgDuration > this.options.responseTimeThreshold * 0.8) {
        const prediction = {
          type: 'performance-degradation',
          confidence: Math.min(trend * 100, 100),
          predictedTime: Date.now() + (trend * 60000), // Predicted time of degradation
          recommendation: this.generateOptimizationRecommendation(recentMetrics),
          timestamp: Date.now()
        };
        
        this.metrics.predictions.push(prediction);
        this.emit('prediction', prediction);
        
        // Trigger preemptive optimization
        if (prediction.confidence > 70) {
          this.triggerPreemptiveOptimization(prediction);
        }
      }
    }
  }
  
  calculatePerformanceTrend(metrics) {
    const n = metrics.length;
    const x = metrics.map((_, i) => i);
    const y = metrics.map(m => m.duration);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) || 0;
  }
  
  generateOptimizationRecommendation(metrics) {
    const slowOps = metrics.filter(m => m.duration > this.options.responseTimeThreshold);
    const recommendations = [];
    
    if (slowOps.length > metrics.length * 0.3) {
      recommendations.push('Increase cache TTL');
      recommendations.push('Enable compression');
      recommendations.push('Optimize database queries');
    }
    
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed / memUsage.heapTotal > 0.7) {
      recommendations.push('Trigger garbage collection');
      recommendations.push('Clear cache entries');
      recommendations.push('Reduce memory footprint');
    }
    
    return recommendations;
  }
  
  triggerPreemptiveOptimization(prediction) {
    console.log(`🔮 [OptimizedPerformanceMonitor] Preemptive optimization triggered: ${prediction.confidence}% confidence`);
    
    // Execute recommended optimizations
    prediction.recommendation.forEach(rec => {
      this.executeOptimization(rec);
    });
    
    this.addAlert({
      type: 'preemptive-optimization',
      severity: 'info',
      message: `Preemptive optimization executed based on ${prediction.confidence}% confidence prediction`,
      prediction
    });
  }
  
  executeOptimization(optimization) {
    const optimizations = {
      'Trigger garbage collection': () => {
        if (global.gc) {
          global.gc();
          console.log('🗑️ [OptimizedPerformanceMonitor] Garbage collection triggered');
        }
      },
      'Clear cache entries': () => {
        this.emit('clear-cache', { reason: 'performance-optimization' });
        console.log('🧹 [OptimizedPerformanceMonitor] Cache clear requested');
      },
      'Optimize database queries': () => {
        this.emit('optimize-queries', { reason: 'performance-prediction' });
        console.log('🔧 [OptimizedPerformanceMonitor] Database optimization requested');
      },
      'Increase cache TTL': () => {
        this.emit('adjust-cache-ttl', { factor: 1.5 });
        console.log('⏱️ [OptimizedPerformanceMonitor] Cache TTL adjustment requested');
      },
      'Enable compression': () => {
        this.emit('enable-compression', { level: 9 });
        console.log('📦 [OptimizedPerformanceMonitor] Compression optimization requested');
      },
      'Reduce memory footprint': () => {
        this.emit('reduce-memory', { target: 0.7 });
        console.log('💾 [OptimizedPerformanceMonitor] Memory reduction requested');
      }
    };
    
    const optimizationFn = optimizations[optimization];
    if (optimizationFn) {
      try {
        optimizationFn();
        this.metrics.optimizations.push({
          type: optimization,
          timestamp: Date.now(),
          success: true
        });
      } catch (error) {
        console.error(`❌ [OptimizedPerformanceMonitor] Optimization failed: ${optimization}`, error);
        this.metrics.optimizations.push({
          type: optimization,
          timestamp: Date.now(),
          success: false,
          error: error.message
        });
      }
    }
  }
  
  handleSlowOperation(metric) {
    this.emit('slow-operation', metric);
    
    this.addAlert({
      type: 'performance',
      severity: 'warning',
      message: `Slow operation: ${metric.name} took ${metric.duration.toFixed(2)}ms`,
      metric,
      autoOptimize: true
    });
    
    // Immediate optimization for critical slowdowns
    if (metric.duration > this.options.responseTimeThreshold * 2) {
      this.executeOptimization('Trigger garbage collection');
    }
  }
  
  setupAutonomousOptimization() {
    if (!this.options.enableAutonomousOptimization) return;
    
    this.optimizationTimer = setInterval(() => {
      this.performAutonomousOptimization();
    }, this.options.optimizationInterval);
  }
  
  performAutonomousOptimization() {
    const now = Date.now();
    if (now - this.lastOptimization < this.options.optimizationInterval) return;
    
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    const cpuUsage = process.cpuUsage(this.lastCpuUsage || undefined);
    this.lastCpuUsage = process.cpuUsage();
    
    // Analyze system state
    const systemState = {
      memoryPressure: memUsage.heapUsed / memUsage.heapTotal,
      heapFragmentation: 1 - (heapStats.used_heap_size / heapStats.total_heap_size),
      cpuUsage: cpuUsage ? (cpuUsage.user + cpuUsage.system) / 1000000 : 0, // Convert to seconds
      recentErrors: this.metrics.errorCount,
      slowRequests: this.metrics.slowRequests
    };
    
    const optimizations = this.analyzeSystemState(systemState);
    
    if (optimizations.length > 0) {
      console.log(`🤖 [OptimizedPerformanceMonitor] Autonomous optimization executing: ${optimizations.join(', ')}`);
      
      optimizations.forEach(opt => {
        this.executeOptimization(opt);
      });
      
      this.lastOptimization = now;
      
      this.addAlert({
        type: 'autonomous-optimization',
        severity: 'info',
        message: `Autonomous optimization executed: ${optimizations.length} optimizations`,
        optimizations,
        systemState
      });
    }
  }
  
  analyzeSystemState(state) {
    const optimizations = [];
    
    // Memory optimizations
    if (state.memoryPressure > this.options.memoryThreshold) {
      optimizations.push('Trigger garbage collection');
      if (state.memoryPressure > 0.9) {
        optimizations.push('Clear cache entries');
        optimizations.push('Reduce memory footprint');
      }
    }
    
    // Heap fragmentation optimization
    if (state.heapFragmentation > 0.3) {
      optimizations.push('Trigger garbage collection');
    }
    
    // Performance optimizations
    if (state.slowRequests > 10) {
      optimizations.push('Increase cache TTL');
      optimizations.push('Enable compression');
    }
    
    // CPU optimizations
    if (state.cpuUsage > this.options.cpuThreshold) {
      optimizations.push('Optimize database queries');
    }
    
    return [...new Set(optimizations)]; // Remove duplicates
  }
  
  start() {
    if (this.isMonitoring) {
      console.warn('[OptimizedPerformanceMonitor] Already monitoring');
      return;
    }
    
    this.isMonitoring = true;
    this.baseline = this.captureBaseline();
    this.heapStats.initial = v8.getHeapStatistics();
    
    // Start periodic sampling
    this.samplingTimer = setInterval(() => {
      this.collectSample();
    }, this.options.samplingInterval);
    
    console.log('🚀 [OptimizedPerformanceMonitor] Advanced monitoring started with autonomous optimization');
    this.emit('started');
  }
  
  stop() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.samplingTimer) clearInterval(this.samplingTimer);
    if (this.optimizationTimer) clearInterval(this.optimizationTimer);
    if (this.perfObserver) this.perfObserver.disconnect();
    
    console.log('🛑 [OptimizedPerformanceMonitor] Monitoring stopped');
    this.emit('stopped');
  }
  
  captureBaseline() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const heapStats = v8.getHeapStatistics();
    
    return {
      timestamp: Date.now(),
      memory: memUsage,
      cpu: cpuUsage,
      heap: heapStats,
      uptime: process.uptime()
    };
  }
  
  collectSample() {
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    const cpuUsage = process.cpuUsage();
    
    const sample = {
      timestamp: Date.now(),
      memory: {
        ...memUsage,
        usage: memUsage.heapUsed / memUsage.heapTotal,
        pressure: this.calculateMemoryPressure(memUsage, heapStats)
      },
      heap: heapStats,
      cpu: cpuUsage,
      uptime: process.uptime(),
      workerId: cluster.worker?.id || 'master'
    };
    
    // Update heap statistics trend
    this.heapStats.current = heapStats;
    this.heapStats.trend.push({
      timestamp: Date.now(),
      used: heapStats.used_heap_size,
      total: heapStats.total_heap_size
    });
    
    if (this.heapStats.trend.length > 50) {
      this.heapStats.trend.shift();
    }
    
    // Advanced memory analysis
    this.analyzeMemoryPatterns(sample);
    
    // Check thresholds and trigger optimizations
    this.checkThresholds(sample);
    
    this.emit('sample', sample);
    
    if (this.options.enableFileLogging) {
      this.logToFile(sample);
    }
  }
  
  calculateMemoryPressure(memUsage, heapStats) {
    const heapPressure = memUsage.heapUsed / memUsage.heapTotal;
    const totalPressure = memUsage.rss / (heapStats.heap_size_limit || memUsage.rss * 2);
    return Math.max(heapPressure, totalPressure);
  }
  
  analyzeMemoryPatterns(sample) {
    if (this.heapStats.trend.length > 10) {
      const trend = this.calculateMemoryTrend();
      
      if (trend.slope > 1024 * 1024 && trend.correlation > 0.7) { // 1MB per sample
        this.detectMemoryLeak(sample, trend);
      }
    }
  }
  
  calculateMemoryTrend() {
    const data = this.heapStats.trend;
    const n = data.length;
    const x = data.map((_, i) => i);
    const y = data.map(d => d.used);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) || 0;
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate correlation
    const meanX = sumX / n;
    const meanY = sumY / n;
    const numerator = x.reduce((acc, xi, i) => acc + (xi - meanX) * (y[i] - meanY), 0);
    const denomX = Math.sqrt(x.reduce((acc, xi) => acc + (xi - meanX) ** 2, 0));
    const denomY = Math.sqrt(y.reduce((acc, yi) => acc + (yi - meanY) ** 2, 0));
    const correlation = denomX && denomY ? numerator / (denomX * denomY) : 0;
    
    return { slope, intercept, correlation };
  }
  
  detectMemoryLeak(sample, trend) {
    const leak = {
      timestamp: Date.now(),
      trend,
      sample,
      severity: trend.slope > 5 * 1024 * 1024 ? 'critical' : 'warning' // 5MB per sample
    };
    
    this.metrics.memoryLeaks.push(leak);
    
    this.addAlert({
      type: 'memory-leak',
      severity: leak.severity,
      message: `Memory leak detected: ${(trend.slope / 1024 / 1024).toFixed(2)} MB/sample trend`,
      leak,
      autoOptimize: true
    });
    
    this.emit('memory-leak', leak);
    
    // Immediate intervention for critical leaks
    if (leak.severity === 'critical') {
      this.executeOptimization('Trigger garbage collection');
      this.executeOptimization('Clear cache entries');
      this.executeOptimization('Reduce memory footprint');
    }
  }
  
  checkThresholds(sample) {
    // Memory threshold check
    if (sample.memory.pressure > this.options.memoryThreshold) {
      this.handleMemoryAlert(sample);
    }
    
    // CPU threshold check (if available)
    if (this.lastCpuUsage) {
      const cpuDelta = process.cpuUsage(this.lastCpuUsage);
      const cpuPercent = (cpuDelta.user + cpuDelta.system) / 1000000 / (this.options.samplingInterval / 1000);
      
      if (cpuPercent > this.options.cpuThreshold) {
        this.handleCpuAlert(sample, cpuPercent);
      }
    }
  }
  
  handleMemoryAlert(sample) {
    const alert = {
      type: 'memory',
      severity: sample.memory.pressure > 0.95 ? 'critical' : 'warning',
      message: `High memory pressure: ${Math.round(sample.memory.pressure * 100)}%`,
      sample,
      timestamp: Date.now()
    };
    
    this.addAlert(alert);
    this.emit('memory-alert', alert);
    
    // Immediate optimization for critical memory pressure
    if (alert.severity === 'critical') {
      this.executeOptimization('Trigger garbage collection');
      this.executeOptimization('Clear cache entries');
    }
  }
  
  handleCpuAlert(sample, cpuPercent) {
    const alert = {
      type: 'cpu',
      severity: cpuPercent > 0.9 ? 'critical' : 'warning',
      message: `High CPU usage: ${Math.round(cpuPercent * 100)}%`,
      sample,
      cpuPercent,
      timestamp: Date.now()
    };
    
    this.addAlert(alert);
    this.emit('cpu-alert', alert);
  }
  
  addAlert(alert) {
    this.metrics.alerts.push(alert);
    
    // Maintain alert history limit
    if (this.metrics.alerts.length > 100) {
      this.metrics.alerts.shift();
    }
    
    const severity = alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵';
    console.warn(`${severity} [OptimizedPerformanceMonitor] ${alert.message}`);
    
    // Auto-execute optimizations for critical alerts
    if (alert.autoOptimize && alert.severity === 'critical') {
      setTimeout(() => this.executeOptimization('Trigger garbage collection'), 100);
    }
  }
  
  async logToFile(sample) {
    try {
      const logEntry = {
        timestamp: new Date(sample.timestamp).toISOString(),
        worker: sample.workerId,
        ...sample
      };
      
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.options.logFilePath, logLine);
    } catch (error) {
      console.error('[OptimizedPerformanceMonitor] Failed to write log:', error);
    }
  }
  
  getStats() {
    const uptime = Date.now() - this.metrics.startTime;
    const samples = Array.from(this.metrics.samples.values());
    const recentSamples = samples.slice(-20);
    
    // Calculate averages and trends
    const avgMemoryUsage = recentSamples.length > 0 ?
      recentSamples.reduce((acc, s) => acc + (s.memory?.usage || 0), 0) / recentSamples.length : 0;
    
    const avgResponseTime = samples.length > 0 ?
      samples.filter(s => s.duration).reduce((acc, s) => acc + s.duration, 0) / samples.filter(s => s.duration).length : 0;
    
    return {
      uptime: Math.floor(uptime / 1000),
      isMonitoring: this.isMonitoring,
      totalSamples: samples.length,
      totalAlerts: this.metrics.alerts.length,
      memoryLeaks: this.metrics.memoryLeaks.length,
      optimizations: this.metrics.optimizations.length,
      predictions: this.metrics.predictions.length,
      totalRequests: this.metrics.totalRequests,
      errorCount: this.metrics.errorCount,
      slowRequests: this.metrics.slowRequests,
      avgMemoryUsage: Math.round(avgMemoryUsage * 100),
      avgResponseTime: Math.round(avgResponseTime),
      recentAlerts: this.metrics.alerts.slice(-5),
      recentOptimizations: this.metrics.optimizations.slice(-5),
      currentMemory: process.memoryUsage(),
      heapStatistics: v8.getHeapStatistics(),
      baseline: this.baseline,
      autonomousOptimization: this.options.enableAutonomousOptimization,
      predictiveAnalysis: this.options.predictiveAnalysis
    };
  }
  
  // Utility method for measuring operation performance with automatic optimization
  measureOperation(name, operation) {
    const startMark = `${name}-start-${Date.now()}`;
    const endMark = `${name}-end-${Date.now()}`;
    const measureName = `${name}-duration`;
    
    performance.mark(startMark);
    
    const executeOperation = () => {
      performance.mark(endMark);
      performance.measure(measureName, startMark, endMark);
      
      // Clean up marks to prevent memory leaks
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
    };
    
    const result = operation();
    
    if (result && typeof result.then === 'function') {
      return result
        .then((res) => {
          executeOperation();
          return res;
        })
        .catch((error) => {
          executeOperation();
          this.metrics.errorCount++;
          throw error;
        });
    } else {
      executeOperation();
      return result;
    }
  }
  
  // Get real-time system health score
  getHealthScore() {
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    
    const memoryScore = Math.max(0, 100 - (memUsage.heapUsed / memUsage.heapTotal * 100));
    const errorScore = Math.max(0, 100 - (this.metrics.errorCount / Math.max(1, this.metrics.totalRequests) * 100));
    const performanceScore = Math.max(0, 100 - (this.metrics.slowRequests / Math.max(1, this.metrics.totalRequests) * 100));
    const heapScore = Math.max(0, 100 - (heapStats.used_heap_size / heapStats.total_heap_size * 100));
    
    const overallScore = (memoryScore + errorScore + performanceScore + heapScore) / 4;
    
    return {
      overall: Math.round(overallScore),
      memory: Math.round(memoryScore),
      errors: Math.round(errorScore),
      performance: Math.round(performanceScore),
      heap: Math.round(heapScore),
      status: overallScore > 80 ? 'excellent' : overallScore > 60 ? 'good' : overallScore > 40 ? 'fair' : 'poor'
    };
  }
}

// Export default instance for backwards compatibility
export default new OptimizedPerformanceMonitor();

// Export class for custom instances
export { OptimizedPerformanceMonitor as PerformanceMonitor };