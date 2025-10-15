/**
 * Performance Integration System
 * 
 * Integrates all optimization components:
 * - Advanced Memory Manager
 * - Multi-Tier Cache System
 * - Ultra-Fast Build System
 * - Security Manager
 * - MCP Server
 */

import { EventEmitter } from 'events';
import { getMemoryManager } from '../memory/advanced-memory-manager.js';
import { getCache } from '../performance/multi-tier-cache.js';
import { getBuildSystem } from '../performance/ultra-fast-build.js';
import { getSecurityManager } from '../../extensions/security/security-manager.js';
import { createMCPServer } from '../mcp-server/server.js';

export interface PerformanceMetrics {
  memory: {
    heapUsed: number;
    heapTotal: number;
    poolUtilization: number;
    pressureLevel: string;
  };
  cache: {
    hitRate: number;
    memoryEfficiency: number;
    l1Hits: number;
    l2Hits: number;
    l3Hits: number;
  };
  build: {
    lastBuildTime: number;
    cacheHitRate: number;
    averageBuildTime: number;
  };
  security: {
    score: number;
    recentEvents: number;
    criticalIssues: number;
  };
  mcp: {
    activeRequests: number;
    toolUsage: Record<string, number>;
    averageResponseTime: number;
  };
  overall: {
    performanceScore: number;
    optimizationLevel: 'excellent' | 'good' | 'fair' | 'poor';
    recommendations: string[];
  };
}

class PerformanceIntegrator extends EventEmitter {
  private memoryManager = getMemoryManager();
  private cache = getCache();
  private buildSystem = getBuildSystem();
  private securityManager = getSecurityManager();
  private mcpServer = createMCPServer();
  private metricsInterval: NodeJS.Timeout | null = null;
  private isOptimizing = false;
  
  constructor() {
    super();
    this.setupEventHandlers();
    this.startMetricsCollection();
  }
  
  private setupEventHandlers(): void {
    // Memory pressure events
    this.memoryManager.on('pressure', (level) => {
      this.emit('memoryPressure', level);
      if (level === 'critical' && !this.isOptimizing) {
        this.performEmergencyOptimization();
      }
    });
    
    // Cache events
    this.cache.on('metrics', (metrics) => {
      this.emit('cacheMetrics', metrics);
    });
    
    // Build system events
    this.buildSystem.on('buildComplete', (metrics) => {
      this.emit('buildComplete', metrics);
    });
    
    // Security events
    this.securityManager.on('securityEvent', (event) => {
      this.emit('securityEvent', event);
      if (event.severity === 'critical') {
        this.handleSecurityIncident(event);
      }
    });
    
    // MCP server events
    this.mcpServer.on('toolExecuted', (event) => {
      this.emit('mcpToolExecuted', event);
    });
  }
  
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      const metrics = await this.collectMetrics();
      this.emit('metrics', metrics);
      
