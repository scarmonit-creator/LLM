#!/usr/bin/env node
/**
 * ML-Enhanced Caching System - Predictive Intelligence
 * Uses machine learning to predict cache needs and optimize hit rates
 * Target: 8% additional performance improvement through intelligent caching
 */

import { EventEmitter } from 'events';
import LRU from 'lru-cache';

/**
 * Simple Linear Regression for cache prediction
 */
class CachePredictionModel {
  constructor() {
    this.features = [];
    this.labels = [];
    this.weights = null;
    this.trained = false;
  }

  addTrainingData(features, label) {
    this.features.push([1, ...features]); // Add bias term
    this.labels.push(label);
    
    // Retrain if we have enough data
    if (this.features.length >= 20 && this.features.length % 10 === 0) {
      this.train();
    }
  }

  train() {
    if (this.features.length < 5) return;

    try {
      // Simple gradient descent for linear regression
      const X = this.features;
      const y = this.labels;
      const n = X.length;
      const m = X[0].length;
      
      // Initialize weights
      if (!this.weights) {
        this.weights = new Array(m).fill(0);
      }
      
      const learningRate = 0.01;
      const iterations = 50;
      
      for (let iter = 0; iter < iterations; iter++) {
        const predictions = X.map(xi => 
          xi.reduce((sum, xij, j) => sum + xij * this.weights[j], 0)
        );
        
        const errors = predictions.map((pred, i) => pred - y[i]);
        
        // Update weights
        for (let j = 0; j < m; j++) {
          const gradient = errors.reduce((sum, error, i) => sum + error * X[i][j], 0) / n;
          this.weights[j] -= learningRate * gradient;
        }
      }
      
      this.trained = true;
    } catch (error) {
      console.warn('[ML-Cache] Training error:', error.message);
    }
  }

  predict(features) {
    if (!this.trained || !this.weights) {
      return 0.5; // Default prediction
    }
    
    const input = [1, ...features];
    const prediction = input.reduce((sum, xi, i) => sum + xi * (this.weights[i] || 0), 0);
    
    // Sigmoid activation for probability
    return 1 / (1 + Math.exp(-prediction));
  }
}

/**
 * Smart Cache Entry with prediction metadata
 */
class SmartCacheEntry {
  constructor(key, value, ttl = 300000) { // 5 minutes default TTL
    this.key = key;
    this.value = value;
    this.createdAt = Date.now();
    this.lastAccessed = Date.now();
    this.accessCount = 0;
    this.ttl = ttl;
    this.predictions = [];
    this.features = this.extractFeatures();
  }

  extractFeatures() {
    const now = Date.now();
    const keyLength = this.key.length;
    const hourOfDay = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    
    return [
      keyLength / 100, // Normalize key length
      hourOfDay / 24,  // Normalize hour
      dayOfWeek / 7,   // Normalize day
      this.accessCount / 10 // Normalize access count
    ];
  }

  access() {
    this.lastAccessed = Date.now();
    this.accessCount++;
    this.features = this.extractFeatures(); // Update features
    return this.value;
  }

  isExpired() {
    return Date.now() - this.createdAt > this.ttl;
  }

  getAge() {
    return Date.now() - this.createdAt;
  }

  getIdleTime() {
    return Date.now() - this.lastAccessed;
  }
}

/**
 * ML-Enhanced Cache System
 */
