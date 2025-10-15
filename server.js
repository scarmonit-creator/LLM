import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PerformanceMonitor } from './src/performance-monitor.js';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// TRAEFIK INTEGRATION - Trust proxy for accurate client IPs
app.set('trust proxy', 1);

// Initialize performance monitor
const perfMonitor = new PerformanceMonitor({
  enableFileLogging: process.env.NODE_ENV === 'production',
  samplingInterval: 15000,
  memoryThreshold: 0.85
});

perfMonitor.start();

// Browser History Tool - Dynamic import with fallback
let BrowserHistoryTool;
let tool;

const initializeBrowserHistory = async () => {
  try {
    const module = await import('./dist/tools/browser-history.js');
    BrowserHistoryTool = module.default;
    tool = new BrowserHistoryTool({ autoSync: true });
    console.log('✅ Real browser history tool loaded');
  } catch (importError) {
    console.log('⚠️  Using mock browser history implementation');
    
    class MockBrowserHistoryTool {
      constructor(config = {}) { this.config = config; }
      async getRecentHistory(count = 50) {
        return [
          {
            url: 'https://github.com/scarmonit-creator/LLM',
            title: 'LLM Repository - Traefik Optimized',
            visitTime: Date.now(),
            visitCount: 5,
            browser: 'chrome'
          },
          {
            url: 'https://traefik.io/traefik/',
            title: 'Traefik - Modern Reverse Proxy',
            visitTime: Date.now() - 3600000,
            visitCount: 3,
            browser: 'chrome'
          }
        ].slice(0, count);
      }
      destroy() {}
    }
    
    BrowserHistoryTool = MockBrowserHistoryTool;
    tool = new MockBrowserHistoryTool({ autoSync: true });
  }
};

await initializeBrowserHistory();

// FIXED METRICS - No more fake data injection
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

// FIXED - Only update memory stats, no fake requests
setInterval(() => {
  metrics.memory = process.memoryUsage();
  metrics.lastUpdated = new Date().toISOString();
}, 10000);

// Middleware for JSON parsing
app.use(express.json());

// TRAEFIK INTEGRATION MIDDLEWARE
app.use((req, res, next) => {
  // Instance identification for load balancing
  const instanceId = process.env.INSTANCE_ID || process.env.HOSTNAME || 'llm-unknown';
  const requestId = req.headers['x-request-id'] || req.headers['x-amzn-trace-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Traefik-aware headers
  res.setHeader('X-LLM-Instance', instanceId);
  res.setHeader('X-LLM-Version', '1.3.0');
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Traefik-Integration', 'active');
  
  // Log Traefik routing info
  if (req.headers['x-forwarded-host']) {
    console.log(`[TRAEFIK] ${req.method} ${req.path} -> ${instanceId} from ${req.headers['x-forwarded-host']}`);
  }
  
  next();
});

// FIXED REQUEST TRACKING - Accurate metrics only
app.use((req, res, next) => {
  const startTime = performance.now();
  metrics.requests++;
  
  res.on('finish', () => {
    const responseTime = performance.now() - startTime;
    metrics.responseTimes.push(responseTime);
    
    if (metrics.responseTimes.length > 100) {
      metrics.responseTimes.shift();
    }
    
    if (responseTime > 1000) {
      metrics.slowRequests++;
    }
    
    // FIXED - Proper data transfer tracking
    const contentLength = Number(res.get('Content-Length')) || 0;
    metrics.totalDataTransferred += contentLength;
    
    // Track errors properly
    if (res.statusCode >= 500) {
      metrics.errors++;
    }
  });
  
  next();
});

// TRAEFIK-ENHANCED HEALTH CHECK
app.get('/health', (req, res) => {
  const instanceId = process.env.INSTANCE_ID || process.env.HOSTNAME || 'llm-unknown';
  const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
  const memUsage = process.memoryUsage();
  const memoryPressure = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
  const isRealHistory = tool.constructor.name !== 'MockBrowserHistoryTool';
  
  const avgResponseTime = metrics.responseTimes.length > 0 
    ? metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length 
    : 0;
  
  const healthCheck = {
    status: memoryPressure > 90 ? 'unhealthy' : 'healthy',
    instance: instanceId,
    timestamp: new Date().toISOString(),
    uptime,
    traefik: {
      forwardedHost: req.headers['x-forwarded-host'],
      forwardedProto: req.headers['x-forwarded-proto'],
      realIp: req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip,
      stickySession: req.headers.cookie?.includes('llm-instance')
    },
    browserHistory: {
      available: true,
      type: isRealHistory ? 'real' : 'mock'
    },
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      pressure: memoryPressure
    },
    performance: {
      requests: metrics.requests,
      errors: metrics.errors,
      slowRequests: metrics.slowRequests,
      avgResponseTime: Math.round(avgResponseTime),
      errorRate: metrics.requests > 0 ? (metrics.errors / metrics.requests * 100).toFixed(2) : '0.00'
    }
  };
  
  const status = memoryPressure > 90 ? 503 : 200;
  res.status(status).json(healthCheck);
});

