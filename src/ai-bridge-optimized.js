#!/usr/bin/env node
/**
 * Ultra-Optimized AI Bridge Server
 * Advanced performance enhancements with memory management, connection pooling,
 * intelligent caching, and production-grade monitoring.
 */

import { WebSocketServer } from 'ws';
import express from 'express';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { performance, PerformanceObserver } from 'perf_hooks';
import cluster from 'node:cluster';
import os from 'node:os';

dotenv.config();

// Performance monitoring setup
const perfObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  entries.forEach((entry) => {
    if (entry.duration > 100) { // Log slow operations
      console.warn(`[PERF] Slow operation: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
    }
  });
});
perfObserver.observe({ type: 'measure', buffered: true });

// Optimized configuration with environment-based scaling
const DEFAULT_HISTORY_LIMIT = Number(process.env.AI_BRIDGE_HISTORY_LIMIT) || 1000;
const MAX_QUEUE_PER_CLIENT = Number(process.env.AI_BRIDGE_MAX_QUEUE) || 2000;
const MAX_CONNECTIONS = Number(process.env.AI_BRIDGE_MAX_CONNECTIONS) || 10000;
const TOKEN_AUTH_ENABLED = process.env.AI_BRIDGE_AUTH_TOKEN ? true : false;
const ALLOWED_ORIGINS = (process.env.AI_BRIDGE_CORS_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim());

// Performance optimization flags
const ENABLE_CLUSTERING = process.env.NODE_ENV === 'production' && process.env.ENABLE_CLUSTERING !== 'false';
const ENABLE_MEMORY_MONITORING = process.env.ENABLE_MEMORY_MONITORING !== 'false';

/**
 * High-performance circular buffer with memory optimization
 */
class OptimizedCircularBuffer {
  constructor(limit) {
    this.limit = limit;
    this.buf = new Array(limit);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }
  
  push(item) {
    this.buf[this.tail] = item;
    this.tail = (this.tail + 1) % this.limit;
    
    if (this.size < this.limit) {
      this.size++;
    } else {
      this.head = (this.head + 1) % this.limit;
    }
  }
  
  toArray() {
    if (this.size === 0) return [];
    
    const result = new Array(this.size);
    for (let i = 0; i < this.size; i++) {
      result[i] = this.buf[(this.head + i) % this.limit];
    }
    return result;
  }
  
  filter(fn) {
    return this.toArray().filter(fn);
  }
  
  get length() {
    return this.size;
  }
  
  clear() {
    this.head = 0;
    this.tail = 0;
    this.size = 0;
    // Clear references for GC
    this.buf.fill(null);
  }
}

/**
 * Connection pool for managing WebSocket connections efficiently
 */
class ConnectionPool {
  constructor(maxSize = 1000) {
    this.connections = new Map();
    this.maxSize = maxSize;
    this.stats = {
      created: 0,
      destroyed: 0,
      active: 0,
      errors: 0
    };
  }
  
  add(id, connection) {
    if (this.connections.size >= this.maxSize) {
      console.warn(`[ConnectionPool] Max size reached: ${this.maxSize}`);
      return false;
    }
    
    this.connections.set(id, connection);
    this.stats.created++;
    this.stats.active++;
    return true;
  }
  
  remove(id) {
    if (this.connections.delete(id)) {
      this.stats.destroyed++;
      this.stats.active--;
      return true;
    }
    return false;
  }
  
  get(id) {
    return this.connections.get(id);
  }
  
  getStats() {
    return {
      ...this.stats,
      size: this.connections.size,
      memoryUsage: this.estimateMemoryUsage()
    };
  }
  
  estimateMemoryUsage() {
    return this.connections.size * 1024; // Rough estimation: 1KB per connection
  }
  
  cleanup() {
    let cleaned = 0;
    for (const [id, conn] of this.connections.entries()) {
      if (conn.ws && conn.ws.readyState !== 1) {
        this.remove(id);
        cleaned++;
      }
    }
    return cleaned;
  }
}

/**
 * Memory-efficient message cache with LRU eviction
 */
class MessageCache {
  constructor(maxSize = 5000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.hits = 0;
    this.misses = 0;
  }
  
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 1
    });
  }
  
  get(key) {
    const entry = this.cache.get(key);
    if (entry) {
      entry.accessCount++;
      this.cache.delete(key);
      this.cache.set(key, entry);
      this.hits++;
      return entry.value;
    }
    
    this.misses++;
    return null;
  }
  
  getStats() {
    const hitRate = this.hits + this.misses > 0 ? (this.hits / (this.hits + this.misses)) : 0;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 100),
      memoryUsage: this.cache.size * 256
    };
  }
  
  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

/**
 * Ultra-optimized AI Bridge with advanced performance features
 */
export class OptimizedAIBridge {
  constructor({ logger = console, historyLimit = DEFAULT_HISTORY_LIMIT } = {}) {
    this.logger = logger;
    this.historyLimit = historyLimit;
    this.startTime = Date.now();
    
    // Optimized data structures
    this.connectionPool = new ConnectionPool(MAX_CONNECTIONS);
    this.messageQueue = new Map();
    this.history = new OptimizedCircularBuffer(historyLimit);
    this.messageCache = new MessageCache(historyLimit * 2);
    
    // Performance metrics
    this.metrics = {
      messagesProcessed: 0,
      totalConnections: 0,
      errors: 0,
      lastError: null,
      memoryPeaks: [],
      responseTimes: []
    };
    
    this.setupCleanupTimer();
    
    if (ENABLE_MEMORY_MONITORING) {
      this.setupMemoryMonitoring();
    }
    
    this.logger.log('[OptimizedBridge] Initialized with advanced performance features');
  }
  
  setupCleanupTimer() {
    const baseInterval = Number(process.env.AI_BRIDGE_CLEANUP_INTERVAL_MS) || 60000;
    
    const adaptiveCleanup = () => {
      const startTime = performance.now();
      
      const cleanedConnections = this.connectionPool.cleanup();
      
      let cleanedQueues = 0;
      for (const [clientId, queue] of this.messageQueue.entries()) {
        if (!this.connectionPool.get(clientId)) {
          this.messageQueue.delete(clientId);
          cleanedQueues++;
        }
      }
      
      const memUsage = process.memoryUsage();
      const memoryPressure = memUsage.heapUsed / memUsage.heapTotal;
      
      if (memoryPressure > 0.8) {
        this.messageCache.clear();
        this.logger.warn('[OptimizedBridge] High memory pressure, cleared message cache');
      }
      
      const cleanupTime = performance.now() - startTime;
      
      if (cleanedConnections > 0 || cleanedQueues > 0) {
        this.logger.log(
          `[OptimizedBridge] Cleanup completed in ${cleanupTime.toFixed(2)}ms: ` +
          `${cleanedConnections} connections, ${cleanedQueues} queues`
        );
      }
      
      const nextInterval = cleanedConnections > 10 ? baseInterval / 2 : baseInterval;
      setTimeout(adaptiveCleanup, nextInterval);
    };
    
    setTimeout(adaptiveCleanup, baseInterval);
  }
  
  setupMemoryMonitoring() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.metrics.memoryPeaks.push({
        timestamp: Date.now(),
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      });
      
      if (this.metrics.memoryPeaks.length > 100) {
        this.metrics.memoryPeaks.shift();
      }
      
      const memoryPressure = memUsage.heapUsed / memUsage.heapTotal;
      if (memoryPressure > 0.9) {
        this.logger.warn(`[OptimizedBridge] High memory usage: ${Math.round(memoryPressure * 100)}%`);
      }
    }, 30000);
  }
  
  getOptimizedStats() {
    const uptime = Date.now() - this.startTime;
    const connectionStats = this.connectionPool.getStats();
    const cacheStats = this.messageCache.getStats();
    const memUsage = process.memoryUsage();
    
    return {
      ...this.metrics,
      uptime: Math.floor(uptime / 1000),
      connections: connectionStats,
      cache: cacheStats,
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        pressure: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      },
      performance: {
        messagesPerSecond: this.metrics.messagesProcessed / (uptime / 1000) || 0,
        avgResponseTime: this.metrics.responseTimes.length > 0 
          ? this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length 
          : 0
      },
      queuedMessages: Array.from(this.messageQueue.values())
        .reduce((sum, queue) => sum + queue.length, 0),
      historySize: this.history.length
    };
  }
}

export { OptimizedAIBridge as default };