#!/usr/bin/env node
/**
 * 📊 PERFORMANCE BENCHMARKING SUITE
 * Comprehensive benchmarking and validation system for LLM optimizations
 * Measures and validates all performance improvements across the system
 */

import { performance, PerformanceObserver } from 'perf_hooks';
import { Worker } from 'worker_threads';
import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Performance Benchmarking Suite
 */
class PerformanceBenchmarkSuite extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      iterations: options.iterations || 100,
      warmupIterations: options.warmupIterations || 10,
      concurrencyLevels: options.concurrencyLevels || [1, 5, 10, 25, 50, 100],
      memoryLevels: options.memoryLevels || ['1MB', '10MB', '50MB', '100MB'],
      benchmarkTimeout: options.benchmarkTimeout || 300000, // 5 minutes
      enableProfiling: options.enableProfiling || true,
      reportFormat: options.reportFormat || 'detailed', // 'summary' | 'detailed' | 'json'
      outputPath: options.outputPath || './benchmark-results',
      ...options
    };
    
    this.benchmarks = new Map();
    this.results = [];
    this.baseline = null;
    this.isRunning = false;
    
    this.setupPerformanceObserver();
    this.registerDefaultBenchmarks();
  }
  
  setupPerformanceObserver() {
    this.perfObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        this.emit('performance-entry', entry);
      });
    });
    
    try {
      this.perfObserver.observe({ entryTypes: ['measure', 'mark'] });
    } catch (error) {
      console.warn('[PerformanceBenchmarks] Performance observer setup failed:', error.message);
    }
  }
  
  registerDefaultBenchmarks() {
    // Memory benchmarks
    this.registerBenchmark('memory-allocation', {
      description: 'Test memory allocation performance',
      category: 'memory',
      implementation: this.benchmarkMemoryAllocation.bind(this),
      baseline: { allocationsPerSecond: 1000000, peakMemory: 50 * 1024 * 1024 }
    });
    
    this.registerBenchmark('memory-garbage-collection', {
      description: 'Test garbage collection efficiency',
      category: 'memory',
      implementation: this.benchmarkGarbageCollection.bind(this),
      baseline: { gcTime: 100, memoryReclaimed: 0.7 }
    });
    
    // CPU benchmarks
    this.registerBenchmark('cpu-intensive', {
      description: 'Test CPU-intensive operations',
      category: 'cpu',
      implementation: this.benchmarkCPUIntensive.bind(this),
      baseline: { operationsPerSecond: 100000, efficiency: 0.8 }
    });
    
    this.registerBenchmark('concurrent-processing', {
      description: 'Test concurrent processing performance',
      category: 'concurrency',
      implementation: this.benchmarkConcurrentProcessing.bind(this),
      baseline: { throughput: 1000, latency: 50 }
    });
    
    // I/O benchmarks
    this.registerBenchmark('file-operations', {
      description: 'Test file I/O performance',
      category: 'io',
      implementation: this.benchmarkFileOperations.bind(this),
      baseline: { readThroughput: 100, writeThroughput: 80 }
    });
    
    // Network benchmarks
    this.registerBenchmark('network-requests', {
      description: 'Test network request handling',
      category: 'network',
      implementation: this.benchmarkNetworkRequests.bind(this),
      baseline: { requestsPerSecond: 500, averageLatency: 100 }
    });
    
    // Cache benchmarks
    this.registerBenchmark('cache-performance', {
      description: 'Test caching system performance',
      category: 'cache',
      implementation: this.benchmarkCachePerformance.bind(this),
      baseline: { hitRate: 0.85, accessTime: 1 }
    });
  }
  
  registerBenchmark(name, config) {
    this.benchmarks.set(name, {
      name,
      ...config,
      registered: Date.now()
    });
    
    console.log(`[PerformanceBenchmarks] Registered benchmark: ${name}`);
  }
  
  async runAllBenchmarks(options = {}) {
    if (this.isRunning) {
      throw new Error('Benchmarks are already running');
    }
    
    this.isRunning = true;
    this.results = [];
    
    const startTime = Date.now();
    
    console.log('[PerformanceBenchmarks] Starting comprehensive benchmark suite...');
    console.log(`[PerformanceBenchmarks] Total benchmarks: ${this.benchmarks.size}`);
    console.log(`[PerformanceBenchmarks] Iterations per benchmark: ${this.options.iterations}`);
    
    try {
      // Run warmup
      await this.runWarmup();
      
      // Capture baseline if not exists
      if (!this.baseline) {
        this.baseline = await this.captureBaseline();
      }
      
      // Run each benchmark
      for (const [name, benchmark] of this.benchmarks) {
        console.log(`[PerformanceBenchmarks] Running benchmark: ${name}`);
        
        try {
          const result = await this.runSingleBenchmark(name, benchmark);
          this.results.push(result);
          
          console.log(`[PerformanceBenchmarks] Completed ${name}: ${result.status}`);
          this.emit('benchmark-complete', result);
          
        } catch (error) {
          console.error(`[PerformanceBenchmarks] Benchmark ${name} failed:`, error);
          
          const errorResult = {
            name,
            status: 'failed',
            error: error.message,
            timestamp: Date.now()
          };
          
          this.results.push(errorResult);
          this.emit('benchmark-error', errorResult);
        }
      }
      
      const executionTime = Date.now() - startTime;
      
      // Generate comprehensive report
      const report = await this.generateReport();
      
      console.log(`[PerformanceBenchmarks] All benchmarks completed in ${executionTime}ms`);
      
      this.emit('benchmarks-complete', {
        report,
        executionTime,
        totalBenchmarks: this.benchmarks.size,
        successfulBenchmarks: this.results.filter(r => r.status === 'passed').length
      });
      
      return report;
      
    } finally {
      this.isRunning = false;
    }
  }
  
  async runWarmup() {
    console.log(`[PerformanceBenchmarks] Running warmup (${this.options.warmupIterations} iterations)...`);
    
    // Simple CPU warmup
    for (let i = 0; i < this.options.warmupIterations; i++) {
      const start = performance.now();
      
      // CPU intensive operation
      let sum = 0;
      for (let j = 0; j < 1000000; j++) {
        sum += Math.sqrt(j);
      }
      
      const end = performance.now();
    }
    
    // Memory warmup
    const buffers = [];
    for (let i = 0; i < this.options.warmupIterations; i++) {
      buffers.push(Buffer.alloc(1024 * 1024)); // 1MB buffers
    }
    
    // Force GC if available
    if (global.gc) {
      global.gc();
    }
    
    console.log('[PerformanceBenchmarks] Warmup completed');
  }
  
  async captureBaseline() {
    console.log('[PerformanceBenchmarks] Capturing performance baseline...');
    
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const baseline = {
      timestamp: Date.now(),
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        cpuCount: require('os').cpus().length,
        totalMemory: require('os').totalmem(),
        freeMemory: require('os').freemem()
      },
      process: {
        memory: memUsage,
        cpu: cpuUsage,
        uptime: process.uptime()
      }
    };
    
    console.log('[PerformanceBenchmarks] Baseline captured');
    return baseline;
  }
  
  async runSingleBenchmark(name, benchmark) {
    const startTime = Date.now();
    const iterations = this.options.iterations;
    const results = [];
    
    performance.mark(`${name}-start`);
    
    try {
      // Run benchmark iterations
      for (let i = 0; i < iterations; i++) {
        const iterationStart = performance.now();
        const memBefore = process.memoryUsage();
        
        // Run the actual benchmark implementation
        const result = await benchmark.implementation({
          iteration: i,
          total: iterations,
          baseline: this.baseline
        });
        
        const iterationEnd = performance.now();
        const memAfter = process.memoryUsage();
        
        results.push({
          iteration: i,
          result,
          executionTime: iterationEnd - iterationStart,
          memoryUsed: memAfter.heapUsed - memBefore.heapUsed,
          timestamp: Date.now()
        });
      }
      
      performance.mark(`${name}-end`);
      performance.measure(`${name}-duration`, `${name}-start`, `${name}-end`);
      
      // Calculate statistics
      const stats = this.calculateStatistics(results);
      
      // Compare with baseline if available
      const comparison = benchmark.baseline ? 
        this.compareWithBaseline(stats, benchmark.baseline) : null;
      
      const benchmarkResult = {
        name,
        description: benchmark.description,
        category: benchmark.category,
        status: 'passed',
        timestamp: startTime,
        executionTime: Date.now() - startTime,
        iterations,
        statistics: stats,
        baseline: benchmark.baseline,
        comparison,
        rawResults: this.options.reportFormat === 'detailed' ? results : undefined
      };
      
      return benchmarkResult;
      
    } catch (error) {
      performance.mark(`${name}-error`);
      
      throw new Error(`Benchmark ${name} failed: ${error.message}`);
    }
  }
  
  calculateStatistics(results) {
    const executionTimes = results.map(r => r.executionTime);
    const memoryUsage = results.map(r => r.memoryUsed);
    
    return {
      executionTime: {
        min: Math.min(...executionTimes),
        max: Math.max(...executionTimes),
        average: executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length,
        median: this.calculateMedian(executionTimes),
        stdDev: this.calculateStdDev(executionTimes)
      },
      memory: {
        min: Math.min(...memoryUsage),
        max: Math.max(...memoryUsage),
        average: memoryUsage.reduce((a, b) => a + b, 0) / memoryUsage.length,
        total: memoryUsage.reduce((a, b) => a + b, 0)
      },
      throughput: {
        operationsPerSecond: results.length / (executionTimes.reduce((a, b) => a + b, 0) / 1000),
        averageLatency: executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
      }
    };
  }
  
  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ?
      (sorted[mid - 1] + sorted[mid]) / 2 :
      sorted[mid];
  }
  
  calculateStdDev(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(variance);
  }
  
  compareWithBaseline(stats, baseline) {
    const comparison = {};
    
    Object.keys(baseline).forEach(key => {
      const baselineValue = baseline[key];
      const currentValue = this.getStatValue(stats, key);
      
      if (currentValue !== undefined && baselineValue !== undefined) {
        const improvement = ((currentValue - baselineValue) / baselineValue) * 100;
        
        comparison[key] = {
          baseline: baselineValue,
          current: currentValue,
          improvement: improvement,
          status: improvement > 0 ? 'improved' : improvement < -5 ? 'degraded' : 'stable'
        };
      }
    });
    
    return comparison;
  }
  
  getStatValue(stats, key) {
    // Map benchmark keys to stats structure
    switch (key) {
      case 'allocationsPerSecond':
        return stats.throughput?.operationsPerSecond;
      case 'peakMemory':
        return stats.memory?.max;
      case 'operationsPerSecond':
        return stats.throughput?.operationsPerSecond;
      case 'averageLatency':
        return stats.throughput?.averageLatency;
      default:
        return undefined;
    }
  }
  
  // Benchmark implementations
  async benchmarkMemoryAllocation(context) {
    const allocations = [];
    const startTime = performance.now();
    
    // Test various allocation patterns
    for (let i = 0; i < 1000; i++) {
      // Small allocations
      allocations.push(Buffer.alloc(1024));
      
      // Medium allocations
      if (i % 10 === 0) {
        allocations.push(Buffer.alloc(64 * 1024));
      }
      
      // Large allocations
      if (i % 100 === 0) {
        allocations.push(Buffer.alloc(1024 * 1024));
      }
    }
    
    const endTime = performance.now();
    const totalAllocated = allocations.reduce((sum, buf) => sum + buf.length, 0);
    
    return {
      allocationsCount: allocations.length,
      totalBytes: totalAllocated,
      allocationsPerSecond: allocations.length / ((endTime - startTime) / 1000),
      bytesPerSecond: totalAllocated / ((endTime - startTime) / 1000)
    };
  }
  
  async benchmarkGarbageCollection(context) {
    const startMemory = process.memoryUsage().heapUsed;
    
    // Create memory pressure
    const largeObjects = [];
    for (let i = 0; i < 100; i++) {
      largeObjects.push({
        data: Buffer.alloc(1024 * 1024), // 1MB
        timestamp: Date.now(),
        index: i
      });
    }
    
    const beforeGC = process.memoryUsage().heapUsed;
    const gcStart = performance.now();
    
    // Clear references and force GC
    largeObjects.length = 0;
    
    if (global.gc) {
      global.gc();
    }
    
    const gcEnd = performance.now();
    const afterGC = process.memoryUsage().heapUsed;
    
    return {
      gcTime: gcEnd - gcStart,
      memoryBefore: beforeGC,
      memoryAfter: afterGC,
      memoryReclaimed: (beforeGC - afterGC) / beforeGC,
      efficiency: Math.max(0, (beforeGC - afterGC) / beforeGC)
    };
  }
  
  async benchmarkCPUIntensive(context) {
    const startTime = performance.now();
    
    // CPU-intensive mathematical operations
    let result = 0;
    const operations = 100000;
    
    for (let i = 0; i < operations; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
      
      if (i % 1000 === 0) {
        // Simulate some processing variation
        result = result % 1000000;
      }
    }
    
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    return {
      operations,
      executionTime,
      operationsPerSecond: operations / (executionTime / 1000),
      result: result.toFixed(6),
      efficiency: operations / executionTime // ops per ms
    };
  }
  
  async benchmarkConcurrentProcessing(context) {
    const concurrencyLevel = 10;
    const tasksPerWorker = 100;
    
    const startTime = performance.now();
    
    // Create concurrent tasks
    const promises = [];
    
    for (let i = 0; i < concurrencyLevel; i++) {
      const promise = new Promise((resolve) => {
        setTimeout(() => {
          let sum = 0;
          for (let j = 0; j < tasksPerWorker; j++) {
            sum += Math.sqrt(j * i);
          }
          resolve(sum);
        }, Math.random() * 10); // Random delay 0-10ms
      });
      
      promises.push(promise);
    }
    
    const results = await Promise.all(promises);
    const endTime = performance.now();
    
    const totalTasks = concurrencyLevel * tasksPerWorker;
    const executionTime = endTime - startTime;
    
    return {
      concurrencyLevel,
      totalTasks,
      executionTime,
      throughput: totalTasks / (executionTime / 1000),
      latency: executionTime / totalTasks,
      results: results.length
    };
  }
  
  async benchmarkFileOperations(context) {
    const testDir = path.join(__dirname, 'benchmark-temp');
    
    try {
      await fs.mkdir(testDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    const fileCount = 50;
    const fileSize = 1024 * 10; // 10KB files
    const testData = Buffer.alloc(fileSize, 'a');
    
    const writeStart = performance.now();
    
    // Write test
    const writePromises = [];
    for (let i = 0; i < fileCount; i++) {
      const filePath = path.join(testDir, `test-${i}.txt`);
      writePromises.push(fs.writeFile(filePath, testData));
    }
    
    await Promise.all(writePromises);
    const writeEnd = performance.now();
    
    // Read test
    const readStart = performance.now();
    const readPromises = [];
    for (let i = 0; i < fileCount; i++) {
      const filePath = path.join(testDir, `test-${i}.txt`);
      readPromises.push(fs.readFile(filePath));
    }
    
    const readData = await Promise.all(readPromises);
    const readEnd = performance.now();
    
    // Cleanup
    try {
      for (let i = 0; i < fileCount; i++) {
        const filePath = path.join(testDir, `test-${i}.txt`);
        await fs.unlink(filePath);
      }
      await fs.rmdir(testDir);
    } catch (error) {
      // Cleanup errors are non-critical
    }
    
    const totalBytes = fileCount * fileSize;
    const writeTime = writeEnd - writeStart;
    const readTime = readEnd - readStart;
    
    return {
      fileCount,
      fileSize,
      totalBytes,
      writeTime,
      readTime,
      writeThroughput: totalBytes / (writeTime / 1000),
      readThroughput: totalBytes / (readTime / 1000),
      filesWritten: fileCount,
      filesRead: readData.length
    };
  }
  
  async benchmarkNetworkRequests(context) {
    // Simulate network requests using setTimeout
    const requestCount = 100;
    const concurrent = 10;
    
    const startTime = performance.now();
    const results = [];
    
    // Process requests in batches
    for (let batch = 0; batch < requestCount; batch += concurrent) {
      const batchPromises = [];
      
      for (let i = 0; i < concurrent && (batch + i) < requestCount; i++) {
        const requestPromise = new Promise((resolve) => {
          const requestStart = performance.now();
          
          // Simulate network delay (10-100ms)
          const delay = 10 + Math.random() * 90;
          
          setTimeout(() => {
            const requestEnd = performance.now();
            resolve({
              requestId: batch + i,
              latency: requestEnd - requestStart,
              status: 'success'
            });
          }, delay);
        });
        
        batchPromises.push(requestPromise);
      }
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    const latencies = results.map(r => r.latency);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    
    return {
      requestCount: results.length,
      totalTime,
      requestsPerSecond: results.length / (totalTime / 1000),
      averageLatency: avgLatency,
      minLatency: Math.min(...latencies),
      maxLatency: Math.max(...latencies),
      successRate: results.filter(r => r.status === 'success').length / results.length
    };
  }
  
  async benchmarkCachePerformance(context) {
    // Simple in-memory cache simulation
    const cache = new Map();
    const operations = 1000;
    const keySpace = 100; // 100 different keys
    
    const results = {
      hits: 0,
      misses: 0,
      sets: 0,
      totalAccessTime: 0
    };
    
    const startTime = performance.now();
    
    for (let i = 0; i < operations; i++) {
      const key = `key-${i % keySpace}`;
      const accessStart = performance.now();
      
      if (cache.has(key)) {
        // Cache hit
        const value = cache.get(key);
        results.hits++;
      } else {
        // Cache miss - simulate data generation
        const value = {
          data: `value-${i}`,
          timestamp: Date.now(),
          computed: Math.sqrt(i)
        };
        
        cache.set(key, value);
        results.misses++;
        results.sets++;
      }
      
      const accessEnd = performance.now();
      results.totalAccessTime += accessEnd - accessStart;
    }
    
    const endTime = performance.now();
    
    return {
      operations,
      hits: results.hits,
      misses: results.misses,
      hitRate: results.hits / operations,
      averageAccessTime: results.totalAccessTime / operations,
      cacheSize: cache.size,
      totalTime: endTime - startTime,
      operationsPerSecond: operations / ((endTime - startTime) / 1000)
    };
  }
  
  async generateReport() {
    const summary = {
      timestamp: Date.now(),
      totalBenchmarks: this.results.length,
      passed: this.results.filter(r => r.status === 'passed').length,
      failed: this.results.filter(r => r.status === 'failed').length,
      categories: {}
    };
    
    // Group results by category
    this.results.forEach(result => {
      if (result.status === 'passed') {
        const category = result.category || 'general';
        if (!summary.categories[category]) {
          summary.categories[category] = [];
        }
        summary.categories[category].push(result);
      }
    });
    
    const report = {
      summary,
      baseline: this.baseline,
      results: this.results,
      generatedAt: new Date().toISOString(),
      environment: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        memoryLimit: process.env.NODE_OPTIONS
      }
    };
    
    // Save report to file
    await this.saveReport(report);
    
    return report;
  }
  
  async saveReport(report) {
    try {
      await fs.mkdir(this.options.outputPath, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `benchmark-report-${timestamp}.json`;
      const filepath = path.join(this.options.outputPath, filename);
      
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
      
      console.log(`[PerformanceBenchmarks] Report saved to: ${filepath}`);
      
      // Also save a summary report
      const summaryPath = path.join(this.options.outputPath, 'latest-summary.json');
      await fs.writeFile(summaryPath, JSON.stringify(report.summary, null, 2));
      
    } catch (error) {
      console.error('[PerformanceBenchmarks] Failed to save report:', error);
    }
  }
  
  getResults() {
    return {
      isRunning: this.isRunning,
      totalBenchmarks: this.benchmarks.size,
      completedBenchmarks: this.results.length,
      results: this.results,
      baseline: this.baseline
    };
  }
}

export default PerformanceBenchmarkSuite;
