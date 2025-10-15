#!/usr/bin/env node

/**
 * Nitric Deployment Verification Script
 * Tests all deployed endpoints and generates comprehensive report
 */

class DeploymentVerifier {
  constructor() {
    this.domain = 'www.scarmonit.com';
    this.testResults = [];
  }

  async log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  async testEndpoint(url, description) {
    const startTime = Date.now();
    try {
      const response = await fetch(url);
      const responseTime = Date.now() - startTime;
      const success = response.status < 400;
      
      const result = { url, description, status: response.status, success, responseTime };
      this.testResults.push(result);
      
      await this.log(`${success ? '✅' : '❌'} ${description}: ${response.status} (${responseTime}ms)`);
      return result;
    } catch (error) {
      const result = { url, description, success: false, error: error.message };
      this.testResults.push(result);
      await this.log(`❌ ${description}: ${error.message}`);
      return result;
    }
  }

  async runTests() {
    await this.log('🚀 Starting deployment verification...');
    
    const baseUrl = `https://${this.domain}`;
    
    await this.testEndpoint(`${baseUrl}/`, 'Homepage');
    await this.testEndpoint(`${baseUrl}/404-test`, '404 Page');
    await this.testEndpoint(`${baseUrl}/api/llm-ai-bridge/health`, 'API Health');
    await this.testEndpoint(`${baseUrl}/api/llm-ai-bridge/history`, 'History API');
    await this.testEndpoint(`${baseUrl}/api/llm-ai-bridge/metrics`, 'Metrics API');
    
    const successful = this.testResults.filter(r => r.success).length;
    const total = this.testResults.length;
    
    await this.log(`\n🎉 Verification complete: ${successful}/${total} tests passed`);
    
    return { successful, total, results: this.testResults };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  new DeploymentVerifier().runTests();
}