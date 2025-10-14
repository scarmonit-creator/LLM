// Enhanced popup logic with performance optimizations and advanced features
// Text Analyzer Pro - v2.0

class TextAnalyzerUI {
  constructor() {
    this.currentText = '';
    this.currentSource = '';
    this.currentUrl = '';
    this.analysis = null;
    this.config = {};
    this.initialize();
  }

  async initialize() {
    await this.loadConfig();
    await this.loadStoredData();
    this.setupEventListeners();
    this.applyTheme();
    
    // Auto-analyze if enabled and text is available
    if (this.config.autoAnalyze && this.currentText) {
      setTimeout(() => this.runAnalysis(), 100);
    }
  }

  async loadConfig() {
    const result = await chrome.storage.local.get(['config']);
    this.config = result.config || {
      autoAnalyze: true,
      enableAdvancedMetrics: true,
      enableWordFrequency: true,
      theme: 'auto'
    };
  }

  async loadStoredData() {
    const result = await chrome.storage.local.get([
      'analysisText', 'analysisSource', 'analysisUrl', 'timestamp'
    ]);
    
    if (result.analysisText) {
      this.currentText = result.analysisText;
      this.currentSource = result.analysisSource || 'unknown';
      this.currentUrl = result.analysisUrl || '';
      this.displayTextInfo();
    } else {
      this.showNoDataMessage();
    }
  }

  setupEventListeners() {
    // Primary buttons
    this.safeAddListener('analyze-btn', 'click', () => this.runAnalysis());
    this.safeAddListener('copy-btn', 'click', () => this.copyText());
    this.safeAddListener('analyze-page-btn', 'click', () => this.analyzeCurrentPage());
    this.safeAddListener('analyze-selection-btn', 'click', () => this.analyzeSelection());
    
    // Advanced buttons
    this.safeAddListener('export-btn', 'click', () => this.exportAnalysis());
    this.safeAddListener('clear-btn', 'click', () => this.clearData());
    this.safeAddListener('options-btn', 'click', () => this.openOptions());
    this.safeAddListener('refresh-btn', 'click', () => this.refreshAnalysis());
    
    // Quick action buttons
    this.safeAddListener('quick-stats-btn', 'click', () => this.toggleQuickStats());
    this.safeAddListener('word-cloud-btn', 'click', () => this.showWordCloud());
  }

