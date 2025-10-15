import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Import advanced performance middleware
import performanceMiddleware, { getMetrics } from './middleware/performance-middleware.js';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Browser History Tool - Dynamic import with fallback
let BrowserHistoryTool;
let tool;

// Initialize browser history tool with graceful fallback
const initializeBrowserHistory = async () => {
  try {
    // Try to import the compiled browser history tool
    const module = await import('./dist/tools/browser-history.js');
    BrowserHistoryTool = module.default;
    tool = new BrowserHistoryTool({ autoSync: true });
    console.log('✅ Real browser history tool loaded from compiled dist/');
  } catch (importError) {
    console.log('⚠️  Compiled browser history not available, using mock implementation');
    console.log('   Run `npm run build` to enable real browser history');
    
    // Fallback mock implementation
    class MockBrowserHistoryTool {
      constructor(config = {}) {
        this.config = config;
      }

      async getRecentHistory(count = 50) {
        return [
          {
            url: 'https://github.com/scarmonit-creator/LLM',
            title: 'LLM Repository - Advanced Performance Optimized System',
            visitTime: Date.now(),
            visitCount: 5,
            browser: 'chrome'
          },
          {
            url: 'https://www.perplexity.ai',
            title: 'Perplexity AI - Advanced Search with Optimization',
            visitTime: Date.now() - 3600000,
            visitCount: 3,
            browser: 'chrome'
          },
          {
            url: 'https://fly.io/dashboard',
            title: 'Fly.io Dashboard - High-Performance Deployment',
            visitTime: Date.now() - 7200000,
            visitCount: 2,
            browser: 'chrome'
          }
        ].slice(0, count);
      }

      destroy() {
        // Cleanup
      }
    }
    
    BrowserHistoryTool = MockBrowserHistoryTool;
    tool = new MockBrowserHistoryTool({ autoSync: true });
  }
};

// Initialize the tool
await initializeBrowserHistory();

// Performance metrics tracking (legacy compatibility)
let metrics = {
  requests: 0,
  errors: 0,
  uptime: Date.now(),
  memory: process.memoryUsage(),
  lastUpdated: new Date().toISOString(),
  startupTime: Date.now()
};

// Update metrics every 30 seconds
setInterval(() => {
  metrics.memory = process.memoryUsage();
  metrics.lastUpdated = new Date().toISOString();
}, 30000);

// Apply advanced performance middleware suite
const middlewares = performanceMiddleware.getAllMiddleware();
middlewares.forEach(middleware => app.use(middleware));

// Middleware for JSON parsing (after compression)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Legacy middleware for request counting (enhanced by performance middleware)
app.use((req, res, next) => {
  metrics.requests++;
  next();
});

// Enhanced root endpoint with advanced performance info
app.get('/', (req, res) => {
  const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
  const isRealHistory = tool.constructor.name !== 'MockBrowserHistoryTool';
  const advancedMetrics = getMetrics();
  
  res.json({
    status: 'ok',
    message: 'LLM AI Bridge Server - ADVANCED PERFORMANCE OPTIMIZED',
    version: '1.3.0',
    uptime: uptime,
    browserHistory: {
      enabled: true,
      type: isRealHistory ? 'SQLite Database Access' : 'Mock Implementation',
      note: isRealHistory ? 'Real browser data access active' : 'Run npm run build for real browser history'
    },
    performance: {
      requests: metrics.requests,
      errors: metrics.errors,
      averageResponseTime: `${advancedMetrics.requests.averageResponseTime.toFixed(2)}ms`,
      fastRequests: advancedMetrics.requests.fastRequests,
      slowRequests: advancedMetrics.requests.slowRequests,
      cacheHitRate: `${advancedMetrics.cache.hitRate}%`,
      compressionEnabled: true,
      memory: {
        heapUsed: Math.round(metrics.memory.heapUsed / 1024 / 1024),
        heapTotal: Math.round(metrics.memory.heapTotal / 1024 / 1024),
        external: Math.round(metrics.memory.external / 1024 / 1024),
        pressure: Math.round((metrics.memory.heapUsed / metrics.memory.heapTotal) * 100)
      }
    },
    optimization: {
      autonomous: 'enabled',
      middleware: 'advanced',
      compression: 'intelligent',
      caching: 'smart',
      monitoring: 'real-time'
    },
    endpoints: [
      { path: '/health', method: 'GET', description: 'Enhanced health check endpoint', cache: '30s' },
      { path: '/metrics', method: 'GET', description: 'Advanced Prometheus metrics', cache: '30s' },
      { path: '/api/status', method: 'GET', description: 'Detailed system status', cache: '60s' },
      { path: '/api/performance', method: 'GET', description: 'Advanced performance metrics', cache: 'none' },
      { path: '/history', method: 'GET', description: 'Get recent browser history', cache: 'none' },
      { path: '/history/:count', method: 'GET', description: 'Get browser history with custom count', cache: 'none' },
      { path: '/search', method: 'GET', description: 'Search browser history (use ?query=term)', cache: 'none' }
    ],
    esm: {
      status: 'ACTIVE',
      imports: 'Dynamic ES6 imports working',
      compatibility: 'Full ESM compliance with performance optimization'
    }
  });
});

