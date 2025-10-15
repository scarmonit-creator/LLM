#!/usr/bin/env node
/**
 * Predictive Connection Pool - Intelligent Database Connection Management
 * Uses machine learning to predict connection needs and optimize database performance
 * Target: 12% additional performance improvement through smart connection management
 */

import { EventEmitter } from 'events';

/**
 * Connection Load Predictor using time-series analysis
 */
class ConnectionLoadPredictor {
  constructor() {
    this.history = [];
    this.predictions = [];
    this.windowSize = 20;
    this.seasonalPeriod = 60; // 1 hour at 1-minute intervals
  }

  addDataPoint(timestamp, connectionCount, queueLength, responseTime) {
    const dataPoint = {
      timestamp,
      connectionCount,
      queueLength,
      responseTime,
      load: connectionCount + (queueLength * 2) + Math.min(responseTime / 100, 10)
    };
    
    this.history.push(dataPoint);
    
    // Keep only recent history
    if (this.history.length > 1000) {
      this.history.shift();
    }
  }

  predictLoad(minutesAhead = 5) {
    if (this.history.length < this.windowSize) {
      return this.history.length > 0 ? this.history[this.history.length - 1].load : 5;
    }

    const recent = this.history.slice(-this.windowSize);
    
    // Simple moving average with trend and seasonal adjustment
    const movingAverage = recent.reduce((sum, point) => sum + point.load, 0) / recent.length;
    
    // Calculate trend
    const trend = this.calculateTrend(recent);
    
    // Seasonal adjustment (if we have enough history)
    const seasonal = this.calculateSeasonalAdjustment();
    
    // Predict load
    const prediction = Math.max(1, movingAverage + (trend * minutesAhead) + seasonal);
    
    this.predictions.push({
      timestamp: Date.now(),
      minutesAhead,
      prediction,
      components: { movingAverage, trend, seasonal }
    });
    
    // Keep prediction history limited
    if (this.predictions.length > 100) {
      this.predictions.shift();
    }
    
    return Math.round(prediction);
  }

  calculateTrend(data) {
    if (data.length < 3) return 0;
    
    const x = data.map((_, i) => i);
    const y = data.map(d => d.load);
    const n = data.length;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) || 0;
  }

  calculateSeasonalAdjustment() {
    if (this.history.length < this.seasonalPeriod) return 0;
    
    const now = new Date();
    const currentMinute = now.getMinutes() + (now.getHours() * 60);
    
    // Find historical data points at similar times
    const similarTimes = this.history.filter(point => {
      const pointDate = new Date(point.timestamp);
      const pointMinute = pointDate.getMinutes() + (pointDate.getHours() * 60);
      return Math.abs(pointMinute - currentMinute) <= 5; // Within 5 minutes
    });
    
    if (similarTimes.length < 3) return 0;
    
    const avgHistorical = similarTimes.reduce((sum, point) => sum + point.load, 0) / similarTimes.length;
    const recentAvg = this.history.slice(-10).reduce((sum, point) => sum + point.load, 0) / 10;
    
    return (avgHistorical - recentAvg) * 0.3; // Dampen the seasonal effect
  }
}

/**
 * Smart Database Connection
 */
class SmartConnection {
  constructor(id, createConnection) {
    this.id = id;
    this.connection = null;
    this.createConnection = createConnection;
    this.createdAt = Date.now();
    this.lastUsed = Date.now();
    this.useCount = 0;
    this.isActive = false;
    this.health = 100;
    this.responseTime = 0;
  }

  async initialize() {
    try {
      this.connection = await this.createConnection();
      this.isActive = true;
      return this.connection;
    } catch (error) {
      this.health = 0;
      throw error;
    }
  }

  async execute(query, params) {
    if (!this.isActive || !this.connection) {
      throw new Error('Connection not active');
    }

    const startTime = Date.now();
    
    try {
      const result = await this.connection.execute(query, params);
      
      this.lastUsed = Date.now();
      this.useCount++;
      this.responseTime = Date.now() - startTime;
      
      // Update health based on response time
      if (this.responseTime < 100) {
        this.health = Math.min(100, this.health + 1);
      } else if (this.responseTime > 1000) {
        this.health = Math.max(0, this.health - 5);
      }
      
      return result;
    } catch (error) {
      this.health = Math.max(0, this.health - 10);
      throw error;
    }
  }

