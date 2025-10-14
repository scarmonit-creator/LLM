// High-Performance Text Analyzer Module
// Optimized for autonomous execution and large text processing

class AdvancedTextAnalyzer {
  constructor() {
    this.workerPool = [];
    this.maxWorkers = navigator.hardwareConcurrency || 4;
    this.analysisCache = new Map();
    this.initializeWorkerPool();
  }

  initializeWorkerPool() {
    // Create web workers for CPU-intensive tasks
    const workerCode = `
      self.onmessage = function(e) {
        const { text, operation, id } = e.data;
        let result;
        
        switch(operation) {
          case 'wordAnalysis':
            result = analyzeWords(text);
            break;
          case 'sentenceAnalysis':
            result = analyzeSentences(text);
            break;
          case 'complexityAnalysis':
            result = analyzeComplexity(text);
            break;
          case 'languageMetrics':
            result = calculateLanguageMetrics(text);
            break;
          default:
            result = { error: 'Unknown operation' };
        }
        
        self.postMessage({ id, result });
      };
      
      function analyzeWords(text) {
        const words = text.trim().split(/\\s+/).filter(w => w.length > 0);
        const cleanWords = words.map(w => w.toLowerCase().replace(/[^a-zA-Z0-9]/g, ''));
        
        return {
          words: words,
          cleanWords: cleanWords,
          wordCount: words.length,
          uniqueWordCount: new Set(cleanWords).size,
          avgWordLength: words.length > 0 ? (words.join('').length / words.length).toFixed(2) : 0
        };
      }
      
      function analyzeSentences(text) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        return {
          sentences: sentences,
          sentenceCount: sentences.length,
          avgSentenceLength: sentences.length > 0 ? 
            (sentences.reduce((sum, s) => sum + s.split(/\\s+/).length, 0) / sentences.length).toFixed(2) : 0
        };
      }
      
      function analyzeComplexity(text) {
        const words = text.trim().split(/\\s+/).filter(w => w.length > 0);
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        if (sentences.length === 0 || words.length === 0) {
          return { complexityScore: 0, readingLevel: 'Unknown' };
        }
        
        const avgSentenceLength = words.length / sentences.length;
        const syllableCount = estimateSyllables(text);
        const avgSyllables = syllableCount / words.length;
        
        // Flesch Reading Ease
        const fleschScore = Math.max(0, Math.min(100, 
          206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllables)
        ));
        
        let readingLevel;
        if (fleschScore >= 90) readingLevel = 'Very Easy';
        else if (fleschScore >= 80) readingLevel = 'Easy';
        else if (fleschScore >= 70) readingLevel = 'Fairly Easy';
        else if (fleschScore >= 60) readingLevel = 'Standard';
        else if (fleschScore >= 50) readingLevel = 'Fairly Difficult';
        else if (fleschScore >= 30) readingLevel = 'Difficult';
        else readingLevel = 'Very Difficult';
        
        return {
          complexityScore: fleschScore.toFixed(1),
          readingLevel: readingLevel,
          avgSentenceLength: avgSentenceLength.toFixed(1),
          avgSyllables: avgSyllables.toFixed(1)
        };
      }
      
      function calculateLanguageMetrics(text) {
        const words = text.toLowerCase().split(/\\s+/).filter(w => w.length > 0);
        const cleanWords = words.map(w => w.replace(/[^a-z]/g, ''));
        const wordFreq = {};
        
        cleanWords.forEach(word => {
          if (word.length > 2) { // Filter out very short words
            wordFreq[word] = (wordFreq[word] || 0) + 1;
          }
        });
        
        const uniqueWords = Object.keys(wordFreq).length;
        const lexicalDiversity = cleanWords.length > 0 ? (uniqueWords / cleanWords.length).toFixed(3) : 0;
        
        return {
          uniqueWords,
          lexicalDiversity,
          totalWords: cleanWords.length,
          mostCommonWords: Object.entries(wordFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([word, count]) => ({ word, count, percentage: ((count / cleanWords.length) * 100).toFixed(1) }))
        };
      }
      
      function estimateSyllables(text) {
        const words = text.toLowerCase().split(/\\s+/);
        let total = 0;
        
        words.forEach(word => {
          const clean = word.replace(/[^a-z]/g, '');
          if (clean.length === 0) return;
          
          let syllables = clean.match(/[aeiouy]+/g);
          if (syllables) {
            total += syllables.length;
          } else {
            total += 1;
          }
          
          // Adjust for silent e
          if (clean.endsWith('e') && syllables && syllables.length > 1) {
            total -= 1;
          }
        });
        
        return Math.max(1, total);
      }
    `;
    
    try {
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.workerUrl = URL.createObjectURL(blob);
    } catch (error) {
      console.warn('Web Workers not available, using synchronous analysis');
    }
  }