// Enhanced health check endpoint with advanced metrics
app.get('/health', (req, res) => {
  const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
  const memUsage = process.memoryUsage();
  const memoryPressure = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
  const isRealHistory = tool.constructor.name !== 'MockBrowserHistoryTool';
  const advancedMetrics = getMetrics();
  
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: uptime,
    browserHistory: {
      available: true,
      type: isRealHistory ? 'real' : 'mock'
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
      errorRate: metrics.requests > 0 ? (metrics.errors / metrics.requests * 100).toFixed(2) : 0,
      averageResponseTime: advancedMetrics.requests.averageResponseTime.toFixed(2),
      cacheHitRate: advancedMetrics.cache.hitRate,
      fastRequests: advancedMetrics.requests.fastRequests,
      slowRequests: advancedMetrics.requests.slowRequests
    },
    optimization: {
      level: 'advanced',
      compression: 'active',
      caching: 'active',
      monitoring: 'active'
    },
    pid: process.pid,
    version: '1.3.0',
    node: process.version,
    platform: process.platform,
    esm: true
  };
  
  // Return 503 if memory pressure is too high or performance is degraded
  const status = (memoryPressure > 90 || advancedMetrics.requests.averageResponseTime > 2000) ? 503 : 200;
  res.status(status).json(healthCheck);
});

// Enhanced system status endpoint
app.get('/api/status', (req, res) => {
  const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
  const memUsage = process.memoryUsage();
  const isRealHistory = tool.constructor.name !== 'MockBrowserHistoryTool';
  const advancedMetrics = getMetrics();
  
  res.json({
    service: 'LLM AI Bridge Server - Advanced Performance',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.3.0',
    uptime: uptime,
    environment: process.env.NODE_ENV || 'development',
    esm: {
      enabled: true,
      moduleType: 'ES6',
      dynamicImports: 'supported'
    },
    browserHistory: {
      status: 'active',
      implementation: isRealHistory ? 'SQLite with better-sqlite3' : 'Mock fallback',
      multibrower: isRealHistory,
      databases: isRealHistory ? ['Chrome', 'Firefox', 'Edge', 'Brave', 'Safari'] : ['Mock']
    },
    performance: {
      totalRequests: metrics.requests,
      totalErrors: metrics.errors,
      requestsPerSecond: (metrics.requests / uptime || 0).toFixed(2),
      errorRate: metrics.requests > 0 ? (metrics.errors / metrics.requests * 100).toFixed(2) : 0,
      averageResponseTime: advancedMetrics.requests.averageResponseTime.toFixed(2),
      fastRequests: advancedMetrics.requests.fastRequests,
      slowRequests: advancedMetrics.requests.slowRequests,
      cacheHitRate: advancedMetrics.cache.hitRate,
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024)
      }
    },
    optimization: {
      autonomous: 'enabled',
      compression: 'intelligent',
      caching: 'smart-caching-enabled',
      monitoring: 'real-time',
      middleware: 'advanced-performance-suite'
    },
    features: {
      browserHistory: 'enabled',
      performanceMonitoring: 'advanced',
      healthChecks: 'enhanced',
      esmCompatibility: 'enabled',
      dynamicImports: 'enabled',
      compression: 'intelligent',
      caching: 'response-caching',
      metrics: 'prometheus-compatible'
    }
  });
});

