#!/usr/bin/env node
/**
 * Ultra-Optimized Server - Maximum Performance Configuration
 * Enhanced with clustering, caching, compression, and real-time monitoring
 */

import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { LRUCache } from 'lru-cache';
import cluster from 'cluster';
import os from 'os';
import { fileURLToPath } from 'url';
import path from 'path';
import { Worker } from 'worker_threads';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ultra-performance configuration
const ULTRA_CONFIG = {
  clustering: {
    enabled: os.cpus().length > 1,
    workers: Math.min(os.cpus().length, 6),
    respawn: true,
    gracefulShutdown: 10000
  },
  compression: {
    level: 6,
    threshold: 512,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    }
  },
  caching: {
    maxEntries: 2000,
    ttl: 5 * 60 * 1000, // 5 minutes
    updateAgeOnGet: true,
    maxAge: 10 * 60 * 1000 // 10 minutes max
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000, // Increased for high performance
    message: { error: 'Rate limit exceeded', retryAfter: '15 minutes' },
    standardHeaders: true,
    legacyHeaders: false
  },
  monitoring: {
    metricsInterval: 5000,
    alertThreshold: {
      memory: 0.85,
      cpu: 0.80,
      responseTime: 1000
    }
  }
};

class UltraPerformanceServer {
  constructor() {
    this.app = express();
    this.metrics = {
      requests: 0,
      errors: 0,
      totalResponseTime: 0,
      slowRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      startTime: Date.now(),
      lastGC: Date.now()
    };
    this.cache = new LRUCache(ULTRA_CONFIG.caching);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupMonitoring();
  }

