// Optimized Tab and Text Selection System
// Inspired by Chromium's browser.cc patterns

import { EventEmitter } from 'node:events';
import { WeakRefCache, BatchProcessor, TaskScheduler } from '../utils/memory-utils.js';

// Constants from Chromium analysis
const UI_UPDATE_COALESCING_TIME = 200; // ms - matches Chromium's UI update frequency
const SELECTION_BATCH_SIZE = 10;
const MAX_SELECTION_HISTORY = 1000;
const TEXT_PREVIEW_LENGTH = 200;

export class TabSelectionManager extends EventEmitter {
  constructor() {
    super();
    
    // Memory-efficient storage for selections
    this.selectionHistory = new WeakRefCache(MAX_SELECTION_HISTORY);
    this.activeSelections = new Map(); // tabId -> selection data
    
    // Batch processor for text analysis requests
    this.analysisProcessor = new BatchProcessor(
      (batch) => this._processBatch(batch),
      SELECTION_BATCH_SIZE,
      UI_UPDATE_COALESCING_TIME
    );
    
    // Task scheduler for priority processing
    this.taskScheduler = new TaskScheduler();
    
    this.metrics = {
      totalSelections: 0,
      batchedAnalyses: 0,
      cacheHits: 0,
      startTime: Date.now()
    };
  }

  // Handle text selection from current tab
  handleTextSelection(tabId, selectedText, context = {}) {
    const selectionId = this._generateSelectionId(selectedText, context);
    
    // Check cache first
    const cached = this.selectionHistory.get(selectionId);
    if (cached) {
      this.metrics.cacheHits++;
      this.emit('selectionAnalyzed', cached);
      return Promise.resolve(cached);
    }
    
    this.metrics.totalSelections++;
    
    // Store active selection
    const selection = {
      id: selectionId,
      tabId,
      text: selectedText,
      preview: selectedText.slice(0, TEXT_PREVIEW_LENGTH),
      context,
      timestamp: Date.now(),
      status: 'pending'
    };
    
    this.activeSelections.set(selectionId, selection);
    
    // Queue for batch analysis
    return new Promise((resolve, reject) => {
      this.analysisProcessor.add({
        selection,
        resolve,
        reject
      });
    });
  }

  // Handle current tab optimization requests
  optimizeCurrentTab(tabId, tabInfo) {
    return this.taskScheduler.schedule(async () => {
      try {
        const optimization = await this._analyzeTabForOptimization(tabId, tabInfo);
        this.emit('tabOptimized', { tabId, optimization });
        return optimization;
      } catch (error) {
        this.emit('error', { error, tabId });
        throw error;
      }
    }, 'high'); // High priority for current tab
  }

  async _processBatch(batch) {
    this.metrics.batchedAnalyses += batch.length;
    
    // Process all selections in parallel
    const results = await Promise.allSettled(
      batch.map(item => this._analyzeSelection(item.selection))
    );
    
    // Handle results and resolve promises
    results.forEach((result, index) => {
      const item = batch[index];
      if (result.status === 'fulfilled') {
        // Cache successful analysis
        this.selectionHistory.set(item.selection.id, result.value);
        
        // Update active selection
        item.selection.status = 'analyzed';
        item.selection.analysis = result.value;
        
        this.emit('selectionAnalyzed', result.value);
        item.resolve(result.value);
      } else {
        item.selection.status = 'error';
        item.selection.error = result.reason;
        
        this.emit('selectionError', { 
          selection: item.selection, 
          error: result.reason 
        });
        item.reject(result.reason);
      }
      
      // Clean up active selection after processing
      this.activeSelections.delete(item.selection.id);
    });
  }

  async _analyzeSelection(selection) {
    // Simulate text analysis with various optimization techniques
    const analysis = {
      id: selection.id,
      text: selection.text,
      preview: selection.preview,
      tabId: selection.tabId,
      
      // Text analysis results
      wordCount: selection.text.split(/\s+/).length,
      language: this._detectLanguage(selection.text),
      sentiment: this._analyzeSentiment(selection.text),
      
      // Optimization suggestions
      suggestions: this._generateOptimizations(selection.text, selection.context),
      
      // Performance metadata
      processingTime: Date.now() - selection.timestamp,
      timestamp: selection.timestamp,
      
      // Context information
      context: selection.context
    };
    
    return analysis;
  }

  async _analyzeTabForOptimization(tabId, tabInfo) {
    const optimization = {
      tabId,
      url: tabInfo.url,
      title: tabInfo.title,
      
      // Performance optimizations
      performance: {
        loadTime: tabInfo.loadTime || 0,
        memoryUsage: tabInfo.memoryUsage || 0,
        suggestions: this._generatePerformanceOptimizations(tabInfo)
      },
      
      // Content optimizations
      content: {
        readability: this._analyzeReadability(tabInfo.content || ''),
        accessibility: this._checkAccessibility(tabInfo),
        seo: this._analyzeSEO(tabInfo)
      },
      
      // User experience improvements
      ux: {
        navigationSuggestions: this._generateNavigationSuggestions(tabInfo),
        interactionOptimizations: this._generateInteractionOptimizations(tabInfo)
      },
      
      timestamp: Date.now()
    };
    
    return optimization;
  }

  _generateSelectionId(text, context) {
    // Create deterministic ID for caching
    const hash = this._simpleHash(text + JSON.stringify(context));
    return `sel_${hash}`;
  }