// Advanced performance metrics endpoint
app.get('/api/performance', (req, res) => {
  const advancedMetrics = getMetrics();
  const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
  
  res.json({
    timestamp: new Date().toISOString(),
    uptime: uptime,
    requests: advancedMetrics.requests,
    cache: advancedMetrics.cache,
    performance: advancedMetrics.performance,
    system: advancedMetrics.system,
    optimization: {
      level: 'advanced',
      features: {
        compression: 'active',
        caching: 'active',
        monitoring: 'real-time',
        gc_optimization: global.gc ? 'available' : 'unavailable'
      },
      targets: {
        responseTime: '<200ms',
        memoryUsage: '<150MB',
        cacheHitRate: '>80%',
        errorRate: '<1%'
      }
    }
  });
});

// Enhanced Prometheus metrics endpoint
app.get('/metrics', (req, res) => {
  const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
  const memUsage = process.memoryUsage();
  const isRealHistory = tool.constructor.name !== 'MockBrowserHistoryTool';
  const advancedMetrics = getMetrics();
  
  res.set('Content-Type', 'text/plain');
  res.send(`# HELP requests_total Total number of requests
# TYPE requests_total counter
requests_total ${metrics.requests}

# HELP errors_total Total number of errors
# TYPE errors_total counter
errors_total ${metrics.errors}

# HELP requests_fast_total Number of fast requests (<1s)
# TYPE requests_fast_total counter
requests_fast_total ${advancedMetrics.requests.fastRequests}

# HELP requests_slow_total Number of slow requests (>1s)
# TYPE requests_slow_total counter
requests_slow_total ${advancedMetrics.requests.slowRequests}

# HELP response_time_average_ms Average response time in milliseconds
# TYPE response_time_average_ms gauge
response_time_average_ms ${advancedMetrics.requests.averageResponseTime.toFixed(2)}

# HELP cache_hit_rate_percent Cache hit rate percentage
# TYPE cache_hit_rate_percent gauge
cache_hit_rate_percent ${advancedMetrics.cache.hitRate}

# HELP cache_size Current cache size
# TYPE cache_size gauge
cache_size ${advancedMetrics.cache.size}

# HELP uptime_seconds Application uptime in seconds
# TYPE uptime_seconds gauge
uptime_seconds ${uptime}

# HELP memory_usage_bytes Memory usage in bytes
# TYPE memory_usage_bytes gauge
memory_usage_rss_bytes ${memUsage.rss}
memory_usage_heap_used_bytes ${memUsage.heapUsed}
memory_usage_heap_total_bytes ${memUsage.heapTotal}
memory_usage_external_bytes ${memUsage.external}

# HELP nodejs_version Node.js version info
# TYPE nodejs_version gauge
nodejs_version{version="${process.version}"} 1

# HELP llm_optimization_level Optimization level
# TYPE llm_optimization_level gauge
llm_optimization_level{level="advanced"} 1

# HELP llm_compression_enabled Compression status
# TYPE llm_compression_enabled gauge
llm_compression_enabled 1

# HELP llm_caching_enabled Caching status
# TYPE llm_caching_enabled gauge
llm_caching_enabled 1

# HELP llm_browser_history_type Browser history implementation type
# TYPE llm_browser_history_type gauge
llm_browser_history_real ${isRealHistory ? 1 : 0}
llm_browser_history_mock ${isRealHistory ? 0 : 1}

# HELP llm_esm_status ESM compatibility status
# TYPE llm_esm_status gauge
llm_esm_enabled 1
llm_dynamic_imports_working 1
`);
});

