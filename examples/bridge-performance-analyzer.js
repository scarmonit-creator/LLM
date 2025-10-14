#!/usr/bin/env node
/**
 * bridge-performance-analyzer.js
 * Advanced performance analysis and optimization system for bridge demos.
 * Provides real-time monitoring, bottleneck identification, and automated optimization.
 * 
 * Features:
 * - Live performance monitoring with detailed metrics
 * - Memory usage tracking and leak detection
 * - Network request optimization analysis
 * - Resource utilization optimization
 * - Automated performance reporting
 * - Real-time optimization suggestions
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { EventEmitter } = require('events');

class BridgePerformanceAnalyzer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      sampleInterval: options.sampleInterval || 1000, // 1 second
      memoryThreshold: options.memoryThreshold || 100 * 1024 * 1024, // 100MB
      cpuThreshold: options.cpuThreshold || 80, // 80%
      networkTimeout: options.networkTimeout || 5000, // 5 seconds
      reportInterval: options.reportInterval || 10000, // 10 seconds
      ...options
    };
    
    this.metrics = {
      startTime: Date.now(),
      samples: [],
      networkRequests: [],
      memoryLeaks: [],
      performanceMarks: new Map(),
      resourceUsage: [],
      optimizationSuggestions: new Set()
    };
    
    this.timers = new Set();
    this.isRunning = false;
    this.lastCpuUsage = process.cpuUsage();
  }
  
  start() {
    if (this.isRunning) return;
    
    console.log('🔍 Starting Bridge Performance Analyzer...');
    this.isRunning = true;
    
    // Start monitoring intervals
    this.startMemoryMonitoring();
    this.startCPUMonitoring();
    this.startNetworkMonitoring();
    this.startResourceMonitoring();
    this.startReporting();
    
    this.emit('started');
  }
  
  stop() {
    if (!this.isRunning) return;
    
    console.log('⏹️ Stopping Bridge Performance Analyzer...');
    this.isRunning = false;
    
    // Clear all timers
    this.timers.forEach(timer => clearInterval(timer));
    this.timers.clear();
    
    this.generateFinalReport();
    this.emit('stopped');
  }
  
  startMemoryMonitoring() {
    const timer = setInterval(() => {
      if (!this.isRunning) return;
      
      const memUsage = process.memoryUsage();
      const timestamp = Date.now();
      
      this.metrics.samples.push({
        timestamp,
        type: 'memory',
        data: memUsage
      });
      
      // Check for memory leaks
      if (memUsage.heapUsed > this.options.memoryThreshold) {
        this.detectMemoryLeak(memUsage, timestamp);
      }
      
      // Optimization suggestions
      if (memUsage.external > memUsage.heapUsed * 0.5) {
        this.addOptimizationSuggestion('high-external-memory', 
          'High external memory usage detected. Consider optimizing buffer usage.');
      }
      
    }, this.options.sampleInterval);
    
    this.timers.add(timer);
  }
  
  startCPUMonitoring() {
    const timer = setInterval(() => {
      if (!this.isRunning) return;
      
      const cpuUsage = process.cpuUsage(this.lastCpuUsage);
      const timestamp = Date.now();
      
      // Calculate CPU percentage
      const cpuPercent = ((cpuUsage.user + cpuUsage.system) / 1000) / this.options.sampleInterval * 100;
      
      this.metrics.samples.push({
        timestamp,
        type: 'cpu',
        data: { cpuPercent, ...cpuUsage }
      });
      
      if (cpuPercent > this.options.cpuThreshold) {
        this.addOptimizationSuggestion('high-cpu-usage', 
          `High CPU usage detected: ${cpuPercent.toFixed(2)}%. Consider optimizing computationally intensive operations.`);
      }
      
      this.lastCpuUsage = process.cpuUsage();
    }, this.options.sampleInterval);
    
    this.timers.add(timer);
  }
  
  startNetworkMonitoring() {
    // Patch fetch and XMLHttpRequest for network monitoring
    this.patchNetworkCalls();
  }
  
  startResourceMonitoring() {
    const timer = setInterval(() => {
      if (!this.isRunning) return;
      
      const resourceUsage = {
        timestamp: Date.now(),
        handles: process.getActiveResourcesInfo ? process.getActiveResourcesInfo() : [],
        uptime: process.uptime(),
        loadAverage: require('os').loadavg()
      };
      
      this.metrics.resourceUsage.push(resourceUsage);
      
      // Check for resource leaks
      const handleCount = resourceUsage.handles.length;
      if (handleCount > 100) {
        this.addOptimizationSuggestion('resource-leak', 
          `High number of active handles: ${handleCount}. Check for unclosed connections or timers.`);
      }
      
    }, this.options.sampleInterval * 5); // Less frequent
    
    this.timers.add(timer);
  }
  
  startReporting() {
    const timer = setInterval(() => {
      if (!this.isRunning) return;
      this.generatePerformanceReport();
    }, this.options.reportInterval);
    
    this.timers.add(timer);
  }
  
  detectMemoryLeak(memUsage, timestamp) {
    // Simple memory leak detection based on trend analysis
    const recentSamples = this.metrics.samples
      .filter(s => s.type === 'memory' && timestamp - s.timestamp < 30000) // Last 30 seconds
      .map(s => s.data.heapUsed);
    
    if (recentSamples.length > 5) {
      const trend = this.calculateTrend(recentSamples);
      if (trend > 0.1) { // Growing trend
        this.metrics.memoryLeaks.push({
          timestamp,
          memUsage,
          trend,
          severity: trend > 0.3 ? 'high' : 'medium'
        });
        
        this.addOptimizationSuggestion('memory-leak', 
          `Potential memory leak detected. Heap usage trending upward: ${(trend * 100).toFixed(2)}% increase.`);
      }
    }
  }
  
  calculateTrend(values) {
    if (values.length < 2) return 0;
    const first = values[0];
    const last = values[values.length - 1];
    return (last - first) / first;
  }
  
  patchNetworkCalls() {
    // Patch global fetch if available
    if (typeof global.fetch === 'function') {
      const originalFetch = global.fetch;
      global.fetch = (...args) => {
        const startTime = performance.now();
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;
        
        return originalFetch(...args).then(
          response => {
            const duration = performance.now() - startTime;
            this.recordNetworkRequest(url, 'fetch', duration, response.status, 'success');
            return response;
          },
          error => {
            const duration = performance.now() - startTime;
            this.recordNetworkRequest(url, 'fetch', duration, 0, 'error', error.message);
            throw error;
          }
        );
      };
    }
  }
  
  recordNetworkRequest(url, method, duration, status, result, error = null) {
    const request = {
      timestamp: Date.now(),
      url,
      method,
      duration,
      status,
      result,
      error
    };
    
    this.metrics.networkRequests.push(request);
    
    // Network optimization suggestions
    if (duration > this.options.networkTimeout) {
      this.addOptimizationSuggestion('slow-network', 
        `Slow network request detected: ${url} took ${duration.toFixed(2)}ms. Consider adding timeout or caching.`);
    }
    
    if (status >= 400) {
      this.addOptimizationSuggestion('network-error', 
        `Network error: ${status} for ${url}. Implement proper error handling and retries.`);
    }
  }
  
  markPerformance(name, value = performance.now()) {
    this.metrics.performanceMarks.set(name, {
      timestamp: Date.now(),
      value,
      name
    });
  }
  
  measurePerformance(startMark, endMark) {
    const start = this.metrics.performanceMarks.get(startMark);
    const end = this.metrics.performanceMarks.get(endMark);
    
    if (start && end) {
      const duration = end.value - start.value;
      console.log(`📊 Performance measure ${startMark} → ${endMark}: ${duration.toFixed(2)}ms`);
      return duration;
    }
    
    return null;
  }
  
  addOptimizationSuggestion(type, message) {
    const suggestion = `[${type.toUpperCase()}] ${message}`;
    if (!this.metrics.optimizationSuggestions.has(suggestion)) {
      this.metrics.optimizationSuggestions.add(suggestion);
      console.log(`💡 ${suggestion}`);
      this.emit('suggestion', { type, message });
    }
  }
  
  generatePerformanceReport() {
    const now = Date.now();
    const uptime = now - this.metrics.startTime;
    
    // Calculate statistics
    const memSamples = this.metrics.samples.filter(s => s.type === 'memory').map(s => s.data.heapUsed);
    const cpuSamples = this.metrics.samples.filter(s => s.type === 'cpu').map(s => s.data.cpuPercent);
    const networkRequests = this.metrics.networkRequests;
    
    const report = {
      timestamp: new Date().toISOString(),
      uptime: `${Math.round(uptime / 1000)}s`,
      memory: {
        samples: memSamples.length,
        current: memSamples.length > 0 ? `${Math.round(memSamples[memSamples.length - 1] / 1024 / 1024)}MB` : 'N/A',
        average: memSamples.length > 0 ? `${Math.round(memSamples.reduce((a, b) => a + b) / memSamples.length / 1024 / 1024)}MB` : 'N/A',
        peak: memSamples.length > 0 ? `${Math.round(Math.max(...memSamples) / 1024 / 1024)}MB` : 'N/A'
      },
      cpu: {
        samples: cpuSamples.length,
        current: cpuSamples.length > 0 ? `${cpuSamples[cpuSamples.length - 1].toFixed(1)}%` : 'N/A',
        average: cpuSamples.length > 0 ? `${(cpuSamples.reduce((a, b) => a + b) / cpuSamples.length).toFixed(1)}%` : 'N/A',
        peak: cpuSamples.length > 0 ? `${Math.max(...cpuSamples).toFixed(1)}%` : 'N/A'
      },
      network: {
        totalRequests: networkRequests.length,
        successRate: networkRequests.length > 0 ? 
          `${((networkRequests.filter(r => r.result === 'success').length / networkRequests.length) * 100).toFixed(1)}%` : 'N/A',
        averageResponseTime: networkRequests.length > 0 ? 
          `${(networkRequests.reduce((sum, r) => sum + r.duration, 0) / networkRequests.length).toFixed(2)}ms` : 'N/A'
      },
      issues: {
        memoryLeaks: this.metrics.memoryLeaks.length,
        optimizationSuggestions: this.metrics.optimizationSuggestions.size
      }
    };
    
    console.log('\n📈 Performance Report:');
    console.log(`⏱️  Uptime: ${report.uptime}`);
    console.log(`🧠 Memory - Current: ${report.memory.current}, Average: ${report.memory.average}, Peak: ${report.memory.peak}`);
    console.log(`⚡ CPU - Current: ${report.cpu.current}, Average: ${report.cpu.average}, Peak: ${report.cpu.peak}`);
    console.log(`🌐 Network - Requests: ${report.network.totalRequests}, Success: ${report.network.successRate}, Avg Response: ${report.network.averageResponseTime}`);
    console.log(`⚠️  Issues - Memory Leaks: ${report.issues.memoryLeaks}, Suggestions: ${report.issues.optimizationSuggestions}\n`);
    
    this.emit('report', report);
    return report;
  }
  
  generateFinalReport() {
    const report = this.generatePerformanceReport();
    
    // Add optimization suggestions
    console.log('💡 Optimization Suggestions:');
    if (this.metrics.optimizationSuggestions.size === 0) {
      console.log('   ✅ No optimization suggestions - performance looks good!');
    } else {
      Array.from(this.metrics.optimizationSuggestions).forEach(suggestion => {
        console.log(`   • ${suggestion}`);
      });
    }
    
    // Save detailed report to file
    const detailedReport = {
      ...report,
      detailedMetrics: {
        samples: this.metrics.samples,
        networkRequests: this.metrics.networkRequests,
        memoryLeaks: this.metrics.memoryLeaks,
        resourceUsage: this.metrics.resourceUsage,
        performanceMarks: Array.from(this.metrics.performanceMarks.entries()),
        optimizationSuggestions: Array.from(this.metrics.optimizationSuggestions)
      }
    };
    
    const reportPath = path.join(process.cwd(), `bridge-performance-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}`);
    
    return detailedReport;
  }
}

// Usage example and CLI interface
if (require.main === module) {
  const analyzer = new BridgePerformanceAnalyzer({
    sampleInterval: 500,
    reportInterval: 5000
  });
  
  analyzer.start();
  
  // Simulate some work
  analyzer.markPerformance('demo-start');
  
  // Example performance monitoring
  setTimeout(() => {
    analyzer.markPerformance('demo-end');
    analyzer.measurePerformance('demo-start', 'demo-end');
  }, 3000);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down performance analyzer...');
    analyzer.stop();
    process.exit(0);
  });
  
  // Keep running for demonstration
  setTimeout(() => {
    console.log('\n⏹️  Demo complete. Press Ctrl+C to exit.');
  }, 10000);
}

module.exports = BridgePerformanceAnalyzer;