  safeAddListener(id, event, handler) {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener(event, handler);
    }
  }

  applyTheme() {
    const theme = this.config.theme;
    document.body.setAttribute('data-theme', theme);
    
    if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  async analyzeCurrentPage() {
    const btn = document.getElementById('analyze-page-btn');
    this.setButtonLoading(btn, true);
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab found');
      
      const response = await chrome.runtime.sendMessage({
        action: 'getPageText',
        tabId: tab.id
      });
      
      if (response && response.text) {
        this.currentText = response.text;
        this.currentSource = 'page';
        this.currentUrl = tab.url;
        
        await this.storeCurrentData();
        this.displayTextInfo();
        await this.runAnalysis();
      } else {
        throw new Error('Failed to extract page text');
      }
    } catch (error) {
      this.showError('Failed to analyze page: ' + error.message);
    } finally {
      this.setButtonLoading(btn, false);
    }
  }

  async analyzeSelection() {
    const btn = document.getElementById('analyze-selection-btn');
    this.setButtonLoading(btn, true);
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab found');
      
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection().toString().trim()
      });
      
      const selectedText = results[0]?.result;
      if (!selectedText) {
        throw new Error('No text selected. Please select some text on the page first.');
      }
      
      this.currentText = selectedText;
      this.currentSource = 'selection';
      this.currentUrl = tab.url;
      
      await this.storeCurrentData();
      this.displayTextInfo();
      await this.runAnalysis();
    } catch (error) {
      this.showError('Failed to analyze selection: ' + error.message);
    } finally {
      this.setButtonLoading(btn, false);
    }
  }

  async runAnalysis() {
    if (!this.currentText) {
      this.showError('No text to analyze');
      return;
    }
    
    const analyzeBtn = document.getElementById('analyze-btn');
    this.setButtonLoading(analyzeBtn, true);
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeText',
        text: this.currentText,
        source: this.currentSource
      });
      
      if (response && response.analysis) {
        this.analysis = response.analysis;
        this.displayAnalysisResults();
      } else {
        // Fallback to local analysis
        this.analysis = this.performLocalAnalysis();
        this.displayAnalysisResults();
      }
    } catch (error) {
      console.error('Analysis error:', error);
      // Fallback to local analysis
      this.analysis = this.performLocalAnalysis();
      this.displayAnalysisResults();
    } finally {
      this.setButtonLoading(analyzeBtn, false);
    }
  }

  performLocalAnalysis() {
    const text = this.currentText;
    const words = this.extractWords(text);
    const sentences = this.extractSentences(text);
    
    return {
      source: this.currentSource,
      timestamp: Date.now(),
      charCount: text.length,
      charNoSpaceCount: text.replace(/\s/g, '').length,
      words,
      wordCount: words.length,
      avgWordLength: words.length > 0 ? (words.join('').length / words.length).toFixed(2) : 0,
      lineCount: text.split(/\n/).length,
      paragraphCount: text.split(/\n\s*\n/).filter(p => p.trim()).length,
      sentences,
      sentenceCount: sentences.length,
      avgSentenceLength: sentences.length > 0 ? (words.length / sentences.length).toFixed(2) : 0,
      readingTime: Math.ceil(words.length / 200), // 200 WPM
      complexityScore: this.calculateComplexity(text, words, sentences),
      languageMetrics: this.calculateLanguageMetrics(words)
    };
  }

  extractWords(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0);
  }

  extractSentences(text) {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }

  calculateComplexity(text, words, sentences) {
    if (sentences.length === 0 || words.length === 0) return 0;
    
    const avgSentenceLength = words.length / sentences.length;
    const avgSyllables = this.estimateSyllables(text) / words.length;
    
    return Math.max(0, Math.min(100, 
      206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllables)
    )).toFixed(1);
  }

  estimateSyllables(text) {
    const words = this.extractWords(text.toLowerCase());
    let total = 0;
    
    words.forEach(word => {
      const syllables = word.match(/[aeiouy]+/g);
      total += syllables ? syllables.length : 1;
    });
    
    return total;
  }

  calculateLanguageMetrics(words) {
    const freq = {};
    words.forEach(word => {
      const clean = word.toLowerCase().replace(/[^a-z]/g, '');
      if (clean) {
        freq[clean] = (freq[clean] || 0) + 1;
      }
    });
    
    const uniqueWords = Object.keys(freq).length;
    const lexicalDiversity = words.length > 0 ? (uniqueWords / words.length).toFixed(3) : 0;
    
    return {
      uniqueWords,
      lexicalDiversity,
      mostCommonWords: Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }))
    };
  }

  displayTextInfo() {
    this.safeSetText('source', this.getSourceDisplayName());
    this.safeSetText('length', `${this.currentText.length.toLocaleString()} characters`);
    this.safeSetText('url-display', this.currentUrl ? new URL(this.currentUrl).hostname : 'N/A');
    
    // Show preview
    const preview = this.currentText.length > 300 
      ? this.currentText.substring(0, 300) + '...'
      : this.currentText;
    this.safeSetText('text-preview', preview);
    
    this.safeShow('analysis-container');
    this.safeHide('content');
  }

  displayAnalysisResults() {
    if (!this.analysis) return;
    
    // Basic metrics
    this.safeSetText('char-count', this.analysis.charCount.toLocaleString());
    this.safeSetText('char-no-space-count', this.analysis.charNoSpaceCount.toLocaleString());
    this.safeSetText('word-count', this.analysis.wordCount.toLocaleString());
    this.safeSetText('line-count', this.analysis.lineCount.toLocaleString());
    this.safeSetText('sentence-count', this.analysis.sentenceCount.toLocaleString());
    this.safeSetText('paragraph-count', this.analysis.paragraphCount.toLocaleString());
    
    // Advanced metrics
    if (this.config.enableAdvancedMetrics) {
      this.safeSetText('avg-word-length', this.analysis.avgWordLength);
      this.safeSetText('avg-sentence-length', this.analysis.avgSentenceLength);
      this.safeSetText('reading-time', `${this.analysis.readingTime} min`);
      this.safeSetText('complexity-score', this.analysis.complexityScore);
      this.safeSetText('lexical-diversity', this.analysis.languageMetrics.lexicalDiversity);
      
      this.safeShow('advanced-metrics');
    }
    
    // Word frequency
    if (this.config.enableWordFrequency && this.analysis.languageMetrics.mostCommonWords) {
      this.displayWordFrequency(this.analysis.languageMetrics.mostCommonWords);
      this.safeShow('word-frequency');
    }
    
    this.safeShow('analysis-results');
  }

  displayWordFrequency(words) {
    const container = document.getElementById('word-frequency-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    words.forEach(({ word, count }, index) => {
      const item = document.createElement('div');
      item.className = 'word-frequency-item';
      item.innerHTML = `
        <span class="word">${word}</span>
        <span class="count">${count}</span>
        <div class="frequency-bar">
          <div class="frequency-fill" style="width: ${(count / words[0].count) * 100}%"></div>
        </div>
      `;
      container.appendChild(item);
    });
  }

  async copyText() {
    if (!this.currentText) {
      this.showError('No text to copy');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(this.currentText);
      this.showTemporaryFeedback('copy-btn', 'Copied!', 2000);
    } catch (error) {
      this.showError('Failed to copy text: ' + error.message);
    }
  }

  async exportAnalysis() {
    if (!this.analysis) {
      this.showError('No analysis to export');
      return;
    }
    
    const exportData = {
      text: this.currentText,
      analysis: this.analysis,
      source: this.currentSource,
      url: this.currentUrl,
      exportedAt: new Date().toISOString(),
      version: '2.0.0'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Download the file
    const a = document.createElement('a');
    a.href = url;
    a.download = `text-analysis-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    this.showTemporaryFeedback('export-btn', 'Exported!', 2000);
  }

  async clearData() {
    if (confirm('Clear all analysis data?')) {
      this.currentText = '';
      this.currentSource = '';
      this.currentUrl = '';
      this.analysis = null;
      
      await chrome.storage.local.remove([
        'analysisText', 'analysisSource', 'analysisUrl', 'timestamp'
      ]);
      
      this.showNoDataMessage();
      this.safeHide('analysis-results');
    }
  }

  async refreshAnalysis() {
    if (this.currentSource === 'page') {
      await this.analyzeCurrentPage();
    } else if (this.currentSource === 'selection') {
      await this.analyzeSelection();
    } else {
      await this.runAnalysis();
    }
  }

  openOptions() {
    chrome.runtime.openOptionsPage();
  }

  toggleQuickStats() {
    const container = document.getElementById('quick-stats');
    if (container) {
      container.style.display = container.style.display === 'none' ? 'block' : 'none';
    }
  }

  showWordCloud() {
    if (!this.analysis || !this.analysis.languageMetrics.mostCommonWords) {
      this.showError('No word frequency data available');
      return;
    }
    
    const container = document.getElementById('word-cloud-container');
    if (container) {
      container.style.display = container.style.display === 'none' ? 'block' : 'none';
      
      if (container.style.display === 'block') {
        this.generateWordCloud(this.analysis.languageMetrics.mostCommonWords);
      }
    }
  }

  generateWordCloud(words) {
    const container = document.getElementById('word-cloud');
    if (!container) return;
    
    container.innerHTML = '';
    
    words.forEach(({ word, count }, index) => {
      const span = document.createElement('span');
      span.className = 'word-cloud-item';
      span.textContent = word;
      span.style.fontSize = `${Math.max(12, 24 - index * 2)}px`;
      span.style.opacity = Math.max(0.5, 1 - index * 0.1);
      span.title = `${word}: ${count} occurrences`;
      container.appendChild(span);
    });
  }

  async storeCurrentData() {
    await chrome.storage.local.set({
      analysisText: this.currentText,
      analysisSource: this.currentSource,
      analysisUrl: this.currentUrl,
      timestamp: Date.now()
    });
  }

  getSourceDisplayName() {
    switch (this.currentSource) {
      case 'selection': return 'Selected Text';
      case 'page': return 'Full Page';
      case 'auto-page': return 'Auto-Analyzed Page';
      default: return 'Unknown Source';
    }
  }

  setButtonLoading(button, loading) {
    if (!button) return;
    
    if (loading) {
      button.dataset.originalText = button.textContent;
      button.textContent = 'Loading...';
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
      delete button.dataset.originalText;
    }
  }

  showTemporaryFeedback(buttonId, text, duration) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    const original = button.textContent;
    button.textContent = text;
    
    setTimeout(() => {
      button.textContent = original;
    }, duration);
  }

  showError(message) {
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
      
      setTimeout(() => {
        errorEl.style.display = 'none';
      }, 5000);
    } else {
      alert(message);
    }
  }

  showNoDataMessage() {
    this.safeShow('content');
    this.safeHide('analysis-container');
  }

  safeSetText(id, text) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = text;
    }
  }

  safeShow(id) {
    const element = document.getElementById(id);
    if (element) {
      element.style.display = 'block';
    }
  }

  safeHide(id) {
    const element = document.getElementById(id);
    if (element) {
      element.style.display = 'none';
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new TextAnalyzerUI();
});
