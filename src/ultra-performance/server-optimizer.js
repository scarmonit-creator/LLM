#!/usr/bin/env node
/**
 * Server Optimization Module
 * Integrates advanced optimization engine with Express server
 * Provides real-time performance enhancement and monitoring
 */

import { AdvancedOptimizationEngine } from './advanced-optimization-engine.js';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { cpus, totalmem, freemem } from 'os';
import cluster from 'cluster';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import LRU from 'lru-cache';

/**
 * Enhanced Server Optimizer
 * Provides comprehensive server optimization and monitoring
 */
class ServerOptimizer extends EventEmitter {
  constructor(app, options = {}) {
    super();
    
    this.app = app;
    this.options = {
      enableOptimization: options.enableOptimization !== false,
      enableCaching: options.enableCaching !== false,
      enableRateLimiting: options.enableRateLimiting !== false,
      enableSecurity: options.enableSecurity !== false,
      enableCompression: options.enableCompression !== false,
      enableClustering: options.enableClustering || false,
      cacheMaxSize: options.cacheMaxSize || 1000,
      rateLimitWindow: options.rateLimitWindow || 15 * 60 * 1000, // 15 minutes
      rateLimitMax: options.rateLimitMax || 100,
      optimizationInterval: options.optimizationInterval || 30000,
      ...options
    };
    
    this.cache = new LRU({
      max: this.options.cacheMaxSize,
      maxAge: 1000 * 60 * 15 // 15 minutes
    });
    
    this.metrics = {
      requests: 0,
      errors: 0,
      cacheHits: 0,
      cacheMisses: 0,
      responseTimeSum: 0,
      startTime: Date.now(),
      slowRequests: 0,
      blockedRequests: 0
    };
    
    this.optimizationEngine = null;
    
    console.log('🚀 Server Optimizer initialized');
    console.log(`   Optimization: ${this.options.enableOptimization ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   Caching: ${this.options.enableCaching ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   Rate Limiting: ${this.options.enableRateLimiting ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   Clustering: ${this.options.enableClustering ? 'ENABLED' : 'DISABLED'}`);
  }
  
  /**
   * Initialize and start server optimization
   */
  async initialize() {
    console.log('🔧 Initializing server optimizations...');
    
    // Setup optimization engine
    if (this.options.enableOptimization) {
      await this.setupOptimizationEngine();
    }
    
    // Apply Express middleware optimizations
    this.applyMiddlewareOptimizations();
    
    // Setup performance monitoring
    this.setupPerformanceMonitoring();
    
    // Setup clustering if enabled
    if (this.options.enableClustering && cluster.isMaster) {
      this.setupClustering();
      return false; // Don't start server in master process
    }
    
    console.log('✅ Server optimizer initialized successfully');
    return true;
  }
  
  /**
   * Setup advanced optimization engine
   */
  async setupOptimizationEngine() {
    this.optimizationEngine = new AdvancedOptimizationEngine({
      enableAutoOptimization: true,
      optimizationInterval: this.options.optimizationInterval,
      memoryThreshold: 0.80, // Trigger optimization at 80% memory usage
      cpuThreshold: 0.75
    });
    
    // Listen to optimization events
    this.optimizationEngine.on('optimization_completed', (data) => {
      console.log(`✅ Server optimization completed: ${data.id}`);
      this.emit('optimization_completed', data);
    });
    
    this.optimizationEngine.on('memory_leak_detected', (leak) => {
      console.warn(`🚨 Memory leak detected in server: ${leak.growthRate.toFixed(4)}`);
      this.emit('memory_leak_detected', leak);
    });
    
    this.optimizationEngine.on('high_memory_usage', (usage) => {
      console.warn(`⚠️ High memory usage detected: ${(usage * 100).toFixed(2)}%`);
    });
    
    // Start the optimization engine
    this.optimizationEngine.start();
    
    console.log('🎯 Advanced optimization engine started');
  }
  
