#!/usr/bin/env node
import { Anthropic } from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { EventEmitter } from 'node:events';
import { WeakRefCache, BatchProcessor, MemoryPressureMonitor } from '../utils/memory-utils.js';

dotenv.config();

// Chromium-inspired constants
const MESSAGE_BATCH_SIZE = 5;
const COALESCING_TIME = 200; // ms
const MAX_HISTORY_SIZE = 1000;
const RESPONSE_CACHE_SIZE = 500;

export class OptimizedClaudeClient extends EventEmitter {
  constructor(apiKey = process.env.ANTHROPIC_API_KEY) {
    super();
    this.anthropic = new Anthropic({ apiKey });
    
    // Memory-efficient caching
    this.responseCache = new WeakRefCache(RESPONSE_CACHE_SIZE);
    this.conversationHistory = new Map(); // conversationId -> messages[]
    
    // Batch processing for multiple requests
    this.batchProcessor = new BatchProcessor(
      (batch) => this._processBatch(batch),
      MESSAGE_BATCH_SIZE,
      COALESCING_TIME
    );
    
    // Memory pressure monitoring
    this.memoryMonitor = new MemoryPressureMonitor();
    this.memoryMonitor.onPressure((event) => {
      if (event.level === 'critical') {
        this._performEmergencyCleanup();
      }
    });
    this.memoryMonitor.start();
    
    this.metrics = {
      requestCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      batchedRequests: 0,
      startTime: Date.now()
    };
  }

  async sendMessage(message, conversationId = 'default', options = {}) {
    // Check cache first
    const cacheKey = this._generateCacheKey(message, conversationId, options);
    const cached = this.responseCache.get(cacheKey);
    
    if (cached) {
      this.metrics.cacheHits++;
      this.emit('cacheHit', { message, conversationId });
      return cached;
    }
    
    this.metrics.cacheMisses++;
    this.metrics.requestCount++;
    
    // Add to batch processor for efficient handling
    return new Promise((resolve, reject) => {
      this.batchProcessor.add({
        message,
        conversationId,
        options,
        cacheKey,
        resolve,
        reject
      });
    });
  }

  async _processBatch(batch) {
    this.metrics.batchedRequests += batch.length;
    
    // Process requests concurrently with controlled parallelism
    const results = await Promise.allSettled(
      batch.map(item => this._processMessage(item))
    );
    
    // Handle results
    results.forEach((result, index) => {
      const item = batch[index];
      if (result.status === 'fulfilled') {
        item.resolve(result.value);
      } else {
        item.reject(result.reason);
      }
    });
  }

  async _processMessage({ message, conversationId, options, cacheKey }) {
    try {
      // Get conversation history
      const history = this.conversationHistory.get(conversationId) || [];
      
      // Prepare messages array
      const messages = [
        ...history,
        { role: 'user', content: message }
      ];
      
      // Make API call
      const response = await this.anthropic.messages.create({
        model: options.model || 'claude-3-sonnet-20240229',
        max_tokens: options.maxTokens || 4000,
        messages: messages,
        ...options
      });
      
      const assistantMessage = response.content?.[0]?.text ?? '';
      
      // Update conversation history efficiently
      const updatedHistory = [
        ...messages,
        { role: 'assistant', content: assistantMessage, timestamp: Date.now() }
      ];
      
      // Trim history if too long (circular buffer behavior)
      if (updatedHistory.length > MAX_HISTORY_SIZE) {
        updatedHistory.splice(0, updatedHistory.length - MAX_HISTORY_SIZE);
      }
      
      this.conversationHistory.set(conversationId, updatedHistory);
      
      // Cache response
      const result = {
        message: assistantMessage,
        usage: response.usage,
        conversationId,
        timestamp: Date.now()
      };
      
      this.responseCache.set(cacheKey, result);
      
      this.emit('messageProcessed', result);
      return result;
      
    } catch (error) {
      this.emit('error', { error, message, conversationId });
      throw error;
    }
  }

  _generateCacheKey(message, conversationId, options) {
    const keyData = {
      message: String(message).slice(0, 100),
      conversationId,
      model: options.model || 'claude-3-sonnet-20240229',
      maxTokens: options.maxTokens || 4000
    };
    return JSON.stringify(keyData);
  }

  _performEmergencyCleanup() {
    // Clear oldest conversations
    const conversations = Array.from(this.conversationHistory.entries());
    conversations.sort((a, b) => {
      const aLastMsg = a[1][a[1].length - 1]?.timestamp || 0;
      const bLastMsg = b[1][b[1].length - 1]?.timestamp || 0;
      return aLastMsg - bLastMsg;
    });
    
    // Remove oldest 50% of conversations
    const toRemove = Math.floor(conversations.length / 2);
    for (let i = 0; i < toRemove; i++) {
      this.conversationHistory.delete(conversations[i][0]);
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    this.emit('emergencyCleanup', { removedConversations: toRemove });
  }

  getMetrics() {
    const now = Date.now();
    return {
      ...this.metrics,
      uptime: now - this.metrics.startTime,
      activeConversations: this.conversationHistory.size,
      cacheHitRate: this.metrics.cacheHits / Math.max(1, (this.metrics.cacheHits + this.metrics.cacheMisses)),
      memoryUsage: process.memoryUsage()
    };
  }

  clearConversation(conversationId) {
    return this.conversationHistory.delete(conversationId);
  }

  destroy() {
    this.memoryMonitor.destroy();
    this.batchProcessor.flush();
    this.responseCache.destroy();
    this.conversationHistory.clear();
    this.removeAllListeners();
  }
}

export default OptimizedClaudeClient;