  _detectLanguage(text) {
    // Simple language detection
    const commonWords = {
      en: ['the', 'and', 'is', 'in', 'to', 'of', 'a'],
      es: ['el', 'la', 'de', 'que', 'y', 'en', 'un'],
      fr: ['le', 'de', 'et', 'à', 'un', 'il', 'être']
    };
    
    const words = text.toLowerCase().split(/\s+/);
    let bestMatch = 'en';
    let maxScore = 0;
    
    for (const [lang, keywords] of Object.entries(commonWords)) {
      const score = keywords.reduce((acc, word) => 
        acc + (words.includes(word) ? 1 : 0), 0
      );
      if (score > maxScore) {
        maxScore = score;
        bestMatch = lang;
      }
    }
    
    return bestMatch;
  }

  _analyzeSentiment(text) {
    // Simple sentiment analysis
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'disappointing'];
    
    const words = text.toLowerCase().split(/\s+/);
    const positive = positiveWords.reduce((acc, word) => 
      acc + (words.includes(word) ? 1 : 0), 0
    );
    const negative = negativeWords.reduce((acc, word) => 
      acc + (words.includes(word) ? 1 : 0), 0
    );
    
    if (positive > negative) return 'positive';
    if (negative > positive) return 'negative';
    return 'neutral';
  }

  _generateOptimizations(text, context) {
    const suggestions = [];
    
    // Length-based suggestions
    if (text.length > 500) {
      suggestions.push({
        type: 'readability',
        priority: 'medium',
        suggestion: 'Consider breaking this text into smaller paragraphs for better readability'
      });
    }
    
    // Content-based suggestions
    if (text.includes('http://') && !text.includes('https://')) {
      suggestions.push({
        type: 'security',
        priority: 'high',
        suggestion: 'Replace HTTP links with HTTPS for better security'
      });
    }
    
    // Context-based suggestions
    if (context.pageType === 'form') {
      suggestions.push({
        type: 'ux',
        priority: 'medium',
        suggestion: 'Consider adding input validation and clear error messages'
      });
    }
    
    return suggestions;
  }

  _generatePerformanceOptimizations(tabInfo) {
    const suggestions = [];
    
    if (tabInfo.loadTime > 3000) {
      suggestions.push('Optimize page load time - consider lazy loading and image compression');
    }
    
    if (tabInfo.memoryUsage > 100 * 1024 * 1024) { // 100MB
      suggestions.push('High memory usage detected - consider optimizing JavaScript and images');
    }
    
    return suggestions;
  }

  _analyzeReadability(content) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/).filter(w => w.length > 0);
    
    const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;
    const avgCharsPerWord = words.length > 0 ? 
      words.reduce((acc, word) => acc + word.length, 0) / words.length : 0;
    
    let readabilityScore = 'good';
    if (avgWordsPerSentence > 20 || avgCharsPerWord > 6) {
      readabilityScore = 'difficult';
    } else if (avgWordsPerSentence < 8 && avgCharsPerWord < 4) {
      readabilityScore = 'easy';
    }
    
    return {
      score: readabilityScore,
      avgWordsPerSentence,
      avgCharsPerWord,
      totalWords: words.length,
      totalSentences: sentences.length
    };
  }

  _checkAccessibility(tabInfo) {
    const issues = [];
    
    // Simulated accessibility checks
    if (!tabInfo.title || tabInfo.title.length < 10) {
      issues.push('Page title is missing or too short');
    }
    
    if (tabInfo.images && tabInfo.images.some(img => !img.alt)) {
      issues.push('Some images are missing alt text');
    }
    
    return {
      score: issues.length === 0 ? 'excellent' : issues.length < 3 ? 'good' : 'needs-improvement',
      issues
    };
  }

  _analyzeSEO(tabInfo) {
    const suggestions = [];
    
    if (!tabInfo.metaDescription) {
      suggestions.push('Add meta description for better search engine visibility');
    }
    
    if (!tabInfo.title || tabInfo.title.length > 60) {
      suggestions.push('Optimize page title length (50-60 characters recommended)');
    }
    
    return {
      score: suggestions.length === 0 ? 'good' : 'needs-improvement',
      suggestions
    };
  }

  _generateNavigationSuggestions(tabInfo) {
    const suggestions = [];
    
    if (tabInfo.url && tabInfo.url.includes('#')) {
      suggestions.push('Consider adding smooth scrolling for anchor links');
    }
    
    if (tabInfo.hasLongContent) {
      suggestions.push('Add a "back to top" button for long pages');
    }
    
    return suggestions;
  }

  _generateInteractionOptimizations(tabInfo) {
    const suggestions = [];
    
    if (tabInfo.hasForms) {
      suggestions.push('Add real-time form validation for better user experience');
    }
    
    if (tabInfo.hasClickableElements) {
      suggestions.push('Ensure touch targets are at least 44px for mobile accessibility');
    }
    
    return suggestions;
  }

  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
      activeSelections: this.activeSelections.size,
      cacheHitRate: this.metrics.cacheHits / Math.max(1, this.metrics.totalSelections),
      memoryUsage: process.memoryUsage()
    };
  }

  // Clean up resources
  destroy() {
    this.analysisProcessor.flush();
    this.taskScheduler.clear();
    this.selectionHistory.destroy();
    this.activeSelections.clear();
    this.removeAllListeners();
  }
}

export default TabSelectionManager;
