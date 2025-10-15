#!/usr/bin/env node
/**
 * ULTRA-OPTIMIZED LLM AI Bridge Server
 * Production-ready with advanced performance optimizations
 * Memory management, clustering, caching, and security hardening
 */

import cluster from 'cluster';
import os from 'os';
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { LRUCache } from 'lru-cache';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { PerformanceMonitor } from './src/performance-monitor.js';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const numCPUs = Math.min(os.cpus().length, parseInt(process.env.MAX_WORKERS) || 4);
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

// High-performance cache configuration
const cache = new LRUCache({
  max: 1000,
  ttl: 1000 * 60 * 15, // 15 minutes
  allowStale: false,
  updateAgeOnGet: false,
  updateAgeOnHas: false
});

// Cluster management for production
if (IS_PRODUCTION && cluster.isPrimary) {
  console.log(`🚀 Master ${process.pid} starting with ${numCPUs} workers`);
  
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork();
    
    // Monitor worker health
    worker.on('message', (msg) => {
      if (msg.type === 'health') {
        console.log(`Worker ${worker.process.pid} health: ${msg.status}`);
      }
    });
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.warn(`Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
    cluster.fork();
  });
  
  // Graceful shutdown
  const shutdown = () => {
    console.log('Master shutting down...');
    for (const id in cluster.workers) {
      cluster.workers[id].kill('SIGTERM');
    }
    process.exit(0);
  };
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  
} else {
  // Worker process - run the actual server
  startWorker();
}

async function startWorker() {
  const app = express();
  
  // Initialize performance monitor with worker-specific settings
  const perfMonitor = new PerformanceMonitor({
    enableFileLogging: IS_PRODUCTION,
    samplingInterval: IS_PRODUCTION ? 30000 : 10000,
    memoryThreshold: 0.8,
    maxHistorySize: 500
  });
  
  perfMonitor.start();
  
  // Worker metrics
  let metrics = {
    workerId: cluster.worker?.id || 'main',
    pid: process.pid,
    requests: 0,
    errors: 0,
    uptime: Date.now(),
    memory: process.memoryUsage(),
    lastHealthCheck: new Date().toISOString(),
    cacheStats: { hits: 0, misses: 0 },
    responseTimes: new Array(100).fill(0),
    responseIndex: 0
  };
  
  // Security middleware - helmet with optimized configuration
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));
  
  // Compression with aggressive settings
  app.use(compression({
    level: IS_PRODUCTION ? 9 : 6,
    threshold: 0,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    }
  }));
  
  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: IS_PRODUCTION ? 1000 : 10000, // requests per window
    message: {
      error: 'Too many requests from this IP',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  app.use(limiter);
  
  // JSON parsing with size limits
  app.use(express.json({ 
    limit: '10mb',
    inflate: true,
    strict: true
  }));
  
  // High-performance request tracking middleware
  app.use((req, res, next) => {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage().heapUsed;
    
    metrics.requests++;
    
    // Cache check for GET requests
    if (req.method === 'GET') {
      const cacheKey = `${req.path}${req.url}`;
      const cached = cache.get(cacheKey);
      
      if (cached) {
        metrics.cacheStats.hits++;
        return res.json(cached);
      } else {
        metrics.cacheStats.misses++;
      }
    }
    
    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const responseTime = Number(endTime - startTime) / 1e6; // Convert to milliseconds
      const memoryDelta = process.memoryUsage().heapUsed - startMemory;
      
      // Store response time in circular buffer
      metrics.responseTimes[metrics.responseIndex] = responseTime;
      metrics.responseIndex = (metrics.responseIndex + 1) % 100;
      
      // Log slow requests
      if (responseTime > 1000) {
        console.warn(`🐌 Slow request: ${req.method} ${req.path} - ${responseTime.toFixed(2)}ms`);
      }
      
      // Monitor memory usage per request
      if (memoryDelta > 10 * 1024 * 1024) { // 10MB
        console.warn(`🔥 High memory request: ${req.method} ${req.path} - ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
      }
    });
    
    next();
  });
  
  // Browser History Tool initialization with connection pooling
  let BrowserHistoryTool;
  let tool;
  
  const initializeBrowserHistory = async () => {
    try {
      const module = await import('./dist/tools/browser-history.js');
      BrowserHistoryTool = module.default;
      tool = new BrowserHistoryTool({ 
        autoSync: false, // Disable auto-sync for performance
        connectionPool: true,
        maxConnections: 10,
        timeout: 5000
      });
      console.log('✅ Optimized browser history tool loaded');
    } catch (importError) {
      console.log('⚠️  Using optimized mock implementation');
      
      class OptimizedMockBrowserHistoryTool {
        constructor(config = {}) {
          this.config = config;
          this.cachedHistory = null;
          this.lastCacheTime = 0;
          this.cacheTimeout = 30000; // 30 seconds
        }
        
        async getRecentHistory(count = 50) {
          const now = Date.now();
          
          // Return cached data if still valid
          if (this.cachedHistory && (now - this.lastCacheTime) < this.cacheTimeout) {
            return this.cachedHistory.slice(0, count);
          }
          
          // Generate optimized mock data
          const history = Array.from({ length: Math.min(count, 100) }, (_, i) => ({
            id: `opt_${i}_${now}`,
            url: `https://example-${i % 10}.com/path-${i}`,
            title: `Optimized Mock Entry ${i + 1} - High Performance`,
            visitTime: now - (i * 60000),
            visitCount: Math.floor(Math.random() * 10) + 1,
            browser: ['chrome', 'firefox', 'edge', 'safari'][i % 4],
            cached: true
          }));
          
          this.cachedHistory = history;
          this.lastCacheTime = now;
          
          return history.slice(0, count);
        }
        
        destroy() {
          this.cachedHistory = null;
        }
      }
      
      BrowserHistoryTool = OptimizedMockBrowserHistoryTool;
      tool = new OptimizedMockBrowserHistoryTool({ autoSync: false });
    }
  };
  
  await initializeBrowserHistory();
  
  // Optimized health check endpoint
  app.get('/health', (req, res) => {
    const memUsage = process.memoryUsage();
    const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
    const avgResponseTime = metrics.responseTimes.reduce((a, b) => a + b, 0) / 100;
    const memoryPressure = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    
    const health = {
      status: memoryPressure > 90 ? 'degraded' : 'healthy',
      worker: metrics.workerId,
      pid: metrics.pid,
      timestamp: new Date().toISOString(),
      uptime,
      performance: {
        requests: metrics.requests,
        errors: metrics.errors,
        avgResponseTime: Math.round(avgResponseTime),
        requestRate: (metrics.requests / uptime || 0).toFixed(2)
      },
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        pressure: memoryPressure
      },
      cache: {
        size: cache.size,
        hits: metrics.cacheStats.hits,
        misses: metrics.cacheStats.misses,
        hitRate: metrics.cacheStats.hits / (metrics.cacheStats.hits + metrics.cacheStats.misses) || 0
      }
    };
    
    // Send health status to master process
    if (cluster.worker) {
      cluster.worker.send({ type: 'health', status: health.status });
    }
    
    res.status(memoryPressure > 90 ? 503 : 200).json(health);
  });
  
  // Root endpoint with caching
  app.get('/', (req, res) => {
    const cacheKey = 'root_endpoint';
    let response = cache.get(cacheKey);
    
    if (!response) {
      const isRealHistory = tool.constructor.name !== 'OptimizedMockBrowserHistoryTool';
      
      response = {
        status: 'optimal',
        message: 'LLM AI Bridge Server - ULTRA OPTIMIZED - Production Ready',
        version: '2.0.0-optimized',
        worker: metrics.workerId,
        pid: metrics.pid,
        uptime: Math.floor((Date.now() - metrics.uptime) / 1000),
        features: {
          clustering: IS_PRODUCTION,
          caching: true,
          compression: true,
          security: true,
          monitoring: true,
          rateLimit: true,
          browserHistory: isRealHistory ? 'Real SQLite with Connection Pool' : 'Optimized Mock'
        },
        performance: {
          cacheHitRate: (metrics.cacheStats.hits / (metrics.cacheStats.hits + metrics.cacheStats.misses) || 0).toFixed(3),
          avgResponseTime: Math.round(metrics.responseTimes.reduce((a, b) => a + b, 0) / 100),
          requestCount: metrics.requests
        },
        endpoints: [
          { path: '/health', method: 'GET', cached: false },
          { path: '/metrics', method: 'GET', cached: false },
          { path: '/api/status', method: 'GET', cached: true },
          { path: '/history/:count?', method: 'GET', cached: true },
          { path: '/search', method: 'GET', cached: true }
        ]
      };
      
      cache.set(cacheKey, response, { ttl: 60000 }); // Cache for 1 minute
    }
    
    res.json(response);
  });
  
  // Optimized metrics endpoint for Prometheus
  app.get('/metrics', (req, res) => {
    const memUsage = process.memoryUsage();
    const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
    const avgResponseTime = metrics.responseTimes.reduce((a, b) => a + b, 0) / 100;
    const perfStats = perfMonitor.getStats();
    
    res.set('Content-Type', 'text/plain');
    res.send(`# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{worker="${metrics.workerId}"} ${metrics.requests}

# HELP http_errors_total Total HTTP errors
# TYPE http_errors_total counter
http_errors_total{worker="${metrics.workerId}"} ${metrics.errors}

# HELP http_response_time_avg Average response time
# TYPE http_response_time_avg gauge
http_response_time_avg{worker="${metrics.workerId}"} ${avgResponseTime.toFixed(2)}

# HELP memory_usage_bytes Memory usage in bytes
# TYPE memory_usage_bytes gauge
memory_usage_heap_used{worker="${metrics.workerId}"} ${memUsage.heapUsed}
memory_usage_heap_total{worker="${metrics.workerId}"} ${memUsage.heapTotal}

# HELP cache_operations_total Cache operations
# TYPE cache_operations_total counter
cache_hits_total{worker="${metrics.workerId}"} ${metrics.cacheStats.hits}
cache_misses_total{worker="${metrics.workerId}"} ${metrics.cacheStats.misses}

# HELP performance_monitor_samples Performance monitoring samples
# TYPE performance_monitor_samples counter
performance_monitor_samples{worker="${metrics.workerId}"} ${perfStats.totalSamples}

# HELP worker_uptime_seconds Worker uptime
# TYPE worker_uptime_seconds counter
worker_uptime_seconds{worker="${metrics.workerId}"} ${uptime}
`);
  });
  
  // High-performance history endpoint with aggressive caching
  app.get(['/history', '/history/:count'], async (req, res) => {
    try {
      const count = parseInt(req.params.count || req.query.count) || 50;
      const cacheKey = `history_${count}`;
      
      let result = cache.get(cacheKey);
      
      if (!result) {
        const startTime = process.hrtime.bigint();
        const history = await tool.getRecentHistory(count);
        const endTime = process.hrtime.bigint();
        const queryTime = Number(endTime - startTime) / 1e6;
        
        result = {
          success: true,
          count: history.length,
          data: history,
          cached: false,
          queryTime: Math.round(queryTime),
          worker: metrics.workerId,
          implementation: tool.constructor.name.includes('Mock') ? 'optimized-mock' : 'sqlite-pool'
        };
        
        // Cache with shorter TTL for frequently changing data
        cache.set(cacheKey, { ...result, cached: true }, { ttl: 30000 }); // 30 seconds
      } else {
        result.cached = true;
      }
      
      res.json(result);
      
    } catch (error) {
      metrics.errors++;
      console.error('History endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch browser history',
        worker: metrics.workerId
      });
    }
  });
  
  // Optimized search endpoint
  app.get('/search', async (req, res) => {
    try {
      const query = req.query.query?.trim();
      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Query parameter is required'
        });
      }
      
      const count = parseInt(req.query.count) || 100;
      const cacheKey = `search_${query}_${count}`;
      
      let result = cache.get(cacheKey);
      
      if (!result) {
        const startTime = process.hrtime.bigint();
        const history = await tool.getRecentHistory(count);
        
        const results = history.filter(
          item => 
            item.title?.toLowerCase().includes(query.toLowerCase()) ||
            item.url?.toLowerCase().includes(query.toLowerCase())
        );
        
        const endTime = process.hrtime.bigint();
        const queryTime = Number(endTime - startTime) / 1e6;
        
        result = {
          success: true,
          query,
          count: results.length,
          data: results,
          cached: false,
          queryTime: Math.round(queryTime),
          worker: metrics.workerId
        };
        
        cache.set(cacheKey, { ...result, cached: true }, { ttl: 60000 }); // 1 minute
      } else {
        result.cached = true;
      }
      
      res.json(result);
      
    } catch (error) {
      metrics.errors++;
      console.error('Search endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Search failed',
        worker: metrics.workerId
      });
    }
  });
  
  // Performance monitoring endpoint
  app.get('/performance', (req, res) => {
    const perfStats = perfMonitor.getStats();
    const memUsage = process.memoryUsage();
    
    res.json({
      worker: metrics.workerId,
      pid: metrics.pid,
      monitoring: perfStats,
      metrics: {
        requests: metrics.requests,
        errors: metrics.errors,
        avgResponseTime: Math.round(metrics.responseTimes.reduce((a, b) => a + b, 0) / 100),
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024)
        },
        cache: {
          size: cache.size,
          maxSize: cache.max,
          hitRate: (metrics.cacheStats.hits / (metrics.cacheStats.hits + metrics.cacheStats.misses) || 0).toFixed(3)
        }
      }
    });
  });
  
  // Error handling middleware
  app.use((error, req, res, next) => {
    metrics.errors++;
    console.error(`❌ Error in worker ${metrics.workerId}:`, error.message);
    
    res.status(500).json({
      success: false,
      error: IS_PRODUCTION ? 'Internal server error' : error.message,
      worker: metrics.workerId,
      timestamp: new Date().toISOString()
    });
  });
  
  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      worker: metrics.workerId,
      path: req.path
    });
  });
  
  // Create HTTP server
  const server = createServer(app);
  
  // Optimize server settings
  server.keepAliveTimeout = 65000; // Slightly higher than load balancer timeout
  server.headersTimeout = 66000;
  
  // Graceful shutdown for worker
  const gracefulShutdown = (signal) => {
    console.log(`Worker ${metrics.workerId} received ${signal}, shutting down gracefully`);
    
    server.close(() => {
      perfMonitor.stop();
      tool.destroy?.();
      cache.clear();
      
      console.log(`Worker ${metrics.workerId} shutdown complete`);
      process.exit(0);
    });
  };
  
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  
  // Start server
  server.listen(PORT, '0.0.0.0', () => {
    const isRealHistory = tool.constructor.name !== 'OptimizedMockBrowserHistoryTool';
    
    console.log(`🚀 Worker ${metrics.workerId} (PID: ${metrics.pid}) listening on port ${PORT}`);
    console.log(`✅ ULTRA-OPTIMIZED: Clustering, Caching, Compression, Security`);
    console.log(`📊 Browser History: ${isRealHistory ? 'SQLite with Connection Pool' : 'Optimized Mock'}`);
    console.log(`📈 Performance Monitor: ACTIVE`);
    console.log(`🔒 Security: Helmet + Rate Limiting`);
    console.log(`⚡ Caching: LRU Cache with TTL`);
    console.log(`📦 Compression: Level ${IS_PRODUCTION ? 9 : 6}`);
    console.log(`🎯 Ready for ${IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT'} traffic`);
  });
  
  // Memory monitoring and cleanup
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const pressure = memUsage.heapUsed / memUsage.heapTotal;
    
    if (pressure > 0.8) {
      console.warn(`🔥 Worker ${metrics.workerId} high memory pressure: ${Math.round(pressure * 100)}%`);
      
      // Clear some cache entries
      if (cache.size > cache.max * 0.8) {
        cache.clear();
        console.log(`🧹 Worker ${metrics.workerId} cleared cache`);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        console.log(`♻️  Worker ${metrics.workerId} forced garbage collection`);
      }
    }
    
    metrics.memory = memUsage;
    metrics.lastHealthCheck = new Date().toISOString();
    
  }, 30000); // Every 30 seconds
}

export default app;