  /**
   * Apply Express middleware optimizations
   */
  applyMiddlewareOptimizations() {
    console.log('🔧 Applying Express middleware optimizations...');
    
    // Security optimization
    if (this.options.enableSecurity) {
      this.app.use(helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"]
          }
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        }
      }));
    }
    
    // Compression optimization
    if (this.options.enableCompression) {
      this.app.use(compression({
        level: 6, // Good balance between speed and compression
        threshold: 1024, // Only compress responses > 1KB
        filter: (req, res) => {
          if (req.headers['x-no-compression']) {
            return false;
          }
          return compression.filter(req, res);
        }
      }));
    }
    
    // Rate limiting optimization
    if (this.options.enableRateLimiting) {
      const limiter = rateLimit({
        windowMs: this.options.rateLimitWindow,
        max: this.options.rateLimitMax,
        message: {
          error: 'Too many requests, please try again later.',
          retryAfter: this.options.rateLimitWindow / 1000
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
          this.metrics.blockedRequests++;
          res.status(429).json({
            error: 'Too many requests',
            retryAfter: Math.ceil(this.options.rateLimitWindow / 1000)
          });
        }
      });
      
      this.app.use(limiter);
    }
    
    // Request tracking and caching middleware
    this.app.use((req, res, next) => {
      const startTime = performance.now();
      this.metrics.requests++;
      
      // Add request tracking
      req.startTime = startTime;
      req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Cache middleware for GET requests
      if (this.options.enableCaching && req.method === 'GET') {
        const cacheKey = this.generateCacheKey(req);
        const cachedResponse = this.cache.get(cacheKey);
        
        if (cachedResponse) {
          this.metrics.cacheHits++;
          return res.json(cachedResponse);
        } else {
          this.metrics.cacheMisses++;
          
          // Override res.json to cache the response
          const originalJson = res.json;
          res.json = (data) => {
            if (res.statusCode === 200) {
              this.cache.set(cacheKey, data);
            }
            return originalJson.call(res, data);
          };
        }
      }
      
      // Response time tracking
      res.on('finish', () => {
        const responseTime = performance.now() - startTime;
        this.metrics.responseTimeSum += responseTime;
        
        if (responseTime > 1000) { // Slow requests > 1 second
          this.metrics.slowRequests++;
          console.warn(`⏱️ Slow request: ${req.method} ${req.path} - ${responseTime.toFixed(2)}ms`);
        }
        
        if (res.statusCode >= 400) {
          this.metrics.errors++;
        }
        
        // Trigger optimization if too many slow requests
        if (this.metrics.slowRequests > 10 && this.optimizationEngine) {
          this.optimizationEngine.triggerOptimization('slow_requests_detected');
          this.metrics.slowRequests = 0; // Reset counter
        }
      });
      
      next();
    });
    
    console.log('✅ Express middleware optimizations applied');
  }
  
  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    // Monitor performance every 30 seconds
    setInterval(() => {
      this.generatePerformanceReport();
    }, 30000);
    
    // Monitor memory usage
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const memoryPercent = memUsage.heapUsed / memUsage.heapTotal;
      
      if (memoryPercent > 0.85) {
        console.warn(`⚠️ High memory usage: ${(memoryPercent * 100).toFixed(2)}%`);
        
        // Force garbage collection if available
        if (global.gc) {
          console.log('🗑️ Triggering garbage collection...');
          global.gc();
        }
      }
    }, 15000);
  }
  
  /**
   * Setup clustering for improved performance
   */
  setupClustering() {
    const numCPUs = cpus().length;
    const numWorkers = Math.min(numCPUs, 4); // Limit to 4 workers max
    
    console.log(`🐝 Setting up clustering with ${numWorkers} workers...`);
    
    for (let i = 0; i < numWorkers; i++) {
      cluster.fork();
    }
    
    cluster.on('exit', (worker, code, signal) => {
      console.log(`❌ Worker ${worker.process.pid} died. Restarting...`);
      cluster.fork();
    });
    
    cluster.on('online', (worker) => {
      console.log(`✅ Worker ${worker.process.pid} is online`);
    });
    
    console.log('🐝 Clustering setup completed');
  }
  
  /**
   * Generate cache key for requests
   */
  generateCacheKey(req) {
    const key = `${req.method}:${req.path}:${JSON.stringify(req.query)}`;
    return key.length > 250 ? require('crypto').createHash('md5').update(key).digest('hex') : key;
  }
  
  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport() {
    const uptime = Date.now() - this.metrics.startTime;
    const memUsage = process.memoryUsage();
    const avgResponseTime = this.metrics.requests > 0 
      ? this.metrics.responseTimeSum / this.metrics.requests 
      : 0;
    
    const report = {
      timestamp: new Date().toISOString(),
      uptime: Math.round(uptime / 1000),
      requests: {
        total: this.metrics.requests,
        errors: this.metrics.errors,
        slow: this.metrics.slowRequests,
        blocked: this.metrics.blockedRequests,
        errorRate: this.metrics.requests > 0 ? (this.metrics.errors / this.metrics.requests * 100).toFixed(2) : 0,
        avgResponseTime: avgResponseTime.toFixed(2)
      },
      cache: {
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
        hitRate: (this.metrics.cacheHits + this.metrics.cacheMisses) > 0 
          ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100).toFixed(2)
          : 0,
        size: this.cache.length,
        maxSize: this.options.cacheMaxSize
      },
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsedPercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      },
      system: {
        totalMemory: Math.round(totalmem() / 1024 / 1024 / 1024),
        freeMemory: Math.round(freemem() / 1024 / 1024 / 1024),
        cpuCount: cpus().length,
        pid: process.pid
      },
      optimization: this.optimizationEngine ? this.optimizationEngine.getPerformanceStats() : null
    };
    
    this.emit('performance_report', report);
    
    // Log summary every 5 minutes
    if (uptime % 300000 < 30000) { // Every 5 minutes (with 30s tolerance)
      console.log('📈 Performance Summary:');
      console.log(`   Uptime: ${Math.round(uptime / 1000)}s`);
      console.log(`   Requests: ${this.metrics.requests} (${this.metrics.errors} errors)`);
      console.log(`   Cache hit rate: ${report.cache.hitRate}%`);
      console.log(`   Avg response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`   Memory usage: ${report.memory.heapUsedPercent}%`);
    }
    
    return report;
  }
  
  /**
   * Get current server statistics
   */
  getStats() {
    return this.generatePerformanceReport();
  }
  
  /**
   * Clear cache
   */
  clearCache() {
    this.cache.reset();
    console.log('🗑️ Server cache cleared');
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      hits: this.metrics.cacheHits,
      misses: this.metrics.cacheMisses,
      hitRate: (this.metrics.cacheHits + this.metrics.cacheMisses) > 0 
        ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100).toFixed(2)
        : 0,
      size: this.cache.length,
      maxSize: this.options.cacheMaxSize,
      keys: this.cache.keys()
    };
  }
  
  /**
   * Force optimization trigger
   */
  async triggerOptimization(reason = 'manual_trigger') {
    if (this.optimizationEngine) {
      console.log(`🔧 Manually triggering optimization: ${reason}`);
      await this.optimizationEngine.triggerOptimization(reason);
    } else {
      console.warn('⚠️ Optimization engine not available');
    }
  }
  
  /**
   * Add performance monitoring endpoints to Express app
   */
  addMonitoringEndpoints() {
    // Performance statistics endpoint
    this.app.get('/api/performance', (req, res) => {
      res.json(this.getStats());
    });
    
    // Cache statistics endpoint
    this.app.get('/api/cache', (req, res) => {
      res.json(this.getCacheStats());
    });
    
    // Cache management endpoints
    this.app.delete('/api/cache', (req, res) => {
      this.clearCache();
      res.json({ success: true, message: 'Cache cleared' });
    });
    
    // Optimization trigger endpoint
    this.app.post('/api/optimize', async (req, res) => {
      const reason = req.body.reason || 'manual_api_trigger';
      try {
        await this.triggerOptimization(reason);
        res.json({ success: true, message: 'Optimization triggered', reason });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    // Health check with detailed information
    this.app.get('/api/health/detailed', (req, res) => {
      const stats = this.getStats();
      const isHealthy = stats.memory.heapUsedPercent < 90 && 
                       parseFloat(stats.requests.errorRate) < 5;
      
      res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'degraded',
        ...stats,
        checks: {
          memoryUsage: stats.memory.heapUsedPercent < 90,
          errorRate: parseFloat(stats.requests.errorRate) < 5,
          responseTime: parseFloat(stats.requests.avgResponseTime) < 1000
        }
      });
    });
    
    console.log('📈 Performance monitoring endpoints added');
  }
  
  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    console.log('🛑 Shutting down server optimizer...');
    
    if (this.optimizationEngine) {
      this.optimizationEngine.stop();
    }
    
    // Generate final report
    const finalStats = this.getStats();
    console.log('📄 Final server statistics:', finalStats);
    
    this.removeAllListeners();
    console.log('✅ Server optimizer shutdown complete');
  }
}

export { ServerOptimizer };
