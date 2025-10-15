import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { PerformanceMonitor } from './src/performance-monitor.js';
import { performanceCache } from './src/performance-cache.js';
import cluster from 'cluster';
import os from 'os';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cluster management for production scaling
if (cluster.isPrimary && process.env.NODE_ENV === 'production') {
  const numCPUs = Math.min(os.cpus().length, 4); // Limit to 4 workers
  console.log(`🚀 Starting ${numCPUs} worker processes...`);
  
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  startServer();
}

function startServer() {
  const app = express();
  const PORT = process.env.PORT || 8080;
  
  // Initialize performance monitor with optimized settings
  const perfMonitor = new PerformanceMonitor({
    enableFileLogging: process.env.NODE_ENV === 'production',
    samplingInterval: 10000, // 10 seconds
    memoryThreshold: 0.80,
    enableGC: true
  });
  
  perfMonitor.start();
  
  // Security and performance middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Allow for development flexibility
    hsts: process.env.NODE_ENV === 'production'
  }));
  
  app.use(compression({
    level: 6, // Good compression without excessive CPU usage
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    }
  }));
  
  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 1000 : 10000, // Limit requests per window
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health' || req.path === '/metrics'
  });
  
  app.use(limiter);
  
  // JSON parsing with size limits
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // Browser History Tool with caching integration
  let BrowserHistoryTool;
  let tool;
  
  // Enhanced browser history initialization with cache integration
  const initializeBrowserHistory = async () => {
    try {
      const module = await import('./dist/tools/browser-history.js');
      BrowserHistoryTool = module.default;
      tool = new BrowserHistoryTool({ autoSync: true });
      
      // Preload cache with recent history
      await performanceCache.preloadFrequentData(tool);
      
      console.log('✅ Real browser history tool loaded with cache preloading');
    } catch (importError) {
      console.log('⚠️  Using optimized mock implementation with caching');
      
      class OptimizedMockBrowserHistoryTool {
        constructor(config = {}) {
          this.config = config;
          this.mockData = this.generateOptimizedMockData();
        }
        
        generateOptimizedMockData() {
          const domains = [
            'github.com/scarmonit-creator/LLM',
            'perplexity.ai',
            'fly.io/dashboard',
            'claude.ai',
            'stackoverflow.com',
            'mdn.web.docs',
            'nitric.io/docs',
            'docker.com',
            'railway.app',
            'render.com'
          ];
          
          return Array.from({ length: 200 }, (_, i) => ({
            url: `https://${domains[i % domains.length]}/${Math.random().toString(36).substr(2, 9)}`,
            title: `${domains[i % domains.length].split('.')[0]} - Optimization ${i + 1}`,
            visitTime: Date.now() - (i * 3600000), // Spread over hours
            visitCount: Math.floor(Math.random() * 10) + 1,
            browser: ['chrome', 'firefox', 'edge'][i % 3]
          }));
        }
        
        async getRecentHistory(count = 50) {
          // Check cache first
          const cacheKey = `recent:${count}`;
          let cached = performanceCache.getHistory(cacheKey);
          
          if (cached) {
            return cached;
          }
          
          // Generate fresh data
          const results = this.mockData.slice(0, count);
          
          // Cache the results
          performanceCache.setHistory(cacheKey, results);
          
          return results;
        }
        
        destroy() {
          // Cleanup
        }
      }
      
      BrowserHistoryTool = OptimizedMockBrowserHistoryTool;
      tool = new OptimizedMockBrowserHistoryTool({ autoSync: true });
    }
  };
  
  await initializeBrowserHistory();
  
  // Enhanced metrics with caching
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
    cacheStats: performanceCache.getStats()
  };
  
  // Optimized metrics updates with caching
  setInterval(() => {
    const memUsage = process.memoryUsage();
    metrics.memory = memUsage;
    metrics.lastUpdated = new Date().toISOString();
    metrics.cacheStats = performanceCache.getStats();
    
    // Cache current metrics
    performanceCache.setMetrics('current', metrics);
    
    // Auto-cleanup cache if memory pressure is high
    const heapPressure = memUsage.heapUsed / memUsage.heapTotal;
    if (heapPressure > 0.85) {
      performanceCache.cleanup();
      global.gc && global.gc();
    }
  }, 8000); // Every 8 seconds
  
  // Performance-optimized middleware with caching
  app.use((req, res, next) => {
    const startTime = Date.now();
    metrics.requests++;
    
    // Track performance
    perfMonitor.measureOperation(`http-${req.method}-${req.path}`, () => {
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        metrics.responseTimes.push(responseTime);
        
        if (metrics.responseTimes.length > 100) {
          metrics.responseTimes.shift();
        }
        
        if (responseTime > 1000) {
          metrics.slowRequests++;
        }
        
        metrics.totalDataTransferred += (res.get('Content-Length') || 0);
      });
    });
    
    next();
  });
  
  // Optimized health check with caching
  app.get('/health', (req, res) => {
    const cacheKey = 'health-check';
    let cached = performanceCache.getMetrics(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 10000) { // 10 second cache
      return res.json(cached.data);
    }
    
    const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
    const memUsage = process.memoryUsage();
    const memoryPressure = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    const isRealHistory = tool.constructor.name !== 'OptimizedMockBrowserHistoryTool';
    
    const avgResponseTime = metrics.responseTimes.length > 0
      ? metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length
      : 0;
    
    const healthCheck = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: uptime,
      worker: cluster.worker?.id || 'master',
      browserHistory: {
        available: true,
        type: isRealHistory ? 'real' : 'optimized-mock',
        cached: true
      },
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        pressure: memoryPressure
      },
      performance: {
        requests: metrics.requests,
        errors: metrics.errors,
        slowRequests: metrics.slowRequests,
        avgResponseTime: Math.round(avgResponseTime),
        errorRate: metrics.requests > 0 ? (metrics.errors / metrics.requests * 100).toFixed(2) : 0
      },
      cache: performanceCache.getStats(),
      monitoring: perfMonitor.getStats(),
      version: '2.0.0-optimized'
    };
    
    // Cache the health check
    performanceCache.setMetrics(cacheKey, {
      timestamp: Date.now(),
      data: healthCheck
    });
    
    const status = memoryPressure > 95 ? 503 : 200;
    res.status(status).json(healthCheck);
  });
  
  // Cached root endpoint
  app.get('/', (req, res) => {
    const cacheKey = 'root-info';
    let cached = performanceCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
    const isRealHistory = tool.constructor.name !== 'OptimizedMockBrowserHistoryTool';
    
    const rootInfo = {
      status: 'ok',
      message: 'LLM AI Bridge Server - ULTRA OPTIMIZED - Production Ready',
      version: '2.0.0-optimized',
      uptime: uptime,
      worker: cluster.worker?.id || 'master',
      features: {
        clustering: cluster.isPrimary ? 'master' : 'worker',
        caching: 'advanced-lru',
        compression: 'enabled',
        security: 'helmet',
        rateLimit: 'enabled',
        browserHistory: isRealHistory ? 'real-sqlite' : 'optimized-mock'
      },
      performance: {
        cache: performanceCache.getStats(),
        monitoring: 'active'
      },
      endpoints: [
        { path: '/health', method: 'GET', description: 'Health check (cached)' },
        { path: '/metrics', method: 'GET', description: 'Prometheus metrics' },
        { path: '/api/status', method: 'GET', description: 'Detailed status (cached)' },
        { path: '/history', method: 'GET', description: 'Browser history (cached)' },
        { path: '/search', method: 'GET', description: 'Search history (cached)' },
        { path: '/cache/stats', method: 'GET', description: 'Cache statistics' }
      ]
    };
    
    // Cache for 30 seconds
    performanceCache.set(cacheKey, rootInfo, 30000);
    res.json(rootInfo);
  });
  
  // Cached browser history endpoint
  app.get('/history', async (req, res) => {
    try {
      const count = parseInt(req.query.count) || 50;
      const cacheKey = `history:${count}`;
      
      // Check cache first
      let cached = performanceCache.getHistory(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          count: cached.length,
          data: cached,
          cached: true,
          implementation: tool.constructor.name !== 'OptimizedMockBrowserHistoryTool' ? 'real' : 'optimized-mock'
        });
      }
      
      // Get fresh data
      const history = await tool.getRecentHistory(count);
      
      // Cache the results
      performanceCache.setHistory(cacheKey, history);
      
      res.json({
        success: true,
        count: history.length,
        data: history,
        cached: false,
        implementation: tool.constructor.name !== 'OptimizedMockBrowserHistoryTool' ? 'real' : 'optimized-mock'
      });
    } catch (error) {
      metrics.errors++;
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // Cached search endpoint
  app.get('/search', async (req, res) => {
    try {
      const query = req.query.query || '';
      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Query parameter is required'
        });
      }
      
      const count = parseInt(req.query.count) || 100;
      
      // Check query cache first
      let cached = performanceCache.getQuery(query, count);
      if (cached) {
        return res.json({
          success: true,
          query: query,
          count: cached.length,
          data: cached,
          cached: true
        });
      }
      
      // Get fresh data and filter
      const history = await tool.getRecentHistory(count);
      const results = history.filter(
        (item) =>
          item.title?.toLowerCase().includes(query.toLowerCase()) ||
          item.url?.toLowerCase().includes(query.toLowerCase())
      );
      
      // Cache the search results
      performanceCache.setQuery(query, count, results);
      
      res.json({
        success: true,
        query: query,
        count: results.length,
        data: results,
        cached: false
      });
    } catch (error) {
      metrics.errors++;
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // Cache management endpoints
  app.get('/cache/stats', (req, res) => {
    res.json({
      cache: performanceCache.getStats(),
      memory: process.memoryUsage(),
      performance: perfMonitor.getStats()
    });
  });
  
  app.post('/cache/clear', (req, res) => {
    const pattern = req.body.pattern;
    if (pattern) {
      const cleared = performanceCache.invalidatePattern(pattern);
      res.json({ success: true, cleared });
    } else {
      performanceCache.clearAll();
      res.json({ success: true, message: 'All caches cleared' });
    }
  });
  
  // Enhanced metrics endpoint
  app.get('/metrics', (req, res) => {
    const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
    const memUsage = process.memoryUsage();
    const cacheStats = performanceCache.getStats();
    const perfStats = perfMonitor.getStats();
    
    const requestRate = metrics.requests / uptime || 0;
    const errorRate = metrics.requests > 0 ? (metrics.errors / metrics.requests) : 0;
    const avgResponseTime = metrics.responseTimes.length > 0
      ? metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length
      : 0;
    
    res.set('Content-Type', 'text/plain');
    res.send(`# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total ${metrics.requests}

# HELP cache_hit_rate Cache hit rate percentage
# TYPE cache_hit_rate gauge
cache_hit_rate ${parseFloat(cacheStats.hitRate)}

# HELP cache_size Total cache entries
# TYPE cache_size gauge
cache_size_main ${cacheStats.sizes.main}
cache_size_history ${cacheStats.sizes.history}
cache_size_metrics ${cacheStats.sizes.metrics}
cache_size_query ${cacheStats.sizes.query}

# HELP memory_usage_optimized Optimized memory usage in bytes
# TYPE memory_usage_optimized gauge
memory_usage_rss_bytes ${memUsage.rss}
memory_usage_heap_used_bytes ${memUsage.heapUsed}
memory_usage_heap_total_bytes ${memUsage.heapTotal}

# HELP performance_samples Performance monitoring samples
# TYPE performance_samples counter
performance_samples_total ${perfStats.totalSamples}

# HELP cluster_worker Cluster worker ID
# TYPE cluster_worker gauge
cluster_worker ${cluster.worker?.id || 0}
`);
  });
  
  // Error handling
  app.use((error, req, res, next) => {
    metrics.errors++;
    console.error('Unhandled error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  });
  
  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      path: req.path,
      method: req.method
    });
  });
  
  // Graceful shutdown
  const gracefulShutdown = (signal) => {
    console.log(`Worker ${process.pid} received ${signal}, shutting down gracefully`);
    perfMonitor.stop();
    tool.destroy?.();
    process.exit(0);
  };
  
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  
  // Start server
  const server = app.listen(PORT, '0.0.0.0', () => {
    const isRealHistory = tool.constructor.name !== 'OptimizedMockBrowserHistoryTool';
    
    console.log(`🚀 Optimized LLM server listening at http://0.0.0.0:${PORT}`);
    console.log(`👤 Worker ID: ${cluster.worker?.id || 'master'}`);
    console.log('✅ ULTRA PERFORMANCE - Advanced caching, compression, clustering');
    console.log('🛡️  SECURITY - Helmet, rate limiting, input validation');
    console.log('📊 Browser History:', isRealHistory ? 'Real SQLite + Cache' : 'Optimized Mock + Cache');
    console.log('💾 Cache System: Advanced LRU with intelligent preloading');
    console.log('📈 Performance Monitor: ACTIVE with GC optimization');
    console.log('');
    console.log('🏆 PRODUCTION-READY with enterprise-grade optimizations');
  });
  
  return { app, server, metrics, perfMonitor, performanceCache };
}

export default startServer;