/**
 * Memory Leak Detector - Advanced Memory Management System
 * Detects and prevents memory leaks with real-time monitoring
 */

import { EventEmitter } from 'events';

export class MemoryLeakDetector extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      samplingInterval: options.samplingInterval || 5000, // 5 seconds
      memoryThreshold: options.memoryThreshold || 0.85, // 85%
      growthThreshold: options.growthThreshold || 0.1, // 10% growth
      maxSamples: options.maxSamples || 100,
      enableGC: options.enableGC || true,
      enableDetection: options.enableDetection !== false,
      ...options
    };
    
    this.samples = [];
    this.isRunning = false;
    this.intervalId = null;
    this.leaks = [];
    this.metrics = {
      samplesCollected: 0,
      leaksDetected: 0,
      gcTriggered: 0,
      memoryReclaimed: 0
    };
  }
  
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[MemoryLeakDetector] Starting memory leak detection...');
    
    this.intervalId = setInterval(() => {
      this.collectSample();
    }, this.options.samplingInterval);
    
    this.emit('started');
  }
  
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    console.log('[MemoryLeakDetector] Stopped memory leak detection');
    this.emit('stopped');
  }
  
  collectSample() {
    if (!this.options.enableDetection) return;
    
    const memory = process.memoryUsage();
    const sample = {
      timestamp: Date.now(),
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      external: memory.external,
      rss: memory.rss,
      pressure: memory.heapUsed / memory.heapTotal
    };
    
    this.samples.push(sample);
    this.metrics.samplesCollected++;
    
    // Keep only recent samples
    if (this.samples.length > this.options.maxSamples) {
      this.samples.shift();
    }
    
    this.analyzeSample(sample);
  }
  
  analyzeSample(currentSample) {
    if (this.samples.length < 3) return; // Need at least 3 samples
    
    const previousSample = this.samples[this.samples.length - 2];
    const growthRate = (currentSample.heapUsed - previousSample.heapUsed) / previousSample.heapUsed;
    
    // Check for memory pressure
    if (currentSample.pressure > this.options.memoryThreshold) {
      this.handleMemoryPressure(currentSample);
    }
    
    // Check for sustained growth
    if (growthRate > this.options.growthThreshold) {
      this.detectPotentialLeak(currentSample, growthRate);
    }
    
    // Analyze trends
    this.analyzeTrends();
  }
  
  handleMemoryPressure(sample) {
    console.warn(`[MemoryLeakDetector] High memory pressure detected: ${Math.round(sample.pressure * 100)}%`);
    
    if (this.options.enableGC && global.gc) {
      try {
        const beforeGC = process.memoryUsage().heapUsed;
        global.gc();
        const afterGC = process.memoryUsage().heapUsed;
        const reclaimed = beforeGC - afterGC;
        
        this.metrics.gcTriggered++;
        this.metrics.memoryReclaimed += reclaimed;
        
        console.log(`[MemoryLeakDetector] GC triggered, reclaimed ${Math.round(reclaimed / 1024 / 1024)}MB`);
        this.emit('gc-triggered', { reclaimed, beforeGC, afterGC });
      } catch (error) {
        console.error('[MemoryLeakDetector] GC trigger failed:', error);
      }
    }
    
    this.emit('memory-pressure', sample);
  }
  
  detectPotentialLeak(sample, growthRate) {
    const leak = {
      timestamp: sample.timestamp,
      heapUsed: sample.heapUsed,
      growthRate,
      severity: this.calculateSeverity(growthRate, sample.pressure)
    };
    
    this.leaks.push(leak);
    this.metrics.leaksDetected++;
    
    console.warn(`[MemoryLeakDetector] Potential memory leak detected: ${Math.round(growthRate * 100)}% growth`);
    this.emit('potential-leak', leak);
  }
  
  calculateSeverity(growthRate, pressure) {
    const growthScore = Math.min(growthRate * 10, 10);
    const pressureScore = Math.min(pressure * 10, 10);
    return (growthScore + pressureScore) / 2;
  }
  
  getReport() {
    const currentMemory = process.memoryUsage();
    
    return {
      status: this.isRunning ? 'active' : 'stopped',
      current: {
        memory: currentMemory,
        pressure: currentMemory.heapUsed / currentMemory.heapTotal,
        timestamp: Date.now()
      },
      metrics: { ...this.metrics },
      recentLeaks: this.leaks.slice(-5),
      health: {
        score: this.calculateHealthScore(),
        status: this.getHealthStatus()
      }
    };
  }
  
  calculateHealthScore() {
    const currentMemory = process.memoryUsage();
    const pressure = currentMemory.heapUsed / currentMemory.heapTotal;
    let score = 100;
    
    // Deduct for memory pressure
    if (pressure > 0.8) score -= 30;
    else if (pressure > 0.6) score -= 15;
    else if (pressure > 0.4) score -= 5;
    
    // Deduct for recent leaks
    const recentLeaks = this.leaks.filter(l => Date.now() - l.timestamp < 300000); // 5 minutes
    score -= recentLeaks.length * 10;
    
    return Math.max(0, Math.min(100, score));
  }
  
  getHealthStatus() {
    const score = this.calculateHealthScore();
    
    if (score >= 80) return 'healthy';
    if (score >= 60) return 'warning';
    if (score >= 30) return 'critical';
    return 'unhealthy';
  }
}

export default MemoryLeakDetector;