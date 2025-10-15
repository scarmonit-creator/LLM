#!/usr/bin/env node

import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import process from 'process';
import { execSync } from 'child_process';
import winston from 'winston';

// Performance Monitor Configuration
const CONFIG = {
  MONITORING_INTERVAL: 5000, // 5 seconds
  ALERT_THRESHOLD_CPU: 80, // 80% CPU
  ALERT_THRESHOLD_MEMORY: 85, // 85% Memory
  ALERT_THRESHOLD_RESPONSE_TIME: 1000, // 1 second
  OPTIMIZATION_TRIGGER_THRESHOLD: 90, // 90% system load
  REPORT_INTERVAL: 60000, // 1 minute
  MAX_LOG_FILES: 10,
  PERFORMANCE_LOG_PATH: './performance-logs/',
  AUTO_OPTIMIZATION: process.env.AUTO_OPTIMIZE === 'true',
  WEBHOOK_URL: process.env.PERFORMANCE_WEBHOOK_URL,
  TARGET_ENDPOINTS: [
    'http://localhost:8080/health',
    'http://localhost:8080/metrics'
  ]
};

// Advanced Logger Setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: path.join(CONFIG.PERFORMANCE_LOG_PATH, 'performance-monitor.log'),
      maxsize: 10485760, // 10MB
      maxFiles: CONFIG.MAX_LOG_FILES
    })
  ]
});

