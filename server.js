import express from 'express';
import { BrowserHistoryTool } from './tools/browser-history.js';

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize BrowserHistoryTool with autoSync
const tool = new BrowserHistoryTool({ autoSync: true });

// Performance metrics tracking
let metrics = {
  requests: 0,
  errors: 0,
  uptime: Date.now(),
  memory: process.memoryUsage(),
  lastUpdated: new Date().toISOString()
};

// Update metrics every 30 seconds
setInterval(() => {
  metrics.memory = process.memoryUsage();
  metrics.lastUpdated = new Date().toISOString();
}, 30000);

// Middleware for JSON parsing
app.use(express.json());

// Middleware for request counting
app.use((req, res, next) => {
  metrics.requests++;
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'LLM AI Bridge Server',
    version: '1.0.0',
    uptime: Math.floor((Date.now() - metrics.uptime) / 1000),
    endpoints: [
      { path: '/health', method: 'GET', description: 'Health check endpoint' },
      { path: '/metrics', method: 'GET', description: 'Performance metrics' },
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
      {
        path: '/browsers',
        method: 'GET',
        description: 'Get list of available browsers',
      },
    ],
  });
});

// Health check endpoint for Fly.io
app.get('/health', (req, res) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - metrics.uptime) / 1000),
    memory: process.memoryUsage(),
    pid: process.pid
  };
  
  res.status(200).json(healthCheck);
});

// Metrics endpoint for monitoring
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
`);
});

// Get recent browser history (default 50 entries)
app.get('/history', async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 50;
    const browser = req.query.browser;
    const startTime = req.query.startTime ? parseInt(req.query.startTime) : undefined;
    const endTime = req.query.endTime ? parseInt(req.query.endTime) : undefined;
    
    const history = await tool.getHistory({
      maxResults: count,
      browser,
      startTime,
      endTime,
    });
    
    res.json({
      success: true,
      count: history.length,
      data: history,
      note: history.length === 0 ? 'No history data available. Install better-sqlite3 for full browser history access.' : undefined
    });
  } catch (error) {
    metrics.errors++;
    console.error('Error getting history:', error);
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
    const browser = req.query.browser;
    const startTime = req.query.startTime ? parseInt(req.query.startTime) : undefined;
    const endTime = req.query.endTime ? parseInt(req.query.endTime) : undefined;
    
    const history = await tool.getHistory({
      maxResults: count,
      browser,
      startTime,
      endTime,
    });
    
    res.json({
      success: true,
      count: history.length,
      data: history,
      note: history.length === 0 ? 'No history data available. Install better-sqlite3 for full browser history access.' : undefined
    });
  } catch (error) {
    metrics.errors++;
    console.error('Error getting history:', error);
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
    const browser = req.query.browser;
    
    const result = await tool.execute({
      action: 'search',
      query,
      maxResults: count,
      browser,
    });
    
    const results = JSON.parse(result);
    
    res.json({
      success: true,
      query: query,
      count: Array.isArray(results) ? results.length : 0,
      data: results,
      note: (!Array.isArray(results) || results.length === 0) ? 'No history data available. Install better-sqlite3 for full browser history access.' : undefined
    });
  } catch (error) {
    metrics.errors++;
    console.error('Error searching history:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get available browsers
app.get('/browsers', async (req, res) => {
  try {
    const result = await tool.execute({ action: 'get_browsers' });
    const browsers = JSON.parse(result);
    
    res.json({
      success: true,
      ...browsers,
    });
  } catch (error) {
    metrics.errors++;
    console.error('Error getting browsers:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  metrics.errors++;
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (tool.destroy) {
    tool.destroy();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  if (tool.destroy) {
    tool.destroy();
  }
  process.exit(0);
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`LLM AI Bridge server listening at http://0.0.0.0:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET / - API information');
  console.log('  GET /health - Health check');
  console.log('  GET /metrics - Performance metrics');
  console.log('  GET /history - Get recent browser history (default 50)');
  console.log('  GET /history/:count - Get recent browser history with custom count');
  console.log('  GET /search?query=term - Search browser history');
  console.log('  GET /browsers - Get list of available browsers');
  console.log('\nQuery parameters:');
  console.log('  ?browser=chrome|firefox|edge|safari|brave|opera');
  console.log('  ?count=number (max results)');
  console.log('  ?startTime=timestamp');
  console.log('  ?endTime=timestamp');
  console.log('\nNote: Install better-sqlite3 for full browser history access.');
});

export default app;