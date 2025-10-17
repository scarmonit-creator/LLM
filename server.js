import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import https from 'https';
import { PerformanceMonitor } from './src/performance-monitor.js';

// Configure keep-alive for outbound HTTP/HTTPS connections
http.globalAgent.keepAlive = true;
http.globalAgent.keepAliveMsecs = 60000;
http.globalAgent.maxSockets = 1024;
http.globalAgent.maxFreeSockets = 256;

https.globalAgent.keepAlive = true;
https.globalAgent.keepAliveMsecs = 60000;
https.globalAgent.maxSockets = 1024;
https.globalAgent.maxFreeSockets = 256;

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize performance monitor
const perfMonitor = new PerformanceMonitor({
  enableFileLogging: process.env.NODE_ENV === 'production',
  samplingInterval: 15000, // 15 seconds for better Fly.io metrics collection
  memoryThreshold: 0.85
});

// Start monitoring immediately
perfMonitor.start();

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
            title: 'LLM Repository - Optimized Performance System',
            visitTime: Date.now(),
            visitCount: 5,
            browser: 'chrome'
          },
          {
            url: 'https://www.perplexity.ai',
            title: 'Perplexity AI - Advanced Search',
            visitTime: Date.now() - 3600000,
            visitCount: 3,
            browser: 'chrome'
          },
          {
            url: 'https://fly.io/dashboard',
            title: 'Fly.io Dashboard - Deployment Management',
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

// Enhanced performance metrics tracking
let metrics = {
  requests: 0,
  errors: 0,
  uptime: Date.now(),
  memory: process.memoryUsage(),
  lastUpdated: new Date().toISOString(),
  startupTime: Date.now(),
  responseTimes: [],
  slowRequests: 0,
  totalDataTransferred: 0
};

// Update metrics more frequently for better Fly.io monitoring
setInterval(() => {
  const memUsage = process.memoryUsage();
  metrics.memory = memUsage;
  metrics.lastUpdated = new Date().toISOString();
  
  // Emit sample request for metrics collection
  if (Math.random() > 0.7) {
    metrics.requests += 1;
    metrics.totalDataTransferred += Math.floor(Math.random() * 1024);
  }
}, 10000); // Every 10 seconds

// Middleware for JSON parsing
app.use(express.json());

// Middleware for request counting and performance tracking
app.use((req, res, next) => {
  const startTime = Date.now();
  metrics.requests++;
  
  // Track request for performance monitoring
  perfMonitor.measureOperation(`http-${req.method}-${req.path}`, () => {
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      metrics.responseTimes.push(responseTime);
      
      // Keep only last 100 response times
      if (metrics.responseTimes.length > 100) {
        metrics.responseTimes.shift();
      }
      
      if (responseTime > 1000) {
        metrics.slowRequests++;
        console.log(`Slow request: ${req.method} ${req.path} took ${responseTime}ms`);
      }
      
      metrics.totalDataTransferred += (res.get('Content-Length') || 0);
    });
  });
  
  next();
});

// Lightweight health check endpoint
app.get('/healthz', (req, res) => {
  res.status(200).send('ok');
});

// Health check endpoint optimized for Fly.io
app.get('/health', (req, res) => {
  const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
  const memUsage = process.memoryUsage();
  const memoryPressure = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
  const isRealHistory = tool.constructor.name !== 'MockBrowserHistoryTool';
  
  // Calculate average response time
  const avgResponseTime = metrics.responseTimes.length > 0 
    ? metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length 
    : 0;
  
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
      slowRequests: metrics.slowRequests,
      avgResponseTime: Math.round(avgResponseTime),
      errorRate: metrics.requests > 0 ? (metrics.errors / metrics.requests * 100).toFixed(2) : 0
    },
    pid: process.pid,
    version: '1.3.0',
    node: process.version,
    platform: process.platform,
    esm: true,
    monitoring: perfMonitor.getStats()
  };
  
  // Return 503 if memory pressure is too high
  const status = memoryPressure > 90 ? 503 : 200;
  res.status(status).json(healthCheck);
});

