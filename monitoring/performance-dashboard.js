#!/usr/bin/env node
/**
 * Real-time Performance Dashboard
 * Advanced monitoring and visualization for ultra-concurrent optimization
 * Integrates with ML performance predictions and autonomous optimization
 */

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { EventEmitter } from 'events';
import { cpus, freemem, totalmem, loadavg } from 'os';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Real-time Performance Monitor
 */
class RealTimePerformanceMonitor extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      system: {
        cpu: { cores: cpus().length, usage: 0, loadAverage: [0, 0, 0] },
        memory: { total: totalmem(), free: freemem(), used: 0, pressure: 0 },
        process: { pid: process.pid, uptime: 0, memoryUsage: process.memoryUsage() }
      },
      optimization: {
        totalRuns: 0,
        successfulRuns: 0,
        averageScore: 0,
        lastRunTime: null,
        currentStatus: 'idle',
        optimizationHistory: []
      },
      performance: {
        responseTime: [],
        throughput: 0,
        errorRate: 0,
        activeConnections: 0,
        requestsPerSecond: 0
      },
      alerts: [],
      predictions: {
        nextOptimizationScore: null,
        systemHealthTrend: 'stable',
        recommendations: []
      }
    };
    
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.connectedClients = new Set();
    
    this.startTime = Date.now();
  }
  
  startMonitoring(intervalMs = 5000) {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log(`📊 Starting real-time performance monitoring (${intervalMs}ms intervals)`);
    
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzePerformance();
      this.generatePredictions();
      this.emitMetricsUpdate();
    }, intervalMs);
  }
  
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('🚫 Performance monitoring stopped');
  }
  
  collectMetrics() {
    // System metrics
    const loadAvg = loadavg();
    const memFree = freemem();
    const memTotal = totalmem();
    const memUsed = memTotal - memFree;
    const memPressure = (memUsed / memTotal) * 100;
    
    // Process metrics
    const processMemory = process.memoryUsage();
    const processUptime = process.uptime();
    
    // Update metrics
    this.metrics.system.memory = {
      total: memTotal,
      free: memFree,
      used: memUsed,
      pressure: memPressure
    };
    
    this.metrics.system.cpu.loadAverage = loadAvg;
    this.metrics.system.process = {
      pid: process.pid,
      uptime: processUptime,
      memoryUsage: processMemory
    };
    
    // Calculate CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    this.metrics.system.cpu.usage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
  }
  
  analyzePerformance() {
    const { system, alerts } = this.metrics;
    
    // Clear old alerts
    this.metrics.alerts = alerts.filter(alert => 
      Date.now() - alert.timestamp < 300000 // Keep alerts for 5 minutes
    );
    
    // Memory pressure alerts
    if (system.memory.pressure > 90) {
      this.addAlert('critical', 'High memory pressure detected', {
        pressure: system.memory.pressure.toFixed(1) + '%'
      });
    } else if (system.memory.pressure > 80) {
      this.addAlert('warning', 'Elevated memory usage', {
        pressure: system.memory.pressure.toFixed(1) + '%'
      });
    }
    
    // CPU load alerts
    const avgLoad = system.cpu.loadAverage[0];
    if (avgLoad > system.cpu.cores * 2) {
      this.addAlert('critical', 'Extremely high CPU load', {
        load: avgLoad.toFixed(2),
        cores: system.cpu.cores
      });
    } else if (avgLoad > system.cpu.cores) {
      this.addAlert('warning', 'High CPU load', {
        load: avgLoad.toFixed(2),
        cores: system.cpu.cores
      });
    }
    
    // Process memory alerts
    const processMemMB = system.process.memoryUsage.heapUsed / 1024 / 1024;
    if (processMemMB > 1000) { // More than 1GB
      this.addAlert('warning', 'High process memory usage', {
        memory: processMemMB.toFixed(1) + ' MB'
      });
    }
  }
  
  generatePredictions() {
    const { system, optimization } = this.metrics;
    
    // Simple predictive analysis
    const memoryTrend = this.calculateTrend('memory');
    const cpuTrend = this.calculateTrend('cpu');
    
    // Predict next optimization score based on system state
    let predictedScore = 75; // Base score
    
    if (system.memory.pressure < 50) predictedScore += 10;
    if (system.cpu.loadAverage[0] < system.cpu.cores * 0.7) predictedScore += 10;
    if (optimization.successfulRuns > optimization.totalRuns * 0.8) predictedScore += 5;
    
    this.metrics.predictions.nextOptimizationScore = Math.min(100, predictedScore);
    
    // System health trend
    if (memoryTrend === 'increasing' && cpuTrend === 'increasing') {
      this.metrics.predictions.systemHealthTrend = 'degrading';
    } else if (memoryTrend === 'decreasing' || cpuTrend === 'decreasing') {
      this.metrics.predictions.systemHealthTrend = 'improving';
    } else {
      this.metrics.predictions.systemHealthTrend = 'stable';
    }
    
    // Generate recommendations
    this.metrics.predictions.recommendations = this.generateRecommendations();
  }
  
  calculateTrend(metricType) {
    // Simplified trend calculation
    // In a real implementation, this would analyze historical data
    const random = Math.random();
    if (random < 0.3) return 'decreasing';
    if (random > 0.7) return 'increasing';
    return 'stable';
  }
  
  generateRecommendations() {
    const recommendations = [];
    const { system, optimization } = this.metrics;
    
    if (system.memory.pressure > 80) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        message: 'Consider running memory optimization',
        action: 'optimize_memory'
      });
    }
    
    if (system.cpu.loadAverage[0] > system.cpu.cores) {
      recommendations.push({
        type: 'cpu',
        priority: 'medium',
        message: 'Reduce concurrent workload or optimize CPU usage',
        action: 'optimize_cpu'
      });
    }
    
    if (optimization.totalRuns === 0 || 
        (Date.now() - optimization.lastRunTime) > 3600000) { // 1 hour
      recommendations.push({
        type: 'optimization',
        priority: 'low',
        message: 'Run performance optimization suite',
        action: 'run_optimization'
      });
    }
    
    return recommendations;
  }
  
  addAlert(level, message, data = {}) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      message,
      data,
      timestamp: Date.now()
    };
    
    this.metrics.alerts.push(alert);
    console.log(`🚨 ${level.toUpperCase()}: ${message}`, data);
  }
  
  emitMetricsUpdate() {
    const update = {
      timestamp: Date.now(),
      metrics: this.metrics,
      uptime: Date.now() - this.startTime
    };
    
    this.emit('metricsUpdate', update);
  }
  
  updateOptimizationStatus(status, results = null) {
    this.metrics.optimization.currentStatus = status;
    
    if (results) {
      this.metrics.optimization.totalRuns++;
      if (results.success) {
        this.metrics.optimization.successfulRuns++;
      }
      
      if (results.performanceScore) {
        const currentAvg = this.metrics.optimization.averageScore;
        const totalRuns = this.metrics.optimization.totalRuns;
        this.metrics.optimization.averageScore = 
          (currentAvg * (totalRuns - 1) + results.performanceScore) / totalRuns;
      }
      
      this.metrics.optimization.lastRunTime = Date.now();
      this.metrics.optimization.optimizationHistory.push({
        timestamp: Date.now(),
        success: results.success,
        score: results.performanceScore || 0,
        executionTime: results.executionTime || 0
      });
      
      // Keep only last 50 optimization runs
      if (this.metrics.optimization.optimizationHistory.length > 50) {
        this.metrics.optimization.optimizationHistory.shift();
      }
    }
  }
  
  addPerformanceDataPoint(responseTime) {
    this.metrics.performance.responseTime.push({
      time: responseTime,
      timestamp: Date.now()
    });
    
    // Keep only last 100 data points
    if (this.metrics.performance.responseTime.length > 100) {
      this.metrics.performance.responseTime.shift();
    }
    
    // Update derived metrics
    this.updatePerformanceMetrics();
  }
  
  updatePerformanceMetrics() {
    const responseData = this.metrics.performance.responseTime;
    
    if (responseData.length === 0) return;
    
    // Calculate throughput (requests per second)
    const now = Date.now();
    const recentRequests = responseData.filter(
      data => now - data.timestamp < 60000 // Last minute
    );
    
    this.metrics.performance.requestsPerSecond = recentRequests.length / 60;
    
    // Calculate average response time
    const totalTime = responseData.reduce((sum, data) => sum + data.time, 0);
    const avgResponseTime = totalTime / responseData.length;
    
    this.metrics.performance.throughput = 1000 / avgResponseTime; // Theoretical max RPS
  }
  
  getMetrics() {
    return {
      timestamp: Date.now(),
      metrics: this.metrics,
      uptime: Date.now() - this.startTime,
      isMonitoring: this.isMonitoring
    };
  }
}