  setupMiddleware() {
    // Security first
    this.app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));

    // Ultra compression
    this.app.use(compression(ULTRA_CONFIG.compression));

    // Enhanced rate limiting
    const limiter = rateLimit(ULTRA_CONFIG.rateLimit);
    this.app.use(limiter);

    // Request parsing with limits
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Performance tracking middleware
    this.app.use((req, res, next) => {
      const start = performance.now();
      req.startTime = start;
      
      this.metrics.requests++;
      
      res.on('finish', () => {
        const duration = performance.now() - start;
        this.metrics.totalResponseTime += duration;
        
        if (duration > ULTRA_CONFIG.monitoring.alertThreshold.responseTime) {
          this.metrics.slowRequests++;
          console.warn(`⚠️  Slow request: ${req.method} ${req.path} - ${duration.toFixed(2)}ms`);
        }
        
        // Add performance headers
        res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
        res.set('X-Worker-PID', process.pid);
      });
      
      next();
    });

    // Intelligent caching middleware
    this.app.use((req, res, next) => {
      // Only cache GET requests
      if (req.method !== 'GET') return next();
      
      const cacheKey = `${req.originalUrl}:${req.get('Accept') || 'default'}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached) {
        this.metrics.cacheHits++;
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        return res.json(cached);
      }
      
      this.metrics.cacheMisses++;
      res.set('X-Cache', 'MISS');
      
      // Override res.json to cache responses
      const originalJson = res.json.bind(res);
      res.json = (data) => {
        // Cache successful responses
        if (res.statusCode < 400) {
          this.cache.set(cacheKey, data);
        }
        return originalJson(data);
      };
      
      next();
    });
  }

  setupRoutes() {
    // Enhanced health check with comprehensive metrics
    this.app.get('/health', (req, res) => {
      const uptime = Date.now() - this.metrics.startTime;
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      const avgResponseTime = this.metrics.requests > 0 
        ? this.metrics.totalResponseTime / this.metrics.requests 
        : 0;
      
      const cacheHitRate = (this.metrics.cacheHits + this.metrics.cacheMisses) > 0
        ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100)
        : 0;
      
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(uptime / 1000),
        server: {
          type: 'ultra-optimized',
          version: '2.0.0',
          pid: process.pid,
          clustering: cluster.isWorker,
          workerId: cluster.worker?.id || 'master'
        },
        performance: {
          requests: this.metrics.requests,
          errors: this.metrics.errors,
          slowRequests: this.metrics.slowRequests,
          avgResponseTime: Math.round(avgResponseTime * 100) / 100,
          requestsPerSecond: Math.round((this.metrics.requests / (uptime / 1000)) * 100) / 100,
          errorRate: this.metrics.requests > 0 ? ((this.metrics.errors / this.metrics.requests) * 100).toFixed(2) : 0
        },
        cache: {
          size: this.cache.size,
          maxEntries: ULTRA_CONFIG.caching.maxEntries,
          hitRate: Math.round(cacheHitRate * 100) / 100,
          hits: this.metrics.cacheHits,
          misses: this.metrics.cacheMisses
        },
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(memUsage.heapTotal / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024),
          pressure: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
        },
        cpu: {
          user: Math.round(cpuUsage.user / 1000),
          system: Math.round(cpuUsage.system / 1000)
        }
      };
      
      // Return 503 if memory pressure is too high
      const status = healthStatus.memory.pressure > 90 ? 503 : 200;
      res.status(status).json(healthStatus);
    });

    // Ultra-detailed metrics endpoint
    this.app.get('/metrics/ultra', (req, res) => {
      const uptime = Date.now() - this.metrics.startTime;
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      res.set('Content-Type', 'text/plain');
      res.send(`# Ultra Performance Metrics
# Server: ${process.pid} | Worker: ${cluster.worker?.id || 'master'}

# Requests
http_requests_total ${this.metrics.requests}
http_errors_total ${this.metrics.errors}
http_slow_requests_total ${this.metrics.slowRequests}
http_requests_per_second ${(this.metrics.requests / (uptime / 1000)).toFixed(4)}
http_avg_response_time_ms ${this.metrics.requests > 0 ? (this.metrics.totalResponseTime / this.metrics.requests).toFixed(2) : 0}

# Cache Performance
cache_size ${this.cache.size}
cache_max_entries ${ULTRA_CONFIG.caching.maxEntries}
cache_hits_total ${this.metrics.cacheHits}
cache_misses_total ${this.metrics.cacheMisses}
cache_hit_rate_percent ${((this.metrics.cacheHits / Math.max(this.metrics.cacheHits + this.metrics.cacheMisses, 1)) * 100).toFixed(2)}

# Memory (MB)
memory_heap_used_mb ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}
memory_heap_total_mb ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}
memory_external_mb ${(memUsage.external / 1024 / 1024).toFixed(2)}
memory_rss_mb ${(memUsage.rss / 1024 / 1024).toFixed(2)}
memory_pressure_percent ${((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2)}

# CPU (microseconds)
cpu_user_microseconds ${cpuUsage.user}
cpu_system_microseconds ${cpuUsage.system}

# System
server_uptime_seconds ${Math.floor(uptime / 1000)}
server_type{type="ultra-optimized"} 1
server_clustering_enabled ${cluster.isWorker ? 1 : 0}
server_worker_id ${cluster.worker?.id || 0}
`);
    });

    // Performance analysis endpoint
    this.app.get('/performance/analyze', (req, res) => {
      const analysis = this.analyzePerformance();
      res.json(analysis);
    });

    // Cache management endpoints
    this.app.get('/cache/stats', (req, res) => {
      res.json({
        size: this.cache.size,
        maxSize: this.cache.max,
        hitRate: (this.metrics.cacheHits / Math.max(this.metrics.cacheHits + this.metrics.cacheMisses, 1) * 100).toFixed(2),
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
        keys: [...this.cache.keys()].slice(0, 10) // First 10 keys for inspection
      });
    });

    this.app.post('/cache/clear', (req, res) => {
      this.cache.clear();
      this.metrics.cacheHits = 0;
      this.metrics.cacheMisses = 0;
      res.json({ message: 'Cache cleared successfully', timestamp: new Date().toISOString() });
    });

    // Manual garbage collection endpoint (if enabled)
    this.app.post('/system/gc', (req, res) => {
      if (global.gc) {
        const beforeMem = process.memoryUsage();
        global.gc();
        const afterMem = process.memoryUsage();
        
        this.metrics.lastGC = Date.now();
        
        res.json({
          message: 'Garbage collection executed',
          before: { heap: Math.round(beforeMem.heapUsed / 1024 / 1024) },
          after: { heap: Math.round(afterMem.heapUsed / 1024 / 1024) },
          freed: Math.round((beforeMem.heapUsed - afterMem.heapUsed) / 1024 / 1024),
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({ 
          error: 'Garbage collection not exposed', 
          suggestion: 'Start with --expose-gc flag'
        });
      }
    });

    // Load original server routes
    this.loadOriginalRoutes();

    // 404 handler with metrics
    this.app.use((req, res) => {
      this.metrics.errors++;
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.path,
        method: req.method,
        suggestion: 'Check /health or /metrics/ultra for available endpoints',
        timestamp: new Date().toISOString()
      });
    });

    // Error handler with metrics
    this.app.use((error, req, res, next) => {
      this.metrics.errors++;
      console.error(`Error in ${req.method} ${req.path}:`, error);
      res.status(500).json({
        error: 'Internal server error',
        requestId: req.get('X-Request-ID') || 'unknown',
        timestamp: new Date().toISOString()
      });
    });
  }

  async loadOriginalRoutes() {
    try {
      // Import browser history tool with fallback
      let BrowserHistoryTool;
      let tool;

      try {
        const module = await import('./dist/tools/browser-history.js');
        BrowserHistoryTool = module.default;
        tool = new BrowserHistoryTool({ autoSync: true });
        console.log('✅ Real browser history tool loaded');
      } catch {
        console.log('⚠️  Using mock browser history implementation');
        // Mock implementation
        class MockBrowserHistoryTool {
          async getRecentHistory(count = 50) {
            return Array.from({ length: Math.min(count, 10) }, (_, i) => ({
              url: `https://example${i + 1}.com`,
              title: `Example Site ${i + 1}`,
              visitTime: Date.now() - (i * 3600000),
              visitCount: Math.floor(Math.random() * 10) + 1,
              browser: 'chrome'
            }));
          }
          destroy() {}
        }
        tool = new MockBrowserHistoryTool();
      }

      // Browser history endpoints
      this.app.get('/history', async (req, res) => {
        try {
          const count = parseInt(req.query.count) || 50;
          const history = await tool.getRecentHistory(count);
          res.json({
            success: true,
            count: history.length,
            data: history,
            cached: res.get('X-Cache') === 'HIT'
          });
        } catch (error) {
          this.metrics.errors++;
          res.status(500).json({ success: false, error: error.message });
        }
      });

      this.app.get('/history/:count', async (req, res) => {
        try {
          const count = parseInt(req.params.count) || 50;
          const history = await tool.getRecentHistory(count);
          res.json({
            success: true,
            count: history.length,
            data: history,
            cached: res.get('X-Cache') === 'HIT'
          });
        } catch (error) {
          this.metrics.errors++;
          res.status(500).json({ success: false, error: error.message });
        }
      });

      this.app.get('/search', async (req, res) => {
        try {
          const query = req.query.query || '';
          if (!query) {
            return res.status(400).json({ error: 'Query parameter required' });
          }

          const count = parseInt(req.query.count) || 100;
          const history = await tool.getRecentHistory(count);
          const results = history.filter(item => 
            item.title?.toLowerCase().includes(query.toLowerCase()) ||
            item.url?.toLowerCase().includes(query.toLowerCase())
          );

          res.json({
            success: true,
            query,
            count: results.length,
            data: results,
            cached: res.get('X-Cache') === 'HIT'
          });
        } catch (error) {
          this.metrics.errors++;
          res.status(500).json({ success: false, error: error.message });
        }
      });

    } catch (error) {
      console.error('Failed to load browser history routes:', error);
    }
  }

  setupMonitoring() {
    // Periodic performance monitoring
    setInterval(() => {
      this.monitorPerformance();
    }, ULTRA_CONFIG.monitoring.metricsInterval);

    // Automatic garbage collection when memory pressure is high
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const pressure = memUsage.heapUsed / memUsage.heapTotal;
      
      if (pressure > ULTRA_CONFIG.monitoring.alertThreshold.memory) {
        if (global.gc) {
          global.gc();
          console.log('🗑️  Auto-GC triggered - memory pressure:', (pressure * 100).toFixed(1) + '%');
        }
      }
    }, 30000); // Every 30 seconds
  }

  monitorPerformance() {
    const memUsage = process.memoryUsage();
    const pressure = memUsage.heapUsed / memUsage.heapTotal;
    const uptime = (Date.now() - this.metrics.startTime) / 1000;
    const rps = this.metrics.requests / uptime;
    
    // Log performance summary every minute
    if (this.metrics.requests % 100 === 0 && this.metrics.requests > 0) {
      console.log(`📊 Performance: ${rps.toFixed(2)} RPS | Memory: ${(pressure * 100).toFixed(1)}% | Cache: ${this.cache.size} entries`);
    }

    // Alert on performance issues
    if (pressure > ULTRA_CONFIG.monitoring.alertThreshold.memory) {
      console.warn(`⚠️  High memory pressure: ${(pressure * 100).toFixed(1)}%`);
    }
  }

  analyzePerformance() {
    const uptime = Date.now() - this.metrics.startTime;
    const memUsage = process.memoryUsage();
    
    return {
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime / 1000),
      performance: {
        requestsPerSecond: (this.metrics.requests / (uptime / 1000)).toFixed(2),
        avgResponseTime: this.metrics.requests > 0 
          ? (this.metrics.totalResponseTime / this.metrics.requests).toFixed(2)
          : 0,
        errorRate: this.metrics.requests > 0 
          ? ((this.metrics.errors / this.metrics.requests) * 100).toFixed(2)
          : 0,
        slowRequestRate: this.metrics.requests > 0
          ? ((this.metrics.slowRequests / this.metrics.requests) * 100).toFixed(2)
          : 0
      },
      cache: {
        efficiency: (this.metrics.cacheHits / Math.max(this.metrics.cacheHits + this.metrics.cacheMisses, 1) * 100).toFixed(2),
        utilization: ((this.cache.size / ULTRA_CONFIG.caching.maxEntries) * 100).toFixed(2)
      },
      memory: {
        pressure: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2),
        efficiency: 'optimized'
      },
      recommendations: this.generateRecommendations()
    };
  }

  generateRecommendations() {
    const recommendations = [];
    const memUsage = process.memoryUsage();
    const pressure = memUsage.heapUsed / memUsage.heapTotal;
    
    if (pressure > 0.8) {
      recommendations.push('Consider increasing memory allocation or enabling garbage collection');
    }
    
    const cacheHitRate = this.metrics.cacheHits / Math.max(this.metrics.cacheHits + this.metrics.cacheMisses, 1);
    if (cacheHitRate < 0.5) {
      recommendations.push('Cache hit rate is low - consider adjusting cache TTL or size');
    }
    
    const errorRate = this.metrics.errors / Math.max(this.metrics.requests, 1);
    if (errorRate > 0.05) {
      recommendations.push('High error rate detected - investigate error patterns');
    }
    
    if (this.metrics.slowRequests / Math.max(this.metrics.requests, 1) > 0.1) {
      recommendations.push('High number of slow requests - consider performance optimization');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Performance is optimal - no immediate actions required');
    }
    
    return recommendations;
  }

  start(port = process.env.PORT || 8080) {
    const server = this.app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Ultra-Optimized Server started on port ${port}`);
      console.log(`📊 Worker PID: ${process.pid}`);
      console.log(`🔧 Clustering: ${cluster.isWorker ? 'Worker ' + cluster.worker.id : 'Master'}`);
      console.log(`💾 Cache: ${ULTRA_CONFIG.caching.maxEntries} entries max`);
      console.log(`⚡ Compression: Level ${ULTRA_CONFIG.compression.level}`);
      console.log('');
      console.log('Ultra Performance Endpoints:');
      console.log('  GET /health - Enhanced health check');
      console.log('  GET /metrics/ultra - Detailed performance metrics');
      console.log('  GET /performance/analyze - Performance analysis');
      console.log('  GET /cache/stats - Cache statistics');
      console.log('  POST /cache/clear - Clear cache');
      console.log('  POST /system/gc - Manual garbage collection');
      console.log('  GET /history - Browser history (cached)');
      console.log('');
    });
    
    return server;
  }
}

// Clustering logic
if (ULTRA_CONFIG.clustering.enabled) {
  if (cluster.isMaster) {
    console.log(`🔥 Ultra-Optimized Server - Master Process`);
    console.log(`🚀 Starting ${ULTRA_CONFIG.clustering.workers} worker processes...`);
    
    // Fork workers
    for (let i = 0; i < ULTRA_CONFIG.clustering.workers; i++) {
      cluster.fork();
    }
    
    // Handle worker failures
    cluster.on('exit', (worker, code, signal) => {
      console.log(`💥 Worker ${worker.process.pid} died (${signal || code})`);
      if (ULTRA_CONFIG.clustering.respawn) {
        console.log('🔄 Respawning worker...');
        cluster.fork();
      }
    });
    
    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      console.log(`\n📡 Received ${signal}, shutting down gracefully...`);
      
      Object.values(cluster.workers).forEach(worker => {
        worker.send('shutdown');
        
        setTimeout(() => {
          if (!worker.isDead()) {
            worker.kill('SIGKILL');
          }
        }, ULTRA_CONFIG.clustering.gracefulShutdown);
      });
      
      setTimeout(() => process.exit(0), ULTRA_CONFIG.clustering.gracefulShutdown + 1000);
    };
    
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
  } else {
    // Worker process
    const server = new UltraPerformanceServer();
    server.start();
    
    // Listen for shutdown signal from master
    process.on('message', (msg) => {
      if (msg === 'shutdown') {
        console.log(`🛑 Worker ${process.pid} shutting down...`);
        process.exit(0);
      }
    });
  }
} else {
  // Single process mode
  const server = new UltraPerformanceServer();
  server.start();
  
  // Graceful shutdown for single process
  const gracefulShutdown = (signal) => {
    console.log(`\n📡 Received ${signal}, shutting down...`);
    process.exit(0);
  };
  
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

export default UltraPerformanceServer;
