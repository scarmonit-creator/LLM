// Traefik Integration Module
// Enhances the LLM server with Traefik-specific functionality

import { performance } from 'perf_hooks';

/**
 * Traefik Integration Class
 * Provides middleware, health checks, and monitoring for Traefik integration
 */
export class TraefikIntegration {
  constructor(options = {}) {
    this.instanceId = process.env.INSTANCE_ID || 'llm-unknown';
    this.version = options.version || '1.3.0';
    this.enableMetrics = options.enableMetrics !== false;
    this.enableLogging = options.enableLogging !== false;
    
    // Request tracking
    this.requestMetrics = {
      total: 0,
      errors: 0,
      responseTimes: [],
      slowRequests: 0,
      lastRequest: null,
      instanceRequests: 0
    };
    
    // Health status
    this.healthStatus = {
      status: 'healthy',
      uptime: Date.now(),
      lastHealthCheck: null,
      consecutiveFailures: 0
    };
    
    this.startTime = Date.now();
    
    console.log(`[${this.instanceId}] Traefik integration initialized`);
  }

  /**
   * Express middleware for Traefik integration
   */
  middleware() {
    return (req, res, next) => {
      const startTime = performance.now();
      
      // Add Traefik-aware headers
      this.addTraefikHeaders(req, res);
      
      // Track request
      this.trackRequest(req);
      
      // Log Traefik routing information
      if (this.enableLogging) {
        this.logTraefikRequest(req);
      }
      
      // Add response time tracking
      res.on('finish', () => {
        const responseTime = performance.now() - startTime;
        this.recordResponseTime(responseTime, res.statusCode);
      });
      
      next();
    };
  }

  /**
   * Add Traefik-specific headers to responses
   */
  addTraefikHeaders(req, res) {
    // Instance identification
    res.setHeader('X-LLM-Instance', this.instanceId);
    res.setHeader('X-LLM-Version', this.version);
    res.setHeader('X-LLM-Uptime', Math.floor((Date.now() - this.startTime) / 1000));
    
    // Traefik metadata
    res.setHeader('X-Traefik-Integration', 'active');
    
    // Load balancing information
    if (req.headers.cookie && req.headers.cookie.includes('llm-instance')) {
      res.setHeader('X-LLM-Session-Sticky', 'true');
    }
    
    // Performance hints for Traefik
    res.setHeader('X-LLM-Health-Status', this.healthStatus.status);
    res.setHeader('X-LLM-Request-Count', this.requestMetrics.instanceRequests.toString());
  }

  /**
   * Log Traefik routing information
   */
  logTraefikRequest(req) {
    const forwardedHost = req.headers['x-forwarded-host'];
    const forwardedProto = req.headers['x-forwarded-proto'];
    const realIp = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip;
    const userAgent = req.headers['user-agent'];
    
    if (forwardedHost) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        instance: this.instanceId,
        method: req.method,
        path: req.path,
        forwardedHost,
        forwardedProto,
        realIp,
        userAgent,
        query: Object.keys(req.query).length > 0 ? req.query : undefined
      };
      