  async analyzeText(text, options = {}) {
    const cacheKey = this.generateCacheKey(text, options);
    
    // Check cache first
    if (this.analysisCache.has(cacheKey)) {
      const cached = this.analysisCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 minutes
        return cached.result;
      }
    }

    const startTime = performance.now();
    
    try {
      let analysis;
      
      if (this.workerUrl && text.length > 1000) {
        // Use web workers for large texts
        analysis = await this.analyzeWithWorkers(text);
      } else {
        // Use synchronous analysis for smaller texts
        analysis = this.analyzeSynchronously(text);
      }
      
      analysis.processingTime = (performance.now() - startTime).toFixed(2);
      analysis.timestamp = Date.now();
      
      // Cache the result
      this.analysisCache.set(cacheKey, {
        result: analysis,
        timestamp: Date.now()
      });
      
      // Cleanup cache if too large
      if (this.analysisCache.size > 50) {
        this.cleanupCache();
      }
      
      return analysis;
    } catch (error) {
      console.error('Analysis error:', error);
      throw error;
    }
  }

  async analyzeWithWorkers(text) {
    const operations = ['wordAnalysis', 'sentenceAnalysis', 'complexityAnalysis', 'languageMetrics'];
    const promises = operations.map(op => this.runWorkerOperation(text, op));
    
    const results = await Promise.all(promises);
    
    return this.combineResults(results, text);
  }

  runWorkerOperation(text, operation) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(this.workerUrl);
      const id = Math.random().toString(36).substr(2, 9);
      
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('Worker timeout'));
      }, 10000); // 10 second timeout
      
      worker.onmessage = (e) => {
        clearTimeout(timeout);
        worker.terminate();
        
        if (e.data.id === id) {
          resolve(e.data.result);
        }
      };
      
      worker.onerror = (error) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(error);
      };
      
      worker.postMessage({ text, operation, id });
    });
  }

  analyzeSynchronously(text) {
    // Basic analysis without workers
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const lines = text.split(/\n/);
    
    // Word analysis
    const cleanWords = words.map(w => w.toLowerCase().replace(/[^a-zA-Z0-9]/g, ''));
    const wordFreq = {};
    
    cleanWords.forEach(word => {
      if (word.length > 2) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });
    
    const uniqueWords = Object.keys(wordFreq).length;
    const lexicalDiversity = cleanWords.length > 0 ? (uniqueWords / cleanWords.length).toFixed(3) : 0;
    
    // Basic complexity (simplified)
    let complexityScore = 50; // Default medium complexity
    if (sentences.length > 0 && words.length > 0) {
      const avgSentenceLength = words.length / sentences.length;
      if (avgSentenceLength > 20) complexityScore -= 20;
      else if (avgSentenceLength < 10) complexityScore += 10;
    }
    
    return {
      // Basic counts
      charCount: text.length,
      charNoSpaceCount: text.replace(/\s/g, '').length,
      wordCount: words.length,
      lineCount: lines.length,
      paragraphCount: paragraphs.length,
      sentenceCount: sentences.length,
      
      // Averages
      avgWordLength: words.length > 0 ? (words.join('').length / words.length).toFixed(2) : 0,
      avgSentenceLength: sentences.length > 0 ? (words.length / sentences.length).toFixed(2) : 0,
      
      // Advanced metrics
      complexityScore: complexityScore.toFixed(1),
      readingTime: Math.ceil(words.length / 250), // 250 WPM for faster reading
      lexicalDiversity,
      uniqueWords,
      
      // Language metrics
      mostCommonWords: Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({ 
          word, 
          count, 
          percentage: ((count / cleanWords.length) * 100).toFixed(1) 
        }))
    };
  }

  combineResults(results, text) {
    const [wordData, sentenceData, complexityData, languageData] = results;
    
    return {
      // Basic counts
      charCount: text.length,
      charNoSpaceCount: text.replace(/\s/g, '').length,
      wordCount: wordData.wordCount,
      lineCount: text.split(/\n/).length,
      paragraphCount: text.split(/\n\s*\n/).filter(p => p.trim()).length,
      sentenceCount: sentenceData.sentenceCount,
      
      // Advanced metrics
      avgWordLength: wordData.avgWordLength,
      avgSentenceLength: sentenceData.avgSentenceLength,
      complexityScore: complexityData.complexityScore,
      readingLevel: complexityData.readingLevel,
      readingTime: Math.ceil(wordData.wordCount / 250),
      
      // Language metrics
      uniqueWords: languageData.uniqueWords,
      lexicalDiversity: languageData.lexicalDiversity,
      mostCommonWords: languageData.mostCommonWords
    };
  }

  generateCacheKey(text, options) {
    const textHash = this.simpleHash(text);
    const optionsHash = this.simpleHash(JSON.stringify(options));
    return `${textHash}_${optionsHash}`;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  cleanupCache() {
    // Remove oldest entries when cache is full
    const entries = Array.from(this.analysisCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 25% of entries
    const toRemove = Math.floor(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      this.analysisCache.delete(entries[i][0]);
    }
  }

  // Autonomous text extraction with intelligent selection
  async extractOptimalText(tabId) {
    const strategies = [
      this.extractMainContent,
      this.extractArticleContent,
      this.extractReadableContent,
      this.extractBodyText
    ];
    
    for (const strategy of strategies) {
      try {
        const result = await strategy.call(this, tabId);
        if (result && result.length > 100) {
          return {
            text: result,
            extractionMethod: strategy.name,
            confidence: this.calculateExtractionConfidence(result)
          };
        }
      } catch (error) {
        console.warn(`Extraction strategy ${strategy.name} failed:`, error);
      }
    }
    
    throw new Error('No suitable text extraction method found');
  }

  async extractMainContent(tabId) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Try multiple selectors for main content
        const selectors = [
          'main',
          'article',
          '[role="main"]',
          '.main-content',
          '#main-content',
          '.content',
          '#content'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            return element.innerText;
          }
        }
        return null;
      }
    });
    
    return results[0]?.result;
  }

  async extractArticleContent(tabId) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const article = document.querySelector('article');
        if (article) return article.innerText;
        
        // Look for content in common article containers
        const containers = document.querySelectorAll('[class*="article"], [class*="post"], [class*="entry"]');
        for (const container of containers) {
          if (container.innerText.length > 200) {
            return container.innerText;
          }
        }
        return null;
      }
    });
    
    return results[0]?.result;
  }

  async extractReadableContent(tabId) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Extract text while excluding navigation, ads, etc.
        const excludeSelectors = [
          'nav', 'header', 'footer', 'aside',
          '.nav', '.navigation', '.menu',
          '.ad', '.ads', '.advertisement',
          '.sidebar', '.widget', '.comment'
        ];
        
        // Clone document to avoid modifying original
        const clone = document.cloneNode(true);
        
        // Remove excluded elements
        excludeSelectors.forEach(selector => {
          const elements = clone.querySelectorAll(selector);
          elements.forEach(el => el.remove());
        });
        
        return clone.body.innerText;
      }
    });
    
    return results[0]?.result;
  }

  async extractBodyText(tabId) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.body.innerText
    });
    
    return results[0]?.result;
  }

  calculateExtractionConfidence(text) {
    let score = 0;
    
    // Length factor
    if (text.length > 1000) score += 30;
    else if (text.length > 500) score += 20;
    else if (text.length > 100) score += 10;
    
    // Sentence structure
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 5) score += 20;
    
    // Paragraph structure
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    if (paragraphs.length > 2) score += 20;
    
    // Word variety
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words).size;
    if (words.length > 0 && (uniqueWords / words.length) > 0.5) score += 20;
    
    // Avoid navigation-like content
    const navKeywords = ['home', 'about', 'contact', 'menu', 'login', 'search'];
    const hasNavContent = navKeywords.some(keyword => 
      text.toLowerCase().includes(keyword) && text.length < 200
    );
    if (hasNavContent) score -= 30;
    
    return Math.max(0, Math.min(100, score));
  }

  // Performance monitoring
  getPerformanceMetrics() {
    return {
      cacheSize: this.analysisCache.size,
      availableWorkers: this.maxWorkers,
      memoryUsage: performance.memory ? {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
      } : null
    };
  }

  clearCache() {
    this.analysisCache.clear();
  }

  destroy() {
    this.clearCache();
    if (this.workerUrl) {
      URL.revokeObjectURL(this.workerUrl);
    }
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdvancedTextAnalyzer;
} else if (typeof window !== 'undefined') {
  window.AdvancedTextAnalyzer = AdvancedTextAnalyzer;
}
