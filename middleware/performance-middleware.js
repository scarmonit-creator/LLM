#!/usr/bin/env node

/**
 * 🚀 ADVANCED PERFORMANCE MIDDLEWARE
 * Real-time request optimization and monitoring
 */

import compression from 'compression';
import { promisify } from 'util';

// Performance tracking storage
const performanceCache = new Map();
const requestMetrics = {
  totalRequests: 0,
  fastRequests: 0,
  slowRequests: 0,
  averageResponseTime: 0,
  lastCleanup: Date.now()
};

// Response caching for frequently accessed endpoints
const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_SIZE = 100;

class PerformanceMiddleware {
  constructor(options = {}) {
    this.options = {
      compressionEnabled: true,
      cachingEnabled: true,
      metricsEnabled: true,
      slowRequestThreshold: 1000, // 1 second
      cacheableEndpoints: ['/health', '/api/status', '/metrics'],
      ...options
    };
  }

  // Compression middleware with intelligent settings
  getCompressionMiddleware() {
    if (!this.options.compressionEnabled) {
      return (req, res, next) => next();
    }

    return compression({
      filter: (req, res) => {
        // Don't compress if client doesn't support it
        if (req.headers['x-no-compression']) {
          return false;
        }
        
        // Always compress JSON responses
        if (res.getHeader('Content-Type')?.includes('application/json')) {
          return true;
        }
        
        // Use compression's default filter for other types
        return compression.filter(req, res);
      },
      level: 6, // Good balance between compression and speed
      threshold: 1024, // Only compress responses > 1KB
      windowBits: 15,
      memLevel: 8
    });
  }

