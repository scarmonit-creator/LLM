#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import cluster from 'cluster';
import os from 'os';
import winston from 'winston';
import process from 'process';

// Ultra-Performance Configuration
const CONFIG = {
  PORT: process.env.PORT || 8080,
  NODE_ENV: process.env.NODE_ENV || 'production',
  MAX_WORKERS: process.env.MAX_WORKERS || Math.min(os.cpus().length, 4),
  COMPRESSION_THRESHOLD: parseInt(process.env.COMPRESSION_THRESHOLD) || 1024,
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  CIRCUIT_BREAKER_THRESHOLD: 5,
  HEALTH_CHECK_INTERVAL: 10000,
  MEMORY_LIMIT_MB: parseInt(process.env.MEMORY_LIMIT_MB) || 512,
  GC_INTERVAL_MS: 30000,
  CONNECTION_TIMEOUT: 30000,
  KEEP_ALIVE_TIMEOUT: 65000
};

// High-Performance Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.errors({ stack: true })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Performance Metrics Store
class PerformanceMetrics {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      avgResponseTime: 0,
      memoryUsage: process.memoryUsage(),
      uptime: Date.now(),
      circuitBreakerState: 'CLOSED'
    };
    this.responseTimes = [];
    this.startMonitoring();
  }

  recordRequest(responseTime) {
    this.metrics.requests++;
    this.responseTimes.push(responseTime);
    
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
    
    this.metrics.avgResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
  }

  recordError() {
    this.metrics.errors++;
  }

  getHealthScore() {
    const errorRate = this.metrics.errors / Math.max(this.metrics.requests, 1);
    const memoryScore = (CONFIG.MEMORY_LIMIT_MB * 1024 * 1024 - this.metrics.memoryUsage.heapUsed) / (CONFIG.MEMORY_LIMIT_MB * 1024 * 1024);
    const performanceScore = Math.max(0, 1 - (this.metrics.avgResponseTime / 1000));
    
    return Math.round((1 - errorRate) * memoryScore * performanceScore * 100);
  }

  startMonitoring() {
    setInterval(() => {
      this.metrics.memoryUsage = process.memoryUsage();
      
      if (this.metrics.memoryUsage.heapUsed > CONFIG.MEMORY_LIMIT_MB * 1024 * 1024 * 0.8) {
        if (global.gc) {
          global.gc();
          logger.warn('🧹 Automatic garbage collection triggered');
        }
      }
    }, CONFIG.HEALTH_CHECK_INTERVAL);
  }

  getMetrics() {
    return {
      ...this.metrics,
      healthScore: this.getHealthScore(),
      uptimeSeconds: Math.round((Date.now() - this.metrics.uptime) / 1000)
    };
  }
}

// Circuit Breaker Implementation
class CircuitBreaker {
  constructor(threshold = CONFIG.CIRCUIT_BREAKER_THRESHOLD) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.state = 'CLOSED';
    this.nextAttempt = Date.now();
  }

  async call(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + 60000;
    }
  }
}

// High-Performance Database Pool
class DatabasePool {
  constructor() {
    this.db = new Database(':memory:', { verbose: null });
    this.initializeSchema();
    this.cache = new Map();
    this.cacheHits = 0;
    this.cacheSize = 0;
  }

  initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS performance_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        data TEXT,
        hash TEXT UNIQUE
      );
      CREATE INDEX IF NOT EXISTS idx_timestamp ON performance_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_event_type ON performance_logs(event_type);
    `);
  }

  logPerformanceEvent(eventType, data) {
    const hash = createHash('sha256').update(`${eventType}${JSON.stringify(data)}`).digest('hex');
    
    if (this.cache.has(hash)) {
      this.cacheHits++;
      return this.cache.get(hash);
    }

    try {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO performance_logs (timestamp, event_type, data, hash)
        VALUES (?, ?, ?, ?)
      `);
      
      const result = stmt.run(Date.now(), eventType, JSON.stringify(data), hash);
      
      this.cache.set(hash, result);
      this.cacheSize++;
      
      if (this.cacheSize > 1000) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
        this.cacheSize--;
      }
      
      return result;
    } catch (error) {
      logger.error('Database operation failed:', error);
      return null;
    }
  }

  getPerformanceSummary() {
    const summary = this.db.prepare(`
      SELECT 
        event_type,
        COUNT(*) as count,
        MAX(timestamp) as last_event
      FROM performance_logs 
      GROUP BY event_type 
      ORDER BY count DESC
      LIMIT 20
    `).all();

    return {
      summary,
      cacheStats: {
        hits: this.cacheHits,
        size: this.cacheSize,
        hitRate: (this.cacheHits / Math.max(this.cacheSize, 1) * 100).toFixed(2) + '%'
      }
    };
  }
}

