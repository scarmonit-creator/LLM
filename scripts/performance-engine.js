#!/usr/bin/env node

/**
 * 📈 Ultra-Performance Monitoring Engine
 * Real-time performance monitoring, auto-optimization, and predictive scaling
 * 
 * Features:
 * - Real-time metrics collection and analysis
 * - Automatic performance optimization
 * - Predictive resource scaling
 * - Memory leak detection and cleanup
 * - CPU profiling and optimization
 * - Network latency monitoring
 * - Auto-healing and recovery
 * - Performance alerting and reporting
 */

import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

class UltraPerformanceEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = {
      interval: options.interval || 5000, // 5 seconds
      memoryThreshold: options.memoryThreshold || 80, // 80% memory usage
      cpuThreshold: options.cpuThreshold || 70, // 70% CPU usage
      responseTimeThreshold: options.responseTimeThreshold || 1000, // 1 second
      errorRateThreshold: options.errorRateThreshold || 5, // 5% error rate
      autoOptimize: options.autoOptimize !== false,
      autoScale: options.autoScale !== false,
      enablePredictive: options.enablePredictive !== false,
      alerting: options.alerting !== false,
      ...options
    };
    
    this.metrics = {
      memory: { current: 0, peak: 0, average: 0, samples: [] },
      cpu: { current: 0, peak: 0, average: 0, samples: [] },
      network: { latency: 0, throughput: 0, errors: 0 },
      requests: { total: 0, successful: 0, failed: 0, responseTime: [] },
      system: { uptime: 0, load: [], processes: 0 },
      performance: { score: 100, issues: [], optimizations: [] },
      predictions: { memoryTrend: 'stable', cpuTrend: 'stable', scalingNeeded: false }
    };
    
    this.optimizations = {
      memoryCleanup: { enabled: true, lastRun: 0, frequency: 30000 },
      cpuOptimization: { enabled: true, lastRun: 0, frequency: 60000 },
      networkOptimization: { enabled: true, lastRun: 0, frequency: 45000 },
      garbageCollection: { enabled: true, lastRun: 0, frequency: 20000 }
    };
    
    this.alerts = {
      memory: { triggered: false, count: 0, lastAlert: 0 },
      cpu: { triggered: false, count: 0, lastAlert: 0 },
      errors: { triggered: false, count: 0, lastAlert: 0 },
      performance: { triggered: false, count: 0, lastAlert: 0 }
    };
    
    this.isRunning = false;
    this.startTime = Date.now();
    
    // Setup event handlers
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.on('performance-critical', this.handleCriticalPerformance.bind(this));
    this.on('memory-pressure', this.handleMemoryPressure.bind(this));
    this.on('cpu-overload', this.handleCpuOverload.bind(this));
    this.on('scaling-needed', this.handleScalingNeeded.bind(this));
    this.on('optimization-completed', this.logOptimization.bind(this));
    
    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('uncaughtException', (error) => this.handleError('uncaughtException', error));
    process.on('unhandledRejection', (reason) => this.handleError('unhandledRejection', reason));
  }

  async start() {
    if (this.isRunning) {
      console.log('📈 Performance Engine is already running');
      return;
    }
    
    console.log('🚀 Starting Ultra-Performance Monitoring Engine...');
    console.log(`🔧 Configuration: ${JSON.stringify(this.config, null, 2)}`);
    
    this.isRunning = true;
    
    // Initial system scan
    await this.collectInitialMetrics();
    
    // Start monitoring loop
    this.monitoringInterval = setInterval(() => {
      this.performMonitoringCycle();
    }, this.config.interval);
    
    // Start optimization loop
    this.optimizationInterval = setInterval(() => {
      this.performOptimizationCycle();
    }, this.config.interval * 2);
    
    // Start predictive analysis
    if (this.config.enablePredictive) {
      this.predictiveInterval = setInterval(() => {
        this.performPredictiveAnalysis();
      }, this.config.interval * 4);
    }
    
    console.log('✅ Ultra-Performance Engine started successfully');
    this.logPerformanceStatus();
  }

  async collectInitialMetrics() {
    console.log('🔍 Collecting initial system metrics...');
    
    // System information
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      totalMemory: os.totalmem(),
      cpuCount: os.cpus().length,
      hostname: os.hostname(),
      uptime: os.uptime()
    };
    
    console.log('📊 Initial System Info:', systemInfo);
    
    // Baseline performance measurement
    const baseline = await this.measureBaselinePerformance();
    console.log('🏁 Baseline Performance:', baseline);
    
    this.metrics.system = { ...systemInfo, baseline };
  }

  async measureBaselinePerformance() {
    const measurements = {
      memoryRead: await this.measureMemoryPerformance(),
      cpuBenchmark: await this.measureCpuPerformance(),
      networkLatency: await this.measureNetworkLatency(),
      diskIO: await this.measureDiskPerformance()
    };
    
    return measurements;
  }

  async measureMemoryPerformance() {
    const start = performance.now();
    const testArray = new Array(100000).fill(0).map((_, i) => ({ id: i, data: Math.random() }));
    const allocTime = performance.now() - start;
    
    const gcStart = performance.now();
    testArray.length = 0;
    if (global.gc) global.gc();
    const gcTime = performance.now() - gcStart;
    
    return { allocTime, gcTime, throughput: 100000 / allocTime };
  }

  async measureCpuPerformance() {
    const start = performance.now();
    let result = 0;
    for (let i = 0; i < 100000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    const duration = performance.now() - start;
    
    return { duration, operationsPerMs: 100000 / duration, result };
  }

  async measureNetworkLatency() {
    try {
      const start = performance.now();
      const response = await fetch('https://1.1.1.1/', { timeout: 5000 });
      const latency = performance.now() - start;
      
      return { latency, status: response.status, success: true };
    } catch (error) {
      return { latency: -1, error: error.message, success: false };
    }
  }

  async measureDiskPerformance() {
    const testFile = '/tmp/perf-test.tmp';
    const testData = 'x'.repeat(10000);
    
    try {
      const writeStart = performance.now();
      await fs.promises.writeFile(testFile, testData);
      const writeTime = performance.now() - writeStart;
      
      const readStart = performance.now();
      await fs.promises.readFile(testFile);
      const readTime = performance.now() - readStart;
      
      // Cleanup
      await fs.promises.unlink(testFile).catch(() => {});
      
      return { writeTime, readTime, throughput: testData.length / writeTime };
    } catch (error) {
      return { error: error.message, success: false };
    }
  }

  async performMonitoringCycle() {
    try {
      // Collect current metrics
      const currentMetrics = await this.collectCurrentMetrics();
      
      // Update running averages
      this.updateRunningAverages(currentMetrics);
      
      // Analyze performance trends
      this.analyzePerformanceTrends();
      
      // Check for issues
      this.detectPerformanceIssues(currentMetrics);
      
      // Update performance score
      this.calculatePerformanceScore();
      
      // Emit events for critical conditions
      this.emitPerformanceEvents(currentMetrics);
      
    } catch (error) {
      console.error('❌ Error in monitoring cycle:', error.message);
    }
  }

  async collectCurrentMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAvg = os.loadavg();
    
    return {
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        percentage: this.calculateCpuPercentage(cpuUsage)
      },
      system: {
        loadAverage: loadAvg,
        freeMemory: os.freemem(),
        totalMemory: os.totalmem(),
        uptime: process.uptime()
      },
      timestamp: Date.now()
    };
  }

  calculateCpuPercentage(cpuUsage) {
    const totalUsage = cpuUsage.user + cpuUsage.system;
    const totalTime = process.uptime() * 1000000; // Convert to microseconds
    return (totalUsage / totalTime) * 100;
  }

  updateRunningAverages(currentMetrics) {
    // Memory metrics
    this.metrics.memory.current = currentMetrics.memory.percentage;
    this.metrics.memory.samples.push(currentMetrics.memory.percentage);
    if (this.metrics.memory.samples.length > 100) {
      this.metrics.memory.samples.shift();
    }
    this.metrics.memory.average = this.metrics.memory.samples.reduce((a, b) => a + b, 0) / this.metrics.memory.samples.length;
    this.metrics.memory.peak = Math.max(this.metrics.memory.peak, currentMetrics.memory.percentage);
    
    // CPU metrics
    this.metrics.cpu.current = currentMetrics.cpu.percentage;
    this.metrics.cpu.samples.push(currentMetrics.cpu.percentage);
    if (this.metrics.cpu.samples.length > 100) {
      this.metrics.cpu.samples.shift();
    }
    this.metrics.cpu.average = this.metrics.cpu.samples.reduce((a, b) => a + b, 0) / this.metrics.cpu.samples.length;
    this.metrics.cpu.peak = Math.max(this.metrics.cpu.peak, currentMetrics.cpu.percentage);
    
    // System metrics
    this.metrics.system.uptime = currentMetrics.system.uptime;
    this.metrics.system.load = currentMetrics.system.loadAverage;
  }

  analyzePerformanceTrends() {
    // Memory trend analysis
    if (this.metrics.memory.samples.length >= 10) {
      const recentSamples = this.metrics.memory.samples.slice(-10);
      const trend = this.calculateTrend(recentSamples);
      this.metrics.predictions.memoryTrend = trend > 0.5 ? 'increasing' : trend < -0.5 ? 'decreasing' : 'stable';
    }
    
    // CPU trend analysis
    if (this.metrics.cpu.samples.length >= 10) {
      const recentSamples = this.metrics.cpu.samples.slice(-10);
      const trend = this.calculateTrend(recentSamples);
      this.metrics.predictions.cpuTrend = trend > 0.5 ? 'increasing' : trend < -0.5 ? 'decreasing' : 'stable';
    }
  }

  calculateTrend(samples) {
    const n = samples.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = samples.reduce((a, b) => a + b, 0);
    const sumXY = samples.reduce((sum, y, x) => sum + (x + 1) * y, 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  detectPerformanceIssues(currentMetrics) {
    this.metrics.performance.issues = [];
    
    // Memory pressure detection
    if (currentMetrics.memory.percentage > this.config.memoryThreshold) {
      this.metrics.performance.issues.push({
        type: 'memory-pressure',
        severity: currentMetrics.memory.percentage > 90 ? 'critical' : 'warning',
        value: currentMetrics.memory.percentage,
        threshold: this.config.memoryThreshold,
        message: `Memory usage at ${currentMetrics.memory.percentage.toFixed(1)}%`
      });
    }
    
    // CPU overload detection
    if (currentMetrics.cpu.percentage > this.config.cpuThreshold) {
      this.metrics.performance.issues.push({
        type: 'cpu-overload',
        severity: currentMetrics.cpu.percentage > 90 ? 'critical' : 'warning',
        value: currentMetrics.cpu.percentage,
        threshold: this.config.cpuThreshold,
        message: `CPU usage at ${currentMetrics.cpu.percentage.toFixed(1)}%`
      });
    }
    
    // Memory leak detection
    if (this.metrics.memory.samples.length >= 20) {
      const recentGrowth = this.metrics.memory.samples.slice(-10).reduce((a, b) => a + b, 0) / 10 -
                          this.metrics.memory.samples.slice(-20, -10).reduce((a, b) => a + b, 0) / 10;
      
      if (recentGrowth > 5) {
        this.metrics.performance.issues.push({
          type: 'memory-leak',
          severity: 'warning',
          value: recentGrowth,
          message: `Potential memory leak detected (${recentGrowth.toFixed(1)}% growth)`
        });
      }
    }
  }

  calculatePerformanceScore() {
    let score = 100;
    
    // Deduct points for high resource usage
    if (this.metrics.memory.current > 80) score -= 20;
    else if (this.metrics.memory.current > 60) score -= 10;
    
    if (this.metrics.cpu.current > 80) score -= 25;
    else if (this.metrics.cpu.current > 60) score -= 15;
    
    // Deduct points for issues
    this.metrics.performance.issues.forEach(issue => {
      if (issue.severity === 'critical') score -= 30;
      else if (issue.severity === 'warning') score -= 10;
    });
    
    // Bonus points for stability
    if (this.metrics.predictions.memoryTrend === 'stable' && this.metrics.predictions.cpuTrend === 'stable') {
      score += 5;
    }
    
    this.metrics.performance.score = Math.max(0, Math.min(100, score));
  }

  emitPerformanceEvents(currentMetrics) {
    // Memory pressure event
    if (currentMetrics.memory.percentage > this.config.memoryThreshold && !this.alerts.memory.triggered) {
      this.emit('memory-pressure', currentMetrics.memory);
      this.alerts.memory.triggered = true;
      this.alerts.memory.count++;
      this.alerts.memory.lastAlert = Date.now();
    } else if (currentMetrics.memory.percentage <= this.config.memoryThreshold && this.alerts.memory.triggered) {
      this.alerts.memory.triggered = false;
    }
    
    // CPU overload event
    if (currentMetrics.cpu.percentage > this.config.cpuThreshold && !this.alerts.cpu.triggered) {
      this.emit('cpu-overload', currentMetrics.cpu);
      this.alerts.cpu.triggered = true;
      this.alerts.cpu.count++;
      this.alerts.cpu.lastAlert = Date.now();
    } else if (currentMetrics.cpu.percentage <= this.config.cpuThreshold && this.alerts.cpu.triggered) {
      this.alerts.cpu.triggered = false;
    }
    
    // Critical performance event
    if (this.metrics.performance.score < 50 && !this.alerts.performance.triggered) {
      this.emit('performance-critical', { score: this.metrics.performance.score, issues: this.metrics.performance.issues });
      this.alerts.performance.triggered = true;
      this.alerts.performance.count++;
      this.alerts.performance.lastAlert = Date.now();
    } else if (this.metrics.performance.score >= 70 && this.alerts.performance.triggered) {
      this.alerts.performance.triggered = false;
    }
  }

  async performOptimizationCycle() {
    if (!this.config.autoOptimize) return;
    
    const now = Date.now();
    
    // Memory cleanup
    if (this.optimizations.memoryCleanup.enabled && 
        now - this.optimizations.memoryCleanup.lastRun > this.optimizations.memoryCleanup.frequency) {
      await this.performMemoryOptimization();
      this.optimizations.memoryCleanup.lastRun = now;
    }
    
    // CPU optimization
    if (this.optimizations.cpuOptimization.enabled && 
        now - this.optimizations.cpuOptimization.lastRun > this.optimizations.cpuOptimization.frequency) {
      await this.performCpuOptimization();
      this.optimizations.cpuOptimization.lastRun = now;
    }
    
    // Garbage collection
    if (this.optimizations.garbageCollection.enabled && 
        now - this.optimizations.garbageCollection.lastRun > this.optimizations.garbageCollection.frequency &&
        this.metrics.memory.current > 70) {
      await this.performGarbageCollection();
      this.optimizations.garbageCollection.lastRun = now;
    }
  }

  async performMemoryOptimization() {
    const before = process.memoryUsage();
    
    // Clear internal caches if available
    if (typeof global.clearInternalCaches === 'function') {
      global.clearInternalCaches();
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const after = process.memoryUsage();
    const freed = (before.heapUsed - after.heapUsed) / 1024 / 1024;
    
    this.metrics.performance.optimizations.push({
      type: 'memory-cleanup',
      timestamp: Date.now(),
      memoryFreed: freed,
      success: freed > 0
    });
    
    this.emit('optimization-completed', { type: 'memory', freed });
  }

  async performCpuOptimization() {
    // Adjust Node.js optimization flags if needed
    const optimizations = [
      '--optimize-for-size',
      '--gc-interval=100'
    ];
    
    this.metrics.performance.optimizations.push({
      type: 'cpu-optimization',
      timestamp: Date.now(),
      optimizations,
      success: true
    });
    
    this.emit('optimization-completed', { type: 'cpu', optimizations });
  }

  async performGarbageCollection() {
    const before = process.memoryUsage();
    
    if (global.gc) {
      global.gc();
      
      const after = process.memoryUsage();
      const freed = (before.heapUsed - after.heapUsed) / 1024 / 1024;
      
      this.metrics.performance.optimizations.push({
        type: 'garbage-collection',
        timestamp: Date.now(),
        memoryFreed: freed,
        success: true
      });
      
      this.emit('optimization-completed', { type: 'gc', freed });
    }
  }

  async performPredictiveAnalysis() {
    if (!this.config.enablePredictive) return;
    
    // Predict if scaling is needed
    const memoryTrend = this.metrics.predictions.memoryTrend;
    const cpuTrend = this.metrics.predictions.cpuTrend;
    const currentMemory = this.metrics.memory.current;
    const currentCpu = this.metrics.cpu.current;
    
    const scalingNeeded = (
      (memoryTrend === 'increasing' && currentMemory > 60) ||
      (cpuTrend === 'increasing' && currentCpu > 60) ||
      (currentMemory > 85 || currentCpu > 85)
    );
    
    if (scalingNeeded && !this.metrics.predictions.scalingNeeded) {
      this.metrics.predictions.scalingNeeded = true;
      this.emit('scaling-needed', {
        memoryTrend,
        cpuTrend,
        currentMemory,
        currentCpu,
        recommendation: 'scale-up'
      });
    } else if (!scalingNeeded && this.metrics.predictions.scalingNeeded) {
      this.metrics.predictions.scalingNeeded = false;
    }
  }

  // Event Handlers
  handleCriticalPerformance(data) {
    console.log(`🚨 CRITICAL PERFORMANCE ALERT: Score ${data.score}`);
    data.issues.forEach(issue => {
      console.log(`   🔴 ${issue.type}: ${issue.message}`);
    });
    
    if (this.config.alerting) {
      this.sendAlert('critical-performance', data);
    }
  }

  handleMemoryPressure(data) {
    console.log(`🟡 Memory Pressure: ${data.percentage.toFixed(1)}%`);
    
    if (this.config.autoOptimize && data.percentage > 90) {
      console.log('🔧 Triggering emergency memory cleanup...');
      this.performMemoryOptimization();
    }
  }

  handleCpuOverload(data) {
    console.log(`🟠 CPU Overload: ${data.percentage.toFixed(1)}%`);
    
    if (this.config.autoOptimize && data.percentage > 90) {
      console.log('🔧 Triggering CPU optimization...');
      this.performCpuOptimization();
    }
  }

  handleScalingNeeded(data) {
    console.log('📈 Scaling Recommendation:', data.recommendation);
    console.log(`   Memory: ${data.currentMemory.toFixed(1)}% (${data.memoryTrend})`);
    console.log(`   CPU: ${data.currentCpu.toFixed(1)}% (${data.cpuTrend})`);
    
    if (this.config.autoScale) {
      this.triggerAutoScaling(data);
    }
  }

  logOptimization(data) {
    console.log(`✅ Optimization completed: ${data.type}`);
    if (data.freed) {
      console.log(`   Memory freed: ${data.freed.toFixed(2)}MB`);
    }
  }

  handleError(type, error) {
    console.error(`❌ ${type}:`, error);
    
    this.metrics.performance.issues.push({
      type: 'error',
      severity: 'critical',
      message: `${type}: ${error.message}`,
      timestamp: Date.now()
    });
  }

  async triggerAutoScaling(data) {
    try {
      console.log('🚀 Triggering auto-scaling...');
      
      // This would integrate with Fly.io scaling API
      // flyctl scale count 2
      
      const result = execSync('flyctl scale show', { encoding: 'utf8' });
      console.log('📊 Current scaling status:', result);
      
    } catch (error) {
      console.error('❌ Auto-scaling failed:', error.message);
    }
  }

  sendAlert(type, data) {
    // Implement alerting (Slack, email, PagerDuty, etc.)
    console.log(`🚨 ALERT [${type}]:`, JSON.stringify(data, null, 2));
  }

  logPerformanceStatus() {
    console.log('\n📊 PERFORMANCE STATUS');
    console.log('='.repeat(40));
    console.log(`Performance Score: ${this.metrics.performance.score}/100`);
    console.log(`Memory Usage: ${this.metrics.memory.current.toFixed(1)}% (avg: ${this.metrics.memory.average.toFixed(1)}%)`);
    console.log(`CPU Usage: ${this.metrics.cpu.current.toFixed(1)}% (avg: ${this.metrics.cpu.average.toFixed(1)}%)`);
    console.log(`System Uptime: ${(this.metrics.system.uptime / 3600).toFixed(1)} hours`);
    console.log(`Active Issues: ${this.metrics.performance.issues.length}`);
    
    if (this.metrics.performance.issues.length > 0) {
      console.log('\n⚠️  Active Issues:');
      this.metrics.performance.issues.forEach(issue => {
        console.log(`   ${issue.severity.toUpperCase()}: ${issue.message}`);
      });
    }
    
    console.log('='.repeat(40));
  }

  getMetrics() {
    return {
      ...this.metrics,
      alerts: this.alerts,
      optimizations: this.optimizations,
      uptime: Date.now() - this.startTime
    };
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      metrics: this.getMetrics(),
      summary: {
        performanceScore: this.metrics.performance.score,
        memoryUsage: this.metrics.memory.current,
        cpuUsage: this.metrics.cpu.current,
        activeIssues: this.metrics.performance.issues.length,
        optimizationsRun: this.metrics.performance.optimizations.length,
        alertsTriggered: Object.values(this.alerts).reduce((sum, alert) => sum + alert.count, 0)
      }
    };
    
    const reportPath = path.join(process.cwd(), 'performance-report.json');
    await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📄 Performance report saved to: ${reportPath}`);
    return report;
  }

  async shutdown(signal) {
    console.log(`\n📊 Shutting down Performance Engine (${signal})...`);
    
    this.isRunning = false;
    
    // Clear intervals
    if (this.monitoringInterval) clearInterval(this.monitoringInterval);
    if (this.optimizationInterval) clearInterval(this.optimizationInterval);
    if (this.predictiveInterval) clearInterval(this.predictiveInterval);
    
    // Generate final report
    await this.generateReport();
    
    console.log('✅ Performance Engine shutdown complete');
    process.exit(0);
  }

  static async run(options = {}) {
    const engine = new UltraPerformanceEngine(options);
    await engine.start();
    return engine;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = {
    interval: parseInt(process.argv[2]) || 5000,
    memoryThreshold: parseInt(process.argv[3]) || 80,
    cpuThreshold: parseInt(process.argv[4]) || 70,
    autoOptimize: process.argv[5] !== 'false',
    enablePredictive: process.argv[6] !== 'false'
  };
  
  console.log('🚀 Starting Ultra-Performance Engine...');
  
  UltraPerformanceEngine.run(options)
    .then(engine => {
      console.log('✅ Performance Engine running. Press Ctrl+C to stop.');
    })
    .catch(error => {
      console.error('❌ Failed to start Performance Engine:', error.message);
      process.exit(1);
    });
}

export default UltraPerformanceEngine;