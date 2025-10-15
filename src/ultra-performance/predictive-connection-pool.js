/**
 * Predictive Database Connection Pool with ML-based scaling
 * Implements intelligent connection management and query optimization
 */

import { EventEmitter } from 'events';

class PredictiveConnectionPool extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.minConnections = options.minConnections || 2;
    this.maxConnections = options.maxConnections || 50;
    this.acquireTimeoutMs = options.acquireTimeoutMs || 30000;
    this.idleTimeoutMs = options.idleTimeoutMs || 300000; // 5 minutes
    this.connectionFactory = options.connectionFactory;
    
    // Connection pools
    this.availableConnections = [];
    this.busyConnections = new Set();
    this.connectionQueue = [];
    
    // Predictive analytics
    this.queryHistory = [];
    this.connectionMetrics = {
      totalQueries: 0,
      averageQueryTime: 0,
      peakConnections: 0,
      connectionCreations: 0,
      connectionDestructions: 0,
      queueWaitTimes: []
    };
    
    // Load prediction model
    this.loadPredictor = {
      hourlyPatterns: new Array(24).fill(0),
      dailyAverages: new Array(7).fill(0),
      recentSamples: [],
      prediction: 0
    };
    
    // Health monitoring
    this.healthStats = {
      healthyConnections: 0,
      unhealthyConnections: 0,
      lastHealthCheck: Date.now(),
      averageResponseTime: 0
    };
    
    this.initialize();
    console.log('🔍 Predictive Connection Pool initialized with ML-based scaling');
  }

  async initialize() {
    // Create minimum connections
    for (let i = 0; i < this.minConnections; i++) {
      try {
        const connection = await this.createConnection();
        this.availableConnections.push(connection);
      } catch (error) {
        console.error('Failed to create initial connection:', error.message);
      }
    }
    
    // Start background tasks
    this.startHealthMonitoring();
    this.startLoadPrediction();
    this.startConnectionOptimization();
  }

  /**
   * Acquire connection with intelligent queuing
   */
  async acquireConnection() {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Connection acquisition timeout'));
      }, this.acquireTimeoutMs);
      
      const tryAcquire = async () => {
        // Check for available connection
        if (this.availableConnections.length > 0) {
          clearTimeout(timeoutId);
          const connection = this.availableConnections.pop();
          this.busyConnections.add(connection);
          
          const waitTime = Date.now() - startTime;
          this.connectionMetrics.queueWaitTimes.push(waitTime);
          if (this.connectionMetrics.queueWaitTimes.length > 1000) {
            this.connectionMetrics.queueWaitTimes.shift();
          }
          
          resolve(connection);
          return;
        }
        
        // Create new connection if under limit
        if (this.getTotalConnections() < this.maxConnections) {
          try {
            const connection = await this.createConnection();
            this.busyConnections.add(connection);
            clearTimeout(timeoutId);
            resolve(connection);
            return;
          } catch (error) {
            console.warn('Failed to create new connection:', error.message);
          }
        }
        
        // Queue the request
        this.connectionQueue.push({ resolve, reject, timeoutId, startTime });
      };
      
      tryAcquire();
    });
  }

  /**
   * Release connection back to pool
   */
  releaseConnection(connection) {
    if (!this.busyConnections.has(connection)) {
      console.warn('Attempting to release connection not in busy set');
      return false;
    }
    
    this.busyConnections.delete(connection);
    
    // Check if connection is healthy
    if (this.isConnectionHealthy(connection)) {
      this.availableConnections.push(connection);
      
      // Process queued requests
      if (this.connectionQueue.length > 0) {
        const queued = this.connectionQueue.shift();
        clearTimeout(queued.timeoutId);
        
        const connection = this.availableConnections.pop();
        this.busyConnections.add(connection);
        
        const waitTime = Date.now() - queued.startTime;
        this.connectionMetrics.queueWaitTimes.push(waitTime);
        
        queued.resolve(connection);
      }
    } else {
      // Destroy unhealthy connection
      this.destroyConnection(connection);
      this.createConnection().then(newConnection => {
        this.availableConnections.push(newConnection);
      }).catch(error => {
        console.error('Failed to replace unhealthy connection:', error.message);
      });
    }
    
    return true;
  }

  /**
   * Execute query with automatic connection management
   */
  async executeQuery(query, params = []) {
    const startTime = Date.now();
    let connection;
    
    try {
      connection = await this.acquireConnection();
      const result = await this.runQuery(connection, query, params);
      
      // Track query metrics
      const queryTime = Date.now() - startTime;
      this.updateQueryMetrics(queryTime);
      
      return result;
    } finally {
      if (connection) {
        this.releaseConnection(connection);
      }
    }
  }

  /**
   * Create new database connection
   */
  async createConnection() {
    if (!this.connectionFactory) {
      throw new Error('Connection factory not provided');
    }
    
    const connection = await this.connectionFactory();
    connection.createdAt = Date.now();
    connection.lastUsed = Date.now();
    connection.queryCount = 0;
    
    this.connectionMetrics.connectionCreations++;
    return connection;
  }

  /**
   * Destroy database connection
   */
  async destroyConnection(connection) {
    try {
      if (connection.destroy) {
        await connection.destroy();
      } else if (connection.end) {
        await connection.end();
      }
      this.connectionMetrics.connectionDestructions++;
    } catch (error) {
      console.warn('Error destroying connection:', error.message);
    }
  }

  /**
   * Check if connection is healthy
   */
  isConnectionHealthy(connection) {
    const now = Date.now();
    const age = now - connection.createdAt;
    const idle = now - connection.lastUsed;
    
    // Connection is unhealthy if too old or idle too long
    if (idle > this.idleTimeoutMs || age > 3600000) { // 1 hour max age
      return false;
    }
    
    // Add more health checks as needed
    return true;
  }

  /**
   * Run query on connection
   */
  async runQuery(connection, query, params) {
    connection.lastUsed = Date.now();
    connection.queryCount++;
    
    // Mock implementation - replace with actual database query
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ rows: [], affectedRows: 0, insertId: null });
      }, Math.random() * 100); // Simulate query time
    });
  }

  /**
   * Update query performance metrics
   */
  updateQueryMetrics(queryTime) {
    this.connectionMetrics.totalQueries++;
    
    // Update rolling average
    const alpha = 0.1; // Exponential moving average factor
    this.connectionMetrics.averageQueryTime = 
      alpha * queryTime + (1 - alpha) * this.connectionMetrics.averageQueryTime;
    
    // Track query history for prediction
    this.queryHistory.push({
      timestamp: Date.now(),
      queryTime,
      activeConnections: this.busyConnections.size
    });
    
    // Limit history size
    if (this.queryHistory.length > 10000) {
      this.queryHistory.shift();
    }
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Every 30 seconds
  }

  /**
   * Perform health check on all connections
   */
  async performHealthCheck() {
    const healthyCount = this.availableConnections.filter(conn => 
      this.isConnectionHealthy(conn)
    ).length;
    
    const busyHealthyCount = Array.from(this.busyConnections).filter(conn => 
      this.isConnectionHealthy(conn)
    ).length;
    
    this.healthStats = {
      healthyConnections: healthyCount + busyHealthyCount,
      unhealthyConnections: this.getTotalConnections() - (healthyCount + busyHealthyCount),
      lastHealthCheck: Date.now(),
      averageResponseTime: this.connectionMetrics.averageQueryTime
    };
    
    // Remove unhealthy connections from available pool
    this.availableConnections = this.availableConnections.filter(conn => {
      if (!this.isConnectionHealthy(conn)) {
        this.destroyConnection(conn);
        return false;
      }
      return true;
    });
    
    // Ensure minimum connections
    this.ensureMinimumConnections();
  }

  /**
   * Start load prediction system
   */
  startLoadPrediction() {
    setInterval(() => {
      this.updateLoadPrediction();
    }, 60000); // Every minute
  }

  /**
   * Update load prediction based on historical data
   */
  updateLoadPrediction() {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    // Update hourly patterns
    const recentQueries = this.queryHistory.filter(q => 
      Date.now() - q.timestamp < 3600000 // Last hour
    );
    
    this.loadPredictor.hourlyPatterns[hour] = 
      0.9 * this.loadPredictor.hourlyPatterns[hour] + 0.1 * recentQueries.length;
    
    // Simple prediction: next hour load based on historical pattern
    const nextHour = (hour + 1) % 24;
    this.loadPredictor.prediction = this.loadPredictor.hourlyPatterns[nextHour];
    
    // Proactively scale connections based on prediction
    this.scaleConnections();
  }

  /**
   * Scale connections based on predicted load
   */
  async scaleConnections() {
    const currentLoad = this.busyConnections.size;
    const predictedLoad = Math.ceil(this.loadPredictor.prediction / 100); // Scale factor
    const totalConnections = this.getTotalConnections();
    
    // Scale up if prediction suggests high load
    if (predictedLoad > totalConnections && totalConnections < this.maxConnections) {
      const connectionsToAdd = Math.min(
        predictedLoad - totalConnections,
        this.maxConnections - totalConnections,
        5 // Max 5 at once
      );
      
      for (let i = 0; i < connectionsToAdd; i++) {
        try {
          const connection = await this.createConnection();
          this.availableConnections.push(connection);
        } catch (error) {
          console.warn('Failed to scale up connection:', error.message);
        }
      }
      
      if (connectionsToAdd > 0) {
        console.log(`📈 Scaled up ${connectionsToAdd} connections based on prediction`);
      }
    }
  }

  /**
   * Start connection optimization
   */
  startConnectionOptimization() {
    setInterval(() => {
      this.optimizeConnections();
    }, 120000); // Every 2 minutes
  }

  /**
   * Optimize connection pool size and performance
   */
  async optimizeConnections() {
    const now = Date.now();
    const totalConnections = this.getTotalConnections();
    
    // Remove idle connections if above minimum
    if (totalConnections > this.minConnections) {
      const idleConnections = this.availableConnections.filter(conn => 
        now - conn.lastUsed > this.idleTimeoutMs / 2
      );
      
      const connectionsToRemove = Math.min(
        idleConnections.length,
        totalConnections - this.minConnections
      );
      
      for (let i = 0; i < connectionsToRemove; i++) {
        const connection = idleConnections[i];
        const index = this.availableConnections.indexOf(connection);
        if (index > -1) {
          this.availableConnections.splice(index, 1);
          await this.destroyConnection(connection);
        }
      }
      
      if (connectionsToRemove > 0) {
        console.log(`📉 Removed ${connectionsToRemove} idle connections`);
      }
    }
  }

  /**
   * Ensure minimum connections are available
   */
  async ensureMinimumConnections() {
    const totalConnections = this.getTotalConnections();
    
    if (totalConnections < this.minConnections) {
      const connectionsNeeded = this.minConnections - totalConnections;
      
      for (let i = 0; i < connectionsNeeded; i++) {
        try {
          const connection = await this.createConnection();
          this.availableConnections.push(connection);
        } catch (error) {
          console.error('Failed to create minimum connection:', error.message);
        }
      }
    }
  }

  /**
   * Get total number of connections
   */
  getTotalConnections() {
    return this.availableConnections.length + this.busyConnections.size;
  }

  /**
   * Get comprehensive pool statistics
   */
  getStats() {
    const avgWaitTime = this.connectionMetrics.queueWaitTimes.length > 0 ?
      this.connectionMetrics.queueWaitTimes.reduce((a, b) => a + b, 0) / 
      this.connectionMetrics.queueWaitTimes.length : 0;
    
    return {
      connections: {
        total: this.getTotalConnections(),
        available: this.availableConnections.length,
        busy: this.busyConnections.size,
        queued: this.connectionQueue.length
      },
      metrics: {
        ...this.connectionMetrics,
        averageWaitTime: avgWaitTime.toFixed(2) + 'ms'
      },
      health: this.healthStats,
      prediction: {
        nextHourLoad: this.loadPredictor.prediction.toFixed(1),
        currentHourPattern: this.loadPredictor.hourlyPatterns[new Date().getHours()].toFixed(1)
      },
      efficiency: {
        connectionUtilization: (this.busyConnections.size / this.getTotalConnections() * 100).toFixed(1) + '%',
        queryThroughput: (this.connectionMetrics.totalQueries / ((Date.now() - (this.connectionMetrics.startTime || Date.now())) / 1000)).toFixed(2) + '/sec'
      }
    };
  }

  /**
   * Graceful shutdown
   */
  async destroy() {
    console.log('🗑️ Shutting down connection pool...');
    
    // Close all available connections
    for (const connection of this.availableConnections) {
      await this.destroyConnection(connection);
    }
    
    // Close all busy connections
    for (const connection of this.busyConnections) {
      await this.destroyConnection(connection);
    }
    
    this.availableConnections = [];
    this.busyConnections.clear();
    this.connectionQueue = [];
    
    console.log('🔍 Connection pool shutdown complete');
  }
}

export { PredictiveConnectionPool };
export default PredictiveConnectionPool;