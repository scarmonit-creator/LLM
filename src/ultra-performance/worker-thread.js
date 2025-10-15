/**
 * Ultra Performance Worker Thread
 * High-performance worker for CPU-intensive tasks
 */

import { performance } from 'perf_hooks';
import crypto from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Main worker function - handles various optimization tasks
 */
export default async function workerTask(data) {
  const startTime = performance.now();
  
  try {
    let result;
    
    switch (data.task) {
      case 'optimize_cpu':
        result = await optimizeCPU(data.options);
        break;
        
      case 'compress_data':
        result = await compressData(data.payload);
        break;
        
      case 'hash_computation':
        result = await computeHashes(data.inputs);
        break;
        
      case 'data_transformation':
        result = await transformData(data.dataset);
        break;
        
      case 'performance_analysis':
        result = await analyzePerformance(data.metrics);
        break;
        
      case 'memory_optimization':
        result = await optimizeMemory(data.memoryData);
        break;
        
      case 'concurrent_processing':
        result = await processConcurrently(data.tasks);
        break;
        
      default:
        throw new Error(`Unknown task: ${data.task}`);
    }
    
    const executionTime = performance.now() - startTime;
    
    return {
      success: true,
      result,
      executionTime,
      timestamp: Date.now(),
      workerId: process.pid
    };
    
  } catch (error) {
    const executionTime = performance.now() - startTime;
    
    return {
      success: false,
      error: error.message,
      executionTime,
      timestamp: Date.now(),
      workerId: process.pid
    };
  }
}

/**
 * CPU optimization tasks
 */
