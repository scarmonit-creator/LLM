#!/usr/bin/env node
/**
 * 📈 REAL-TIME PERFORMANCE DASHBOARD
 * Advanced monitoring and visualization for LLM system performance
 * Provides real-time metrics, alerts, and optimization insights
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { performance } from 'perf_hooks';
import EventEmitter from 'events';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Real-time Performance Dashboard
 */
class PerformanceDashboard extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      port: options.port || 4001,
      updateInterval: options.updateInterval || 1000, // 1 second
      historySize: options.historySize || 300, // 5 minutes at 1s intervals
      enableWebInterface: options.enableWebInterface !== false,
      enableSocketIO: options.enableSocketIO !== false,
      metricsEndpoint: options.metricsEndpoint || '/metrics',
      alertThresholds: {
        memoryUsage: options.memoryUsage || 0.85,
        cpuUsage: options.cpuUsage || 0.80,
        responseTime: options.responseTime || 1000,
        errorRate: options.errorRate || 0.05,
        ...options.alertThresholds
      },
      ...options
    };
    
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.metrics = {
      system: {
        memory: [],
        cpu: [],
        network: [],
        disk: []
      },
      application: {
        requests: [],
        responses: [],
        errors: [],
        performance: []
      },
      optimization: {
        concurrent: [],
        memory: [],
        cache: []
      }
    };
    
    this.alerts = [];
    this.connections = new Set();
    this.isRunning = false;
    
    this.setupRoutes();
    this.setupSocketIO();
  }
  
  setupRoutes() {
    // Serve static dashboard files
    this.app.use(express.static(path.join(__dirname, 'dashboard')));
    this.app.use(express.json());
    
    // Dashboard home page
    this.app.get('/', (req, res) => {
      res.send(this.generateDashboardHTML());
    });
    
    // API endpoints
    this.app.get('/api/metrics', (req, res) => {
      res.json({
        timestamp: Date.now(),
        metrics: this.metrics,
        alerts: this.alerts.slice(-10),
        summary: this.getMetricsSummary()
      });
    });
    
    this.app.get('/api/alerts', (req, res) => {
      res.json({
        alerts: this.alerts,
        active: this.alerts.filter(a => a.active),
        resolved: this.alerts.filter(a => !a.active)
      });
    });
    
    this.app.get('/api/health', (req, res) => {
      const summary = this.getMetricsSummary();
      res.json({
        status: 'ok',
        dashboard: 'running',
        connections: this.connections.size,
        uptime: this.isRunning ? Date.now() - this.startTime : 0,
        metrics: summary
      });
    });
    
    // Real-time metrics stream
    this.app.get('/api/stream', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      
      const sendMetrics = () => {
        const data = JSON.stringify({
          timestamp: Date.now(),
          metrics: this.getLatestMetrics(),
          alerts: this.alerts.slice(-5)
        });
        res.write(`data: ${data}\n\n`);
      };
      
      // Send initial data
      sendMetrics();
      
      // Send updates
      const interval = setInterval(sendMetrics, this.options.updateInterval);
      
      req.on('close', () => {
        clearInterval(interval);
      });
    });
  }
  
  setupSocketIO() {
    this.io.on('connection', (socket) => {
      console.log(`[PerformanceDashboard] Client connected: ${socket.id}`);
      this.connections.add(socket);
      
      // Send initial metrics
      socket.emit('metrics-update', {
        timestamp: Date.now(),
        metrics: this.metrics,
        alerts: this.alerts.slice(-10)
      });
      
      socket.on('disconnect', () => {
        console.log(`[PerformanceDashboard] Client disconnected: ${socket.id}`);
        this.connections.delete(socket);
      });
      
      // Handle client requests
      socket.on('request-metrics', () => {
        socket.emit('metrics-update', {
          timestamp: Date.now(),
          metrics: this.metrics,
          alerts: this.alerts.slice(-10)
        });
      });
      
      socket.on('clear-alerts', () => {
        this.clearResolvedAlerts();
        socket.emit('alerts-cleared');
      });
    });
  }
  
  async start() {
    if (this.isRunning) {
      console.warn('[PerformanceDashboard] Already running');
      return;
    }
    
    this.startTime = Date.now();
    this.isRunning = true;
    
    // Start metrics collection
    this.metricsTimer = setInterval(() => {
      this.collectMetrics();
    }, this.options.updateInterval);
    
    // Start server
    return new Promise((resolve, reject) => {
      this.server.listen(this.options.port, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        console.log(`[PerformanceDashboard] Dashboard running on http://localhost:${this.options.port}`);
        console.log(`[PerformanceDashboard] WebSocket connections: 0`);
        console.log(`[PerformanceDashboard] Update interval: ${this.options.updateInterval}ms`);
        
        this.emit('started');
        resolve();
      });
    });
  }
  
  stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
    
    this.server.close(() => {
      console.log('[PerformanceDashboard] Dashboard stopped');
      this.emit('stopped');
    });
  }
  
  collectMetrics() {
    const timestamp = Date.now();
    
    // Collect system metrics
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const systemMetrics = {
      timestamp,
      memory: {
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        usage: memUsage.heapUsed / memUsage.heapTotal
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        total: cpuUsage.user + cpuUsage.system
      },
      uptime: process.uptime()
    };
    
    // Add to metrics history
    this.addMetric('system.memory', systemMetrics.memory);
    this.addMetric('system.cpu', systemMetrics.cpu);
    
    // Check for alerts
    this.checkAlerts(systemMetrics);
    
    // Broadcast to connected clients
    this.broadcastMetrics({
      timestamp,
      system: systemMetrics,
      alerts: this.alerts.slice(-5)
    });
  }
  
  addMetric(category, data) {
    const [type, subtype] = category.split('.');
    
    if (!this.metrics[type]) {
      this.metrics[type] = {};
    }
    
    if (!this.metrics[type][subtype]) {
      this.metrics[type][subtype] = [];
    }
    
    const metricData = {
      timestamp: Date.now(),
      ...data
    };
    
    this.metrics[type][subtype].push(metricData);
    
    // Maintain history size
    if (this.metrics[type][subtype].length > this.options.historySize) {
      this.metrics[type][subtype].shift();
    }
  }
  
  checkAlerts(metrics) {
    const alerts = [];
    
    // Memory usage alert
    if (metrics.memory.usage > this.options.alertThresholds.memoryUsage) {
      alerts.push({
        id: `memory-${Date.now()}`,
        type: 'memory',
        severity: 'warning',
        message: `High memory usage: ${Math.round(metrics.memory.usage * 100)}%`,
        value: metrics.memory.usage,
        threshold: this.options.alertThresholds.memoryUsage,
        timestamp: Date.now(),
        active: true
      });
    }
    
    // Add new alerts
    alerts.forEach(alert => {
      // Check if similar alert already exists
      const existingAlert = this.alerts.find(a => 
        a.type === alert.type && 
        a.active && 
        Date.now() - a.timestamp < 60000 // Within last minute
      );
      
      if (!existingAlert) {
        this.alerts.push(alert);
        console.warn(`[PerformanceDashboard] ALERT: ${alert.message}`);
        this.emit('alert', alert);
      }
    });
  }
  
  clearResolvedAlerts() {
    const now = Date.now();
    const alertTimeout = 5 * 60 * 1000; // 5 minutes
    
    this.alerts.forEach(alert => {
      if (alert.active && now - alert.timestamp > alertTimeout) {
        alert.active = false;
        alert.resolvedAt = now;
      }
    });
    
    // Remove old resolved alerts
    this.alerts = this.alerts.filter(alert => 
      alert.active || (now - alert.timestamp < 24 * 60 * 60 * 1000) // Keep for 24 hours
    );
  }
  
  broadcastMetrics(data) {
    if (this.connections.size > 0) {
      this.io.emit('metrics-update', data);
    }
  }
  
  getLatestMetrics() {
    const latest = {};
    
    Object.keys(this.metrics).forEach(type => {
      latest[type] = {};
      Object.keys(this.metrics[type]).forEach(subtype => {
        const data = this.metrics[type][subtype];
        latest[type][subtype] = data.length > 0 ? data[data.length - 1] : null;
      });
    });
    
    return latest;
  }
  
  getMetricsSummary() {
    const latest = this.getLatestMetrics();
    const activeAlerts = this.alerts.filter(a => a.active);
    
    return {
      timestamp: Date.now(),
      status: activeAlerts.length === 0 ? 'healthy' : 'warning',
      activeAlerts: activeAlerts.length,
      totalAlerts: this.alerts.length,
      uptime: this.isRunning ? Date.now() - this.startTime : 0,
      connections: this.connections.size,
      latest: latest
    };
  }
  
  // External API for adding custom metrics
  addCustomMetric(category, name, value, metadata = {}) {
    const fullCategory = `application.${category}`;
    
    this.addMetric(fullCategory, {
      name,
      value,
      metadata
    });
  }
  
  // Add optimization metrics
  addOptimizationMetric(type, data) {
    this.addMetric(`optimization.${type}`, data);
  }
  
  generateDashboardHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LLM Performance Dashboard</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            min-height: 100vh;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            color: white;
            margin-bottom: 30px;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .status-bar {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        
        .status-item {
            background: rgba(255,255,255,0.9);
            padding: 15px 20px;
            border-radius: 10px;
            margin: 5px;
            min-width: 150px;
            text-align: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        
        .status-item h3 {
            font-size: 0.9em;
            color: #666;
            margin-bottom: 5px;
        }
        
        .status-item .value {
            font-size: 1.8em;
            font-weight: bold;
            color: #2c3e50;
        }
        
        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .chart-container {
            background: rgba(255,255,255,0.95);
            border-radius: 15px;
            padding: 20px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.1);
        }
        
        .chart-title {
            font-size: 1.2em;
            font-weight: bold;
            margin-bottom: 15px;
            color: #2c3e50;
            text-align: center;
        }
        
        .alerts-section {
            background: rgba(255,255,255,0.95);
            border-radius: 15px;
            padding: 20px;
            margin-top: 20px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.1);
        }
        
        .alert-item {
            padding: 10px 15px;
            margin: 10px 0;
            border-radius: 8px;
            border-left: 4px solid #e74c3c;
            background: #fff5f5;
        }
        
        .alert-item.warning {
            border-left-color: #f39c12;
            background: #fffaf0;
        }
        
        .alert-item.info {
            border-left-color: #3498db;
            background: #f0f8ff;
        }
        
        .connection-status {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: bold;
        }
        
        .connected {
            background: #2ecc71;
            color: white;
        }
        
        .disconnected {
            background: #e74c3c;
            color: white;
        }
        
        @media (max-width: 768px) {
            .charts-grid {
                grid-template-columns: 1fr;
            }
            
            .status-bar {
                flex-direction: column;
            }
            
            .status-item {
                margin: 5px 0;
            }
        }
    </style>
