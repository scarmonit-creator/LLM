#!/usr/bin/env node
/**
 * Performance Monitoring Script for LLM Framework
 * 
 * This script monitors various performance aspects of the LLM framework:
 * - Build times and execution performance
 * - Memory usage and resource utilization
 * - CI/CD pipeline efficiency
 * - Test execution times
 * - Bundle size analysis
 * 
 * Usage: node scripts/performance-monitor.js [command] [options]
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

// Performance monitoring configuration
const CONFIG = {
  outputDir: './performance-reports',
  metricsFile: 'performance-metrics.json',
  reportFile: 'performance-report.md',
  thresholds: {
    buildTime: 300000, // 5 minutes
    testTime: 180000,  // 3 minutes
    memoryUsage: 1024, // 1GB
    bundleSize: 5 * 1024 * 1024, // 5MB
  }
};

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      timestamp: new Date().toISOString(),
      system: this.getSystemInfo(),
      builds: [],
      tests: [],
      memory: [],
      bundles: []
    };
    
    this.ensureOutputDir();
  }

  getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024), // GB
      freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024),   // GB
    };
  }

  ensureOutputDir() {
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }
  }

  async measureBuildTime(command = 'npm run build') {
    console.log(`📊 Measuring build time for: ${command}`);
    
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    try {
      execSync(command, { stdio: 'pipe' });
      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      
      const buildMetrics = {
        command,
        duration: endTime - startTime,
        memoryDelta: {
          rss: endMemory.rss - startMemory.rss,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal
        },
        success: true,
        timestamp: new Date().toISOString()
      };
      
      this.metrics.builds.push(buildMetrics);
      console.log(`✅ Build completed in ${buildMetrics.duration}ms`);
      
      return buildMetrics;
    } catch (error) {
      const failureMetrics = {
        command,
        duration: Date.now() - startTime,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      this.metrics.builds.push(failureMetrics);
      console.log(`❌ Build failed after ${failureMetrics.duration}ms`);
      
      return failureMetrics;
    }
  }

  async measureTestTime(command = 'npm test') {
    console.log(`🧪 Measuring test time for: ${command}`);
    
    const startTime = Date.now();
    
    try {
      execSync(command, { stdio: 'pipe' });
      const duration = Date.now() - startTime;
      
      const testMetrics = {
        command,
        duration,
        success: true,
        timestamp: new Date().toISOString()
      };
      
      this.metrics.tests.push(testMetrics);
      console.log(`✅ Tests completed in ${duration}ms`);
      
      return testMetrics;
    } catch (error) {
      const duration = Date.now() - startTime;
      const failureMetrics = {
        command,
        duration,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      this.metrics.tests.push(failureMetrics);
      console.log(`❌ Tests failed after ${duration}ms`);
      
      return failureMetrics;
    }
  }

  analyzeBundleSize() {
    console.log(`📦 Analyzing bundle sizes`);
    
    const distPath = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(distPath)) {
      console.log(`⚠️ Dist directory not found at ${distPath}`);
      return null;
    }

    const bundleMetrics = {
      totalSize: 0,
      files: [],
      timestamp: new Date().toISOString()
    };

    const analyzeDirectory = (dirPath, basePath = '') => {
      const files = fs.readdirSync(dirPath);
      
      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const relativePath = path.join(basePath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          analyzeDirectory(filePath, relativePath);
        } else {
          const fileInfo = {
            path: relativePath,
            size: stats.size,
            type: path.extname(file)
          };
          
          bundleMetrics.files.push(fileInfo);
          bundleMetrics.totalSize += stats.size;
        }
      });
    };

    analyzeDirectory(distPath);
    
    // Sort files by size (descending)
    bundleMetrics.files.sort((a, b) => b.size - a.size);
    
    this.metrics.bundles.push(bundleMetrics);
    console.log(`📦 Total bundle size: ${this.formatBytes(bundleMetrics.totalSize)}`);
    
    return bundleMetrics;
  }

  recordMemoryUsage(label = 'current') {
    const memoryUsage = process.memoryUsage();
    const memoryMetrics = {
      label,
      rss: memoryUsage.rss,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers || 0,
      timestamp: new Date().toISOString()
    };
    
    this.metrics.memory.push(memoryMetrics);
    return memoryMetrics;
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Build time recommendations
    const avgBuildTime = this.metrics.builds.reduce((sum, build) => sum + build.duration, 0) / this.metrics.builds.length;
    if (avgBuildTime > CONFIG.thresholds.buildTime) {
      recommendations.push({
        category: 'Build Performance',
        issue: `Average build time (${Math.round(avgBuildTime / 1000)}s) exceeds threshold (${CONFIG.thresholds.buildTime / 1000}s)`,
        suggestions: [
          'Enable TypeScript incremental compilation',
          'Optimize webpack/build configuration',
          'Use build caching strategies',
          'Consider parallel builds for large projects'
        ]
      });
    }

    // Bundle size recommendations
    const latestBundle = this.metrics.bundles[this.metrics.bundles.length - 1];
    if (latestBundle && latestBundle.totalSize > CONFIG.thresholds.bundleSize) {
      recommendations.push({
        category: 'Bundle Size',
        issue: `Bundle size (${this.formatBytes(latestBundle.totalSize)}) exceeds threshold (${this.formatBytes(CONFIG.thresholds.bundleSize)})`,
        suggestions: [
          'Enable tree shaking and dead code elimination',
          'Use dynamic imports for code splitting',
          'Optimize and compress assets',
          'Remove unused dependencies'
        ]
      });
    }

    // Memory usage recommendations
    const maxMemoryUsage = Math.max(...this.metrics.memory.map(m => m.heapUsed));
    if (maxMemoryUsage > CONFIG.thresholds.memoryUsage * 1024 * 1024) {
      recommendations.push({
        category: 'Memory Usage',
        issue: `Peak memory usage (${this.formatBytes(maxMemoryUsage)}) exceeds threshold (${CONFIG.thresholds.memoryUsage}MB)`,
        suggestions: [
          'Optimize memory-intensive operations',
          'Implement proper cleanup and garbage collection',
          'Use streaming for large data processing',
          'Monitor for memory leaks'
        ]
      });
    }

    return recommendations;
  }

  saveMetrics() {
    const metricsPath = path.join(CONFIG.outputDir, CONFIG.metricsFile);
    fs.writeFileSync(metricsPath, JSON.stringify(this.metrics, null, 2));
    console.log(`📊 Metrics saved to ${metricsPath}`);
  }

  generateReport() {
    const recommendations = this.generateRecommendations();
    
    let report = `# Performance Report\n\n`;
    report += `Generated: ${this.metrics.timestamp}\n\n`;
    
    // System information
    report += `## System Information\n\n`;
    report += `- Platform: ${this.metrics.system.platform} (${this.metrics.system.arch})\n`;
    report += `- Node.js: ${this.metrics.system.nodeVersion}\n`;
    report += `- CPUs: ${this.metrics.system.cpus}\n`;
    report += `- Memory: ${this.metrics.system.totalMemory}GB total, ${this.metrics.system.freeMemory}GB free\n\n`;
    
    // Build metrics
    if (this.metrics.builds.length > 0) {
      report += `## Build Performance\n\n`;
      report += `| Command | Duration | Status | Memory Delta |\n`;
      report += `|---------|----------|--------|--------------|\n`;
      
      this.metrics.builds.forEach(build => {
        const memoryDelta = build.memoryDelta ? this.formatBytes(build.memoryDelta.rss) : 'N/A';
        report += `| ${build.command} | ${Math.round(build.duration / 1000)}s | ${build.success ? '✅' : '❌'} | ${memoryDelta} |\n`;
      });
      report += `\n`;
    }
    
    // Test metrics
    if (this.metrics.tests.length > 0) {
      report += `## Test Performance\n\n`;
      report += `| Command | Duration | Status |\n`;
      report += `|---------|----------|--------|\n`;
      
      this.metrics.tests.forEach(test => {
        report += `| ${test.command} | ${Math.round(test.duration / 1000)}s | ${test.success ? '✅' : '❌'} |\n`;
      });
      report += `\n`;
    }
    
    // Bundle analysis
    const latestBundle = this.metrics.bundles[this.metrics.bundles.length - 1];
    if (latestBundle) {
      report += `## Bundle Analysis\n\n`;
      report += `- Total Size: ${this.formatBytes(latestBundle.totalSize)}\n`;
      report += `- Files: ${latestBundle.files.length}\n\n`;
      
      report += `### Largest Files:\n\n`;
      latestBundle.files.slice(0, 10).forEach(file => {
        report += `- ${file.path}: ${this.formatBytes(file.size)}\n`;
      });
      report += `\n`;
    }
    
    // Recommendations
    if (recommendations.length > 0) {
      report += `## Optimization Recommendations\n\n`;
      
      recommendations.forEach(rec => {
        report += `### ${rec.category}\n\n`;
        report += `**Issue:** ${rec.issue}\n\n`;
        report += `**Suggestions:**\n`;
        rec.suggestions.forEach(suggestion => {
          report += `- ${suggestion}\n`;
        });
        report += `\n`;
      });
    }
    
    const reportPath = path.join(CONFIG.outputDir, CONFIG.reportFile);
    fs.writeFileSync(reportPath, report);
    console.log(`📋 Report saved to ${reportPath}`);
    
    return report;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async runFullAnalysis() {
    console.log('🚀 Starting comprehensive performance analysis...');
    
    // Record initial memory
    this.recordMemoryUsage('initial');
    
    // Measure build performance
    await this.measureBuildTime();
    this.recordMemoryUsage('post-build');
    
    // Measure test performance
    await this.measureTestTime();
    this.recordMemoryUsage('post-test');
    
    // Analyze bundle sizes
    this.analyzeBundleSize();
    this.recordMemoryUsage('final');
    
    // Save results
    this.saveMetrics();
    this.generateReport();
    
    console.log('✅ Performance analysis completed!');
    return this.metrics;
  }
}

// CLI Interface
if (require.main === module) {
  const [,, command, ...args] = process.argv;
  const monitor = new PerformanceMonitor();
  
  switch (command) {
    case 'build':
      monitor.measureBuildTime(args[0] || 'npm run build')
        .then(() => {
          monitor.saveMetrics();
          monitor.generateReport();
        });
      break;
      
    case 'test':
      monitor.measureTestTime(args[0] || 'npm test')
        .then(() => {
          monitor.saveMetrics();
          monitor.generateReport();
        });
      break;
      
    case 'bundle':
      monitor.analyzeBundleSize();
      monitor.saveMetrics();
      monitor.generateReport();
      break;
      
    case 'memory':
      monitor.recordMemoryUsage(args[0] || 'manual');
      monitor.saveMetrics();
      break;
      
    case 'full':
    default:
      monitor.runFullAnalysis();
      break;
  }
}

module.exports = PerformanceMonitor;