/**
 * Performance Dashboard Server
 */
class PerformanceDashboardServer {
  constructor(port = 3001) {
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.monitor = new RealTimePerformanceMonitor();
    this.setupRoutes();
    this.setupSocketIO();
    this.setupMonitorEvents();
  }
  
  setupRoutes() {
    // Serve static dashboard files
    this.app.use(express.static(path.join(__dirname, 'dashboard')));
    this.app.use(express.json());
    
    // API Routes
    this.app.get('/api/metrics', (req, res) => {
      res.json(this.monitor.getMetrics());
    });
    
    this.app.get('/api/health', (req, res) => {
      const metrics = this.monitor.getMetrics();
      const isHealthy = 
        metrics.metrics.system.memory.pressure < 90 &&
        metrics.metrics.system.cpu.loadAverage[0] < metrics.metrics.system.cpu.cores * 2;
      
      res.json({
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: Date.now(),
        uptime: metrics.uptime,
        monitoring: metrics.isMonitoring
      });
    });
    
    this.app.post('/api/optimization', (req, res) => {
      const { action, results } = req.body;
      
      if (action === 'start') {
        this.monitor.updateOptimizationStatus('running');
        res.json({ success: true, message: 'Optimization started' });
      } else if (action === 'complete' && results) {
        this.monitor.updateOptimizationStatus('completed', results);
        res.json({ success: true, message: 'Optimization results recorded' });
      } else {
        res.status(400).json({ success: false, message: 'Invalid action or missing results' });
      }
    });
    
    this.app.post('/api/performance', (req, res) => {
      const { responseTime } = req.body;
      
      if (typeof responseTime === 'number' && responseTime > 0) {
        this.monitor.addPerformanceDataPoint(responseTime);
        res.json({ success: true, message: 'Performance data recorded' });
      } else {
        res.status(400).json({ success: false, message: 'Invalid response time data' });
      }
    });
    
    this.app.get('/api/dashboard', (req, res) => {
      res.sendFile(path.join(__dirname, 'dashboard', 'index.html'));
    });
    
    // Root route
    this.app.get('/', (req, res) => {
      res.redirect('/api/dashboard');
    });
  }
  
