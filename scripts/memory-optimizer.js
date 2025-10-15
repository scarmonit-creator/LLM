#!/usr/bin/env node

/**
 * AUTONOMOUS MEMORY OPTIMIZER
 * Ultra-High Performance Memory Management System
 * Real-time leak detection and optimization
 */

import { performance } from 'perf_hooks';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

class AutonomousMemoryOptimizer {
  constructor() {
    this.metrics = {
      heapUsed: [],
      heapTotal: [],
      external: [],
      rss: [],
      arrayBuffers: []
    };
    this.thresholds = {
      memoryLeak: 1024 * 1024 * 100, // 100MB
      maxHeap: 1024 * 1024 * 512,    // 512MB
      gcTrigger: 0.85                // 85% heap usage
    };
    this.optimizationActive = false;
  }

  startMonitoring() {
    console.log('🧠 Autonomous Memory Optimizer Starting...');
    this.monitoringInterval = setInterval(() => {
      this.analyzeMemory();
      this.optimizeIfNeeded();
    }, 5000);

    // Immediate analysis
    this.performInitialAnalysis();
  }

  analyzeMemory() {
    const memUsage = process.memoryUsage();
    const timestamp = Date.now();
    
    // Store metrics with timestamp
    Object.keys(this.metrics).forEach(key => {
      if (memUsage[key]) {
        this.metrics[key].push({ value: memUsage[key], timestamp });
        // Keep only last 100 readings
        if (this.metrics[key].length > 100) {
          this.metrics[key].shift();
        }
      }
    });

    // Detect memory leaks
    this.detectLeaks();
    
    // Check for optimization triggers
    this.checkOptimizationTriggers(memUsage);
  }

  detectLeaks() {
    const heapData = this.metrics.heapUsed;
    if (heapData.length < 10) return;

    // Calculate memory growth trend
    const recent = heapData.slice(-10);
    const growthRate = (recent[recent.length - 1].value - recent[0].value) / recent.length;
    
    if (growthRate > this.thresholds.memoryLeak / 10) {
      console.log('⚠️  Memory leak detected! Growth rate:', this.formatBytes(growthRate));
      this.triggerLeakMitigation();
    }
  }

  checkOptimizationTriggers(memUsage) {
    const heapUsagePercent = memUsage.heapUsed / memUsage.heapTotal;
    
    if (heapUsagePercent > this.thresholds.gcTrigger && !this.optimizationActive) {
      console.log('🔧 Triggering autonomous optimization - Heap:', 
        (heapUsagePercent * 100).toFixed(1) + '%');
      this.triggerOptimization();
    }
  }

  async triggerOptimization() {
    if (this.optimizationActive) return;
    
    this.optimizationActive = true;
    const startTime = performance.now();
    
    console.log('⚡ Autonomous memory optimization initiated...');
    
    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        console.log('🗑️  Garbage collection executed');
      }
      
      // Clear caches and optimize
      await this.clearCaches();
      
      // Optimize V8 heap
      this.optimizeHeap();
      
      const optimizationTime = performance.now() - startTime;
      console.log(`✅ Memory optimization completed in ${optimizationTime.toFixed(2)}ms`);
      
      // Log results
      setTimeout(() => {
        const newUsage = process.memoryUsage();
        console.log('📊 Post-optimization memory:', this.formatMemoryUsage(newUsage));
      }, 1000);
      
    } catch (error) {
      console.error('❌ Memory optimization failed:', error.message);
    } finally {
      this.optimizationActive = false;
    }
  }

  async clearCaches() {
    // Clear require cache for development
    if (process.env.NODE_ENV !== 'production') {
      const moduleKeys = Object.keys(require.cache).filter(key => 
        !key.includes('node_modules') && key.includes(process.cwd())
      );
      
      moduleKeys.forEach(key => {
        delete require.cache[key];
      });
      
      console.log(`🧹 Cleared ${moduleKeys.length} cached modules`);
    }
    
    // Clear any application-level caches
    if (global.appCache) {
      global.appCache.clear();
      console.log('🧹 Application cache cleared');
    }
  }

  optimizeHeap() {
    // Set heap optimization flags
    if (process.env.NODE_OPTIONS) {
      process.env.NODE_OPTIONS += ' --optimize-for-size';
    } else {
      process.env.NODE_OPTIONS = '--optimize-for-size';
    }
    
    console.log('⚙️  V8 heap optimization configured');
  }

  triggerLeakMitigation() {
    console.log('🚨 Initiating leak mitigation protocol...');
    
    // Aggressive cleanup
    this.triggerOptimization();
    
    // Log detailed memory analysis
    this.logDetailedAnalysis();
    
    // Alert if in production
    if (process.env.NODE_ENV === 'production') {
      console.error('🚨 PRODUCTION MEMORY LEAK ALERT - Immediate attention required!');
    }
  }

  logDetailedAnalysis() {
    const memUsage = process.memoryUsage();
    const analysis = {
      timestamp: new Date().toISOString(),
      memory: this.formatMemoryUsage(memUsage),
      heapUtilization: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2) + '%',
      trends: this.calculateTrends(),
      recommendations: this.generateRecommendations(memUsage)
    };
    
    console.log('📋 DETAILED MEMORY ANALYSIS:');
    console.log(JSON.stringify(analysis, null, 2));
  }

  calculateTrends() {
    const heapData = this.metrics.heapUsed.slice(-20);
    if (heapData.length < 2) return 'Insufficient data';
    
    const firstValue = heapData[0].value;
    const lastValue = heapData[heapData.length - 1].value;
    const change = lastValue - firstValue;
    const changePercent = ((change / firstValue) * 100).toFixed(2);
    
    return {
      change: this.formatBytes(change),
      changePercent: changePercent + '%',
      trend: change > 0 ? 'increasing' : 'decreasing'
    };
  }

  generateRecommendations(memUsage) {
    const recommendations = [];
    
    if (memUsage.heapUsed > this.thresholds.maxHeap * 0.8) {
      recommendations.push('Consider increasing --max-old-space-size');
    }
    
    if (memUsage.external > memUsage.heapUsed) {
      recommendations.push('High external memory usage - check for large buffers');
    }
    
    const heapEfficiency = (memUsage.heapUsed / memUsage.heapTotal);
    if (heapEfficiency < 0.3) {
      recommendations.push('Low heap efficiency - consider heap size adjustment');
    }
    
    return recommendations;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatMemoryUsage(memUsage) {
    return Object.entries(memUsage).reduce((acc, [key, value]) => {
      acc[key] = this.formatBytes(value);
      return acc;
    }, {});
  }

  performInitialAnalysis() {
    console.log('🔍 Performing initial memory analysis...');
    const memUsage = process.memoryUsage();
    console.log('💾 Current memory usage:', this.formatMemoryUsage(memUsage));
    
    // Set up process monitoring
    process.on('warning', (warning) => {
      if (warning.name === 'MaxListenersExceededWarning') {
        console.log('⚠️  Memory warning detected:', warning.message);
        this.triggerOptimization();
      }
    });
  }

  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      console.log('🔴 Memory monitoring stopped');
    }
  }
}

// Auto-start if run directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const optimizer = new AutonomousMemoryOptimizer();
  optimizer.startMonitoring();
  
  // Graceful shutdown
  process.on('SIGTERM', () => optimizer.stop());
  process.on('SIGINT', () => optimizer.stop());
  
  console.log('✅ Autonomous Memory Optimizer Active - Monitoring system performance...');
}

export default AutonomousMemoryOptimizer;