  getAge() {
    return Date.now() - this.createdAt;
  }

  getIdleTime() {
    return Date.now() - this.lastUsed;
  }

  isHealthy() {
    return this.health > 50 && this.isActive;
  }

  async close() {
    this.isActive = false;
    if (this.connection && this.connection.close) {
      await this.connection.close();
    }
  }
}

/**
 * Predictive Connection Pool
 */
export class PredictiveConnectionPool extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      minConnections: options.minConnections || 2,
      maxConnections: options.maxConnections || 20,
      idleTimeout: options.idleTimeout || 300000, // 5 minutes
      maxWaitTime: options.maxWaitTime || 10000, // 10 seconds
      healthCheckInterval: options.healthCheckInterval || 60000, // 1 minute
      predictionInterval: options.predictionInterval || 30000, // 30 seconds
      createConnection: options.createConnection || this.defaultCreateConnection,
      ...options
    };
    
    this.connections = new Map();
    this.waitQueue = [];
    this.predictor = new ConnectionLoadPredictor();
    
    this.stats = {
      created: 0,
      destroyed: 0,
      acquired: 0,
      released: 0,
      waitTimeouts: 0,
      predictions: 0,
      scaleUps: 0,
      scaleDowns: 0,
      totalResponseTime: 0,
      queryCount: 0
    };
    
    this.setupMonitoring();
    this.initialize();
  }

  async defaultCreateConnection() {
    // Mock connection for demonstration
    return {
      execute: async (query, params) => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        return { rows: [], affectedRows: 0 };
      },
      close: async () => {}
    };
  }

  setupMonitoring() {
    // Health check interval
    this.healthTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.options.healthCheckInterval);
    
    // Prediction and scaling interval
    this.predictionTimer = setInterval(() => {
      this.performPredictiveScaling();
    }, this.options.predictionInterval);
  }

  async initialize() {
    // Create minimum connections
    for (let i = 0; i < this.options.minConnections; i++) {
      await this.createConnection();
    }
    
    this.emit('initialized', { connections: this.connections.size });
  }

  async createConnection() {
    const id = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const connection = new SmartConnection(id, this.options.createConnection);
    
    try {
      await connection.initialize();
      this.connections.set(id, connection);
      this.stats.created++;
      
      this.emit('connection-created', { id, total: this.connections.size });
      
      return connection;
    } catch (error) {
      this.emit('connection-failed', { id, error: error.message });
      throw error;
    }
  }

  async acquireConnection() {
    this.stats.acquired++;
    
    // Find available healthy connection
    for (const [id, connection] of this.connections) {
      if (connection.isHealthy() && !connection.inUse) {
        connection.inUse = true;
        this.emit('connection-acquired', { id });
        return connection;
      }
    }
    
    // No available connection, try to create new one if under limit
    if (this.connections.size < this.options.maxConnections) {
      try {
        const connection = await this.createConnection();
        connection.inUse = true;
        return connection;
      } catch (error) {
        // Fall through to queue if creation fails
      }
    }
    
    // Queue the request
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.stats.waitTimeouts++;
        reject(new Error('Connection wait timeout'));
      }, this.options.maxWaitTime);
      
      this.waitQueue.push({ resolve, reject, timeout });
    });
  }

  releaseConnection(connection) {
    this.stats.released++;
    
    connection.inUse = false;
    this.emit('connection-released', { id: connection.id });
    
    // Serve waiting requests
    if (this.waitQueue.length > 0) {
      const { resolve, timeout } = this.waitQueue.shift();
      clearTimeout(timeout);
      connection.inUse = true;
      resolve(connection);
    }
  }

  async performHealthCheck() {
    const unhealthyConnections = [];
    
    for (const [id, connection] of this.connections) {
      if (!connection.isHealthy() || connection.getIdleTime() > this.options.idleTimeout) {
        unhealthyConnections.push(id);
      }
    }
    
    // Remove unhealthy connections
    for (const id of unhealthyConnections) {
      await this.destroyConnection(id);
    }
    
    // Ensure minimum connections
    while (this.connections.size < this.options.minConnections) {
      try {
        await this.createConnection();
      } catch (error) {
        break; // Stop trying if creation fails
      }
    }
    
    this.emit('health-check', { 
      removed: unhealthyConnections.length, 
      total: this.connections.size 
    });
  }

  async performPredictiveScaling() {
    const currentLoad = this.getCurrentLoad();
    const queueLength = this.waitQueue.length;
    const avgResponseTime = this.getAverageResponseTime();
    
    // Add data point to predictor
    this.predictor.addDataPoint(
      Date.now(),
      this.connections.size,
      queueLength,
      avgResponseTime
    );
    
    // Predict future load
    const predictedLoad = this.predictor.predictLoad(5); // 5 minutes ahead
    this.stats.predictions++;
    
    // Scale based on prediction
    const targetConnections = Math.min(
      this.options.maxConnections,
      Math.max(this.options.minConnections, Math.ceil(predictedLoad * 0.8))
    );
    
    const currentConnections = this.connections.size;
    
    if (targetConnections > currentConnections) {
      // Scale up
      const needToCreate = Math.min(3, targetConnections - currentConnections);
      
      for (let i = 0; i < needToCreate; i++) {
        try {
          await this.createConnection();
          this.stats.scaleUps++;
        } catch (error) {
          break;
        }
      }
    } else if (targetConnections < currentConnections && currentConnections > this.options.minConnections) {
      // Scale down (only idle connections)
      const toRemove = Math.min(2, currentConnections - targetConnections);
      let removed = 0;
      
      for (const [id, connection] of this.connections) {
        if (removed >= toRemove) break;
        
        if (!connection.inUse && connection.getIdleTime() > 60000) { // 1 minute idle
          await this.destroyConnection(id);
          removed++;
          this.stats.scaleDowns++;
        }
      }
    }
    
    this.emit('predictive-scaling', {
      currentLoad,
      predictedLoad,
      targetConnections,
      currentConnections: this.connections.size
    });
  }

  getCurrentLoad() {
    let activeConnections = 0;
    let totalResponseTime = 0;
    
    for (const connection of this.connections.values()) {
      if (connection.inUse) activeConnections++;
      totalResponseTime += connection.responseTime;
    }
    
    return activeConnections + (this.waitQueue.length * 2);
  }

  getAverageResponseTime() {
    if (this.stats.queryCount === 0) return 0;
    return this.stats.totalResponseTime / this.stats.queryCount;
  }

  async destroyConnection(id) {
    const connection = this.connections.get(id);
    if (connection) {
      await connection.close();
      this.connections.delete(id);
      this.stats.destroyed++;
      
      this.emit('connection-destroyed', { id, total: this.connections.size });
    }
  }

  async query(sql, params) {
    const connection = await this.acquireConnection();
    const startTime = Date.now();
    
    try {
      const result = await connection.execute(sql, params);
      
      const responseTime = Date.now() - startTime;
      this.stats.totalResponseTime += responseTime;
      this.stats.queryCount++;
      
      return result;
    } finally {
      this.releaseConnection(connection);
    }
  }

  getStats() {
    const activeConnections = Array.from(this.connections.values()).filter(c => c.inUse).length;
    const avgResponseTime = this.getAverageResponseTime();
    
    return {
      totalConnections: this.connections.size,
      activeConnections,
      idleConnections: this.connections.size - activeConnections,
      queueLength: this.waitQueue.length,
      created: this.stats.created,
      destroyed: this.stats.destroyed,
      acquired: this.stats.acquired,
      released: this.stats.released,
      waitTimeouts: this.stats.waitTimeouts,
      predictions: this.stats.predictions,
      scaleUps: this.stats.scaleUps,
      scaleDowns: this.stats.scaleDowns,
      avgResponseTime: Math.round(avgResponseTime),
      queryCount: this.stats.queryCount,
      efficiency: {
        utilization: this.connections.size > 0 ? (activeConnections / this.connections.size) : 0,
        throughput: this.stats.queryCount / Math.max(1, (Date.now() - this.stats.startTime) / 1000)
      }
    };
  }

  async destroy() {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
    }
    
    if (this.predictionTimer) {
      clearInterval(this.predictionTimer);
    }
    
    // Close all connections
    for (const [id, connection] of this.connections) {
      await connection.close();
    }
    
    this.connections.clear();
    
    // Reject all waiting requests
    for (const { reject, timeout } of this.waitQueue) {
      clearTimeout(timeout);
      reject(new Error('Connection pool destroyed'));
    }
    
    this.waitQueue = [];
    this.emit('destroyed');
  }
}

export default new PredictiveConnectionPool();