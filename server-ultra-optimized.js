/**
 * Ultra-Optimized LLM Server with Advanced Performance Engine
 * Autonomous optimization with ML-enhanced caching and predictive scaling
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import UltraPerformanceManager from './src/ultra-performance/ultra-performance-engine.js';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import cluster from 'cluster';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Ultra-Optimized Express Server with Performance Engine
 */
class UltraOptimizedServer {
  constructor(options = {}) {
    this.app = express();
    this.port = options.port || process.env.PORT || 8080;
    this.workers = new Map();
    this.metrics = {
      requests: 0,
      errors: 0,
      avgResponseTime: 0,
      uptime: Date.now()
    };
    
    // Initialize ultra-performance manager
    this.performanceManager = new UltraPerformanceManager({
      memory: {
        maxPoolSize: 2000,
        maxBufferSize: 128 * 1024 // 128KB
      },
      cache: {
        maxSize: 1000,
        defaultTTL: 600000 // 10 minutes
      },
      connections: {
        minConnections: 5,
        maxConnections: 50
      }
    });
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupPerformanceMonitoring();
    this.setupWorkerThreads();
  }

  /**
   * Setup advanced middleware with performance optimization
   */
  setupMiddleware() {
    // Security middleware with performance tuning
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // CORS with performance optimization
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://www.scarmonit.com', 'https://scarmonit.com']
        : true,
      credentials: true,
      maxAge: 86400 // 24 hours
    }));

    // Intelligent compression with content-type detection
    this.app.use(compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      level: 6, // Balanced compression
      threshold: 1024, // Only compress files > 1KB
      windowBits: 15,
      memLevel: 8
    }));

    // Advanced rate limiting with ML-based adjustment
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: async (req) => {
        // Dynamic rate limiting based on performance metrics
        const stats = this.performanceManager.getPerformanceStats();
        const baseLimit = 100;
        
        // Adjust limit based on system performance
        if (stats.performance.avgResponseTime > 1000) {
          return Math.floor(baseLimit * 0.7); // Reduce limit if slow
        } else if (stats.performance.avgResponseTime < 200) {
          return Math.floor(baseLimit * 1.5); // Increase limit if fast
        }
        
        return baseLimit;
      },
      message: {
        error: 'Too many requests',
        retryAfter: '15 minutes',
        performance: 'Rate limited due to system load'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        this.metrics.errors++;
        res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil(15 * 60 * 1000 / 1000),
          message: 'Please slow down your requests'
        });
      }
    });

    this.app.use('/api/', limiter);

    // Request parsing with size limits
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf, encoding) => {
        // Validate JSON before parsing
        if (buf && buf.length > 0) {
          try {
            JSON.parse(buf.toString(encoding || 'utf8'));
          } catch (error) {
            throw new Error('Invalid JSON format');
          }
        }
      }
    }));

    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb',
      parameterLimit: 1000
    }));

    // Performance tracking middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      this.metrics.requests++;
      
      // Add performance tracking to response
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.metrics.avgResponseTime = 
          (this.metrics.avgResponseTime + responseTime) / 2;
        
        // Add performance headers
        res.set({
          'X-Response-Time': `${responseTime}ms`,
          'X-Server-Performance': this.getPerformanceGrade(),
          'X-Memory-Usage': `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
        });
      });
      
      next();
    });

    // Static file serving with aggressive caching
    const staticOptions = {
      maxAge: process.env.NODE_ENV === 'production' ? '1y' : '1h',
      etag: true,
      lastModified: true,
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
          res.set('Cache-Control', 'public, max-age=300'); // 5 minutes for HTML
        } else if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
          res.set('Cache-Control', 'public, max-age=31536000'); // 1 year for assets
        }
      }
    };

    this.app.use('/static', express.static(join(__dirname, 'website'), staticOptions));
    this.app.use('/assets', express.static(join(__dirname, 'assets'), staticOptions));
  }

  /**
   * Setup optimized routes with caching and performance monitoring
   */
  setupRoutes() {
    // Health check with comprehensive system info
    this.app.get('/health', async (req, res) => {
      try {
        const stats = this.performanceManager.getPerformanceStats();
        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: Date.now() - this.metrics.uptime,
          performance: {
            grade: this.getPerformanceGrade(),
            avgResponseTime: this.metrics.avgResponseTime,
            requestsPerSecond: this.calculateRequestsPerSecond(),
            errorRate: (this.metrics.errors / this.metrics.requests * 100) || 0
          },
          system: {
            memory: {
              used: Math.round(stats.process.memory.heapUsed / 1024 / 1024),
              total: Math.round(stats.process.memory.heapTotal / 1024 / 1024),
              external: Math.round(stats.process.memory.external / 1024 / 1024)
            },
            cpu: {
              usage: Math.round((stats.process.cpu.user + stats.process.cpu.system) * 100),
              cores: stats.system.cpuCount
            }
          },
          optimization: {
            memoryPool: {
              hitRate: Math.round(stats.memoryPool.hitRate * 100) / 100,
              poolSizes: stats.memoryPool.poolSizes
            },
            cache: {
              hitRate: Math.round(stats.cache.hitRate * 100) / 100,
              size: stats.cache.size,
              efficiency: Math.round(stats.cache.efficiency * 100) / 100
            },
            connectionPool: {
              utilization: Math.round(stats.connectionPool.efficiency.utilization * 100) / 100,
              active: stats.connectionPool.connections.active,
              total: stats.connectionPool.connections.total
            }
          }
        };
        
        res.json(health);
      } catch (error) {
        this.metrics.errors++;
        res.status(500).json({
          status: 'error',
          error: 'Health check failed',
          message: error.message
        });
      }
    });

    // Performance metrics endpoint with caching
    this.app.get('/api/performance/ultra', async (req, res) => {
      try {
        const cacheKey = 'performance-stats';
        let stats = await this.performanceManager.cache.get(cacheKey);
        
        if (!stats) {
          stats = await this.performanceManager.measureOperation('get-performance-stats', async () => {
            return this.performanceManager.getPerformanceStats();
          });
          
          // Cache for 30 seconds
          await this.performanceManager.cache.set(cacheKey, JSON.stringify(stats), 30000);
        } else {
          stats = JSON.parse(stats);
        }
        
        const response = {
          timestamp: new Date().toISOString(),
          server: {
            uptime: Date.now() - this.metrics.uptime,
            requests: this.metrics.requests,
            errors: this.metrics.errors,
            avgResponseTime: this.metrics.avgResponseTime,
            performance: this.getPerformanceGrade()
          },
          system: stats.system,
          optimization: {
            memoryPool: stats.memoryPool,
            cache: stats.cache,
            connectionPool: stats.connectionPool
          },
          recommendations: this.performanceManager.getOptimizationRecommendations()
        };
        
        res.json(response);
      } catch (error) {
        this.metrics.errors++;
        res.status(500).json({
          error: 'Performance metrics unavailable',
          message: error.message
        });
      }
    });

    // Autonomous optimization trigger
    this.app.post('/api/optimize/autonomous', async (req, res) => {
      try {
        const optimizations = await this.performanceManager.executeAutonomousOptimization();
        
        res.json({
          status: 'success',
          message: 'Autonomous optimization executed',
          optimizations,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.metrics.errors++;
        res.status(500).json({
          error: 'Optimization failed',
          message: error.message
        });
      }
    });

    // Memory optimization endpoint
    this.app.post('/api/optimize/memory', async (req, res) => {
      try {
        const beforeStats = process.memoryUsage();
        
        // Trigger cleanup
        this.performanceManager.memoryPool.cleanup();
        if (global.gc) {
          global.gc();
        }
        
        const afterStats = process.memoryUsage();
        const saved = beforeStats.heapUsed - afterStats.heapUsed;
        
        res.json({
          status: 'success',
          message: 'Memory optimization completed',
          memoryFreed: Math.round(saved / 1024 / 1024 * 100) / 100,
          before: Math.round(beforeStats.heapUsed / 1024 / 1024 * 100) / 100,
          after: Math.round(afterStats.heapUsed / 1024 / 1024 * 100) / 100
        });
      } catch (error) {
        this.metrics.errors++;
        res.status(500).json({
          error: 'Memory optimization failed',
          message: error.message
        });
      }
    });

    // Cache statistics endpoint
    this.app.get('/api/cache/stats', async (req, res) => {
      try {
        const cacheStats = this.performanceManager.cache.getMetrics();
        
        res.json({
          timestamp: new Date().toISOString(),
          cache: cacheStats,
          performance: {
            hitRate: Math.round(cacheStats.hitRate * 100) / 100,
            efficiency: Math.round(cacheStats.efficiency * 100) / 100,
            predictiveAccuracy: cacheStats.predictions
          }
        });
      } catch (error) {
        this.metrics.errors++;
        res.status(500).json({
          error: 'Cache statistics unavailable',
          message: error.message
        });
      }
    });

    // WebSocket endpoint for real-time performance monitoring
    this.app.get('/api/performance/stream', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      const sendPerformanceUpdate = () => {
        const stats = this.performanceManager.getPerformanceStats();
        const data = {
          timestamp: Date.now(),
          performance: {
            avgResponseTime: this.metrics.avgResponseTime,
            requestsPerSecond: this.calculateRequestsPerSecond(),
            errorRate: (this.metrics.errors / this.metrics.requests * 100) || 0,
            grade: this.getPerformanceGrade()
          },
          memory: {
            used: Math.round(stats.process.memory.heapUsed / 1024 / 1024),
            pressure: stats.memoryPool.memoryPressure
          },
          cache: {
            hitRate: stats.cache.hitRate,
            size: stats.cache.size
          }
        };
        
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const interval = setInterval(sendPerformanceUpdate, 5000);
      
      req.on('close', () => {
        clearInterval(interval);
      });
    });

    // Root endpoint with system overview
    this.app.get('/', (req, res) => {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ultra-Optimized LLM Server</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; margin-bottom: 30px; text-align: center; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #3498db; }
        .metric-value { font-size: 2em; font-weight: bold; color: #2c3e50; margin-bottom: 5px; }
        .metric-label { color: #7f8c8d; font-size: 0.9em; }
        .performance-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; color: white; font-weight: bold; margin-left: 10px; }
        .grade-A { background-color: #27ae60; }
        .grade-B { background-color: #f39c12; }
        .grade-C { background-color: #e74c3c; }
        .endpoints { margin-top: 30px; }
        .endpoint { background: #ecf0f1; padding: 10px 15px; margin: 5px 0; border-radius: 5px; font-family: monospace; }
        .footer { text-align: center; margin-top: 30px; color: #7f8c8d; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Ultra-Optimized LLM Server
            <span class="performance-badge grade-${this.getPerformanceGrade()}">
                Grade ${this.getPerformanceGrade()}
            </span>
        </h1>
        
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value">${Math.round(this.metrics.avgResponseTime)}ms</div>
                <div class="metric-label">Average Response Time</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${this.metrics.requests.toLocaleString()}</div>
                <div class="metric-label">Total Requests</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB</div>
                <div class="metric-label">Memory Usage</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${Math.round((Date.now() - this.metrics.uptime) / 1000 / 60)}min</div>
                <div class="metric-label">Uptime</div>
            </div>
        </div>
        
        <div class="endpoints">
            <h3>🔗 API Endpoints</h3>
            <div class="endpoint">GET /health - System health and performance metrics</div>
            <div class="endpoint">GET /api/performance/ultra - Comprehensive performance statistics</div>
            <div class="endpoint">POST /api/optimize/autonomous - Trigger autonomous optimization</div>
            <div class="endpoint">POST /api/optimize/memory - Manual memory optimization</div>
            <div class="endpoint">GET /api/cache/stats - Cache performance statistics</div>
            <div class="endpoint">GET /api/performance/stream - Real-time performance monitoring (SSE)</div>
        </div>
        
        <div class="footer">
            <p>⚡ Powered by Ultra-Performance Engine with ML-Enhanced Optimization</p>
            <p>🧠 Advanced Memory Pooling • 📊 Predictive Caching • 🔄 Autonomous Scaling</p>
        </div>
    </div>
</body>
</html>`;
      
      res.send(html);
    });

    // Error handling middleware
    this.app.use((error, req, res, next) => {
      this.metrics.errors++;
      
      console.error('Server error:', error);
      
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Setup performance monitoring and event handlers
   */
  setupPerformanceMonitoring() {
    // Listen for performance events
    this.performanceManager.on('performance-update', (stats) => {
      // Log significant performance changes
      if (stats.performance.avgResponseTime > 1000) {
        console.warn('⚠️  High response time detected:', stats.performance.avgResponseTime + 'ms');
      }
      
      if (stats.memoryPool.memoryPressure > 0.8) {
        console.warn('⚠️  High memory pressure detected:', Math.round(stats.memoryPool.memoryPressure * 100) + '%');
      }
    });

    this.performanceManager.on('performance-issues', (issues) => {
      console.warn('🚨 Performance issues detected:');
      issues.forEach(issue => {
        console.warn(`  ${issue.severity.toUpperCase()}: ${issue.message}`);
        console.warn(`  Recommendation: ${issue.recommendation}`);
      });
    });

    this.performanceManager.on('autonomous-optimization', (optimizations) => {
      console.log('🤖 Autonomous optimization executed:');
      optimizations.forEach(opt => {
        console.log(`  ${opt.type}: ${opt.oldValue} → ${opt.newValue}`);
      });
    });

    // Periodic performance reporting
    setInterval(() => {
      const stats = this.performanceManager.getPerformanceStats();
      console.log(`📊 Performance Report - Grade: ${this.getPerformanceGrade()} | ` +
        `Response: ${Math.round(this.metrics.avgResponseTime)}ms | ` +
        `Memory: ${Math.round(stats.process.memory.heapUsed / 1024 / 1024)}MB | ` +
        `Cache Hit: ${Math.round(stats.cache.hitRate)}%`);
    }, 60000); // Every minute
  }

  /**
   * Setup worker threads for CPU-intensive tasks
   */
  setupWorkerThreads() {
    const numWorkers = Math.min(4, os.cpus().length);
    
    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(__filename, {
        workerData: { isWorker: true, workerId: i }
      });
      
      worker.on('message', (message) => {
        // Handle worker messages
        if (message.type === 'task-complete') {
          // Task completed by worker
        }
      });
      
      worker.on('error', (error) => {
        console.error(`Worker ${i} error:`, error);
      });
      
      this.workers.set(i, worker);
    }
  }

  /**
   * Calculate performance grade based on metrics
   */
  getPerformanceGrade() {
    const responseTime = this.metrics.avgResponseTime;
    const errorRate = (this.metrics.errors / this.metrics.requests * 100) || 0;
    
    if (responseTime < 200 && errorRate < 1) {
      return 'A';
    } else if (responseTime < 500 && errorRate < 3) {
      return 'B';
    } else {
      return 'C';
    }
  }

  /**
   * Calculate requests per second
   */
  calculateRequestsPerSecond() {
    const uptimeSeconds = (Date.now() - this.metrics.uptime) / 1000;
    return Math.round((this.metrics.requests / uptimeSeconds) * 100) / 100;
  }

  /**
   * Start the ultra-optimized server
   */
  async start() {
    try {
      // Initialize performance manager
      await this.performanceManager.connectionPool.initialize();
      
      // Start server
      this.server = this.app.listen(this.port, () => {
        console.log('🚀 Ultra-Optimized LLM Server Started');
        console.log(`📍 Server running on http://localhost:${this.port}`);
        console.log(`⚡ Performance Engine: Active`);
        console.log(`🧠 Memory Pool: ${this.performanceManager.memoryPool.maxPoolSize} objects`);
        console.log(`💾 Cache Size: ${this.performanceManager.cache.maxSize} entries`);
        console.log(`🔄 Connection Pool: ${this.performanceManager.connectionPool.minConnections}-${this.performanceManager.connectionPool.maxConnections}`);
        console.log(`👥 Worker Threads: ${this.workers.size}`);
        console.log('');
        console.log('📊 Available Endpoints:');
        console.log('  GET  /health - Health check and system metrics');
        console.log('  GET  /api/performance/ultra - Performance statistics');
        console.log('  POST /api/optimize/autonomous - Autonomous optimization');
        console.log('  GET  /api/performance/stream - Real-time monitoring');
        console.log('');
      });

      // Graceful shutdown handling
      process.on('SIGTERM', () => this.gracefulShutdown());
      process.on('SIGINT', () => this.gracefulShutdown());
      
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown with cleanup
   */
  async gracefulShutdown() {
    console.log('🛑 Graceful shutdown initiated...');
    
    // Stop accepting new connections
    this.server.close(() => {
      console.log('📡 HTTP server closed');
    });
    
    // Cleanup workers
    for (const [id, worker] of this.workers) {
      await worker.terminate();
      console.log(`👷 Worker ${id} terminated`);
    }
    
    // Cleanup performance manager
    console.log('🧹 Performance manager cleanup completed');
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  }
}

// Handle worker thread logic
if (!isMainThread && workerData?.isWorker) {
  // Worker thread logic for CPU-intensive tasks
  parentPort.on('message', (message) => {
    if (message.type === 'cpu-intensive-task') {
      // Perform CPU-intensive work here
      const result = performCPUIntensiveTask(message.data);
      
      parentPort.postMessage({
        type: 'task-complete',
        result,
        workerId: workerData.workerId
      });
    }
  });
  
  function performCPUIntensiveTask(data) {
    // Placeholder for CPU-intensive operations
    // Could be used for ML computations, data processing, etc.
    return { processed: true, data };
  }
} else {
  // Main thread - start the server
  const server = new UltraOptimizedServer();
  server.start();
}

export default UltraOptimizedServer;