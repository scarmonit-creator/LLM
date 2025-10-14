#!/usr/bin/env node

/**
 * Smoke Test Script for A2A Self-Test Framework
 * Quick validation of core functionality for deployment readiness
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import { spawn } from 'child_process';

const A2A_PORT = process.env.A2A_PORT || 3001;
const BRIDGE_WS_PORT = process.env.BRIDGE_WS_PORT || 8080;
const BASE_URL = `http://localhost:${A2A_PORT}`;
const TIMEOUT = 10000; // 10 second timeout for smoke tests

class SmokeTest {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  async test(name, testFn) {
    console.log(`🔍 Testing: ${name}`);
    try {
      const start = Date.now();
      await Promise.race([
        testFn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), TIMEOUT)
        )
      ]);
      const duration = Date.now() - start;
      console.log(`  ✅ PASSED (${duration}ms)`);
      this.passed++;
      this.tests.push({ name, status: 'PASSED', duration });
    } catch (error) {
      console.log(`  ❌ FAILED: ${error.message}`);
      this.failed++;
      this.tests.push({ name, status: 'FAILED', error: error.message });
    }
  }

  async smokeTestHealthEndpoint() {
    const response = await fetch(`${BASE_URL}/health`, { 
      timeout: 5000,
      headers: { 'User-Agent': 'A2A-SmokeTest/1.0' }
    });
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.status || data.status !== 'healthy') {
      throw new Error('Health endpoint returned unhealthy status');
    }
  }

  async smokeTestBasicMessageRouting() {
    const testMessage = {
      type: 'smoke-test',
      from: 'smoke-test-agent',
      to: 'test-receiver',
      payload: { test: true, timestamp: Date.now() }
    };
    
    const response = await fetch(`${BASE_URL}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMessage),
      timeout: 5000
    });
    
    if (!response.ok) {
      throw new Error(`Message routing failed: ${response.status}`);
    }
    
    const result = await response.json();
    if (!result.delivered) {
      throw new Error('Message was not delivered successfully');
    }
  }

  async smokeTestFileSystemAccess() {
    // Test that required directories exist
    const requiredPaths = [
      'src',
      'tests',
      'scripts',
      '.github/workflows'
    ];
    
    for (const path of requiredPaths) {
      try {
        await fs.access(path);
      } catch (error) {
        throw new Error(`Required path missing: ${path}`);
      }
    }
  }

  async smokeTestPackageIntegrity() {
    try {
      const packageJson = await fs.readFile('package.json', 'utf-8');
      const pkg = JSON.parse(packageJson);
      
      // Verify essential scripts exist
      const requiredScripts = ['test', 'build', 'start'];
      for (const script of requiredScripts) {
        if (!pkg.scripts[script]) {
          throw new Error(`Required npm script missing: ${script}`);
        }
      }
      
      // Verify essential dependencies
      const requiredDeps = ['express', 'ws', '@anthropic-ai/sdk'];
      for (const dep of requiredDeps) {
        if (!pkg.dependencies[dep]) {
          throw new Error(`Required dependency missing: ${dep}`);
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('package.json not found');
      }
      throw error;
    }
  }

  async smokeTestNodeModules() {
    try {
      await fs.access('node_modules');
      
      // Check for key modules
      const keyModules = ['express', 'ws', '@anthropic-ai/sdk'];
      for (const module of keyModules) {
        await fs.access(`node_modules/${module}`);
      }
    } catch (error) {
      throw new Error('Node modules not properly installed');
    }
  }

  async smokeTestEnvironmentVariables() {
    // Check for required environment setup
    const requiredEnv = ['NODE_ENV'];
    
    for (const envVar of requiredEnv) {
      if (!process.env[envVar]) {
        console.log(`⚠️  Warning: ${envVar} not set`);
      }
    }
    
    // Validate Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 16) {
      throw new Error(`Node.js version ${nodeVersion} is too old. Requires v16+`);
    }
  }

  generateReport() {
    const total = this.passed + this.failed;
    const successRate = total > 0 ? (this.passed / total) * 100 : 0;
    
    return {
      timestamp: new Date().toISOString(),
      testType: 'smoke-test',
      summary: {
        total,
        passed: this.passed,
        failed: this.failed,
        successRate: parseFloat(successRate.toFixed(2))
      },
      tests: this.tests,
      deploymentReady: this.failed === 0,
      framework: 'A2A Self-Test Framework'
    };
  }
}

async function runSmokeTests() {
  console.log('💨 Running A2A Framework Smoke Tests...');
  console.log('==========================================');
  
  const smokeTest = new SmokeTest();
  
  // Core infrastructure tests (always run)
  await smokeTest.test('File System Access', () => smokeTest.smokeTestFileSystemAccess());
  await smokeTest.test('Package Integrity', () => smokeTest.smokeTestPackageIntegrity());
  await smokeTest.test('Node Modules', () => smokeTest.smokeTestNodeModules());
  await smokeTest.test('Environment Variables', () => smokeTest.smokeTestEnvironmentVariables());
  
  // Service-dependent tests (graceful failure)
  try {
    await smokeTest.test('Health Endpoint', () => smokeTest.smokeTestHealthEndpoint());
    await smokeTest.test('Message Routing', () => smokeTest.smokeTestBasicMessageRouting());
  } catch (error) {
    console.log('⚠️  Service-dependent tests skipped (services may not be running)');
  }
  
  // Generate report
  const report = smokeTest.generateReport();
  
  console.log('\n==========================================');
  console.log('📈 Smoke Test Results:');
  console.log(`   Total Tests: ${report.summary.total}`);
  console.log(`   Passed: ${report.summary.passed}`);
  console.log(`   Failed: ${report.summary.failed}`);
  console.log(`   Success Rate: ${report.summary.successRate}%`);
  console.log(`   Deployment Ready: ${report.deploymentReady ? '✅ YES' : '❌ NO'}`);
  
  // Save report
  try {
    await fs.writeFile('smoke-test-report.json', JSON.stringify(report, null, 2));
    console.log('📊 Smoke test report saved to smoke-test-report.json');
  } catch (error) {
    console.log('⚠️  Could not save smoke test report');
  }
  
  // Exit with appropriate code
  process.exit(report.deploymentReady ? 0 : 1);
}

// Run smoke tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSmokeTests().catch((error) => {
    console.error('❌ Smoke tests failed to run:', error.message);
    process.exit(1);
  });
}

export { SmokeTest };
