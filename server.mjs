import express from 'express';
import { BrowserHistoryTool } from './tools/browser-history.js';

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize BrowserHistoryTool with enhanced configuration
const historyTool = new BrowserHistoryTool({ 
  autoSync: true, 
  maxEntries: 1000,
  enableSqlite: true,
  crossPlatform: true 
});

// Performance metrics tracking
let metrics = {
  requests: 0,
  errors: 0,
  uptime: Date.now(),
  memory: process.memoryUsage(),
  lastUpdated: new Date().toISOString(),
  databaseStatus: 'initializing'
};

// Update metrics every 30 seconds
setInterval(() => {
  metrics.memory = process.memoryUsage();
  metrics.lastUpdated = new Date().toISOString();
}, 30000);

// Middleware for JSON parsing
app.use(express.json());

// CORS middleware for browser integration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Middleware for request counting and logging
app.use((req, res, next) => {
  metrics.requests++;
  console.log(`${new Date().toISOString()} ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Root endpoint with enhanced API documentation
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'LLM AI Bridge Server - Enhanced with Functional Browser History',
    version: '2.0.0',
    uptime: Math.floor((Date.now() - metrics.uptime) / 1000),
    features: [
      'Multi-browser history access',
      'Cross-platform compatibility',
      'SQLite database integration',
      'Real-time performance metrics',
      'Production-ready error handling'
    ],
    endpoints: [
      { 
        path: '/health', 
        method: 'GET', 
        description: 'Comprehensive health check with database status' 
      },
      { 
        path: '/metrics', 
        method: 'GET', 
        description: 'Prometheus-style performance metrics' 
      },
      { 
        path: '/history', 
        method: 'GET', 
        description: 'Get recent browser history (query params: count, browser, startTime, endTime)' 
      },
      {
        path: '/history/:count',
        method: 'GET',
        description: 'Get recent browser history with specific count',
      },
      {
        path: '/search',
        method: 'GET',
        description: 'Search browser history (required: ?query=term, optional: count, browser)',
      },
      {
        path: '/browsers',
        method: 'GET',
        description: 'List available browsers and their status'
      }
    ],
  });
});

// Enhanced health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connectivity
    const dbTest = await historyTool.testConnection();
    metrics.databaseStatus = dbTest ? 'connected' : 'unavailable';
    
    const healthCheck = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - metrics.uptime) / 1000),
      memory: process.memoryUsage(),
      database: {
        status: metrics.databaseStatus,
        lastTest: new Date().toISOString()
      },
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        pid: process.pid
      }
    };
    
    const statusCode = dbTest ? 200 : 503;
    res.status(statusCode).json(healthCheck);
  } catch (error) {
    metrics.errors++;
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Enhanced metrics endpoint
app.get('/metrics', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - metrics.uptime) / 1000);
  
  res.set('Content-Type', 'text/plain');
  res.send(`# HELP requests_total Total number of requests
# TYPE requests_total counter
requests_total ${metrics.requests}

# HELP errors_total Total number of errors
# TYPE errors_total counter
errors_total ${metrics.errors}

# HELP uptime_seconds Application uptime in seconds
# TYPE uptime_seconds gauge
uptime_seconds ${uptimeSeconds}

# HELP memory_usage_bytes Memory usage in bytes
# TYPE memory_usage_bytes gauge
memory_usage_rss_bytes ${metrics.memory.rss}
memory_usage_heap_used_bytes ${metrics.memory.heapUsed}
memory_usage_heap_total_bytes ${metrics.memory.heapTotal}
memory_usage_external_bytes ${metrics.memory.external}

# HELP database_status Database connection status (1=connected, 0=disconnected)
# TYPE database_status gauge
database_status ${metrics.databaseStatus === 'connected' ? 1 : 0}
`);
});

// Get available browsers
app.get('/browsers', async (req, res) => {
  try {
    const browsers = await historyTool.getAvailableBrowsers();
    res.json({
      success: true,
      browsers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    metrics.errors++;
    console.error('Error getting browsers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get recent browser history with enhanced filtering
app.get('/history', async (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count) || 50, 1000); // Cap at 1000
    const browser = req.query.browser;
    const startTime = req.query.startTime ? parseInt(req.query.startTime) : undefined;
    const endTime = req.query.endTime ? parseInt(req.query.endTime) : undefined;
    
    console.log(`Fetching history: count=${count}, browser=${browser}, timeRange=${startTime}-${endTime}`);
    
    const history = await historyTool.getRecentHistory(count, {
      browser,
      startTime,
      endTime
    });
    
    res.json({
      success: true,
      count: history.length,
      requestedCount: count,
      filters: {
        browser: browser || 'all',
        startTime,
        endTime
      },
      data: history,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    metrics.errors++;
    console.error('Error fetching history:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

// Get recent browser history with specific count
app.get('/history/:count', async (req, res) => {
  try {
    const count = Math.min(parseInt(req.params.count) || 50, 1000);
    const browser = req.query.browser;
    
    const history = await historyTool.getRecentHistory(count, { browser });
    
    res.json({
      success: true,
      count: history.length,
      requestedCount: count,
      browser: browser || 'all',
      data: history,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    metrics.errors++;
    console.error('Error fetching history by count:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Enhanced search browser history
app.get('/search', async (req, res) => {
  try {
    const query = req.query.query;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required and must be a string',
        example: '/search?query=github&count=100&browser=chrome'
      });
    }

    const count = Math.min(parseInt(req.query.count) || 100, 1000);
    const browser = req.query.browser;
    
    console.log(`Searching history: query="${query}", count=${count}, browser=${browser}`);
    
    const results = await historyTool.searchHistory(query, count, { browser });

    res.json({
      success: true,
      query,
      count: results.length,
      searchLimit: count,
      browser: browser || 'all',
      data: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    metrics.errors++;
    console.error('Error searching history:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      query: req.query.query
    });
  }
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
    availableEndpoints: [
      '/',
      '/health',
      '/metrics',
      '/browsers',
      '/history',
      '/history/:count',
      '/search'
    ]
  });
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`${signal} received, shutting down gracefully...`);
  
  // Close browser history tool
  if (historyTool && typeof historyTool.destroy === 'function') {
    historyTool.destroy();
  }
  
  // Close server
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

// Initialize and start server
async function startServer() {
  try {
    console.log('🚀 Initializing LLM AI Bridge Server v2.0.0...');
    
    // Test browser history functionality
    console.log('🔍 Testing browser history connectivity...');
    const dbTest = await historyTool.testConnection();
    metrics.databaseStatus = dbTest ? 'connected' : 'unavailable';
    
    if (dbTest) {
      console.log('✅ Browser history databases accessible');
    } else {
      console.log('⚠️  Browser history databases not accessible (service will run with limited functionality)');
    }
    
    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\\n🌐 LLM AI Bridge server listening at http://0.0.0.0:${PORT}`);
      console.log('\\n📋 Available endpoints:');
      console.log('  GET / - API information and status');
      console.log('  GET /health - Comprehensive health check');
      console.log('  GET /metrics - Prometheus-style metrics');
      console.log('  GET /browsers - Available browsers');
      console.log('  GET /history?count=50&browser=chrome - Get recent browser history');
      console.log('  GET /history/100 - Get specific number of history entries');
      console.log('  GET /search?query=github&count=50 - Search browser history');
      console.log('\\n✅ Server ready for requests');
      console.log(`🎯 Database Status: ${metrics.databaseStatus}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export default app;