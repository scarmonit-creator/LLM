#!/usr/bin/env node

/**
 * Performance Testing Script for A2A Self-Test Framework
 * Tests load handling, concurrent connections, and latency metrics
 */

import { performance } from 'perf_hooks';
import fetch from 'node-fetch';
import WebSocket from 'ws';
import { spawn } from 'child_process';
import fs from 'fs/promises';

const A2A_PORT = process.env.A2A_PORT || 3001;
const BRIDGE_WS_PORT = process.env.BRIDGE_WS_PORT || 8080;
const LOAD_TEST_DURATION = parseInt(process.env.LOAD_TEST_DURATION || '30'); // seconds
const CONCURRENT_AGENTS = parseInt(process.env.CONCURRENT_AGENTS || '25');
const BASE_URL = `http://localhost:${A2A_PORT}`;
const WS_URL = `ws://localhost:${BRIDGE_WS_PORT}`;

class PerformanceMetrics {
  constructor() {
    this.latencies = [];
    this.throughput = 0;
    this.errorRate = 0;
    this.concurrentConnections = 0;
    this.memoryUsage = [];
    this.startTime = 0;
    this.endTime = 0;
  }

  addLatency(latency) {
    this.latencies.push(latency);
  }

  calculateStats() {
    if (this.latencies.length === 0) return;
    
    this.latencies.sort((a, b) => a - b);
    const len = this.latencies.length;
    
    this.stats = {
      count: len,
      min: this.latencies[0],
      max: this.latencies[len - 1],
      avg: this.latencies.reduce((a, b) => a + b) / len,
      p50: this.latencies[Math.floor(len * 0.5)],
      p90: this.latencies[Math.floor(len * 0.9)],
      p95: this.latencies[Math.floor(len * 0.95)],
      p99: this.latencies[Math.floor(len * 0.99)],
      throughput: len / ((this.endTime - this.startTime) / 1000)
    };
  }

  isWithinThresholds() {
    if (!this.stats) return false;
    
    // Performance thresholds for CI
    return (
      this.stats.p95 < 2000 && // P95 latency under 2s
      this.stats.avg < 1000 && // Average latency under 1s
      this.errorRate < 0.1 &&  // Error rate under 10%
      this.stats.throughput > 5 // At least 5 requests/second
    );
  }
}

class PerformanceTester {
  constructor() {
    this.metrics = new PerformanceMetrics();
    this.activeConnections = [];
    this.errors = 0;
    this.requests = 0;
  }

  async startServices() {
    console.log('🚀 Starting services for performance testing...');
    
    // Start A2A server in background (if not already running)
    try {
      const response = await fetch(`${BASE_URL}/health`, { timeout: 2000 });
      if (response.ok) {
        console.log('✅ A2A server already running');
        return true;
      }
    } catch (error) {
      console.log('🔄 Starting A2A server...');
      // In CI, services are started externally
      return false;
    }
  }

  async testHttpEndpointPerformance() {
    console.log(`📊 Testing HTTP endpoint performance (${CONCURRENT_AGENTS} concurrent agents)...`);
    
    const promises = [];
    this.metrics.startTime = performance.now();
    
    for (let i = 0; i < CONCURRENT_AGENTS; i++) {
      promises.push(this.performHttpRequest(i));
    }
    
    await Promise.allSettled(promises);
    this.metrics.endTime = performance.now();
  }

