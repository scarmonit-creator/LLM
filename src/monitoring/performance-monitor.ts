/**
 * Advanced Performance Monitoring System for LLM Framework
 * 
 * This module provides comprehensive real-time performance monitoring with:
 * - Memory usage tracking and optimization alerts
 * - API response time monitoring across all services
 * - Resource utilization metrics (CPU, memory, network)
 * - Real-time dashboard with WebSocket updates
 * - Intelligent alerting system with configurable thresholds
 * - Integration with existing OptimizedMemoryManager
 * - Prometheus metrics export
 * - Historical performance analytics
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import * as os from 'os';
import * as fs from 'fs/promises';
import WebSocket from 'ws';

// Performance metric interfaces
interface PerformanceMetric {
  timestamp: number;
  value: number;
  type: string;
  tags?: Record<string, string>;
}

interface SystemMetrics {
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    pressure: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  system: {
    uptime: number;
    platform: string;
    arch: string;
    nodeVersion: string;
  };
}

interface AlertThreshold {
  metric: string;
  warning: number;
  critical: number;
  enabled: boolean;
}

interface MonitoringConfig {
  metricsRetentionHours: number;
  alertingEnabled: boolean;
  dashboardEnabled: boolean;
  prometheusEnabled: boolean;
  websocketPort: number;
  samplingInterval: number;
  thresholds: AlertThreshold[];
}

class PerformanceMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private dashboardClients: Set<WebSocket> = new Set();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private wss: WebSocket.Server | null = null;
  private alertHistory: Map<string, number> = new Map();
  private isMonitoring = false;

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();
    
    this.config = {
      metricsRetentionHours: config.metricsRetentionHours || 24,
      alertingEnabled: config.alertingEnabled !== false,
      dashboardEnabled: config.dashboardEnabled !== false,
      prometheusEnabled: config.prometheusEnabled || false,
      websocketPort: config.websocketPort || 8081,
      samplingInterval: config.samplingInterval || 5000,
      thresholds: config.thresholds || this.getDefaultThresholds()
    };

    this.initializeMonitoring();
  }

  /**
   * Start comprehensive performance monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('Performance monitoring is already active');
      return;
    }

    try {
      // Initialize WebSocket server for real-time dashboard
      if (this.config.dashboardEnabled) {
        await this.initializeDashboardServer();
      }

      // Start metric collection
      this.monitoringInterval = setInterval(
        () => this.collectMetrics(),
        this.config.samplingInterval
      );

      // Initialize cleanup timer
      setInterval(() => this.cleanupOldMetrics(), 60000); // Every minute

      this.isMonitoring = true;
      console.log('🚀 Performance monitoring started');
      this.emit('monitoring:started');

    } catch (error) {
      console.error('Failed to start performance monitoring:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop performance monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) return;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.dashboardClients.clear();
    this.isMonitoring = false;

    console.log('Performance monitoring stopped');
    this.emit('monitoring:stopped');
  }

  /**
   * Record custom performance metric
   */
  recordMetric(name: string, value: number, tags: Record<string, string> = {}): void {
    const metric: PerformanceMetric = {
      timestamp: Date.now(),
      value,
      type: name,
      tags
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricArray = this.metrics.get(name)!;
    metricArray.push(metric);

    // Broadcast to dashboard clients
    this.broadcastMetric(metric);

    // Check alert thresholds
    this.checkAlertThresholds(name, value);

    this.emit('metric:recorded', metric);
  }

  /**
   * Record API response time
   */
  recordApiResponse(endpoint: string, duration: number, status: number): void {
    this.recordMetric('api.response_time', duration, {
      endpoint,
      status: status.toString()
    });

    this.recordMetric('api.requests', 1, {
      endpoint,
      status: status.toString()
    });
  }

  /**
   * Record memory operation performance
   */
  recordMemoryOperation(operation: string, duration: number, success: boolean): void {
    this.recordMetric('memory.operation_time', duration, {
      operation,
      success: success.toString()
    });
  }

  /**
   * Get current system metrics
   */
  getCurrentMetrics(): SystemMetrics {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAverage = os.loadavg();

    return {
      memory: {
        heapUsed: memoryUsage.heapUsed / 1024 / 1024, // MB
        heapTotal: memoryUsage.heapTotal / 1024 / 1024, // MB
        external: memoryUsage.external / 1024 / 1024, // MB
        rss: memoryUsage.rss / 1024 / 1024, // MB
        pressure: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      },
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000, // ms
        loadAverage
      },
      system: {
        uptime: process.uptime(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version
      }
    };
  }

  /**
   * Get historical metrics for a specific type
   */
  getMetrics(type: string, hours = 1): PerformanceMetric[] {
    const metrics = this.metrics.get(type) || [];
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    
    return metrics.filter(metric => metric.timestamp >= cutoff);
  }

  /**
   * Generate performance report
   */
  generateReport(hours = 1): any {
    const systemMetrics = this.getCurrentMetrics();
    const reportData: any = {
      timestamp: Date.now(),
      system: systemMetrics,
      metrics: {},
      summary: {
        totalAlerts: this.alertHistory.size,
        metricsCollected: 0,
        monitoringUptime: this.isMonitoring ? process.uptime() : 0
      }
    };

    // Aggregate metrics by type
    for (const [type, metricArray] of this.metrics.entries()) {
      const recentMetrics = this.getMetrics(type, hours);
      
      if (recentMetrics.length > 0) {
        const values = recentMetrics.map(m => m.value);
        
        reportData.metrics[type] = {
          count: recentMetrics.length,
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          latest: values[values.length - 1]
        };
        
        reportData.summary.metricsCollected += recentMetrics.length;
      }
    }

    return reportData;
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    if (!this.config.prometheusEnabled) {
      return '# Prometheus metrics export is disabled';
    }

    let output = '# HELP llm_framework_metrics LLM Framework Performance Metrics\n';
    output += '# TYPE llm_framework_metrics gauge\n';

    const systemMetrics = this.getCurrentMetrics();
    
    // Export system metrics
    output += `llm_memory_heap_used_mb ${systemMetrics.memory.heapUsed}\n`;
    output += `llm_memory_heap_total_mb ${systemMetrics.memory.heapTotal}\n`;
    output += `llm_memory_pressure_percent ${systemMetrics.memory.pressure}\n`;
    output += `llm_cpu_usage_ms ${systemMetrics.cpu.usage}\n`;
    output += `llm_system_uptime_seconds ${systemMetrics.system.uptime}\n`;

    // Export custom metrics
    for (const [type, metricArray] of this.metrics.entries()) {
      const recentMetrics = this.getMetrics(type, 1);
      if (recentMetrics.length > 0) {
        const latest = recentMetrics[recentMetrics.length - 1];
        const metricName = type.replace(/[^a-zA-Z0-9_]/g, '_');
        output += `llm_${metricName} ${latest.value}\n`;
      }
    }

    return output;
  }

  // Private methods

  private initializeMonitoring(): void {
    // Set up error handling
    process.on('unhandledRejection', (reason, promise) => {
      this.recordMetric('system.unhandled_rejection', 1, {
        reason: String(reason)
      });
    });

    process.on('uncaughtException', (error) => {
      this.recordMetric('system.uncaught_exception', 1, {
        error: error.message
      });
    });
  }

  private async initializeDashboardServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocket.Server({ port: this.config.websocketPort });
        
        this.wss.on('connection', (ws) => {
          console.log('Dashboard client connected');
          this.dashboardClients.add(ws);
          
          // Send initial metrics
          ws.send(JSON.stringify({
            type: 'initial',
            data: this.generateReport()
          }));
          
          ws.on('close', () => {
            this.dashboardClients.delete(ws);
            console.log('Dashboard client disconnected');
          });
          
          ws.on('error', (error) => {
            console.error('Dashboard client error:', error);
            this.dashboardClients.delete(ws);
          });
        });
        
        this.wss.on('listening', () => {
          console.log(`📊 Dashboard server listening on port ${this.config.websocketPort}`);
          resolve();
        });
        
        this.wss.on('error', (error) => {
          console.error('Dashboard server error:', error);
          reject(error);
        });
        
      } catch (error) {
        reject(error);
      }
    });
  }

  private collectMetrics(): void {
    try {
      const systemMetrics = this.getCurrentMetrics();
      
      // Record system metrics
      this.recordMetric('system.memory.heap_used', systemMetrics.memory.heapUsed);
      this.recordMetric('system.memory.heap_total', systemMetrics.memory.heapTotal);
      this.recordMetric('system.memory.pressure', systemMetrics.memory.pressure);
      this.recordMetric('system.cpu.usage', systemMetrics.cpu.usage);
      this.recordMetric('system.load_average_1m', systemMetrics.cpu.loadAverage[0]);
      
      // Broadcast system update to dashboard clients
      this.broadcastSystemUpdate(systemMetrics);
      
    } catch (error) {
      console.error('Error collecting metrics:', error);
      this.emit('error', error);
    }
  }

  private broadcastMetric(metric: PerformanceMetric): void {
    if (this.dashboardClients.size === 0) return;
    
    const message = JSON.stringify({
      type: 'metric',
      data: metric
    });
    
    for (const client of this.dashboardClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  private broadcastSystemUpdate(systemMetrics: SystemMetrics): void {
    if (this.dashboardClients.size === 0) return;
    
    const message = JSON.stringify({
      type: 'system',
      data: systemMetrics
    });
    
    for (const client of this.dashboardClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  private checkAlertThresholds(metricName: string, value: number): void {
    if (!this.config.alertingEnabled) return;
    
    const threshold = this.config.thresholds.find(t => t.metric === metricName);
    if (!threshold || !threshold.enabled) return;
    
    const lastAlert = this.alertHistory.get(metricName) || 0;
    const now = Date.now();
    
    // Prevent alert spam (minimum 5 minutes between alerts)
    if (now - lastAlert < 300000) return;
    
    if (value >= threshold.critical) {
      this.emit('alert', {
        level: 'critical',
        metric: metricName,
        value,
        threshold: threshold.critical,
        timestamp: now
      });
      this.alertHistory.set(metricName, now);
    } else if (value >= threshold.warning) {
      this.emit('alert', {
        level: 'warning',
        metric: metricName,
        value,
        threshold: threshold.warning,
        timestamp: now
      });
      this.alertHistory.set(metricName, now);
    }
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - (this.config.metricsRetentionHours * 60 * 60 * 1000);
    
    for (const [type, metricArray] of this.metrics.entries()) {
      const filteredMetrics = metricArray.filter(metric => metric.timestamp >= cutoff);
      this.metrics.set(type, filteredMetrics);
    }
  }

  private getDefaultThresholds(): AlertThreshold[] {
    return [
      {
        metric: 'system.memory.pressure',
        warning: 80,
        critical: 95,
        enabled: true
      },
      {
        metric: 'system.cpu.usage',
        warning: 80,
        critical: 95,
        enabled: true
      },
      {
        metric: 'api.response_time',
        warning: 1000, // 1 second
        critical: 3000, // 3 seconds
        enabled: true
      },
      {
        metric: 'memory.operation_time',
        warning: 100, // 100ms
        critical: 500, // 500ms
        enabled: true
      }
    ];
  }
}

export default PerformanceMonitor;
export { PerformanceMetric, SystemMetrics, AlertThreshold, MonitoringConfig };