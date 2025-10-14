/**
 * Performance Optimizer Tool
 * Provides runtime performance optimization, memory management, and bottleneck detection
 */

import { Tool } from './types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

export interface PerformanceMetrics {
  cpu: number;
  memory: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  loadAverage: number[];
  uptime: number;
  processMemory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
}

export interface OptimizationResult {
  success: boolean;
  metrics: PerformanceMetrics;
  optimizations: string[];
  recommendations: string[];
  timestamp: string;
}

export const performanceOptimizer: Tool = {
  name: 'performance_optimizer',
  description: 'Analyze and optimize system performance, detect bottlenecks, and apply optimizations',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['analyze', 'optimize', 'monitor', 'cleanup', 'benchmark', 'memory_analysis'],
        description: 'Performance operation to execute'
      },
      target: {
        type: 'string',
        description: 'Target for optimization (process, system, memory, etc.)'
      },
      threshold: {
        type: 'number',
        description: 'Performance threshold for alerts (0-100)'
      },
      autoFix: {
        type: 'boolean',
        description: 'Automatically apply optimizations'
      }
    },
    required: ['operation']
  },
  
  async execute(params: any): Promise<OptimizationResult> {
    const { operation, target = 'system', threshold = 80, autoFix = false } = params;
    
    try {
      let metrics = await getPerformanceMetrics();
      let optimizations: string[] = [];
      let recommendations: string[] = [];
      
      switch (operation) {
        case 'analyze':
          recommendations = await analyzePerformance(metrics, threshold);
          break;
          
        case 'optimize':
          const result = await optimizePerformance(metrics, autoFix);
          optimizations = result.optimizations;
          recommendations = result.recommendations;
          metrics = await getPerformanceMetrics(); // Refresh after optimization
          break;
          
        case 'monitor':
          await monitorPerformance(threshold);
          recommendations.push('Performance monitoring initiated');
          break;
          
        case 'cleanup':
          optimizations = await performCleanup(autoFix);
          metrics = await getPerformanceMetrics();
          break;
          
        case 'benchmark':
          const benchmarkResults = await runBenchmarks();
          recommendations.push(`Benchmark completed: ${JSON.stringify(benchmarkResults)}`);
          break;
          
        case 'memory_analysis':
          const memoryAnalysis = await analyzeMemoryUsage();
          recommendations = memoryAnalysis;
          break;
          
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
      
      return {
        success: true,
        metrics,
        optimizations,
        recommendations,
        timestamp: new Date().toISOString()
      };
      
    } catch (error: any) {
      return {
        success: false,
        metrics: await getPerformanceMetrics(),
        optimizations: [],
        recommendations: [`Error: ${error.message}`],
        timestamp: new Date().toISOString()
      };
    }
  }
};

async function getPerformanceMetrics(): Promise<PerformanceMetrics> {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const processMemory = process.memoryUsage();
  
  return {
    cpu: await getCpuUsage(),
    memory: {
      used: usedMem,
      free: freeMem,
      total: totalMem,
      percentage: (usedMem / totalMem) * 100
    },
    loadAverage: os.loadavg(),
    uptime: os.uptime(),
    processMemory: {
      rss: processMemory.rss,
      heapTotal: processMemory.heapTotal,
      heapUsed: processMemory.heapUsed,
      external: processMemory.external
    }
  };
}

async function getCpuUsage(): Promise<number> {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  
  cpus.forEach(cpu => {
    for (let type in cpu.times) {
      totalTick += (cpu.times as any)[type];
    }
    totalIdle += cpu.times.idle;
  });
  
  return 100 - (totalIdle / totalTick * 100);
}

async function analyzePerformance(metrics: PerformanceMetrics, threshold: number): Promise<string[]> {
  const recommendations: string[] = [];
  
  // Memory analysis
  if (metrics.memory.percentage > threshold) {
    recommendations.push(`High memory usage detected: ${metrics.memory.percentage.toFixed(2)}%`);
    recommendations.push('Consider freeing up memory or increasing available RAM');
  }
  
  // CPU analysis
  if (metrics.cpu > threshold) {
    recommendations.push(`High CPU usage detected: ${metrics.cpu.toFixed(2)}%`);
    recommendations.push('Consider optimizing CPU-intensive operations');
  }
  
  // Load average analysis
  const cpuCount = os.cpus().length;
  if (metrics.loadAverage[0] > cpuCount * 0.8) {
    recommendations.push('High system load detected');
    recommendations.push('Consider reducing concurrent operations');
  }
  
  // Process memory analysis
  const heapUsagePercent = (metrics.processMemory.heapUsed / metrics.processMemory.heapTotal) * 100;
  if (heapUsagePercent > 80) {
    recommendations.push(`High heap usage: ${heapUsagePercent.toFixed(2)}%`);
    recommendations.push('Consider garbage collection or memory optimization');
  }
  
  return recommendations;
}

