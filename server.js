const express = require('express');
const { BrowserHistoryTool } = require('./tools/browser-history');

const app = express();
const PORT = 3000;

// Initialize BrowserHistoryTool with autoSync
const tool = new BrowserHistoryTool({ autoSync: true });

// Middleware for JSON parsing
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Browser History API Server',
    endpoints: [
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
  });
});

// Get recent browser history (default 50 entries)
app.get('/history', async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 50;
    const history = await tool.getRecentHistory(count);
    res.json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
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
    res.json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
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
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Browser History API server listening at http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET / - API information');
  console.log('  GET /history - Get recent browser history (default 50)');
  console.log('  GET /history/:count - Get recent browser history with custom count');
  console.log('  GET /search?query=term - Search browser history');
});

module.exports = app;
