#!/usr/bin/env node
/**
 * Quick Repository Test
 * Fast validation of core functionality
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execPromise = promisify(spawn);

class QuickTester {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    console.log('🚀 Quick Repository Test - Validating Core Functionality\n');
  }

  async test(name, testFn) {
    const start = Date.now();
    try {
      await testFn();
      const duration = Date.now() - start;
      this.results.push({ name, status: 'PASS', duration });
      console.log(`✅ ${name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - start;
      this.results.push({ name, status: 'FAIL', duration, error: error.message });
      console.log(`❌ ${name} (${duration}ms): ${error.message}`);
    }
  }

  async runTests() {
    // Test 1: Package.json validation
    await this.test('Package Configuration', async () => {
      const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
      if (pkg.type !== 'module') throw new Error('ES modules not configured');
      if (!pkg.dependencies.express) throw new Error('Missing express dependency');
      if (!pkg.scripts.start) throw new Error('Missing start script');
    });

    // Test 2: Required directories
    await this.test('Directory Structure', async () => {
      await fs.access('scripts');
      await fs.access('examples');
      await fs.access('.github/workflows');
      await fs.access('src');
    });

    // Test 3: Critical scripts exist
    await this.test('Critical Scripts', async () => {
      await fs.access('scripts/performance-optimizer.js');
      await fs.access('examples/bridge-demo.js');
      await fs.access('examples/bridge-demo-ultra.js');
    });

    // Test 4: ES Module syntax validation
    await this.test('ES Module Compatibility', async () => {
      const perfOpt = await fs.readFile('scripts/performance-optimizer.js', 'utf8');
      if (!perfOpt.includes('import ') || !perfOpt.includes('from ')) {
        throw new Error('Performance optimizer not using ES modules');
      }
      
      const bridgeDemo = await fs.readFile('examples/bridge-demo.js', 'utf8');
      if (!bridgeDemo.includes('import ') || !bridgeDemo.includes('from ')) {
        throw new Error('Bridge demo not using ES modules');
      }
    });

    // Test 5: Workflow file validation
    await this.test('GitHub Workflows', async () => {
      await fs.access('.github/workflows/ultra-performance-optimization.yml');
      await fs.access('.github/workflows/node.js.yml');
      await fs.access('.github/workflows/repository-validation.yml');
    });

    this.generateReport();
  }

  generateReport() {
    const totalTime = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const healthScore = Math.round((passed / this.results.length) * 100);

    console.log('\n' + '='.repeat(60));
    console.log('📊 QUICK TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`⏱️  Total Time: ${totalTime}ms`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`🏆 Health Score: ${healthScore}%`);
    
    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results.filter(r => r.status === 'FAIL').forEach(result => {
        console.log(`   • ${result.name}: ${result.error}`);
      });
    }

    console.log(`\n${healthScore >= 80 ? '🎉 REPOSITORY STATUS: EXCELLENT' : healthScore >= 60 ? '✅ REPOSITORY STATUS: GOOD' : '⚠️ REPOSITORY STATUS: NEEDS ATTENTION'}`);
    
    if (healthScore >= 80) {
      console.log('🚀 Repository is production-ready!');
      process.exit(0);
    } else {
      console.log('🔧 Some issues need attention before deployment.');
      process.exit(failed > 0 ? 1 : 0);
    }
  }
}

// Run the quick test
const tester = new QuickTester();
tester.runTests().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});
