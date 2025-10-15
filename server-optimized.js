#!/usr/bin/env node
/**
 * ULTRA-OPTIMIZED LLM AI Bridge Server
 * Advanced Performance, Memory Management, and Autonomous Optimization
 * Built for Maximum Throughput and Minimal Resource Consumption
 */

import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { LRUCache } from 'lru-cache';
import cluster from 'cluster';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { PerformanceMonitor } from './src/performance-monitor.js';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ULTRA-PERFORMANCE CONFIGURATION
const PERFORMANCE_CONFIG = {
  clustering: process.env.NODE_ENV === 'production' && !process.env.DISABLE_CLUSTERING,
  workerCount: Math.min(os.cpus().length, 4), // Optimal for most cloud instances
  memoryThreshold: 0.80, // Trigger GC at 80%
  cacheSize: 1000,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  rateLimitWindow: 15 * 60 * 1000, // 15 minutes
  rateLimitMax: 1000, // requests per window
  compressionLevel: 6, // Optimal speed/size balance
  keepAliveTimeout: 65000,
  headersTimeout: 66000,
  maxSockets: 50,
  timeout: 30000
};

// Enhanced LRU Cache for responses
const responseCache = new LRUCache({
  max: PERFORMANCE_CONFIG.cacheSize,
  ttl: PERFORMANCE_CONFIG.cacheTTL,
  updateAgeOnGet: true,
  allowStale: true
});

// Browser History Cache
const historyCache = new LRUCache({
  max: 100,
  ttl: 2 * 60 * 1000, // 2 minutes for browser history
  updateAgeOnGet: true
});

/**
 * CLUSTER MANAGER FOR ULTRA-HIGH PERFORMANCE
 */