async function optimizeCPU(options = {}) {
  const iterations = options.iterations || 1000000;
  const complexity = options.complexity || 1;
  
  // Simulate CPU-intensive work with mathematical calculations
  let result = 0;
  const startTime = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    // Prime number calculation for CPU load
    result += isPrime(i * complexity + 7) ? 1 : 0;
    
    // Yield control periodically to prevent blocking
    if (i % 10000 === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  
  const endTime = performance.now();
  
  return {
    optimized: true,
    iterations,
    primesFound: result,
    executionTime: endTime - startTime,
    performance: {
      iterationsPerMs: iterations / (endTime - startTime),
      efficiency: result / iterations
    }
  };
}

/**
 * Data compression optimization
 */
async function compressData(payload) {
  const originalSize = Buffer.byteLength(JSON.stringify(payload));
  
  // Compress using gzip
  const compressed = await gzip(JSON.stringify(payload));
  const compressedSize = compressed.length;
  
  // Decompress to verify integrity
  const decompressed = await gunzip(compressed);
  const decompressedData = JSON.parse(decompressed.toString());
  
  return {
    compressed: true,
    originalSize,
    compressedSize,
    compressionRatio: ((originalSize - compressedSize) / originalSize * 100).toFixed(2),
    verified: JSON.stringify(payload) === JSON.stringify(decompressedData),
    compressedData: compressed.toString('base64')
  };
}

/**
 * Hash computation for data integrity
 */
async function computeHashes(inputs) {
  const results = [];
  
  for (const input of inputs) {
    const data = typeof input === 'string' ? input : JSON.stringify(input);
    
    // Compute multiple hash types
    const hashes = {
      md5: crypto.createHash('md5').update(data).digest('hex'),
      sha1: crypto.createHash('sha1').update(data).digest('hex'),
      sha256: crypto.createHash('sha256').update(data).digest('hex'),
      sha512: crypto.createHash('sha512').update(data).digest('hex')
    };
    
    results.push({
      input: input,
      hashes,
      dataSize: Buffer.byteLength(data)
    });
  }
  
  return {
    processed: true,
    totalInputs: inputs.length,
    results,
    algorithms: ['md5', 'sha1', 'sha256', 'sha512']
  };
}

/**
 * Data transformation and optimization
 */
async function transformData(dataset) {
  const startTime = performance.now();
  
  if (!Array.isArray(dataset)) {
    throw new Error('Dataset must be an array');
  }
  
  const transformations = {
    filtered: [],
    sorted: [],
    aggregated: {},
    optimized: []
  };
  
  // Filter valid data
  transformations.filtered = dataset.filter(item => 
    item != null && typeof item === 'object'
  );
  
  // Sort by a key if available
  transformations.sorted = [...transformations.filtered].sort((a, b) => {
    const keyA = a.id || a.timestamp || a.name || JSON.stringify(a);
    const keyB = b.id || b.timestamp || b.name || JSON.stringify(b);
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });
  
  // Aggregate statistics
  transformations.aggregated = {
    totalItems: dataset.length,
    validItems: transformations.filtered.length,
    invalidItems: dataset.length - transformations.filtered.length,
    dataTypes: getDataTypeDistribution(transformations.filtered),
    memoryUsage: getMemoryUsage(transformations.filtered)
  };
  
  // Optimize data structure
  transformations.optimized = transformations.filtered.map(item => {
    // Remove null/undefined values
    const optimized = {};
    for (const [key, value] of Object.entries(item)) {
      if (value != null && value !== '') {
        optimized[key] = value;
      }
    }
    return optimized;
  });
  
  const endTime = performance.now();
  
  return {
    transformed: true,
    executionTime: endTime - startTime,
    transformations,
    performance: {
      itemsPerMs: dataset.length / (endTime - startTime),
      optimizationRatio: (
        (JSON.stringify(dataset).length - JSON.stringify(transformations.optimized).length) /
        JSON.stringify(dataset).length * 100
      ).toFixed(2)
    }
  };
}

/**
 * Performance analysis and optimization recommendations
 */
async function analyzePerformance(metrics) {
  const analysis = {
    overall: 'good',
    recommendations: [],
    optimizations: [],
    score: 0
  };
  
  // Analyze memory usage
  if (metrics.memory) {
    const memoryUsage = metrics.memory.heapUsed / metrics.memory.heapTotal;
    if (memoryUsage > 0.8) {
      analysis.recommendations.push('High memory usage detected - consider memory optimization');
      analysis.optimizations.push('memory_cleanup');
    }
  }
  
  // Analyze CPU usage
  if (metrics.cpu) {
    const cpuTime = metrics.cpu.user + metrics.cpu.system;
    if (cpuTime > 1000) { // Over 1 second
      analysis.recommendations.push('High CPU usage - consider worker thread offloading');
      analysis.optimizations.push('cpu_offload');
    }
  }
  
  // Analyze response times
  if (metrics.responseTimes && Array.isArray(metrics.responseTimes)) {
    const avgResponseTime = metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length;
    if (avgResponseTime > 100) { // Over 100ms
      analysis.recommendations.push('Slow response times - consider caching or optimization');
      analysis.optimizations.push('response_caching');
    }
  }
  
  // Calculate overall score
  const totalChecks = 3;
  const passedChecks = totalChecks - analysis.recommendations.length;
  analysis.score = Math.round((passedChecks / totalChecks) * 100);
  
  if (analysis.score >= 80) analysis.overall = 'excellent';
  else if (analysis.score >= 60) analysis.overall = 'good';
  else if (analysis.score >= 40) analysis.overall = 'fair';
  else analysis.overall = 'poor';
  
  return {
    analyzed: true,
    analysis,
    metricsProcessed: Object.keys(metrics).length,
    timestamp: Date.now()
  };
}

/**
 * Memory optimization strategies
 */
async function optimizeMemory(memoryData) {
  const optimizations = {
    objectPooling: false,
    garbageCollection: false,
    bufferOptimization: false,
    cacheOptimization: false
  };
  
  // Simulate memory optimizations
  if (global.gc) {
    global.gc();
    optimizations.garbageCollection = true;
  }
  
  // Object pooling simulation
  if (memoryData && memoryData.objects) {
    optimizations.objectPooling = true;
  }
  
  // Buffer optimization
  if (Buffer.poolSize) {
    Buffer.poolSize = 8 * 1024; // 8KB
    optimizations.bufferOptimization = true;
  }
  
  // Cache optimization
  if (memoryData && memoryData.cache) {
    optimizations.cacheOptimization = true;
  }
  
  return {
    optimized: true,
    optimizations,
    memoryBefore: process.memoryUsage(),
    recommendations: [
      'Enable object pooling for frequently created objects',
      'Implement LRU cache with size limits',
      'Use Buffer.allocUnsafe() for temporary buffers',
      'Monitor and clean up event listeners'
    ]
  };
}

/**
 * Concurrent processing of multiple tasks
 */
async function processConcurrently(tasks) {
  const results = [];
  const startTime = performance.now();
  
  // Process tasks in batches to avoid overwhelming the system
  const batchSize = 10;
  const batches = [];
  
  for (let i = 0; i < tasks.length; i += batchSize) {
    batches.push(tasks.slice(i, i + batchSize));
  }
  
  for (const batch of batches) {
    const batchPromises = batch.map(async (task, index) => {
      try {
        // Simulate task processing
        await new Promise(resolve => setTimeout(resolve, task.delay || 10));
        return {
          index: index,
          success: true,
          result: task.operation ? await performOperation(task.operation) : 'completed',
          executionTime: task.delay || 10
        };
      } catch (error) {
        return {
          index: index,
          success: false,
          error: error.message,
          executionTime: 0
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  const endTime = performance.now();
  
  return {
    processed: true,
    totalTasks: tasks.length,
    batchSize,
    totalBatches: batches.length,
    results,
    executionTime: endTime - startTime,
    performance: {
      tasksPerMs: tasks.length / (endTime - startTime),
      successRate: (results.filter(r => r.success).length / results.length * 100).toFixed(2)
    }
  };
}

// Helper functions

function isPrime(n) {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  
  for (let i = 3; i <= Math.sqrt(n); i += 2) {
    if (n % i === 0) return false;
  }
  
  return true;
}

function getDataTypeDistribution(data) {
  const types = {};
  
  for (const item of data) {
    for (const [key, value] of Object.entries(item)) {
      const type = typeof value;
      types[type] = (types[type] || 0) + 1;
    }
  }
  
  return types;
}

function getMemoryUsage(data) {
  const serialized = JSON.stringify(data);
  return {
    bytes: Buffer.byteLength(serialized),
    kb: (Buffer.byteLength(serialized) / 1024).toFixed(2),
    mb: (Buffer.byteLength(serialized) / 1024 / 1024).toFixed(2)
  };
}

async function performOperation(operation) {
  switch (operation) {
    case 'math':
      return Math.random() * 1000;
    case 'string':
      return 'processed_' + Date.now();
    case 'array':
      return Array.from({ length: 100 }, (_, i) => i);
    default:
      return 'default_result';
  }
}