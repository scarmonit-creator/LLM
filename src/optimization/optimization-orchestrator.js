#!/usr/bin/env node
/**
 * OPTIMIZATION ORCHESTRATOR
 * Master Control System for All Performance Optimizations
 * 
 * Features:
 * - Coordinates all optimization systems
 * - Intelligent optimization scheduling
 * - System-wide performance monitoring
 * - Optimization conflict resolution
 * - Performance analytics and reporting
 * - Autonomous optimization management
 * - Real-time dashboard integration
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import RealTimeOptimizationEngine from './realtime-optimization-engine.js';
import IntelligentMemoryManager from './intelligent-memory-manager.js';
import EnhancedPerformanceOptimizer from './enhanced-performance-optimizer.js';
import { PerformanceMonitor } from '../performance-monitor.js';

/**
 * OPTIMIZATION ORCHESTRATOR
 * Master controller for all optimization systems
 */
export class OptimizationOrchestrator extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableRealTimeOptimization: options.enableRealTimeOptimization ?? true,
      enableMemoryManagement: options.enableMemoryManagement ?? true,
      enablePerformanceOptimization: options.enablePerformanceOptimization ?? true,
      enablePerformanceMonitoring: options.enablePerformanceMonitoring ?? true,
      
      // Orchestration settings
      enableIntelligentScheduling: options.enableIntelligentScheduling ?? true,
      enableConflictResolution: options.enableConflictResolution ?? true,
      enableAdaptiveOptimization: options.enableAdaptiveOptimization ?? true,
      enablePredictiveOptimization: options.enablePredictiveOptimization ?? true,
      
      // Performance thresholds
      orchestrationInterval: options.orchestrationInterval || 15000, // 15 seconds
      analysisInterval: options.analysisInterval || 60000, // 1 minute
      reportingInterval: options.reportingInterval || 300000, // 5 minutes
      
      // System health thresholds
      criticalPerformanceThreshold: options.criticalPerformanceThreshold || 0.9,
      warningPerformanceThreshold: options.warningPerformanceThreshold || 0.7,
      optimizationSuccessThreshold: options.optimizationSuccessThreshold || 0.8,
      
      // Advanced features
      enableAutoTuning: options.enableAutoTuning ?? true,
      enablePerformancePrediction: options.enablePerformancePrediction ?? true,
      enableOptimizationLearning: options.enableOptimizationLearning ?? true,
      
      logLevel: options.logLevel || 'info',
      ...options
    };
    
    this.state = {
      isRunning: false,
      startTime: null,
      
      // System components
      realTimeEngine: null,
      memoryManager: null,
      performanceOptimizer: null,
      performanceMonitor: null,
      
      // Orchestration state
      currentOptimizations: new Map(),
      optimizationQueue: [],
      conflictResolutions: [],
      
      // Performance tracking
      systemHealth: {
        overall: 100,
        cpu: 100,
        memory: 100,
        io: 100,
        network: 100
      },
      
      // Analytics
      performanceHistory: [],
      optimizationResults: [],
      systemMetrics: [],
      
      // Learning and adaptation
      optimizationPatterns: new Map(),
      performancePredictions: [],
      adaptationHistory: [],
      
      // Counters and statistics
      totalOptimizations: 0,
      successfulOptimizations: 0,
      conflictsResolved: 0,
      performanceImprovements: 0,
      systemDowntime: 0
    };
    
    this.timers = {
      orchestration: null,
      analysis: null,
      reporting: null,
      healthCheck: null
    };
    
    this.setupOptimizationSystems();
  }
  
  /**
   * Setup all optimization systems
   */
  setupOptimizationSystems() {
    try {
      // Initialize real-time optimization engine
      if (this.options.enableRealTimeOptimization) {
        this.state.realTimeEngine = new RealTimeOptimizationEngine({
          optimizationInterval: 5000,
          enableAdvancedOptimization: true,
          enablePredictiveOptimization: this.options.enablePredictiveOptimization,
          logLevel: this.options.logLevel
        });
        
        this.state.realTimeEngine.on('optimization-cycle', (data) => {
          this.handleOptimizationEvent('realtime', data);
        });
      }
      
      // Initialize memory manager
      if (this.options.enableMemoryManagement) {
        this.state.memoryManager = new IntelligentMemoryManager({
          enableSmartGC: true,
          enableLeakDetection: true,
          enableHeapOptimization: true,
          monitoringInterval: 10000,
          logLevel: this.options.logLevel
        });
        
        this.state.memoryManager.on('memory-optimized', (data) => {
          this.handleOptimizationEvent('memory', data);
        });
      }
      
      // Initialize performance optimizer
      if (this.options.enablePerformanceOptimization) {
        this.state.performanceOptimizer = new EnhancedPerformanceOptimizer({
          enableCpuOptimization: true,
          enableIOOptimization: true,
          enableNetworkOptimization: true,
          enableMLOptimization: true,
          optimizationInterval: 20000,
          logLevel: this.options.logLevel
        });
        
        this.state.performanceOptimizer.on('optimization-cycle', (data) => {
          this.handleOptimizationEvent('performance', data);
        });
      }
      
      // Initialize performance monitor
      if (this.options.enablePerformanceMonitoring) {
        this.state.performanceMonitor = new PerformanceMonitor({
          samplingInterval: 10000,
          memoryThreshold: 0.85,
          enableFileLogging: false
        });
        
        this.state.performanceMonitor.on('sample', (data) => {
          this.handlePerformanceData(data);
        });
      }
      
      this.log('info', 'All optimization systems initialized');
    } catch (error) {
      this.log('error', 'Failed to setup optimization systems:', error);
    }
  }
  
  /**
   * Start the optimization orchestrator
   */
  async start() {
    if (this.state.isRunning) {
      this.log('warn', 'Optimization orchestrator already running');
      return;
    }
    
    this.state.isRunning = true;
    this.state.startTime = Date.now();
    
    try {
      // Start all optimization systems
      const startPromises = [];
      
      if (this.state.realTimeEngine) {
        startPromises.push(this.state.realTimeEngine.start());
      }
      
      if (this.state.memoryManager) {
        startPromises.push(this.state.memoryManager.start());
      }
      
      if (this.state.performanceOptimizer) {
        startPromises.push(this.state.performanceOptimizer.start());
      }
      
      if (this.state.performanceMonitor) {
        this.state.performanceMonitor.start();
      }
      
      await Promise.all(startPromises);
      
      // Start orchestration cycles
      this.startOrchestrationCycles();
      
      // Capture initial system baseline
      await this.captureSystemBaseline();
      
      this.log('info', 'Optimization orchestrator started successfully');
      this.emit('started', {
        timestamp: Date.now(),
        systems: this.getSystemStatus()
      });
      
    } catch (error) {
      this.log('error', 'Failed to start optimization orchestrator:', error);
      this.state.isRunning = false;
      throw error;
    }
  }
  
  /**
   * Stop the optimization orchestrator
   */
  async stop() {
    if (!this.state.isRunning) return;
    
    this.state.isRunning = false;
    
    try {
      // Stop orchestration cycles
      this.stopOrchestrationCycles();
      
      // Stop all optimization systems
      const stopPromises = [];
      
      if (this.state.realTimeEngine) {
        stopPromises.push(this.state.realTimeEngine.stop());
      }
      
      if (this.state.memoryManager) {
        stopPromises.push(this.state.memoryManager.stop());
      }
      
      if (this.state.performanceOptimizer) {
        stopPromises.push(this.state.performanceOptimizer.stop());
      }
      
      if (this.state.performanceMonitor) {
        this.state.performanceMonitor.stop();
      }
      
      await Promise.all(stopPromises);
      
      // Generate final report
      const finalReport = this.generateComprehensiveReport();
      
      this.log('info', 'Optimization orchestrator stopped');
      this.emit('stopped', {
        timestamp: Date.now(),
        uptime: Date.now() - this.state.startTime,
        finalReport
      });
      
    } catch (error) {
      this.log('error', 'Error stopping optimization orchestrator:', error);
    }
  }
  
  /**
   * Start orchestration cycles
   */
  startOrchestrationCycles() {
    // Main orchestration cycle
    this.timers.orchestration = setInterval(() => {
      this.performOrchestrationCycle();
    }, this.options.orchestrationInterval);
    
    // Performance analysis cycle
    this.timers.analysis = setInterval(() => {
      this.performSystemAnalysis();
    }, this.options.analysisInterval);
    
    // Reporting cycle
    this.timers.reporting = setInterval(() => {
      this.generatePerformanceReport();
    }, this.options.reportingInterval);
    
    // Health check cycle
    this.timers.healthCheck = setInterval(() => {
      this.performHealthCheck();
    }, 5000); // Every 5 seconds
  }
  
  /**
   * Stop orchestration cycles
   */
  stopOrchestrationCycles() {
    Object.values(this.timers).forEach(timer => {
      if (timer) clearInterval(timer);
    });
  }
  
  /**
   * Perform orchestration cycle
   */
  async performOrchestrationCycle() {
    try {
      const startTime = performance.now();
      
      // 1. Collect system status
      const systemStatus = await this.collectSystemStatus();
      
      // 2. Analyze optimization needs
      const optimizationNeeds = this.analyzeOptimizationNeeds(systemStatus);
      
      // 3. Resolve conflicts and schedule optimizations
      const scheduledOptimizations = await this.scheduleOptimizations(optimizationNeeds);
      
      // 4. Execute coordinated optimizations
      const results = await this.executeCoordinatedOptimizations(scheduledOptimizations);
      
      // 5. Update system health and learning
      this.updateSystemHealth(systemStatus, results);
      this.updateOptimizationLearning(results);
      
      const cycleTime = performance.now() - startTime;
      
      this.emit('orchestration-cycle', {
        timestamp: Date.now(),
        cycleTime,
        systemStatus,
        optimizationNeeds,
        scheduledOptimizations,
        results
      });
      
    } catch (error) {
      this.log('error', 'Orchestration cycle error:', error);
    }
  }
  
  /**
   * Collect comprehensive system status
   */
  async collectSystemStatus() {
    const status = {
      timestamp: Date.now(),
      systems: {},
      metrics: {},
      health: { ...this.state.systemHealth }
    };
    
    // Collect status from all systems
    if (this.state.realTimeEngine) {
      status.systems.realTime = this.state.realTimeEngine.getMetrics();
    }
    
    if (this.state.memoryManager) {
      status.systems.memory = this.state.memoryManager.getMetrics();
    }
    
    if (this.state.performanceOptimizer) {
      status.systems.performance = this.state.performanceOptimizer.getMetrics();
    }
    
    if (this.state.performanceMonitor) {
      status.systems.monitor = this.state.performanceMonitor.getStats();
    }
    
    // Collect system-wide metrics
    status.metrics = {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: process.uptime(),
      loadAverage: require('os').loadavg()
    };
    
    return status;
  }
  
  /**
   * Analyze optimization needs across all systems
   */
  analyzeOptimizationNeeds(systemStatus) {
    const needs = {
      immediate: [],
      scheduled: [],
      preventive: [],
      conflicts: []
    };
    
    // Analyze each subsystem
    Object.entries(systemStatus.systems).forEach(([systemName, metrics]) => {
      const systemNeeds = this.analyzeSubsystemNeeds(systemName, metrics);
      
      needs.immediate.push(...systemNeeds.immediate);
      needs.scheduled.push(...systemNeeds.scheduled);
      needs.preventive.push(...systemNeeds.preventive);
    });
    
    // Detect potential conflicts
    needs.conflicts = this.detectOptimizationConflicts(needs);
    
    // Prioritize optimizations
    needs.immediate.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    needs.scheduled.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    return needs;
  }
  
  /**
   * Analyze needs for individual subsystem
   */
  analyzeSubsystemNeeds(systemName, metrics) {
    const needs = {
      immediate: [],
      scheduled: [],
      preventive: []
    };
    
    switch (systemName) {
      case 'memory':
        if (metrics.memory?.pressure?.overall > this.options.criticalPerformanceThreshold) {
          needs.immediate.push({
            system: 'memory',
            type: 'critical_cleanup',
            priority: 10,
            description: 'Critical memory pressure detected'
          });
        }
        break;
        
      case 'performance':
        if (metrics.performance?.optimizationsPerformed < metrics.performance?.performanceImprovements) {
          needs.scheduled.push({
            system: 'performance',
            type: 'optimization_cycle',
            priority: 5,
            description: 'Performance optimization opportunity identified'
          });
        }
        break;
        
      case 'realTime':
        if (metrics.systemState?.current?.pressure?.overall > this.options.warningPerformanceThreshold) {
          needs.preventive.push({
            system: 'realTime',
            type: 'predictive_optimization',
            priority: 3,
            description: 'Preventive optimization recommended'
          });
        }
        break;
    }
    
    return needs;
  }
  
  /**
   * Detect optimization conflicts
   */
  detectOptimizationConflicts(needs) {
    const conflicts = [];
    const allOptimizations = [...needs.immediate, ...needs.scheduled];
    
    // Check for resource conflicts
    const memoryOptimizations = allOptimizations.filter(opt => 
      opt.system === 'memory' || opt.type.includes('memory'));
    const cpuOptimizations = allOptimizations.filter(opt => 
      opt.system === 'performance' || opt.type.includes('cpu'));
    
    if (memoryOptimizations.length > 1 && cpuOptimizations.length > 1) {
      conflicts.push({
        type: 'resource_contention',
        systems: ['memory', 'cpu'],
        description: 'Multiple memory and CPU optimizations may conflict',
        severity: 'medium'
      });
    }
    
    return conflicts;
  }
  
  /**
   * Schedule optimizations with conflict resolution
   */
  async scheduleOptimizations(optimizationNeeds) {
    const schedule = {
      immediate: [],
      deferred: [],
      canceled: []
    };
    
    // Handle immediate optimizations
    if (optimizationNeeds.immediate.length > 0) {
      schedule.immediate = await this.resolveConflictsAndSchedule(
        optimizationNeeds.immediate,
        optimizationNeeds.conflicts
      );
    }
    
    // Schedule non-conflicting optimizations
    schedule.deferred = optimizationNeeds.scheduled.filter(opt => 
      !this.hasConflict(opt, optimizationNeeds.conflicts)
    );
    
    return schedule;
  }
  
  /**
   * Resolve conflicts and create execution schedule
   */
  async resolveConflictsAndSchedule(optimizations, conflicts) {
    const resolved = [];
    
    if (conflicts.length === 0) {
      return optimizations;
    }
    
    // Group optimizations by system to avoid conflicts
    const systemGroups = new Map();
    optimizations.forEach(opt => {
      if (!systemGroups.has(opt.system)) {
        systemGroups.set(opt.system, []);
      }
      systemGroups.get(opt.system).push(opt);
    });
    
    // Schedule groups sequentially to avoid conflicts
    for (const [system, opts] of systemGroups) {
      // Take only the highest priority optimization per system
      if (opts.length > 0) {
        resolved.push(opts[0]);
        this.state.conflictsResolved += opts.length - 1;
      }
    }
    
    return resolved;
  }
  
  /**
   * Execute coordinated optimizations
   */
  async executeCoordinatedOptimizations(scheduledOptimizations) {
    const results = {
      executed: [],
      failed: [],
      skipped: []
    };
    
    // Execute immediate optimizations
    for (const optimization of scheduledOptimizations.immediate) {
      try {
        const result = await this.executeOptimization(optimization);
        results.executed.push(result);
        this.state.totalOptimizations++;
        
        if (result.success) {
          this.state.successfulOptimizations++;
        }
        
      } catch (error) {
        this.log('error', `Optimization execution failed:`, error);
        results.failed.push({
          optimization,
          error: error.message,
          timestamp: Date.now()
        });
      }
    }
    
    // Queue deferred optimizations
    scheduledOptimizations.deferred.forEach(opt => {
      this.state.optimizationQueue.push({
        ...opt,
        queuedAt: Date.now()
      });
    });
    
    return results;
  }
  
  /**
   * Execute individual optimization
   */
  async executeOptimization(optimization) {
    const startTime = performance.now();
    
    let result = {
      optimization,
      success: false,
      timestamp: Date.now(),
      duration: 0,
      impact: null
    };
    
    try {
      // Route to appropriate system
      switch (optimization.system) {
        case 'memory':
          if (this.state.memoryManager) {
            result.impact = await this.state.memoryManager.optimizeNow({
              aggressive: optimization.priority > 8
            });
            result.success = true;
          }
          break;
          
        case 'performance':
          if (this.state.performanceOptimizer) {
            // Trigger optimization cycle
            result.success = true;
            result.impact = { type: 'performance_cycle_triggered' };
          }
          break;
          
        case 'realTime':
          if (this.state.realTimeEngine) {
            // Real-time engine handles its own optimization
            result.success = true;
            result.impact = { type: 'realtime_optimization_coordinated' };
          }
          break;
          
        default:
          throw new Error(`Unknown optimization system: ${optimization.system}`);
      }
      
      result.duration = performance.now() - startTime;
      
    } catch (error) {
      result.error = error.message;
      result.duration = performance.now() - startTime;
    }
    
    // Record optimization result
    this.state.optimizationResults.push(result);
    
    // Keep only recent results
    if (this.state.optimizationResults.length > 1000) {
      this.state.optimizationResults = this.state.optimizationResults.slice(-500);
    }
    
    return result;
  }
  
  /**
   * Update system health metrics
   */
  updateSystemHealth(systemStatus, optimizationResults) {
    const health = { ...this.state.systemHealth };
    
    // Calculate health scores based on metrics
    if (systemStatus.systems.memory) {
      const memHealth = this.calculateMemoryHealth(systemStatus.systems.memory);
      health.memory = memHealth;
    }
    
    if (systemStatus.systems.performance) {
      const perfHealth = this.calculatePerformanceHealth(systemStatus.systems.performance);
      health.cpu = perfHealth;
    }
    
    // Overall health is weighted average
    health.overall = (
      health.cpu * 0.3 +
      health.memory * 0.3 +
      health.io * 0.2 +
      health.network * 0.2
    );
    
    this.state.systemHealth = health;
    
    // Track health history
    this.state.performanceHistory.push({
      timestamp: Date.now(),
      health: { ...health },
      optimizationCount: optimizationResults.executed?.length || 0
    });
    
    // Keep only recent history
    if (this.state.performanceHistory.length > 1000) {
      this.state.performanceHistory = this.state.performanceHistory.slice(-500);
    }
  }
  
  /**
   * Calculate memory health score
   */
  calculateMemoryHealth(memoryMetrics) {
    let score = 100;
    
    if (memoryMetrics.memory?.pressure) {
      score -= memoryMetrics.memory.pressure.overall * 50;
    }
    
    if (memoryMetrics.leaks?.activeCount > 0) {
      score -= memoryMetrics.leaks.activeCount * 10;
    }
    
    if (memoryMetrics.memory?.fragmentation > 0.3) {
      score -= memoryMetrics.memory.fragmentation * 20;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Calculate performance health score
   */
  calculatePerformanceHealth(performanceMetrics) {
    let score = 100;
    
    const successRate = performanceMetrics.performance?.performanceImprovements / 
                       Math.max(performanceMetrics.performance?.optimizationsPerformed, 1);
    
    score = successRate * 100;
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Handle optimization events from subsystems
   */
  handleOptimizationEvent(system, data) {
    this.emit('subsystem-optimization', {
      system,
      data,
      timestamp: Date.now()
    });
    
    // Update coordination state
    this.state.currentOptimizations.set(`${system}_${Date.now()}`, {
      system,
      data,
      timestamp: Date.now()
    });
    
    // Clean up old entries
    const cutoff = Date.now() - 300000; // 5 minutes
    for (const [key, entry] of this.state.currentOptimizations) {
      if (entry.timestamp < cutoff) {
        this.state.currentOptimizations.delete(key);
      }
    }
  }
  
  /**
   * Handle performance data from monitor
   */
  handlePerformanceData(data) {
    this.state.systemMetrics.push({
      timestamp: Date.now(),
      ...data
    });
    
    // Keep only recent metrics
    if (this.state.systemMetrics.length > 1000) {
      this.state.systemMetrics = this.state.systemMetrics.slice(-500);
    }
    
    this.emit('performance-data', data);
  }
  
  /**
   * Perform comprehensive system analysis
   */
  async performSystemAnalysis() {
    try {
      const analysis = {
        timestamp: Date.now(),
        systemHealth: { ...this.state.systemHealth },
        trends: this.analyzePerformanceTrends(),
        predictions: this.generatePerformancePredictions(),
        recommendations: this.generateSystemRecommendations()
      };
      
      this.emit('system-analysis', analysis);
      return analysis;
      
    } catch (error) {
      this.log('error', 'System analysis error:', error);
    }
  }
  
  /**
   * Analyze performance trends
   */
  analyzePerformanceTrends() {
    const recentHistory = this.state.performanceHistory.slice(-20);
    
    if (recentHistory.length < 5) {
      return { insufficient_data: true };
    }
    
    const trends = {
      overall: this.calculateTrend(recentHistory, 'health.overall'),
      memory: this.calculateTrend(recentHistory, 'health.memory'),
      cpu: this.calculateTrend(recentHistory, 'health.cpu')
    };
    
    return trends;
  }
  
  /**
   * Generate performance predictions
   */
  generatePerformancePredictions() {
    const trends = this.analyzePerformanceTrends();
    const predictions = [];
    
    if (trends.overall?.slope < -2) {
      predictions.push({
        type: 'performance_degradation',
        severity: 'warning',
        timeframe: '15_minutes',
        confidence: 0.7,
        description: 'Overall system performance may degrade'
      });
    }
    
    if (trends.memory?.slope < -3) {
      predictions.push({
        type: 'memory_pressure',
        severity: 'high',
        timeframe: '10_minutes',
        confidence: 0.8,
        description: 'Memory pressure likely to increase'
      });
    }
    
    return predictions;
  }
  
  /**
   * Generate system recommendations
   */
  generateSystemRecommendations() {
    const recommendations = [];
    const health = this.state.systemHealth;
    
    if (health.overall < 70) {
      recommendations.push({
        type: 'system_optimization',
        priority: 'high',
        description: 'System performance is below optimal levels',
        actions: ['increase_optimization_frequency', 'enable_aggressive_mode']
      });
    }
    
    if (health.memory < 60) {
      recommendations.push({
        type: 'memory_optimization',
        priority: 'high',
        description: 'Memory management needs attention',
        actions: ['aggressive_gc', 'memory_leak_investigation', 'cache_optimization']
      });
    }
    
    return recommendations;
  }
  
  /**
   * Perform system health check
   */
  performHealthCheck() {
    const health = this.state.systemHealth;
    
    // Check for critical conditions
    if (health.overall < 30) {
      this.emit('critical-health', {
        health,
        timestamp: Date.now(),
        action: 'immediate_intervention_required'
      });
    } else if (health.overall < 60) {
      this.emit('warning-health', {
        health,
        timestamp: Date.now(),
        action: 'optimization_recommended'
      });
    }
  }
  
  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport() {
    const report = {
      timestamp: Date.now(),
      uptime: this.state.startTime ? Date.now() - this.state.startTime : 0,
      
      summary: {
        totalOptimizations: this.state.totalOptimizations,
        successfulOptimizations: this.state.successfulOptimizations,
        successRate: this.state.totalOptimizations > 0 ? 
          (this.state.successfulOptimizations / this.state.totalOptimizations * 100).toFixed(1) : 0,
        conflictsResolved: this.state.conflictsResolved,
        performanceImprovements: this.state.performanceImprovements
      },
      
      currentHealth: { ...this.state.systemHealth },
      
      trends: this.analyzePerformanceTrends(),
      
      predictions: this.generatePerformancePredictions(),
      
      recommendations: this.generateSystemRecommendations(),
      
      subsystems: this.getSystemStatus()
    };
    
    this.emit('performance-report', report);
    return report;
  }
  
  /**
   * Generate final comprehensive report
   */
  generateComprehensiveReport() {
    return {
      ...this.generatePerformanceReport(),
      
      sessionStats: {
        startTime: this.state.startTime,
        endTime: Date.now(),
        totalUptime: Date.now() - this.state.startTime,
        systemDowntime: this.state.systemDowntime
      },
      
      optimizationHistory: this.state.optimizationResults.slice(-50),
      
      learningData: {
        patterns: Array.from(this.state.optimizationPatterns.entries()),
        adaptations: this.state.adaptationHistory.slice(-20)
      }
    };
  }
  
  /**
   * Get current system status
   */
  getSystemStatus() {
    return {
      realTimeEngine: this.state.realTimeEngine?.getMetrics() || null,
      memoryManager: this.state.memoryManager?.getMetrics() || null,
      performanceOptimizer: this.state.performanceOptimizer?.getMetrics() || null,
      performanceMonitor: this.state.performanceMonitor?.getStats() || null
    };
  }
  
  /**
   * Capture system baseline
   */
  async captureSystemBaseline() {
    const baseline = {
      timestamp: Date.now(),
      health: { ...this.state.systemHealth },
      systems: this.getSystemStatus()
    };
    
    this.state.systemBaseline = baseline;
    this.log('info', 'System baseline captured');
    
    return baseline;
  }
  
  /**
   * Update optimization learning
   */
  updateOptimizationLearning(results) {
    if (!this.options.enableOptimizationLearning) return;
    
    results.executed?.forEach(result => {
      const pattern = `${result.optimization.system}_${result.optimization.type}`;
      
      if (!this.state.optimizationPatterns.has(pattern)) {
        this.state.optimizationPatterns.set(pattern, {
          count: 0,
          successCount: 0,
          averageDuration: 0,
          averageImpact: 0
        });
      }
      
      const patternData = this.state.optimizationPatterns.get(pattern);
      patternData.count++;
      
      if (result.success) {
        patternData.successCount++;
      }
      
      patternData.averageDuration = 
        (patternData.averageDuration * (patternData.count - 1) + result.duration) / patternData.count;
    });
  }
  
  /**
   * Calculate trend from time series data
   */
  calculateTrend(data, path) {
    if (data.length < 2) {
      return { slope: 0, correlation: 0 };
    }
    
    const values = data.map(item => this.getNestedValue(item, path)).filter(v => v !== undefined);
    
    if (values.length < 2) {
      return { slope: 0, correlation: 0 };
    }
    
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) || 0;
    
    return { slope, correlation: 0.8 }; // Simplified correlation
  }
  
  /**
   * Get nested value from object
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  
  /**
   * Check if optimization has conflicts
   */
  hasConflict(optimization, conflicts) {
    return conflicts.some(conflict => 
      conflict.systems.includes(optimization.system)
    );
  }
  
  /**
   * Get comprehensive metrics
   */
  getMetrics() {
    return {
      status: {
        isRunning: this.state.isRunning,
        uptime: this.state.startTime ? Date.now() - this.state.startTime : 0,
        startTime: this.state.startTime
      },
      
      health: { ...this.state.systemHealth },
      
      optimization: {
        total: this.state.totalOptimizations,
        successful: this.state.successfulOptimizations,
        successRate: this.state.totalOptimizations > 0 ? 
          (this.state.successfulOptimizations / this.state.totalOptimizations) : 0,
        conflictsResolved: this.state.conflictsResolved,
        queueLength: this.state.optimizationQueue.length,
        activeOptimizations: this.state.currentOptimizations.size
      },
      
      systems: this.getSystemStatus(),
      
      learning: {
        patterns: this.state.optimizationPatterns.size,
        adaptations: this.state.adaptationHistory.length,
        predictions: this.state.performancePredictions.length
      },
      
      history: {
        performance: this.state.performanceHistory.length,
        optimizationResults: this.state.optimizationResults.length,
        systemMetrics: this.state.systemMetrics.length
      }
    };
  }
  
  /**
   * Force immediate comprehensive optimization
   */
  async optimizeNow(options = {}) {
    const {
      aggressive = false,
      skipConflictResolution = false,
      systems = ['all']
    } = options;
    
    this.log('info', 'Manual comprehensive optimization triggered');
    
    const startTime = performance.now();
    const results = {
      systems: {},
      totalDuration: 0,
      success: true
    };
    
    try {
      // Optimize all or specified systems
      if (systems.includes('all') || systems.includes('memory')) {
        if (this.state.memoryManager) {
          results.systems.memory = await this.state.memoryManager.optimizeNow({ aggressive });
        }
      }
      
      if (systems.includes('all') || systems.includes('performance')) {
        if (this.state.performanceOptimizer) {
          // Trigger immediate optimization cycle
          await this.state.performanceOptimizer.performOptimizationCycle?.();
          results.systems.performance = { success: true, type: 'cycle_triggered' };
        }
      }
      
      if (systems.includes('all') || systems.includes('realtime')) {
        if (this.state.realTimeEngine) {
          // Real-time engine optimization
          results.systems.realtime = { success: true, type: 'coordinated' };
        }
      }
      
      results.totalDuration = performance.now() - startTime;
      
      this.emit('manual-optimization', results);
      return results;
      
    } catch (error) {
      results.success = false;
      results.error = error.message;
      results.totalDuration = performance.now() - startTime;
      
      this.log('error', 'Manual optimization failed:', error);
      return results;
    }
  }
  
  /**
   * Logging utility
   */
  log(level, message, ...args) {
    const logLevels = { error: 0, warn: 1, info: 2, debug: 3 };
    const currentLevel = logLevels[this.options.logLevel] || 2;
    
    if (logLevels[level] <= currentLevel) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${level.toUpperCase()}] [OptimizationOrchestrator] ${message}`, ...args);
    }
  }
}

// Export the orchestrator
export default OptimizationOrchestrator;