// READINESS CHECK for Traefik
app.get('/ready', (req, res) => {
  const instanceId = process.env.INSTANCE_ID || process.env.HOSTNAME || 'llm-unknown';
  
  // Check dependencies
  const isReady = tool && perfMonitor;
  
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not-ready',
    instance: instanceId,
    timestamp: new Date().toISOString(),
    checks: {
      browserHistory: !!tool,
      performanceMonitor: !!perfMonitor
    }
  });
});

// LIVENESS CHECK for Traefik
app.get('/live', (req, res) => {
  const instanceId = process.env.INSTANCE_ID || process.env.HOSTNAME || 'llm-unknown';
  
  res.status(200).json({
    status: 'alive',
    instance: instanceId,
    timestamp: new Date().toISOString(),
    pid: process.pid
  });
});

// TRAEFIK PING endpoint
app.get('/traefik/ping', (req, res) => {
  const instanceId = process.env.INSTANCE_ID || process.env.HOSTNAME || 'llm-unknown';
  res.status(200).json({
    status: 'pong',
    instance: instanceId,
    timestamp: new Date().toISOString(),
    traefik: 'integrated'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  const instanceId = process.env.INSTANCE_ID || process.env.HOSTNAME || 'llm-unknown';
  const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
  const isRealHistory = tool.constructor.name !== 'MockBrowserHistoryTool';
  
  res.json({
    status: 'ok',
    message: 'LLM AI Bridge Server - TRAEFIK INTEGRATED - Production Ready',
    version: '1.3.0',
    instance: instanceId,
    uptime,
    traefik: {
      integration: 'ACTIVE',
      loadBalancing: 'enabled',
      healthChecks: 'enabled',
      stickySession: req.headers.cookie?.includes('llm-instance') || false
    },
    browserHistory: {
      enabled: true,
      type: isRealHistory ? 'SQLite Database Access' : 'Mock Implementation'
    },
    performance: {
      requests: metrics.requests,
      errors: metrics.errors,
      slowRequests: metrics.slowRequests,
      memory: {
        heapUsed: Math.round(metrics.memory.heapUsed / 1024 / 1024),
        heapTotal: Math.round(metrics.memory.heapTotal / 1024 / 1024)
      }
    },
    endpoints: [
      { path: '/health', method: 'GET', description: 'Traefik health check' },
      { path: '/ready', method: 'GET', description: 'Readiness check' },
      { path: '/live', method: 'GET', description: 'Liveness check' },
      { path: '/traefik/ping', method: 'GET', description: 'Traefik ping' },
      { path: '/metrics', method: 'GET', description: 'Prometheus metrics' },
      { path: '/history', method: 'GET', description: 'Browser history' },
      { path: '/search', method: 'GET', description: 'Search history' }
    ]
  });
});

// FIXED PROMETHEUS METRICS
app.get('/metrics', (req, res) => {
  const instanceId = process.env.INSTANCE_ID || process.env.HOSTNAME || 'llm-unknown';
  const uptime = Math.floor((Date.now() - metrics.uptime) / 1000);
  const memUsage = process.memoryUsage();
  const isRealHistory = tool.constructor.name !== 'MockBrowserHistoryTool';
  
  // FIXED - Safe division with uptime guard
  const requestRate = uptime > 0 ? (metrics.requests / uptime) : 0;
  const errorRate = metrics.requests > 0 ? (metrics.errors / metrics.requests) : 0;
  const avgResponseTime = metrics.responseTimes.length > 0 
    ? metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length 
    : 0;
  
  res.set('Content-Type', 'text/plain');
  res.send(`# LLM Service Instance Metrics - Traefik Integrated
# Instance: ${instanceId}

# HELP llm_requests_total Total HTTP requests processed by this instance
# TYPE llm_requests_total counter
llm_requests_total{instance="${instanceId}"} ${metrics.requests}

# HELP llm_errors_total Total HTTP errors from this instance
# TYPE llm_errors_total counter
llm_errors_total{instance="${instanceId}"} ${metrics.errors}

# HELP llm_slow_requests_total Total slow requests (>1s) from this instance
# TYPE llm_slow_requests_total counter
llm_slow_requests_total{instance="${instanceId}"} ${metrics.slowRequests}

# HELP llm_request_rate_per_second Request rate per second for this instance
# TYPE llm_request_rate_per_second gauge
llm_request_rate_per_second{instance="${instanceId}"} ${requestRate.toFixed(4)}

# HELP llm_error_rate_percent Error rate as percentage for this instance
# TYPE llm_error_rate_percent gauge
llm_error_rate_percent{instance="${instanceId}"} ${(errorRate * 100).toFixed(2)}

# HELP llm_response_time_ms Average response time in milliseconds
# TYPE llm_response_time_ms gauge
llm_response_time_ms{instance="${instanceId}"} ${avgResponseTime.toFixed(2)}

# HELP llm_uptime_seconds Instance uptime in seconds
# TYPE llm_uptime_seconds counter
llm_uptime_seconds{instance="${instanceId}"} ${uptime}

# HELP llm_memory_bytes Memory usage in bytes by type
# TYPE llm_memory_bytes gauge
llm_memory_bytes{instance="${instanceId}",type="rss"} ${memUsage.rss}
llm_memory_bytes{instance="${instanceId}",type="heap_used"} ${memUsage.heapUsed}
llm_memory_bytes{instance="${instanceId}",type="heap_total"} ${memUsage.heapTotal}
llm_memory_bytes{instance="${instanceId}",type="external"} ${memUsage.external}

# HELP llm_memory_pressure_percent Memory pressure as percentage
# TYPE llm_memory_pressure_percent gauge
llm_memory_pressure_percent{instance="${instanceId}"} ${((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2)}

# HELP llm_data_transferred_bytes Total data transferred by this instance
# TYPE llm_data_transferred_bytes counter
llm_data_transferred_bytes{instance="${instanceId}"} ${metrics.totalDataTransferred}

# HELP llm_browser_history_type Browser history implementation (1=real, 0=mock)
# TYPE llm_browser_history_type gauge
llm_browser_history_real{instance="${instanceId}"} ${isRealHistory ? 1 : 0}

# HELP llm_traefik_integration Traefik integration status
# TYPE llm_traefik_integration gauge
llm_traefik_integration{instance="${instanceId}"} 1
`);
});

// Browser history endpoints
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
      instance: process.env.INSTANCE_ID || process.env.HOSTNAME || 'llm-unknown'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      instance: process.env.INSTANCE_ID || process.env.HOSTNAME || 'llm-unknown'
    });
  }
});

