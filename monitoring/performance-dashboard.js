import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import os from 'os';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Real-time Performance Dashboard
 * Advanced monitoring with Socket.IO, live metrics, and optimization tracking
 */
class PerformanceDashboard {
  constructor(options = {}) {
    this.config = {
      port: options.port || 3001,
      updateInterval: options.updateInterval || 2000, // 2 seconds
      alertThresholds: {
        memoryPercent: options.memoryThreshold || 85,
        cpuPercent: options.cpuThreshold || 80,
        diskPercent: options.diskThreshold || 90,
        responseTime: options.responseTimeThreshold || 1000
      },
      enableAlerts: options.enableAlerts !== false,
      enableLogging: options.enableLogging !== false,
      maxMetricsHistory: options.maxMetricsHistory || 100,
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
      startTime: Date.now(),
      history: [],
      optimizations: [],
      alerts: [],
      connections: 0
    };
    
    this.optimizationPredictions = [];
    this.intervalId = null;
    
    this.log('Performance Dashboard initialized', {
      port: this.config.port,
      updateInterval: this.config.updateInterval,
      alertsEnabled: this.config.enableAlerts
    });
    
    this.setupApp();
    this.setupSocketHandlers();
  }
  
  log(message, data = null) {
    if (this.config.enableLogging) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [Dashboard] ${message}`);
      if (data) {
        console.log('  Data:', JSON.stringify(data, null, 2));
      }
    }
  }
  
  setupApp() {
    // Middleware
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    // Routes
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        uptime: Date.now() - this.metrics.startTime,
        connections: this.metrics.connections,
        metricsHistory: this.metrics.history.length,
        optimizations: this.metrics.optimizations.length,
        alerts: this.metrics.alerts.length
      });
    });
    
    this.app.get('/api/metrics', (req, res) => {
      const currentMetrics = this.captureSystemMetrics();
      res.json({
        current: currentMetrics,
        history: this.metrics.history.slice(-20), // Last 20 entries
        optimizations: this.metrics.optimizations,
        alerts: this.metrics.alerts.slice(-10) // Last 10 alerts
      });
    });
    
    this.app.post('/api/optimization', (req, res) => {
      try {
        const { action, data } = req.body;
        
        if (action === 'start') {
          this.log('Optimization started via API');
          const optimizationRecord = {
            id: Date.now(),
            type: data.type || 'manual',
            startTime: Date.now(),
            status: 'running',
            ...data
          };
          
          this.metrics.optimizations.push(optimizationRecord);
          this.broadcastUpdate('optimization_started', optimizationRecord);
          
          res.json({ success: true, optimization: optimizationRecord });
          
        } else if (action === 'complete') {
          const { optimizationId, results } = data;
          const optimization = this.metrics.optimizations.find(opt => opt.id === optimizationId);
          
          if (optimization) {
            optimization.status = 'completed';
            optimization.endTime = Date.now();
            optimization.duration = optimization.endTime - optimization.startTime;
            optimization.results = results;
            
            this.log('Optimization completed', {
              id: optimizationId,
              duration: optimization.duration,
              success: results?.success
            });
            
            this.broadcastUpdate('optimization_completed', optimization);
            res.json({ success: true, optimization });
          } else {
            res.status(404).json({ success: false, error: 'Optimization not found' });
          }
          
        } else {
          res.status(400).json({ success: false, error: 'Invalid action' });
        }
        
      } catch (error) {
        this.log('API optimization error', error.message);
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    this.app.get('/api/predictions', (req, res) => {
      const predictions = this.generateOptimizationPredictions();
      res.json({
        predictions,
        nextOptimizationRecommended: this.getNextOptimizationTime(),
        systemLoad: this.getCurrentSystemLoad()
      });
    });
    
    // Dashboard HTML route
    this.app.get('/api/dashboard', (req, res) => {
      res.send(this.generateDashboardHTML());
    });
  }
  
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      this.metrics.connections++;
      this.log(`Client connected (total: ${this.metrics.connections})`);
      
      // Send initial data
      socket.emit('initial_data', {
        metrics: this.captureSystemMetrics(),
        history: this.metrics.history.slice(-50),
        optimizations: this.metrics.optimizations,
        alerts: this.metrics.alerts.slice(-10)
      });
      
      socket.on('disconnect', () => {
        this.metrics.connections--;
        this.log(`Client disconnected (total: ${this.metrics.connections})`);
      });
      
      socket.on('request_optimization', (data) => {
        this.log('Optimization requested via socket', data);
        const optimizationRecord = {
          id: Date.now(),
          type: data.type || 'manual',
          startTime: Date.now(),
          status: 'requested',
          requestedBy: 'dashboard',
          ...data
        };
        
        this.metrics.optimizations.push(optimizationRecord);
        this.broadcastUpdate('optimization_requested', optimizationRecord);
      });
    });
  }
  
  captureSystemMetrics() {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const loadAvg = os.loadavg();
      
      return {
        timestamp: Date.now(),
        memory: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
          rss: memUsage.rss,
          heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
          usagePercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
          cores: os.cpus().length,
          loadAverage: loadAvg
        },
        system: {
          uptime: os.uptime(),
          platform: os.platform(),
          arch: os.arch(),
          hostname: os.hostname(),
          freeMemoryMB: Math.round(os.freemem() / 1024 / 1024),
          totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
          memoryUsagePercent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)
        },
        performance: {
          nodeUptime: process.uptime(),
          pid: process.pid,
          version: process.version,
          performanceNow: performance.now()
        }
      };
    } catch (error) {
      this.log('Error capturing system metrics', error.message);
      return {
        timestamp: Date.now(),
        error: error.message
      };
    }
  }
  
  checkAlerts(metrics) {
    if (!this.config.enableAlerts) return;
    
    const alerts = [];
    
    // Memory alert
    if (metrics.memory?.usagePercent > this.config.alertThresholds.memoryPercent) {
      alerts.push({
        type: 'memory',
        level: 'warning',
        message: `High memory usage: ${metrics.memory.usagePercent}%`,
        threshold: this.config.alertThresholds.memoryPercent,
        current: metrics.memory.usagePercent,
        timestamp: Date.now()
      });
    }
    
    // System memory alert
    if (metrics.system?.memoryUsagePercent > this.config.alertThresholds.memoryPercent) {
      alerts.push({
        type: 'system_memory',
        level: 'warning',
        message: `High system memory usage: ${metrics.system.memoryUsagePercent}%`,
        threshold: this.config.alertThresholds.memoryPercent,
        current: metrics.system.memoryUsagePercent,
        timestamp: Date.now()
      });
    }
    
    // CPU load alert
    const avgLoad = metrics.cpu?.loadAverage?.[0] || 0;
    const cpuPercent = (avgLoad / metrics.cpu?.cores || 1) * 100;
    
    if (cpuPercent > this.config.alertThresholds.cpuPercent) {
      alerts.push({
        type: 'cpu',
        level: 'warning',
        message: `High CPU load: ${cpuPercent.toFixed(1)}%`,
        threshold: this.config.alertThresholds.cpuPercent,
        current: cpuPercent,
        timestamp: Date.now()
      });
    }
    
    // Add alerts and broadcast
    if (alerts.length > 0) {
      this.metrics.alerts.push(...alerts);
      
      // Keep only recent alerts
      if (this.metrics.alerts.length > 100) {
        this.metrics.alerts = this.metrics.alerts.slice(-50);
      }
      
      this.broadcastUpdate('alerts', alerts);
      
      alerts.forEach(alert => {
        this.log(`ALERT [${alert.level}] ${alert.message}`);
      });
    }
  }
  
  generateOptimizationPredictions() {
    if (this.metrics.history.length < 5) {
      return { error: 'Insufficient data for predictions' };
    }
    
    const recent = this.metrics.history.slice(-10);
    const avgMemory = recent.reduce((sum, m) => sum + (m.memory?.usagePercent || 0), 0) / recent.length;
    const avgSystemMemory = recent.reduce((sum, m) => sum + (m.system?.memoryUsagePercent || 0), 0) / recent.length;
    const memoryTrend = this.calculateTrend(recent.map(m => m.memory?.usagePercent || 0));
    
    // Simple prediction algorithm
    const predictions = {
      nextOptimizationScore: Math.max(0, Math.min(100, 85 - (avgMemory * 0.8) - (avgSystemMemory * 0.2))),
      memoryOptimizationNeeded: avgMemory > 70,
      systemOptimizationNeeded: avgSystemMemory > 80,
      trend: memoryTrend > 0 ? 'increasing' : memoryTrend < 0 ? 'decreasing' : 'stable',
      recommendedAction: this.getRecommendedAction(avgMemory, avgSystemMemory),
      confidence: Math.min(1.0, this.metrics.history.length / 20),
      timestamp: Date.now()
    };
    
    this.optimizationPredictions.push(predictions);
    
    // Keep only recent predictions
    if (this.optimizationPredictions.length > 50) {
      this.optimizationPredictions = this.optimizationPredictions.slice(-25);
    }
    
    return predictions;
  }
  
  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    let trend = 0;
    for (let i = 1; i < values.length; i++) {
      trend += values[i] - values[i-1];
    }
    return trend / (values.length - 1);
  }
  
  getRecommendedAction(avgMemory, avgSystemMemory) {
    if (avgMemory > 85 || avgSystemMemory > 90) {
      return 'immediate_optimization_required';
    } else if (avgMemory > 75 || avgSystemMemory > 80) {
      return 'optimization_recommended';
    } else if (avgMemory > 60 || avgSystemMemory > 70) {
      return 'light_optimization_suggested';
    } else {
      return 'system_performing_well';
    }
  }
  
  getNextOptimizationTime() {
    const lastOptimization = this.metrics.optimizations.slice(-1)[0];
    if (!lastOptimization) {
      return Date.now(); // Immediate if no previous optimization
    }
    
    const timeSinceLastOptimization = Date.now() - (lastOptimization.endTime || lastOptimization.startTime);
    const recommendedInterval = 30 * 60 * 1000; // 30 minutes
    
    return Math.max(Date.now(), (lastOptimization.endTime || lastOptimization.startTime) + recommendedInterval);
  }
  
  getCurrentSystemLoad() {
    const current = this.captureSystemMetrics();
    return {
      memoryLoad: current.memory?.usagePercent || 0,
      systemMemoryLoad: current.system?.memoryUsagePercent || 0,
      cpuLoad: current.cpu?.loadAverage?.[0] || 0,
      overallHealth: this.calculateOverallHealth(current)
    };
  }
  
  calculateOverallHealth(metrics) {
    const memoryScore = Math.max(0, 100 - (metrics.memory?.usagePercent || 0));
    const systemMemoryScore = Math.max(0, 100 - (metrics.system?.memoryUsagePercent || 0));
    const cpuScore = Math.max(0, 100 - ((metrics.cpu?.loadAverage?.[0] || 0) / (metrics.cpu?.cores || 1)) * 100);
    
    return Math.round((memoryScore * 0.4 + systemMemoryScore * 0.4 + cpuScore * 0.2));
  }
  
  broadcastUpdate(event, data) {
    this.io.emit(event, data);
  }
  
  startMonitoring() {
    this.log('Starting real-time monitoring', {
      interval: this.config.updateInterval,
      alertsEnabled: this.config.enableAlerts
    });
    
    this.intervalId = setInterval(() => {
      const metrics = this.captureSystemMetrics();
      
      // Add to history
      this.metrics.history.push(metrics);
      
      // Trim history
      if (this.metrics.history.length > this.config.maxMetricsHistory) {
        this.metrics.history = this.metrics.history.slice(-this.config.maxMetricsHistory);
      }
      
      // Check for alerts
      this.checkAlerts(metrics);
      
      // Generate predictions
      const predictions = this.generateOptimizationPredictions();
      
      // Broadcast update to connected clients
      this.broadcastUpdate('metrics_update', {
        metrics,
        predictions,
        systemLoad: this.getCurrentSystemLoad()
      });
      
    }, this.config.updateInterval);
  }
  
  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.log('Real-time monitoring stopped');
    }
  }
  
  generateDashboardHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Dashboard - Ultra Concurrent Optimization</title>
    <script src="https://cdn.socket.io/4.5.0/socket.io.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
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
            font-size: 2.5rem;
            margin-bottom: 10px;
        }
        .status-bar {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-bottom: 30px;
        }
        .status-card {
            background: rgba(255, 255, 255, 0.9);
            border-radius: 10px;
            padding: 15px 25px;
            min-width: 150px;
            text-align: center;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }
        .status-value {
            font-size: 2rem;
            font-weight: bold;
            color: #4CAF50;
        }
        .status-label {
            font-size: 0.9rem;
            color: #666;
            margin-top: 5px;
        }
        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .dashboard-card {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        }
        .card-title {
            font-size: 1.3rem;
            font-weight: 600;
            margin-bottom: 20px;
            color: #333;
            border-bottom: 2px solid #f0f0f0;
            padding-bottom: 10px;
        }
        .metric-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .metric-label {
            font-weight: 500;
        }
        .metric-value {
            font-weight: bold;
            color: #2196F3;
        }
        .chart-container {
            position: relative;
            height: 300px;
            margin-top: 20px;
        }
        .alert {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 10px 15px;
            border-radius: 8px;
            margin-bottom: 10px;
        }
        .alert.warning {
            background: #f8d7da;
            border-color: #f5c6cb;
            color: #721c24;
        }
        .optimization-item {
            background: #e8f5e8;
            border-left: 4px solid #4CAF50;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 0 8px 8px 0;
        }
        .optimization-item.running {
            background: #fff3cd;
            border-left-color: #ffc107;
        }
        .prediction-card {
            background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .prediction-score {
            font-size: 3rem;
            font-weight: bold;
            text-align: center;
            color: #1976d2;
        }
        .btn {
            background: #2196F3;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1rem;
            margin: 5px;
        }
        .btn:hover {
            background: #1976d2;
        }
        .btn.success {
            background: #4CAF50;
        }
        .btn.warning {
            background: #ff9800;
        }
        .connection-status {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            border-radius: 20px;
            font-weight: bold;
            z-index: 1000;
        }
        .connected {
            background: #4CAF50;
            color: white;
        }
        .disconnected {
            background: #f44336;
            color: white;
        }
    </style>
</head>
<body>
    <div class="connection-status" id="connectionStatus">Connecting...</div>
    
    <div class="container">
        <div class="header">
            <h1>🚀 Ultra Performance Dashboard</h1>
            <p>Real-time System Monitoring & Optimization Control</p>
        </div>
        
        <div class="status-bar">
            <div class="status-card">
                <div class="status-value" id="overallHealth">--</div>
                <div class="status-label">Overall Health</div>
            </div>
            <div class="status-card">
                <div class="status-value" id="memoryUsage">--</div>
                <div class="status-label">Memory Usage</div>
            </div>
            <div class="status-card">
                <div class="status-value" id="cpuLoad">--</div>
                <div class="status-label">CPU Load</div>
            </div>
            <div class="status-card">
                <div class="status-value" id="connections">--</div>
                <div class="status-label">Connections</div>
            </div>
        </div>
        
        <div class="dashboard-grid">
            <div class="dashboard-card">
                <div class="card-title">📊 System Metrics</div>
                <div id="systemMetrics"></div>
                <div class="chart-container">
                    <canvas id="metricsChart"></canvas>
                </div>
            </div>
            
            <div class="dashboard-card">
                <div class="card-title">🔮 Optimization Predictions</div>
                <div id="predictions"></div>
                <div style="text-align: center; margin-top: 20px;">
                    <button class="btn" onclick="requestOptimization('memory')">Optimize Memory</button>
                    <button class="btn success" onclick="requestOptimization('full')">Full Optimization</button>
                    <button class="btn warning" onclick="requestOptimization('cpu')">CPU Optimization</button>
                </div>
            </div>
            
            <div class="dashboard-card">
                <div class="card-title">⚡ Recent Optimizations</div>
                <div id="optimizations"></div>
            </div>
            
            <div class="dashboard-card">
                <div class="card-title">⚠️ System Alerts</div>
                <div id="alerts"></div>
            </div>
        </div>
    </div>

    <script>
        // Initialize Socket.IO connection
        const socket = io();
        let metricsChart;
        
        // Connection status
        socket.on('connect', () => {
            updateConnectionStatus(true);
        });
        
        socket.on('disconnect', () => {
            updateConnectionStatus(false);
        });
        
        function updateConnectionStatus(connected) {
            const status = document.getElementById('connectionStatus');
            status.textContent = connected ? 'Connected' : 'Disconnected';
            status.className = 'connection-status ' + (connected ? 'connected' : 'disconnected');
        }
        
        // Initialize metrics chart
        function initChart() {
            const ctx = document.getElementById('metricsChart').getContext('2d');
            metricsChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Memory Usage (%)',
                            data: [],
                            borderColor: '#2196F3',
                            backgroundColor: 'rgba(33, 150, 243, 0.1)',
                            tension: 0.4
                        },
                        {
                            label: 'System Memory (%)',
                            data: [],
                            borderColor: '#4CAF50',
                            backgroundColor: 'rgba(76, 175, 80, 0.1)',
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top'
                        }
                    }
                }
            });
        }
        
        // Handle initial data
        socket.on('initial_data', (data) => {
            updateDashboard(data.metrics, data.history);
            updateOptimizations(data.optimizations);
            updateAlerts(data.alerts);
        });
        
        // Handle real-time updates
        socket.on('metrics_update', (data) => {
            updateDashboard(data.metrics);
            updatePredictions(data.predictions);
            updateStatusBar(data.systemLoad);
        });
        
        socket.on('optimization_started', (optimization) => {
            updateOptimizations([optimization]);
        });
        
        socket.on('optimization_completed', (optimization) => {
            updateOptimizations([optimization]);
        });
        
        socket.on('alerts', (alerts) => {
            updateAlerts(alerts);
        });
        
        function updateDashboard(metrics, history = null) {
            // Update system metrics
            const systemMetrics = document.getElementById('systemMetrics');
            systemMetrics.innerHTML = \`
                <div class="metric-row">
                    <div class="metric-label">Heap Memory</div>
                    <div class="metric-value">\${metrics.memory?.heapUsedMB || 0} MB / \${metrics.memory?.heapTotalMB || 0} MB</div>
                </div>
                <div class="metric-row">
                    <div class="metric-label">Memory Usage</div>
                    <div class="metric-value">\${metrics.memory?.usagePercent || 0}%</div>
                </div>
                <div class="metric-row">
                    <div class="metric-label">System Memory</div>
                    <div class="metric-value">\${metrics.system?.memoryUsagePercent || 0}%</div>
                </div>
                <div class="metric-row">
                    <div class="metric-label">CPU Cores</div>
                    <div class="metric-value">\${metrics.cpu?.cores || 0}</div>
                </div>
                <div class="metric-row">
                    <div class="metric-label">Process Uptime</div>
                    <div class="metric-value">\${formatDuration(metrics.performance?.nodeUptime || 0)}</div>
                </div>
            \`;
            
            // Update chart
            if (metricsChart) {
                const timestamp = new Date(metrics.timestamp).toLocaleTimeString();
                metricsChart.data.labels.push(timestamp);
                metricsChart.data.datasets[0].data.push(metrics.memory?.usagePercent || 0);
                metricsChart.data.datasets[1].data.push(metrics.system?.memoryUsagePercent || 0);
                
                // Keep only last 20 data points
                if (metricsChart.data.labels.length > 20) {
                    metricsChart.data.labels.shift();
                    metricsChart.data.datasets[0].data.shift();
                    metricsChart.data.datasets[1].data.shift();
                }
                
                metricsChart.update('none');
            }
        }
        
        function updatePredictions(predictions) {
            if (!predictions || predictions.error) return;
            
            const container = document.getElementById('predictions');
            container.innerHTML = \`
                <div class="prediction-card">
                    <div class="prediction-score">\${predictions.nextOptimizationScore?.toFixed(0) || '--'}</div>
                    <div style="text-align: center; margin-top: 10px;">Predicted Performance Score</div>
                </div>
                <div class="metric-row">
                    <div class="metric-label">Memory Optimization Needed</div>
                    <div class="metric-value">\${predictions.memoryOptimizationNeeded ? 'Yes' : 'No'}</div>
                </div>
                <div class="metric-row">
                    <div class="metric-label">System Optimization Needed</div>
                    <div class="metric-value">\${predictions.systemOptimizationNeeded ? 'Yes' : 'No'}</div>
                </div>
                <div class="metric-row">
                    <div class="metric-label">Trend</div>
                    <div class="metric-value">\${predictions.trend || 'Unknown'}</div>
                </div>
                <div class="metric-row">
                    <div class="metric-label">Recommended Action</div>
                    <div class="metric-value">\${predictions.recommendedAction?.replace(/_/g, ' ') || 'None'}</div>
                </div>
            \`;
        }
        
        function updateStatusBar(systemLoad) {
            if (!systemLoad) return;
            
            document.getElementById('overallHealth').textContent = systemLoad.overallHealth || '--';
            document.getElementById('memoryUsage').textContent = \`\${systemLoad.memoryLoad?.toFixed(1) || '--'}%\`;
            document.getElementById('cpuLoad').textContent = systemLoad.cpuLoad?.toFixed(2) || '--';
        }
        
        function updateOptimizations(optimizations) {
            const container = document.getElementById('optimizations');
            const recent = optimizations.slice(-5).reverse(); // Show last 5, most recent first
            
            container.innerHTML = recent.map(opt => \`
                <div class="optimization-item \${opt.status || ''}">
                    <strong>\${opt.type || 'Unknown'} Optimization</strong><br>
                    Status: \${opt.status || 'Unknown'}<br>
                    \${opt.duration ? \`Duration: \${opt.duration}ms<br>\` : ''}
                    \${opt.results?.success ? '✅ Completed Successfully' : opt.status === 'running' ? '⏳ In Progress' : ''}
                </div>
            \`).join('');
        }
        
        function updateAlerts(alerts) {
            const container = document.getElementById('alerts');
            const recent = alerts.slice(-5).reverse(); // Show last 5, most recent first
            
            if (recent.length === 0) {
                container.innerHTML = '<div style="text-align: center; color: #4CAF50; padding: 20px;">✅ No alerts - System running smoothly</div>';
                return;
            }
            
            container.innerHTML = recent.map(alert => \`
                <div class="alert \${alert.level || ''}">
                    <strong>\${alert.type?.replace('_', ' ').toUpperCase() || 'ALERT'}</strong><br>
                    \${alert.message || 'No message'}<br>
                    <small>\${new Date(alert.timestamp).toLocaleString()}</small>
                </div>
            \`).join('');
        }
        
        function requestOptimization(type) {
            socket.emit('request_optimization', {
                type: type,
                requestTime: Date.now()
            });
        }
        
        function formatDuration(seconds) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            return \`\${hours}h \${minutes}m \${secs}s\`;
        }
        
        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', () => {
            initChart();
        });
        
        // Update connections count
        setInterval(() => {
            fetch('/api/health')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('connections').textContent = data.connections || 0;
                })
                .catch(() => {});
        }, 5000);
    </script>
</body>
</html>
    `;
  }
  
