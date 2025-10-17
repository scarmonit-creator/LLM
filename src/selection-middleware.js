// src/selection-middleware.js - Selection API and metrics middleware
import express from 'express';
import { saveSelection, getLatestSelections, searchSelections, getSelectionCount } from './selection-store.js';

const API_TOKEN = process.env.SELECTION_API_TOKEN || '';

// Metrics with BigInt for safe byte counting
export const metrics = {
  totalRequests: 0,
  totalErrors: 0,
  totalBytesSent: BigInt(0),
  totalBytesReceived: BigInt(0),
  selectionsStored: 0
};

/**
 * Verify API token from request
 */
function verifyToken(req) {
  const token = req.headers['x-api-token'] || req.query.token;
  return API_TOKEN && token && token === API_TOKEN;
}

/**
 * Convert BigInt to safe number for JSON
 */
function toNumberSafe(big) {
  const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
  return big > MAX_SAFE ? Number(MAX_SAFE) : Number(big);
}

/**
 * Metrics tracking middleware - fixes overflow bug
 */
export function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  // Track request bytes received
  const reqLen = req.headers['content-length']
    ? BigInt(req.headers['content-length'])
    : BigInt(0);
  metrics.totalBytesReceived += reqLen;

  // Track response bytes sent
  let bytesSent = BigInt(0);
  const origWrite = res.write;
  const origEnd = res.end;

  res.write = function (chunk, ...args) {
    if (chunk) {
      bytesSent += BigInt(
        Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk)
      );
    }
    return origWrite.call(this, chunk, ...args);
  };

  res.end = function (chunk, ...args) {
    if (chunk) {
      bytesSent += BigInt(
        Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk)
      );
    }
    const result = origEnd.call(this, chunk, ...args);
    metrics.totalBytesSent += bytesSent;
    metrics.totalRequests++;
    return result;
  };

  res.on('finish', () => {
    if (res.statusCode >= 500) metrics.totalErrors++;
    const duration = Number(process.hrtime.bigint() - start) / 1e6; // ms
    // Could log duration here if needed
  });

  next();
}

/**
 * Setup selection API routes
 */
export function setupSelectionRoutes(app) {
  // POST /api/selection - Save selected text
  app.post(
    '/api/selection',
    express.json({ limit: '256kb' }),
    (req, res) => {
      if (!verifyToken(req)) {
        return res.status(401).json({ error: 'unauthorized' });
      }

      const { url, title, selectedText, source } = req.body || {};

      if (!url || !selectedText) {
        return res.status(400).json({
          error: 'url and selectedText are required'
        });
      }

      try {
        const id = saveSelection({
          url: String(url).slice(0, 2048),
          title: title ? String(title).slice(0, 512) : null,
          selected_text: String(selectedText).slice(0, 100000),
          source: source ? String(source).slice(0, 64) : 'browser'
        });

        metrics.selectionsStored++;

        return res.json({ ok: true, id: Number(id) });
      } catch (error) {
        console.error('Failed to save selection:', error);
        return res.status(500).json({ error: 'Failed to save selection' });
      }
    }
  );

  // GET /api/selection/latest - Get recent selections
  app.get('/api/selection/latest', (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '10', 10) || 10, 100);
      const data = getLatestSelections(limit);

      return res.json({
        success: true,
        count: data.length,
        data
      });
    } catch (error) {
      console.error('Failed to get selections:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve selections'
      });
    }
  });

  // GET /api/selection/search - Search selections
  app.get('/api/selection/search', (req, res) => {
    try {
      const query = req.query.q || req.query.query || '';
      if (!query) {
        return res.status(400).json({ error: 'Query parameter required' });
      }

      const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 100);
      const data = searchSelections(query, limit);

      return res.json({
        success: true,
        query,
        count: data.length,
        data
      });
    } catch (error) {
      console.error('Search failed:', error);
      return res.status(500).json({ error: 'Search failed' });
    }
  });

  // GET /api/selection/stats - Get selection stats
  app.get('/api/selection/stats', (req, res) => {
    try {
      const totalCount = getSelectionCount();

      return res.json({
        totalSelections: totalCount,
        selectionsStoredThisSession: metrics.selectionsStored
      });
    } catch (error) {
      console.error('Stats failed:', error);
      return res.status(500).json({ error: 'Failed to get stats' });
    }
  });
}

/**
 * Get metrics with safe number conversion
 */
export function getMetrics() {
  return {
    totalRequests: metrics.totalRequests,
    totalErrors: metrics.totalErrors,
    totalBytesSent: toNumberSafe(metrics.totalBytesSent),
    totalBytesReceived: toNumberSafe(metrics.totalBytesReceived),
    selectionsStored: metrics.selectionsStored,
    errorRate:
      metrics.totalRequests > 0
        ? ((metrics.totalErrors / metrics.totalRequests) * 100).toFixed(2) + '%'
        : '0%'
  };
}

export default {
  metricsMiddleware,
  setupSelectionRoutes,
  getMetrics,
  metrics
};