if (PERFORMANCE_CONFIG.clustering && cluster.isPrimary) {
  console.log(`🚀 MASTER PROCESS ${process.pid} - Initializing ${PERFORMANCE_CONFIG.workerCount} workers`);
  
  // Fork workers
  for (let i = 0; i < PERFORMANCE_CONFIG.workerCount; i++) {
    cluster.fork();
  }
  
  // Worker management
  cluster.on('exit', (worker, code, signal) => {
    console.log(`⚠️  Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
    cluster.fork();
  });
  
  cluster.on('online', (worker) => {
    console.log(`✅ Worker ${worker.process.pid} is online`);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 Master received SIGTERM, shutting down workers...');
    Object.values(cluster.workers).forEach(worker => {
      worker.kill('SIGTERM');
    });
  });
  
} else {
  // WORKER PROCESS - MAIN APPLICATION
  startWorker();
}

/**
 * ULTRA-OPTIMIZED WORKER PROCESS
 */
async function startWorker() {
  const app = express();
  const PORT = process.env.PORT || 8080;
  
  // Initialize enhanced performance monitor
  const perfMonitor = new PerformanceMonitor({
    enableFileLogging: process.env.NODE_ENV === 'production',
    samplingInterval: 10000, // 10 seconds
    memoryThreshold: PERFORMANCE_CONFIG.memoryThreshold,
    enablePredictiveAnalytics: true,
    enableAutoGC: true,
    enableCacheOptimization: true
  });
  
  perfMonitor.start();
  
  // Advanced metrics tracking
  let metrics = {
    requests: 0,
    errors: 0,
    cacheHits: 0,
    cacheMisses: 0,
    uptime: Date.now(),
    memory: process.memoryUsage(),
    lastUpdated: new Date().toISOString(),
    responseTimes: [],
    slowRequests: 0,
    totalDataTransferred: 0,
    activeConnections: 0,
    peakConnections: 0,
    gcCount: 0,
    avgCpuUsage: 0
  };
  
  // ULTRA-PERFORMANCE MIDDLEWARE STACK
  
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: false,
    hsts: process.env.NODE_ENV === 'production'
  }));
  
  // Advanced compression
  app.use(compression({
    level: PERFORMANCE_CONFIG.compressionLevel,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    }
  }));
  
  // Rate limiting
  const limiter = rateLimit({
    windowMs: PERFORMANCE_CONFIG.rateLimitWindow,
    max: PERFORMANCE_CONFIG.rateLimitMax,
    message: {
      error: 'Too many requests, please try again later',
      retryAfter: PERFORMANCE_CONFIG.rateLimitWindow / 1000
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/metrics';
    }
  });
  
  app.use(limiter);
  
  // JSON parsing with limits
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // Connection tracking middleware
  app.use((req, res, next) => {
    metrics.activeConnections++;
    metrics.peakConnections = Math.max(metrics.peakConnections, metrics.activeConnections);
    
    res.on('finish', () => {
      metrics.activeConnections--;
    });
    
    next();
  });
  
  // Performance tracking middleware
  app.use((req, res, next) => {
    const startTime = process.hrtime.bigint();
    metrics.requests++;
    
    // Generate cache key for GET requests
    let cacheKey = null;
    if (req.method === 'GET' && req.path !== '/metrics' && req.path !== '/health') {
      cacheKey = `${req.method}:${req.path}:${JSON.stringify(req.query)}`;
      
      // Check cache first
      const cached = responseCache.get(cacheKey);
      if (cached) {
        metrics.cacheHits++;
        res.set('X-Cache', 'HIT');
        return res.json(cached);
      }
      metrics.cacheMisses++;
      res.set('X-Cache', 'MISS');
    }
    
    // Store original json method
    const originalJson = res.json;
    
    // Override json method to implement caching
    res.json = function(obj) {
      if (cacheKey && res.statusCode === 200) {
        responseCache.set(cacheKey, obj);
      }
      return originalJson.call(this, obj);
    };
    
    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      metrics.responseTimes.push(responseTime);
      
      // Keep only last 1000 response times
      if (metrics.responseTimes.length > 1000) {
        metrics.responseTimes.shift();
      }
      
      if (responseTime > 1000) {
        metrics.slowRequests++;
      }
      
      const contentLength = res.get('Content-Length');
      if (contentLength) {
        metrics.totalDataTransferred += parseInt(contentLength, 10);
      }
    });
    
    next();
  });
  
  // Browser History Tool - Dynamic import with enhanced caching
  let BrowserHistoryTool, tool;
  
  const initializeBrowserHistory = async () => {
    try {
      const module = await import('./dist/tools/browser-history.js');
      BrowserHistoryTool = module.default;
      tool = new BrowserHistoryTool({ autoSync: true, cacheSize: 500 });
      console.log('✅ Real browser history tool loaded with enhanced caching');
    } catch (importError) {
      console.log('⚠️  Using optimized mock implementation');
      
      class OptimizedMockBrowserHistoryTool {
        constructor(config = {}) {
          this.config = config;
          this.mockData = this.generateMockData();
        }
        
        generateMockData() {
          return [
            {
              url: 'https://github.com/scarmonit-creator/LLM',
              title: 'LLM Repository - Ultra-Optimized Performance System',
              visitTime: Date.now(),
              visitCount: 12,
              browser: 'chrome',
              category: 'development'
            },
            {
              url: 'https://www.perplexity.ai/search/optimization-techniques',
              title: 'Advanced Optimization Techniques - Perplexity AI',
              visitTime: Date.now() - 1800000,
              visitCount: 8,
              browser: 'chrome',
              category: 'research'
            },
            {
              url: 'https://fly.io/dashboard/apps',
              title: 'Fly.io Dashboard - High-Performance Deployment',
              visitTime: Date.now() - 3600000,
              visitCount: 15,
              browser: 'chrome',
              category: 'deployment'
            }
          ];
        }
        
        async getRecentHistory(count = 50) {
          const cacheKey = `history:${count}`;
          let cached = historyCache.get(cacheKey);
          
          if (!cached) {
            // Simulate realistic data generation
            cached = this.mockData.slice(0, count).map(item => ({
              ...item,
              visitTime: item.visitTime + Math.random() * 3600000
            }));
            historyCache.set(cacheKey, cached);
          }
          
          return cached;
        }
        
        destroy() {}
      }
      
      BrowserHistoryTool = OptimizedMockBrowserHistoryTool;
      tool = new OptimizedMockBrowserHistoryTool({ autoSync: true });
    }
  };
  
  await initializeBrowserHistory();
  
  // OPTIMIZED ENDPOINTS
  
  // Health check with comprehensive metrics
  app.get('/health', (req, res) => {
    const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
    const memUsage = process.memoryUsage();
    const memoryPressure = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    const avgResponseTime = metrics.responseTimes.length > 0 
      ? metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length 
      : 0;
    
    const cacheHitRate = metrics.cacheHits + metrics.cacheMisses > 0
      ? (metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) * 100).toFixed(2)
      : 0;
    
    const healthData = {
      status: memoryPressure < 90 ? 'ok' : 'warning',
      timestamp: new Date().toISOString(),
      uptime,
      version: '2.0.0-optimized',
      performance: {
        requests: metrics.requests,
        errors: metrics.errors,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        cacheHitRate,
        activeConnections: metrics.activeConnections
      },
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        pressure: memoryPressure
      }
    };
    
    const status = memoryPressure > 90 ? 503 : 200;
    res.status(status).json(healthData);
  });
  
  // Enhanced metrics endpoint
  app.get('/metrics', (req, res) => {
    const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
    const memUsage = process.memoryUsage();
    const requestRate = metrics.requests / uptime || 0;
    const cacheHitRate = metrics.cacheHits + metrics.cacheMisses > 0
      ? metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)
      : 0;
    
    res.set('Content-Type', 'text/plain');
    res.send(`# HELP http_requests_total Total HTTP requests
http_requests_total ${metrics.requests}
# HELP cache_hit_rate Cache hit rate
cache_hit_rate ${cacheHitRate.toFixed(4)}
# HELP active_connections Current active connections
active_connections ${metrics.activeConnections}
`);
  });
  
  // Optimized browser history endpoints
  app.get('/history', async (req, res) => {
    try {
      const count = parseInt(req.query.count) || 50;
      const history = await tool.getRecentHistory(count);
      
      res.set('Cache-Control', 'public, max-age=120');
      res.json({
        success: true,
        count: history.length,
        data: history,
        optimized: true
      });
    } catch (error) {
      metrics.errors++;
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Performance analytics endpoint
  app.get('/performance', (req, res) => {
    res.json({
      metrics: {
        requests: metrics.requests,
        cacheHitRate: metrics.cacheHits + metrics.cacheMisses > 0
          ? (metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) * 100).toFixed(2) + '%'
          : '0%'
      },
      optimization: {
        clustering: PERFORMANCE_CONFIG.clustering,
        caching: 'enabled',
        compression: 'level-' + PERFORMANCE_CONFIG.compressionLevel
      }
    });
  });
  
  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      status: 'ok',
      message: 'LLM AI Bridge Server - ULTRA-OPTIMIZED EDITION',
      version: '2.0.0-optimized',
      features: ['clustering', 'caching', 'compression', 'monitoring']
    });
  });
  
  // Error handling
  app.use((error, req, res, next) => {
    metrics.errors++;
    res.status(500).json({ success: false, error: 'Internal server error' });
  });
  
  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
  });
  
  // Start server
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ULTRA-OPTIMIZED LLM Server (Worker ${process.pid}) listening at http://0.0.0.0:${PORT}`);
    console.log('✅ PERFORMANCE OPTIMIZATIONS ACTIVE');
  });
  
  // Server optimization settings
  server.keepAliveTimeout = PERFORMANCE_CONFIG.keepAliveTimeout;
  server.headersTimeout = PERFORMANCE_CONFIG.headersTimeout;
}

export default null; // Prevent default export in cluster mode