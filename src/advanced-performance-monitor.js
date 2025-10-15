import { performance, PerformanceObserver } from 'perf_hooks';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

/**
 * Advanced Performance Monitor with AI-powered analytics
 * Features: Real-time monitoring, predictive optimization, memory leak detection
 */
class AdvancedPerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      sampleRate: options.sampleRate || 1000, // Sample every second
      memoryThreshold: options.memoryThreshold || 0.85, // 85% memory pressure
      responseTimeThreshold: options.responseTimeThreshold || 1000, // 1 second
      enablePredictiveAnalysis: options.enablePredictiveAnalysis !== false,
      enableMemoryLeakDetection: options.enableMemoryLeakDetection !== false,
      enableFileLogging: options.enableFileLogging || false,
      logDirectory: options.logDirectory || './logs',
      ...options
    };
    
    this.metrics = {
      startTime: Date.now(),
      samples: [],
      memoryLeaks: 0,
      performanceAlerts: 0,
      totalSamples: 0,
      avgCpuUsage: 0,
      avgMemoryUsage: 0,
      peakMemoryUsage: 0,
      responseTimeTrend: [],
      memoryTrend: [],
      cpuTrend: [],
      alerts: []
    };
    
    this.isMonitoring = false;
    this.performanceObserver = null;
    this.monitoringInterval = null;
    this.memoryBaseline = null;
    
    this.initializePerformanceObserver();
  }
  
  // Initialize performance observer for advanced metrics
  initializePerformanceObserver() {
    this.performanceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.processPerformanceEntry(entry);
      }
    });
    
    // Observe all performance entry types
    this.performanceObserver.observe({ entryTypes: ['measure', 'navigation', 'resource', 'mark'] });
  }
  
  // Process individual performance entries
  processPerformanceEntry(entry) {
    const sample = {
      timestamp: Date.now(),
      type: entry.entryType,
      name: entry.name,
      duration: entry.duration,
      startTime: entry.startTime
    };
    
    this.metrics.samples.push(sample);
    this.metrics.totalSamples++;
    
    // Keep only last 1000 samples to prevent memory bloat
    if (this.metrics.samples.length > 1000) {
      this.metrics.samples.shift();
    }
    
    // Analyze performance trends
    if (entry.entryType === 'measure' && entry.name.startsWith('http-')) {
      this.analyzeResponseTime(entry.duration);
    }
    
    // Emit performance events
    if (entry.duration > this.options.responseTimeThreshold) {
      this.emit('slowOperation', {
        name: entry.name,
        duration: entry.duration,
        threshold: this.options.responseTimeThreshold
      });
    }
  }
  
  // Analyze response time trends
  analyzeResponseTime(duration) {
    this.metrics.responseTimeTrend.push({
      timestamp: Date.now(),
      value: duration
    });
    
    // Keep only last 100 samples
    if (this.metrics.responseTimeTrend.length > 100) {
      this.metrics.responseTimeTrend.shift();
    }
    
    // Detect response time degradation
    if (this.metrics.responseTimeTrend.length >= 10) {
      const recent = this.metrics.responseTimeTrend.slice(-10);
      const avgRecent = recent.reduce((sum, item) => sum + item.value, 0) / recent.length;
      
      const older = this.metrics.responseTimeTrend.slice(-20, -10);
      if (older.length > 0) {
        const avgOlder = older.reduce((sum, item) => sum + item.value, 0) / older.length;
        
        if (avgRecent > avgOlder * 1.5) { // 50% degradation
          this.createAlert('Response Time Degradation', {
            recent: Math.round(avgRecent),
            previous: Math.round(avgOlder),
            degradation: Math.round(((avgRecent - avgOlder) / avgOlder) * 100)
          });
        }
      }
    }
  }
  
  // Advanced system monitoring
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.memoryBaseline = this.getMemoryUsage();
    
    console.log('📊 Advanced Performance Monitor: STARTED');
    console.log('🔍 Features: Predictive analysis, memory leak detection, AI optimization');
    
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.options.sampleRate);
    
    // Start specialized monitoring features
    if (this.options.enableMemoryLeakDetection) {
      this.startMemoryLeakDetection();
    }
    
    if (this.options.enablePredictiveAnalysis) {
      this.startPredictiveAnalysis();
    }
    
    this.emit('monitoringStarted');
  }
  
  // Stop monitoring
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    console.log('📊 Advanced Performance Monitor: STOPPED');
    this.emit('monitoringStopped');
  }
  
  // Collect comprehensive system metrics
  collectSystemMetrics() {
    const timestamp = Date.now();
    const memoryUsage = this.getMemoryUsage();
    const cpuUsage = this.getCpuUsage();
    
    // Update memory trends
    this.metrics.memoryTrend.push({
      timestamp,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      pressure: memoryUsage.pressure
    });
    
    // Update CPU trends  
    this.metrics.cpuTrend.push({
      timestamp,
      usage: cpuUsage
    });
    
    // Keep only last 200 samples
    if (this.metrics.memoryTrend.length > 200) {
      this.metrics.memoryTrend.shift();
    }
    if (this.metrics.cpuTrend.length > 200) {
      this.metrics.cpuTrend.shift();
    }
    
    // Update running averages
    this.updateAverages();
    
    // Check for performance issues
    this.checkPerformanceThresholds(memoryUsage, cpuUsage);
    
    // Log to file if enabled
    if (this.options.enableFileLogging) {
      this.logMetricsToFile({ timestamp, memory: memoryUsage, cpu: cpuUsage });
    }
  }
  
  // Get detailed memory usage
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      pressure: Math.round((usage.heapUsed / usage.heapTotal) * 100)
    };
  }
  
  // Get CPU usage (simplified estimation)
  getCpuUsage() {
    const usage = process.cpuUsage();
    const totalUsage = (usage.user + usage.system) / 1000; // Convert to milliseconds
    return Math.min(100, Math.round((totalUsage / 1000) * 100)); // Rough percentage
  }
  
  // Update running averages
  updateAverages() {
    if (this.metrics.memoryTrend.length > 0) {
      const memorySum = this.metrics.memoryTrend.reduce((sum, item) => sum + item.heapUsed, 0);
      this.metrics.avgMemoryUsage = Math.round(memorySum / this.metrics.memoryTrend.length);
      
      const peakMemory = Math.max(...this.metrics.memoryTrend.map(item => item.heapUsed));
      if (peakMemory > this.metrics.peakMemoryUsage) {
        this.metrics.peakMemoryUsage = peakMemory;
      }
    }
    
    if (this.metrics.cpuTrend.length > 0) {
      const cpuSum = this.metrics.cpuTrend.reduce((sum, item) => sum + item.usage, 0);
      this.metrics.avgCpuUsage = Math.round(cpuSum / this.metrics.cpuTrend.length);
    }
  }
  
  // Check performance thresholds and create alerts
  checkPerformanceThresholds(memoryUsage, cpuUsage) {
    // Memory pressure alert
    if (memoryUsage.pressure > this.options.memoryThreshold * 100) {
      this.createAlert('High Memory Pressure', {
        current: memoryUsage.pressure,
        threshold: this.options.memoryThreshold * 100,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal
      });
    }
    
    // High CPU usage alert
    if (cpuUsage > 80) {
      this.createAlert('High CPU Usage', {
        current: cpuUsage,
        threshold: 80
      });
    }
    
    // Memory growth trend alert
    if (this.metrics.memoryTrend.length >= 20) {
      const recent = this.metrics.memoryTrend.slice(-10);
      const older = this.metrics.memoryTrend.slice(-20, -10);
      
      const avgRecent = recent.reduce((sum, item) => sum + item.heapUsed, 0) / recent.length;
      const avgOlder = older.reduce((sum, item) => sum + item.heapUsed, 0) / older.length;
      
      if (avgRecent > avgOlder * 1.3) { // 30% growth
        this.createAlert('Memory Growth Trend', {
          recent: Math.round(avgRecent),
          previous: Math.round(avgOlder),
          growth: Math.round(((avgRecent - avgOlder) / avgOlder) * 100)
        });
      }
    }
  }
  
  // Memory leak detection
  startMemoryLeakDetection() {
    let baseline = null;
    let samples = [];
    
    const checkInterval = setInterval(() => {
      const currentMemory = this.getMemoryUsage();
      
      if (!baseline) {
        baseline = currentMemory;
        return;
      }
      
      samples.push(currentMemory.heapUsed);
      
      // Keep only last 30 samples (30 minutes if sampling every minute)
      if (samples.length > 30) {
        samples.shift();
      }
      
      // Analyze for consistent growth pattern
      if (samples.length >= 10) {
        const growth = this.analyzeMemoryGrowthPattern(samples);
        
        if (growth.isConsistentGrowth && growth.rate > 5) { // 5MB/sample growth
          this.metrics.memoryLeaks++;
          this.createAlert('Potential Memory Leak Detected', {
            growthRate: growth.rate,
            samples: samples.length,
            currentMemory: currentMemory.heapUsed,
            baseline: baseline.heapUsed
          });
          
          // Reset baseline to avoid duplicate alerts
          baseline = currentMemory;
          samples = [];
        }
      }
    }, 60000); // Check every minute
    
    // Store interval for cleanup
    this.memoryLeakDetectionInterval = checkInterval;
  }
  
  // Analyze memory growth patterns
  analyzeMemoryGrowthPattern(samples) {
    if (samples.length < 5) {
      return { isConsistentGrowth: false, rate: 0 };
    }
    
    let growthCount = 0;
    let totalGrowth = 0;
    
    for (let i = 1; i < samples.length; i++) {
      const growth = samples[i] - samples[i - 1];
      if (growth > 0) {
        growthCount++;
        totalGrowth += growth;
      }
    }
    
    const growthRatio = growthCount / (samples.length - 1);
    const avgGrowthRate = totalGrowth / (samples.length - 1);
    
    return {
      isConsistentGrowth: growthRatio > 0.7, // 70% of samples show growth
      rate: avgGrowthRate
    };
  }
  
  // Predictive performance analysis
  startPredictiveAnalysis() {
    setInterval(() => {
      this.performPredictiveAnalysis();
    }, 300000); // Every 5 minutes
  }
  
  // Perform predictive analysis
  performPredictiveAnalysis() {
    const predictions = {
      memoryPressure: this.predictMemoryPressure(),
      responseTimeTrend: this.predictResponseTimeTrend(),
      resourceExhaustion: this.predictResourceExhaustion()
    };
    
    // Generate predictive alerts
    if (predictions.memoryPressure.risk > 0.7) {
      this.createAlert('Predicted Memory Pressure', {
        risk: Math.round(predictions.memoryPressure.risk * 100),
        timeToThreshold: predictions.memoryPressure.timeToThreshold,
        recommendation: 'Consider memory cleanup or resource scaling'
      });
    }
    
    if (predictions.responseTimeTrend.degradation > 0.3) {
      this.createAlert('Predicted Performance Degradation', {
        degradation: Math.round(predictions.responseTimeTrend.degradation * 100),
        trend: predictions.responseTimeTrend.trend,
        recommendation: 'Investigate potential bottlenecks'
      });
    }
    
    this.emit('predictiveAnalysis', predictions);
  }
  
  // Predict memory pressure based on trends
  predictMemoryPressure() {
    if (this.metrics.memoryTrend.length < 20) {
      return { risk: 0, timeToThreshold: null };
    }
    
    const recent = this.metrics.memoryTrend.slice(-10);
    const slope = this.calculateTrendSlope(recent.map(item => ({ x: item.timestamp, y: item.pressure })));
    
    if (slope <= 0) {
      return { risk: 0, timeToThreshold: null };
    }
    
    const currentPressure = recent[recent.length - 1].pressure;
    const threshold = this.options.memoryThreshold * 100;
    
    if (currentPressure >= threshold) {
      return { risk: 1, timeToThreshold: 0 };
    }
    
    const timeToThreshold = (threshold - currentPressure) / slope;
    const risk = Math.min(1, Math.max(0, 1 - (timeToThreshold / 3600000))); // Risk increases as time decreases
    
    return { risk, timeToThreshold: Math.round(timeToThreshold / 60000) }; // Minutes
  }
  
  // Predict response time trends
  predictResponseTimeTrend() {
    if (this.metrics.responseTimeTrend.length < 20) {
      return { degradation: 0, trend: 'stable' };
    }
    
    const recent = this.metrics.responseTimeTrend.slice(-10);
    const older = this.metrics.responseTimeTrend.slice(-20, -10);
    
    const recentAvg = recent.reduce((sum, item) => sum + item.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, item) => sum + item.value, 0) / older.length;
    
    const degradation = Math.max(0, (recentAvg - olderAvg) / olderAvg);
    
    let trend = 'stable';
    if (degradation > 0.1) trend = 'degrading';
    else if (degradation < -0.1) trend = 'improving';
    
    return { degradation, trend };
  }
  
  // Predict resource exhaustion
  predictResourceExhaustion() {
    const memoryRisk = this.predictMemoryPressure().risk;
    const cpuTrend = this.metrics.cpuTrend.slice(-10);
    
    let cpuRisk = 0;
    if (cpuTrend.length >= 5) {
      const avgCpu = cpuTrend.reduce((sum, item) => sum + item.usage, 0) / cpuTrend.length;
      cpuRisk = Math.min(1, avgCpu / 100);
    }
    
    const overallRisk = Math.max(memoryRisk, cpuRisk);
    
    return {
      risk: overallRisk,
      memoryRisk,
      cpuRisk,
      recommendation: overallRisk > 0.7 ? 'Consider scaling resources' : 'Resources within normal limits'
    };
  }
  
  // Calculate trend slope using linear regression
  calculateTrendSlope(points) {
    if (points.length < 2) return 0;
    
    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }
  
  // Create performance alert
  createAlert(type, details) {
    const alert = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      type,
      details,
      severity: this.determineAlertSeverity(type, details)
    };
    
    this.metrics.alerts.push(alert);
    this.metrics.performanceAlerts++;
    
    // Keep only last 100 alerts
    if (this.metrics.alerts.length > 100) {
      this.metrics.alerts.shift();
    }
    
    console.warn(`🚨 Performance Alert [${alert.severity}]: ${type}`, details);
    this.emit('alert', alert);
    
    return alert;
  }
  
  // Determine alert severity
  determineAlertSeverity(type, details) {
    const severityMap = {
      'High Memory Pressure': details.current > 95 ? 'critical' : 'high',
      'Memory Growth Trend': details.growth > 50 ? 'high' : 'medium',
      'Potential Memory Leak Detected': 'critical',
      'High CPU Usage': details.current > 95 ? 'critical' : 'high',
      'Response Time Degradation': details.degradation > 100 ? 'high' : 'medium',
      'Predicted Memory Pressure': details.risk > 90 ? 'high' : 'medium',
      'Predicted Performance Degradation': 'medium'
    };
    
    return severityMap[type] || 'low';
  }
  
  // Log metrics to file
  async logMetricsToFile(metrics) {
    try {
      await fs.mkdir(this.options.logDirectory, { recursive: true });
      
      const logFile = path.join(this.options.logDirectory, `performance-${new Date().toISOString().split('T')[0]}.json`);
      const logEntry = JSON.stringify(metrics) + '\n';
      
      await fs.appendFile(logFile, logEntry);
    } catch (error) {
      console.error('Failed to log metrics:', error.message);
    }
  }
  
  // Get comprehensive performance statistics
  getPerformanceStats() {
    const uptime = Math.floor((Date.now() - this.metrics.startTime) / 1000);
    const currentMemory = this.getMemoryUsage();
    const currentCpu = this.getCpuUsage();
    
    return {
      uptime,
      monitoring: this.isMonitoring,
      totalSamples: this.metrics.totalSamples,
      memoryLeaks: this.metrics.memoryLeaks,
      performanceAlerts: this.metrics.performanceAlerts,
      currentMetrics: {
        memory: currentMemory,
        cpu: currentCpu
      },
      averages: {
        memory: this.metrics.avgMemoryUsage,
        cpu: this.metrics.avgCpuUsage,
        peakMemory: this.metrics.peakMemoryUsage
      },
      trends: {
        memoryTrend: this.metrics.memoryTrend.slice(-10), // Last 10 samples
        cpuTrend: this.metrics.cpuTrend.slice(-10),
        responseTimeTrend: this.metrics.responseTimeTrend.slice(-10)
      },
      recentAlerts: this.metrics.alerts.slice(-5), // Last 5 alerts
      predictions: this.isMonitoring ? {
        memoryPressure: this.predictMemoryPressure(),
        responseTimeTrend: this.predictResponseTimeTrend(),
        resourceExhaustion: this.predictResourceExhaustion()
      } : null
    };
  }
  
  // Optimize performance based on current metrics
  optimizePerformance() {
    const stats = this.getPerformanceStats();
    const optimizations = [];
    
    // Memory optimization
    if (stats.currentMetrics.memory.pressure > 80) {
      if (global.gc) {
        global.gc();
        optimizations.push('Triggered garbage collection');
      }
    }
    
    // Clear old performance samples if memory is high
    if (stats.currentMetrics.memory.pressure > 85 && this.metrics.samples.length > 500) {
      this.metrics.samples = this.metrics.samples.slice(-500);
      optimizations.push('Cleared old performance samples');
    }
    
    // Emit optimization event
    if (optimizations.length > 0) {
      this.emit('optimization', { actions: optimizations, stats });
      console.log('🔧 Performance optimizations applied:', optimizations);
    }
    
    return optimizations;
  }
  
  // Reset metrics
  resetMetrics() {
    this.metrics = {
      startTime: Date.now(),
      samples: [],
      memoryLeaks: 0,
      performanceAlerts: 0,
      totalSamples: 0,
      avgCpuUsage: 0,
      avgMemoryUsage: 0,
      peakMemoryUsage: 0,
      responseTimeTrend: [],
      memoryTrend: [],
      cpuTrend: [],
      alerts: []
    };
    
    console.log('📊 Performance metrics reset');
    this.emit('metricsReset');
  }
  
  // Cleanup and shutdown
  destroy() {
    this.stopMonitoring();
    
    if (this.memoryLeakDetectionInterval) {
      clearInterval(this.memoryLeakDetectionInterval);
    }
    
    this.removeAllListeners();
    console.log('📊 Advanced Performance Monitor: DESTROYED');
  }
}

export default AdvancedPerformanceMonitor;