/**
 * Advanced Memory Manager
 * 
 * Implements next-generation memory optimization with:
 * - Memory pool management for high-frequency allocations
 * - Lazy loading for AI model components
 * - Generational garbage collection optimization
 * - Real-time memory pressure monitoring
 * - 20% memory reduction target (180MB → 144MB)
 */

import { EventEmitter } from 'events';
import { performance, PerformanceObserver } from 'perf_hooks';

export interface MemoryPoolConfig {
  poolSize: number;
  blockSize: number;
  maxBlocks: number;
  autoCleanup: boolean;
  pressureThreshold: number;
}

export interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  poolUtilization: number;
  gcEvents: number;
  pressureLevel: 'low' | 'medium' | 'high' | 'critical';
  lastCleanup: number;
}

class MemoryPool {
  private blocks: ArrayBuffer[] = [];
  private freeBlocks: Set<number> = new Set();
  private usedBlocks: Map<number, { allocated: number; purpose: string }> = new Map();
  private config: MemoryPoolConfig;

  constructor(config: MemoryPoolConfig) {
    this.config = config;
    this.initializePool();
  }

  private initializePool(): void {
    // Pre-allocate memory blocks to reduce GC pressure
    for (let i = 0; i < this.config.poolSize; i++) {
      const buffer = new ArrayBuffer(this.config.blockSize);
      this.blocks.push(buffer);
      this.freeBlocks.add(i);
    }
  }

  allocate(size: number, purpose: string = 'general'): ArrayBuffer | null {
    if (size > this.config.blockSize) {
      // For large allocations, use regular allocation
      return new ArrayBuffer(size);
    }

    if (this.freeBlocks.size === 0) {
      if (this.blocks.length < this.config.maxBlocks) {
        // Expand pool if under limit
        const newIndex = this.blocks.length;
        const buffer = new ArrayBuffer(this.config.blockSize);
        this.blocks.push(buffer);
        this.usedBlocks.set(newIndex, { allocated: Date.now(), purpose });
        return buffer;
      }
      return null; // Pool exhausted
    }

    const blockIndex = this.freeBlocks.values().next().value;
    this.freeBlocks.delete(blockIndex);
    this.usedBlocks.set(blockIndex, { allocated: Date.now(), purpose });
    
    return this.blocks[blockIndex];
  }

  deallocate(buffer: ArrayBuffer): boolean {
    const index = this.blocks.indexOf(buffer);
    if (index === -1) return false;

    this.usedBlocks.delete(index);
    this.freeBlocks.add(index);
    return true;
  }

  getUtilization(): number {
    return (this.usedBlocks.size / this.blocks.length) * 100;
  }

  cleanup(maxAge: number = 300000): number { // 5 minutes default
    const now = Date.now();
    let freed = 0;

    for (const [index, info] of this.usedBlocks.entries()) {
      if (now - info.allocated > maxAge) {
        this.usedBlocks.delete(index);
        this.freeBlocks.add(index);
        freed++;
      }
    }

    return freed;
  }
}

class LazyComponentLoader {
  private components: Map<string, any> = new Map();
  private loadPromises: Map<string, Promise<any>> = new Map();
  private componentConfigs: Map<string, { path: string; size: number }> = new Map();

  constructor() {
    // Register AI components for lazy loading
    this.registerComponent('claude-client', { path: './clients/claude-client', size: 2048000 }); // ~2MB
    this.registerComponent('ollama-client', { path: './clients/ollama-client', size: 1536000 }); // ~1.5MB
    this.registerComponent('rag-engine', { path: './rag/rag-engine', size: 3072000 }); // ~3MB
    this.registerComponent('browser-history', { path: './tools/browser-history', size: 1024000 }); // ~1MB
  }

  private registerComponent(name: string, config: { path: string; size: number }): void {
    this.componentConfigs.set(name, config);
  }

  async loadComponent<T = any>(name: string): Promise<T> {
    // Return cached component if already loaded
    if (this.components.has(name)) {
      return this.components.get(name);
    }

    // Return existing promise if already loading
    if (this.loadPromises.has(name)) {
      return this.loadPromises.get(name);
    }

    const config = this.componentConfigs.get(name);
    if (!config) {
      throw new Error(`Component ${name} not registered`);
    }

    // Create loading promise
    const loadPromise = this.loadComponentInternal<T>(name, config);
    this.loadPromises.set(name, loadPromise);

    try {
      const component = await loadPromise;
      this.components.set(name, component);
      this.loadPromises.delete(name);
      return component;
    } catch (error) {
      this.loadPromises.delete(name);
      throw error;
    }
  }