// Master Process (Cluster Management)
if (cluster.isPrimary && CONFIG.NODE_ENV === 'production') {
  logger.info(`🚀 Ultra-Optimized Master Process starting with ${CONFIG.MAX_WORKERS} workers`);
  
  for (let i = 0; i < CONFIG.MAX_WORKERS; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    logger.warn(`⚠️ Worker ${worker.process.pid} died (${code}/${signal}). Restarting...`);
    cluster.fork();
  });

  process.on('SIGTERM', () => {
    logger.info('🔄 Master received SIGTERM, shutting down workers');
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
  });

} else {
  // Worker Process
  const app = express();
  const metrics = new PerformanceMetrics();
  const circuitBreaker = new CircuitBreaker();
  const db = new DatabasePool();

  // Ultra-Performance Middleware Stack
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));

  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
    threshold: CONFIG.COMPRESSION_THRESHOLD,
    level: 6 // Optimal compression level
  }));

  app.use(cors({
    origin: true,
    credentials: true,
    maxAge: 86400
  }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: CONFIG.RATE_LIMIT_MAX,
    message: { error: 'Too many requests', retryAfter: 900 },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      metrics.recordError();
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: 900
      });
    }
  });

  app.use(limiter);
  app.use(express.json({ limit: '10mb' }));

  // Performance Monitoring Middleware
  app.use((req, res, next) => {
    req.startTime = Date.now();
    
    res.on('finish', () => {
      const responseTime = Date.now() - req.startTime;
      metrics.recordRequest(responseTime);
      
      db.logPerformanceEvent('request', {
        method: req.method,
        path: req.path,
        responseTime,
        statusCode: res.statusCode
      });
      
      if (responseTime > 1000) {
        logger.warn(`🐌 Slow request: ${req.method} ${req.path} - ${responseTime}ms`);
      }
    });
    
    next();
  });

  // Health Check Endpoint
  app.get('/health', (req, res) => {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      metrics: metrics.getMetrics(),
      database: db.getPerformanceSummary(),
      circuitBreaker: circuitBreaker.state,
      worker: process.pid,
      node_version: process.version,
      optimization_level: 'ultra'
    };

    res.json(healthData);
  });

  // Performance Metrics Endpoint
  app.get('/metrics', async (req, res) => {
    try {
      const result = await circuitBreaker.call(async () => {
        const performanceData = {
          system: metrics.getMetrics(),
          database: db.getPerformanceSummary(),
          process: {
            pid: process.pid,
            uptime: process.uptime(),
            cpuUsage: process.cpuUsage(),
            memoryUsage: process.memoryUsage(),
            resourceUsage: process.resourceUsage()
          },
          cluster: {
            worker: cluster.worker?.id || 'master',
            workers: Object.keys(cluster.workers || {}).length
          },
          optimizations: {
            compression: true,
            clustering: CONFIG.NODE_ENV === 'production',
            circuit_breaker: true,
            rate_limiting: true,
            memory_management: true,
            database_caching: true
          }
        };

        return performanceData;
      });

      res.json(result);
    } catch (error) {
      metrics.recordError();
      res.status(503).json({
        error: 'Service temporarily unavailable',
        circuitBreaker: circuitBreaker.state
      });
    }
  });

  // Advanced Optimization Trigger
  app.post('/optimize', (req, res) => {
    const optimizations = [];
    const startTime = Date.now();

    // Force garbage collection
    if (global.gc) {
      const beforeMemory = process.memoryUsage().heapUsed;
      global.gc();
      const afterMemory = process.memoryUsage().heapUsed;
      const freed = ((beforeMemory - afterMemory) / 1024 / 1024).toFixed(2);
      optimizations.push(`garbage_collection_freed_${freed}MB`);
    }

    // Database cleanup
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const cleanupStmt = db.db.prepare('DELETE FROM performance_logs WHERE timestamp < ?');
    const cleanupResult = cleanupStmt.run(oneHourAgo);
    
    if (cleanupResult.changes > 0) {
      optimizations.push(`cleaned_${cleanupResult.changes}_old_records`);
    }

    // Cache optimization
    const initialCacheSize = db.cacheSize;
    if (db.cacheSize > 500) {
      const keysToDelete = Array.from(db.cache.keys()).slice(0, Math.floor(db.cacheSize / 2));
      keysToDelete.forEach(key => {
        db.cache.delete(key);
        db.cacheSize--;
      });
      optimizations.push(`cache_trimmed_${keysToDelete.length}_entries`);
    }

    // Circuit breaker reset
    if (circuitBreaker.state === 'OPEN') {
      circuitBreaker.state = 'CLOSED';
      circuitBreaker.failureCount = 0;
      optimizations.push('circuit_breaker_reset');
    }

    const optimizationTime = Date.now() - startTime;
    db.logPerformanceEvent('optimization', { optimizations, optimizationTime });

    res.json({
      message: '⚡ Autonomous optimization completed',
      optimizations,
      optimizationTime: `${optimizationTime}ms`,
      timestamp: new Date().toISOString(),
      metrics: metrics.getMetrics(),
      performance_improvement: '🚀 System optimized for peak performance'
    });
  });

  // High-Performance Chat Endpoint
  app.post('/chat', async (req, res) => {
    try {
      const result = await circuitBreaker.call(async () => {
        const { message, provider = 'claude', model = 'claude-3-5-sonnet-20241022' } = req.body;

        if (!message) {
          return res.status(400).json({ error: 'Message is required' });
        }

        // Optimized processing simulation
        const processingStart = Date.now();
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
        const processingTime = Date.now() - processingStart;

        const response = {
          id: createHash('sha256').update(message + Date.now()).digest('hex').slice(0, 16),
          provider,
          model,
          message,
          response: `🚀 Ultra-optimized response: ${message}`,
          timestamp: new Date().toISOString(),
          processingTime,
          totalResponseTime: Date.now() - req.startTime,
          worker: process.pid,
          optimizations: ['circuit_breaker', 'compression', 'caching']
        };

        db.logPerformanceEvent('chat_completion', {
          provider,
          model,
          messageLength: message.length,
          processingTime,
          totalResponseTime: response.totalResponseTime
        });

        return response;
      });

      res.json(result);
    } catch (error) {
      metrics.recordError();
      logger.error('Chat endpoint error:', error);
      
      res.status(500).json({
        error: 'Chat service temporarily unavailable',
        circuitBreaker: circuitBreaker.state,
        retryAfter: circuitBreaker.state === 'OPEN' ? 60 : 0
      });
    }
  });

  // Performance Stress Test Endpoint
  app.get('/stress-test', async (req, res) => {
    const iterations = parseInt(req.query.iterations) || 100;
    const concurrency = parseInt(req.query.concurrency) || 10;
    
    const results = {
      iterations,
      concurrency,
      startTime: Date.now(),
      results: []
    };

    try {
      const promises = [];
      
      for (let i = 0; i < concurrency; i++) {
        const promise = (async () => {
          const batchResults = [];
          for (let j = 0; j < iterations / concurrency; j++) {
            const start = Date.now();
            
            // Simulate work
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
            db.logPerformanceEvent('stress_test', { batch: i, iteration: j });
            
            batchResults.push({
              duration: Date.now() - start,
              batch: i,
              iteration: j
            });
          }
          return batchResults;
        })();
        
        promises.push(promise);
      }

      const batchResults = await Promise.all(promises);
      results.results = batchResults.flat();
      results.completionTime = Date.now() - results.startTime;
      results.avgDuration = results.results.reduce((sum, r) => sum + r.duration, 0) / results.results.length;
      results.maxDuration = Math.max(...results.results.map(r => r.duration));
      results.minDuration = Math.min(...results.results.map(r => r.duration));

      res.json({
        ...results,
        performance: '🚀 Ultra-optimized stress test completed',
        metrics: metrics.getMetrics()
      });
    } catch (error) {
      metrics.recordError();
      res.status(500).json({
        error: 'Stress test failed',
        partialResults: results
      });
    }
  });

  // Graceful Error Handling
  app.use((err, req, res, next) => {
    metrics.recordError();
    logger.error('Unhandled error:', err);
    
    res.status(500).json({
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
      requestId: req.startTime
    });
  });

  // 404 Handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Endpoint not found',
      path: req.originalUrl,
      availableEndpoints: ['/health', '/metrics', '/optimize', '/chat', '/stress-test']
    });
  });

  // Start Ultra-Optimized Server
  const server = app.listen(CONFIG.PORT, () => {
    logger.info(`🚀 Ultra-Optimized Worker ${process.pid} listening on port ${CONFIG.PORT}`);
    logger.info(`⚡ Optimizations active: clustering, circuit breakers, compression, caching, monitoring`);
    
    db.logPerformanceEvent('server_start', {
      pid: process.pid,
      port: CONFIG.PORT,
      optimizations: 7,
      timestamp: Date.now()
    });
  });

  // Server Performance Tuning
  server.keepAliveTimeout = CONFIG.KEEP_ALIVE_TIMEOUT;
  server.headersTimeout = CONFIG.KEEP_ALIVE_TIMEOUT + 1000;
  server.timeout = CONFIG.CONNECTION_TIMEOUT;

  // Graceful Shutdown
  const gracefulShutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);
    
    server.close((err) => {
      if (err) {
        logger.error('Error during server shutdown:', err);
        process.exit(1);
      }
      
      db.db.close();
      logger.info('✅ Server shut down successfully');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Automatic Memory Management
  setInterval(() => {
    const memUsage = process.memoryUsage();
    if (global.gc && memUsage.heapUsed > CONFIG.MEMORY_LIMIT_MB * 1024 * 1024 * 0.7) {
      global.gc();
      logger.info('🧹 Scheduled garbage collection executed');
    }
  }, CONFIG.GC_INTERVAL_MS);

  logger.info(`🔥 Ultra-Performance Server fully initialized with advanced optimizations`);
}