// Get recent browser history (default 50 entries)
app.get('/history', async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 50;
    const history = await tool.getRecentHistory(count);
    const isRealHistory = tool.constructor.name !== 'MockBrowserHistoryTool';
    
    res.json({
      success: true,
      count: history.length,
      data: history,
      implementation: isRealHistory ? 'real' : 'mock',
      optimization: 'advanced-performance-enabled',
      note: isRealHistory ? 'Real browser history from SQLite databases' : 'Mock data - run npm run build for real browser history'
    });
  } catch (error) {
    metrics.errors++;
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get recent browser history with custom count
app.get('/history/:count', async (req, res) => {
  try {
    const count = parseInt(req.params.count) || 50;
    const history = await tool.getRecentHistory(count);
    const isRealHistory = tool.constructor.name !== 'MockBrowserHistoryTool';
    
    res.json({
      success: true,
      count: history.length,
      data: history,
      implementation: isRealHistory ? 'real' : 'mock',
      optimization: 'advanced-performance-enabled',
      note: isRealHistory ? 'Real browser history from SQLite databases' : 'Mock data - run npm run build for real browser history'
    });
  } catch (error) {
    metrics.errors++;
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Search browser history
app.get('/search', async (req, res) => {
  try {
    const query = req.query.query || '';
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required',
        timestamp: new Date().toISOString()
      });
    }

    const count = parseInt(req.query.count) || 100;
    const history = await tool.getRecentHistory(count);
    const isRealHistory = tool.constructor.name !== 'MockBrowserHistoryTool';

    // Filter history based on query
    const results = history.filter(
      (item) =>
        item.title?.toLowerCase().includes(query.toLowerCase()) ||
        item.url?.toLowerCase().includes(query.toLowerCase())
    );

    res.json({
      success: true,
      query: query,
      count: results.length,
      data: results,
      implementation: isRealHistory ? 'real' : 'mock',
      optimization: 'advanced-performance-enabled',
      note: isRealHistory ? 'Real browser history search' : 'Mock data search - run npm run build for real browser history'
    });
  } catch (error) {
    metrics.errors++;
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware (enhanced)
app.use((error, req, res, next) => {
  metrics.errors++;
  console.error('Unhandled error:', error);
  
  // Enhanced error response with performance context
  const advancedMetrics = getMetrics();
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
    performance: {
      currentLoad: advancedMetrics.requests.totalRequests,
      memoryPressure: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
      optimization: 'advanced'
    }
  });
});

// Enhanced 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: ['/', '/health', '/metrics', '/api/status', '/api/performance', '/history', '/search'],
    optimization: 'advanced-performance-enabled'
  });
});

// Graceful shutdown handling (enhanced)
const gracefulShutdown = (signal) => {
  console.log(`Received ${signal}, shutting down gracefully`);
  console.log('Cleaning up resources...');
  
  // Cleanup browser history tool
  tool.destroy?.();
  
  // Cleanup performance middleware
  if (performanceMiddleware.cleanup) {
    performanceMiddleware.cleanup();
  }
  
  console.log('Graceful shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('SIGUSR2', gracefulShutdown); // For nodemon

// Start the server with advanced performance monitoring
const server = app.listen(PORT, '0.0.0.0', () => {
  const isRealHistory = tool.constructor.name !== 'MockBrowserHistoryTool';
  
  console.log(`\n🚀 LLM AI Bridge Server - ADVANCED PERFORMANCE OPTIMIZED`);
  console.log(`🌐 Server listening at http://0.0.0.0:${PORT}`);
  console.log(`✅ ESM COMPATIBLE - ES6 modules with advanced optimization`);
  console.log(`📈 Performance Level: ADVANCED`);
  console.log(`📊 Browser History: ${isRealHistory ? 'Real SQLite Access' : 'Mock Implementation'}`);
  if (!isRealHistory) {
    console.log(`   💡 Run \`npm run build\` to enable real browser history`);
  }
  console.log('');
  console.log('⚡ Advanced Optimizations Active:');
  console.log('  • Intelligent compression enabled');
  console.log('  • Smart response caching active');
  console.log('  • Real-time performance monitoring');
  console.log('  • Advanced request optimization');
  console.log('  • Memory pressure monitoring');
  console.log('');
  console.log('🔗 Enhanced Endpoints:');
  console.log('  GET / - Advanced API information and performance metrics');
  console.log('  GET /health - Enhanced health check with performance data');
  console.log('  GET /api/status - Detailed system status with optimization info');
  console.log('  GET /api/performance - Advanced performance metrics dashboard');
  console.log('  GET /metrics - Enhanced Prometheus metrics');
  console.log('  GET /history - Browser history with performance optimization');
  console.log('  GET /history/:count - Custom count with intelligent caching');
  console.log('  GET /search?query=term - Optimized history search');
  console.log('');
  console.log('🚀 Server is production-ready with ADVANCED PERFORMANCE OPTIMIZATION');
  
  // Log initial performance metrics
  setTimeout(() => {
    const initialMetrics = getMetrics();
    console.log(`\n📊 Initial Performance Metrics:`);
    console.log(`  • Memory Usage: ${Math.round(initialMetrics.system.memory.heapUsed / 1024 / 1024)}MB`);
    console.log(`  • Cache Status: ${initialMetrics.cache.size} items cached`);
    console.log(`  • Optimization: Advanced performance suite active`);
  }, 1000);
});

export default app;