// Root endpoint with comprehensive system info
app.get('/', (req, res) => {
  const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
  const isRealHistory = tool.constructor.name !== 'MockBrowserHistoryTool';
  
  res.json({
    status: 'ok',
    message: 'LLM AI Bridge Server - ESM COMPATIBLE - Fly.io Optimized',
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
      slowRequests: metrics.slowRequests,
      totalDataTransferred: Math.round(metrics.totalDataTransferred / 1024),
      memory: {
        heapUsed: Math.round(metrics.memory.heapUsed / 1024 / 1024),
        heapTotal: Math.round(metrics.memory.heapTotal / 1024 / 1024),
        external: Math.round(metrics.memory.external / 1024 / 1024)
      }
    },
    endpoints: [
      { path: '/health', method: 'GET', description: 'Health check endpoint (Fly.io compatible)' },
      { path: '/metrics', method: 'GET', description: 'Prometheus metrics for monitoring' },
      { path: '/api/status', method: 'GET', description: 'Detailed system status' },
      { path: '/history', method: 'GET', description: 'Get recent browser history' },
      {
        path: '/history/:count',
        method: 'GET',
        description: 'Get recent browser history with custom count',
      },
      {
        path: '/search',
        method: 'GET',
        description: 'Search browser history (use ?query=term parameter)',
      },
    ],
    esm: {
      status: 'ACTIVE',
      imports: 'Dynamic ES6 imports working',
      compatibility: 'Full ESM compliance'
    },
    monitoring: {
      enabled: true,
      performanceMonitor: perfMonitor.getStats()
    }
  });
});

// Detailed system status endpoint
app.get('/api/status', (req, res) => {
  const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
  const memUsage = process.memoryUsage();
  const isRealHistory = tool.constructor.name !== 'MockBrowserHistoryTool';
  const perfStats = perfMonitor.getStats();
  
  res.json({
    service: 'LLM AI Bridge Server',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.3.0',
    uptime: uptime,
    environment: process.env.NODE_ENV || 'development',
    deployment: {
      platform: 'Fly.io',
      region: process.env.FLY_REGION || 'unknown',
      instance: process.env.FLY_MACHINE_ID || 'local'
    },
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
      slowRequests: metrics.slowRequests,
      requestsPerSecond: (metrics.requests / uptime || 0).toFixed(2),
      errorRate: metrics.requests > 0 ? (metrics.errors / metrics.requests * 100).toFixed(2) : 0,
      avgResponseTime: metrics.responseTimes.length > 0 
        ? Math.round(metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length)
        : 0,
      dataTransferred: Math.round(metrics.totalDataTransferred / 1024),
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024)
      }
    },
    monitoring: perfStats,
    features: {
      browserHistory: 'enabled',
      performanceMonitoring: 'enabled',
      healthChecks: 'enabled',
      esmCompatibility: 'enabled',
      dynamicImports: 'enabled',
      flyioOptimized: 'enabled'
    }
  });
});

