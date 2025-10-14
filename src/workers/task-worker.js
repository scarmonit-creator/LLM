#!/usr/bin/env node

/**
 * Task Worker Implementation for CPU-Intensive Processing
 * Handles heavy computational tasks in worker threads
 */

import { parentPort, workerData } from 'worker_threads';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

class TaskWorker {
  constructor() {
    this.workerId = null;
    this.config = {};
    this.statistics = {
      tasksProcessed: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      maxProcessingTime: 0,
      errorsCount: 0
    };
    
    this.setupMessageHandler();
    this.startHeartbeat();
  }

  setupMessageHandler() {
    if (!parentPort) {
      throw new Error('Worker must be run in worker thread context');
    }

    parentPort.on('message', async (message) => {
      try {
        await this.handleMessage(message);
      } catch (error) {
        parentPort.postMessage({
          type: 'task_error',
          taskId: message.taskId,
          error: error.message,
          stack: error.stack
        });
      }
    });
  }

  async handleMessage(message) {
    const { type } = message;

    switch (type) {
      case 'init':
        this.handleInit(message);
        break;
        
      case 'execute_task':
        await this.executeTask(message);
        break;
        
      case 'ping':
        this.handlePing();
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  }

  handleInit(message) {
    this.workerId = message.workerId;
    this.config = message.config || {};
    
    parentPort.postMessage({
      type: 'initialized',
      workerId: this.workerId
    });
  }

  async executeTask(message) {
    const { taskId, taskData, startTime } = message;
    const taskStartTime = performance.now();
    
    try {
      const result = await this.processTask(taskData);
      const processingTime = performance.now() - taskStartTime;
      
      // Update statistics
      this.statistics.tasksProcessed++;
      this.statistics.totalProcessingTime += processingTime;
      this.statistics.averageProcessingTime = 
        this.statistics.totalProcessingTime / this.statistics.tasksProcessed;
      this.statistics.maxProcessingTime = 
        Math.max(this.statistics.maxProcessingTime, processingTime);
      
      parentPort.postMessage({
        type: 'task_completed',
        taskId,
        result,
        processingTime,
        statistics: this.statistics
      });
      
    } catch (error) {
      this.statistics.errorsCount++;
      
      parentPort.postMessage({
        type: 'task_error',
        taskId,
        error: error.message,
        statistics: this.statistics
      });
    }
  }

  async processTask(taskData) {
    const { operation, data, options = {} } = taskData;
    
    switch (operation) {
      case 'json_process':
        return this.processJSON(data, options);
        
      case 'compress':
        return this.compressData(data, options);
        
      case 'decompress':
        return this.decompressData(data, options);
        
      case 'hash':
        return this.hashData(data, options);
        
      case 'transform':
        return this.transformData(data, options);
        
      case 'vector_operations':
        return this.vectorOperations(data, options);
        
      case 'text_analysis':
        return this.analyzeText(data, options);
        
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  async processJSON(data, options) {
    const { action, payload } = data;
    
    switch (action) {
      case 'stringify':
        return JSON.stringify(payload, null, options.pretty ? 2 : 0);
        
      case 'parse':
        return JSON.parse(payload);
        
      case 'validate':
        try {
          JSON.parse(payload);
          return { valid: true };
        } catch (error) {
          return { valid: false, error: error.message };
        }
        
      case 'minify':
        const parsed = JSON.parse(payload);
        return JSON.stringify(parsed);
        
      default:
        throw new Error(`Unknown JSON action: ${action}`);
    }
  }

  async compressData(data, options) {
    const { input, encoding = 'utf8' } = data;
    const inputBuffer = Buffer.isBuffer(input) ? input : Buffer.from(input, encoding);
    
    const compressed = await gzipAsync(inputBuffer);
    const compressionRatio = compressed.length / inputBuffer.length;
    
    return {
      compressed: compressed.toString('base64'),
      originalSize: inputBuffer.length,
      compressedSize: compressed.length,
      compressionRatio,
      savings: Math.round((1 - compressionRatio) * 100)
    };
  }

  async decompressData(data, options) {
    const { input, outputEncoding = 'utf8' } = data;
    const inputBuffer = Buffer.from(input, 'base64');
    
    const decompressed = await gunzipAsync(inputBuffer);
    
    return {
      decompressed: decompressed.toString(outputEncoding),
      originalSize: inputBuffer.length,
      decompressedSize: decompressed.length
    };
  }

  hashData(data, options) {
    const { input, algorithm = 'sha256', encoding = 'hex' } = data;
    const hash = createHash(algorithm);
    
    hash.update(input);
    return {
      hash: hash.digest(encoding),
      algorithm,
      encoding
    };
  }

  transformData(data, options) {
    const { input, transformations } = data;
    let result = input;
    
    for (const transform of transformations) {
      switch (transform.type) {
        case 'filter':
          result = result.filter(transform.predicate);
          break;
          
        case 'map':
          result = result.map(transform.mapper);
          break;
          
        case 'reduce':
          result = result.reduce(transform.reducer, transform.initialValue);
          break;
          
        case 'sort':
          result = result.sort(transform.comparator);
          break;
          
        case 'group':
          result = this.groupBy(result, transform.keySelector);
          break;
          
        default:
          throw new Error(`Unknown transformation: ${transform.type}`);
      }
    }
    
    return result;
  }

  vectorOperations(data, options) {
    const { operation, vectors } = data;
    
    switch (operation) {
      case 'dot_product':
        return this.dotProduct(vectors.a, vectors.b);
        
      case 'cosine_similarity':
        return this.cosineSimilarity(vectors.a, vectors.b);
        
      case 'euclidean_distance':
        return this.euclideanDistance(vectors.a, vectors.b);
        
      case 'normalize':
        return this.normalizeVector(vectors.input);
        
      case 'magnitude':
        return this.vectorMagnitude(vectors.input);
        
      default:
        throw new Error(`Unknown vector operation: ${operation}`);
    }
  }

  analyzeText(data, options) {
    const { text, analyses } = data;
    const results = {};
    
    for (const analysis of analyses) {
      switch (analysis) {
        case 'word_count':
          results.wordCount = text.split(/\s+/).length;
          break;
          
        case 'character_count':
          results.characterCount = text.length;
          break;
          
        case 'sentence_count':
          results.sentenceCount = text.split(/[.!?]+/).length - 1;
          break;
          
        case 'paragraph_count':
          results.paragraphCount = text.split(/\n\s*\n/).length;
          break;
          
        case 'reading_time':
          const wpm = 200; // average words per minute
          results.readingTime = Math.ceil(results.wordCount / wpm);
          break;
          
        case 'complexity':
          results.complexity = this.calculateTextComplexity(text);
          break;
      }
    }
    
    return results;
  }

  // Utility methods
  groupBy(array, keySelector) {
    return array.reduce((groups, item) => {
      const key = keySelector(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {});
  }

  dotProduct(a, b) {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }
    
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  cosineSimilarity(a, b) {
    const dotProd = this.dotProduct(a, b);
    const magA = this.vectorMagnitude(a);
    const magB = this.vectorMagnitude(b);
    
    return dotProd / (magA * magB);
  }

  euclideanDistance(a, b) {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }
    
    const sumSquares = a.reduce((sum, val, i) => {
      const diff = val - b[i];
      return sum + diff * diff;
    }, 0);
    
    return Math.sqrt(sumSquares);
  }

  normalizeVector(vector) {
    const magnitude = this.vectorMagnitude(vector);
    return vector.map(val => val / magnitude);
  }

  vectorMagnitude(vector) {
    const sumSquares = vector.reduce((sum, val) => sum + val * val, 0);
    return Math.sqrt(sumSquares);
  }

  calculateTextComplexity(text) {
    const words = text.split(/\s+/);
    const sentences = text.split(/[.!?]+/).length - 1;
    const avgWordsPerSentence = words.length / sentences;
    const avgSyllablesPerWord = words.reduce((sum, word) => {
      return sum + this.countSyllables(word);
    }, 0) / words.length;
    
    // Flesch Reading Ease approximation
    return 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
  }

  countSyllables(word) {
    return word.toLowerCase().replace(/[^aeiouy]/g, '').length || 1;
  }

  handlePing() {
    parentPort.postMessage({
      type: 'pong',
      workerId: this.workerId,
      statistics: this.statistics,
      timestamp: Date.now()
    });
  }

  startHeartbeat() {
    setInterval(() => {
      if (parentPort) {
        parentPort.postMessage({
          type: 'heartbeat',
          workerId: this.workerId,
          statistics: this.statistics,
          timestamp: Date.now()
        });
      }
    }, 30000); // Every 30 seconds
  }
}

// Initialize worker
new TaskWorker();