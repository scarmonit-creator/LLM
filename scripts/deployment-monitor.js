#!/usr/bin/env node

/**
 * 🔍 Priority 1 Deployment Monitor
 * Comprehensive monitoring system for website deployment and performance
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

class DeploymentMonitor {
  constructor() {
    this.domain = 'www.scarmonit.com';
    this.devUrl = 'http://localhost:4322';
    this.healthChecks = [
      { name: 'Homepage', path: '/' },
      { name: '404 Error Page', path: '/nonexistent-page' },
      { name: 'Knowledge Dashboard', path: '/knowledge-dashboard.html' },
      { name: 'API Health', path: '/api/health' }
    ];
    this.results = [];
  }

  async checkUrl(url) {
    return new Promise((resolve) => {
      const start = Date.now();
      const request = https.get(url, (response) => {
        const duration = Date.now() - start;
        resolve({
          status: response.statusCode,
          duration,
          headers: response.headers,
          success: response.statusCode < 400
        });
      }).on('error', (error) => {
        resolve({
          status: 0,
          duration: Date.now() - start,
          error: error.message,
          success: false
        });
      });
      
      // 30 second timeout
      request.setTimeout(30000, () => {
        request.abort();
        resolve({
          status: 0,
          duration: 30000,
          error: 'Timeout',
          success: false
        });
      });
    });
  }

  async performHealthCheck(environment = 'production') {
    console.log(`🔍 Starting deployment health check for ${environment}...`);
    console.log('=' .repeat(60));
    
    const baseUrl = environment === 'production' 
      ? `https://${this.domain}` 
      : this.devUrl;
      
    for (const check of this.healthChecks) {
      const url = `${baseUrl}${check.path}`;
      console.log(`\n🧪 Testing: ${check.name}`);
      console.log(`   URL: ${url}`);
      
      const result = await this.checkUrl(url);
      
      if (result.success) {
        console.log(`   ✅ Status: ${result.status} (${result.duration}ms)`);
        if (result.headers['content-type']) {
          console.log(`   📄 Content-Type: ${result.headers['content-type']}`);
        }
        if (result.headers['cache-control']) {
          console.log(`   🗄️ Cache-Control: ${result.headers['cache-control']}`);
        }
      } else {
        console.log(`   ❌ Failed: ${result.status || 'Network Error'}`);
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
      }
      
      this.results.push({
        check: check.name,
        url,
        ...result
      });
    }
    
    this.generateReport(environment);
  }

  generateReport(environment) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DEPLOYMENT HEALTH REPORT');
    console.log('='.repeat(60));
    
    const successful = this.results.filter(r => r.success).length;
    const total = this.results.length;
    const successRate = ((successful / total) * 100).toFixed(1);
    
    console.log(`🎯 Environment: ${environment.toUpperCase()}`);
    console.log(`✅ Success Rate: ${successful}/${total} (${successRate}%)`);
    
    if (environment === 'production') {
      console.log(`🌐 Domain: ${this.domain}`);
    } else {
      console.log(`🏠 Local URL: ${this.devUrl}`);
    }
    
    console.log('\n📋 Detailed Results:');
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${result.check}: ${result.status} (${result.duration}ms)`);
    });
    
    // Performance analysis
    const avgResponseTime = this.results
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.duration, 0) / successful;
      
    console.log('\n⚡ Performance Analysis:');
    console.log(`   📊 Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
    console.log(`   🎯 Target: <200ms for production`);
    
    if (avgResponseTime < 200) {
      console.log('   🏆 Performance target ACHIEVED!');
    } else {
      console.log('   ⚠️  Performance target not met');
    }
    
    // Save report
    const reportData = {
      environment,
      timestamp: new Date().toISOString(),
      successRate: parseFloat(successRate),
      avgResponseTime: parseFloat(avgResponseTime.toFixed(0)),
      results: this.results
    };
    
    const reportPath = `reports/deployment-health-${environment}-${Date.now()}.json`;
    if (!fs.existsSync('reports')) {
      fs.mkdirSync('reports', { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n📄 Report saved: ${reportPath}`);
    
    // Exit with appropriate code
    if (successRate < 100) {
      console.log('\n❌ Some health checks failed - review required');
      process.exit(1);
    } else {
      console.log('\n🎉 All health checks passed - deployment successful!');
      process.exit(0);
    }
  }

  async monitorContinuous(environment = 'production', intervalMinutes = 5) {
    console.log(`🔄 Starting continuous monitoring (${intervalMinutes} minute intervals)...`);
    
    const monitor = async () => {
      console.log(`\n⏰ ${new Date().toLocaleString()} - Running health check...`);
      await this.performHealthCheck(environment);
    };
    
    // Initial check
    await monitor();
    
    // Continuous monitoring
    setInterval(monitor, intervalMinutes * 60 * 1000);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'check';
  const environment = args[1] || 'production';
  
  const monitor = new DeploymentMonitor();
  
  switch (command) {
    case 'check':
      monitor.performHealthCheck(environment);
      break;
    case 'monitor':
      const interval = parseInt(args[2]) || 5;
      monitor.monitorContinuous(environment, interval);
      break;
    default:
      console.log('Usage: node deployment-monitor.js [check|monitor] [production|development] [interval_minutes]');
      process.exit(1);
  }
}

module.exports = DeploymentMonitor;