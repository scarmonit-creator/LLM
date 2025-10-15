// Real-Time Performance Monitoring Dashboard
// Comprehensive system monitoring with WebSocket-based live updates

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { performance, PerformanceObserver } from 'perf_hooks';
import os from 'os';
import process from 'process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    free: number;
    total: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  performance: {
    uptime: number;
    activeHandles: number;
    activeRequests: number;
  };
  network?: {
    connections: number;
    bytesIn: number;
    bytesOut: number;
  };
}

interface APIMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: number;
  userAgent?: string;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
  evictions: number;
  timestamp: number;
}

class PerformanceDashboard {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private port: number;
  private metricsHistory: SystemMetrics[];
  private apiMetricsHistory: APIMetrics[];
  private cacheMetricsHistory: CacheMetrics[];
  private performanceObserver: PerformanceObserver;
  private metricsInterval: NodeJS.Timeout | null = null;
  private readonly maxHistorySize = 1000;

  constructor(port: number = 8081) {
    this.port = port;
    this.metricsHistory = [];
    this.apiMetricsHistory = [];
    this.cacheMetricsHistory = [];
    
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    this.setupPerformanceObserver();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  private setupPerformanceObserver(): void {
    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        if (entry.entryType === 'measure') {
          this.recordAPIMetric({
            endpoint: entry.name,
            method: 'MEASURE',
            responseTime: entry.duration,
            statusCode: 200,
            timestamp: Date.now()
          });
        }
      }
    });
    
    this.performanceObserver.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
  }

  private setupRoutes(): void {
    // Serve dashboard HTML
    this.app.get('/', (req, res) => {
      res.send(this.getDashboardHTML());
    });

    // API endpoints for metrics
    this.app.get('/api/metrics/system', (req, res) => {
      res.json({
        current: this.getCurrentSystemMetrics(),
        history: this.metricsHistory.slice(-100) // Last 100 entries
      });
    });

    this.app.get('/api/metrics/api', (req, res) => {
      res.json({
        recent: this.apiMetricsHistory.slice(-100),
        summary: this.getAPIMetricsSummary()
      });
    });

    this.app.get('/api/metrics/cache', (req, res) => {
      res.json({
        current: this.getCurrentCacheMetrics(),
        history: this.cacheMetricsHistory.slice(-50)
      });
    });

    // Prometheus metrics endpoint
    this.app.get('/metrics', (req, res) => {
      res.set('Content-Type', 'text/plain');
      res.send(this.generatePrometheusMetrics());
    });

    // Health check
    this.app.get('/health', (req, res) => {
      const metrics = this.getCurrentSystemMetrics();
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        metrics: {
          memoryUsage: `${Math.round(metrics.memory.used / 1024 / 1024)}MB`,
          cpuUsage: `${metrics.cpu.usage.toFixed(1)}%`,
          uptime: `${Math.round(metrics.performance.uptime / 3600)}h`
        }
      });
    });
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log('📊 Dashboard client connected');
      
      // Send initial data
      socket.emit('system-metrics', this.getCurrentSystemMetrics());
      socket.emit('api-metrics', this.getAPIMetricsSummary());
      socket.emit('cache-metrics', this.getCurrentCacheMetrics());
      
      socket.on('disconnect', () => {
        console.log('📊 Dashboard client disconnected');
      });
      
      socket.on('request-history', (type: string) => {
        switch (type) {
          case 'system':
            socket.emit('system-history', this.metricsHistory.slice(-100));
            break;
          case 'api':
            socket.emit('api-history', this.apiMetricsHistory.slice(-100));
            break;
          case 'cache':
            socket.emit('cache-history', this.cacheMetricsHistory.slice(-50));
            break;
        }
      });
    });
  }

  private getCurrentSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAvg = os.loadavg();
    
    return {
      timestamp: Date.now(),
      cpu: {
        usage: process.cpuUsage().user / 1000000, // Convert to percentage approximation
        loadAverage: loadAvg
      },
      memory: {
        used: memUsage.rss,
        free: os.freemem(),
        total: os.totalmem(),
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      },
      performance: {
        uptime: process.uptime(),
        activeHandles: (process as any)._getActiveHandles().length,
        activeRequests: (process as any)._getActiveRequests().length
      }
    };
  }

  private getCurrentCacheMetrics(): CacheMetrics {
    // This would integrate with your actual cache implementation
    // For now, returning mock data
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      maxSize: 1000,
      evictions: 0,
      timestamp: Date.now()
    };
  }

  private getAPIMetricsSummary(): any {
    const recent = this.apiMetricsHistory.slice(-100);
    if (recent.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        requestsPerMinute: 0
      };
    }

    const totalRequests = recent.length;
    const averageResponseTime = recent.reduce((sum, metric) => sum + metric.responseTime, 0) / totalRequests;
    const errorCount = recent.filter(metric => metric.statusCode >= 400).length;
    const errorRate = (errorCount / totalRequests) * 100;
    
    // Calculate requests per minute based on recent data
    const timeSpan = (recent[recent.length - 1].timestamp - recent[0].timestamp) / 1000 / 60;
    const requestsPerMinute = timeSpan > 0 ? totalRequests / timeSpan : 0;

    return {
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      requestsPerMinute: Math.round(requestsPerMinute * 100) / 100
    };
  }

  public recordAPIMetric(metric: APIMetrics): void {
    this.apiMetricsHistory.push(metric);
    
    // Maintain history size
    if (this.apiMetricsHistory.length > this.maxHistorySize) {
      this.apiMetricsHistory.shift();
    }
    
    // Broadcast to connected clients
    this.io.emit('api-metric', metric);
  }

  public recordCacheMetric(metric: CacheMetrics): void {
    this.cacheMetricsHistory.push(metric);
    
    // Maintain history size
    if (this.cacheMetricsHistory.length > this.maxHistorySize) {
      this.cacheMetricsHistory.shift();
    }
    
    // Broadcast to connected clients
    this.io.emit('cache-metric', metric);
  }

  private generatePrometheusMetrics(): string {
    const current = this.getCurrentSystemMetrics();
    const apiSummary = this.getAPIMetricsSummary();
    const cacheSummary = this.getCurrentCacheMetrics();
    
    return `
# HELP node_memory_usage_bytes Memory usage in bytes
# TYPE node_memory_usage_bytes gauge
node_memory_usage_bytes{type="rss"} ${current.memory.used}
node_memory_usage_bytes{type="heap_used"} ${current.memory.heapUsed}
node_memory_usage_bytes{type="heap_total"} ${current.memory.heapTotal}
node_memory_usage_bytes{type="external"} ${current.memory.external}

# HELP node_cpu_usage_percent CPU usage percentage
# TYPE node_cpu_usage_percent gauge
node_cpu_usage_percent ${current.cpu.usage}

# HELP node_load_average Load average
# TYPE node_load_average gauge
node_load_average{period="1m"} ${current.cpu.loadAverage[0]}
node_load_average{period="5m"} ${current.cpu.loadAverage[1]}
node_load_average{period="15m"} ${current.cpu.loadAverage[2]}

# HELP api_requests_total Total API requests
# TYPE api_requests_total counter
api_requests_total ${apiSummary.totalRequests}

# HELP api_response_time_ms Average API response time in milliseconds
# TYPE api_response_time_ms gauge
api_response_time_ms ${apiSummary.averageResponseTime}

# HELP api_error_rate_percent API error rate percentage
# TYPE api_error_rate_percent gauge
api_error_rate_percent ${apiSummary.errorRate}

# HELP cache_hit_rate_percent Cache hit rate percentage
# TYPE cache_hit_rate_percent gauge
cache_hit_rate_percent ${cacheSummary.hitRate}
    `.trim();
  }

  private getDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LLM Framework - Performance Dashboard</title>
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            min-height: 100vh;
            padding: 20px;
        }
        .dashboard { 
            max-width: 1400px; 
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .header h1 {
            font-size: 2.5rem;
            font-weight: 300;
            margin-bottom: 10px;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        .card {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            padding: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .card h3 {
            font-size: 1.2rem;
            margin-bottom: 15px;
            color: #fff;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 10px 0;
            padding: 10px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
        }
        .metric-value {
            font-weight: bold;
            font-size: 1.1rem;
        }
        .status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
        }
        .status.healthy { background: #28a745; }
        .status.warning { background: #ffc107; color: #000; }
        .status.critical { background: #dc3545; }
        .chart-container {
            height: 200px;
            margin-top: 15px;
        }
        .last-updated {
            text-align: center;
            margin-top: 20px;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <h1>🚀 LLM Framework Performance Dashboard</h1>
            <div class="status healthy">System Operational</div>
        </div>
        
        <div class="grid">
            <div class="card">
                <h3>💻 System Metrics</h3>
                <div class="metric">
                    <span>Memory Usage</span>
                    <span class="metric-value" id="memory-usage">0 MB</span>
                </div>
                <div class="metric">
                    <span>CPU Load</span>
                    <span class="metric-value" id="cpu-usage">0%</span>
                </div>
                <div class="metric">
                    <span>Uptime</span>
                    <span class="metric-value" id="uptime">0h</span>
                </div>
                <div class="chart-container">
                    <canvas id="system-chart"></canvas>
                </div>
            </div>
            
            <div class="card">
                <h3>🌐 API Performance</h3>
                <div class="metric">
                    <span>Avg Response Time</span>
                    <span class="metric-value" id="avg-response">0 ms</span>
                </div>
                <div class="metric">
                    <span>Requests/Min</span>
                    <span class="metric-value" id="requests-per-min">0</span>
                </div>
                <div class="metric">
                    <span>Error Rate</span>
                    <span class="metric-value" id="error-rate">0%</span>
                </div>
                <div class="chart-container">
                    <canvas id="api-chart"></canvas>
                </div>
            </div>
            
            <div class="card">
                <h3>💾 Cache Performance</h3>
                <div class="metric">
                    <span>Hit Rate</span>
                    <span class="metric-value" id="cache-hit-rate">0%</span>
                </div>
                <div class="metric">
                    <span>Cache Size</span>
                    <span class="metric-value" id="cache-size">0 / 1000</span>
                </div>
                <div class="metric">
                    <span>Evictions</span>
                    <span class="metric-value" id="cache-evictions">0</span>
                </div>
                <div class="chart-container">
                    <canvas id="cache-chart"></canvas>
                </div>
            </div>
        </div>
        
        <div class="last-updated">
            Last updated: <span id="last-updated">--</span>
        </div>
    </div>

    <script>
        const socket = io();
        
        // Initialize charts
        const systemChart = new Chart(document.getElementById('system-chart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Memory (MB)',
                    data: [],
                    borderColor: '#4CAF50',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: false },
                    y: { beginAtZero: true }
                }
            }
        });
        
        // Socket event handlers
        socket.on('system-metrics', (data) => {
            document.getElementById('memory-usage').textContent = Math.round(data.memory.used / 1024 / 1024) + ' MB';
            document.getElementById('cpu-usage').textContent = data.cpu.usage.toFixed(1) + '%';
            document.getElementById('uptime').textContent = Math.round(data.performance.uptime / 3600) + 'h';
            
            // Update chart
            const memoryMB = Math.round(data.memory.used / 1024 / 1024);
            systemChart.data.labels.push(new Date().toLocaleTimeString());
            systemChart.data.datasets[0].data.push(memoryMB);
            
            if (systemChart.data.labels.length > 20) {
                systemChart.data.labels.shift();
                systemChart.data.datasets[0].data.shift();
            }
            
            systemChart.update('none');
            document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();
        });
        
        socket.on('api-metric', (data) => {
            // Update API metrics display
        });
        
        socket.on('cache-metric', (data) => {
            document.getElementById('cache-hit-rate').textContent = data.hitRate.toFixed(1) + '%';
            document.getElementById('cache-size').textContent = data.size + ' / ' + data.maxSize;
            document.getElementById('cache-evictions').textContent = data.evictions;
        });
        
        // Request initial data
        socket.emit('request-history', 'system');
    </script>
</body>
</html>
    `.trim();
  }

  public start(): void {
    // Start metrics collection
    this.metricsInterval = setInterval(() => {
      const metrics = this.getCurrentSystemMetrics();
      this.metricsHistory.push(metrics);
      
      // Maintain history size
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.shift();
      }
      
      // Broadcast to connected clients
      this.io.emit('system-metrics', metrics);
    }, 5000); // Every 5 seconds
    
    // Start server
    this.server.listen(this.port, () => {
      console.log(`📊 Performance Dashboard running on http://localhost:${this.port}`);
    });
  }

  public stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    this.performanceObserver.disconnect();
    this.server.close();
  }

  // Middleware for Express to automatically track API metrics
  public getExpressMiddleware() {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.recordAPIMetric({
          endpoint: req.path,
          method: req.method,
          responseTime: duration,
          statusCode: res.statusCode,
          timestamp: Date.now(),
          userAgent: req.get('User-Agent')
        });
      });
      
      next();
    };
  }
}

export { PerformanceDashboard, type SystemMetrics, type APIMetrics, type CacheMetrics };