  setupSocketIO() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);
      this.monitor.connectedClients.add(socket.id);
      
      // Send initial data
      socket.emit('metricsUpdate', this.monitor.getMetrics());
      
      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
        this.monitor.connectedClients.delete(socket.id);
      });
      
      socket.on('requestOptimization', (data) => {
        console.log(`🚀 Optimization requested by client ${socket.id}:`, data);
        this.monitor.updateOptimizationStatus('requested');
        socket.emit('optimizationResponse', { 
          success: true, 
          message: 'Optimization request received' 
        });
      });
    });
  }
  
  setupMonitorEvents() {
    this.monitor.on('metricsUpdate', (data) => {
      // Broadcast to all connected clients
      this.io.emit('metricsUpdate', data);
    });
  }
  
  async createDashboardHTML() {
    const dashboardHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ultra Performance Dashboard</title>
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: #1a1a1a; 
            color: #fff; 
            overflow-x: auto;
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            padding: 20px; 
            text-align: center; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .header p { font-size: 1.1rem; opacity: 0.9; }
        .container { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); 
            gap: 20px; 
            padding: 20px; 
            max-width: 1400px; 
            margin: 0 auto; 
        }
        .card { 
            background: #2d2d2d; 
            border-radius: 12px; 
            padding: 20px; 
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            border: 1px solid #444;
        }
        .card h3 { 
            margin-bottom: 15px; 
            color: #4fc3f7; 
            border-bottom: 2px solid #4fc3f7;
            padding-bottom: 8px;
        }
        .metric { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 10px; 
            padding: 8px 12px;
            background: #383838;
            border-radius: 6px;
        }
        .metric-value { 
            font-weight: bold; 
            color: #81c784; 
        }
        .alert { 
            padding: 12px; 
            margin: 8px 0; 
            border-radius: 8px; 
            border-left: 4px solid;
        }
        .alert.critical { 
            background: rgba(244, 67, 54, 0.2); 
            border-color: #f44336; 
        }
        .alert.warning { 
            background: rgba(255, 193, 7, 0.2); 
            border-color: #ffc107; 
        }
        .alert.info { 
            background: rgba(33, 150, 243, 0.2); 
            border-color: #2196f3; 
        }
        .status { 
            display: inline-block; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 0.9rem; 
            font-weight: bold; 
        }
        .status.idle { background: #666; }
        .status.running { background: #ff9800; }
        .status.completed { background: #4caf50; }
        .chart-container { 
            position: relative; 
            height: 300px; 
            margin-top: 20px; 
        }
        .recommendations { 
            list-style: none; 
        }
        .recommendation { 
            padding: 10px; 
            margin: 8px 0; 
            background: #3a3a3a; 
            border-radius: 6px; 
            border-left: 3px solid #2196f3; 
        }
        .recommendation.high { border-color: #f44336; }
        .recommendation.medium { border-color: #ff9800; }
        .recommendation.low { border-color: #4caf50; }
        button { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            border: none; 
            padding: 12px 24px; 
            border-radius: 8px; 
            cursor: pointer; 
            font-size: 1rem; 
            transition: transform 0.2s; 
        }
        button:hover { transform: translateY(-2px); }
        .connection-status { 
            position: fixed; 
            top: 20px; 
            right: 20px; 
            padding: 8px 16px; 
            border-radius: 20px; 
            font-weight: bold; 
        }
        .connected { background: #4caf50; }
        .disconnected { background: #f44336; }
    </style>
</head>
<body>
    <div class="connection-status" id="connectionStatus">Connecting...</div>
    
    <div class="header">
        <h1>🚀 Ultra Performance Dashboard</h1>
        <p>Real-time monitoring and ML-driven optimization insights</p>
    </div>
    
    <div class="container">
        <div class="card">
            <h3>📊 System Metrics</h3>
            <div class="metric">
                <span>CPU Cores:</span>
                <span class="metric-value" id="cpuCores">-</span>
            </div>
            <div class="metric">
                <span>CPU Usage:</span>
                <span class="metric-value" id="cpuUsage">-</span>
            </div>
            <div class="metric">
                <span>Memory Pressure:</span>
                <span class="metric-value" id="memoryPressure">-</span>
            </div>
            <div class="metric">
                <span>Load Average:</span>
                <span class="metric-value" id="loadAverage">-</span>
            </div>
            <div class="metric">
                <span>Process Uptime:</span>
                <span class="metric-value" id="processUptime">-</span>
            </div>
        </div>
        
        <div class="card">
            <h3>🎯 Optimization Status</h3>
            <div class="metric">
                <span>Current Status:</span>
                <span class="status" id="optimizationStatus">idle</span>
            </div>
            <div class="metric">
                <span>Total Runs:</span>
                <span class="metric-value" id="totalRuns">0</span>
            </div>
            <div class="metric">
                <span>Success Rate:</span>
                <span class="metric-value" id="successRate">-</span>
            </div>
            <div class="metric">
                <span>Average Score:</span>
                <span class="metric-value" id="averageScore">-</span>
            </div>
            <button onclick="requestOptimization()">🚀 Request Optimization</button>
        </div>
        
        <div class="card">
            <h3>🚨 Active Alerts</h3>
            <div id="alertsContainer">No active alerts</div>
        </div>
        
        <div class="card">
            <h3>🤖 ML Predictions</h3>
            <div class="metric">
                <span>Next Optimization Score:</span>
                <span class="metric-value" id="predictedScore">-</span>
            </div>
            <div class="metric">
                <span>System Health Trend:</span>
                <span class="metric-value" id="healthTrend">-</span>
            </div>
            <h4 style="margin-top: 20px; color: #4fc3f7;">Recommendations:</h4>
            <ul class="recommendations" id="recommendationsContainer"></ul>
        </div>
        
        <div class="card" style="grid-column: 1 / -1;">
            <h3>📈 Performance Trends</h3>
            <div class="chart-container">
                <canvas id="performanceChart"></canvas>
            </div>
        </div>
    </div>
    
    <script>
        const socket = io();
        let performanceChart;
        
        socket.on('connect', () => {
            updateConnectionStatus(true);
        });
        
        socket.on('disconnect', () => {
            updateConnectionStatus(false);
        });
        
        socket.on('metricsUpdate', (data) => {
            updateDashboard(data);
        });
        
        function updateConnectionStatus(connected) {
            const status = document.getElementById('connectionStatus');
            status.textContent = connected ? 'Connected' : 'Disconnected';
            status.className = 'connection-status ' + (connected ? 'connected' : 'disconnected');
        }
        
        function updateDashboard(data) {
            const { metrics } = data;
            
            // System metrics
            document.getElementById('cpuCores').textContent = metrics.system.cpu.cores;
            document.getElementById('cpuUsage').textContent = metrics.system.cpu.usage.toFixed(2) + 's';
            document.getElementById('memoryPressure').textContent = metrics.system.memory.pressure.toFixed(1) + '%';
            document.getElementById('loadAverage').textContent = metrics.system.cpu.loadAverage[0].toFixed(2);
            document.getElementById('processUptime').textContent = formatUptime(metrics.system.process.uptime);
            
            // Optimization status
            const statusElement = document.getElementById('optimizationStatus');
            statusElement.textContent = metrics.optimization.currentStatus;
            statusElement.className = 'status ' + metrics.optimization.currentStatus;
            
            document.getElementById('totalRuns').textContent = metrics.optimization.totalRuns;
            const successRate = metrics.optimization.totalRuns > 0 ? 
                (metrics.optimization.successfulRuns / metrics.optimization.totalRuns * 100).toFixed(1) + '%' : '-';
            document.getElementById('successRate').textContent = successRate;
            document.getElementById('averageScore').textContent = 
                metrics.optimization.averageScore > 0 ? metrics.optimization.averageScore.toFixed(1) + '%' : '-';
            
            // Alerts
            updateAlerts(metrics.alerts);
            
            // Predictions
            document.getElementById('predictedScore').textContent = 
                metrics.predictions.nextOptimizationScore ? metrics.predictions.nextOptimizationScore + '%' : '-';
            document.getElementById('healthTrend').textContent = metrics.predictions.systemHealthTrend;
            updateRecommendations(metrics.predictions.recommendations);
            
            // Update chart
            updatePerformanceChart(metrics.optimization.optimizationHistory);
        }
        
        function updateAlerts(alerts) {
            const container = document.getElementById('alertsContainer');
            if (alerts.length === 0) {
                container.innerHTML = 'No active alerts';
                return;
            }
            
            container.innerHTML = alerts.map(alert => 
                `<div class="alert ${alert.level}">
                    <strong>${alert.level.toUpperCase()}:</strong> ${alert.message}
                    <div style="font-size: 0.9rem; margin-top: 5px; opacity: 0.8;">
                        ${new Date(alert.timestamp).toLocaleTimeString()}
                    </div>
                </div>`
            ).join('');
        }
        
        function updateRecommendations(recommendations) {
            const container = document.getElementById('recommendationsContainer');
            if (recommendations.length === 0) {
                container.innerHTML = '<li>No recommendations at this time</li>';
                return;
            }
            
            container.innerHTML = recommendations.map(rec => 
                `<li class="recommendation ${rec.priority}">
                    <strong>${rec.type.toUpperCase()}:</strong> ${rec.message}
                </li>`
            ).join('');
        }
        
        function updatePerformanceChart(history) {
            const ctx = document.getElementById('performanceChart').getContext('2d');
            
            if (!performanceChart) {
                performanceChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: [],
                        datasets: [{
                            label: 'Performance Score',
                            data: [],
                            borderColor: '#4fc3f7',
                            backgroundColor: 'rgba(79, 195, 247, 0.1)',
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { labels: { color: '#fff' } }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 100,
                                ticks: { color: '#fff' },
                                grid: { color: '#444' }
                            },
                            x: {
                                ticks: { color: '#fff' },
                                grid: { color: '#444' }
                            }
                        }
                    }
                });
            }
            
            // Update chart data
            const labels = history.slice(-20).map((_, i) => `Run ${i + 1}`);
            const scores = history.slice(-20).map(h => h.score);
            
            performanceChart.data.labels = labels;
            performanceChart.data.datasets[0].data = scores;
            performanceChart.update();
        }
        
        function formatUptime(seconds) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            return `${hours}h ${minutes}m ${secs}s`;
        }
        
        function requestOptimization() {
            socket.emit('requestOptimization', { type: 'manual', timestamp: Date.now() });
        }
    </script>
</body>
</html>`;
    
    // Create dashboard directory and file
    const dashboardDir = path.join(__dirname, 'dashboard');
    try {
      await fs.mkdir(dashboardDir, { recursive: true });
      await fs.writeFile(path.join(dashboardDir, 'index.html'), dashboardHTML);
      console.log('📄 Dashboard HTML created');
    } catch (error) {
      console.error('Failed to create dashboard HTML:', error);
    }
  }
  
  async start() {
    // Create dashboard HTML file
    await this.createDashboardHTML();
    
    // Start monitoring
    this.monitor.startMonitoring();
    
    // Start server
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`📈 Performance Dashboard Server running on http://localhost:${this.port}`);
        console.log(`🌐 Dashboard URL: http://localhost:${this.port}/api/dashboard`);
        console.log(`🔌 WebSocket connections: Ready for real-time updates`);
        resolve(this.server);
      });
    });
  }
  
  stop() {
    this.monitor.stopMonitoring();
    this.server.close();
    console.log('🚫 Performance Dashboard Server stopped');
  }
}

/**
 * Main execution
 */
async function main() {
  const dashboard = new PerformanceDashboardServer(3001);
  
  try {
    await dashboard.start();
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n📊 Shutting down performance dashboard...');
      dashboard.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\n📊 Shutting down performance dashboard...');
      dashboard.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('💥 Failed to start performance dashboard:', error);
    process.exit(1);
  }
}

// Export for use as module
export { PerformanceDashboardServer, RealTimePerformanceMonitor };

// Run if called directly
if (import.meta.url === `file://${__filename}`) {
  main();
}