</head>
<body>
    <div class="connection-status" id="connectionStatus">Connecting...</div>
    
    <div class="container">
        <div class="header">
            <h1>🚀 LLM Performance Dashboard</h1>
            <p>Real-time system monitoring and optimization insights</p>
        </div>
        
        <div class="status-bar">
            <div class="status-item">
                <h3>Memory Usage</h3>
                <div class="value" id="memoryUsage">--</div>
            </div>
            <div class="status-item">
                <h3>CPU Usage</h3>
                <div class="value" id="cpuUsage">--</div>
            </div>
            <div class="status-item">
                <h3>Uptime</h3>
                <div class="value" id="uptime">--</div>
            </div>
            <div class="status-item">
                <h3>Active Alerts</h3>
                <div class="value" id="alertCount">--</div>
            </div>
            <div class="status-item">
                <h3>Connections</h3>
                <div class="value" id="connections">--</div>
            </div>
        </div>
        
        <div class="charts-grid">
            <div class="chart-container">
                <div class="chart-title">Memory Usage Over Time</div>
                <canvas id="memoryChart" width="400" height="200"></canvas>
            </div>
            
            <div class="chart-container">
                <div class="chart-title">CPU Usage Over Time</div>
                <canvas id="cpuChart" width="400" height="200"></canvas>
            </div>
            
            <div class="chart-container">
                <div class="chart-title">System Performance</div>
                <canvas id="performanceChart" width="400" height="200"></canvas>
            </div>
            
            <div class="chart-container">
                <div class="chart-title">Optimization Metrics</div>
                <canvas id="optimizationChart" width="400" height="200"></canvas>
            </div>
        </div>
        
        <div class="alerts-section">
            <h2>System Alerts</h2>
            <div id="alertsList">
                <p>No active alerts</p>
            </div>
        </div>
    </div>
    
    <script>
        // Dashboard JavaScript
        const socket = io();
        
        // Connection status
        const connectionStatus = document.getElementById('connectionStatus');
        
        socket.on('connect', () => {
            connectionStatus.textContent = 'Connected';
            connectionStatus.className = 'connection-status connected';
        });
        
        socket.on('disconnect', () => {
            connectionStatus.textContent = 'Disconnected';
            connectionStatus.className = 'connection-status disconnected';
        });
        
        // Chart initialization
        const charts = {};
        
        function initCharts() {
            // Memory chart
            charts.memory = new Chart(document.getElementById('memoryChart'), {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Heap Used (MB)',
                        data: [],
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
            
            // CPU chart
            charts.cpu = new Chart(document.getElementById('cpuChart'), {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'CPU Usage (%)',
                        data: [],
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100
                        }
                    }
                }
            });
        }
        
        function updateMetrics(data) {
            if (!data.system) return;
            
            // Update status bar
            document.getElementById('memoryUsage').textContent = 
                Math.round(data.system.memory.heapUsed / 1024 / 1024) + ' MB';
            
            document.getElementById('cpuUsage').textContent = 
                Math.round((data.system.cpu.total / 1000000) * 100) / 100 + ' %';
            
            document.getElementById('uptime').textContent = 
                Math.round(data.system.uptime / 3600) + ' hrs';
            
            document.getElementById('connections').textContent = '1';
            
            // Update charts
            const time = new Date(data.timestamp).toLocaleTimeString();
            
            // Memory chart
            if (charts.memory) {
                charts.memory.data.labels.push(time);
                charts.memory.data.datasets[0].data.push(
                    Math.round(data.system.memory.heapUsed / 1024 / 1024)
                );
                
                if (charts.memory.data.labels.length > 20) {
                    charts.memory.data.labels.shift();
                    charts.memory.data.datasets[0].data.shift();
                }
                
                charts.memory.update('none');
            }
            
            // Update alerts
            if (data.alerts) {
                updateAlerts(data.alerts);
            }
        }
        
        function updateAlerts(alerts) {
            const alertsList = document.getElementById('alertsList');
            const activeAlerts = alerts.filter(a => a.active);
            
            document.getElementById('alertCount').textContent = activeAlerts.length;
            
            if (activeAlerts.length === 0) {
                alertsList.innerHTML = '<p>No active alerts</p>';
            } else {
                alertsList.innerHTML = activeAlerts.map(alert => `
                    <div class="alert-item ${alert.severity}">
                        <strong>${alert.type.toUpperCase()}</strong>: ${alert.message}
                        <br><small>${new Date(alert.timestamp).toLocaleString()}</small>
                    </div>
                `).join('');
            }
        }
        
        // Socket event listeners
        socket.on('metrics-update', updateMetrics);
        
        // Initialize
        initCharts();
        
        // Request initial metrics
        socket.emit('request-metrics');
    </script>
</body>
</html>
    `;
  }
}

export default PerformanceDashboard;
