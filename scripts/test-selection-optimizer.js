#!/usr/bin/env node
// Autonomous Text Selection Optimizer Testing Suite
// Comprehensive end-to-end testing and validation

import fetch from 'node-fetch';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:3000';
const TEST_TIMEOUT = 30000; // 30 seconds

// Test data samples
const testCases = [
  {
    name: 'Code Selection',
    text: 'function processData(input) {\n  const result = input.map(item => item.value);\n  return result.filter(val => val > 0);\n}',
    expectedType: 'code',
    url: 'https://github.com/example/repo',
    domain: 'github.com'
  },
  {
    name: 'Documentation Text',
    text: 'Installation Guide: To install this package, run npm install example-package. This will download and configure all necessary dependencies for your project.',
    expectedType: 'documentation',
    url: 'https://docs.example.com/install',
    domain: 'docs.example.com'
  },
  {
    name: 'Article Content',
    text: 'The future of artificial intelligence looks promising. Recent advances in machine learning have enabled breakthrough capabilities in natural language processing. These developments are reshaping how we interact with technology.',
    expectedType: 'article',
    url: 'https://blog.example.com/ai-future',
    domain: 'blog.example.com'
  },
  {
    name: 'Technical Content',
    text: 'The REST API endpoint accepts JSON payloads and returns HTTP status codes. Authentication requires a valid API key in the Authorization header.',
    expectedType: 'technical',
    url: 'https://api.example.com/docs',
    domain: 'api.example.com'
  },
  {
    name: 'Short Selection',
    text: 'Hello world',
    expectedType: 'general',
    url: 'https://example.com',
    domain: 'example.com'
  }
];