      // Check if optimization is needed
      if (metrics.overall.performanceScore < 70 && !this.isOptimizing) {
        this.performAutomaticOptimization();
      }
    }, 15000); // Every 15 seconds
  }
  
  async collectMetrics(): Promise<PerformanceMetrics> {
    // Collect memory metrics
    const memoryMetrics = this.memoryManager.getMemoryMetrics();
    
    // Collect cache metrics
    const cacheMetrics = this.cache.getMetrics();
    
    // Collect build metrics
    const buildMetrics = this.buildSystem.getMetrics();
    
    // Collect security metrics
    const securityAudit = await this.securityManager.performSecurityAudit();
    const securitySummary = this.securityManager.getSecuritySummary(1);
    
    // Collect MCP metrics
    const mcpMetrics = this.mcpServer.getMetrics();
    
    // Calculate overall performance score
    const performanceScore = this.calculatePerformanceScore({
      memoryScore: Math.max(0, 100 - (memoryMetrics.heapUsed / (1024 * 1024 * 200)) * 100), // 200MB baseline
      cacheScore: cacheMetrics.totalHitRate,
      buildScore: Math.max(0, 100 - Math.min(buildMetrics.totalTime / 10, 100)), // 10ms = 100% score
      securityScore: securityAudit.score,
      mcpScore: Math.max(0, 100 - (mcpMetrics.averageResponseTime / 10)) // 10ms = 100% score
    });
    
    const optimizationLevel = this.getOptimizationLevel(performanceScore);
    const recommendations = this.generateRecommendations({
      memoryMetrics,
      cacheMetrics,
      buildMetrics,
      securityAudit,
      mcpMetrics
    });
    
    return {
      memory: {
        heapUsed: memoryMetrics.heapUsed,
        heapTotal: memoryMetrics.heapTotal,
        poolUtilization: memoryMetrics.poolUtilization,
        pressureLevel: memoryMetrics.pressureLevel
      },
      cache: {
        hitRate: cacheMetrics.totalHitRate,
        memoryEfficiency: cacheMetrics.memoryEfficiency,
        l1Hits: cacheMetrics.l1.hits,
        l2Hits: cacheMetrics.l2.hits,
        l3Hits: cacheMetrics.l3.hits
      },
      build: {
        lastBuildTime: buildMetrics.totalTime,
        cacheHitRate: buildMetrics.cacheHits / (buildMetrics.cacheHits + buildMetrics.cacheMisses) * 100,
        averageBuildTime: buildMetrics.totalTime
      },
      security: {
        score: securityAudit.score,
        recentEvents: securitySummary.total,
        criticalIssues: securitySummary.bySeverity.critical || 0
      },
      mcp: {
        activeRequests: mcpMetrics.activeRequests,
        toolUsage: mcpMetrics.toolUsage,
        averageResponseTime: mcpMetrics.averageResponseTime
      },
      overall: {
        performanceScore,
        optimizationLevel,
        recommendations
      }
    };
  }
  
  private calculatePerformanceScore(scores: {
    memoryScore: number;
    cacheScore: number;
    buildScore: number;
    securityScore: number;
    mcpScore: number;
  }): number {
    // Weighted average of all scores
    const weights = {
      memory: 0.3,
      cache: 0.2,
      build: 0.2,
      security: 0.2,
      mcp: 0.1
    };
    
    return (
      scores.memoryScore * weights.memory +
      scores.cacheScore * weights.cache +
      scores.buildScore * weights.build +
      scores.securityScore * weights.security +
      scores.mcpScore * weights.mcp
    );
  }
  
  private getOptimizationLevel(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'good';
    if (score >= 70) return 'fair';
    return 'poor';
  }
  
  private generateRecommendations(data: any): string[] {
    const recommendations: string[] = [];
    
    // Memory recommendations
    if (data.memoryMetrics.pressureLevel === 'high' || data.memoryMetrics.pressureLevel === 'critical') {
      recommendations.push('Consider reducing memory usage or increasing heap size');
    }
    if (data.memoryMetrics.poolUtilization > 90) {
      recommendations.push('Memory pool is near capacity, consider expanding');
    }
    
    // Cache recommendations
    if (data.cacheMetrics.totalHitRate < 85) {
      recommendations.push('Cache hit rate is low, review cache keys and TTL settings');
    }
    if (data.cacheMetrics.memoryEfficiency > 300) {
      recommendations.push('Cache memory usage is high, consider compression or cleanup');
    }
    
    // Build recommendations
    if (data.buildMetrics.totalTime > 2000) {
      recommendations.push('Build time is slow, enable parallel compilation and caching');
    }
    
    // Security recommendations
    if (data.securityAudit.score < 80) {
      recommendations.push('Address security issues to improve security score');
    }
    if (data.securityAudit.issues.some((i: any) => i.severity === 'critical')) {
      recommendations.push('Critical security issues detected, immediate action required');
    }
    
    // MCP recommendations
    if (data.mcpMetrics.averageResponseTime > 500) {
      recommendations.push('MCP response times are slow, check tool implementations');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('System is performing optimally');
    }
    
    return recommendations;
  }
  
  private async performEmergencyOptimization(): Promise<void> {
    if (this.isOptimizing) return;
    
    this.isOptimizing = true;
    console.log('🚨 EMERGENCY OPTIMIZATION TRIGGERED');
    
    try {
      // Memory optimization
      const memoryResult = await this.memoryManager.optimize();
      console.log(`Memory optimized: ${(memoryResult.memoryFreed / 1024 / 1024).toFixed(2)}MB freed`);
      
      // Cache optimization
      const cacheResult = await this.cache.optimize();
      console.log(`Cache optimized: ${cacheResult.cacheHitRate.toFixed(1)}% hit rate`);
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      this.emit('emergencyOptimization', {
        memoryFreed: memoryResult.memoryFreed,
        cacheHitRate: cacheResult.cacheHitRate
      });
    } catch (error) {
      console.error('Emergency optimization failed:', error);
    } finally {
      this.isOptimizing = false;
    }
  }
  
  private async performAutomaticOptimization(): Promise<void> {
    if (this.isOptimizing) return;
    
    this.isOptimizing = true;
    console.log('🔧 AUTOMATIC OPTIMIZATION STARTED');
    
    try {
      // Less aggressive optimization
      const memoryResult = await this.memoryManager.optimize();
      const cacheResult = await this.cache.optimize();
      
      this.emit('automaticOptimization', {
        memoryFreed: memoryResult.memoryFreed,
        cacheHitRate: cacheResult.cacheHitRate
      });
    } catch (error) {
      console.error('Automatic optimization failed:', error);
    } finally {
      setTimeout(() => {
        this.isOptimizing = false;
      }, 30000); // Prevent too frequent optimization
    }
  }
  
  private handleSecurityIncident(event: any): void {
    console.warn('🔒 SECURITY INCIDENT DETECTED:', event);
    
    // Could trigger additional security measures here
    this.emit('securityIncident', event);
  }
  
  async startMCPServer(): Promise<void> {
    try {
      await this.mcpServer.start();
      console.log('✅ MCP Server started successfully');
    } catch (error) {
      console.error('❌ Failed to start MCP Server:', error);
      throw error;
    }
  }
  
  async runComprehensiveOptimization(): Promise<PerformanceMetrics> {
    console.log('🚀 RUNNING COMPREHENSIVE OPTIMIZATION...');
    
    this.isOptimizing = true;
    
    try {
      // Step 1: Memory optimization
      console.log('1️⃣ Optimizing memory...');
      const memoryResult = await this.memoryManager.optimize();
      
      // Step 2: Cache optimization
      console.log('2️⃣ Optimizing cache...');
      const cacheResult = await this.cache.optimize();
      
      // Step 3: Security audit
      console.log('3️⃣ Running security audit...');
      const securityAudit = await this.securityManager.performSecurityAudit();
      
      // Step 4: Force cleanup
      console.log('4️⃣ Performing cleanup...');
      if (global.gc) {
        global.gc();
      }
      
      // Step 5: Collect final metrics
      console.log('5️⃣ Collecting metrics...');
      const metrics = await this.collectMetrics();
      
      console.log('✅ COMPREHENSIVE OPTIMIZATION COMPLETE');
      console.log(`📊 Performance Score: ${metrics.overall.performanceScore.toFixed(1)}/100`);
      console.log(`🧠 Memory Freed: ${(memoryResult.memoryFreed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`💾 Cache Hit Rate: ${cacheResult.cacheHitRate.toFixed(1)}%`);
      console.log(`🔒 Security Score: ${securityAudit.score}/100`);
      
      this.emit('comprehensiveOptimization', {
        metrics,
        optimizations: {
          memory: memoryResult,
          cache: cacheResult,
          security: securityAudit
        }
      });
      
      return metrics;
    } catch (error) {
      console.error('Comprehensive optimization failed:', error);
      throw error;
    } finally {
      this.isOptimizing = false;
    }
  }
  
  async validateTargets(): Promise<{
    memoryReduction: { target: number; actual: number; achieved: boolean };
    cacheHitRate: { target: number; actual: number; achieved: boolean };
    buildTime: { target: number; actual: number; achieved: boolean };
    securityScore: { target: number; actual: number; achieved: boolean };
  }> {
    const metrics = await this.collectMetrics();
    
    // Define targets
    const targets = {
      memoryReductionMB: 144, // Target: 180MB → 144MB (20% reduction)
      cacheHitRate: 95, // Target: >95% hit rate
      buildTimeMs: 1000, // Target: <1s builds
      securityScore: 90 // Target: >90 security score
    };
    
    const currentMemoryMB = metrics.memory.heapUsed / 1024 / 1024;
    
    return {
      memoryReduction: {
        target: targets.memoryReductionMB,
        actual: currentMemoryMB,
        achieved: currentMemoryMB <= targets.memoryReductionMB
      },
      cacheHitRate: {
        target: targets.cacheHitRate,
        actual: metrics.cache.hitRate,
        achieved: metrics.cache.hitRate >= targets.cacheHitRate
      },
      buildTime: {
        target: targets.buildTimeMs,
        actual: metrics.build.lastBuildTime,
        achieved: metrics.build.lastBuildTime <= targets.buildTimeMs
      },
      securityScore: {
        target: targets.securityScore,
        actual: metrics.security.score,
        achieved: metrics.security.score >= targets.securityScore
      }
    };
  }
  
  async generateOptimizationReport(): Promise<{
    summary: string;
    metrics: PerformanceMetrics;
    targets: any;
    achievements: string[];
    nextSteps: string[];
  }> {
    const metrics = await this.collectMetrics();
    const targets = await this.validateTargets();
    
    const achievements = [];
    const nextSteps = [];
    
    // Check achievements
    if (targets.memoryReduction.achieved) {
      achievements.push(`✅ Memory optimization: ${targets.memoryReduction.actual.toFixed(1)}MB (target: ${targets.memoryReduction.target}MB)`);
    } else {
      nextSteps.push(`🎯 Reduce memory usage to ${targets.memoryReduction.target}MB (current: ${targets.memoryReduction.actual.toFixed(1)}MB)`);
    }
    
    if (targets.cacheHitRate.achieved) {
      achievements.push(`✅ Cache optimization: ${targets.cacheHitRate.actual.toFixed(1)}% hit rate (target: ${targets.cacheHitRate.target}%)`);
    } else {
      nextSteps.push(`🎯 Improve cache hit rate to ${targets.cacheHitRate.target}% (current: ${targets.cacheHitRate.actual.toFixed(1)}%)`);
    }
    
    if (targets.buildTime.achieved) {
      achievements.push(`✅ Build optimization: ${targets.buildTime.actual.toFixed(0)}ms (target: <${targets.buildTime.target}ms)`);
    } else {
      nextSteps.push(`🎯 Reduce build time to <${targets.buildTime.target}ms (current: ${targets.buildTime.actual.toFixed(0)}ms)`);
    }
    
    if (targets.securityScore.achieved) {
      achievements.push(`✅ Security hardening: ${targets.securityScore.actual}/100 (target: ${targets.securityScore.target}/100)`);
    } else {
      nextSteps.push(`🎯 Improve security score to ${targets.securityScore.target}/100 (current: ${targets.securityScore.actual}/100)`);
    }
    
    const summary = `Performance optimization ${metrics.overall.optimizationLevel.toUpperCase()} - Score: ${metrics.overall.performanceScore.toFixed(1)}/100`;
    
    return {
      summary,
      metrics,
      targets,
      achievements,
      nextSteps
    };
  }
  
  async destroy(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    
    await this.mcpServer.stop();
    this.removeAllListeners();
  }
}

// Export singleton
let performanceIntegratorInstance: PerformanceIntegrator | null = null;

export function getPerformanceIntegrator(): PerformanceIntegrator {
  if (!performanceIntegratorInstance) {
    performanceIntegratorInstance = new PerformanceIntegrator();
  }
  return performanceIntegratorInstance;
}

export async function destroyPerformanceIntegrator(): Promise<void> {
  if (performanceIntegratorInstance) {
    await performanceIntegratorInstance.destroy();
    performanceIntegratorInstance = null;
  }
}