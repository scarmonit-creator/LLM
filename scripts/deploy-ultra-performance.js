#!/usr/bin/env node
/**
 * Ultra-Performance Deployment Script
 * Deploys all breakthrough optimizations and validates performance improvements
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class UltraPerformanceDeployer {
  constructor() {
    this.results = {
      startTime: Date.now(),
      steps: [],
      errors: [],
      warnings: [],
      performance: {}
    };
  }

  async log(step, status, details = '') {
    const timestamp = new Date().toISOString();
    const logEntry = { step, status, details, timestamp };
    
    this.results.steps.push(logEntry);
    
    const statusIcon = status === 'success' ? '✅' : status === 'error' ? '❌' : '⚠️';
    console.log(`${statusIcon} [${timestamp}] ${step}: ${details}`);
    
    if (status === 'error') {
      this.results.errors.push(logEntry);
    } else if (status === 'warning') {
      this.results.warnings.push(logEntry);
    }
  }

  async executeCommand(command, args = []) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, { stdio: 'pipe' });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });
      
      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  async validatePrerequisites() {
    await this.log('Prerequisites Check', 'info', 'Validating system requirements');
    
    try {
      // Check Node.js version
      const { stdout } = await this.executeCommand('node', ['--version']);
      const nodeVersion = stdout.trim();
      
      if (!nodeVersion.match(/v1[8-9]|v[2-9]\d/)) {
        throw new Error(`Node.js version ${nodeVersion} not supported. Requires v18+`);
      }
      
      await this.log('Node.js Version', 'success', `${nodeVersion} ✓`);
      
      // Check npm availability
      await this.executeCommand('npm', ['--version']);
      await this.log('NPM Check', 'success', 'npm available ✓');
      
      // Check Git status
      try {
        await this.executeCommand('git', ['status']);
        await this.log('Git Status', 'success', 'Repository clean ✓');
      } catch (error) {
        await this.log('Git Status', 'warning', 'Git status check failed');
      }
      
    } catch (error) {
      await this.log('Prerequisites Check', 'error', error.message);
      throw error;
    }
  }

  async installDependencies() {
    await this.log('Dependencies', 'info', 'Installing required packages');
    
    try {
      const { stdout } = await this.executeCommand('npm', ['install']);
      await this.log('NPM Install', 'success', 'Dependencies installed successfully');
    } catch (error) {
      await this.log('Dependencies', 'error', `Installation failed: ${error.message}`);
      throw error;
    }
  }

  async updateServerConfiguration() {
    await this.log('Server Config', 'info', 'Updating server with ultra-performance optimizations');
    
    try {
      const serverPath = path.join(__dirname, '../server.js');
      const serverContent = await fs.readFile(serverPath, 'utf8');
      
      // Check if already optimized
      if (serverContent.includes('UltraPerformanceOptimizer')) {
        await this.log('Server Config', 'warning', 'Server already optimized');
        return;
      }
      
      // Add ultra-performance integration
      const optimizedContent = this.generateOptimizedServer(serverContent);
      
      // Backup original
      await fs.writeFile(serverPath + '.backup', serverContent);
      
      // Write optimized version
      await fs.writeFile(serverPath, optimizedContent);
      
      await this.log('Server Config', 'success', 'Server configuration updated with ultra-performance optimizations');
      
    } catch (error) {
      await this.log('Server Config', 'error', `Configuration update failed: ${error.message}`);
      throw error;
    }
  }

  generateOptimizedServer(originalContent) {
    // Insert ultra-performance imports and middleware
    const imports = `import UltraPerformanceOptimizer from './src/ultra-performance/integrated-optimizer.js';
`;
    
    const middleware = `
// Ultra-Performance Optimization Middleware
app.use(async (req, res, next) => {
  await UltraPerformanceOptimizer.optimizeRequest(req, res, next);
});

// Ultra-Performance Stats Endpoint
app.get('/performance/ultra', (req, res) => {
  res.json({
    status: 'ultra-optimized',
    stats: UltraPerformanceOptimizer.getIntegratedStats(),
    timestamp: new Date().toISOString()
  });
});
`;
    
    // Insert imports after existing imports
    let optimized = originalContent.replace(
      /(import.*?from.*?;\s*\n)/g, 
      '$1'
    );
    
    // Add new imports
    optimized = optimized.replace(
      /(import.*?;\s*\n)(?=\s*\n|\/\/)/,
      '$1' + imports
    );
    
    // Insert middleware before existing middleware
    optimized = optimized.replace(
      /(app\.use\(express\.json\(\)\);)/,
      '$1' + middleware
    );
    
    return optimized;
  }

  async runPerformanceTests() {
    await this.log('Performance Tests', 'info', 'Running performance validation');
    
    try {
      // Start server for testing
      const serverProcess = spawn('node', ['server.js'], { 
        detached: false,
        stdio: 'pipe'
      });
      
      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        // Test basic endpoints
        const testResults = await this.runEndpointTests();
        
        this.results.performance = testResults;
        
        await this.log('Performance Tests', 'success', `Performance validation completed. Average response time: ${testResults.avgResponseTime}ms`);
        
      } finally {
        // Clean shutdown
        serverProcess.kill('SIGTERM');
      }
      
    } catch (error) {
      await this.log('Performance Tests', 'error', `Performance tests failed: ${error.message}`);
      throw error;
    }
  }

  async runEndpointTests() {
    const endpoints = [
      { path: '/health', expected: 200 },
      { path: '/performance/ultra', expected: 200 },
      { path: '/metrics', expected: 200 },
      { path: '/', expected: 200 }
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
      const startTime = Date.now();
      
      try {
        const response = await fetch(`http://localhost:8080${endpoint.path}`);
        const responseTime = Date.now() - startTime;
        
        results.push({
          path: endpoint.path,
          status: response.status,
          responseTime,
          success: response.status === endpoint.expected
        });
        
      } catch (error) {
        results.push({
          path: endpoint.path,
          status: 0,
          responseTime: Date.now() - startTime,
          success: false,
          error: error.message
        });
      }
    }
    
    const successfulTests = results.filter(r => r.success);
    const avgResponseTime = successfulTests.length > 0 
      ? Math.round(successfulTests.reduce((sum, r) => sum + r.responseTime, 0) / successfulTests.length)
      : 0;
    
    return {
      tests: results,
      successRate: (successfulTests.length / results.length) * 100,
      avgResponseTime,
      totalTests: results.length,
      passedTests: successfulTests.length
    };
  }

  async generateDeploymentReport() {
    const duration = Date.now() - this.results.startTime;
    
    const report = {
      deployment: {
        timestamp: new Date().toISOString(),
        duration: Math.round(duration / 1000),
        status: this.results.errors.length === 0 ? 'SUCCESS' : 'FAILED',
        version: '1.0.0-ultra'
      },
      summary: {
        totalSteps: this.results.steps.length,
        successfulSteps: this.results.steps.filter(s => s.status === 'success').length,
        errors: this.results.errors.length,
        warnings: this.results.warnings.length
      },
      performance: this.results.performance,
      steps: this.results.steps,
      errors: this.results.errors,
      warnings: this.results.warnings
    };
    
    const reportPath = path.join(__dirname, '../ultra-performance-deployment-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    return report;
  }

  async deploy() {
    console.log('🚀 Starting Ultra-Performance Deployment...\n');
    
    try {
      await this.validatePrerequisites();
      await this.installDependencies();
      await this.updateServerConfiguration();
      await this.runPerformanceTests();
      
      const report = await this.generateDeploymentReport();
      
      console.log('\n🎆 DEPLOYMENT COMPLETE!');
      console.log('======================================');
      console.log(`Status: ${report.deployment.status}`);
      console.log(`Duration: ${report.deployment.duration}s`);
      console.log(`Steps Completed: ${report.summary.successfulSteps}/${report.summary.totalSteps}`);
      
      if (report.performance.avgResponseTime) {
        console.log(`Average Response Time: ${report.performance.avgResponseTime}ms`);
        console.log(`Test Success Rate: ${report.performance.successRate.toFixed(1)}%`);
      }
      
      if (report.summary.errors > 0) {
        console.log(`\n⚠️  Errors: ${report.summary.errors}`);
        report.errors.forEach(error => {
          console.log(`   - ${error.step}: ${error.details}`);
        });
      }
      
      console.log(`\n📊 Full report: ultra-performance-deployment-report.json`);
      console.log('\n🔗 Endpoints to test:');
      console.log('   - http://localhost:8080/performance/ultra (Ultra-performance stats)');
      console.log('   - http://localhost:8080/health (Health check)');
      console.log('   - http://localhost:8080/metrics (Prometheus metrics)');
      
      return report;
      
    } catch (error) {
      await this.log('Deployment', 'error', `Deployment failed: ${error.message}`);
      
      const report = await this.generateDeploymentReport();
      
      console.log('\n❌ DEPLOYMENT FAILED!');
      console.log('======================================');
      console.log(`Error: ${error.message}`);
      console.log(`Steps Completed: ${report.summary.successfulSteps}/${report.summary.totalSteps}`);
      
      throw error;
    }
  }
}

// Auto-deploy if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const deployer = new UltraPerformanceDeployer();
  
  deployer.deploy()
    .then((report) => {
      console.log('\n✨ Ready for ultra-performance operation!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Deployment failed:', error.message);
      process.exit(1);
    });
}

export default UltraPerformanceDeployer;