// Test runner class
class SelectionOptimizerTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
    this.serverProcess = null;
  }

  async runAllTests() {
    console.log('🚀 Starting Text Selection Optimizer Test Suite');
    console.log('=' * 60);

    try {
      // Start server if not running
      await this.ensureServerRunning();
      
      // Run health check
      await this.testHealthEndpoint();
      
      // Test main functionality
      for (const testCase of testCases) {
        await this.runTestCase(testCase);
      }
      
      // Test edge cases
      await this.testEdgeCases();
      
      // Test metrics endpoint
      await this.testMetricsEndpoint();
      
      // Performance testing
      await this.runPerformanceTests();
      
      this.printResults();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  async ensureServerRunning() {
    console.log('🔍 Checking server status...');
    
    try {
      const response = await fetch(`${API_BASE}/api/health/selection`, {
        timeout: 5000
      });
      
      if (response.ok) {
        console.log('✅ Server is already running');
        return;
      }
    } catch (error) {
      console.log('⚡ Starting server...');
    }
    
    // Start server in background
    this.serverProcess = spawn('node', ['server-selection-optimizer.js'], {
      stdio: 'pipe',
      detached: true
    });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify server started
    try {
      const response = await fetch(`${API_BASE}/api/health/selection`);
      if (response.ok) {
        console.log('✅ Server started successfully');
      } else {
        throw new Error('Server failed to start properly');
      }
    } catch (error) {
      throw new Error(`Failed to start server: ${error.message}`);
    }
  }

  async testHealthEndpoint() {
    console.log('\n🏥 Testing health endpoint...');
    
    try {
      const response = await fetch(`${API_BASE}/api/health/selection`);
      const data = await response.json();
      
      this.assert(response.ok, 'Health endpoint should return 200');
      this.assert(data.status === 'healthy', 'Status should be healthy');
      this.assert(data.service === 'selection-optimizer', 'Service name should match');
      this.assert(typeof data.uptime === 'number', 'Uptime should be a number');
      
      console.log('✅ Health endpoint test passed');
      this.recordResult('Health Endpoint', true);
      
    } catch (error) {
      console.log('❌ Health endpoint test failed:', error.message);
      this.recordResult('Health Endpoint', false, error.message);
    }
  }

  async runTestCase(testCase) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    
    try {
      const payload = {
        text: testCase.text,
        url: testCase.url,
        domain: testCase.domain,
        title: `Test Page - ${testCase.name}`,
        wordCount: testCase.text.split(/\s+/).length,
        characterCount: testCase.text.length,
        context: {
          tagName: 'div',
          className: 'test-content',
          parentTag: 'body'
        }
      };
      
      const response = await fetch(`${API_BASE}/api/ingest/selection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        timeout: TEST_TIMEOUT
      });
      
      const data = await response.json();
      
      // Basic response validation
      this.assert(response.ok, 'Response should be successful');
      this.assert(data.ok === true, 'Response ok field should be true');
      this.assert(data.requestId, 'Response should include requestId');
      this.assert(data.result, 'Response should include result');
      
      // Content analysis validation
      const result = data.result;
      this.assert(result.analysis, 'Result should include analysis');
      this.assert(result.analysis.classification, 'Analysis should include classification');
      
      // Check expected content type
      if (testCase.expectedType !== 'general') {
        const detectedType = result.analysis.classification.type;
        this.assert(
          detectedType === testCase.expectedType || 
          result.analysis.classification.indicators.includes(testCase.expectedType),
          `Should detect content type as ${testCase.expectedType}, got ${detectedType}`
        );
      }
      
      // Validate structure
      this.assert(Array.isArray(result.optimizations), 'Optimizations should be array');
      this.assert(Array.isArray(result.recommendations), 'Recommendations should be array');
      this.assert(result.metrics, 'Should include metrics');
      
      console.log(`✅ ${testCase.name} test passed`);
      console.log(`   Classification: ${result.analysis.classification.type}`);
      console.log(`   Optimizations: ${result.optimizations.length}`);
      console.log(`   Recommendations: ${result.recommendations.length}`);
      
      this.recordResult(testCase.name, true);
      
    } catch (error) {
      console.log(`❌ ${testCase.name} test failed:`, error.message);
      this.recordResult(testCase.name, false, error.message);
    }
  }

  async testEdgeCases() {
    console.log('\n🔬 Testing edge cases...');
    
    const edgeCases = [
      {
        name: 'Empty Text',
        payload: { text: '', url: 'https://example.com' },
        expectError: true
      },
      {
        name: 'Very Long Text',
        payload: {
          text: 'Lorem ipsum '.repeat(1000),
          url: 'https://example.com'
        },
        expectError: false
      },
      {
        name: 'Special Characters',
        payload: {
          text: 'Text with émojis 🚀 and spëcial çharactërs',
          url: 'https://example.com'
        },
        expectError: false
      },
      {
        name: 'No URL',
        payload: {
          text: 'Text without URL'
        },
        expectError: false
      }
    ];
    
    for (const edgeCase of edgeCases) {
      try {
        const response = await fetch(`${API_BASE}/api/ingest/selection`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(edgeCase.payload)
        });
        
        const data = await response.json();
        
        if (edgeCase.expectError) {
          this.assert(!response.ok, `${edgeCase.name} should return error`);
          this.assert(data.ok === false, `${edgeCase.name} should have ok: false`);
        } else {
          this.assert(response.ok, `${edgeCase.name} should succeed`);
          this.assert(data.ok === true, `${edgeCase.name} should have ok: true`);
        }
        
        console.log(`✅ Edge case '${edgeCase.name}' handled correctly`);
        this.recordResult(`Edge: ${edgeCase.name}`, true);
        
      } catch (error) {
        console.log(`❌ Edge case '${edgeCase.name}' failed:`, error.message);
        this.recordResult(`Edge: ${edgeCase.name}`, false, error.message);
      }
    }
  }

  async testMetricsEndpoint() {
    console.log('\n📊 Testing metrics endpoint...');
    
    try {
      const response = await fetch(`${API_BASE}/api/metrics/selection`);
      const data = await response.json();
      
      this.assert(response.ok, 'Metrics endpoint should return 200');
      this.assert(typeof data.totalRequests === 'number', 'Should include totalRequests');
      this.assert(typeof data.successfulProcessing === 'number', 'Should include successfulProcessing');
      this.assert(typeof data.avgProcessingTime === 'number', 'Should include avgProcessingTime');
      this.assert(Array.isArray(data.topDomains), 'Should include topDomains array');
      this.assert(typeof data.successRate === 'string', 'Should include successRate');
      
      console.log('✅ Metrics endpoint test passed');
      console.log(`   Total Requests: ${data.totalRequests}`);
      console.log(`   Success Rate: ${data.successRate}`);
      console.log(`   Avg Processing Time: ${data.avgProcessingTime.toFixed(2)}ms`);
      
      this.recordResult('Metrics Endpoint', true);
      
    } catch (error) {
      console.log('❌ Metrics endpoint test failed:', error.message);
      this.recordResult('Metrics Endpoint', false, error.message);
    }
  }

  async runPerformanceTests() {
    console.log('\n⚡ Running performance tests...');
    
    const testText = 'This is a test text for performance measurement. '.repeat(50);
    const iterations = 10;
    const times = [];
    
    try {
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        const response = await fetch(`${API_BASE}/api/ingest/selection`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: testText,
            url: 'https://performance-test.com'
          })
        });
        
        const data = await response.json();
        const endTime = Date.now();
        
        this.assert(response.ok, 'Performance test request should succeed');
        times.push(endTime - startTime);
      }
      
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      console.log(`✅ Performance test completed`);
      console.log(`   Average: ${avgTime.toFixed(2)}ms`);
      console.log(`   Min: ${minTime}ms`);
      console.log(`   Max: ${maxTime}ms`);
      
      // Performance assertions
      this.assert(avgTime < 1000, 'Average response time should be under 1 second');
      this.assert(maxTime < 2000, 'Max response time should be under 2 seconds');
      
      this.recordResult('Performance Test', true);
      
    } catch (error) {
      console.log('❌ Performance test failed:', error.message);
      this.recordResult('Performance Test', false, error.message);
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  recordResult(testName, passed, error = null) {
    this.results.total++;
    if (passed) {
      this.results.passed++;
    } else {
      this.results.failed++;
    }
    
    this.results.details.push({
      name: testName,
      passed,
      error: error || null,
      timestamp: new Date().toISOString()
    });
  }

  printResults() {
    console.log('\n' + '=' * 60);
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('=' * 60);
    
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed} ✅`);
    console.log(`Failed: ${this.results.failed} ❌`);
    console.log(`Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(2)}%`);
    
    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.details
        .filter(result => !result.passed)
        .forEach(result => {
          console.log(`   • ${result.name}: ${result.error}`);
        });
    }
    
    console.log('\n' + '=' * 60);
    
    if (this.results.failed === 0) {
      console.log('🎉 All tests passed! System is ready for deployment.');
      this.generateDeploymentReport();
    } else {
      console.log('⚠️  Some tests failed. Please review and fix issues before deployment.');
      process.exit(1);
    }
  }

  generateDeploymentReport() {
    const report = {
      testRun: {
        timestamp: new Date().toISOString(),
        totalTests: this.results.total,
        passed: this.results.passed,
        failed: this.results.failed,
        successRate: ((this.results.passed / this.results.total) * 100).toFixed(2) + '%'
      },
      systemStatus: 'READY FOR DEPLOYMENT',
      recommendations: [
        'Deploy Chrome extension to test environment',
        'Verify server endpoints are accessible',
        'Monitor performance metrics after deployment',
        'Set up production logging and monitoring'
      ],
      nextSteps: [
        'Load Chrome extension in browser',
        'Test on various websites',
        'Verify end-to-end functionality',
        'Document any production-specific configurations'
      ]
    };
    
    // Save report to file
    const reportPath = './test-results-selection-optimizer.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📋 Detailed test report saved to: ${reportPath}`);
  }

  cleanup() {
    if (this.serverProcess) {
      console.log('🧹 Cleaning up server process...');
      this.serverProcess.kill();
    }
  }
}

// Main execution
const tester = new SelectionOptimizerTester();

process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  tester.cleanup();
  process.exit(0);
});

process.on('exit', () => {
  tester.cleanup();
});

// Run tests
tester.runAllTests().catch(error => {
  console.error('💥 Test suite crashed:', error);
  tester.cleanup();
  process.exit(1);
});