  async performHttpRequest(agentId) {
    const start = performance.now();
    
    try {
      const response = await fetch(`${BASE_URL}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      const end = performance.now();
      const latency = end - start;
      
      if (response.ok) {
        this.metrics.addLatency(latency);
        this.requests++;
      } else {
        this.errors++;
      }
    } catch (error) {
      this.errors++;
      console.log(`❌ Agent ${agentId} request failed:`, error.message);
    }
  }

  async testWebSocketPerformance() {
    console.log('🔌 Testing WebSocket performance...');
    
    return new Promise((resolve) => {
      let connectionsEstablished = 0;
      let messagesReceived = 0;
      const targetConnections = Math.min(10, CONCURRENT_AGENTS);
      
      for (let i = 0; i < targetConnections; i++) {
        const ws = new WebSocket(WS_URL);
        const connectionStart = performance.now();
        
        ws.on('open', () => {
          connectionsEstablished++;
          this.metrics.concurrentConnections++;
          
          const connectionTime = performance.now() - connectionStart;
          this.metrics.addLatency(connectionTime);
          
          // Send test message
          ws.send(JSON.stringify({ type: 'performance-test', id: i }));
        });
        
        ws.on('message', (data) => {
          messagesReceived++;
          if (messagesReceived >= targetConnections) {
            this.activeConnections.forEach(conn => conn.close());
            resolve();
          }
        });
        
        ws.on('error', () => {
          this.errors++;
        });
        
        this.activeConnections.push(ws);
      }
      
      // Timeout after 10 seconds
      setTimeout(() => {
        this.activeConnections.forEach(ws => ws.close());
        resolve();
      }, 10000);
    });
  }

  async testA2AProtocolPerformance() {
    console.log('🤖 Testing A2A protocol message routing performance...');
    
    const promises = [];
    
    for (let i = 0; i < Math.min(20, CONCURRENT_AGENTS); i++) {
      promises.push(this.testA2AMessage(i));
    }
    
    await Promise.allSettled(promises);
  }

  async testA2AMessage(id) {
    const start = performance.now();
    
    try {
      const message = {
        type: 'performance-test',
        from: `test-agent-${id}`,
        to: 'performance-receiver',
        payload: { timestamp: Date.now(), data: 'performance test data' }
      };
      
      const response = await fetch(`${BASE_URL}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
        timeout: 5000
      });
      
      const end = performance.now();
      const latency = end - start;
      
      if (response.ok) {
        this.metrics.addLatency(latency);
        this.requests++;
      } else {
        this.errors++;
      }
    } catch (error) {
      this.errors++;
    }
  }

  async collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage.push({
      timestamp: Date.now(),
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal
    });
  }

  generateReport() {
    this.metrics.calculateStats();
    this.metrics.errorRate = this.errors / (this.errors + this.requests);
    
    const report = {
      timestamp: new Date().toISOString(),
      duration: LOAD_TEST_DURATION,
      concurrentAgents: CONCURRENT_AGENTS,
      totalRequests: this.requests,
      totalErrors: this.errors,
      errorRate: this.metrics.errorRate,
      latencyStats: this.metrics.stats,
      concurrentConnections: this.metrics.concurrentConnections,
      memoryStats: this.calculateMemoryStats(),
      performanceThresholds: {
        withinLimits: this.metrics.isWithinThresholds(),
        p95LatencyMs: this.metrics.stats?.p95 || 0,
        avgLatencyMs: this.metrics.stats?.avg || 0,
        throughputRPS: this.metrics.stats?.throughput || 0,
        errorRate: this.metrics.errorRate
      }
    };
    
    return report;
  }

  calculateMemoryStats() {
    if (this.metrics.memoryUsage.length === 0) return {};
    
    const heapUsed = this.metrics.memoryUsage.map(m => m.heapUsed);
    return {
      maxHeapUsed: Math.max(...heapUsed),
      avgHeapUsed: heapUsed.reduce((a, b) => a + b) / heapUsed.length,
      samples: this.metrics.memoryUsage.length
    };
  }
}

async function runPerformanceTests() {
  const tester = new PerformanceTester();
  
  try {
    console.log('🎯 Starting A2A Self-Test Framework Performance Tests');
    console.log(`⏱️  Duration: ${LOAD_TEST_DURATION}s, Concurrent agents: ${CONCURRENT_AGENTS}`);
    
    // Check if services are running
    await tester.startServices();
    
    // Collect initial metrics
    await tester.collectSystemMetrics();
    
    // Run performance tests
    await tester.testHttpEndpointPerformance();
    
    try {
      await tester.testWebSocketPerformance();
    } catch (error) {
      console.log('⚠️  WebSocket test skipped:', error.message);
    }
    
    try {
      await tester.testA2AProtocolPerformance();
    } catch (error) {
      console.log('⚠️  A2A protocol test completed with warnings:', error.message);
    }
    
    // Collect final metrics
    await tester.collectSystemMetrics();
    
    // Generate and save report
    const report = tester.generateReport();
    
    console.log('\n📈 Performance Test Results:');
    console.log(`   Total Requests: ${report.totalRequests}`);
    console.log(`   Total Errors: ${report.totalErrors}`);
    console.log(`   Error Rate: ${(report.errorRate * 100).toFixed(2)}%`);
    
    if (report.latencyStats) {
      console.log(`   Average Latency: ${report.latencyStats.avg.toFixed(2)}ms`);
      console.log(`   P95 Latency: ${report.latencyStats.p95.toFixed(2)}ms`);
      console.log(`   Throughput: ${report.latencyStats.throughput.toFixed(2)} req/s`);
    }
    
    console.log(`   Within Thresholds: ${report.performanceThresholds.withinLimits ? '✅' : '❌'}`);
    
    // Save detailed report
    await fs.writeFile('performance-report.json', JSON.stringify(report, null, 2));
    console.log('📊 Detailed report saved to performance-report.json');
    
    // Exit with appropriate code
    const success = report.performanceThresholds.withinLimits && report.totalRequests > 0;
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Performance test failed:', error.message);
    
    // Create minimal report for CI
    const fallbackReport = {
      timestamp: new Date().toISOString(),
      error: error.message,
      performanceThresholds: { withinLimits: false }
    };
    
    await fs.writeFile('performance-report.json', JSON.stringify(fallbackReport, null, 2));
    process.exit(1);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceTests();
}

export { PerformanceTester, PerformanceMetrics };
