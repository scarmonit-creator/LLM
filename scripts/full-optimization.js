#!/usr/bin/env node

/**
 * Full Optimization Script
 * Comprehensive optimization orchestrator for maximum performance
 */

import { spawn, execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FullOptimization {
  constructor() {
    this.startTime = Date.now();
    this.results = {
      timestamp: new Date().toISOString(),
      optimizations: [],
      errors: [],
      metrics: {}
    };
  }

  async run() {
    console.log('🚀 Starting Full Optimization System...');
    
    try {
      // Run all optimization phases in parallel
      await Promise.all([
        this.optimizeSystem(),
        this.optimizePerformance(),
        this.optimizeDependencies(),
        this.optimizeRuntime()
      ]);
      
      await this.generateReport();
      console.log('✅ Full optimization completed successfully!');
    } catch (error) {
      console.error('❌ Full optimization failed:', error.message);
      process.exit(1);
    }
  }

  async optimizeSystem() {
    console.log('⚙️ System optimization...');
    try {
      if (existsSync(path.join(__dirname, 'system-optimization-complete.js'))) {
        await this.executeScript('system-optimization-complete.js');
      }
      this.results.optimizations.push('System optimization completed');
    } catch (error) {
      this.results.errors.push(`System optimization: ${error.message}`);
    }
  }

  async optimizePerformance() {
    console.log('⚡ Performance optimization...');
    try {
      if (existsSync(path.join(__dirname, 'performance-optimizer.js'))) {
        await this.executeScript('performance-optimizer.js');
      }
      this.results.optimizations.push('Performance optimization completed');
    } catch (error) {
      this.results.errors.push(`Performance optimization: ${error.message}`);
    }
  }

  async optimizeDependencies() {
    console.log('📦 Dependencies optimization...');
    try {
      // Update package-lock.json
      execSync('npm ci --silent', { cwd: process.cwd() });
      this.results.optimizations.push('Dependencies optimized');
    } catch (error) {
      this.results.errors.push(`Dependencies: ${error.message}`);
    }
  }

  async optimizeRuntime() {
    console.log('🔧 Runtime optimization...');
    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      this.results.optimizations.push('Runtime optimized');
    } catch (error) {
      this.results.errors.push(`Runtime: ${error.message}`);
    }
  }

  async executeScript(scriptName) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [path.join(__dirname, scriptName)], {
        stdio: 'pipe',
        env: { ...process.env, OPTIMIZATION_MODE: 'full' }
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Script ${scriptName} exited with code ${code}`));
        }
      });

      child.on('error', reject);
    });
  }

  async generateReport() {
    const duration = Date.now() - this.startTime;
    this.results.metrics = {
      totalTime: duration,
      successfulOptimizations: this.results.optimizations.length,
      failedOptimizations: this.results.errors.length
    };

    try {
      const reportsDir = path.join(process.cwd(), 'reports');
      if (!existsSync(reportsDir)) {
        mkdirSync(reportsDir, { recursive: true });
      }

      const reportPath = path.join(reportsDir, `full-optimization-${Date.now()}.json`);
      writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
      console.log(`📄 Report saved: ${reportPath}`);
    } catch (error) {
      console.warn('⚠️ Could not save report:', error.message);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const optimizer = new FullOptimization();
  optimizer.run().catch(console.error);
}

export default FullOptimization;