// Performance Metrics Collector
class PerformanceCollector extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      system: {
        cpu: { usage: 0, cores: os.cpus().length },
        memory: { used: 0, total: os.totalmem(), free: 0, percentage: 0 },
        load: { avg1: 0, avg5: 0, avg15: 0 },
        uptime: 0
      },
      process: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime(),
        pid: process.pid
      },
      endpoints: new Map(),
      alerts: [],
      optimizations: [],
      performanceScore: 0
    };
    
    this.previousCpuUsage = process.cpuUsage();
    this.startTime = Date.now();
    this.isMonitoring = false;
  }

  async initializeDirectories() {
    try {
      await fs.mkdir(CONFIG.PERFORMANCE_LOG_PATH, { recursive: true });
      logger.info('📁 Performance logs directory initialized');
    } catch (error) {
      logger.error('Failed to create performance logs directory:', error);
    }
  }

  async collectSystemMetrics() {
    // System CPU and Memory
    const memInfo = {
      used: os.totalmem() - os.freemem(),
      total: os.totalmem(),
      free: os.freemem()
    };
    memInfo.percentage = (memInfo.used / memInfo.total) * 100;

    this.metrics.system = {
      cpu: { usage: await this.getCpuUsage(), cores: os.cpus().length },
      memory: memInfo,
      load: {
        avg1: os.loadavg()[0],
        avg5: os.loadavg()[1],
        avg15: os.loadavg()[2]
      },
      uptime: os.uptime(),
      platform: os.platform(),
      arch: os.arch()
    };

    // Process Metrics
    const currentCpuUsage = process.cpuUsage();
    const cpuPercent = ((currentCpuUsage.user - this.previousCpuUsage.user + 
                        currentCpuUsage.system - this.previousCpuUsage.system) / 1000000) * 100;
    
    this.metrics.process = {
      memory: process.memoryUsage(),
      cpu: {
        usage: cpuPercent,
        user: currentCpuUsage.user,
        system: currentCpuUsage.system
      },
      uptime: process.uptime(),
      pid: process.pid,
      version: process.version
    };

    this.previousCpuUsage = currentCpuUsage;
  }

  async getCpuUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      
      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const userUsage = currentUsage.user / 1000; // Convert to milliseconds
        const sysUsage = currentUsage.system / 1000;
        const totalUsage = (userUsage + sysUsage) / 10; // Rough CPU percentage
        
        resolve(Math.min(totalUsage, 100));
      }, 100);
    });
  }

  async checkEndpointHealth() {
    const endpointPromises = CONFIG.TARGET_ENDPOINTS.map(async (endpoint) => {
      const startTime = performance.now();
      
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(endpoint, {
          signal: controller.signal,
          headers: { 'User-Agent': 'PerformanceMonitor/1.0' }
        });
        
        clearTimeout(timeout);
        
        const responseTime = performance.now() - startTime;
        const data = await response.json();
        
        const endpointMetrics = {
          url: endpoint,
          status: response.status,
          responseTime: Math.round(responseTime),
          healthy: response.ok,
          timestamp: Date.now(),
          data: data
        };
        
        this.metrics.endpoints.set(endpoint, endpointMetrics);
        
        // Check for performance alerts
        if (responseTime > CONFIG.ALERT_THRESHOLD_RESPONSE_TIME) {
          this.createAlert('SLOW_RESPONSE', `${endpoint} responded in ${Math.round(responseTime)}ms`);
        }
        
        return endpointMetrics;
      } catch (error) {
        const errorMetrics = {
          url: endpoint,
          status: 0,
          responseTime: performance.now() - startTime,
          healthy: false,
          error: error.message,
          timestamp: Date.now()
        };
        
        this.metrics.endpoints.set(endpoint, errorMetrics);
        this.createAlert('ENDPOINT_DOWN', `${endpoint} is unreachable: ${error.message}`);
        
        return errorMetrics;
      }
    });

    await Promise.allSettled(endpointPromises);
  }

  createAlert(type, message, severity = 'warning') {
    const alert = {
      type,
      message,
      severity,
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9)
    };
    
    this.metrics.alerts.unshift(alert);
    
    // Keep only last 50 alerts
    if (this.metrics.alerts.length > 50) {
      this.metrics.alerts = this.metrics.alerts.slice(0, 50);
    }
    
    logger.warn(`⚠️ ALERT [${type}]: ${message}`);
    this.emit('alert', alert);
  }

  calculatePerformanceScore() {
    let score = 100;
    
    // CPU penalty
    if (this.metrics.system.cpu.usage > 70) score -= 20;
    else if (this.metrics.system.cpu.usage > 50) score -= 10;
    
    // Memory penalty
    if (this.metrics.system.memory.percentage > 80) score -= 25;
    else if (this.metrics.system.memory.percentage > 60) score -= 10;
    
    // Response time penalty
    const avgResponseTime = Array.from(this.metrics.endpoints.values())
      .reduce((sum, endpoint) => sum + endpoint.responseTime, 0) / 
      Math.max(this.metrics.endpoints.size, 1);
    
    if (avgResponseTime > 500) score -= 15;
    else if (avgResponseTime > 200) score -= 5;
    
    // Load average penalty
    if (this.metrics.system.load.avg1 > this.metrics.system.cpu.cores * 2) score -= 15;
    
    // Endpoint health bonus/penalty
    const healthyEndpoints = Array.from(this.metrics.endpoints.values())
      .filter(endpoint => endpoint.healthy).length;
    const totalEndpoints = this.metrics.endpoints.size;
    
    if (totalEndpoints > 0) {
      const healthRatio = healthyEndpoints / totalEndpoints;
      if (healthRatio < 0.8) score -= 30;
      else if (healthRatio < 0.9) score -= 15;
    }
    
    this.metrics.performanceScore = Math.max(0, score);
    return this.metrics.performanceScore;
  }

  async triggerOptimizations() {
    if (!CONFIG.AUTO_OPTIMIZATION) {
      logger.info('😎 Auto-optimization is disabled');
      return;
    }

    const optimizations = [];
    
    try {
      // Memory optimization
      if (this.metrics.system.memory.percentage > CONFIG.ALERT_THRESHOLD_MEMORY) {
        if (global.gc) {
          global.gc();
          optimizations.push('garbage_collection');
          logger.info('🧹 Triggered garbage collection');
        }
      }

      // Clear old log files if disk space is low
      try {
        const logStats = await fs.readdir(CONFIG.PERFORMANCE_LOG_PATH);
        if (logStats.length > CONFIG.MAX_LOG_FILES) {
          const oldestFiles = logStats.slice(CONFIG.MAX_LOG_FILES);
          for (const file of oldestFiles) {
            await fs.unlink(path.join(CONFIG.PERFORMANCE_LOG_PATH, file));
          }
          optimizations.push(`cleaned_${oldestFiles.length}_log_files`);
        }
      } catch (error) {
        logger.warn('Failed to clean log files:', error.message);
      }

      // Trigger server optimization endpoint
      if (this.metrics.endpoints.has('http://localhost:8080/optimize')) {
        try {
          const response = await fetch('http://localhost:8080/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trigger: 'auto_optimization', threshold: CONFIG.OPTIMIZATION_TRIGGER_THRESHOLD })
          });
          
          if (response.ok) {
            const result = await response.json();
            optimizations.push('server_optimization_triggered');
            logger.info('🚀 Server optimization triggered successfully');
          }
        } catch (error) {
          logger.warn('Failed to trigger server optimization:', error.message);
        }
      }

      this.metrics.optimizations.unshift({
        timestamp: Date.now(),
        optimizations,
        performanceScore: this.metrics.performanceScore,
        trigger: 'auto'
      });

      // Keep only last 20 optimization records
      if (this.metrics.optimizations.length > 20) {
        this.metrics.optimizations = this.metrics.optimizations.slice(0, 20);
      }

    } catch (error) {
      logger.error('Optimization failed:', error);
    }
  }

  async generateReport() {
    const reportData = {
      timestamp: Date.now(),
      monitoringDuration: Date.now() - this.startTime,
      metrics: {
        system: this.metrics.system,
        process: this.metrics.process,
        endpoints: Object.fromEntries(this.metrics.endpoints),
        performanceScore: this.metrics.performanceScore
      },
      alerts: this.metrics.alerts.slice(0, 10), // Last 10 alerts
      optimizations: this.metrics.optimizations.slice(0, 5), // Last 5 optimizations
      summary: {
        totalAlerts: this.metrics.alerts.length,
        totalOptimizations: this.metrics.optimizations.length,
        avgResponseTime: this.calculateAverageResponseTime(),
        systemHealth: this.getSystemHealthStatus()
      }
    };

    // Save report to file
    const reportPath = path.join(CONFIG.PERFORMANCE_LOG_PATH, `performance-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
    
    logger.info(`📈 Performance report generated: ${reportPath}`);
    
    // Send webhook notification if configured
    if (CONFIG.WEBHOOK_URL) {
      await this.sendWebhookNotification(reportData);
    }

    return reportData;
  }

  calculateAverageResponseTime() {
    const responseTimes = Array.from(this.metrics.endpoints.values())
      .map(endpoint => endpoint.responseTime);
    
    return responseTimes.length > 0 ? 
      Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length) : 0;
  }

  getSystemHealthStatus() {
    if (this.metrics.performanceScore >= 80) return 'excellent';
    if (this.metrics.performanceScore >= 60) return 'good';
    if (this.metrics.performanceScore >= 40) return 'fair';
    if (this.metrics.performanceScore >= 20) return 'poor';
    return 'critical';
  }

  async sendWebhookNotification(reportData) {
    try {
      const response = await fetch(CONFIG.WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'performance_report',
          data: reportData,
          timestamp: Date.now()
        })
      });
      
      if (response.ok) {
        logger.info('📡 Webhook notification sent successfully');
      }
    } catch (error) {
      logger.warn('Failed to send webhook notification:', error.message);
    }
  }

  async startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('Monitoring already started');
      return;
    }

    this.isMonitoring = true;
    await this.initializeDirectories();
    
    logger.info('🚀 Advanced Performance Monitor started');
    logger.info(`⚡ Configuration: Interval=${CONFIG.MONITORING_INTERVAL}ms, Auto-optimization=${CONFIG.AUTO_OPTIMIZATION}`);
    
    // Main monitoring loop
    const monitoringInterval = setInterval(async () => {
      try {
        await this.collectSystemMetrics();
        await this.checkEndpointHealth();
        
        const performanceScore = this.calculatePerformanceScore();
        
        // Check if optimization is needed
        if (performanceScore < CONFIG.OPTIMIZATION_TRIGGER_THRESHOLD) {
          await this.triggerOptimizations();
        }
        
        // Emit metrics for real-time monitoring
        this.emit('metrics', this.metrics);
        
        // Create performance alerts
        if (this.metrics.system.cpu.usage > CONFIG.ALERT_THRESHOLD_CPU) {
          this.createAlert('HIGH_CPU', `CPU usage at ${this.metrics.system.cpu.usage.toFixed(1)}%`, 'warning');
        }
        
        if (this.metrics.system.memory.percentage > CONFIG.ALERT_THRESHOLD_MEMORY) {
          this.createAlert('HIGH_MEMORY', `Memory usage at ${this.metrics.system.memory.percentage.toFixed(1)}%`, 'critical');
        }
        
        logger.debug(`📊 Performance Score: ${performanceScore}/100`);
        
      } catch (error) {
        logger.error('Monitoring error:', error);
        this.createAlert('MONITORING_ERROR', error.message, 'critical');
      }
    }, CONFIG.MONITORING_INTERVAL);

    // Report generation interval
    const reportInterval = setInterval(async () => {
      try {
        await this.generateReport();
      } catch (error) {
        logger.error('Report generation failed:', error);
      }
    }, CONFIG.REPORT_INTERVAL);

    // Graceful shutdown
    const shutdown = () => {
      logger.info('🔄 Shutting down performance monitor...');
      clearInterval(monitoringInterval);
      clearInterval(reportInterval);
      this.isMonitoring = false;
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  getCurrentMetrics() {
    return {
      ...this.metrics,
      monitoringDuration: Date.now() - this.startTime,
      isMonitoring: this.isMonitoring
    };
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new PerformanceCollector();
  
  // Real-time console display
  monitor.on('metrics', (metrics) => {
    if (process.env.VERBOSE === 'true') {
      console.clear();
      console.log('🚀 AUTONOMOUS PERFORMANCE MONITOR');
      console.log('=' .repeat(50));
      console.log(`Performance Score: ${metrics.performanceScore}/100 (${monitor.getSystemHealthStatus().toUpperCase()})`);
      console.log(`CPU Usage: ${metrics.system.cpu.usage.toFixed(1)}% (${metrics.system.cpu.cores} cores)`);
      console.log(`Memory Usage: ${metrics.system.memory.percentage.toFixed(1)}% (${(metrics.system.memory.used / 1024 / 1024 / 1024).toFixed(2)}GB/${(metrics.system.memory.total / 1024 / 1024 / 1024).toFixed(2)}GB)`);
      console.log(`Load Average: ${metrics.system.load.avg1.toFixed(2)} ${metrics.system.load.avg5.toFixed(2)} ${metrics.system.load.avg15.toFixed(2)}`);
      console.log(`Process Memory: ${(metrics.process.memory.heapUsed / 1024 / 1024).toFixed(2)}MB heap, ${(metrics.process.memory.rss / 1024 / 1024).toFixed(2)}MB RSS`);
      
      console.log('\nEndpoint Status:');
      for (const [url, endpoint] of metrics.endpoints) {
        const status = endpoint.healthy ? '✅' : '❌';
        console.log(`  ${status} ${url}: ${endpoint.responseTime}ms`);
      }
      
      if (metrics.alerts.length > 0) {
        console.log('\nRecent Alerts:');
        metrics.alerts.slice(0, 3).forEach(alert => {
          console.log(`  ⚠️ ${alert.type}: ${alert.message}`);
        });
      }
      
      console.log(`\nMonitoring for ${Math.round((Date.now() - monitor.startTime) / 1000)}s | Last update: ${new Date().toLocaleTimeString()}`);
    }
  });
  
  monitor.on('alert', (alert) => {
    console.log(`\n🚨 ${alert.severity.toUpperCase()} ALERT: ${alert.message}`);
  });
  
  // Start monitoring
  monitor.startMonitoring().catch(console.error);
}

export default PerformanceCollector;