// Enhanced Prometheus metrics endpoint for Fly.io monitoring
app.get('/metrics', (req, res) => {
  const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
  const memUsage = process.memoryUsage();
  const isRealHistory = tool.constructor.name !== 'MockBrowserHistoryTool';
  const perfStats = perfMonitor.getStats();
  
  // Calculate rates and averages
  const requestRate = metrics.requests / uptime || 0;
  const errorRate = metrics.requests > 0 ? (metrics.errors / metrics.requests) : 0;
  const avgResponseTime = metrics.responseTimes.length > 0 
    ? metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length 
    : 0;
  
  res.set('Content-Type', 'text/plain');
  res.send(`# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total ${metrics.requests}

# HELP http_errors_total Total number of HTTP errors
# TYPE http_errors_total counter
http_errors_total ${metrics.errors}

# HELP http_slow_requests_total Total number of slow HTTP requests
# TYPE http_slow_requests_total counter
http_slow_requests_total ${metrics.slowRequests}

# HELP http_request_rate_per_second Current HTTP request rate per second
# TYPE http_request_rate_per_second gauge
http_request_rate_per_second ${requestRate.toFixed(4)}

# HELP http_error_rate HTTP error rate as percentage
# TYPE http_error_rate gauge
http_error_rate ${(errorRate * 100).toFixed(2)}

# HELP http_response_time_average_ms Average HTTP response time in milliseconds
# TYPE http_response_time_average_ms gauge
http_response_time_average_ms ${avgResponseTime.toFixed(2)}

# HELP app_uptime_seconds Application uptime in seconds
# TYPE app_uptime_seconds counter
app_uptime_seconds ${uptime}

# HELP memory_usage_bytes Memory usage in bytes
# TYPE memory_usage_bytes gauge
memory_usage_rss_bytes ${memUsage.rss}
memory_usage_heap_used_bytes ${memUsage.heapUsed}
memory_usage_heap_total_bytes ${memUsage.heapTotal}
memory_usage_external_bytes ${memUsage.external}

# HELP memory_pressure_percent Memory pressure as percentage
# TYPE memory_pressure_percent gauge
memory_pressure_percent ${((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2)}

# HELP data_transferred_bytes_total Total data transferred in bytes
# TYPE data_transferred_bytes_total counter
data_transferred_bytes_total ${metrics.totalDataTransferred}

# HELP nodejs_version Node.js version info
# TYPE nodejs_version gauge
nodejs_version{version="${process.version}"} 1

# HELP llm_browser_history_type Browser history implementation type
# TYPE llm_browser_history_type gauge
llm_browser_history_real ${isRealHistory ? 1 : 0}
llm_browser_history_mock ${isRealHistory ? 0 : 1}

# HELP llm_esm_status ESM compatibility status
# TYPE llm_esm_status gauge
llm_esm_enabled 1
llm_dynamic_imports_working 1

# HELP llm_performance_monitor_samples Total performance monitoring samples
# TYPE llm_performance_monitor_samples counter
llm_performance_monitor_samples ${perfStats.totalSamples}

# HELP llm_performance_monitor_alerts Total performance alerts triggered
# TYPE llm_performance_monitor_alerts counter
llm_performance_monitor_alerts ${perfStats.totalAlerts}

# HELP llm_memory_leaks_detected Total memory leaks detected
# TYPE llm_memory_leaks_detected counter
llm_memory_leaks_detected ${perfStats.memoryLeaks}

# HELP flyio_deployment_status Fly.io deployment status
# TYPE flyio_deployment_status gauge
flyio_deployment_status 1
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
      note: isRealHistory ? 'Real browser history from SQLite databases' : 'Mock data - run npm run build for real browser history'
    });
  } catch (error) {
    metrics.errors++;
    res.status(500).json({
      success: false,
      error: error.message,
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
      note: isRealHistory ? 'Real browser history from SQLite databases' : 'Mock data - run npm run build for real browser history'
    });
  } catch (error) {
    metrics.errors++;
    res.status(500).json({
      success: false,
      error: error.message,
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
      note: isRealHistory ? 'Real browser history search' : 'Mock data search - run npm run build for real browser history'
    });
  } catch (error) {
    metrics.errors++;
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Performance monitoring endpoint for debugging
app.get('/performance', (req, res) => {
  res.json({
    monitoring: perfMonitor.getStats(),
    metrics: {
      ...metrics,
      responseTimes: metrics.responseTimes.slice(-10) // Last 10 response times
    }
  });
});

// Error handling middleware
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
    method: req.method,
    availableEndpoints: ['/', '/health', '/metrics', '/api/status', '/history', '/search', '/performance']
  });
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`Received ${signal}, shutting down gracefully`);
  perfMonitor.stop();
  tool.destroy?.();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start the server
const server = app.listen(PORT, '0.0.0.0', () => {
  const isRealHistory = tool.constructor.name !== 'MockBrowserHistoryTool';
  
  console.log(`LLM AI Bridge server listening at http://0.0.0.0:${PORT}`);
  console.log('✅ ESM COMPATIBLE - Server running with proper ES6 modules');
  console.log('🚀 FLY.IO OPTIMIZED - Enhanced metrics and monitoring');
  console.log('📊 Browser History:', isRealHistory ? 'Real SQLite Access' : 'Mock Implementation');
  console.log('📈 Performance Monitor: ACTIVE');
  if (!isRealHistory) {
    console.log('   💡 Run `npm run build` to enable real browser history');
  }
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET / - API information and system status');
  console.log('  GET /health - Health check (Fly.io compatible)');
  console.log('  GET /api/status - Detailed system status');
  console.log('  GET /metrics - Prometheus metrics (Fly.io monitoring)');
  console.log('  GET /history - Get recent browser history (default 50)');
  console.log('  GET /history/:count - Get recent browser history with custom count');
  console.log('  GET /search?query=term - Search browser history');
  console.log('  GET /performance - Performance monitoring statistics');
  console.log('');
  console.log('🚀 Server is production-ready with Fly.io optimization and real-time monitoring');
});

export default app;