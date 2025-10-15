#!/usr/bin/env node
/**
 * Real-Time Performance Dashboard - Phase 2 Autonomous Optimization
 * Advanced monitoring and visualization for breakthrough performance analytics
 * Target: Real-time performance tracking with predictive insights
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PerformanceDashboard extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      port: options.port || 4001,
      updateInterval: options.updateInterval || 5000,
      historySize: options.historySize || 1000,
      ...options
    };
    
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    
    this.clients = new Set();
    this.metricsHistory = [];
    this.alerts = [];
    this.isRunning = false;
    
    this.stats = {
      startTime: Date.now(),
      totalConnections: 0,
      activeConnections: 0,
      dataPoints: 0,
      alertsGenerated: 0
    };
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }
  
  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    // CORS middleware
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      next();
    });
  }
  
  setupRoutes() {
    // Dashboard home
    this.app.get('/', (req, res) => {
      res.send(this.generateDashboardHTML());
    });
    
    // API endpoints
    this.app.get('/api/metrics', (req, res) => {
      const limit = parseInt(req.query.limit) || 100;
      const recent = this.metricsHistory.slice(-limit);
      res.json({
        metrics: recent,
        total: this.metricsHistory.length,
        timestamp: Date.now()
      });
    });
    
    this.app.get('/api/stats', (req, res) => {
      res.json(this.getComprehensiveStats());
    });
    
    this.app.get('/api/alerts', (req, res) => {
      const limit = parseInt(req.query.limit) || 50;
      const recent = this.alerts.slice(-limit);
      res.json({
        alerts: recent,
        total: this.alerts.length,
        timestamp: Date.now()
      });
    });
    
    // Real-time metrics endpoint
    this.app.get('/api/realtime', (req, res) => {
      const currentMetrics = this.getCurrentMetrics();
      res.json(currentMetrics);
    });
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: Date.now() - this.stats.startTime,
        version: '2.0.0-autonomous'
      });
    });
  }
  
  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      this.stats.totalConnections++;
      this.stats.activeConnections++;
      this.clients.add(ws);
      
      console.log(`📊 [Dashboard] New client connected (${this.stats.activeConnections} active)`);
      
      // Send initial data
      ws.send(JSON.stringify({
        type: 'init',
        data: {
          recentMetrics: this.metricsHistory.slice(-50),
          stats: this.getComprehensiveStats()
        }
      }));
      
      ws.on('close', () => {
        this.stats.activeConnections--;
        this.clients.delete(ws);
        console.log(`📊 [Dashboard] Client disconnected (${this.stats.activeConnections} active)`);
      });
      
      ws.on('error', (error) => {
        console.error('📊 [Dashboard] WebSocket error:', error);
        this.clients.delete(ws);
        this.stats.activeConnections--;
      });
    });
  }
  
  start() {
    return new Promise((resolve) => {
      this.server.listen(this.options.port, () => {
        this.isRunning = true;
        this.startMetricsCollection();
        
        console.log(`🚀 [Dashboard] Performance dashboard running on http://localhost:${this.options.port}`);
        console.log(`📊 [Dashboard] WebSocket server ready for real-time updates`);
        
        resolve();
      });
    });
  }
  
  stop() {
    return new Promise((resolve) => {
      this.isRunning = false;
      
      if (this.metricsTimer) {
        clearInterval(this.metricsTimer);
      }
      
      this.server.close(() => {
        console.log('📊 [Dashboard] Performance dashboard stopped');
        resolve();
      });
    });
  }
  
  startMetricsCollection() {
    this.metricsTimer = setInterval(() => {
      const metrics = this.collectSystemMetrics();
      this.addMetrics(metrics);
    }, this.options.updateInterval);
    
    console.log(`📊 [Dashboard] Started metrics collection (interval: ${this.options.updateInterval}ms)`);
  }
  
  addMetrics(metrics) {
    // Add timestamp if not present
    if (!metrics.timestamp) {
      metrics.timestamp = Date.now();
    }
    
    // Add to history
    this.metricsHistory.push(metrics);
    
    // Maintain history size
    if (this.metricsHistory.length > this.options.historySize) {
      this.metricsHistory.shift();
    }
    
    this.stats.dataPoints++;
    
    // Check for alerts
    this.checkAlerts(metrics);
    
    // Broadcast to connected clients
    this.broadcastMetrics(metrics);
    
    this.emit('metrics', metrics);
  }
  
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      timestamp: Date.now(),
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024)
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      process: {
        uptime: Math.floor(process.uptime()),
        pid: process.pid,
        version: process.version
      },
      performance: this.getPerformanceMetrics(),
      network: this.getNetworkMetrics(),
      system: this.getSystemMetrics()
    };
  }
  
  getPerformanceMetrics() {
    // Mock performance metrics (would integrate with actual performance monitoring)
    const baseResponseTime = 55;
    const variation = (Math.random() - 0.5) * 20;
    
    return {
      responseTime: Math.max(10, baseResponseTime + variation),
      throughput: Math.max(50, 180 + (Math.random() - 0.5) * 60),
      errorRate: Math.max(0, Math.random() * 0.008), // 0-0.8%
      cacheHitRate: Math.min(100, 96 + Math.random() * 4), // 96-100%
      activeConnections: this.stats.activeConnections || 0,
      queueLength: Math.floor(Math.random() * 10)
    };
  }
  
  getNetworkMetrics() {
    return {
      bytesReceived: Math.floor(Math.random() * 100000),
      bytesSent: Math.floor(Math.random() * 150000),
      connections: this.stats.activeConnections,
      requestsPerSecond: Math.floor(Math.random() * 200 + 50)
    };
  }
  
  getSystemMetrics() {
    return {
      loadAverage: Math.random() * 2,
      memoryPressure: Math.random() * 0.5,
      diskIO: Math.random() * 100,
      networkIO: Math.random() * 100
    };
  }
  
  getCurrentMetrics() {
    return this.metricsHistory.length > 0 ? 
      this.metricsHistory[this.metricsHistory.length - 1] : 
      this.collectSystemMetrics();
  }
  
  checkAlerts(metrics) {
    const alerts = [];
    
    // Memory usage alert
    if (metrics.memory.heapUsed > 100) {
      alerts.push({
        type: 'warning',
        category: 'memory',
        message: `High memory usage: ${metrics.memory.heapUsed}MB`,
        value: metrics.memory.heapUsed,
        threshold: 100,
        timestamp: Date.now()
      });
    }
    
    // Response time alert
    if (metrics.performance.responseTime > 100) {
      alerts.push({
        type: 'warning',
        category: 'performance',
        message: `High response time: ${Math.round(metrics.performance.responseTime)}ms`,
        value: metrics.performance.responseTime,
        threshold: 100,
        timestamp: Date.now()
      });
    }
    
    // Error rate alert
    if (metrics.performance.errorRate > 0.005) { // 0.5%
      alerts.push({
        type: 'error',
        category: 'errors',
        message: `High error rate: ${(metrics.performance.errorRate * 100).toFixed(2)}%`,
        value: metrics.performance.errorRate,
        threshold: 0.005,
        timestamp: Date.now()
      });
    }
    
    // Cache hit rate alert
    if (metrics.performance.cacheHitRate < 90) {
      alerts.push({
        type: 'info',
        category: 'cache',
        message: `Low cache hit rate: ${Math.round(metrics.performance.cacheHitRate)}%`,
        value: metrics.performance.cacheHitRate,
        threshold: 90,
        timestamp: Date.now()
      });
    }
    
    // Add alerts to history
    alerts.forEach(alert => {
      this.alerts.push(alert);
      this.stats.alertsGenerated++;
    });
    
    // Maintain alerts history
    if (this.alerts.length > 500) {
      this.alerts = this.alerts.slice(-250);
    }
    
    // Broadcast alerts
    if (alerts.length > 0) {
      this.broadcastAlerts(alerts);
    }
  }
  
  broadcastMetrics(metrics) {
    const message = JSON.stringify({
      type: 'metrics',
      data: metrics
    });
    
    this.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(message);
        } catch (error) {
          console.error('Error sending metrics:', error);
          this.clients.delete(client);
        }
      }
    });
  }
  
  broadcastAlerts(alerts) {
    const message = JSON.stringify({
      type: 'alerts',
      data: alerts
    });
    
    this.clients.forEach(client => {
      if (client.readyState === 1) {
        try {
          client.send(message);
        } catch (error) {
          console.error('Error sending alerts:', error);
          this.clients.delete(client);
        }
      }
    });
  }
  
  getComprehensiveStats() {
    const uptime = Date.now() - this.stats.startTime;
    const currentMetrics = this.getCurrentMetrics();
    
    return {
      uptime: Math.floor(uptime / 1000),
      connections: {
        total: this.stats.totalConnections,
        active: this.stats.activeConnections
      },
      data: {
        points: this.stats.dataPoints,
        historySize: this.metricsHistory.length,
        maxHistory: this.options.historySize
      },
      alerts: {
        total: this.stats.alertsGenerated,
        recent: this.alerts.length
      },
      current: currentMetrics,
      performance: {
        avgResponseTime: this.calculateAverageResponseTime(),
        avgThroughput: this.calculateAverageThroughput(),
        avgCacheHitRate: this.calculateAverageCacheHitRate()
      }
    };
  }
  
  calculateAverageResponseTime() {
    if (this.metricsHistory.length === 0) return 0;
    
    const recent = this.metricsHistory.slice(-20); // Last 20 data points
    const sum = recent.reduce((acc, metrics) => acc + (metrics.performance?.responseTime || 0), 0);
    return Math.round(sum / recent.length);
  }
  
  calculateAverageThroughput() {
    if (this.metricsHistory.length === 0) return 0;
    
    const recent = this.metricsHistory.slice(-20);
    const sum = recent.reduce((acc, metrics) => acc + (metrics.performance?.throughput || 0), 0);
    return Math.round(sum / recent.length);
  }
  
  calculateAverageCacheHitRate() {
    if (this.metricsHistory.length === 0) return 0;
    
    const recent = this.metricsHistory.slice(-20);
    const sum = recent.reduce((acc, metrics) => acc + (metrics.performance?.cacheHitRate || 0), 0);
    return Math.round(sum / recent.length);
  }
  
  generateDashboardHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Dashboard - Phase 2 Autonomous Optimization</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            overflow-x: auto;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            color: white;
        }
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .dashboard {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 15px;
            padding: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .card h2 {
            color: #5a67d8;
            margin-bottom: 15px;
            font-size: 1.3rem;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #eee;
        }
        .metric:last-child {
            border-bottom: none;
        }
        .metric-value {
            font-weight: bold;
            color: #2d3748;
        }
        .status {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: bold;
        }
        .status.excellent { background: #48bb78; color: white; }
        .status.good { background: #38b2ac; color: white; }
        .status.warning { background: #ed8936; color: white; }
        .status.critical { background: #e53e3e; color: white; }
        .chart-container {
            height: 200px;
            margin-top: 15px;
            background: #f7fafc;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #718096;
        }
        .alerts {
            max-height: 300px;
            overflow-y: auto;
        }
        .alert {
            padding: 10px;
            margin: 5px 0;
            border-radius: 5px;
            font-size: 0.9rem;
        }
        .alert.info { background: #bee3f8; color: #2a69ac; }
        .alert.warning { background: #faf089; color: #744210; }
        .alert.error { background: #fed7e2; color: #97266d; }
        .connection-status {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            border-radius: 25px;
            font-weight: bold;
            font-size: 0.9rem;
        }
        .connected {
            background: #48bb78;
            color: white;
        }
        .disconnected {
            background: #e53e3e;
            color: white;
        }
        .footer {
            text-align: center;
            color: rgba(255, 255, 255, 0.8);
            margin-top: 30px;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Performance Dashboard</h1>
            <p>Phase 2 Autonomous Optimization - Real-Time Monitoring</p>
        </div>
        
        <div class="connection-status disconnected" id="connectionStatus">
            🔴 Connecting...
        </div>
        
        <div class="dashboard">
            <div class="card">
                <h2>📊 System Performance</h2>
                <div class="metric">
                    <span>Response Time</span>
                    <span class="metric-value" id="responseTime">-- ms</span>
                </div>
                <div class="metric">
                    <span>Throughput</span>
                    <span class="metric-value" id="throughput">-- req/s</span>
                </div>
                <div class="metric">
                    <span>Error Rate</span>
                    <span class="metric-value" id="errorRate">--%</span>
                </div>
                <div class="metric">
                    <span>Cache Hit Rate</span>
                    <span class="metric-value" id="cacheHitRate">--%</span>
                </div>
            </div>
            
            <div class="card">
                <h2>💾 Memory Usage</h2>
                <div class="metric">
                    <span>Heap Used</span>
                    <span class="metric-value" id="heapUsed">-- MB</span>
                </div>
                <div class="metric">
                    <span>Heap Total</span>
                    <span class="metric-value" id="heapTotal">-- MB</span>
                </div>
                <div class="metric">
                    <span>External</span>
                    <span class="metric-value" id="external">-- MB</span>
                </div>
                <div class="metric">
                    <span>RSS</span>
                    <span class="metric-value" id="rss">-- MB</span>
                </div>
            </div>
            
            <div class="card">
                <h2>🌐 Network Activity</h2>
                <div class="metric">
                    <span>Active Connections</span>
                    <span class="metric-value" id="activeConnections">--</span>
                </div>
                <div class="metric">
                    <span>Requests/Second</span>
                    <span class="metric-value" id="requestsPerSecond">--</span>
                </div>
                <div class="metric">
                    <span>Queue Length</span>
                    <span class="metric-value" id="queueLength">--</span>
                </div>
            </div>
            
            <div class="card">
                <h2>⚡ System Health</h2>
                <div class="metric">
                    <span>Overall Status</span>
                    <span class="status excellent" id="overallStatus">Excellent</span>
                </div>
                <div class="metric">
                    <span>Uptime</span>
                    <span class="metric-value" id="uptime">--</span>
                </div>
                <div class="metric">
                    <span>Data Points</span>
                    <span class="metric-value" id="dataPoints">--</span>
                </div>
                <div class="metric">
                    <span>Alerts Generated</span>
                    <span class="metric-value" id="alertsGenerated">--</span>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>🚨 Recent Alerts</h2>
            <div class="alerts" id="alertsContainer">
                <p>No recent alerts</p>
            </div>
        </div>
        
        <div class="footer">
            <p>🤖 Autonomous Optimization Dashboard v2.0 | Last Updated: <span id="lastUpdated">--</span></p>
        </div>
    </div>
    
    <script>
        class DashboardClient {
            constructor() {
                this.ws = null;
                this.reconnectInterval = 5000;
                this.metrics = {};
                this.alerts = [];
                this.connect();
            }
            
            connect() {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = \`\${protocol}//\${window.location.host}\`;
                
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    console.log('Connected to dashboard');
                    this.updateConnectionStatus(true);
                };
                
                this.ws.onmessage = (event) => {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                };
                
                this.ws.onclose = () => {
                    console.log('Disconnected from dashboard');
                    this.updateConnectionStatus(false);
                    setTimeout(() => this.connect(), this.reconnectInterval);
                };
                
                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                };
            }
            
            handleMessage(message) {
                switch (message.type) {
                    case 'init':
                        this.metrics = message.data.recentMetrics[message.data.recentMetrics.length - 1] || {};
                        this.updateDashboard();
                        break;
                    case 'metrics':
                        this.metrics = message.data;
                        this.updateDashboard();
                        break;
                    case 'alerts':
                        this.alerts = message.data;
                        this.updateAlerts();
                        break;
                }
            }
            
            updateConnectionStatus(connected) {
                const statusEl = document.getElementById('connectionStatus');
                statusEl.className = \`connection-status \${connected ? 'connected' : 'disconnected'}\`;
                statusEl.textContent = connected ? '🟢 Connected' : '🔴 Disconnected';
            }
            
            updateDashboard() {
                if (!this.metrics.performance) return;
                
                // Performance metrics
                document.getElementById('responseTime').textContent = \`\${Math.round(this.metrics.performance.responseTime)} ms\`;
                document.getElementById('throughput').textContent = \`\${Math.round(this.metrics.performance.throughput)} req/s\`;
                document.getElementById('errorRate').textContent = \`\${(this.metrics.performance.errorRate * 100).toFixed(2)}%\`;
                document.getElementById('cacheHitRate').textContent = \`\${Math.round(this.metrics.performance.cacheHitRate)}%\`;
                
                // Memory metrics
                if (this.metrics.memory) {
                    document.getElementById('heapUsed').textContent = \`\${this.metrics.memory.heapUsed} MB\`;
                    document.getElementById('heapTotal').textContent = \`\${this.metrics.memory.heapTotal} MB\`;
                    document.getElementById('external').textContent = \`\${this.metrics.memory.external} MB\`;
                    document.getElementById('rss').textContent = \`\${this.metrics.memory.rss} MB\`;
                }
                
                // Network metrics
                if (this.metrics.network) {
                    document.getElementById('activeConnections').textContent = this.metrics.network.connections;
                    document.getElementById('requestsPerSecond').textContent = this.metrics.network.requestsPerSecond;
                }
                document.getElementById('queueLength').textContent = this.metrics.performance.queueLength;
                
                // System health
                const responseTime = this.metrics.performance.responseTime;
                let status = 'excellent';
                let statusText = 'Excellent';
                
                if (responseTime > 100) {
                    status = 'critical';
                    statusText = 'Critical';
                } else if (responseTime > 75) {
                    status = 'warning';
                    statusText = 'Warning';
                } else if (responseTime > 50) {
                    status = 'good';
                    statusText = 'Good';
                }
                
                const statusEl = document.getElementById('overallStatus');
                statusEl.className = \`status \${status}\`;
                statusEl.textContent = statusText;
                
                // Update timestamp
                document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();
            }
            
            updateAlerts() {
                const container = document.getElementById('alertsContainer');
                
                if (this.alerts.length === 0) {
                    container.innerHTML = '<p>No recent alerts</p>';
                    return;
                }
                
                container.innerHTML = this.alerts.map(alert => \`
                    <div class="alert \${alert.type}">
                        <strong>\${alert.category.toUpperCase()}</strong>: \${alert.message}
                        <small style="display: block; margin-top: 5px;">\${new Date(alert.timestamp).toLocaleString()}</small>
                    </div>
                \`).join('');
            }
        }
        
        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', () => {
            new DashboardClient();
        });
    </script>
</body>
</html>
    `;
  }
}

export default PerformanceDashboard;

// Auto-start if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const dashboard = new PerformanceDashboard();
  
  dashboard.start().then(() => {
    console.log('🚀 Performance Dashboard started successfully');
  }).catch((error) => {
    console.error('❌ Failed to start dashboard:', error);
    process.exit(1);
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n📊 Shutting down performance dashboard...');
    await dashboard.stop();
    process.exit(0);
  });
}
