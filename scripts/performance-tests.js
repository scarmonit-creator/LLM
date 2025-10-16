#!/usr/bin/env node

/**
 * Performance Tests Script
 * Comprehensive performance testing and benchmarking suite
 */

import { performance } from 'perf_hooks';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

class PerformanceTestSuite {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        cpus: os.cpus().length,
        memory: os.totalmem(),
        freeMemory: os.freemem()
      },
      tests: [],
      metrics: {
        overall: {},
        individual: {}
      },
      errors: []
    };
    this.testCount = 0;
  }

  async runAllTests() {
    console.log('🏁 Starting Performance Test Suite...');
    console.log(`💻 Environment: Node ${process.version} on ${process.platform}`);
    
    const overallStart = performance.now();
    
    try {
      // Core performance tests
      await this.testMemoryPerformance();
      await this.testCPUPerformance();
      await this.testIOPerformance();
      await this.testNetworkPerformance();
      await this.testModuleLoadingPerformance();
      await this.testGarbageCollectionPerformance();
      
      // Application-specific tests
      await this.testServerStartupTime();
      await this.testDatabasePerformance();
      await this.testWebSocketPerformance();
      
      const overallEnd = performance.now();
      this.results.metrics.overall.totalTestTime = overallEnd - overallStart;
      this.results.metrics.overall.averageTestTime = this.results.metrics.overall.totalTestTime / this.testCount;
      
      await this.generatePerformanceReport();
      
      console.log('✅ Performance test suite completed successfully!');
      console.log(`⏱️  Total test time: ${Math.round(this.results.metrics.overall.totalTestTime)}ms`);
      console.log(`📋 Tests run: ${this.testCount}`);
      
    } catch (error) {
      console.error('❌ Performance tests failed:', error.message);
      this.results.errors.push(error.message);
      process.exit(1);
    }
  }

  async testMemoryPerformance() {
    console.log('🧠 Testing memory performance...');
    
    const testName = 'Memory Performance';
    const start = performance.now();
    const initialMemory = process.memoryUsage();
    
    try {
      // Memory allocation test
      const largeArray = new Array(1000000).fill(0).map((_, i) => ({ id: i, data: Math.random() }));
      
      const afterAllocation = process.memoryUsage();
      
      // Memory access test
      const accessStart = performance.now();
      let sum = 0;
      for (let i = 0; i < 100000; i++) {
        sum += largeArray[i % largeArray.length].data;
      }
      const accessEnd = performance.now();
      
      // Clear large array
      largeArray.length = 0;
      
      if (global.gc) {
        global.gc();
      }
      
      const afterGC = process.memoryUsage();
      const end = performance.now();
      
      this.addTestResult(testName, {
        duration: end - start,
        memoryAllocated: afterAllocation.heapUsed - initialMemory.heapUsed,
        memoryFreed: afterAllocation.heapUsed - afterGC.heapUsed,
        accessTime: accessEnd - accessStart,
        initialHeap: initialMemory.heapUsed,
        peakHeap: afterAllocation.heapUsed,
        finalHeap: afterGC.heapUsed
      });
      
    } catch (error) {
      this.addTestError(testName, error.message);
    }
  }

  async testCPUPerformance() {
    console.log('⚙️ Testing CPU performance...');
    
    const testName = 'CPU Performance';
    const start = performance.now();
    
    try {
      // CPU intensive calculations
      const iterations = 1000000;
      let result = 0;
      
      // Mathematical operations
      for (let i = 0; i < iterations; i++) {
        result += Math.sqrt(i) * Math.sin(i / 1000) + Math.cos(i / 1000);
      }
      
      // String operations
      let stringTest = '';
      for (let i = 0; i < 10000; i++) {
        stringTest += `test${i}-`;
      }
      
      // Array operations
      const array = new Array(100000).fill(0).map((_, i) => i);
      const sorted = array.sort((a, b) => b - a);
      const filtered = sorted.filter(n => n % 2 === 0);
      
      const end = performance.now();
      
      this.addTestResult(testName, {
        duration: end - start,
        mathOperations: iterations,
        stringLength: stringTest.length,
        arrayOperations: filtered.length,
        operationsPerSecond: iterations / ((end - start) / 1000)
      });
      
    } catch (error) {
      this.addTestError(testName, error.message);
    }
  }

  async testIOPerformance() {
    console.log('💾 Testing I/O performance...');
    
    const testName = 'I/O Performance';
    const start = performance.now();
    
    try {
      const testFile = path.join(__dirname, 'perf-test-temp.txt');
      const testData = 'x'.repeat(1000000); // 1MB of data
      
      // Write test
      const writeStart = performance.now();
      writeFileSync(testFile, testData);
      const writeEnd = performance.now();
      
      // Read test
      const readStart = performance.now();
      const readData = readFileSync(testFile, 'utf8');
      const readEnd = performance.now();
      
      // Multiple small writes
      const multiWriteStart = performance.now();
      for (let i = 0; i < 100; i++) {
        writeFileSync(`${testFile}.${i}`, `test data ${i}`);
      }
      const multiWriteEnd = performance.now();
      
      // Cleanup
      try {
        const { execSync } = await import('child_process');
        execSync(`rm -f ${testFile}*`);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      const end = performance.now();
      
      this.addTestResult(testName, {
        duration: end - start,
        writeTime: writeEnd - writeStart,
        readTime: readEnd - readStart,
        multiWriteTime: multiWriteEnd - multiWriteStart,
        dataSize: testData.length,
        readVerified: readData.length === testData.length
      });
      
    } catch (error) {
      this.addTestError(testName, error.message);
    }
  }

  async testNetworkPerformance() {
    console.log('🌐 Testing network performance...');
    
    const testName = 'Network Performance';
    const start = performance.now();
    
    try {
      // DNS resolution test
      const dnsStart = performance.now();
      const dns = await import('dns');
      const { promisify } = await import('util');
      const resolve = promisify(dns.resolve);
      
      try {
        await resolve('google.com');
        await resolve('github.com');
        await resolve('npmjs.com');
      } catch (dnsError) {
        // DNS resolution might fail in some environments
      }
      
      const dnsEnd = performance.now();
      
      // HTTP request simulation (without external dependencies)
      const httpStart = performance.now();
      const http = await import('http');
      
      // Create a simple HTTP server for testing
      const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
      });
      
      const port = 8999;
      server.listen(port);
      
      // Wait a moment for server to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Make requests to local server
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(this.makeLocalRequest(port));
      }
      
      await Promise.all(requests);
      server.close();
      
      const httpEnd = performance.now();
      const end = performance.now();
      
      this.addTestResult(testName, {
        duration: end - start,
        dnsResolutionTime: dnsEnd - dnsStart,
        httpRequestTime: httpEnd - httpStart,
        requestsMade: requests.length
      });
      
    } catch (error) {
      this.addTestError(testName, error.message);
    }
  }

  async testModuleLoadingPerformance() {
    console.log('📦 Testing module loading performance...');
    
    const testName = 'Module Loading Performance';
    const start = performance.now();
    
    try {
      const modules = ['fs', 'path', 'os', 'crypto', 'util', 'events', 'stream'];
      const loadTimes = [];
      
      for (const moduleName of modules) {
        const moduleStart = performance.now();
        await import(moduleName);
        const moduleEnd = performance.now();
        loadTimes.push(moduleEnd - moduleStart);
      }
      
      const end = performance.now();
      
      this.addTestResult(testName, {
        duration: end - start,
        modulesLoaded: modules.length,
        averageLoadTime: loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length,
        totalLoadTime: loadTimes.reduce((a, b) => a + b, 0),
        loadTimes: Object.fromEntries(modules.map((name, i) => [name, loadTimes[i]]))
      });
      
    } catch (error) {
      this.addTestError(testName, error.message);
    }
  }

  async testGarbageCollectionPerformance() {
    console.log('🗝️ Testing garbage collection performance...');
    
    const testName = 'Garbage Collection Performance';
    const start = performance.now();
    
    try {
      const initialMemory = process.memoryUsage();
      
      // Create objects that will need garbage collection
      const objects = [];
      for (let i = 0; i < 100000; i++) {
        objects.push({
          id: i,
          data: new Array(100).fill(Math.random()),
          timestamp: Date.now()
        });
      }
      
      const beforeGC = process.memoryUsage();
      
      // Clear references
      objects.length = 0;
      
      // Force garbage collection if available
      const gcStart = performance.now();
      if (global.gc) {
        global.gc();
      }
      const gcEnd = performance.now();
      
      const afterGC = process.memoryUsage();
      const end = performance.now();
      
      this.addTestResult(testName, {
        duration: end - start,
        gcTime: gcEnd - gcStart,
        memoryBefore: beforeGC.heapUsed,
        memoryAfter: afterGC.heapUsed,
        memoryFreed: beforeGC.heapUsed - afterGC.heapUsed,
        objectsCreated: 100000
      });
      
    } catch (error) {
      this.addTestError(testName, error.message);
    }
  }

  async testServerStartupTime() {
    console.log('🚀 Testing server startup time...');
    
    const testName = 'Server Startup Time';
    const start = performance.now();
    
    try {
      const express = await this.safeImport('express');
      
      if (express) {
        const app = express();
        
        app.get('/test', (req, res) => {
          res.json({ status: 'ok' });
        });
        
        const serverStart = performance.now();
        const server = app.listen(8998);
        
        // Wait for server to be ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const serverEnd = performance.now();
        server.close();
        
        const end = performance.now();
        
        this.addTestResult(testName, {
          duration: end - start,
          serverStartupTime: serverEnd - serverStart,
          frameworkUsed: 'express'
        });
      } else {
        this.addTestResult(testName, {
          duration: 0,
          skipped: true,
          reason: 'Express not available'
        });
      }
      
    } catch (error) {
      this.addTestError(testName, error.message);
    }
  }

  async testDatabasePerformance() {
    console.log('📦 Testing database performance...');
    
    const testName = 'Database Performance';
    const start = performance.now();
    
    try {
      // Test with SQLite (better-sqlite3)
      const Database = await this.safeImport('better-sqlite3');
      
      if (Database) {
        const db = new Database(':memory:');
        
        // Create test table
        const createStart = performance.now();
        db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, data TEXT)');
        const createEnd = performance.now();
        
        // Insert performance test
        const insertStart = performance.now();
        const insert = db.prepare('INSERT INTO test (data) VALUES (?)');
        for (let i = 0; i < 10000; i++) {
          insert.run(`test data ${i}`);
        }
        const insertEnd = performance.now();
        
        // Query performance test
        const queryStart = performance.now();
        const selectAll = db.prepare('SELECT * FROM test');
        const results = selectAll.all();
        const queryEnd = performance.now();
        
        db.close();
        
        const end = performance.now();
        
        this.addTestResult(testName, {
          duration: end - start,
          tableCreationTime: createEnd - createStart,
          insertTime: insertEnd - insertStart,
          queryTime: queryEnd - queryStart,
          recordsInserted: 10000,
          recordsQueried: results.length,
          databaseType: 'sqlite'
        });
      } else {
        this.addTestResult(testName, {
          duration: 0,
          skipped: true,
          reason: 'Database driver not available'
        });
      }
      
    } catch (error) {
      this.addTestError(testName, error.message);
    }
  }

  async testWebSocketPerformance() {
    console.log('🌐 Testing WebSocket performance...');
    
    const testName = 'WebSocket Performance';
    const start = performance.now();
    
    try {
      const WebSocket = await this.safeImport('ws');
      
      if (WebSocket) {
        const { WebSocketServer } = WebSocket;
        
        // Create WebSocket server
        const wss = new WebSocketServer({ port: 8997 });
        
        let messageCount = 0;
        const serverStart = performance.now();
        
        wss.on('connection', (ws) => {
          ws.on('message', (data) => {
            messageCount++;
            ws.send(`echo: ${data}`);
          });
        });
        
        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Create client and send messages
        const ws = new WebSocket('ws://localhost:8997');
        
        await new Promise((resolve) => {
          ws.on('open', () => {
            for (let i = 0; i < 100; i++) {
              ws.send(`test message ${i}`);
            }
          });
          
          ws.on('message', () => {
            if (messageCount >= 100) {
              ws.close();
              resolve();
            }
          });
        });
        
        wss.close();
        
        const end = performance.now();
        
        this.addTestResult(testName, {
          duration: end - start,
          messagesExchanged: messageCount,
          averageMessageTime: (end - serverStart) / messageCount,
          connectionType: 'websocket'
        });
      } else {
        this.addTestResult(testName, {
          duration: 0,
          skipped: true,
          reason: 'WebSocket library not available'
        });
      }
      
    } catch (error) {
      this.addTestError(testName, error.message);
    }
  }

  // Helper methods
  async safeImport(moduleName) {
    try {
      const module = await import(moduleName);
      return module.default || module;
    } catch (error) {
      return null;
    }
  }

  async makeLocalRequest(port) {
    return new Promise((resolve, reject) => {
      const http = require('http');
      
      const req = http.request({
        hostname: 'localhost',
        port: port,
        path: '/',
        method: 'GET'
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve(data);
        });
      });
      
      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.end();
    });
  }

  addTestResult(testName, metrics) {
    this.testCount++;
    this.results.tests.push({
      name: testName,
      status: 'passed',
      metrics: metrics,
      timestamp: new Date().toISOString()
    });
    
    this.results.metrics.individual[testName] = metrics;
    console.log(`✅ ${testName} completed in ${Math.round(metrics.duration)}ms`);
  }

  addTestError(testName, error) {
    this.testCount++;
    this.results.tests.push({
      name: testName,
      status: 'failed',
      error: error,
      timestamp: new Date().toISOString()
    });
    
    this.results.errors.push({ test: testName, error: error });
    console.error(`❌ ${testName} failed: ${error}`);
  }

  async generatePerformanceReport() {
    console.log('📊 Generating performance test report...');
    
    const summary = {
      totalTests: this.testCount,
      passedTests: this.results.tests.filter(t => t.status === 'passed').length,
      failedTests: this.results.tests.filter(t => t.status === 'failed').length,
      averageTestTime: this.results.metrics.overall.averageTestTime,
      totalTestTime: this.results.metrics.overall.totalTestTime
    };
    
    const reportData = {
      ...this.results,
      summary: summary
    };
    
    try {
      const reportPath = path.join(process.cwd(), 'reports', `performance-tests-${Date.now()}.json`);
      
      // Create reports directory if it doesn't exist
      const reportsDir = path.dirname(reportPath);
      if (!existsSync(reportsDir)) {
        await import('fs').then(fs => fs.mkdirSync(reportsDir, { recursive: true }));
      }
      
      writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
      console.log(`📄 Performance report saved to: ${reportPath}`);
    } catch (error) {
      console.warn('⚠️  Could not save performance report:', error.message);
    }
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new PerformanceTestSuite();
  testSuite.runAllTests().catch(console.error);
}

export default PerformanceTestSuite;