  start() {
    return new Promise((resolve) => {
      this.server.listen(this.config.port, '0.0.0.0', () => {
        this.log(`Performance Dashboard started`, {
          port: this.config.port,
          dashboardUrl: `http://0.0.0.0:${this.config.port}/api/dashboard`,
          apiUrl: `http://0.0.0.0:${this.config.port}/api`
        });
        
        console.log('\n🎛️ Performance Dashboard - Ultra Concurrent Monitoring');
        console.log('=' .repeat(70));
        console.log(`🌐 Dashboard URL: http://localhost:${this.config.port}/api/dashboard`);
        console.log(`📊 Metrics API: http://localhost:${this.config.port}/api/metrics`);
        console.log(`💓 Health Check: http://localhost:${this.config.port}/api/health`);
        console.log(`🔮 Predictions: http://localhost:${this.config.port}/api/predictions`);
        console.log(`⚡ WebSocket: Real-time updates enabled`);
        console.log('=' .repeat(70));
        
        this.startMonitoring();
        resolve(this.server);
      });
    });
  }
  
  stop() {
    return new Promise((resolve) => {
      this.stopMonitoring();
      this.server.close(() => {
        this.log('Performance Dashboard stopped');
        resolve();
      });
    });
  }
}

// Main execution when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const dashboard = new PerformanceDashboard({
    port: process.env.DASHBOARD_PORT || 3001,
    enableAlerts: true,
    enableLogging: true,
    updateInterval: 2000
  });
  
  dashboard.start().catch(error => {
    console.error('Failed to start dashboard:', error);
    process.exit(1);
  });
  
  // Graceful shutdown
  const gracefulShutdown = (signal) => {
    console.log(`\n🚨 Received ${signal}, shutting down dashboard...`);
    dashboard.stop().then(() => {
      console.log('✅ Dashboard shutdown complete');
      process.exit(0);
    });
  };
  
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

export { PerformanceDashboard };
export default PerformanceDashboard;
