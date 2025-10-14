// Enhanced background service worker with performance optimizations
// Advanced autonomous execution and caching capabilities

class ExtensionManager {
  constructor() {
    this.textCache = new Map();
    this.analysisCache = new Map();
    this.config = {
      autoAnalyze: true,
      autoOpen: true,
      autoAnalyzeDelay: 2000,
      cacheTimeout: 300000, // 5 minutes
      maxCacheSize: 100
    };
    this.initialize();
  }

  async initialize() {
    // Load saved configuration
    const stored = await chrome.storage.local.get(['config']);
    if (stored.config) {
      this.config = { ...this.config, ...stored.config };
    }

    // Create context menus
    this.createContextMenus();

    // Setup listeners
    this.setupListeners();

    // Cleanup old cache entries
    this.cleanupCache();
  }

  createContextMenus() {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'analyzeSelectedText',
        title: 'Analyze selected text',
        contexts: ['selection']
      });

      chrome.contextMenus.create({
        id: 'analyzePage',
        title: 'Analyze page text',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'separator',
        type: 'separator',
        contexts: ['selection', 'page']
      });

      chrome.contextMenus.create({
        id: 'toggleAutoAnalyze',
        title: this.config.autoAnalyze ? 'Disable auto-analyze' : 'Enable auto-analyze',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'openOptions',
        title: 'Extension options',
        contexts: ['page']
      });
    });
  }

  setupListeners() {
    // Context menu clicks
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab);
    });

    // Message handling
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open
    });

    // Keyboard commands
    chrome.commands.onCommand.addListener((command) => {
      this.handleCommand(command);
    });

    // Tab updates for auto-analysis
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && this.config.autoAnalyze) {
        this.scheduleAutoAnalysis(tabId, tab.url);
      }
    });
  }

  async handleContextMenuClick(info, tab) {
    switch (info.menuItemId) {
      case 'analyzeSelectedText':
        await this.analyzeSelection(info.selectionText, tab);
        break;
      case 'analyzePage':
        await this.analyzePage(tab.id);
        break;
      case 'toggleAutoAnalyze':
        await this.toggleAutoAnalyze();
        break;
      case 'openOptions':
        chrome.runtime.openOptionsPage();
        break;
    }
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'getPageText':
          const text = await this.getPageText(request.tabId);
          sendResponse({ text });
          break;

        case 'analyzeText':
          const analysis = await this.performAnalysis(request.text, request.source);
          sendResponse({ analysis });
          break;

        case 'autoAnalyzeText':
          await this.handleAutoAnalysis(request.text, request.source, request.url);
          sendResponse({ success: true });
          break;

        case 'getConfig':
          sendResponse({ config: this.config });
          break;

        case 'updateConfig':
          await this.updateConfig(request.config);
          sendResponse({ success: true });
          break;

        case 'clearCache':
          this.clearAllCache();
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ error: error.message });
    }
  }

  async handleCommand(command) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    switch (command) {
      case 'analyze-page':
        await this.analyzePage(tab.id);
        break;
      case 'analyze-selection':
        await this.analyzeSelectedText(tab.id);
        break;
      case 'toggle-auto-analyze':
        await this.toggleAutoAnalyze();
        break;
    }
  }

  async getPageText(tabId) {
    const cacheKey = `page_${tabId}`;
    const cached = this.textCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
      return cached.text;
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          // Use content script if available, fallback to direct extraction
          if (typeof textExtractor !== 'undefined') {
            return textExtractor.getVisibleText();
          } else {
            return document.body.innerText;
          }
        }
      });

      const text = results[0]?.result || '';
      
      // Cache the result
      this.textCache.set(cacheKey, {
        text,
        timestamp: Date.now()
      });

      // Cleanup cache if too large
      if (this.textCache.size > this.config.maxCacheSize) {
        this.cleanupCache();
      }

      return text;
    } catch (error) {
      console.error('Failed to extract page text:', error);
      return '';
    }
  }

  async performAnalysis(text, source = 'unknown') {
    if (!text || text.length === 0) {
      return null;
    }

    const cacheKey = `analysis_${this.hashString(text)}`;
    const cached = this.analysisCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
      return cached.analysis;
    }

    // Perform enhanced analysis
    const analysis = {
      source,
      timestamp: Date.now(),
      
      // Basic counts
      charCount: text.length,
      charNoSpaceCount: text.replace(/\s/g, '').length,
      
      // Word analysis
      words: this.extractWords(text),
      wordCount: 0,
      avgWordLength: 0,
      
      // Line and paragraph analysis
      lineCount: text.split(/\n/).length,
      paragraphCount: text.split(/\n\s*\n/).filter(p => p.trim()).length,
      
      // Sentence analysis
      sentences: this.extractSentences(text),
      sentenceCount: 0,
      avgSentenceLength: 0,
      
      // Advanced metrics
      readingTime: 0,
      complexityScore: 0,
      languageMetrics: {}
    };

    // Calculate word metrics
    analysis.wordCount = analysis.words.length;
    if (analysis.wordCount > 0) {
      const totalWordChars = analysis.words.join('').length;
      analysis.avgWordLength = (totalWordChars / analysis.wordCount).toFixed(2);
    }

    // Calculate sentence metrics
    analysis.sentenceCount = analysis.sentences.length;
    if (analysis.sentenceCount > 0) {
      const totalSentenceWords = analysis.sentences.reduce((sum, s) => {
        return sum + this.extractWords(s).length;
      }, 0);
      analysis.avgSentenceLength = (totalSentenceWords / analysis.sentenceCount).toFixed(2);
    }

    // Calculate reading time (average 200 words per minute)
    analysis.readingTime = Math.ceil(analysis.wordCount / 200);

    // Calculate complexity score (Flesch Reading Ease approximation)
    if (analysis.sentenceCount > 0 && analysis.wordCount > 0) {
      const avgSentenceLength = analysis.wordCount / analysis.sentenceCount;
      const avgSyllables = this.estimateSyllables(text) / analysis.wordCount;
      analysis.complexityScore = Math.max(0, Math.min(100, 
        206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllables)
      )).toFixed(1);
    }

    // Language metrics
    analysis.languageMetrics = this.calculateLanguageMetrics(text);

    // Cache the result
    this.analysisCache.set(cacheKey, {
      analysis,
      timestamp: Date.now()
    });

    return analysis;
  }

  extractWords(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0);
  }

  extractSentences(text) {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }

  estimateSyllables(text) {
    // Simple syllable estimation
    const words = this.extractWords(text.toLowerCase());
    let totalSyllables = 0;
    
    words.forEach(word => {
      let syllables = word.match(/[aeiouy]+/g);
      if (syllables) {
        totalSyllables += syllables.length;
      } else {
        totalSyllables += 1; // Minimum 1 syllable per word
      }
    });
    
    return totalSyllables;
  }

  calculateLanguageMetrics(text) {
    const words = this.extractWords(text.toLowerCase());
    const wordFreq = {};
    
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    
    const uniqueWords = Object.keys(wordFreq).length;
    const lexicalDiversity = words.length > 0 ? (uniqueWords / words.length).toFixed(3) : 0;
    
    return {
      uniqueWords,
      lexicalDiversity,
      mostCommonWords: Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }))
    };
  }

  async analyzeSelection(selectedText, tab) {
    if (!selectedText) return;
    
    await this.storeAnalysisData({
      text: selectedText,
      source: 'selection',
      url: tab.url,
      timestamp: Date.now()
    });
    
    if (this.config.autoOpen) {
      chrome.action.openPopup();
    }
  }

  async analyzePage(tabId) {
    const text = await this.getPageText(tabId);
    if (!text) return;
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    await this.storeAnalysisData({
      text,
      source: 'page',
      url: tab?.url,
      timestamp: Date.now()
    });
    
    if (this.config.autoOpen) {
      chrome.action.openPopup();
    }
  }

  async analyzeSelectedText(tabId) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.getSelection().toString().trim()
      });
      
      const selectedText = results[0]?.result;
      if (selectedText) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await this.analyzeSelection(selectedText, tab);
      }
    } catch (error) {
      console.error('Failed to get selected text:', error);
    }
  }

  async handleAutoAnalysis(text, source, url) {
    if (!this.config.autoAnalyze || !text || text.length < 100) return;
    
    const analysis = await this.performAnalysis(text, source);
    
    // Store for later retrieval
    await chrome.storage.local.set({
      lastAutoAnalysis: {
        text,
        analysis,
        source,
        url,
        timestamp: Date.now()
      }
    });
  }

  async storeAnalysisData(data) {
    await chrome.storage.local.set({
      analysisText: data.text,
      analysisSource: data.source,
      analysisUrl: data.url,
      timestamp: data.timestamp
    });
  }

  async toggleAutoAnalyze() {
    this.config.autoAnalyze = !this.config.autoAnalyze;
    await this.updateConfig({ autoAnalyze: this.config.autoAnalyze });
    this.createContextMenus(); // Refresh menu
    
    // Show notification
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'Text Analyzer',
      message: `Auto-analyze ${this.config.autoAnalyze ? 'enabled' : 'disabled'}`
    });
  }

  async updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    await chrome.storage.local.set({ config: this.config });
  }

  scheduleAutoAnalysis(tabId, url) {
    if (!this.config.autoAnalyze) return;
    
    setTimeout(async () => {
      try {
        const text = await this.getPageText(tabId);
        if (text && text.length > 100) {
          await this.handleAutoAnalysis(text, 'auto-page', url);
        }
      } catch (error) {
        // Silently ignore errors for auto-analysis
      }
    }, this.config.autoAnalyzeDelay);
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  cleanupCache() {
    const now = Date.now();
    
    // Clean text cache
    for (const [key, value] of this.textCache.entries()) {
      if (now - value.timestamp > this.config.cacheTimeout) {
        this.textCache.delete(key);
      }
    }
    
    // Clean analysis cache
    for (const [key, value] of this.analysisCache.entries()) {
      if (now - value.timestamp > this.config.cacheTimeout) {
        this.analysisCache.delete(key);
      }
    }
  }

  clearAllCache() {
    this.textCache.clear();
    this.analysisCache.clear();
  }
}

// Initialize extension manager
const extensionManager = new ExtensionManager();

// Handle extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});