      console.log(`[TRAEFIK] ${JSON.stringify(logEntry)}`);
    }
  }

  /**
   * Track request metrics
   */
  trackRequest(req) {
    this.requestMetrics.total++;
    this.requestMetrics.instanceRequests++;
    this.requestMetrics.lastRequest = Date.now();
  }

  /**
   * Record response time and update metrics
   */
  recordResponseTime(responseTime, statusCode) {
    this.requestMetrics.responseTimes.push(responseTime);
    
    // Keep only last 100 response times
    if (this.requestMetrics.responseTimes.length > 100) {
      this.requestMetrics.responseTimes.shift();
    }
    
    // Track slow requests (>1000ms)
    if (responseTime > 1000) {
      this.requestMetrics.slowRequests++;
    }
    
    // Track errors (5xx status codes)
    if (statusCode >= 500) {
      this.requestMetrics.errors++;
    }
  }

  /**
   * Enhanced health check endpoint for Traefik
   */
  createHealthCheckHandler() {
    return (req, res) => {
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);
      const memUsage = process.memoryUsage();
      const memoryPressure = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
      
      // Calculate average response time
      const avgResponseTime = this.requestMetrics.responseTimes.length > 0
        ? this.requestMetrics.responseTimes.reduce((a, b) => a + b, 0) / this.requestMetrics.responseTimes.length
        : 0;
      
      // Determine health status
      let status = 'healthy';
      let httpStatus = 200;
      
      // Memory pressure check
      if (memoryPressure > 90) {
        status = 'unhealthy';
        httpStatus = 503;
        this.healthStatus.consecutiveFailures++;
      } else if (memoryPressure > 80) {
        status = 'warning';
        this.healthStatus.consecutiveFailures = 0;
      } else {
        this.healthStatus.consecutiveFailures = 0;
      }
      
      // Update health status
      this.healthStatus.status = status;
      this.healthStatus.lastHealthCheck = new Date().toISOString();
      
      const healthCheck = {
        status,
        instance: this.instanceId,
        timestamp: new Date().toISOString(),
        uptime,
        traefik: {
          integration: 'active',
          forwardedHost: req.headers['x-forwarded-host'],
          forwardedProto: req.headers['x-forwarded-proto'],
          realIp: req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip,
          loadBalancer: req.headers.cookie?.includes('llm-instance') ? 'sticky-session' : 'round-robin'
        },
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024),
          pressure: memoryPressure
        },
        performance: {
          requests: this.requestMetrics.instanceRequests,
          errors: this.requestMetrics.errors,
          slowRequests: this.requestMetrics.slowRequests,
          avgResponseTime: Math.round(avgResponseTime),
          errorRate: this.requestMetrics.instanceRequests > 0
            ? ((this.requestMetrics.errors / this.requestMetrics.instanceRequests) * 100).toFixed(2)
            : '0.00'
        },
        health: {
          consecutiveFailures: this.healthStatus.consecutiveFailures,
          lastRequest: this.requestMetrics.lastRequest
            ? new Date(this.requestMetrics.lastRequest).toISOString()
            : null
        }
      };
      
      res.status(httpStatus).json(healthCheck);
    };
  }

  /**
   * Prometheus metrics endpoint for Traefik monitoring
   */
  createMetricsHandler() {
    return (req, res) => {
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);
      const memUsage = process.memoryUsage();
      
      // Calculate rates and averages
      const avgResponseTime = this.requestMetrics.responseTimes.length > 0
        ? this.requestMetrics.responseTimes.reduce((a, b) => a + b, 0) / this.requestMetrics.responseTimes.length
        : 0;
      
      const errorRate = this.requestMetrics.instanceRequests > 0
        ? (this.requestMetrics.errors / this.requestMetrics.instanceRequests)
        : 0;
      
      res.set('Content-Type', 'text/plain');
      res.send(`# HELP llm_instance_info Instance information
# TYPE llm_instance_info gauge
llm_instance_info{instance="${this.instanceId}",version="${this.version}"} 1

# HELP llm_instance_uptime_seconds Instance uptime in seconds
# TYPE llm_instance_uptime_seconds counter
llm_instance_uptime_seconds{instance="${this.instanceId}"} ${uptime}

# HELP llm_instance_requests_total Total requests to this instance
# TYPE llm_instance_requests_total counter
llm_instance_requests_total{instance="${this.instanceId}"} ${this.requestMetrics.instanceRequests}

# HELP llm_instance_errors_total Total errors from this instance
# TYPE llm_instance_errors_total counter
llm_instance_errors_total{instance="${this.instanceId}"} ${this.requestMetrics.errors}

# HELP llm_instance_slow_requests_total Total slow requests from this instance
# TYPE llm_instance_slow_requests_total counter
llm_instance_slow_requests_total{instance="${this.instanceId}"} ${this.requestMetrics.slowRequests}

# HELP llm_instance_response_time_average Average response time in milliseconds
# TYPE llm_instance_response_time_average gauge
llm_instance_response_time_average{instance="${this.instanceId}"} ${avgResponseTime.toFixed(2)}

# HELP llm_instance_error_rate Error rate as ratio
# TYPE llm_instance_error_rate gauge
llm_instance_error_rate{instance="${this.instanceId}"} ${errorRate.toFixed(4)}

# HELP llm_instance_memory_usage_bytes Memory usage in bytes
# TYPE llm_instance_memory_usage_bytes gauge
llm_instance_memory_usage_bytes{instance="${this.instanceId}",type="heap_used"} ${memUsage.heapUsed}
llm_instance_memory_usage_bytes{instance="${this.instanceId}",type="heap_total"} ${memUsage.heapTotal}
llm_instance_memory_usage_bytes{instance="${this.instanceId}",type="external"} ${memUsage.external}
llm_instance_memory_usage_bytes{instance="${this.instanceId}",type="rss"} ${memUsage.rss}

# HELP llm_instance_memory_pressure_percent Memory pressure as percentage
# TYPE llm_instance_memory_pressure_percent gauge
llm_instance_memory_pressure_percent{instance="${this.instanceId}"} ${((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2)}

# HELP llm_instance_health_status Health status (1=healthy, 0=unhealthy)
# TYPE llm_instance_health_status gauge
llm_instance_health_status{instance="${this.instanceId}"} ${this.healthStatus.status === 'healthy' ? 1 : 0}

# HELP llm_instance_consecutive_failures Consecutive health check failures
# TYPE llm_instance_consecutive_failures gauge
llm_instance_consecutive_failures{instance="${this.instanceId}"} ${this.healthStatus.consecutiveFailures}

# HELP llm_traefik_integration Traefik integration status
# TYPE llm_traefik_integration gauge
llm_traefik_integration{instance="${this.instanceId}"} 1
`);
    };
  }

  /**
   * Traefik-specific ping endpoint
   */
  createPingHandler() {
    return (req, res) => {
      res.status(200).json({
        status: 'pong',
        instance: this.instanceId,
        timestamp: new Date().toISOString(),
        traefik: 'integrated'
      });
    };
  }

  /**
   * Circuit breaker status endpoint
   */
  createCircuitBreakerStatusHandler() {
    return (req, res) => {
      const recentErrors = this.requestMetrics.errors;
      const totalRequests = this.requestMetrics.instanceRequests;
      const errorRate = totalRequests > 0 ? (recentErrors / totalRequests) : 0;
      
      const circuitStatus = {
        instance: this.instanceId,
        circuitBreaker: {
          state: errorRate > 0.3 ? 'OPEN' : 'CLOSED',
          errorRate: (errorRate * 100).toFixed(2),
          threshold: '30.00',
          recentErrors,
          totalRequests
        },
        timestamp: new Date().toISOString()
      };
      
      res.json(circuitStatus);
    };
  }

  /**
   * Get instance statistics
   */
  getStats() {
    return {
      instance: this.instanceId,
      version: this.version,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      requests: this.requestMetrics,
      health: this.healthStatus,
      traefik: {
        integration: 'active',
        loadBalancing: 'enabled',
        healthChecks: 'enabled',
        metrics: 'enabled'
      }
    };
  }

  /**
   * Graceful shutdown for Traefik integration
   */
  gracefulShutdown() {
    console.log(`[${this.instanceId}] Shutting down Traefik integration...`);
    
    // Mark as unhealthy to remove from load balancer
    this.healthStatus.status = 'shutting-down';
    
    // Give Traefik time to detect unhealthy status and stop routing
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`[${this.instanceId}] Traefik integration shutdown complete`);
        resolve();
      }, 5000); // 5 second delay for graceful removal
    });
  }
}

/**
 * Factory function to create Traefik integration instance
 */
export function createTraefikIntegration(options = {}) {
  return new TraefikIntegration(options);
}

/**
 * Integration helper functions
 */
export const TraefikHelpers = {
  /**
   * Extract load balancer information from request
   */
  getLoadBalancerInfo(req) {
    return {
      forwardedHost: req.headers['x-forwarded-host'],
      forwardedProto: req.headers['x-forwarded-proto'],
      realIp: req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip,
      stickySession: req.headers.cookie?.includes('llm-instance'),
      userAgent: req.headers['user-agent']
    };
  },

  /**
   * Check if request came through Traefik
   */
  isTraefikRequest(req) {
    return !!(req.headers['x-forwarded-host'] || req.headers['x-forwarded-proto']);
  },

  /**
   * Generate instance-aware response headers
   */
  generateInstanceHeaders(instanceId, version = '1.3.0') {
    return {
      'X-LLM-Instance': instanceId,
      'X-LLM-Version': version,
      'X-Traefik-Integration': 'active',
      'X-LLM-Timestamp': new Date().toISOString()
    };
  }
};

export default TraefikIntegration;