  private async loadComponentInternal<T>(name: string, config: { path: string; size: number }): Promise<T> {
    // Simulate dynamic import with memory tracking
    const startMem = process.memoryUsage().heapUsed;
    
    try {
      const module = await import(config.path);
      const component = new module.default();
      
      const endMem = process.memoryUsage().heapUsed;
      console.log(`Lazy loaded ${name}: ${((endMem - startMem) / 1024 / 1024).toFixed(2)}MB`);
      
      return component;
    } catch (error) {
      console.error(`Failed to lazy load ${name}:`, error);
      throw error;
    }
  }

  unloadComponent(name: string): boolean {
    if (this.components.has(name)) {
      const component = this.components.get(name);
      if (component && typeof component.cleanup === 'function') {
        component.cleanup();
      }
      this.components.delete(name);
      
      // Force garbage collection hint
      if (global.gc) {
        global.gc();
      }
      
      return true;
    }
    return false;
  }

  getLoadedComponents(): string[] {
    return Array.from(this.components.keys());
  }

  getMemoryEstimate(): number {
    let total = 0;
    for (const name of this.components.keys()) {
      const config = this.componentConfigs.get(name);
      if (config) {
        total += config.size;
      }
    }
    return total;
  }
}

class GCOptimizer {
  private gcEvents: number = 0;
  private lastMajorGC: number = 0;
  private performanceObserver: PerformanceObserver;

  constructor() {
    this.setupGCMonitoring();
    this.optimizeGCSettings();
  }

  private setupGCMonitoring(): void {
    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        if (entry.entryType === 'gc') {
          this.gcEvents++;
          if (entry.name === 'major') {
            this.lastMajorGC = Date.now();
          }
        }
      }
    });
    
    this.performanceObserver.observe({ entryTypes: ['gc'] });
  }

  private optimizeGCSettings(): void {
    // Set optimal V8 flags for memory efficiency
    if (process.env.NODE_ENV === 'production') {
      // Increase old space size for better performance
      process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + 
        ' --max-old-space-size=512' +
        ' --optimize-for-size' +
        ' --gc-interval=100';
    }
  }

  forceGC(): boolean {
    if (global.gc) {
      const before = process.memoryUsage().heapUsed;
      global.gc();
      const after = process.memoryUsage().heapUsed;
      const freed = before - after;
      console.log(`Manual GC freed ${(freed / 1024 / 1024).toFixed(2)}MB`);
      return true;
    }
    return false;
  }

  getGCStats(): { events: number; lastMajor: number; timeSince: number } {
    return {
      events: this.gcEvents,
      lastMajor: this.lastMajorGC,
      timeSince: this.lastMajorGC ? Date.now() - this.lastMajorGC : 0
    };
  }

  shouldForceGC(memoryPressure: number): boolean {
    const stats = this.getGCStats();
    const timeSinceGC = stats.timeSince;
    
    // Force GC if high memory pressure and no recent major GC
    return memoryPressure > 0.8 && timeSinceGC > 60000; // 1 minute
  }
}

export class AdvancedMemoryManager extends EventEmitter {
  private memoryPool: MemoryPool;
  private lazyLoader: LazyComponentLoader;
  private gcOptimizer: GCOptimizer;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private pressureHistory: number[] = [];
  private config: {
    monitorInterval: number;
    pressureThreshold: number;
    cleanupThreshold: number;
    historySize: number;
  };

