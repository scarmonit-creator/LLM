#!/usr/bin/env node
/**
 * Intelligent Database Connection Pool with ML-based Scaling
 * Predictive connection management, smart query batching, and adaptive optimization
 * Target: 30% connection efficiency improvement with 25% faster query response
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

/**
 * Advanced Connection Pool with Machine Learning Optimization
 */
export class IntelligentConnectionPool extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      minConnections: options.minConnections || 2,
      maxConnections: options.maxConnections || 20,
      acquireTimeout: options.acquireTimeout || 10000,
      idleTimeout: options.idleTimeout || 30000,
      connectionTTL: options.connectionTTL || 3600000, // 1 hour
      predictiveScaling: options.predictiveScaling !== false,
      queryBatching: options.queryBatching !== false,
      connectionWarmup: options.connectionWarmup !== false,
      ...options
    };
    
    // Connection pools and management
    this.connections = {
      available: [],
      active: new Map(),
      warming: new Set(),
      total: 0
    };
    
    // Performance analytics for ML
    this.analytics = {
      connectionUsage: [],
      queryPatterns: new Map(),
      loadPredictions: [],
      scalingEvents: [],
      performanceMetrics: {
        avgAcquireTime: 0,
        avgQueryTime: 0,
        connectionReuse: 0,
        poolEfficiency: 0
      }
    };
    
    // Query batching system
    this.queryQueue = {
      pending: new Map(),
      batchSize: options.batchSize || 10,
      batchTimeout: options.batchTimeout || 100 // 100ms
    };
    
    // Connection factory function (to be set by user)
    this.connectionFactory = options.connectionFactory || this.defaultConnectionFactory;
    
    // Monitoring and optimization
    this.monitoring = false;
    this.lastOptimization = Date.now();
    
    this.initializePool();
  }
  
  async initializePool() {
    console.log('[IntelligentConnectionPool] Initializing connection pool');
    
    // Create minimum connections
    for (let i = 0; i < this.options.minConnections; i++) {
      try {
        await this.createConnection();
      } catch (error) {
        console.error(`[IntelligentConnectionPool] Failed to create initial connection ${i + 1}:`, error.message);
      }
    }
    
    this.startMonitoring();
    this.emit('initialized', { connections: this.connections.total });
  }
  
  async createConnection() {
    const startTime = performance.now();
    
    try {
      const connection = await this.connectionFactory();
      
      if (!connection) {
        throw new Error('Connection factory returned null/undefined');
      }
      
      const connectionInfo = {
        id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        connection,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        usageCount: 0,
        totalQueryTime: 0,
        avgQueryTime: 0,
        status: 'available'
      };
      
      this.connections.available.push(connectionInfo);
      this.connections.total++;
      
      const createTime = performance.now() - startTime;
      
      this.emit('connection-created', { 
        id: connectionInfo.id, 
        createTime,
        total: this.connections.total 
      });
      
      console.log(`[IntelligentConnectionPool] Created connection ${connectionInfo.id} in ${createTime.toFixed(2)}ms`);
      
      return connectionInfo;
    } catch (error) {
      console.error('[IntelligentConnectionPool] Failed to create connection:', error);
      throw error;
    }
  }
  
  async acquireConnection(priority = 'normal') {
    const startTime = performance.now();
    
    // Try to get available connection
    if (this.connections.available.length > 0) {
      const connectionInfo = this.selectOptimalConnection();
      
      if (connectionInfo) {
        connectionInfo.status = 'active';
        connectionInfo.lastUsed = Date.now();
        connectionInfo.usageCount++;
        
        this.connections.available = this.connections.available.filter(c => c.id !== connectionInfo.id);
        this.connections.active.set(connectionInfo.id, connectionInfo);
        
        const acquireTime = performance.now() - startTime;
        this.updatePerformanceMetrics('acquire', acquireTime);
        
        return connectionInfo;
      }
    }
    
    // No available connections, try to create new one
    if (this.connections.total < this.options.maxConnections) {
      try {
        const connectionInfo = await this.createConnection();
        
        connectionInfo.status = 'active';
        connectionInfo.lastUsed = Date.now();
        connectionInfo.usageCount++;
        
        this.connections.available = this.connections.available.filter(c => c.id !== connectionInfo.id);
        this.connections.active.set(connectionInfo.id, connectionInfo);
        
        const acquireTime = performance.now() - startTime;
        this.updatePerformanceMetrics('acquire', acquireTime);
        
        return connectionInfo;
      } catch (error) {
        console.error('[IntelligentConnectionPool] Failed to create connection for acquire:', error);
      }
    }
    
    // Wait for connection to become available
    return this.waitForConnection(startTime, priority);
  }
  
  selectOptimalConnection() {
    if (this.connections.available.length === 0) {
      return null;
    }
    
    // Sort by usage efficiency (lower avg query time + lower usage count = better)
    const sorted = this.connections.available.sort((a, b) => {
      const aScore = (a.avgQueryTime || 0) + (a.usageCount * 10);
      const bScore = (b.avgQueryTime || 0) + (b.usageCount * 10);
      return aScore - bScore;
    });
    
    return sorted[0];
  }
  
  async waitForConnection(startTime, priority) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection acquire timeout after ${this.options.acquireTimeout}ms`));
      }, this.options.acquireTimeout);
      
      const checkForConnection = () => {
        if (this.connections.available.length > 0) {
          clearTimeout(timeout);
          
          const connectionInfo = this.selectOptimalConnection();
          
          if (connectionInfo) {
            connectionInfo.status = 'active';
            connectionInfo.lastUsed = Date.now();
            connectionInfo.usageCount++;
            
            this.connections.available = this.connections.available.filter(c => c.id !== connectionInfo.id);
            this.connections.active.set(connectionInfo.id, connectionInfo);
            
            const acquireTime = performance.now() - startTime;
            this.updatePerformanceMetrics('acquire', acquireTime);
            
            resolve(connectionInfo);
          } else {
            // Try again
            setTimeout(checkForConnection, 10);
          }
        } else {
          // Try again
          setTimeout(checkForConnection, 10);
        }
      };
      
      checkForConnection();
    });
  }
  
  releaseConnection(connectionInfo) {
    if (!connectionInfo || !this.connections.active.has(connectionInfo.id)) {
      return false;
    }
    
    connectionInfo.status = 'available';
    connectionInfo.lastUsed = Date.now();
    
    this.connections.active.delete(connectionInfo.id);
    this.connections.available.push(connectionInfo);
    
    this.emit('connection-released', { id: connectionInfo.id });
    
    // Update reuse metrics
    this.analytics.performanceMetrics.connectionReuse++;
    
    return true;
  }
  
  async executeQuery(query, params = [], options = {}) {
    const startTime = performance.now();
    let connectionInfo = null;
    
    try {
      // Check if query can be batched
      if (this.options.queryBatching && this.canBatchQuery(query)) {
        return this.executeBatchedQuery(query, params, options);
      }
      
      connectionInfo = await this.acquireConnection(options.priority);
      
      const queryStartTime = performance.now();
      const result = await this.executeQueryOnConnection(connectionInfo.connection, query, params);
      const queryTime = performance.now() - queryStartTime;
      
      // Update connection stats
      connectionInfo.totalQueryTime += queryTime;
      connectionInfo.avgQueryTime = connectionInfo.totalQueryTime / connectionInfo.usageCount;
      
      // Update analytics
      this.updateQueryAnalytics(query, queryTime);
      this.updatePerformanceMetrics('query', queryTime);
      
      return result;
    } catch (error) {
      console.error('[IntelligentConnectionPool] Query execution failed:', error);
      throw error;
    } finally {
      if (connectionInfo) {
        this.releaseConnection(connectionInfo);
      }
    }
  }
  
  async executeQueryOnConnection(connection, query, params) {
    // Override this method with actual database-specific implementation
    if (connection.query) {
      return connection.query(query, params);
    } else if (connection.execute) {
      return connection.execute(query, params);
    } else {
      throw new Error('Connection does not support query execution');
    }
  }
  
  canBatchQuery(query) {
    // Simple heuristic: SELECT queries without JOINs can often be batched
    const normalizedQuery = query.trim().toUpperCase();
    return normalizedQuery.startsWith('SELECT') && !normalizedQuery.includes('JOIN');
  }
  
  async executeBatchedQuery(query, params, options) {
    const queryKey = this.normalizeQueryForBatching(query);
    
    return new Promise((resolve, reject) => {
      if (!this.queryQueue.pending.has(queryKey)) {
        this.queryQueue.pending.set(queryKey, {
          queries: [],
          timeout: null
        });
      }
      
      const batch = this.queryQueue.pending.get(queryKey);
      batch.queries.push({ query, params, resolve, reject, options });
      
      // Start batch timeout if this is the first query
      if (batch.queries.length === 1) {
        batch.timeout = setTimeout(() => {
          this.executeBatch(queryKey);
        }, this.queryQueue.batchTimeout);
      }
      
      // Execute immediately if batch is full
      if (batch.queries.length >= this.queryQueue.batchSize) {
        clearTimeout(batch.timeout);
        this.executeBatch(queryKey);
      }
    });
  }
  
  async executeBatch(queryKey) {
    const batch = this.queryQueue.pending.get(queryKey);
    if (!batch || batch.queries.length === 0) {
      return;
    }
    
    this.queryQueue.pending.delete(queryKey);
    
    let connectionInfo = null;
    
    try {
      connectionInfo = await this.acquireConnection('high');
      
      const startTime = performance.now();
      
      // Execute all queries in the batch
      const results = await Promise.allSettled(
        batch.queries.map(({ query, params }) => 
          this.executeQueryOnConnection(connectionInfo.connection, query, params)
        )
      );
      
      const totalTime = performance.now() - startTime;
      
      // Resolve/reject individual promises
      batch.queries.forEach(({ resolve, reject }, index) => {
        const result = results[index];
        if (result.status === 'fulfilled') {
          resolve(result.value);
        } else {
          reject(result.reason);
        }
      });
      
      // Update analytics
      this.updatePerformanceMetrics('batch', totalTime / batch.queries.length);
      
      this.emit('batch-executed', { 
        queryKey, 
        count: batch.queries.length, 
        totalTime,
        avgTime: totalTime / batch.queries.length
      });
      
    } catch (error) {
      // Reject all queries in the batch
      batch.queries.forEach(({ reject }) => reject(error));
    } finally {
      if (connectionInfo) {
        this.releaseConnection(connectionInfo);
      }
    }
  }
  
  normalizeQueryForBatching(query) {
    // Simple normalization: remove parameters and extra whitespace
    return query
      .replace(/\$\d+|\?/g, '?') // Replace parameters with ?
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toUpperCase();
  }
  
  updateQueryAnalytics(query, queryTime) {
    const normalizedQuery = this.normalizeQueryForBatching(query);
    
    if (!this.analytics.queryPatterns.has(normalizedQuery)) {
      this.analytics.queryPatterns.set(normalizedQuery, {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0,
        lastExecuted: 0
      });
    }
    
    const pattern = this.analytics.queryPatterns.get(normalizedQuery);
    pattern.count++;
    pattern.totalTime += queryTime;
    pattern.avgTime = pattern.totalTime / pattern.count;
    pattern.minTime = Math.min(pattern.minTime, queryTime);
    pattern.maxTime = Math.max(pattern.maxTime, queryTime);
    pattern.lastExecuted = Date.now();
  }
  
  updatePerformanceMetrics(type, time) {
    const metrics = this.analytics.performanceMetrics;
    
    switch (type) {
      case 'acquire':
        metrics.avgAcquireTime = (metrics.avgAcquireTime + time) / 2;
        break;
      case 'query':
      case 'batch':
        metrics.avgQueryTime = (metrics.avgQueryTime + time) / 2;
        break;
    }
    
    // Update pool efficiency
    const activeConnections = this.connections.active.size;
    const totalConnections = this.connections.total;
    metrics.poolEfficiency = totalConnections > 0 ? (activeConnections / totalConnections) * 100 : 0;
  }
  
  startMonitoring() {
    if (this.monitoring) return;
    
    this.monitoring = true;
    
    // Monitor pool health every 30 seconds
    this.monitoringTimer = setInterval(() => {
      this.monitorPoolHealth();
      this.performPredictiveScaling();
      this.cleanupIdleConnections();
    }, 30000);
    
    console.log('[IntelligentConnectionPool] Started pool monitoring');
  }
  
  monitorPoolHealth() {
    const now = Date.now();
    const metrics = {
      timestamp: now,
      totalConnections: this.connections.total,
      availableConnections: this.connections.available.length,
      activeConnections: this.connections.active.size,
      utilizationRate: this.connections.total > 0 ? 
        (this.connections.active.size / this.connections.total) * 100 : 0
    };
    
    this.analytics.connectionUsage.push(metrics);
    
    // Keep only recent metrics (last 24 hours)
    const dayAgo = now - 24 * 60 * 60 * 1000;
    this.analytics.connectionUsage = this.analytics.connectionUsage.filter(m => m.timestamp > dayAgo);
    
    this.emit('health-check', metrics);
    
    // Log health if utilization is high
    if (metrics.utilizationRate > 80) {
      console.log(`[IntelligentConnectionPool] High utilization: ${metrics.utilizationRate.toFixed(1)}%`);
    }
  }
  
  performPredictiveScaling() {
    if (!this.options.predictiveScaling) return;
    
    const recentMetrics = this.analytics.connectionUsage.slice(-10); // Last 10 samples
    if (recentMetrics.length < 5) return;
    
    // Calculate trend
    const trend = this.calculateUtilizationTrend(recentMetrics);
    
    // Predict next utilization
    const currentUtilization = recentMetrics[recentMetrics.length - 1].utilizationRate;
    const predictedUtilization = currentUtilization + (trend * 2); // 2 samples ahead
    
    this.analytics.loadPredictions.push({
      timestamp: Date.now(),
      current: currentUtilization,
      predicted: predictedUtilization,
      trend
    });
    
    // Scale up if predicted high utilization
    if (predictedUtilization > 85 && this.connections.total < this.options.maxConnections) {
      const connectionsToCreate = Math.min(
        Math.ceil((predictedUtilization - 85) / 10), // 1 connection per 10% over 85%
        this.options.maxConnections - this.connections.total
      );
      
      this.scaleUp(connectionsToCreate, 'predictive');
    }
    
    // Scale down if predicted low utilization
    if (predictedUtilization < 30 && this.connections.total > this.options.minConnections) {
      const connectionsToRemove = Math.min(
        Math.ceil((30 - predictedUtilization) / 10), // 1 connection per 10% under 30%
        this.connections.total - this.options.minConnections
      );
      
      this.scaleDown(connectionsToRemove, 'predictive');
    }
  }
  
  calculateUtilizationTrend(metrics) {
    if (metrics.length < 2) return 0;
    
    const x = metrics.map((_, i) => i);
    const y = metrics.map(m => m.utilizationRate);
    
    const n = metrics.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);
    
    // Linear regression slope
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    return slope;
  }
  
  async scaleUp(count, reason = 'manual') {
    const promises = [];
    
    for (let i = 0; i < count && this.connections.total < this.options.maxConnections; i++) {
      promises.push(this.createConnection().catch(error => {
        console.error('[IntelligentConnectionPool] Failed to scale up:', error);
        return null;
      }));
    }
    
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
    
    if (successful > 0) {
      this.analytics.scalingEvents.push({
        timestamp: Date.now(),
        type: 'scale-up',
        count: successful,
        reason,
        totalAfter: this.connections.total
      });
      
      this.emit('scaled-up', { count: successful, reason, total: this.connections.total });
      console.log(`[IntelligentConnectionPool] Scaled up ${successful} connections (${reason})`);
    }
  }
  
  scaleDown(count, reason = 'manual') {
    const connectionsToRemove = [];
    
    // Remove least used available connections
    const sortedAvailable = this.connections.available.sort((a, b) => 
      (a.usageCount + (Date.now() - a.lastUsed) / 1000) - 
      (b.usageCount + (Date.now() - b.lastUsed) / 1000)
    );
    
    const toRemove = Math.min(count, sortedAvailable.length, 
                              this.connections.total - this.options.minConnections);
    
    for (let i = 0; i < toRemove; i++) {
      const connectionInfo = sortedAvailable[i];
      this.removeConnection(connectionInfo);
      connectionsToRemove.push(connectionInfo.id);
    }
    
    if (connectionsToRemove.length > 0) {
      this.analytics.scalingEvents.push({
        timestamp: Date.now(),
        type: 'scale-down',
        count: connectionsToRemove.length,
        reason,
        totalAfter: this.connections.total
      });
      
      this.emit('scaled-down', { count: connectionsToRemove.length, reason, total: this.connections.total });
      console.log(`[IntelligentConnectionPool] Scaled down ${connectionsToRemove.length} connections (${reason})`);
    }
  }
  
  removeConnection(connectionInfo) {
    // Close the connection
    if (connectionInfo.connection.end) {
      connectionInfo.connection.end();
    } else if (connectionInfo.connection.close) {
      connectionInfo.connection.close();
    } else if (connectionInfo.connection.destroy) {
      connectionInfo.connection.destroy();
    }
    
    // Remove from pools
    this.connections.available = this.connections.available.filter(c => c.id !== connectionInfo.id);
    this.connections.active.delete(connectionInfo.id);
    this.connections.total--;
    
    this.emit('connection-removed', { id: connectionInfo.id });
  }
  
  cleanupIdleConnections() {
    const now = Date.now();
    const idleThreshold = this.options.idleTimeout;
    const ttlThreshold = this.options.connectionTTL;
    
    const connectionsToRemove = [];
    
    this.connections.available.forEach(connectionInfo => {
      const idleTime = now - connectionInfo.lastUsed;
      const age = now - connectionInfo.createdAt;
      
      if ((idleTime > idleThreshold || age > ttlThreshold) && 
          this.connections.total > this.options.minConnections) {
        connectionsToRemove.push(connectionInfo);
      }
    });
    
    connectionsToRemove.forEach(connectionInfo => {
      this.removeConnection(connectionInfo);
    });
    
    if (connectionsToRemove.length > 0) {
      console.log(`[IntelligentConnectionPool] Cleaned up ${connectionsToRemove.length} idle connections`);
    }
  }
  
  defaultConnectionFactory() {
    // Mock connection factory - override this with real implementation
    return Promise.resolve({
      id: `mock-${Date.now()}`,
      query: async (sql, params) => ({ rows: [], sql, params }),
      end: () => {},
      close: () => {},
      destroy: () => {}
    });
  }
  
  getStats() {
    const now = Date.now();
    
    return {
      pool: {
        total: this.connections.total,
        available: this.connections.available.length,
        active: this.connections.active.size,
        warming: this.connections.warming.size,
        utilization: this.connections.total > 0 ? 
          (this.connections.active.size / this.connections.total * 100).toFixed(1) : 0
      },
      performance: {
        ...this.analytics.performanceMetrics,
        avgAcquireTime: Math.round(this.analytics.performanceMetrics.avgAcquireTime),
        avgQueryTime: Math.round(this.analytics.performanceMetrics.avgQueryTime),
        poolEfficiency: Math.round(this.analytics.performanceMetrics.poolEfficiency)
      },
      analytics: {
        totalQueries: Array.from(this.analytics.queryPatterns.values())
          .reduce((sum, pattern) => sum + pattern.count, 0),
        uniqueQueryTypes: this.analytics.queryPatterns.size,
        scalingEvents: this.analytics.scalingEvents.length,
        loadPredictions: this.analytics.loadPredictions.slice(-5), // Last 5 predictions
        recentUsage: this.analytics.connectionUsage.slice(-10) // Last 10 samples
      },
      options: {
        minConnections: this.options.minConnections,
        maxConnections: this.options.maxConnections,
        predictiveScaling: this.options.predictiveScaling,
        queryBatching: this.options.queryBatching,
        connectionWarmup: this.options.connectionWarmup
      },
      monitoring: this.monitoring
    };
  }
  
  async destroy() {
    console.log('[IntelligentConnectionPool] Destroying connection pool');
    
    this.monitoring = false;
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }
    
    // Close all connections
    const allConnections = [
      ...this.connections.available,
      ...Array.from(this.connections.active.values())
    ];
    
    await Promise.all(allConnections.map(connectionInfo => {
      return new Promise(resolve => {
        if (connectionInfo.connection.end) {
          connectionInfo.connection.end(() => resolve());
        } else if (connectionInfo.connection.close) {
          connectionInfo.connection.close();
          resolve();
        } else if (connectionInfo.connection.destroy) {
          connectionInfo.connection.destroy();
          resolve();
        } else {
          resolve();
        }
      });
    }));
    
    this.connections.available = [];
    this.connections.active.clear();
    this.connections.total = 0;
    
    this.emit('destroyed');
  }
}

export default IntelligentConnectionPool;