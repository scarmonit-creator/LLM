#!/usr/bin/env node

/**
 * Complete System Optimization Script
 * Provides comprehensive system performance analysis and optimization
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

class CompleteSystemOptimizer {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      optimizations: [],
      metrics: {},
      errors: [],
      warnings: []
    };
  }

  async runOptimization() {
    console.log('🚀 Starting Complete System Optimization...');
    
    try {
      // 1. System Health Check
      await this.systemHealthCheck();
      
      // 2. Performance Analysis
      await this.performanceAnalysis();
      
      // 3. Dependency Optimization
      await this.dependencyOptimization();
      
      // 4. Memory Optimization
      await this.memoryOptimization();
      
      // 5. Build Optimization
      await this.buildOptimization();
      
      // 6. Generate Report
      await this.generateReport();
      
      console.log('✅ Complete System Optimization finished successfully!');
      
    } catch (error) {
      console.error('❌ Optimization failed:', error.message);
      this.results.errors.push(error.message);
      process.exit(1);
    }
  }

  async systemHealthCheck() {
    console.log('📋 Running system health check...');
    
    const checks = {
      nodeVersion: process.version,
      npmVersion: await this.getNpmVersion(),
      memoryUsage: process.memoryUsage(),
      platform: process.platform,
      arch: process.arch
    };
    
    this.results.metrics.systemHealth = checks;
    this.results.optimizations.push('System health check completed');
  }

  async performanceAnalysis() {
    console.log('⚡ Analyzing performance...');
    
    try {
      const startTime = Date.now();
      
      // Test module loading performance
      const moduleLoadTest = await this.testModuleLoading();
      
      // Test file I/O performance
      const ioTest = await this.testFileIO();
      
      const endTime = Date.now();
      
      this.results.metrics.performance = {
        moduleLoading: moduleLoadTest,
        fileIO: ioTest,
        totalAnalysisTime: endTime - startTime
      };
      
      this.results.optimizations.push('Performance analysis completed');
    } catch (error) {
      this.results.warnings.push(`Performance analysis warning: ${error.message}`);
    }
  }

  async dependencyOptimization() {
    console.log('📦 Optimizing dependencies...');
    
    try {
      // Check for outdated packages
      const outdated = await this.checkOutdatedPackages();
      
      // Analyze bundle size
      const bundleAnalysis = await this.analyzeBundleSize();
      
      this.results.metrics.dependencies = {
        outdatedPackages: outdated,
        bundleAnalysis: bundleAnalysis
      };
      
      this.results.optimizations.push('Dependency analysis completed');
    } catch (error) {
      this.results.warnings.push(`Dependency optimization warning: ${error.message}`);
    }
  }

  async memoryOptimization() {
    console.log('🧠 Optimizing memory usage...');
    
    const beforeMemory = process.memoryUsage();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const afterMemory = process.memoryUsage();
    
    this.results.metrics.memory = {
      before: beforeMemory,
      after: afterMemory,
      improvement: {
        heapUsed: beforeMemory.heapUsed - afterMemory.heapUsed,
        heapTotal: beforeMemory.heapTotal - afterMemory.heapTotal
      }
    };
    
    this.results.optimizations.push('Memory optimization completed');
  }

  async buildOptimization() {
    console.log('🔨 Optimizing build process...');
    
    try {
      // Check if TypeScript config exists
      const tsConfig = this.checkTSConfig();
      
      // Check if ESLint config exists
      const eslintConfig = this.checkESLintConfig();
      
      // Check package.json scripts
      const scripts = this.analyzePackageScripts();
      
      this.results.metrics.build = {
        typescript: tsConfig,
        eslint: eslintConfig,
        scripts: scripts
      };
      
      this.results.optimizations.push('Build optimization analysis completed');
    } catch (error) {
      this.results.warnings.push(`Build optimization warning: ${error.message}`);
    }
  }

  async generateReport() {
    console.log('📊 Generating optimization report...');
    
    const reportPath = path.join(process.cwd(), 'reports');
    
    // Create reports directory if it doesn't exist
    if (!existsSync(reportPath)) {
      try {
        execSync(`mkdir -p ${reportPath}`);
      } catch (error) {
        console.warn('Could not create reports directory');
        return;
      }
    }
    
    const reportFile = path.join(reportPath, `system-optimization-${Date.now()}.json`);
    
    try {
      writeFileSync(reportFile, JSON.stringify(this.results, null, 2));
      console.log(`📄 Report saved to: ${reportFile}`);
    } catch (error) {
      console.warn('Could not save report file');
    }
  }

  // Helper methods
  async getNpmVersion() {
    try {
      const { stdout } = await execAsync('npm --version');
      return stdout.trim();
    } catch (error) {
      return 'unknown';
    }
  }

  async testModuleLoading() {
    const start = Date.now();
    try {
      await import('fs');
      await import('path');
      await import('os');
    } catch (error) {
      // Ignore import errors for timing
    }
    return Date.now() - start;
  }

  async testFileIO() {
    const start = Date.now();
    const testFile = path.join(__dirname, 'temp-io-test.txt');
    
    try {
      writeFileSync(testFile, 'test data');
      readFileSync(testFile);
      execSync(`rm -f ${testFile}`);
    } catch (error) {
      // Ignore file I/O errors for timing
    }
    
    return Date.now() - start;
  }

  async checkOutdatedPackages() {
    try {
      const { stdout } = await execAsync('npm outdated --json');
      return JSON.parse(stdout || '{}');
    } catch (error) {
      return {};
    }
  }

  async analyzeBundleSize() {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    
    if (!existsSync(packageJsonPath)) {
      return null;
    }
    
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      return {
        dependencies: Object.keys(packageJson.dependencies || {}).length,
        devDependencies: Object.keys(packageJson.devDependencies || {}).length
      };
    } catch (error) {
      return null;
    }
  }

  checkTSConfig() {
    const tsConfigPath = path.join(process.cwd(), 'tsconfig.json');
    return {
      exists: existsSync(tsConfigPath),
      path: tsConfigPath
    };
  }

  checkESLintConfig() {
    const eslintConfigPath = path.join(process.cwd(), 'eslint.config.js');
    return {
      exists: existsSync(eslintConfigPath),
      path: eslintConfigPath
    };
  }

  analyzePackageScripts() {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    
    if (!existsSync(packageJsonPath)) {
      return null;
    }
    
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      const scripts = packageJson.scripts || {};
      
      return {
        total: Object.keys(scripts).length,
        hasStart: 'start' in scripts,
        hasTest: 'test' in scripts,
        hasBuild: 'build' in scripts,
        hasLint: 'lint' in scripts
      };
    } catch (error) {
      return null;
    }
  }
}

// Run optimization if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const optimizer = new CompleteSystemOptimizer();
  optimizer.runOptimization().catch(console.error);
}

export default CompleteSystemOptimizer;
