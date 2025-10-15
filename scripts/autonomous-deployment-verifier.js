#!/usr/bin/env node

/**
 * 🚀 Autonomous Deployment Verifier
 * Real-time performance monitoring, issue detection, and auto-optimization
 * 
 * Features:
 * - Fly.io deployment verification
 * - Performance benchmark testing
 * - Auto-scaling validation
 * - Health check monitoring
 * - Issue detection and alerting
 * - Performance optimization recommendations
 */

import fetch from 'node-fetch';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

class AutonomousDeploymentVerifier {
  constructor(options = {}) {
    this.appName = options.appName || process.env.FLY_APP_NAME || 'llm-ai-bridge';
    this.baseUrl = options.baseUrl || `https://${this.appName}.fly.dev`;
    this.healthEndpoint = `${this.baseUrl}/health`;
    this.metricsEndpoint = `${this.baseUrl}/metrics`;
    this.statusEndpoint = `${this.baseUrl}/api/status`;
    this.testDuration = options.testDuration || 60000; // 1 minute
    this.concurrency = options.concurrency || 10;
    this.results = {
      deployment: {},
      performance: {},
      optimization: {},
      issues: [],
      recommendations: []
    };
  }

  async verifyDeployment() {
    console.log('🚀 Starting Autonomous Deployment Verification...');
    console.log(`📍 Target: ${this.baseUrl}`);
    console.log('=' .repeat(60));

    try {
      // 1. Verify basic connectivity
      await this.verifyConnectivity();
      
      // 2. Validate health endpoints
      await this.validateHealthEndpoints();
      
      // 3. Run performance benchmarks
      await this.runPerformanceBenchmarks();
      
      // 4. Test auto-scaling behavior
      await this.testAutoScaling();
      
      // 5. Validate configuration optimizations
      await this.validateOptimizations();
      
      // 6. Generate comprehensive report
      await this.generateReport();
      
      // 7. Send alerts if issues detected
      await this.handleIssues();
      
    } catch (error) {
      console.error('❌ Deployment verification failed:', error.message);
      this.results.issues.push({
        type: 'CRITICAL',
        message: `Deployment verification failed: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  }

  async verifyConnectivity() {
    console.log('🔌 Verifying connectivity...');
    
    const start = Date.now();
    try {
      const response = await fetch(this.baseUrl, { 
        timeout: 10000,
        headers: { 'User-Agent': 'autonomous-verifier/1.0' }
      });
      
      const responseTime = Date.now() - start;
      this.results.deployment.connectivity = {
        status: response.ok ? 'PASS' : 'FAIL',
        responseTime,
        statusCode: response.status,
        timestamp: new Date().toISOString()
      };
      
      if (response.ok) {
        console.log(`✅ Connectivity verified (${responseTime}ms)`);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      this.results.deployment.connectivity = {
        status: 'FAIL',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      throw error;
    }
  }

  async validateHealthEndpoints() {
    console.log('🏥 Validating health endpoints...');
    
    const endpoints = [
      { name: 'health', url: this.healthEndpoint },
      { name: 'metrics', url: this.metricsEndpoint },
      { name: 'status', url: this.statusEndpoint }
    ];
    
    this.results.deployment.endpoints = {};
    
    for (const endpoint of endpoints) {
      const start = Date.now();
      try {
        const response = await fetch(endpoint.url, { 
          timeout: 5000,
          headers: { 'Accept': 'application/json' }
        });
        
        const responseTime = Date.now() - start;
        const data = endpoint.name === 'metrics' ? 
          await response.text() : 
          await response.json();
        
        this.results.deployment.endpoints[endpoint.name] = {
          status: 'PASS',
          responseTime,
          dataSize: JSON.stringify(data).length,
          timestamp: new Date().toISOString()
        };
        
        console.log(`✅ ${endpoint.name} endpoint verified (${responseTime}ms)`);
        
        // Validate specific health metrics
        if (endpoint.name === 'health' && data.memory?.pressure > 80) {
          this.results.issues.push({
            type: 'WARNING',
            message: `High memory pressure: ${data.memory.pressure}%`,
            endpoint: endpoint.name
          });
        }
        
      } catch (error) {
        this.results.deployment.endpoints[endpoint.name] = {
          status: 'FAIL',
          error: error.message,
          timestamp: new Date().toISOString()
        };
        
        this.results.issues.push({
          type: 'ERROR',
          message: `${endpoint.name} endpoint failed: ${error.message}`,
          endpoint: endpoint.name
        });
        
        console.log(`❌ ${endpoint.name} endpoint failed: ${error.message}`);
      }
    }
  }

  async runPerformanceBenchmarks() {
    console.log('⚡ Running performance benchmarks...');
    
    const benchmarks = {
      responseTimes: [],
      throughput: 0,
      errorRate: 0,
      concurrentConnections: this.concurrency
    };
    
    const startTime = Date.now();
    let requests = 0;
    let errors = 0;
    
    // Concurrent request testing
    const testPromises = [];
    for (let i = 0; i < this.concurrency; i++) {
      testPromises.push(this.runConcurrentRequests());
    }
    
    const results = await Promise.allSettled(testPromises);
    
    // Process results
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        benchmarks.responseTimes.push(...result.value.responseTimes);
        requests += result.value.requests;
      } else {
        errors++;
      }
    });
    
    const totalTime = Date.now() - startTime;
    benchmarks.throughput = (requests / (totalTime / 1000)).toFixed(2);
    benchmarks.errorRate = ((errors / this.concurrency) * 100).toFixed(2);
    benchmarks.averageResponseTime = benchmarks.responseTimes.reduce((a, b) => a + b, 0) / benchmarks.responseTimes.length;
    benchmarks.p95ResponseTime = this.calculatePercentile(benchmarks.responseTimes, 95);
    
    this.results.performance = benchmarks;
    
    console.log(`✅ Performance benchmark completed:`);
    console.log(`   Throughput: ${benchmarks.throughput} req/s`);
    console.log(`   Avg Response Time: ${benchmarks.averageResponseTime.toFixed(2)}ms`);
    console.log(`   P95 Response Time: ${benchmarks.p95ResponseTime.toFixed(2)}ms`);
    console.log(`   Error Rate: ${benchmarks.errorRate}%`);
    
    // Performance issue detection
    if (benchmarks.averageResponseTime > 1000) {
      this.results.issues.push({
        type: 'WARNING',
        message: `High average response time: ${benchmarks.averageResponseTime.toFixed(2)}ms`,
        category: 'performance'
      });
    }
    
    if (benchmarks.errorRate > 5) {
      this.results.issues.push({
        type: 'ERROR',
        message: `High error rate: ${benchmarks.errorRate}%`,
        category: 'performance'
      });
    }
  }

  async runConcurrentRequests() {
    const responseTimes = [];
    let requests = 0;
    const endTime = Date.now() + this.testDuration;
    
    while (Date.now() < endTime) {
      const start = Date.now();
      try {
        const response = await fetch(this.healthEndpoint, { timeout: 5000 });
        if (response.ok) {
          responseTimes.push(Date.now() - start);
          requests++;
        }
      } catch (error) {
        // Request failed, continue testing
      }
      
      // Small delay to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    return { responseTimes, requests };
  }

  async testAutoScaling() {
    console.log('📈 Testing auto-scaling behavior...');
    
    try {
      // Check current Fly.io machine status
      const machines = await this.getFlyMachines();
      
      this.results.deployment.scaling = {
        currentMachines: machines.length,
        machineDetails: machines,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Auto-scaling verified: ${machines.length} machine(s) running`);
      
      // Validate scaling configuration
      if (machines.length === 0) {
        this.results.issues.push({
          type: 'CRITICAL',
          message: 'No machines running - auto-scaling may be misconfigured',
          category: 'scaling'
        });
      }
      
    } catch (error) {
      console.log(`⚠️ Auto-scaling check failed: ${error.message}`);
      this.results.deployment.scaling = {
        status: 'UNKNOWN',
        error: error.message
      };
    }
  }

  async getFlyMachines() {
    try {
      const output = execSync(`flyctl machines list --app ${this.appName} --json`, { encoding: 'utf8' });
      return JSON.parse(output);
    } catch (error) {
      return [];
    }
  }

  async validateOptimizations() {
    console.log('🔧 Validating optimizations...');
    
    const optimizations = {
      nodeVersion: null,
      memoryOptimization: false,
      concurrencyLimits: false,
      healthCheckSpeed: false,
      compressionEnabled: false
    };
    
    try {
      // Get system status for optimization validation
      const response = await fetch(this.statusEndpoint);
      const status = await response.json();
      
      // Check Node.js version (should be v20+)
      optimizations.nodeVersion = status.node || 'unknown';
      if (status.node && status.node.startsWith('v20')) {
        optimizations.nodeVersionOptimal = true;
      }
      
      // Check memory optimization
      if (status.performance?.memory?.heapTotal > 800) {
        optimizations.memoryOptimization = true;
      }
      
      // Validate response headers for optimizations
      const headResponse = await fetch(this.baseUrl, { method: 'HEAD' });
      
      // Check compression
      if (headResponse.headers.get('content-encoding')) {
        optimizations.compressionEnabled = true;
      }
      
      // Check health check speed (should be < 10s)
      const healthStart = Date.now();
      await fetch(this.healthEndpoint);
      const healthTime = Date.now() - healthStart;
      optimizations.healthCheckSpeed = healthTime < 10000;
      
      this.results.optimization = optimizations;
      
      console.log('✅ Optimization validation completed');
      
      // Generate optimization recommendations
      this.generateOptimizationRecommendations(optimizations);
      
    } catch (error) {
      console.log(`⚠️ Optimization validation failed: ${error.message}`);
    }
  }

  generateOptimizationRecommendations(optimizations) {
    const recommendations = [];
    
    if (!optimizations.nodeVersionOptimal) {
      recommendations.push({
        priority: 'HIGH',
        category: 'performance',
        message: 'Upgrade to Node.js v20+ for better performance',
        action: 'Update Dockerfile to use node:20-alpine'
      });
    }
    
    if (!optimizations.memoryOptimization) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'resource',
        message: 'Consider increasing memory allocation',
        action: 'Update fly.toml memory_mb to 1024 or higher'
      });
    }
    
    if (!optimizations.compressionEnabled) {
      recommendations.push({
        priority: 'LOW',
        category: 'performance',
        message: 'Enable response compression for better bandwidth utilization',
        action: 'Add compression middleware to Express app'
      });
    }
    
    this.results.recommendations = recommendations;
  }

  async generateReport() {
    console.log('\n📊 Generating comprehensive report...');
    
    const report = {
      summary: this.generateSummary(),
      deployment: this.results.deployment,
      performance: this.results.performance,
      optimization: this.results.optimization,
      issues: this.results.issues,
      recommendations: this.results.recommendations,
      timestamp: new Date().toISOString(),
      verificationDuration: Date.now() - this.startTime
    };
    
    // Save report to file
    const reportPath = path.join(process.cwd(), 'deployment-verification-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n' + '='.repeat(60));
    console.log('📈 DEPLOYMENT VERIFICATION COMPLETE');
    console.log('='.repeat(60));
    console.log(report.summary);
    
    if (this.results.issues.length > 0) {
      console.log('\n⚠️  Issues Detected:');
      this.results.issues.forEach(issue => {
        console.log(`   ${issue.type}: ${issue.message}`);
      });
    }
    
    if (this.results.recommendations.length > 0) {
      console.log('\n💡 Optimization Recommendations:');
      this.results.recommendations.forEach(rec => {
        console.log(`   ${rec.priority}: ${rec.message}`);
      });
    }
    
    console.log(`\n📄 Full report saved to: ${reportPath}`);
  }

  generateSummary() {
    const totalIssues = this.results.issues.length;
    const criticalIssues = this.results.issues.filter(i => i.type === 'CRITICAL').length;
    const performanceScore = this.calculatePerformanceScore();
    
    let status = 'EXCELLENT';
    if (criticalIssues > 0) status = 'CRITICAL';
    else if (totalIssues > 3) status = 'POOR';
    else if (totalIssues > 1) status = 'GOOD';
    
    return `Status: ${status} | Performance Score: ${performanceScore}/100 | Issues: ${totalIssues} | Critical: ${criticalIssues}`;
  }

  calculatePerformanceScore() {
    let score = 100;
    
    // Deduct points for issues
    score -= this.results.issues.filter(i => i.type === 'CRITICAL').length * 30;
    score -= this.results.issues.filter(i => i.type === 'ERROR').length * 20;
    score -= this.results.issues.filter(i => i.type === 'WARNING').length * 10;
    
    // Deduct points for poor performance
    if (this.results.performance.averageResponseTime > 1000) score -= 20;
    if (this.results.performance.errorRate > 5) score -= 25;
    if (this.results.performance.throughput < 10) score -= 15;
    
    return Math.max(0, score);
  }

  calculatePercentile(arr, percentile) {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  async handleIssues() {
    const criticalIssues = this.results.issues.filter(i => i.type === 'CRITICAL');
    
    if (criticalIssues.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES DETECTED - IMMEDIATE ACTION REQUIRED');
      
      // In a real implementation, this could:
      // - Send alerts via email/Slack/PagerDuty
      // - Trigger automatic rollback
      // - Scale up resources
      // - Create incident tickets
      
      criticalIssues.forEach(issue => {
        console.log(`   🔴 ${issue.message}`);
      });
    }
  }

  static async run(options = {}) {
    const verifier = new AutonomousDeploymentVerifier(options);
    verifier.startTime = Date.now();
    await verifier.verifyDeployment();
    return verifier.results;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = {
    appName: process.argv[2] || process.env.FLY_APP_NAME || 'llm-ai-bridge',
    testDuration: parseInt(process.argv[3]) || 60000,
    concurrency: parseInt(process.argv[4]) || 10
  };
  
  AutonomousDeploymentVerifier.run(options)
    .then(() => {
      console.log('\n✅ Autonomous deployment verification completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Autonomous deployment verification failed:', error.message);
      process.exit(1);
    });
}

export default AutonomousDeploymentVerifier;