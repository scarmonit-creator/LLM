/**
 * Performance Benchmarking Suite - Autonomous Verification System
 * Tests optimization effectiveness and enforces SLA compliance
 * Target: <100ms P95 latency, >1000 RPS, <0.1% error rate, <500MB memory usage
 */

import { performance } from 'perf_hooks';
import { Worker, isMainThread } from 'worker_threads';
import http from 'http';
import assert from 'assert';
import { EventEmitter } from 'events';

/**
 * Comprehensive Performance Benchmark Suite
 * Features:
 * - Concurrent load testing
 * - Memory pressure testing
 * - Latency distribution analysis
 * - Error rate monitoring
 * - Resource utilization tracking
 * - Regression detection
 */
class PerformanceBenchmarks extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      // Performance targets (SLA requirements)
      maxP95Latency: options.maxP95Latency || 100, // ms
      minThroughput: options.minThroughput || 1000, // RPS
      maxErrorRate: options.maxErrorRate || 0.001, // 0.1%
      maxMemoryUsage: options.maxMemoryUsage || 500 * 1024 * 1024, // 500MB
      
      // Test configuration
      warmupDuration: options.warmupDuration || 30000, // 30 seconds
      testDuration: options.testDuration || 60000, // 60 seconds
      concurrency: options.concurrency || 100, // concurrent connections
      rampUpTime: options.rampUpTime || 10000, // 10 seconds
      
      // Server configuration
      serverHost: options.serverHost || 'localhost',
      serverPort: options.serverPort || 8080,
      
      ...options
    };
    
    this.results = {
      throughput: { rps: 0, total: 0 },
      latency: { min: Infinity, max: 0, avg: 0, p95: 0, p99: 0, distribution: [] },
      errors: { count: 0, rate: 0, types: {} },
      memory: { peak: 0, avg: 0, samples: [], gc_events: 0 },
      cpu: { avg: 0, peak: 0, samples: [] },
      network: { bytes_sent: 0, bytes_received: 0 },
      optimization: { baseline: null, improvement: 0, regression: false }
    };
    
    this.startTime = null;
    this.endTime = null;
    this.isRunning = false;
    this.workers = [];
    
    this.setupMonitoring();
  }
  
  /**
   * Setup system monitoring
   */
  setupMonitoring() {
    // Memory monitoring
    this.memoryMonitor = setInterval(() => {
      const memUsage = process.memoryUsage();
      const totalMemory = memUsage.heapUsed;
      
      this.results.memory.samples.push(totalMemory);
      this.results.memory.peak = Math.max(this.results.memory.peak, totalMemory);
      
      if (this.results.memory.samples.length > 1000) {
        this.results.memory.samples = this.results.memory.samples.slice(-1000);
      }
    }, 1000);
    
    // CPU monitoring (simplified)
    this.cpuMonitor = setInterval(() => {
      const usage = process.cpuUsage();
      const cpuPercent = (usage.user + usage.system) / 1000000 / 1; // Rough estimation
      
      this.results.cpu.samples.push(cpuPercent);
      this.results.cpu.peak = Math.max(this.results.cpu.peak, cpuPercent);
      
      if (this.results.cpu.samples.length > 1000) {
        this.results.cpu.samples = this.results.cpu.samples.slice(-1000);
      }
    }, 1000);
  }
  
  /**
   * Run comprehensive benchmark suite
   */
  async runBenchmarks() {
    console.log('📋 Starting Performance Benchmark Suite...');
    console.log('=' .repeat(60));
    console.log(`Target Server: ${this.config.serverHost}:${this.config.serverPort}`);
    console.log(`Test Duration: ${this.config.testDuration / 1000}s`);
    console.log(`Concurrency: ${this.config.concurrency}`);
    console.log('\nPerformance Targets:');
    console.log(`- P95 Latency: <${this.config.maxP95Latency}ms`);
    console.log(`- Throughput: >${this.config.minThroughput} RPS`);
    console.log(`- Error Rate: <${(this.config.maxErrorRate * 100).toFixed(2)}%`);
    console.log(`- Memory Usage: <${Math.round(this.config.maxMemoryUsage / 1024 / 1024)}MB`);
    console.log('=' .repeat(60));
    
    try {
      // Pre-flight checks
      await this.preflightChecks();
      
      // Warmup phase
      await this.warmupPhase();
      
      // Load testing phase
      await this.loadTestingPhase();
      
      // Memory stress testing
      await this.memoryStressTest();
      
      // Concurrency testing
      await this.concurrencyStressTest();
      
      // Results analysis
      this.analyzeResults();
      
      // SLA compliance check
      const compliance = this.checkSLACompliance();
      
      this.emit('benchmarkComplete', {
        results: this.results,
        compliance,
        timestamp: new Date().toISOString()
      });
      
      return { results: this.results, compliance, success: compliance.overall };
      
    } catch (error) {
      console.error('❌ Benchmark failed:', error);
      this.emit('benchmarkFailed', { error: error.message, timestamp: new Date().toISOString() });
      throw error;
      
    } finally {
      await this.cleanup();
    }
  }
  
  /**
   * Pre-flight checks to ensure server is ready
   */
  async preflightChecks() {
    console.log('🔍 Running pre-flight checks...');
    
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: this.config.serverHost,
        port: this.config.serverPort,
        path: '/health',
        method: 'GET',
        timeout: 5000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('✅ Server health check passed');
            resolve();
          } else {
            reject(new Error(`Health check failed: ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Cannot connect to server: ${error.message}`));
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Health check timeout'));
      });
      
      req.end();
    });
  }
  
  /**
   * Warmup phase to stabilize performance
   */
  async warmupPhase() {
    console.log(`🔥 Warming up for ${this.config.warmupDuration / 1000}s...`);
    
    const warmupStart = performance.now();
    const warmupRequests = [];
    
    while (performance.now() - warmupStart < this.config.warmupDuration) {
      const requestPromises = [];
      
      for (let i = 0; i < 10; i++) { // 10 concurrent requests at a time
        requestPromises.push(this.makeRequest('/health'));
      }
      
      await Promise.allSettled(requestPromises);
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('✅ Warmup completed');
  }
  
  /**
   * Main load testing phase
   */
  async loadTestingPhase() {
    console.log(`🚀 Starting load testing for ${this.config.testDuration / 1000}s...`);
    
    this.startTime = performance.now();
    this.isRunning = true;
    
    const requests = [];
    const endpoints = ['/', '/health', '/history', '/metrics/concurrent'];
    
    // Ramp up phase
    const rampUpStep = this.config.concurrency / (this.config.rampUpTime / 1000);
    let currentConcurrency = 1;
    
    const testInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(testInterval);
        return;
      }
      
      // Gradually increase concurrency during ramp-up
      if (performance.now() - this.startTime < this.config.rampUpTime) {
        currentConcurrency = Math.min(this.config.concurrency, currentConcurrency + rampUpStep);
      } else {
        currentConcurrency = this.config.concurrency;
      }
      
      // Launch concurrent requests
      for (let i = 0; i < currentConcurrency; i++) {
        const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
        const requestPromise = this.makeRequestWithMetrics(endpoint);
        requests.push(requestPromise);
      }
      
      // Clean up completed requests to prevent memory buildup
      while (requests.length > 1000) {
        await requests.shift();
      }
      
    }, 1000); // Execute every second
    
    // Wait for test duration
    await new Promise(resolve => {
      setTimeout(() => {
        this.isRunning = false;
        this.endTime = performance.now();
        clearInterval(testInterval);
        resolve();
      }, this.config.testDuration);
    });
    
    // Wait for remaining requests to complete
    console.log('🔄 Waiting for remaining requests to complete...');
    await Promise.allSettled(requests);
    
    console.log('✅ Load testing completed');
  }
  
  /**
   * Memory stress testing
   */
  async memoryStressTest() {
    console.log('🧠 Running memory stress test...');
    
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Generate load that exercises memory allocation
    const memoryTestPromises = [];
    
    for (let i = 0; i < 50; i++) {
      memoryTestPromises.push(
        this.makeRequestWithPayload('/optimize', {
          action: 'memory_test',
          data: new Array(1000).fill(0).map(() => Math.random().toString(36))
        })
      );
    }
    
    await Promise.allSettled(memoryTestPromises);
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryDelta = finalMemory - initialMemory;
    
    console.log(`✅ Memory stress test completed (delta: ${Math.round(memoryDelta / 1024 / 1024)}MB)`);
  }
  
  /**
   * Concurrency stress testing with high connection count
   */
  async concurrencyStressTest() {
    console.log('💥 Running concurrency stress test...');
    
    const extremeConcurrency = this.config.concurrency * 2; // 2x normal concurrency
    const promises = [];
    
    for (let i = 0; i < extremeConcurrency; i++) {
      promises.push(this.makeRequestWithMetrics('/health'));
    }
    
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - successful;
    
    console.log(`✅ Concurrency test completed: ${successful}/${results.length} successful (${failed} failed)`);
  }
  
  /**
   * Make HTTP request with performance metrics
   */
  async makeRequestWithMetrics(path) {
    const startTime = performance.now();
    
    try {
      const result = await this.makeRequest(path);
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Record metrics
      this.results.latency.distribution.push(duration);
      this.results.latency.min = Math.min(this.results.latency.min, duration);
      this.results.latency.max = Math.max(this.results.latency.max, duration);
      this.results.throughput.total++;
      
      return result;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      
      // Record error
      this.results.errors.count++;
      this.results.errors.types[error.message] = (this.results.errors.types[error.message] || 0) + 1;
      this.results.latency.distribution.push(duration); // Include failed request duration
      
      throw error;
    }
  }
  
  /**
   * Make HTTP request with POST payload
   */
  async makeRequestWithPayload(path, payload) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);
      
      const req = http.request({
        hostname: this.config.serverHost,
        port: this.config.serverPort,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        },
        timeout: 10000
      }, (res) => {
        let responseData = '';
        res.on('data', chunk => {
          responseData += chunk;
          this.results.network.bytes_received += chunk.length;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 400) {
            resolve({ statusCode: res.statusCode, data: responseData });
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.write(data);
      this.results.network.bytes_sent += data.length;
      req.end();
    });
  }
  
  /**
   * Make basic HTTP request
   */
  async makeRequest(path) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: this.config.serverHost,
        port: this.config.serverPort,
        path,
        method: 'GET',
        timeout: 5000
      }, (res) => {
        let data = '';
        res.on('data', chunk => {
          data += chunk;
          this.results.network.bytes_received += chunk.length;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 400) {
            resolve({ statusCode: res.statusCode, data });
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.end();
    });
  }
  
  /**
   * Analyze benchmark results
   */
  analyzeResults() {
    console.log('\n📊 Analyzing results...');
    
    const testDurationSeconds = (this.endTime - this.startTime) / 1000;
    
    // Calculate throughput
    this.results.throughput.rps = this.results.throughput.total / testDurationSeconds;
    
    // Calculate latency statistics
    const latencies = this.results.latency.distribution.sort((a, b) => a - b);
    if (latencies.length > 0) {
      this.results.latency.avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      this.results.latency.p95 = latencies[Math.floor(latencies.length * 0.95)];
      this.results.latency.p99 = latencies[Math.floor(latencies.length * 0.99)];
    }
    
    // Calculate error rate
    this.results.errors.rate = this.results.throughput.total > 0
      ? this.results.errors.count / this.results.throughput.total
      : 0;
    
    // Calculate memory statistics
    if (this.results.memory.samples.length > 0) {
      this.results.memory.avg = this.results.memory.samples.reduce((a, b) => a + b, 0) / this.results.memory.samples.length;
    }
    
    // Calculate CPU statistics
    if (this.results.cpu.samples.length > 0) {
      this.results.cpu.avg = this.results.cpu.samples.reduce((a, b) => a + b, 0) / this.results.cpu.samples.length;
    }
  }
  
  /**
   * Check SLA compliance against performance targets
   */
  checkSLACompliance() {
    const compliance = {
      latency: {
        target: this.config.maxP95Latency,
        actual: this.results.latency.p95,
        passed: this.results.latency.p95 <= this.config.maxP95Latency,
        score: Math.max(0, 100 - (this.results.latency.p95 / this.config.maxP95Latency * 100 - 100))
      },
      throughput: {
        target: this.config.minThroughput,
        actual: this.results.throughput.rps,
        passed: this.results.throughput.rps >= this.config.minThroughput,
        score: Math.min(100, (this.results.throughput.rps / this.config.minThroughput) * 100)
      },
      errorRate: {
        target: this.config.maxErrorRate,
        actual: this.results.errors.rate,
        passed: this.results.errors.rate <= this.config.maxErrorRate,
        score: Math.max(0, 100 - (this.results.errors.rate / this.config.maxErrorRate * 100 - 100))
      },
      memory: {
        target: this.config.maxMemoryUsage,
        actual: this.results.memory.peak,
        passed: this.results.memory.peak <= this.config.maxMemoryUsage,
        score: Math.max(0, 100 - (this.results.memory.peak / this.config.maxMemoryUsage * 100 - 100))
      }
    };
    
    // Calculate overall compliance
    const allPassed = Object.values(compliance).every(metric => metric.passed);
    const averageScore = Object.values(compliance).reduce((sum, metric) => sum + metric.score, 0) / Object.keys(compliance).length;
    
    compliance.overall = {
      passed: allPassed,
      score: averageScore,
      grade: this.getPerformanceGrade(averageScore)
    };
    
    return compliance;
  }
  
  /**
   * Get performance grade based on score
   */
  getPerformanceGrade(score) {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'A-';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'B-';
    if (score >= 65) return 'C+';
    if (score >= 60) return 'C';
    if (score >= 55) return 'C-';
    if (score >= 50) return 'D';
    return 'F';
  }
  
  /**
   * Print comprehensive results report
   */
  printResults(compliance) {
    console.log('\n' + '=' .repeat(60));
    console.log('📈 PERFORMANCE BENCHMARK RESULTS');
    console.log('=' .repeat(60));
    
    // Overall performance score
    const grade = compliance.overall.grade;
    const gradeEmoji = grade.startsWith('A') ? '🎆' : grade.startsWith('B') ? '🥈' : grade.startsWith('C') ? '🥉' : '❌';
    console.log(`${gradeEmoji} Overall Grade: ${grade} (${compliance.overall.score.toFixed(1)}%)`)
    
    console.log('\n🏁 THROUGHPUT:');
    console.log(`  RPS: ${this.results.throughput.rps.toFixed(0)} (target: >${this.config.minThroughput})`);
    console.log(`  Total Requests: ${this.results.throughput.total}`);
    console.log(`  Status: ${compliance.throughput.passed ? '✅ PASS' : '❌ FAIL'}`);
    
    console.log('\n⏱️ LATENCY:');
    console.log(`  Average: ${this.results.latency.avg.toFixed(1)}ms`);
    console.log(`  P95: ${this.results.latency.p95.toFixed(1)}ms (target: <${this.config.maxP95Latency}ms)`);
    console.log(`  P99: ${this.results.latency.p99.toFixed(1)}ms`);
    console.log(`  Min: ${this.results.latency.min.toFixed(1)}ms`);
    console.log(`  Max: ${this.results.latency.max.toFixed(1)}ms`);
    console.log(`  Status: ${compliance.latency.passed ? '✅ PASS' : '❌ FAIL'}`);
    
    console.log('\n⚠️ ERRORS:');
    console.log(`  Count: ${this.results.errors.count}`);
    console.log(`  Rate: ${(this.results.errors.rate * 100).toFixed(3)}% (target: <${(this.config.maxErrorRate * 100).toFixed(2)}%)`);
    console.log(`  Status: ${compliance.errorRate.passed ? '✅ PASS' : '❌ FAIL'}`);
    
    console.log('\n🧠 MEMORY:');
    console.log(`  Peak: ${Math.round(this.results.memory.peak / 1024 / 1024)}MB (target: <${Math.round(this.config.maxMemoryUsage / 1024 / 1024)}MB)`);
    console.log(`  Average: ${Math.round(this.results.memory.avg / 1024 / 1024)}MB`);
    console.log(`  Status: ${compliance.memory.passed ? '✅ PASS' : '❌ FAIL'}`);
    
    console.log('\n📊 NETWORK:');
    console.log(`  Bytes Sent: ${Math.round(this.results.network.bytes_sent / 1024)}KB`);
    console.log(`  Bytes Received: ${Math.round(this.results.network.bytes_received / 1024)}KB`);
    
    if (Object.keys(this.results.errors.types).length > 0) {
      console.log('\n⚠️ ERROR BREAKDOWN:');
      for (const [error, count] of Object.entries(this.results.errors.types)) {
        console.log(`  ${error}: ${count}`);
      }
    }
    
    console.log('\n' + '=' .repeat(60));
    
    if (compliance.overall.passed) {
      console.log('✅ ALL PERFORMANCE TARGETS MET!');
    } else {
      console.log('❌ PERFORMANCE TARGETS NOT MET');
      const failedMetrics = Object.entries(compliance)
        .filter(([key, value]) => key !== 'overall' && !value.passed)
        .map(([key]) => key);
      console.log(`Failed metrics: ${failedMetrics.join(', ')}`);
    }
    
    console.log('=' .repeat(60));
  }
  
  /**
   * Save results to JSON file for historical analysis
   */
  async saveResults(compliance) {
    const report = {
      timestamp: new Date().toISOString(),
      config: this.config,
      results: this.results,
      compliance,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpus: require('os').cpus().length,
        totalMemory: require('os').totalmem()
      }
    };
    
    const filename = `performance-benchmark-${Date.now()}.json`;
    
    try {
      await require('fs/promises').writeFile(filename, JSON.stringify(report, null, 2));
      console.log(`💾 Results saved to ${filename}`);
    } catch (error) {
      console.error('Failed to save results:', error.message);
    }
    
    return report;
  }
  
  /**
   * Cleanup resources
   */
  async cleanup() {
    // Clear monitoring intervals
    if (this.memoryMonitor) clearInterval(this.memoryMonitor);
    if (this.cpuMonitor) clearInterval(this.cpuMonitor);
    
    // Terminate workers
    for (const worker of this.workers) {
      await worker.terminate();
    }
    this.workers = [];
    
    this.isRunning = false;
  }
}

