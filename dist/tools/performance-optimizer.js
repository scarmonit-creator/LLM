// Performance Optimizer Tool
export class PerformanceOptimizer {
  constructor() {
    this.name = 'performance_optimizer';
    this.description = 'Monitors and optimizes application performance';
    this.metrics = [];
    this.startTime = Date.now();
  }

  recordMetric(name, value, unit = 'ms') {
    const metric = {
      name,
      value,
      unit,
      timestamp: Date.now()
    };
    this.metrics.push(metric);
    return metric;
  }

  getMetrics(name = null, limit = 100) {
    let filtered = this.metrics;
    
    if (name) {
      filtered = filtered.filter(m => m.name === name);
    }
    
    return filtered.slice(-limit);
  }

  getPerformanceStats() {
    const now = Date.now();
    const memUsage = process.memoryUsage();
    
    return {
      uptime: now - this.startTime,
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      },
      metricsCount: this.metrics.length
    };
  }

  async measureFunction(fn, name = 'function') {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.recordMetric(name, duration);
      return { result, duration };
    } catch (error) {
      const duration = Date.now() - start;
      this.recordMetric(`${name}_error`, duration);
      throw error;
    }
  }
}

export default PerformanceOptimizer;