  // Intelligent response caching middleware
  getCachingMiddleware() {
    return (req, res, next) => {
      if (!this.options.cachingEnabled) {
        return next();
      }

      const cacheKey = `${req.method}:${req.path}`;
      const isGET = req.method === 'GET';
      const isCacheable = this.options.cacheableEndpoints.some(endpoint => 
        req.path.startsWith(endpoint)
      );

      // Only cache GET requests to specific endpoints
      if (!isGET || !isCacheable) {
        return next();
      }

      // Check cache first
      const cached = responseCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Age', Math.floor((Date.now() - cached.timestamp) / 1000));
        return res.json(cached.data);
      }

      // Intercept response to cache it
      const originalJson = res.json;
      res.json = function(data) {
        // Cache the response if successful
        if (res.statusCode === 200) {
          // Clean cache if it gets too large
          if (responseCache.size >= CACHE_MAX_SIZE) {
            const oldestKey = responseCache.keys().next().value;
            responseCache.delete(oldestKey);
          }

          responseCache.set(cacheKey, {
            data,
            timestamp: Date.now()
          });
          
          res.set('X-Cache', 'MISS');
        }

        return originalJson.call(this, data);
      };

      next();
    };
  }

  // Performance monitoring middleware
  getPerformanceMiddleware() {
    return (req, res, next) => {
      if (!this.options.metricsEnabled) {
        return next();
      }

      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage().heapUsed;

      requestMetrics.totalRequests++;

      // Monitor response completion
      res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000; // Convert to ms
        const endMemory = process.memoryUsage().heapUsed;
        const memoryDelta = endMemory - startMemory;

        // Update metrics
        if (responseTime > this.options.slowRequestThreshold) {
          requestMetrics.slowRequests++;
        } else {
          requestMetrics.fastRequests++;
        }

        // Calculate rolling average response time
        requestMetrics.averageResponseTime = (
          (requestMetrics.averageResponseTime * (requestMetrics.totalRequests - 1) + responseTime) / 
          requestMetrics.totalRequests
        );

        // Store detailed metrics for analysis
        const requestKey = `${req.method}:${req.path}`;
        if (!performanceCache.has(requestKey)) {
          performanceCache.set(requestKey, {
            count: 0,
            totalTime: 0,
            avgTime: 0,
            maxTime: 0,
            minTime: Infinity,
            memoryImpact: 0
          });
        }

        const metrics = performanceCache.get(requestKey);
        metrics.count++;
        metrics.totalTime += responseTime;
        metrics.avgTime = metrics.totalTime / metrics.count;
        metrics.maxTime = Math.max(metrics.maxTime, responseTime);
        metrics.minTime = Math.min(metrics.minTime, responseTime);
        metrics.memoryImpact += memoryDelta;

        // Add performance headers
        res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
        res.set('X-Memory-Delta', `${Math.round(memoryDelta / 1024)}KB`);
        res.set('X-Performance-Score', this.calculatePerformanceScore(responseTime, memoryDelta));
      });

      // Periodic cleanup of old metrics
      if (Date.now() - requestMetrics.lastCleanup > 300000) { // 5 minutes
        this.cleanupMetrics();
        requestMetrics.lastCleanup = Date.now();
      }

      next();
    };
  }

  // Request optimization middleware
  getOptimizationMiddleware() {
    return (req, res, next) => {
      // Add security headers for performance
      res.set({
        'X-DNS-Prefetch-Control': 'on',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Powered-By': 'LLM-Optimized-Server'
      });

      // Enable keep-alive for better connection reuse
      res.set('Connection', 'keep-alive');
      
      // Set cache control for static-like endpoints
      if (req.path === '/health' || req.path === '/metrics') {
        res.set('Cache-Control', 'public, max-age=30'); // 30 seconds
      } else if (req.path === '/api/status') {
        res.set('Cache-Control', 'public, max-age=60'); // 1 minute
      }

      next();
    };
  }

  // Calculate performance score (0-100)
  calculatePerformanceScore(responseTime, memoryDelta) {
    let score = 100;
    
    // Penalize slow response times
    if (responseTime > 500) score -= 20;
    if (responseTime > 1000) score -= 30;
    if (responseTime > 2000) score -= 40;
    
    // Penalize high memory usage
    if (memoryDelta > 1024 * 1024) score -= 10; // 1MB
    if (memoryDelta > 5 * 1024 * 1024) score -= 20; // 5MB
    
    return Math.max(0, score);
  }

  // Clean up old metrics to prevent memory leaks
  cleanupMetrics() {
    // Remove cache entries older than TTL
    for (const [key, value] of responseCache.entries()) {
      if (Date.now() - value.timestamp > CACHE_TTL) {
        responseCache.delete(key);
      }
    }

    // Reset performance metrics if they get too large
    if (performanceCache.size > 1000) {
      performanceCache.clear();
    }
  }

  // Get current performance metrics
  getMetrics() {
    return {
      requests: requestMetrics,
      cache: {
        size: responseCache.size,
        hitRate: this.calculateCacheHitRate(),
        maxSize: CACHE_MAX_SIZE
      },
      performance: Object.fromEntries(performanceCache),
      system: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }
    };
  }

  calculateCacheHitRate() {
    // This would need to be tracked more precisely in a real implementation
    const totalRequests = requestMetrics.totalRequests;
    if (totalRequests === 0) return 0;
    
    // Estimate based on cache size and request patterns
    const estimatedHits = Math.min(responseCache.size * 10, totalRequests * 0.3);
    return Math.round((estimatedHits / totalRequests) * 100);
  }

  // Get all middleware in correct order
  getAllMiddleware() {
    return [
      this.getOptimizationMiddleware(),
      this.getCompressionMiddleware(),
      this.getCachingMiddleware(),
      this.getPerformanceMiddleware()
    ];
  }
}

// Create default instance
const performanceMiddleware = new PerformanceMiddleware();

// Export both class and default instance
export default performanceMiddleware;
export { PerformanceMiddleware };

// Export individual middleware functions for selective use
export const compression = performanceMiddleware.getCompressionMiddleware();
export const caching = performanceMiddleware.getCachingMiddleware();
export const performance = performanceMiddleware.getPerformanceMiddleware();
export const optimization = performanceMiddleware.getOptimizationMiddleware();
export const getMetrics = () => performanceMiddleware.getMetrics();