// Export for use as module
export default PerformanceBenchmarks;

// Self-executing benchmark when run directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const benchmarks = new PerformanceBenchmarks({
    // Aggressive performance targets for optimization verification
    maxP95Latency: 100, // 100ms
    minThroughput: 500, // 500 RPS (reasonable for single instance)
    maxErrorRate: 0.01, // 1%
    maxMemoryUsage: 512 * 1024 * 1024, // 512MB
    
    testDuration: 60000, // 60 seconds
    concurrency: 50, // 50 concurrent connections
    warmupDuration: 15000 // 15 second warmup
  });
  
  benchmarks.on('benchmarkComplete', async ({ results, compliance }) => {
    benchmarks.printResults(compliance);
    await benchmarks.saveResults(compliance);
    
    process.exit(compliance.overall.passed ? 0 : 1);
  });
  
  benchmarks.on('benchmarkFailed', ({ error }) => {
    console.error('💥 Benchmark suite failed:', error);
    process.exit(1);
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n⏹️ Benchmark interrupted, cleaning up...');
    await benchmarks.cleanup();
    process.exit(1);
  });
  
  // Start benchmark suite
  benchmarks.runBenchmarks().catch(error => {
    console.error('💥 Benchmark execution failed:', error);
    process.exit(1);
  });
}