import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cluster from 'cluster';
import os from 'os';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import LRU from 'lru-cache';
import { PerformanceMonitor } from './src/performance-monitor.js';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cluster configuration for production
const numCPUs = os.cpus().length;
const USE_CLUSTER = process.env.NODE_ENV === 'production' && numCPUs > 1;

if (USE_CLUSTER && cluster.isPrimary) {
  console.log(`🚀 Master ${process.pid} is running`);
  console.log(`Spawning ${numCPUs} workers for optimal performance`);
  
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    console.log('Starting a new worker');
    cluster.fork();
  });
  
} else {
  startServer();
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 8080;
  
  // Initialize performance monitor with optimized settings
  const perfMonitor = new PerformanceMonitor({
    enableFileLogging: process.env.NODE_ENV === 'production',
    samplingInterval: 30000, // 30 seconds for production stability
    memoryThreshold: 0.80,
    enableGC: true
  });
  
  // Start monitoring immediately
  perfMonitor.start();
  
  // LRU Cache for response caching
  const responseCache = new LRU({
    max: 1000,
    ttl: 1000 * 60 * 5, // 5 minutes TTL
    updateAgeOnGet: true
  });
  
  // Enhanced security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));
  
  // Compression middleware - optimized for different content types
  app.use(compression({
    level: 6, // Balanced compression
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    }
  }));
  
  // Rate limiting - different limits for different endpoints
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: 900
    }
  });
  
  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Limit API calls more strictly
    standardHeaders: true,
    legacyHeaders: false
  });
  
  const healthLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // Health checks can be more frequent
    standardHeaders: true,
    legacyHeaders: false
  });
  
  // Apply rate limiting
  app.use('/api/', apiLimiter);
  app.use('/health', healthLimiter);
  app.use('/', generalLimiter);
  
  // Optimized JSON parsing with size limits
  app.use(express.json({ 
    limit: '10mb',
    strict: true,
    type: ['application/json', 'text/json']
  }));
  
  // Enhanced CORS with optimization
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours preflight cache
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });
  
  // Browser History Tool - Optimized dynamic import
  let BrowserHistoryTool;
  let tool;
  
  const initializeBrowserHistory = async () => {
    try {
      const module = await import('./dist/tools/browser-history.js');
      BrowserHistoryTool = module.default;
      tool = new BrowserHistoryTool({ 
        autoSync: true,
        cacheSize: 1000,
        cleanupInterval: 300000 // 5 minutes
      });
      console.log('✅ Real browser history tool loaded');
    } catch (importError) {
      console.log('⚠️  Using optimized mock implementation');
      
      class OptimizedMockBrowserHistoryTool {
        constructor(config = {}) {
          this.config = config;
          this.cache = new LRU({ max: 500, ttl: 60000 }); // 1 minute cache
        }
        
        async getRecentHistory(count = 50) {
          const cacheKey = `history_${count}`;
          if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
          }
          
          const mockData = [
            {
              url: 'https://github.com/scarmonit-creator/LLM',
              title: 'LLM Repository - Ultra Performance System',
              visitTime: Date.now(),
              visitCount: 15,
              browser: 'chrome',
              category: 'development'
            },
            {
              url: 'https://www.perplexity.ai',
              title: 'Perplexity AI - Advanced AI Search',
              visitTime: Date.now() - 1800000,
              visitCount: 8,
              browser: 'chrome',
              category: 'ai'
            },
            {
              url: 'https://fly.io/dashboard',
              title: 'Fly.io Dashboard - High-Performance Deployment',
              visitTime: Date.now() - 3600000,
              visitCount: 12,
              browser: 'chrome',
              category: 'infrastructure'
            },
            {
              url: 'https://docs.github.com',
              title: 'GitHub Documentation - API & Features',
              visitTime: Date.now() - 5400000,
              visitCount: 6,
              browser: 'firefox',
              category: 'documentation'
            }
          ].slice(0, count);
          
          this.cache.set(cacheKey, mockData);
          return mockData;
        }
        
        destroy() {
          this.cache.clear();
        }
      }
      
      BrowserHistoryTool = OptimizedMockBrowserHistoryTool;
      tool = new OptimizedMockBrowserHistoryTool({ autoSync: true });
    }
  };
  
  await initializeBrowserHistory();
  
  // Optimized metrics with automatic cleanup
  let metrics = {
    requests: 0,
    errors: 0,
    uptime: Date.now(),
    memory: process.memoryUsage(),
    lastUpdated: new Date().toISOString(),
    startupTime: Date.now(),
    responseTimes: [],
    slowRequests: 0,
    totalDataTransferred: 0,
    cacheHits: 0,
    cacheMisses: 0,
    workerPid: process.pid
  };
  
  // Optimized metrics update with memory management
  setInterval(() => {
    const memUsage = process.memoryUsage();
    metrics.memory = memUsage;
    metrics.lastUpdated = new Date().toISOString();
    
    // Clean old response times to prevent memory bloat
    if (metrics.responseTimes.length > 100) {
      metrics.responseTimes = metrics.responseTimes.slice(-50);
    }
    
    // Trigger GC if memory usage is high
    if (global.gc && memUsage.heapUsed > memUsage.heapTotal * 0.85) {
      global.gc();
      console.log(`🧹 Garbage collection triggered - PID: ${process.pid}`);
    }
  }, 30000); // Every 30 seconds
  
  // Performance tracking middleware with caching
  app.use((req, res, next) => {
    const startTime = Date.now();
    const cacheKey = `${req.method}:${req.path}:${req.query ? JSON.stringify(req.query) : ''}`;
    
    // Check cache for GET requests
    if (req.method === 'GET' && responseCache.has(cacheKey)) {
      metrics.cacheHits++;
      const cachedResponse = responseCache.get(cacheKey);
      res.set(cachedResponse.headers);
      res.set('X-Cache', 'HIT');
      return res.status(cachedResponse.status).json(cachedResponse.data);
    }
    
    metrics.requests++;
    metrics.cacheMisses++;
    
    // Wrap res.json to enable caching
    const originalJson = res.json;
    res.json = function(data) {
      const responseTime = Date.now() - startTime;
      metrics.responseTimes.push(responseTime);
      
      if (responseTime > 1000) {
        metrics.slowRequests++;
      }
      
      // Cache successful GET responses
      if (req.method === 'GET' && res.statusCode < 400) {
        responseCache.set(cacheKey, {
          data,
          status: res.statusCode,
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'MISS',
            'X-Worker-PID': process.pid
          }
        });
      }
      
      res.set('X-Response-Time', `${responseTime}ms`);
      res.set('X-Worker-PID', process.pid);
      return originalJson.call(this, data);
    };
    
    next();
  });
  
  // Optimized health check with enhanced metrics
  app.get('/health', (req, res) => {
    const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
    const memUsage = process.memoryUsage();
    const memoryPressure = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    const isRealHistory = tool.constructor.name !== 'OptimizedMockBrowserHistoryTool';
    
    const avgResponseTime = metrics.responseTimes.length > 0 
      ? metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length 
      : 0;
    
    const healthCheck = {
      status: memoryPressure < 85 ? 'healthy' : 'warning',
      timestamp: new Date().toISOString(),
      uptime: uptime,
      worker: {
        pid: process.pid,
        clustering: USE_CLUSTER,
        totalWorkers: USE_CLUSTER ? numCPUs : 1
      },
      browserHistory: {
        available: true,
        type: isRealHistory ? 'real' : 'optimized-mock',
        cached: true
      },
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        pressure: memoryPressure,
        gcEnabled: !!global.gc
      },
      performance: {
        requests: metrics.requests,
        errors: metrics.errors,
        slowRequests: metrics.slowRequests,
        avgResponseTime: Math.round(avgResponseTime),
        errorRate: metrics.requests > 0 ? (metrics.errors / metrics.requests * 100).toFixed(2) : 0,
        cacheHitRate: ((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100).toFixed(2)
      },
      cache: {
        size: responseCache.size,
        hits: metrics.cacheHits,
        misses: metrics.cacheMisses
      },
      version: '2.0.0-optimized',
      node: process.version,
      platform: process.platform,
      monitoring: perfMonitor.getStats()
    };
    
    const status = memoryPressure > 90 ? 503 : 200;
    res.status(status).json(healthCheck);
  });
  
  // Optimized root endpoint
  app.get('/', (req, res) => {
    const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
    const isRealHistory = tool.constructor.name !== 'OptimizedMockBrowserHistoryTool';
    
    res.json({
      status: 'optimized',
      message: 'LLM AI Bridge Server - ULTRA PERFORMANCE OPTIMIZED',
      version: '2.0.0-optimized',
      uptime: uptime,
      features: {
        clustering: USE_CLUSTER,
        workers: USE_CLUSTER ? numCPUs : 1,
        compression: 'gzip/deflate',
        caching: 'LRU with TTL',
        security: 'helmet + CSP',
        rateLimiting: 'tiered',
        gc: !!global.gc,
        browserHistory: isRealHistory ? 'Real SQLite' : 'Optimized Mock'
      },
      optimization: {
        memoryManagement: 'automatic',
        responseCompression: 'enabled',
        requestCaching: 'LRU',
        securityHeaders: 'comprehensive',
        performanceMonitoring: 'active'
      },
      performance: {
        requests: metrics.requests,
        errors: metrics.errors,
        avgResponseTime: metrics.responseTimes.length > 0 
          ? Math.round(metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length)
          : 0,
        cacheHitRate: ((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100).toFixed(2),
        memory: {
          heapUsed: Math.round(metrics.memory.heapUsed / 1024 / 1024),
          heapTotal: Math.round(metrics.memory.heapTotal / 1024 / 1024)
        }
      },
      endpoints: [
        { path: '/health', method: 'GET', description: 'Optimized health check with clustering info' },
        { path: '/metrics', method: 'GET', description: 'Enhanced Prometheus metrics' },
        { path: '/api/status', method: 'GET', description: 'Comprehensive system status' },
        { path: '/history', method: 'GET', description: 'Cached browser history' },
        { path: '/search', method: 'GET', description: 'Optimized history search' },
        { path: '/cache/stats', method: 'GET', description: 'Cache performance statistics' }
      ]
    });
  });
  
  // Cache statistics endpoint
  app.get('/cache/stats', (req, res) => {
    res.json({
      cache: {
        size: responseCache.size,
        maxSize: responseCache.max,
        hits: metrics.cacheHits,
        misses: metrics.cacheMisses,
        hitRate: ((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100).toFixed(2),
        ttl: responseCache.ttl
      },
      historyCache: tool.cache ? {
        size: tool.cache.size,
        maxSize: tool.cache.max
      } : null,
      performance: {
        avgResponseTime: metrics.responseTimes.length > 0 
          ? Math.round(metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length)
          : 0,
        totalRequests: metrics.requests,
        slowRequests: metrics.slowRequests
      }
    });
  });
  
  // Enhanced metrics endpoint
  app.get('/metrics', (req, res) => {
    const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
    const memUsage = process.memoryUsage();
    const isRealHistory = tool.constructor.name !== 'OptimizedMockBrowserHistoryTool';
    const perfStats = perfMonitor.getStats();
    
    const requestRate = metrics.requests / uptime || 0;
    const errorRate = metrics.requests > 0 ? (metrics.errors / metrics.requests) : 0;
    const cacheHitRate = (metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) || 0;
    const avgResponseTime = metrics.responseTimes.length > 0 
      ? metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length 
      : 0;
    
    res.set('Content-Type', 'text/plain');
    res.send(`# HELP http_requests_total Total number of HTTP requests\n# TYPE http_requests_total counter\nhttp_requests_total{worker_pid="${process.pid}"} ${metrics.requests}\n\n# HELP http_cache_hits_total Total cache hits\n# TYPE http_cache_hits_total counter\nhttp_cache_hits_total ${metrics.cacheHits}\n\n# HELP http_cache_hit_rate Cache hit rate percentage\n# TYPE http_cache_hit_rate gauge\nhttp_cache_hit_rate ${(cacheHitRate * 100).toFixed(2)}\n\n# HELP llm_clustering_enabled Clustering status\n# TYPE llm_clustering_enabled gauge\nllm_clustering_enabled ${USE_CLUSTER ? 1 : 0}\n\n# HELP llm_workers_total Total number of worker processes\n# TYPE llm_workers_total gauge\nllm_workers_total ${USE_CLUSTER ? numCPUs : 1}\n\n# HELP llm_optimization_level Optimization level indicator\n# TYPE llm_optimization_level gauge\nllm_optimization_level 2.0\n\n# HELP memory_pressure_percent Memory pressure as percentage\n# TYPE memory_pressure_percent gauge\nmemory_pressure_percent ${((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2)}\n\n# HELP cache_size_current Current cache size\n# TYPE cache_size_current gauge\ncache_size_current ${responseCache.size}\n\n# HELP app_uptime_seconds Application uptime in seconds\n# TYPE app_uptime_seconds counter\napp_uptime_seconds ${uptime}\n\n# HELP http_response_time_average_ms Average HTTP response time in milliseconds\n# TYPE http_response_time_average_ms gauge\nhttp_response_time_average_ms ${avgResponseTime.toFixed(2)}\n`);
  });
  
  // Optimized browser history endpoint with caching
  app.get('/history', async (req, res) => {
    try {
      const count = Math.min(parseInt(req.query.count) || 50, 1000); // Cap at 1000
      const history = await tool.getRecentHistory(count);
      const isRealHistory = tool.constructor.name !== 'OptimizedMockBrowserHistoryTool';
      
      res.json({
        success: true,
        count: history.length,
        data: history,
        implementation: isRealHistory ? 'real-cached' : 'optimized-mock-cached',
        cached: true,
        worker: process.pid
      });
    } catch (error) {
      metrics.errors++;
      res.status(500).json({
        success: false,
        error: error.message,
        worker: process.pid
      });
    }
  });
  
  // Error handling middleware
  app.use((error, req, res, next) => {
    metrics.errors++;
    console.error(`Worker ${process.pid} error:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
      worker: process.pid
    });
  });
  
  // Optimized 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      path: req.path,
      method: req.method,
      worker: process.pid,
      availableEndpoints: ['/', '/health', '/metrics', '/api/status', '/history', '/cache/stats']
    });
  });
  
  // Graceful shutdown with cleanup
  const gracefulShutdown = (signal) => {
    console.log(`Worker ${process.pid} received ${signal}, shutting down gracefully`);
    perfMonitor.stop();
    responseCache.clear();
    tool.destroy?.();
    process.exit(0);
  };
  
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  
  // Start the server
  const server = app.listen(PORT, '0.0.0.0', () => {
    const isRealHistory = tool.constructor.name !== 'OptimizedMockBrowserHistoryTool';
    
    console.log(`🚀 LLM AI Bridge server (Worker ${process.pid}) listening at http://0.0.0.0:${PORT}`);
    console.log('⚡ ULTRA PERFORMANCE OPTIMIZED');
    console.log(`🔄 Clustering: ${USE_CLUSTER ? `Enabled (${numCPUs} workers)` : 'Single process'}`);
    console.log('🗜️  Compression: Enabled (gzip/deflate)');
    console.log('💾 Response Caching: LRU with 5min TTL');
    console.log('🛡️  Security: Helmet + CSP + Rate Limiting');
    console.log('🧹 Memory Management: Auto GC + Cleanup');
    console.log(`📊 Browser History: ${isRealHistory ? 'Real SQLite (cached)' : 'Optimized Mock (cached)'}`);
    console.log('📈 Performance Monitor: Enhanced with clustering');
    console.log('');
    console.log('🎯 OPTIMIZATION FEATURES:');
    console.log('  ✅ Multi-process clustering');
    console.log('  ✅ Intelligent response caching');
    console.log('  ✅ Memory pressure monitoring');
    console.log('  ✅ Automatic garbage collection');
    console.log('  ✅ Comprehensive security headers');
    console.log('  ✅ Tiered rate limiting');
    console.log('  ✅ Response compression');
    console.log('  ✅ Performance metrics');
  });
  
  export default app;
}