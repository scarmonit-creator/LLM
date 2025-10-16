#!/usr/bin/env node

/**
 * Health Check Script for LLM Framework
 * Validates system health, performance metrics, and optimization status
 */

import { performance } from 'perf_hooks';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

class HealthChecker {
  constructor() {
    this.startTime = performance.now();
    this.results = {
      status: 'healthy',
      checks: {},
      performance: {},
      timestamp: new Date().toISOString()
    };
  }

  async checkDependencies() {
    try {
      const packagePath = join(rootDir, 'package.json');
      if (!existsSync(packagePath)) {
        throw new Error('package.json not found');
      }

      const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
      const requiredDeps = ['express', 'dotenv', 'cors', 'winston'];
      const missingDeps = requiredDeps.filter(dep => !pkg.dependencies[dep]);

      this.results.checks.dependencies = {
        status: missingDeps.length === 0 ? 'pass' : 'warn',
        missing: missingDeps,
        total: Object.keys(pkg.dependencies).length
      };
    } catch (error) {
      this.results.checks.dependencies = {
        status: 'fail',
        error: error.message
      };
    }
  }

  async checkMemory() {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);

    this.results.checks.memory = {
      status: heapUsedMB < 100 ? 'pass' : heapUsedMB < 200 ? 'warn' : 'fail',
      heapUsedMB,
      heapTotalMB,
      usage: `${heapUsedMB}/${heapTotalMB}MB`
    };

    this.results.performance.memory = {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss
    };
  }

  async checkFileSystem() {
    const criticalPaths = [
      'package.json',
      'server.js',
      'src',
      '.github/workflows'
    ];

    const missing = criticalPaths.filter(path => !existsSync(join(rootDir, path)));
    
    this.results.checks.filesystem = {
      status: missing.length === 0 ? 'pass' : 'warn',
      missing,
      checked: criticalPaths.length
    };
  }

  async checkEnvironment() {
    const nodeVersion = process.version;
    const platform = process.platform;
    const arch = process.arch;

    this.results.checks.environment = {
      status: 'pass',
      nodeVersion,
      platform,
      arch,
      uptime: Math.round(process.uptime())
    };
  }

  async checkOptimizationSystems() {
    try {
      const optimizationFiles = [
        'scripts/performance-optimizer.js',
        'examples/bridge-demo-ultra.js',
        '.github/workflows/ultra-performance-optimization.yml'
      ];

      const available = optimizationFiles.filter(file => existsSync(join(rootDir, file)));
      
      this.results.checks.optimization = {
        status: available.length >= 2 ? 'pass' : 'warn',
        available: available.length,
        total: optimizationFiles.length,
        systems: available
      };
    } catch (error) {
      this.results.checks.optimization = {
        status: 'fail',
        error: error.message
      };
    }
  }

  calculateOverallHealth() {
    const checks = Object.values(this.results.checks);
    const failCount = checks.filter(check => check.status === 'fail').length;
    const warnCount = checks.filter(check => check.status === 'warn').length;
    const passCount = checks.filter(check => check.status === 'pass').length;

    if (failCount > 0) {
      this.results.status = 'unhealthy';
    } else if (warnCount > 1) {
      this.results.status = 'degraded';
    } else {
      this.results.status = 'healthy';
    }

    this.results.summary = {
      total: checks.length,
      pass: passCount,
      warn: warnCount,
      fail: failCount,
      score: Math.round(((passCount + warnCount * 0.5) / checks.length) * 100)
    };
  }

  async run() {
    console.log('🏥 Running LLM Framework Health Check...');
    
    await this.checkDependencies();
    await this.checkMemory();
    await this.checkFileSystem();
    await this.checkEnvironment();
    await this.checkOptimizationSystems();
    
    this.calculateOverallHealth();
    
    const endTime = performance.now();
    this.results.performance.checkDuration = Math.round(endTime - this.startTime);
    
    return this.results;
  }

  formatOutput(results) {
    const { status, summary, checks } = results;
    const statusIcon = {
      healthy: '✅',
      degraded: '⚠️',
      unhealthy: '❌'
    }[status];

    console.log(`\n${statusIcon} Overall Health: ${status.toUpperCase()}`);
    console.log(`📊 Score: ${summary.score}% (${summary.pass}✅ ${summary.warn}⚠️ ${summary.fail}❌)`);
    console.log(`⏱️  Check Duration: ${results.performance.checkDuration}ms`);
    
    console.log('\n📋 Detailed Results:');
    Object.entries(checks).forEach(([name, check]) => {
      const icon = { pass: '✅', warn: '⚠️', fail: '❌' }[check.status];
      console.log(`  ${icon} ${name}: ${check.status}`);
      
      if (check.error) {
        console.log(`    Error: ${check.error}`);
      }
      if (check.missing && check.missing.length > 0) {
        console.log(`    Missing: ${check.missing.join(', ')}`);
      }
      if (check.usage) {
        console.log(`    Usage: ${check.usage}`);
      }
    });

    if (results.performance.memory) {
      const memMB = Math.round(results.performance.memory.heapUsed / 1024 / 1024);
      console.log(`\n💾 Memory Usage: ${memMB}MB`);
    }

    return status === 'healthy' ? 0 : status === 'degraded' ? 1 : 2;
  }
}

// Run health check if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const checker = new HealthChecker();
  
  try {
    const results = await checker.run();
    const exitCode = checker.formatOutput(results);
    
    // Output JSON for CI/CD consumption
    if (process.argv.includes('--json')) {
      console.log('\n📄 JSON Output:');
      console.log(JSON.stringify(results, null, 2));
    }
    
    process.exit(exitCode);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    process.exit(2);
  }
}

export default HealthChecker;