app.get('/search', async (req, res) => {
  try {
    const query = req.query.query || '';
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required',
        instance: process.env.INSTANCE_ID || process.env.HOSTNAME || 'llm-unknown'
      });
    }

    const count = parseInt(req.query.count) || 100;
    const history = await tool.getRecentHistory(count);
    const isRealHistory = tool.constructor.name !== 'MockBrowserHistoryTool';

    const results = history.filter(
      (item) =>
        item.title?.toLowerCase().includes(query.toLowerCase()) ||
        item.url?.toLowerCase().includes(query.toLowerCase())
    );

    res.json({
      success: true,
      query,
      count: results.length,
      data: results,
      implementation: isRealHistory ? 'real' : 'mock',
      instance: process.env.INSTANCE_ID || process.env.HOSTNAME || 'llm-unknown'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      instance: process.env.INSTANCE_ID || process.env.HOSTNAME || 'llm-unknown'
    });
  }
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
    instance: process.env.INSTANCE_ID || process.env.HOSTNAME || 'llm-unknown'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    instance: process.env.INSTANCE_ID || process.env.HOSTNAME || 'llm-unknown',
    availableEndpoints: ['/', '/health', '/ready', '/live', '/traefik/ping', '/metrics', '/history', '/search']
  });
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`[${process.env.INSTANCE_ID || 'llm'}] Received ${signal}, shutting down gracefully`);
  perfMonitor.stop();
  tool.destroy?.();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  const instanceId = process.env.INSTANCE_ID || process.env.HOSTNAME || 'llm-unknown';
  const isRealHistory = tool.constructor.name !== 'MockBrowserHistoryTool';
  
  console.log(`LLM AI Bridge server listening at http://0.0.0.0:${PORT}`);
  console.log(`🎯 Instance: ${instanceId}`);
  console.log('✅ ESM COMPATIBLE');
  console.log('🚀 TRAEFIK INTEGRATED');
  console.log('🛡️  Reverse proxy trust enabled');
  console.log('📊 Browser History:', isRealHistory ? 'Real SQLite' : 'Mock');
  console.log('📈 Performance Monitor: ACTIVE');
  console.log('🔍 Health Checks: /health, /ready, /live');
  console.log('📊 Metrics: /metrics (Prometheus)');
  console.log('');
  console.log('🎉 Production-ready with Traefik load balancing!');
});

export default app;