  constructor() {
    super();
    
    this.config = {
      monitorInterval: 10000, // 10 seconds
      pressureThreshold: 0.8, // 80% memory usage
      cleanupThreshold: 0.9, // 90% memory usage
      historySize: 60 // Keep 60 samples (10 minutes at 10s intervals)
    };

    this.memoryPool = new MemoryPool({
      poolSize: 100,
      blockSize: 64 * 1024, // 64KB blocks
      maxBlocks: 1000,
      autoCleanup: true,
      pressureThreshold: this.config.pressureThreshold
    });

    this.lazyLoader = new LazyComponentLoader();
    this.gcOptimizer = new GCOptimizer();
    
    this.startMonitoring();
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.performMemoryCheck();
    }, this.config.monitorInterval);
  }

  private performMemoryCheck(): void {
    const metrics = this.getMemoryMetrics();
    const pressure = this.calculateMemoryPressure(metrics);
    
    // Update pressure history
    this.pressureHistory.push(pressure);
    if (this.pressureHistory.length > this.config.historySize) {
      this.pressureHistory.shift();
    }

    // Emit metrics for monitoring dashboard
    this.emit('metrics', metrics);

    // Handle memory pressure
    if (pressure > this.config.cleanupThreshold) {
      this.handleCriticalMemoryPressure();
    } else if (pressure > this.config.pressureThreshold) {
      this.handleMemoryPressure();
    }

    // Check if GC should be forced
    if (this.gcOptimizer.shouldForceGC(pressure)) {
      this.gcOptimizer.forceGC();
    }
  }

  private calculateMemoryPressure(metrics: MemoryMetrics): number {
    // Calculate memory pressure as percentage of heap usage
    const heapPressure = metrics.heapUsed / metrics.heapTotal;
    const poolPressure = metrics.poolUtilization / 100;
    
    // Weight heap pressure more heavily
    return (heapPressure * 0.7) + (poolPressure * 0.3);
  }

  private handleMemoryPressure(): void {
    console.log('Memory pressure detected, performing optimization...');
    
    // Clean up old pool allocations
    const freedBlocks = this.memoryPool.cleanup();
    console.log(`Freed ${freedBlocks} memory pool blocks`);

    // Unload unused lazy components
    const loadedComponents = this.lazyLoader.getLoadedComponents();
    for (const component of loadedComponents) {
      // Only unload if not recently used (implement usage tracking)
      if (Math.random() > 0.7) { // Simplified logic for demo
        this.lazyLoader.unloadComponent(component);
      }
    }

    this.emit('pressure', 'medium');
  }

  private handleCriticalMemoryPressure(): void {
    console.warn('CRITICAL memory pressure detected!');
    
    // Aggressive cleanup
    this.memoryPool.cleanup(60000); // Clean blocks older than 1 minute
    
    // Unload all non-essential components
    const loadedComponents = this.lazyLoader.getLoadedComponents();
    for (const component of loadedComponents) {
      this.lazyLoader.unloadComponent(component);
    }

    // Force garbage collection
    this.gcOptimizer.forceGC();

    this.emit('pressure', 'critical');
  }

  // Public API
  async allocateMemory(size: number, purpose: string = 'general'): Promise<ArrayBuffer | null> {
    return this.memoryPool.allocate(size, purpose);
  }

  deallocateMemory(buffer: ArrayBuffer): boolean {
    return this.memoryPool.deallocate(buffer);
  }

  async loadComponent<T = any>(name: string): Promise<T> {
    return this.lazyLoader.loadComponent<T>(name);
  }

  unloadComponent(name: string): boolean {
    return this.lazyLoader.unloadComponent(name);
  }

  getMemoryMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage();
    const gcStats = this.gcOptimizer.getGCStats();
    const poolUtilization = this.memoryPool.getUtilization();

    const pressure = this.calculateMemoryPressure({
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      poolUtilization,
      gcEvents: gcStats.events,
      pressureLevel: 'low',
      lastCleanup: 0
    });

    let pressureLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (pressure > 0.9) pressureLevel = 'critical';
    else if (pressure > 0.8) pressureLevel = 'high';
    else if (pressure > 0.6) pressureLevel = 'medium';

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      poolUtilization,
      gcEvents: gcStats.events,
      pressureLevel,
      lastCleanup: gcStats.lastMajor
    };
  }

  getPressureHistory(): number[] {
    return [...this.pressureHistory];
  }

  optimize(): Promise<{ memoryFreed: number; componentsUnloaded: number }> {
    return new Promise((resolve) => {
      const beforeMem = process.memoryUsage().heapUsed;
      const loadedBefore = this.lazyLoader.getLoadedComponents().length;
      
      // Perform optimization
      this.handleMemoryPressure();
      
      // Wait for GC to settle
      setTimeout(() => {
        const afterMem = process.memoryUsage().heapUsed;
        const loadedAfter = this.lazyLoader.getLoadedComponents().length;
        
        resolve({
          memoryFreed: beforeMem - afterMem,
          componentsUnloaded: loadedBefore - loadedAfter
        });
      }, 1000);
    });
  }

  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    // Cleanup all components
    const loadedComponents = this.lazyLoader.getLoadedComponents();
    for (const component of loadedComponents) {
      this.lazyLoader.unloadComponent(component);
    }
    
    this.removeAllListeners();
  }
}

// Singleton instance
let memoryManagerInstance: AdvancedMemoryManager | null = null;

export function getMemoryManager(): AdvancedMemoryManager {
  if (!memoryManagerInstance) {
    memoryManagerInstance = new AdvancedMemoryManager();
  }
  return memoryManagerInstance;
}

export function destroyMemoryManager(): void {
  if (memoryManagerInstance) {
    memoryManagerInstance.destroy();
    memoryManagerInstance = null;
  }
}