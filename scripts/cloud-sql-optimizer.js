/**
 * Cloud SQL Optimizer
 * Provides comprehensive SQL optimization, connection pooling, and performance monitoring
 */

const { Pool } = require('pg');
const { performance } = require('perf_hooks');

class CloudSQLOptimizer {
  constructor(config = {}) {
    this.config = {
      host: config.host || process.env.DB_HOST || 'localhost',
      port: config.port || process.env.DB_PORT || 5432,
      database: config.database || process.env.DB_NAME || 'postgres',
      user: config.user || process.env.DB_USER || 'postgres',
      password: config.password || process.env.DB_PASSWORD || '',
      max: config.max || 20, // Maximum pool size
      min: config.min || 5, // Minimum pool size
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 10000,
      maxUses: config.maxUses || 7500,
      ssl: config.ssl || false
    };

    this.pool = null;
    this.metrics = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      slowQueries: 0,
      avgQueryTime: 0,
      totalQueryTime: 0,
      queryCache: new Map(),
      connectionStats: {
        created: 0,
        closed: 0,
        errors: 0
      }
    };

    this.slowQueryThreshold = config.slowQueryThreshold || 1000; // ms
    this.cacheEnabled = config.cacheEnabled !== false;
    this.cacheTTL = config.cacheTTL || 300000; // 5 minutes
  }

  /**
   * Initialize connection pool
   */
  async initialize() {
    try {
      this.pool = new Pool(this.config);

      // Pool event handlers
      this.pool.on('connect', () => {
        this.metrics.connectionStats.created++;
        console.log('[CloudSQL] New client connected');
      });

      this.pool.on('remove', () => {
        this.metrics.connectionStats.closed++;
        console.log('[CloudSQL] Client removed from pool');
      });

      this.pool.on('error', (err) => {
        this.metrics.connectionStats.errors++;
        console.error('[CloudSQL] Pool error:', err.message);
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      console.log('[CloudSQL] Connection pool initialized successfully');
      return true;
    } catch (error) {
      console.error('[CloudSQL] Failed to initialize pool:', error.message);
      throw error;
    }
  }

  /**
   * Optimize SQL query
   */
  optimizeQuery(query) {
    let optimized = query.trim();

    // Remove unnecessary whitespace
    optimized = optimized.replace(/\s+/g, ' ');

    // Add LIMIT if not present for SELECT queries
    if (optimized.toUpperCase().startsWith('SELECT') && 
        !optimized.toUpperCase().includes('LIMIT')) {
      optimized += ' LIMIT 1000';
    }

    // Suggest indexes for WHERE clauses
    const whereMatch = optimized.match(/WHERE\s+(\w+)/i);
    if (whereMatch) {
      console.log(`[CloudSQL] Consider adding index on: ${whereMatch[1]}`);
    }

    return optimized;
  }

  /**
   * Execute query with optimization and monitoring
   */
  async query(sql, params = [], options = {}) {
    const startTime = performance.now();
    const queryId = this.generateQueryId(sql, params);

    this.metrics.totalQueries++;

    try {
      // Check cache
      if (this.cacheEnabled && !options.skipCache) {
        const cached = this.getFromCache(queryId);
        if (cached) {
          console.log('[CloudSQL] Query result returned from cache');
          return cached;
        }
      }

      // Optimize query
      const optimizedSQL = options.skipOptimization ? sql : this.optimizeQuery(sql);

      // Execute query
      const result = await this.pool.query(optimizedSQL, params);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Update metrics
      this.metrics.successfulQueries++;
      this.metrics.totalQueryTime += duration;
      this.metrics.avgQueryTime = this.metrics.totalQueryTime / this.metrics.successfulQueries;

      if (duration > this.slowQueryThreshold) {
        this.metrics.slowQueries++;
        console.warn(`[CloudSQL] Slow query detected (${duration.toFixed(2)}ms):`, optimizedSQL);
      }

      // Cache result
      if (this.cacheEnabled && sql.toUpperCase().startsWith('SELECT')) {
        this.addToCache(queryId, result);
      }

      console.log(`[CloudSQL] Query executed in ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      this.metrics.failedQueries++;
      console.error('[CloudSQL] Query failed:', error.message);
      throw error;
    }
  }

  /**
   * Execute transaction
   */
  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      console.log('[CloudSQL] Transaction committed successfully');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[CloudSQL] Transaction rolled back:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Batch query execution
   */
  async batchQuery(queries) {
    const results = [];
    const client = await this.pool.connect();

    try {
      for (const { sql, params } of queries) {
        const result = await client.query(sql, params);
        results.push(result);
      }
      console.log(`[CloudSQL] Batch of ${queries.length} queries executed`);
      return results;
    } finally {
      client.release();
    }
  }

  /**
   * Generate query cache key
   */
  generateQueryId(sql, params) {
    return `${sql}:${JSON.stringify(params)}`;
  }

  /**
   * Cache operations
   */
  addToCache(key, value) {
    this.metrics.queryCache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  getFromCache(key) {
    const cached = this.metrics.queryCache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.cacheTTL) {
      this.metrics.queryCache.delete(key);
      return null;
    }

    return cached.value;
  }

  clearCache() {
    this.metrics.queryCache.clear();
    console.log('[CloudSQL] Query cache cleared');
  }

  /**
   * Performance monitoring
   */
  getMetrics() {
    return {
      ...this.metrics,
      poolStats: {
        total: this.pool?.totalCount || 0,
        idle: this.pool?.idleCount || 0,
        waiting: this.pool?.waitingCount || 0
      },
      cacheSize: this.metrics.queryCache.size,
      successRate: this.metrics.totalQueries > 0 
        ? (this.metrics.successfulQueries / this.metrics.totalQueries * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  printMetrics() {
    const metrics = this.getMetrics();
    console.log('\n=== Cloud SQL Optimizer Metrics ===');
    console.log(`Total Queries: ${metrics.totalQueries}`);
    console.log(`Successful: ${metrics.successfulQueries}`);
    console.log(`Failed: ${metrics.failedQueries}`);
    console.log(`Slow Queries: ${metrics.slowQueries}`);
    console.log(`Avg Query Time: ${metrics.avgQueryTime.toFixed(2)}ms`);
    console.log(`Success Rate: ${metrics.successRate}`);
    console.log(`Cache Size: ${metrics.cacheSize}`);
    console.log(`Pool - Total: ${metrics.poolStats.total}, Idle: ${metrics.poolStats.idle}, Waiting: ${metrics.poolStats.waiting}`);
    console.log(`Connections - Created: ${metrics.connectionStats.created}, Closed: ${metrics.connectionStats.closed}, Errors: ${metrics.connectionStats.errors}`);
    console.log('==================================\n');
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const result = await this.query('SELECT 1 as health', [], { skipCache: true });
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        poolHealth: {
          total: this.pool?.totalCount || 0,
          idle: this.pool?.idleCount || 0,
          waiting: this.pool?.waitingCount || 0
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Analyze query performance
   */
  async analyzeQuery(sql, params = []) {
    const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`;
    try {
      const result = await this.pool.query(explainQuery, params);
      const plan = result.rows[0]['QUERY PLAN'][0];
      
      console.log('\n=== Query Analysis ===');
      console.log(`Execution Time: ${plan['Execution Time']}ms`);
      console.log(`Planning Time: ${plan['Planning Time']}ms`);
      console.log(`Total Cost: ${plan['Plan']['Total Cost']}`);
      console.log('======================\n');
      
      return plan;
    } catch (error) {
      console.error('[CloudSQL] Query analysis failed:', error.message);
      throw error;
    }
  }

  /**
   * Cleanup and close connections
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('[CloudSQL] Connection pool closed');
      this.printMetrics();
    }
  }
}

// Export singleton instance and class
let instance = null;

module.exports = {
  CloudSQLOptimizer,
  getInstance: (config) => {
    if (!instance) {
      instance = new CloudSQLOptimizer(config);
    }
    return instance;
  },
  createOptimizer: (config) => new CloudSQLOptimizer(config)
};

// CLI usage
if (require.main === module) {
  (async () => {
    const optimizer = new CloudSQLOptimizer({
      database: process.env.DB_NAME || 'testdb',
      user: process.env.DB_USER || 'postgres'
    });

    try {
      await optimizer.initialize();
      
      // Example queries
      await optimizer.query('SELECT * FROM users WHERE active = $1', [true]);
      await optimizer.query('SELECT COUNT(*) FROM orders');
      
      // Health check
      const health = await optimizer.healthCheck();
      console.log('Health Check:', health);
      
      // Print metrics
      optimizer.printMetrics();
    } catch (error) {
      console.error('Error:', error.message);
    } finally {
      await optimizer.close();
    }
  })();
}