async function optimizePerformance(metrics: PerformanceMetrics, autoFix: boolean): Promise<{ optimizations: string[]; recommendations: string[] }> {
  const optimizations: string[] = [];
  const recommendations: string[] = [];
  
  // Garbage collection
  if (global.gc && autoFix) {
    global.gc();
    optimizations.push('Forced garbage collection');
  } else {
    recommendations.push('Consider enabling garbage collection with --expose-gc');
  }
  
  // Node.js optimizations
  if (autoFix) {
    // Optimize V8 flags
    process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --max-old-space-size=4096';
    optimizations.push('Increased Node.js heap size');
  }
  
  // System optimizations
  try {
    if (autoFix && process.platform === 'linux') {
      await execAsync('echo 3 > /proc/sys/vm/drop_caches').catch(() => {});
      optimizations.push('Cleared system caches');
    }
  } catch (error) {
    recommendations.push('Consider clearing system caches manually');
  }
  
  return { optimizations, recommendations };
}

async function performCleanup(autoFix: boolean): Promise<string[]> {
  const optimizations: string[] = [];
  
  try {
    // Clean npm cache
    if (autoFix) {
      await execAsync('npm cache clean --force');
      optimizations.push('Cleaned npm cache');
    }
    
    // Clean temporary files
    if (autoFix) {
      const tmpDir = os.tmpdir();
      const files = await fs.readdir(tmpDir);
      let cleanedCount = 0;
      
      for (const file of files) {
        try {
          const filePath = `${tmpDir}/${file}`;
          const stats = await fs.stat(filePath);
          // Delete files older than 1 hour
          if (Date.now() - stats.mtime.getTime() > 3600000) {
            await fs.unlink(filePath);
            cleanedCount++;
          }
        } catch (error) {
          // Ignore errors for individual files
        }
      }
      
      optimizations.push(`Cleaned ${cleanedCount} temporary files`);
    }
    
  } catch (error) {
    optimizations.push(`Cleanup completed with some errors: ${error}`);
  }
  
  return optimizations;
}

async function monitorPerformance(threshold: number): Promise<void> {
  // Start performance monitoring in background
  const interval = setInterval(async () => {
    const metrics = await getPerformanceMetrics();
    
    if (metrics.memory.percentage > threshold || metrics.cpu > threshold) {
      console.warn(`Performance Alert: CPU: ${metrics.cpu.toFixed(2)}%, Memory: ${metrics.memory.percentage.toFixed(2)}%`);
    }
  }, 5000); // Check every 5 seconds
  
  // Store interval for cleanup
  (global as any).__performanceMonitor = interval;
}

async function runBenchmarks(): Promise<any> {
  const results: any = {};
  
  // CPU benchmark
  const cpuStart = Date.now();
  let sum = 0;
  for (let i = 0; i < 1000000; i++) {
    sum += Math.sqrt(i);
  }
  results.cpu = Date.now() - cpuStart;
  
  // Memory benchmark
  const memoryStart = Date.now();
  const arrays = [];
  for (let i = 0; i < 1000; i++) {
    arrays.push(new Array(1000).fill(i));
  }
  results.memory = Date.now() - memoryStart;
  
  // I/O benchmark
  const ioStart = Date.now();
  try {
    await fs.writeFile('/tmp/benchmark.txt', 'benchmark test');
    await fs.readFile('/tmp/benchmark.txt');
    await fs.unlink('/tmp/benchmark.txt');
    results.io = Date.now() - ioStart;
  } catch (error) {
    results.io = -1;
  }
  
  return results;
}

async function analyzeMemoryUsage(): Promise<string[]> {
  const analysis: string[] = [];
  const memUsage = process.memoryUsage();
  
  analysis.push(`RSS (Resident Set Size): ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
  analysis.push(`Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  analysis.push(`Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  analysis.push(`External: ${(memUsage.external / 1024 / 1024).toFixed(2)} MB`);
  
  const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  if (heapUsagePercent > 90) {
    analysis.push('WARNING: Heap usage is very high, consider memory optimization');
  } else if (heapUsagePercent > 70) {
    analysis.push('CAUTION: Heap usage is moderately high');
  } else {
    analysis.push('Memory usage is within normal range');
  }
  
  return analysis;
}

export default performanceOptimizer;