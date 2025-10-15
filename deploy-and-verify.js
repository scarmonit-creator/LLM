#!/usr/bin/env node
/**
 * Deployment Automation and Verification Script
 * Deploys optimized LLM server to Fly.io and verifies metrics collection
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

class DeploymentAutomation {
  constructor() {
    this.appName = 'llm-ai-bridge';
    this.baseUrl = `https://${this.appName}.fly.dev`;
    this.deploymentStart = Date.now();
    this.verbose = process.argv.includes('--verbose');
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const icon = {
      info: '📋',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      deploy: '🚀'
    }[level] || '📋';
    
    console.log(`${icon} [${timestamp}] ${message}`);
  }

  async executeCommand(command, description) {
    this.log(`${description}...`, 'info');
    
    try {
      const result = await execAsync(command, { 
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        timeout: 300000 // 5 minute timeout
      });
      
      if (this.verbose && result.stdout) {
        console.log(result.stdout);
      }
      
      if (result.stderr && !result.stderr.includes('warning')) {
        this.log(`Warning: ${result.stderr}`, 'warning');
      }
      
      this.log(`${description} completed`, 'success');
      return result;
    } catch (error) {
      this.log(`${description} failed: ${error.message}`, 'error');
      if (this.verbose) {
        console.error(error.stdout);
        console.error(error.stderr);
      }
      throw error;
    }
  }

  async checkPrerequisites() {
    this.log('Checking deployment prerequisites', 'info');
    
    // Check if fly CLI is available
    try {
      await execAsync('fly version');
      this.log('Fly CLI detected', 'success');
    } catch (error) {
      this.log('Fly CLI not found. Install it: curl -L https://fly.io/install.sh | sh', 'error');
      throw new Error('Fly CLI required for deployment');
    }

    // Check required files
    const requiredFiles = ['package.json', 'server.js', 'Dockerfile', 'fly.toml'];
    for (const file of requiredFiles) {
      try {
        await fs.access(file);
        this.log(`Found: ${file}`, 'success');
      } catch (error) {
        this.log(`Missing required file: ${file}`, 'error');
        throw new Error(`Required file missing: ${file}`);
      }
    }

    // Check Node.js and npm
    const nodeResult = await execAsync('node --version');
    const npmResult = await execAsync('npm --version');
    this.log(`Node.js: ${nodeResult.stdout.trim()}`, 'info');
    this.log(`NPM: ${npmResult.stdout.trim()}`, 'info');
  }

  async prepareDeployment() {
    this.log('Preparing deployment environment', 'info');
    
    // Create optimized environment file
    const envContent = [
      'NODE_ENV=production',
      'PORT=8080',
      'NODE_OPTIONS=--max-old-space-size=400 --gc-interval=100'
    ].join('\n');
    
    await fs.writeFile('.env.production', envContent);
    this.log('Created production environment file', 'success');

    // Build tools if possible
    try {
      await this.executeCommand('npm run build:tools', 'Building development tools');
    } catch (error) {
      this.log('Build tools failed, continuing with mock implementation', 'warning');
    }
  }

  async testLocalStartup() {
    this.log('Testing local server startup', 'info');
    
    return new Promise((resolve, reject) => {
      const server = spawn('npm', ['start'], {
        stdio: this.verbose ? 'inherit' : 'pipe',
        env: { ...process.env, NODE_ENV: 'production' }
      });

      let started = false;
      const timeout = setTimeout(() => {
        if (!started) {
          server.kill();
          reject(new Error('Server startup timeout'));
        }
      }, 15000); // 15 second timeout

      server.stdout?.on('data', (data) => {
        if (data.toString().includes('listening at')) {
          started = true;
          clearTimeout(timeout);
          server.kill();
          this.log('Local server starts successfully', 'success');
          resolve(true);
        }
      });

      server.on('error', (error) => {
        clearTimeout(timeout);
        this.log(`Server startup error: ${error.message}`, 'error');
        reject(error);
      });

      server.on('exit', (code) => {
        clearTimeout(timeout);
        if (!started && code !== 0) {
          reject(new Error(`Server exited with code ${code}`));
        }
      });
    });
  }

  async deployToFly() {
    this.log('Deploying to Fly.io', 'deploy');
    
    // Check if app exists
    let appExists = false;
    try {
      await execAsync(`fly status --app ${this.appName}`);
      appExists = true;
      this.log(`App ${this.appName} exists, updating`, 'info');
    } catch (error) {
      this.log(`App ${this.appName} does not exist, will create`, 'info');
    }

    if (appExists) {
      // Deploy existing app
      await this.executeCommand(
        `fly deploy --app ${this.appName} --strategy rolling`,
        'Deploying application update'
      );
    } else {
      // Create and deploy new app
      await this.executeCommand(
        `fly launch --name ${this.appName} --yes --no-deploy`,
        'Creating new Fly.io application'
      );
      
      await this.executeCommand(
        `fly deploy --app ${this.appName}`,
        'Deploying new application'
      );
    }

    this.log('Deployment completed', 'success');
  }

  async waitForHealth() {
    this.log('Waiting for application health check', 'info');
    
    const maxAttempts = 12; // 2 minutes with 10s intervals
    let attempt = 0;
    
    while (attempt < maxAttempts) {
      try {
        const response = await fetch(`${this.baseUrl}/health`, {
          method: 'GET',
          timeout: 10000
        });
        
        if (response.ok) {
          const data = await response.json();
          this.log(`Health check passed: ${data.status}`, 'success');
          return true;
        }
      } catch (error) {
        // Continue trying
      }
      
      attempt++;
      this.log(`Health check attempt ${attempt}/${maxAttempts}`, 'info');
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    }
    
    throw new Error('Health check failed after maximum attempts');
  }

  async verifyEndpoints() {
    this.log('Verifying application endpoints', 'info');
    
    const endpoints = [
      { path: '/', name: 'Root' },
      { path: '/health', name: 'Health' },
      { path: '/api/status', name: 'Status' },
      { path: '/metrics', name: 'Metrics' },
      { path: '/history', name: 'History' }
    ];

    const results = [];
    
    for (const endpoint of endpoints) {
      try {
        const startTime = Date.now();
        const response = await fetch(`${this.baseUrl}${endpoint.path}`, {
          timeout: 15000
        });
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          this.log(`${endpoint.name} endpoint: OK (${responseTime}ms)`, 'success');
          results.push({ ...endpoint, status: 'OK', responseTime });
        } else {
          this.log(`${endpoint.name} endpoint: ${response.status}`, 'warning');
          results.push({ ...endpoint, status: response.status, responseTime });
        }
      } catch (error) {
        this.log(`${endpoint.name} endpoint: ERROR - ${error.message}`, 'error');
        results.push({ ...endpoint, status: 'ERROR', error: error.message });
      }
    }
    
    return results;
  }

  async validateMetrics() {
    this.log('Validating metrics collection', 'info');
    
    try {
      const response = await fetch(`${this.baseUrl}/metrics`);
      if (!response.ok) {
        throw new Error(`Metrics endpoint returned ${response.status}`);
      }
      
      const metricsText = await response.text();
      
      // Check for essential metrics
      const requiredMetrics = [
        'http_requests_total',
        'memory_usage_bytes',
        'app_uptime_seconds',
        'flyio_deployment_status'
      ];
      
      const missingMetrics = requiredMetrics.filter(metric => 
        !metricsText.includes(metric)
      );
      
      if (missingMetrics.length === 0) {
        this.log('All required metrics are present', 'success');
        return true;
      } else {
        this.log(`Missing metrics: ${missingMetrics.join(', ')}`, 'warning');
        return false;
      }
    } catch (error) {
      this.log(`Metrics validation failed: ${error.message}`, 'error');
      return false;
    }
  }

  async generateReport(endpointResults) {
    const deploymentTime = Math.round((Date.now() - this.deploymentStart) / 1000);
    
    const report = {
      deployment: {
        appName: this.appName,
        url: this.baseUrl,
        deploymentTime: `${deploymentTime}s`,
        timestamp: new Date().toISOString()
      },
      endpoints: endpointResults,
      monitoring: {
        grafanaUrl: 'https://fly-metrics.net/d/fly-app/fly-app?orgId=1308651',
        metricsUrl: `${this.baseUrl}/metrics`,
        healthUrl: `${this.baseUrl}/health`
      },
      commands: {
        logs: `fly logs --app ${this.appName} -f`,
        scale: `fly scale --app ${this.appName} show`,
        status: `fly status --app ${this.appName}`
      }
    };

    await fs.writeFile('deployment-report.json', JSON.stringify(report, null, 2));
    this.log('Deployment report saved to deployment-report.json', 'success');
    
    return report;
  }

  async run() {
    try {
      this.log('🚀 Starting automated deployment and verification', 'deploy');
      
      await this.checkPrerequisites();
      await this.prepareDeployment();
      await this.testLocalStartup();
      await this.deployToFly();
      await this.waitForHealth();
      
      const endpointResults = await this.verifyEndpoints();
      const metricsValid = await this.validateMetrics();
      
      const report = await this.generateReport(endpointResults);
      
      this.log('\n📊 DEPLOYMENT SUMMARY:', 'success');
      this.log(`   App URL: ${this.baseUrl}`, 'info');
      this.log(`   Health: ${this.baseUrl}/health`, 'info');
      this.log(`   Metrics: ${this.baseUrl}/metrics`, 'info');
      this.log(`   Grafana: https://fly-metrics.net/d/fly-app/fly-app?orgId=1308651`, 'info');
      this.log(`   Metrics Valid: ${metricsValid ? 'YES' : 'NO'}`, metricsValid ? 'success' : 'warning');
      
      if (metricsValid) {
        this.log('\n✅ DEPLOYMENT SUCCESSFUL - Metrics should now appear in Grafana!', 'success');
      } else {
        this.log('\n⚠️  DEPLOYMENT COMPLETED - Check metrics configuration', 'warning');
      }
      
      return report;
      
    } catch (error) {
      this.log(`\n❌ DEPLOYMENT FAILED: ${error.message}`, 'error');
      
      // Try to get logs for debugging
      try {
        const logs = await execAsync(`fly logs --app ${this.appName} -n 20`);
        this.log('\n📋 Recent logs:', 'info');
        console.log(logs.stdout);
      } catch (logError) {
        this.log('Could not retrieve logs', 'warning');
      }
      
      throw error;
    }
  }
}

// Run the deployment if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const automation = new DeploymentAutomation();
  
  automation.run()
    .then(() => {
      console.log('\n🎉 Deployment automation completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Deployment automation failed:', error.message);
      process.exit(1);
    });
}

export { DeploymentAutomation };