export class MLEnhancedCache extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxSize: options.maxSize || 1000,
      defaultTTL: options.defaultTTL || 300000, // 5 minutes
      predictionInterval: options.predictionInterval || 60000, // 1 minute
      warmupThreshold: options.warmupThreshold || 0.7,
      evictionRatio: options.evictionRatio || 0.2,
      ...options
    };
    
    this.cache = new LRU({
      max: this.options.maxSize,
      ttl: this.options.defaultTTL,
      allowStale: false,
      updateAgeOnGet: true
    });
    
    this.smartCache = new Map();
    this.predictionModel = new CachePredictionModel();
    
    this.stats = {
      hits: 0,
      misses: 0,
      predictions: 0,
      correctPredictions: 0,
      warmupEvents: 0,
      evictions: 0,
      totalRequests: 0
    };
    
    this.setupPredictiveWarming();
  }
  
  setupPredictiveWarming() {
    this.predictionTimer = setInterval(() => {
      this.performPredictiveWarming();
    }, this.options.predictionInterval);
  }
  
  performPredictiveWarming() {
    if (!this.predictionModel.trained) return;
    
    const candidatesForWarming = [];
    
    // Analyze recently accessed but evicted keys
    this.smartCache.forEach((entry, key) => {
      if (!this.cache.has(key)) {
        const prediction = this.predictionModel.predict(entry.features);
        
        if (prediction > this.options.warmupThreshold) {
          candidatesForWarming.push({ key, entry, prediction });
        }
      }
    });
    
    // Sort by prediction confidence
    candidatesForWarming.sort((a, b) => b.prediction - a.prediction);
    
    // Warm up top candidates (limit to avoid memory pressure)
    const warmupCount = Math.min(candidatesForWarming.length, 10);
    
    for (let i = 0; i < warmupCount; i++) {
      const { key, entry } = candidatesForWarming[i];
      
      // Re-add to cache if not expired
      if (!entry.isExpired()) {
        this.cache.set(key, entry.value);
        this.stats.warmupEvents++;
        this.emit('warmup', { key, prediction: candidatesForWarming[i].prediction });
      }
    }
  }
  
  set(key, value, ttl) {
    const actualTTL = ttl || this.options.defaultTTL;
    
    // Store in both caches
    this.cache.set(key, value, { ttl: actualTTL });
    this.smartCache.set(key, new SmartCacheEntry(key, value, actualTTL));
    
    this.emit('set', { key, size: this.cache.size });
  }
  
  get(key) {
    this.stats.totalRequests++;
    
    const startTime = process.hrtime.bigint();
    
    // Check smart cache first for metadata
    const smartEntry = this.smartCache.get(key);
    let value = this.cache.get(key);
    
    if (value !== undefined && smartEntry) {
      // Cache hit
      this.stats.hits++;
      smartEntry.access();
      
      // Train prediction model
      this.predictionModel.addTrainingData(smartEntry.features, 1);
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      this.emit('hit', { key, duration, accessCount: smartEntry.accessCount });
      
      return value;
    } else {
      // Cache miss
      this.stats.misses++;
      
      if (smartEntry) {
        // Train prediction model with miss
        this.predictionModel.addTrainingData(smartEntry.features, 0);
      }
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      this.emit('miss', { key, duration });
      
      return undefined;
    }
  }
  
  has(key) {
    return this.cache.has(key);
  }
  
  delete(key) {
    const deleted = this.cache.delete(key);
    this.smartCache.delete(key);
    
    if (deleted) {
      this.emit('delete', { key });
    }
    
    return deleted;
  }
  
  clear() {
    this.cache.clear();
    this.smartCache.clear();
    this.emit('clear');
  }
  
  // Intelligent eviction based on ML predictions
  performIntelligentEviction() {
    if (this.cache.size < this.options.maxSize * 0.9) return;
    
    const candidates = [];
    
    this.smartCache.forEach((entry, key) => {
      if (this.cache.has(key)) {
        const prediction = this.predictionModel.predict(entry.features);
        const age = entry.getAge();
        const idleTime = entry.getIdleTime();
        
        // Score for eviction (higher = more likely to evict)
        const evictionScore = (1 - prediction) + (age / 3600000) + (idleTime / 1800000);
        
        candidates.push({ key, entry, evictionScore, prediction });
      }
    });
    
    // Sort by eviction score (highest first)
    candidates.sort((a, b) => b.evictionScore - a.evictionScore);
    
    // Evict top candidates
    const evictCount = Math.floor(this.cache.size * this.options.evictionRatio);
    
    for (let i = 0; i < Math.min(evictCount, candidates.length); i++) {
      const { key } = candidates[i];
      this.delete(key);
      this.stats.evictions++;
    }
    
    this.emit('intelligent-eviction', { evicted: evictCount });
  }
  
  getStats() {
    const hitRate = this.stats.totalRequests > 0 ? (this.stats.hits / this.stats.totalRequests) : 0;
    const predictionAccuracy = this.stats.predictions > 0 ? (this.stats.correctPredictions / this.stats.predictions) : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      totalRequests: this.stats.totalRequests,
      hitRate: Math.round(hitRate * 100),
      warmupEvents: this.stats.warmupEvents,
      evictions: this.stats.evictions,
      predictions: this.stats.predictions,
      predictionAccuracy: Math.round(predictionAccuracy * 100),
      modelTrained: this.predictionModel.trained,
      utilizationRatio: Math.round((this.cache.size / this.options.maxSize) * 100)
    };
  }
  
  destroy() {
    if (this.predictionTimer) {
      clearInterval(this.predictionTimer);
    }
    
    this.clear();
    this.emit('destroyed');
  }
}

export default new MLEnhancedCache();