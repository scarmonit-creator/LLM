/**
 * Memory Manager Integration for Performance Monitoring
 * 
 * This module provides seamless integration between the OptimizedMemoryManager
 * and the PerformanceMonitor to enable comprehensive memory performance tracking.
 * 
 * Features:
 * - Automatic metric collection from memory operations
 * - Memory pressure alerts and notifications
 * - Cache performance analytics
 * - Background optimization triggers
 * - Real-time memory usage dashboards
 */

import PerformanceMonitor from './performance-monitor';

interface MemoryMetrics {
  cacheHits: number;
  cacheMisses: number;
  evictions: number;
  compressions: number;
  backgroundTasks: number;
  memoryPressure: number;
  heapUsed: number;
  heapTotal: number;
  operationTimes: number[];
}

interface MemoryOperationContext {
  operation: string;
  key?: string;
  type?: string;
  size?: number;
  duration: number;
  success: boolean;
  metadata?: any;
}

class MemoryPerformanceIntegration {
  private performanceMonitor: PerformanceMonitor;
  private memoryManager: any; // OptimizedMemoryManager instance
  private isIntegrated = false;
  private metricsBuffer: MemoryOperationContext[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  
  constructor(performanceMonitor: PerformanceMonitor, memoryManager: any) {
    this.performanceMonitor = performanceMonitor;
    this.memoryManager = memoryManager;
    
    this.setupEventListeners();
    this.startMetricsCollection();
  }
  
  /**
   * Initialize integration between memory manager and performance monitor
   */
  async initialize(): Promise<void> {
    if (this.isIntegrated) return;
    
    try {
      // Hook into memory manager events
      this.attachMemoryManagerHooks();
      
      // Start periodic memory metrics collection
      this.startPeriodicCollection();
      
      // Initialize alert thresholds for memory metrics
      this.setupMemoryAlerts();
      
      this.isIntegrated = true;
      console.log('🔗 Memory-Performance integration initialized');
      
    } catch (error) {
      console.error('Failed to initialize memory-performance integration:', error);
      throw error;
    }
  }
  
  /**
   * Record memory operation performance
   */
  recordMemoryOperation(context: MemoryOperationContext): void {
    // Add to buffer for batch processing
    this.metricsBuffer.push({
      ...context,
      timestamp: Date.now()
    } as any);
    
    // Record individual metrics immediately for critical operations
    if (context.operation === 'store' || context.operation === 'retrieve') {
      this.performanceMonitor.recordMemoryOperation(
        context.operation,
        context.duration,
        context.success
      );
    }
    
    // Record size metrics for storage operations
    if (context.size && context.operation === 'store') {
      this.performanceMonitor.recordMetric('memory.storage_size', context.size, {
        operation: context.operation,
        type: context.type || 'unknown'
      });
    }
    
    // Track operation success/failure rates
    this.performanceMonitor.recordMetric('memory.operation_success', context.success ? 1 : 0, {
      operation: context.operation
    });
  }
  
  /**
   * Get comprehensive memory performance metrics
   */
  getMemoryPerformanceMetrics(): MemoryMetrics {
    const memoryManagerMetrics = this.memoryManager.getMetrics();
    const systemMetrics = this.performanceMonitor.getCurrentMetrics();
    
    return {
      cacheHits: memoryManagerMetrics.cache.hits || 0,
      cacheMisses: memoryManagerMetrics.cache.misses || 0,
      evictions: memoryManagerMetrics.cache.evictions || 0,
      compressions: memoryManagerMetrics.performance.compressions || 0,
      backgroundTasks: memoryManagerMetrics.performance.backgroundTasks || 0,
      memoryPressure: systemMetrics.memory.pressure,
      heapUsed: systemMetrics.memory.heapUsed,
      heapTotal: systemMetrics.memory.heapTotal,
      operationTimes: this.getRecentOperationTimes()
    };
  }
  
  /**
   * Trigger memory optimization based on performance metrics
   */
  async triggerMemoryOptimization(reason: string = 'performance'): Promise<void> {
    console.log(`🧠 Triggering memory optimization: ${reason}`);
    
    try {
      // Record optimization trigger
      this.performanceMonitor.recordMetric('memory.optimization_triggered', 1, {
        reason
      });
      
      // Trigger memory manager consolidation
      if (typeof this.memoryManager.consolidateMemory === 'function') {
        const startTime = performance.now();
        const result = await this.memoryManager.consolidateMemory();
        const duration = performance.now() - startTime;
        
        // Record optimization results
        this.performanceMonitor.recordMetric('memory.optimization_duration', duration);
        this.performanceMonitor.recordMetric('memory.items_optimized', result.itemsProcessed || 0);
        this.performanceMonitor.recordMetric('memory.memory_freed', result.memoryFreed || 0);
        
        console.log(`✅ Memory optimization completed in ${duration.toFixed(2)}ms`);
      }
      
    } catch (error) {
      console.error('Memory optimization failed:', error);
      this.performanceMonitor.recordMetric('memory.optimization_errors', 1);
    }
  }
  
  /**
   * Generate memory performance report
   */
  generateMemoryReport(hours = 1): any {
    const memoryMetrics = this.getMemoryPerformanceMetrics();
    const historicalMetrics = this.performanceMonitor.getMetrics('memory.operation_time', hours);
    
    const report = {
      timestamp: Date.now(),
      period: `${hours} hour(s)`,
      current: memoryMetrics,
      performance: {
        totalOperations: historicalMetrics.length,
        averageOperationTime: 0,
        successRate: 0,
        cacheHitRate: 0
      },
      recommendations: this.generateOptimizationRecommendations(memoryMetrics)
    };
    
    // Calculate performance statistics
    if (historicalMetrics.length > 0) {
      const operationTimes = historicalMetrics.map(m => m.value);
      report.performance.averageOperationTime = 
        operationTimes.reduce((a, b) => a + b, 0) / operationTimes.length;
    }
    
    // Calculate cache hit rate
    const totalCacheOperations = memoryMetrics.cacheHits + memoryMetrics.cacheMisses;
    if (totalCacheOperations > 0) {
      report.performance.cacheHitRate = 
        (memoryMetrics.cacheHits / totalCacheOperations) * 100;
    }
    
    return report;
  }
  
  // Private methods
  
  private setupEventListeners(): void {
    // Listen for memory pressure events from memory manager
    if (this.memoryManager.on) {
      this.memoryManager.on('memoryPressure', (data: any) => {
        this.performanceMonitor.recordMetric('memory.pressure_event', data.usage, {
          level: data.level
        });
        
        // Trigger optimization for critical pressure
        if (data.level === 'critical') {
          this.triggerMemoryOptimization('critical_pressure');
        }
      });
      
      this.memoryManager.on('stored', (data: any) => {
        this.recordMemoryOperation({
          operation: 'store',
          key: data.key,
          type: data.type,
          size: data.size,
          duration: 0, // Will be updated by operation timing
          success: true
        });
      });
      
      this.memoryManager.on('retrieved', (data: any) => {
        this.recordMemoryOperation({
          operation: 'retrieve',
          key: data.key,
          duration: 0,
          success: data.hit,
          metadata: { hit: data.hit }
        });
      });
      
      this.memoryManager.on('evicted', (data: any) => {
        this.recordMemoryOperation({
          operation: 'evict',
          key: data.key,
          duration: 0,
          success: true
        });
      });
    }
  }
  
  private attachMemoryManagerHooks(): void {
    // Wrap memory manager methods to capture timing
    if (this.memoryManager.store) {
      const originalStore = this.memoryManager.store.bind(this.memoryManager);
      this.memoryManager.store = async (...args: any[]) => {
        const startTime = performance.now();
        try {
          const result = await originalStore(...args);
          const duration = performance.now() - startTime;
          
          this.recordMemoryOperation({
            operation: 'store',
            key: args[0],
            type: args[2],
            duration,
            success: true
          });
          
          return result;
        } catch (error) {
          const duration = performance.now() - startTime;
          this.recordMemoryOperation({
            operation: 'store',
            key: args[0],
            duration,
            success: false
          });
          throw error;
        }
      };
    }
    
    if (this.memoryManager.retrieve) {
      const originalRetrieve = this.memoryManager.retrieve.bind(this.memoryManager);
      this.memoryManager.retrieve = async (...args: any[]) => {
        const startTime = performance.now();
        try {
          const result = await originalRetrieve(...args);
          const duration = performance.now() - startTime;
          
          this.recordMemoryOperation({
            operation: 'retrieve',
            key: args[0],
            duration,
            success: result !== null
          });
          
          return result;
        } catch (error) {
          const duration = performance.now() - startTime;
          this.recordMemoryOperation({
            operation: 'retrieve',
            key: args[0],
            duration,
            success: false
          });
          throw error;
        }
      };
    }
  }
  
  private startMetricsCollection(): void {
    // Flush metrics buffer periodically
    this.flushInterval = setInterval(() => {
      this.flushMetricsBuffer();
    }, 10000); // Every 10 seconds
  }
  
  private startPeriodicCollection(): void {
    // Collect memory manager metrics every 30 seconds
    setInterval(() => {
      if (this.memoryManager.getMetrics) {
        const metrics = this.memoryManager.getMetrics();
        
        // Record cache performance
        this.performanceMonitor.recordMetric('memory.cache_hit_rate', 
          parseFloat(metrics.cache.hitRate) || 0);
        
        this.performanceMonitor.recordMetric('memory.total_items', 
          metrics.stores.total || 0);
        
        this.performanceMonitor.recordMetric('memory.evictions_per_minute', 
          metrics.cache.evictions || 0);
      }
    }, 30000);
  }
  
  private setupMemoryAlerts(): void {
    // Set up memory-specific alert thresholds
    this.performanceMonitor.on('alert', (alertData: any) => {
      if (alertData.metric.startsWith('memory.')) {
        console.log(`🚨 Memory Alert: ${alertData.level} - ${alertData.metric}`);
        
        // Trigger optimization for memory-related alerts
        if (alertData.level === 'critical') {
          this.triggerMemoryOptimization(`alert_${alertData.metric}`);
        }
      }
    });
  }
  
  private flushMetricsBuffer(): void {
    if (this.metricsBuffer.length === 0) return;
    
    // Process buffered metrics
    const buffer = [...this.metricsBuffer];
    this.metricsBuffer = [];
    
    // Aggregate metrics for batch recording
    const aggregated = new Map<string, { count: number; totalDuration: number; successes: number }>();
    
    for (const context of buffer) {
      const key = `${context.operation}_${context.type || 'unknown'}`;
      const current = aggregated.get(key) || { count: 0, totalDuration: 0, successes: 0 };
      
      current.count++;
      current.totalDuration += context.duration;
      if (context.success) current.successes++;
      
      aggregated.set(key, current);
    }
    
    // Record aggregated metrics
    for (const [key, stats] of aggregated.entries()) {
      const [operation, type] = key.split('_');
      const avgDuration = stats.totalDuration / stats.count;
      const successRate = (stats.successes / stats.count) * 100;
      
      this.performanceMonitor.recordMetric('memory.batch_avg_duration', avgDuration, {
        operation, type
      });
      
      this.performanceMonitor.recordMetric('memory.batch_success_rate', successRate, {
        operation, type
      });
      
      this.performanceMonitor.recordMetric('memory.batch_operations', stats.count, {
        operation, type
      });
    }
  }
  
  private getRecentOperationTimes(): number[] {
    const recentMetrics = this.performanceMonitor.getMetrics('memory.operation_time', 0.5); // Last 30 minutes
    return recentMetrics.map(m => m.value);
  }
  
  private generateOptimizationRecommendations(metrics: MemoryMetrics): string[] {
    const recommendations: string[] = [];
    
    // Cache hit rate recommendations
    const totalCacheOps = metrics.cacheHits + metrics.cacheMisses;
    const hitRate = totalCacheOps > 0 ? (metrics.cacheHits / totalCacheOps) * 100 : 0;
    
    if (hitRate < 50) {
      recommendations.push('Cache hit rate is below 50% - consider increasing cache size or adjusting TTL settings');
    }
    
    // Memory pressure recommendations
    if (metrics.memoryPressure > 80) {
      recommendations.push('High memory pressure detected - consider increasing memory limits or enabling more aggressive cleanup');
    }
    
    // Eviction rate recommendations
    if (metrics.evictions > metrics.cacheHits * 0.1) {
      recommendations.push('High eviction rate - cache may be undersized for current workload');
    }
    
    // Operation performance recommendations
    const avgOpTime = metrics.operationTimes.length > 0 
      ? metrics.operationTimes.reduce((a, b) => a + b, 0) / metrics.operationTimes.length
      : 0;
    
    if (avgOpTime > 100) {
      recommendations.push('Average operation time exceeds 100ms - consider enabling compression or optimizing data structures');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Memory performance is optimal - no immediate optimizations needed');
    }
    
    return recommendations;
  }
  
  /**
   * Cleanup integration resources
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    this.isIntegrated = false;
    console.log('Memory-Performance integration destroyed');
  }
}

export default MemoryPerformanceIntegration;
export { MemoryMetrics, MemoryOperationContext };