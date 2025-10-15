#!/usr/bin/env node

/**
 * 🐍 Python Integration Manager
 * Seamless coordination between Node.js and Python services
 * Manages admin dashboard, async optimization, and search engine
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

class PythonIntegrationManager {
  constructor() {
    this.services = {
      admin_dashboard: {
        port: 8501,
        command: 'streamlit run src/admin/streamlit-dashboard.py --server.port 8501 --server.address 0.0.0.0',
        health_path: '/health',
        status: 'stopped',
        process: null
      },
      fastapi_server: {
        port: 8081,
        command: 'python3 src/api/fastapi-server.py',
        health_path: '/health',
        status: 'stopped',
        process: null
      },
      async_optimizer: {
        port: null, // Background service
        command: 'python3 src/optimization/async-service.py',
        health_path: null,
        status: 'stopped',
        process: null
      },
      search_engine: {
        port: null, // Embedded service
        command: 'python3 src/search/whoosh-engine.py index',
        health_path: null,
        status: 'stopped',
        process: null
      }
    };
    
    this.mainNodeServer = {
      port: 8080,
      status: 'unknown'
    };
    
    this.monitoring = {
      enabled: false,
      interval: null,
      stats: {}
    };
  }

  async checkPythonDependencies() {
    console.log('🐍 Checking Python dependencies...');
    
    return new Promise((resolve) => {
      exec('python3 --version && pip3 list | grep -E "streamlit|fastapi|uvloop|whoosh|psutil"', (error, stdout, stderr) => {
        if (error) {
          console.log('⚠️  Python dependencies not fully installed');
          console.log('📍 Run: npm run python:install');
          resolve(false);
        } else {
          console.log('✅ Python dependencies verified');
          resolve(true);
        }
      });
    });
  }

  async installPythonDependencies() {
    console.log('📦 Installing Python dependencies...');
    
    return new Promise((resolve, reject) => {
      const install = spawn('pip3', ['install', '-r', 'requirements.txt', '--upgrade'], {
        stdio: 'inherit'
      });
      
      install.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Python dependencies installed successfully');
          resolve(true);
        } else {
          console.log('❌ Python dependency installation failed');
          reject(new Error(`Installation failed with code ${code}`));
        }
      });
    });
  }

  async startService(serviceName) {
    const service = this.services[serviceName];
    if (!service) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    if (service.status === 'running') {
      console.log(`⚠️  Service ${serviceName} is already running`);
      return;
    }

    console.log(`🚀 Starting ${serviceName}...`);
    
    const [command, ...args] = service.command.split(' ');
    
    const process = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });
    
    service.process = process;
    service.status = 'starting';
    
    // Handle process output
    process.stdout.on('data', (data) => {
      console.log(`[${serviceName}] ${data.toString().trim()}`);
    });
    
    process.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (!output.includes('WARNING') && !output.includes('INFO')) {
        console.error(`[${serviceName}] ERROR: ${output}`);
      }
    });
    
    process.on('close', (code) => {
      console.log(`🛑 Service ${serviceName} exited with code ${code}`);
      service.status = 'stopped';
      service.process = null;
    });
    
    process.on('error', (error) => {
      console.error(`❌ Service ${serviceName} error: ${error.message}`);
      service.status = 'error';
      service.process = null;
    });
    
    // Wait for service to be ready
    await this.waitForService(serviceName);
  }

  async waitForService(serviceName, maxWaitTime = 30000) {
    const service = this.services[serviceName];
    const startTime = Date.now();
    
    // Services without health endpoints are considered ready after short delay
    if (!service.port || !service.health_path) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      service.status = 'running';
      console.log(`✅ Service ${serviceName} started`);
      return;
    }
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await this.makeRequest(`http://localhost:${service.port}${service.health_path}`);
        if (response.statusCode === 200) {
          service.status = 'running';
          console.log(`✅ Service ${serviceName} is ready on port ${service.port}`);
          return;
        }
      } catch (error) {
        // Service not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    service.status = 'timeout';
    throw new Error(`Service ${serviceName} did not become ready within ${maxWaitTime}ms`);
  }

  async stopService(serviceName) {
    const service = this.services[serviceName];
    if (!service || !service.process) {
      console.log(`⚠️  Service ${serviceName} is not running`);
      return;
    }

    console.log(`🛑 Stopping ${serviceName}...`);
    
    // Send SIGTERM for graceful shutdown
    service.process.kill('SIGTERM');
    
    // Wait for graceful shutdown
    await new Promise(resolve => {
      const timeout = setTimeout(() => {
        console.log(`⚠️  Force killing ${serviceName}`);
        service.process.kill('SIGKILL');
        resolve();
      }, 5000);
      
      service.process.on('close', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    
    service.status = 'stopped';
    service.process = null;
    console.log(`✅ Service ${serviceName} stopped`);
  }

  async startAllServices() {
    console.log('🚀 Starting all Python services...');
    console.log('=' .repeat(60));
    
    try {
      // Check dependencies first
      const depsOk = await this.checkPythonDependencies();
      if (!depsOk) {
        console.log('📦 Installing Python dependencies...');
        await this.installPythonDependencies();
      }
      
      // Initialize search index
      console.log('🔍 Initializing search index...');
      await this.initializeSearchIndex();
      
      // Start services in order
      const serviceOrder = ['async_optimizer', 'fastapi_server', 'admin_dashboard'];
      
      for (const serviceName of serviceOrder) {
        await this.startService(serviceName);
        // Brief delay between services
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      console.log('\n✅ All Python services started successfully!');
      this.printServiceUrls();
      
    } catch (error) {
      console.error(`❌ Error starting services: ${error.message}`);
      throw error;
    }
  }

  async stopAllServices() {
    console.log('🛑 Stopping all Python services...');
    
    const promises = Object.keys(this.services).map(serviceName => 
      this.stopService(serviceName).catch(error => 
        console.error(`Error stopping ${serviceName}: ${error.message}`)
      )
    );
    
    await Promise.all(promises);
    console.log('✅ All Python services stopped');
  }

  async initializeSearchIndex() {
    return new Promise((resolve, reject) => {
      const indexProcess = spawn('python3', ['src/search/whoosh-engine.py', 'index'], {
        stdio: 'inherit'
      });
      
      indexProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Search index initialized');
          resolve();
        } else {
          reject(new Error(`Search index initialization failed with code ${code}`));
        }
      });
    });
  }

  async getSystemStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      services: {},
      overall_health: 'unknown',
      python_integration: {
        status: 'active',
        version: await this.getPythonVersion()
      }
    };
    
    // Check each service
    for (const [name, service] of Object.entries(this.services)) {
      if (service.port && service.health_path) {
        try {
          const response = await this.makeRequest(`http://localhost:${service.port}${service.health_path}`);
          status.services[name] = {
            status: response.statusCode === 200 ? 'healthy' : 'unhealthy',
            port: service.port,
            response_code: response.statusCode
          };
        } catch (error) {
          status.services[name] = {
            status: 'unreachable',
            port: service.port,
            error: error.message
          };
        }
      } else {
        status.services[name] = {
          status: service.status,
          port: service.port || 'background'
        };
      }
    }
    
    // Check main Node.js server
    try {
      const response = await this.makeRequest(`http://localhost:${this.mainNodeServer.port}/health`);
      status.main_server = {
        status: response.statusCode === 200 ? 'healthy' : 'unhealthy',
        port: this.mainNodeServer.port
      };
    } catch (error) {
      status.main_server = {
        status: 'unreachable',
        port: this.mainNodeServer.port,
        error: error.message
      };
    }
    
    // Determine overall health
    const healthyServices = Object.values(status.services).filter(s => s.status === 'healthy').length;
    const totalServices = Object.keys(this.services).length;
    
    if (healthyServices === totalServices && status.main_server.status === 'healthy') {
      status.overall_health = 'excellent';
    } else if (healthyServices > totalServices * 0.7) {
      status.overall_health = 'good';
    } else if (healthyServices > 0) {
      status.overall_health = 'degraded';
    } else {
      status.overall_health = 'critical';
    }
    
    return status;
  }

  async getPythonVersion() {
    return new Promise((resolve) => {
      exec('python3 --version', (error, stdout) => {
        resolve(error ? 'unknown' : stdout.trim());
      });
    });
  }

  makeRequest(url) {
    return new Promise((resolve, reject) => {
      const request = http.get(url, (response) => {
        resolve(response);
      }).on('error', reject);
      
      request.setTimeout(5000, () => {
        request.abort();
        reject(new Error('Timeout'));
      });
    });
  }

  printServiceUrls() {
    console.log('\n🌐 Service URLs:');
    console.log('=' .repeat(50));
    console.log(`🎛️  Admin Dashboard:    http://localhost:8501`);
    console.log(`⚡ FastAPI Server:     http://localhost:8081`);
    console.log(`⚡ FastAPI Docs:       http://localhost:8081/docs`);
    console.log(`🔍 Node.js Server:      http://localhost:8080`);
    console.log(`🌐 Website (dev):      http://localhost:4322`);
    console.log('\n📋 Service Status: npm run health:all');
  }

  async startMonitoring(intervalSeconds = 30) {
    if (this.monitoring.enabled) {
      console.log('⚠️  Monitoring already running');
      return;
    }
    
    console.log(`🔍 Starting system monitoring (${intervalSeconds}s intervals)...`);
    this.monitoring.enabled = true;
    
    this.monitoring.interval = setInterval(async () => {
      try {
        const status = await this.getSystemStatus();
        this.monitoring.stats = status;
        
        // Log status summary
        const healthEmoji = {
          'excellent': '🟢',
          'good': '🟡',
          'degraded': '🟠',
          'critical': '🔴'
        };
        
        const emoji = healthEmoji[status.overall_health] || '⚪';
        console.log(`[${new Date().toLocaleTimeString()}] ${emoji} System Health: ${status.overall_health.toUpperCase()}`);
        
        // Check for issues
        const unhealthyServices = Object.entries(status.services)
          .filter(([name, service]) => service.status !== 'healthy' && service.status !== 'running')
          .map(([name]) => name);
        
        if (unhealthyServices.length > 0) {
          console.log(`⚠️  Services needing attention: ${unhealthyServices.join(', ')}`);
        }
        
      } catch (error) {
        console.error(`❌ Monitoring error: ${error.message}`);
      }
    }, intervalSeconds * 1000);
  }

  stopMonitoring() {
    if (this.monitoring.interval) {
      clearInterval(this.monitoring.interval);
      this.monitoring.interval = null;
      this.monitoring.enabled = false;
      console.log('✅ Monitoring stopped');
    }
  }

  async restartService(serviceName) {
    console.log(`🔄 Restarting ${serviceName}...`);
    
    await this.stopService(serviceName);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await this.startService(serviceName);
    
    console.log(`✅ Service ${serviceName} restarted`);
  }

  async performHealthCheck() {
    console.log('🧪 Performing comprehensive health check...');
    console.log('=' .repeat(60));
    
    const status = await this.getSystemStatus();
    
    // Display results
    console.log(`\n🎯 Overall Health: ${status.overall_health.toUpperCase()}`);
    console.log(`🕰️ Timestamp: ${status.timestamp}`);
    
    console.log('\n🔋 Service Status:');
    for (const [name, service] of Object.entries(status.services)) {
      const statusEmoji = {
        'healthy': '✅',
        'running': '✅',
        'unhealthy': '❌',
        'unreachable': '🔴',
        'stopped': '⚪',
        'error': '❌'
      };
      
      const emoji = statusEmoji[service.status] || '⚪';
      const port = service.port ? `:${service.port}` : '';
      console.log(`   ${emoji} ${name}${port} - ${service.status}`);
    }
    
    console.log('\n🔍 Main Server:');
    const mainEmoji = status.main_server.status === 'healthy' ? '✅' : '❌';
    console.log(`   ${mainEmoji} Node.js Server:${status.main_server.port} - ${status.main_server.status}`);
    
    console.log(`\n🐍 Python Integration: ${status.python_integration.status}`);
    console.log(`   Version: ${status.python_integration.version}`);
    
    return status;
  }

  async optimizeSystem() {
    console.log('⚡ Triggering system-wide optimization...');
    
    const optimizations = [];
    
    // Node.js optimizations
    optimizations.push(this.triggerNodeOptimization());
    
    // Python async optimization
    if (this.services.async_optimizer.status === 'running') {
      optimizations.push(this.triggerPythonOptimization());
    }
    
    // Search index optimization
    optimizations.push(this.optimizeSearchIndex());
    
    try {
      await Promise.all(optimizations);
      console.log('✅ System-wide optimization completed');
    } catch (error) {
      console.error(`⚠️  Some optimizations failed: ${error.message}`);
    }
  }

  async triggerNodeOptimization() {
    try {
      const response = await this.makeRequest('http://localhost:8080/optimize/concurrent');
      console.log('✅ Node.js optimization triggered');
    } catch (error) {
      console.log('⚠️  Node.js optimization failed');
    }
  }

  async triggerPythonOptimization() {
    try {
      const response = await this.makeRequest('http://localhost:8081/optimize/system');
      console.log('✅ Python optimization triggered');
    } catch (error) {
      console.log('⚠️  Python optimization failed');
    }
  }

  async optimizeSearchIndex() {
    return new Promise((resolve) => {
      const optimize = spawn('python3', ['src/search/whoosh-engine.py', 'optimize']);
      optimize.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Search index optimized');
        } else {
          console.log('⚠️  Search index optimization failed');
        }
        resolve();
      });
    });
  }

  // Graceful shutdown handler
  async gracefulShutdown() {
    console.log('\n🛑 Initiating graceful shutdown...');
    
    this.stopMonitoring();
    await this.stopAllServices();
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  }
}

// CLI interface
if (require.main === module) {
  const manager = new PythonIntegrationManager();
  const command = process.argv[2] || 'help';
  
  // Setup signal handlers
  process.on('SIGINT', () => manager.gracefulShutdown());
  process.on('SIGTERM', () => manager.gracefulShutdown());
  
  switch (command) {
    case 'start':
      manager.startAllServices()
        .then(() => manager.startMonitoring())
        .catch(error => {
          console.error(`❌ Failed to start services: ${error.message}`);
          process.exit(1);
        });
      break;
      
    case 'stop':
      manager.stopAllServices()
        .then(() => process.exit(0))
        .catch(error => {
          console.error(`❌ Failed to stop services: ${error.message}`);
          process.exit(1);
        });
      break;
      
    case 'status':
      manager.performHealthCheck()
        .then(() => process.exit(0))
        .catch(error => {
          console.error(`❌ Health check failed: ${error.message}`);
          process.exit(1);
        });
      break;
      
    case 'optimize':
      manager.optimizeSystem()
        .then(() => process.exit(0))
        .catch(error => {
          console.error(`❌ Optimization failed: ${error.message}`);
          process.exit(1);
        });
      break;
      
    case 'restart':
      const serviceName = process.argv[3];
      if (serviceName) {
        manager.restartService(serviceName)
          .then(() => process.exit(0))
          .catch(error => {
            console.error(`❌ Restart failed: ${error.message}`);
            process.exit(1);
          });
      } else {
        console.log('Usage: node python-integration-manager.js restart <service_name>');
        process.exit(1);
      }
      break;
      
    case 'install':
      manager.installPythonDependencies()
        .then(() => process.exit(0))
        .catch(error => {
          console.error(`❌ Installation failed: ${error.message}`);
          process.exit(1);
        });
      break;
      
    default:
      console.log('🐍 Python Integration Manager');
      console.log('Available commands:');
      console.log('  start     - Start all Python services');
      console.log('  stop      - Stop all Python services');
      console.log('  status    - Check system health');
      console.log('  optimize  - Trigger system optimization');
      console.log('  restart <service> - Restart specific service');
      console.log('  install   - Install Python dependencies');
      console.log('\nServices: admin_dashboard, fastapi_server, async_optimizer, search_engine');
  }
}

module.exports = PythonIntegrationManager;