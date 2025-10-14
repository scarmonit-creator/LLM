// Ultra-Optimized Popup with Real-time Analysis Dashboard
// Features advanced metrics, performance monitoring, and beautiful UI

class UltraOptimizedPopup {
  constructor() {
    this.currentAnalysis = null;
    this.currentTab = null;
    this.isRealTimeMode = false;
    this.analysisHistory = [];
    this.performanceMetrics = {
      totalAnalyses: 0,
      avgAnalysisTime: 0,
      cacheHitRate: 0,
      lastAnalysis: null
    };
    
    this.initialize();
  }

  async initialize() {
    await this.loadCurrentTab();
    await this.loadStoredAnalysis();
    this.setupEventListeners();
    this.createAdvancedUI();
    await this.loadPerformanceMetrics();
    this.startRealTimeUpdates();
    
    console.log('🚀 Ultra-Optimized Popup initialized');
  }

  async loadCurrentTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tabs[0];
    } catch (error) {
      console.error('Failed to load current tab:', error);
    }
  }

  async loadStoredAnalysis() {
    try {
      const result = await chrome.storage.local.get([
        'lastAnalysis', 'analysisHistory', 'performanceMetrics'
      ]);
      
      if (result.lastAnalysis) {
        this.currentAnalysis = result.lastAnalysis;
        this.displayAnalysis(this.currentAnalysis);
      }
      
      if (result.analysisHistory) {
        this.analysisHistory = result.analysisHistory.slice(-10); // Keep last 10
      }
      
      if (result.performanceMetrics) {
        this.performanceMetrics = { ...this.performanceMetrics, ...result.performanceMetrics };
      }
    } catch (error) {
      console.error('Failed to load stored analysis:', error);
    }
  }

  setupEventListeners() {
    // Main action buttons
    document.getElementById('analyze-selection-btn')?.addEventListener('click', () => this.analyzeSelection());
    document.getElementById('analyze-page-btn')?.addEventListener('click', () => this.analyzePage());
    document.getElementById('analyze-custom-btn')?.addEventListener('click', () => this.analyzeCustomText());
    
    // Real-time toggle
    document.getElementById('realtime-toggle')?.addEventListener('change', (e) => {
      this.toggleRealTimeMode(e.target.checked);
    });
    
    // Analysis options
    document.getElementById('include-summary')?.addEventListener('change', () => this.updateAnalysisOptions());
    document.getElementById('keyword-limit')?.addEventListener('input', () => this.updateAnalysisOptions());
    
    // Export and clear buttons
    document.getElementById('export-btn')?.addEventListener('click', () => this.exportAnalysis());
    document.getElementById('clear-history-btn')?.addEventListener('click', () => this.clearHistory());
    
    // Performance tab
    document.getElementById('performance-tab')?.addEventListener('click', () => this.showPerformanceTab());
    document.getElementById('analysis-tab')?.addEventListener('click', () => this.showAnalysisTab());
    document.getElementById('history-tab')?.addEventListener('click', () => this.showHistoryTab());
  }

  createAdvancedUI() {
    const container = document.getElementById('app-container');
    if (!container) return;
    
    container.innerHTML = `
      <div class="ultra-popup">
        <!-- Header -->
        <div class="popup-header">
          <div class="header-title">
            <span class="title-icon">🧠</span>
            <span class="title-text">Ultra Text Analyzer</span>
            <span class="version-badge">v3.0</span>
          </div>
          <div class="header-controls">
            <label class="realtime-switch">
              <input type="checkbox" id="realtime-toggle">
              <span class="switch-slider"></span>
              <span class="switch-label">Real-time</span>
            </label>
          </div>
        </div>
        
        <!-- Tab Navigation -->
        <div class="tab-nav">
          <button class="tab-btn active" id="analysis-tab">📈 Analysis</button>
          <button class="tab-btn" id="performance-tab">⚡ Performance</button>
          <button class="tab-btn" id="history-tab">📜 History</button>
        </div>
        
        <!-- Analysis Tab -->
        <div class="tab-content" id="analysis-content">
          <!-- Quick Actions -->
          <div class="quick-actions">
            <button class="action-btn primary" id="analyze-selection-btn">
              <span class="btn-icon">🔍</span>
              <span class="btn-text">Analyze Selection</span>
            </button>
            <button class="action-btn secondary" id="analyze-page-btn">
              <span class="btn-icon">📝</span>
              <span class="btn-text">Analyze Page</span>
            </button>
            <button class="action-btn tertiary" id="analyze-custom-btn">
              <span class="btn-icon">⚙️</span>
              <span class="btn-text">Custom Text</span>
            </button>
          </div>
          
          <!-- Analysis Options -->
          <div class="analysis-options">
            <div class="options-title">Analysis Options</div>
            <div class="option-group">
              <label class="option-label">
                <input type="checkbox" id="include-summary" checked>
                <span class="checkmark"></span>
                Include Summary
              </label>
              <label class="option-label">
                <span class="label-text">Keywords Limit:</span>
                <input type="range" id="keyword-limit" min="5" max="20" value="10" class="range-input">
                <span class="range-value" id="keyword-limit-value">10</span>
              </label>
            </div>
          </div>
          
          <!-- Analysis Results -->
          <div class="analysis-results" id="analysis-results">
            <div class="no-analysis">
              <div class="no-analysis-icon">📋</div>
              <div class="no-analysis-text">Select text or click Analyze Page to begin</div>
            </div>
          </div>
        </div>
        
        <!-- Performance Tab -->
        <div class="tab-content hidden" id="performance-content">
          <div class="performance-dashboard">
            <div class="perf-metrics-grid" id="perf-metrics-grid">
              <!-- Metrics will be populated here -->
            </div>
            <div class="perf-charts" id="perf-charts">
              <!-- Charts will be populated here -->
            </div>
          </div>
        </div>
        
        <!-- History Tab -->
        <div class="tab-content hidden" id="history-content">
          <div class="history-controls">
            <button class="history-btn" id="export-btn">📤 Export</button>
            <button class="history-btn danger" id="clear-history-btn">🗑️ Clear</button>
          </div>
          <div class="history-list" id="history-list">
            <!-- History items will be populated here -->
          </div>
        </div>
        
        <!-- Custom Text Modal -->
        <div class="modal hidden" id="custom-text-modal">
          <div class="modal-content">
            <div class="modal-header">
              <h3>Analyze Custom Text</h3>
              <button class="modal-close" id="modal-close">×</button>
            </div>
            <div class="modal-body">
              <textarea id="custom-text-input" placeholder="Paste or type your text here..."></textarea>
              <div class="modal-actions">
                <button class="modal-btn secondary" id="modal-cancel">Cancel</button>
                <button class="modal-btn primary" id="modal-analyze">Analyze</button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Loading Overlay -->
        <div class="loading-overlay hidden" id="loading-overlay">
          <div class="loading-spinner"></div>
          <div class="loading-text">Analyzing...</div>
        </div>
      </div>
    `;
    
    this.addAdvancedStyles();
    this.setupAdvancedEventListeners();
  }

  addAdvancedStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .ultra-popup {
        width: 420px;
        min-height: 600px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px;
        overflow: hidden;
        color: #2d3748;
      }
      
      .popup-header {
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        padding: 16px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      }
      
      .header-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .title-icon {
        font-size: 20px;
      }
      
      .title-text {
        font-weight: 700;
        font-size: 16px;
        color: #2d3748;
      }
      
      .version-badge {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: 600;
      }
      
      .realtime-switch {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }
      
      .switch-slider {
        position: relative;
        width: 44px;
        height: 24px;
        background: #cbd5e0;
        border-radius: 24px;
        transition: background 0.3s;
      }
      
      .switch-slider::before {
        content: '';
        position: absolute;
        width: 20px;
        height: 20px;
        background: white;
        border-radius: 50%;
        top: 2px;
        left: 2px;
        transition: transform 0.3s;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
      
      #realtime-toggle {
        display: none;
      }
      
      #realtime-toggle:checked + .switch-slider {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }
      
      #realtime-toggle:checked + .switch-slider::before {
        transform: translateX(20px);
      }
      
      .switch-label {
        font-size: 12px;
        font-weight: 500;
        color: #4a5568;
      }
      
      .tab-nav {
        display: flex;
        background: rgba(255, 255, 255, 0.9);
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      }
      
      .tab-btn {
        flex: 1;
        padding: 12px 16px;
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        color: #718096;
        transition: all 0.3s;
      }
      
      .tab-btn.active {
        color: #4c51bf;
        background: white;
        border-bottom: 2px solid #4c51bf;
      }
      
      .tab-content {
        background: white;
        padding: 20px;
        min-height: 500px;
      }
      
      .tab-content.hidden {
        display: none;
      }
      
      .quick-actions {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
        margin-bottom: 24px;
      }
      
      .action-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 14px 20px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
        transition: all 0.3s;
      }
      
      .action-btn.primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
      
      .action-btn.secondary {
        background: #f7fafc;
        color: #4a5568;
        border: 1px solid #e2e8f0;
      }
      
      .action-btn.tertiary {
        background: #fff5f5;
        color: #c53030;
        border: 1px solid #fed7d7;
      }
      
      .action-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      
      .analysis-options {
        background: #f9fafb;
        padding: 16px;
        border-radius: 8px;
        margin-bottom: 24px;
      }
      
      .options-title {
        font-weight: 600;
        font-size: 14px;
        margin-bottom: 12px;
        color: #374151;
      }
      
      .option-group {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .option-label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: 13px;
      }
      
      .range-input {
        flex: 1;
        margin: 0 8px;
      }
      
      .analysis-results {
        background: #f9fafb;
        border-radius: 8px;
        min-height: 200px;
        padding: 20px;
      }
      
      .no-analysis {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 160px;
        color: #9ca3af;
      }
      
      .no-analysis-icon {
        font-size: 32px;
        margin-bottom: 8px;
      }
      
      .analysis-display {
        display: grid;
        gap: 16px;
      }
      
      .metric-card {
        background: white;
        padding: 16px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
      }
      
      .metric-title {
        font-size: 12px;
        font-weight: 600;
        color: #6b7280;
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .metric-value {
        font-size: 24px;
        font-weight: 700;
        color: #1f2937;
      }
      
      .metric-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 16px;
      }
      
      .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.95);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      
      .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #e2e8f0;
        border-top: 3px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      
      .loading-text {
        margin-top: 12px;
        color: #4a5568;
        font-weight: 500;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
      }
      
      .modal.hidden {
        display: none;
      }
      
      .modal-content {
        background: white;
        border-radius: 8px;
        width: 400px;
        max-height: 80vh;
        overflow-y: auto;
      }
      
      .modal-header {
        padding: 20px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .modal-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #9ca3af;
      }
      
      .modal-body {
        padding: 20px;
      }
      
      #custom-text-input {
        width: 100%;
        height: 200px;
        padding: 12px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-family: inherit;
        font-size: 14px;
        resize: vertical;
      }
      
      .modal-actions {
        display: flex;
        gap: 12px;
        margin-top: 16px;
        justify-content: flex-end;
      }
      
      .modal-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
      }
      
      .modal-btn.primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
      
      .modal-btn.secondary {
        background: #f3f4f6;
        color: #374151;
      }
    `;
    
    document.head.appendChild(style);
  }

  setupAdvancedEventListeners() {
    // Custom text modal
    document.getElementById('analyze-custom-btn')?.addEventListener('click', () => {
      document.getElementById('custom-text-modal').classList.remove('hidden');
    });
    
    document.getElementById('modal-close')?.addEventListener('click', () => {
      document.getElementById('custom-text-modal').classList.add('hidden');
    });
    
    document.getElementById('modal-cancel')?.addEventListener('click', () => {
      document.getElementById('custom-text-modal').classList.add('hidden');
    });
    
    document.getElementById('modal-analyze')?.addEventListener('click', () => {
      const text = document.getElementById('custom-text-input').value;
      if (text.trim()) {
        this.analyzeCustomText(text);
        document.getElementById('custom-text-modal').classList.add('hidden');
        document.getElementById('custom-text-input').value = '';
      }
    });
    
    // Keyword limit slider
    document.getElementById('keyword-limit')?.addEventListener('input', (e) => {
      document.getElementById('keyword-limit-value').textContent = e.target.value;
    });
  }

  async analyzeSelection() {
    if (!this.currentTab) return;
    
    this.showLoading();
    
    try {
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'analyzeSelectedText',
        data: this.getAnalysisOptions()
      });
      
      if (response?.success) {
        this.displayAnalysis(response.data);
        this.saveAnalysis(response.data);
      } else {
        this.showError(response?.error || 'Analysis failed');
      }
    } catch (error) {
      this.showError('Failed to analyze selection: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async analyzePage() {
    if (!this.currentTab) return;
    
    this.showLoading();
    
    try {
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'analyzePageText',
        data: this.getAnalysisOptions()
      });
      
      if (response?.success) {
        this.displayAnalysis(response.data);
        this.saveAnalysis(response.data);
      } else {
        this.showError(response?.error || 'Analysis failed');
      }
    } catch (error) {
      this.showError('Failed to analyze page: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async analyzeCustomText(text) {
    if (!text && document.getElementById('custom-text-input')) {
      text = document.getElementById('custom-text-input').value;
    }
    
    if (!text?.trim()) {
      this.showError('Please enter text to analyze');
      return;
    }
    
    this.showLoading();
    
    try {
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'analyzeCustomText',
        data: {
          text: text,
          options: this.getAnalysisOptions()
        }
      });
      
      if (response?.success) {
        this.displayAnalysis(response.data);
        this.saveAnalysis(response.data);
      } else {
        this.showError(response?.error || 'Analysis failed');
      }
    } catch (error) {
      this.showError('Failed to analyze text: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  getAnalysisOptions() {
    return {
      includeSummary: document.getElementById('include-summary')?.checked || false,
      keywordLimit: parseInt(document.getElementById('keyword-limit')?.value) || 10
    };
  }

  displayAnalysis(analysis) {
    if (!analysis || analysis.error) {
      this.showError(analysis?.error || 'Analysis data is invalid');
      return;
    }
    
    this.currentAnalysis = analysis;
    const resultsContainer = document.getElementById('analysis-results');
    
    if (!resultsContainer) return;
    
    const { basic, advanced, readability, ai, content } = analysis;
    
    resultsContainer.innerHTML = `
      <div class="analysis-display">
        <!-- Basic Metrics Grid -->
        <div class="metric-grid">
          <div class="metric-card">
            <div class="metric-title">Words</div>
            <div class="metric-value">${basic?.words?.total?.toLocaleString() || '0'}</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">Characters</div>
            <div class="metric-value">${basic?.characters?.total?.toLocaleString() || '0'}</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">Reading Time</div>
            <div class="metric-value">${basic?.readingTime?.average || '0 min'}</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">Sentences</div>
            <div class="metric-value">${basic?.sentences?.total || '0'}</div>
          </div>
        </div>
        
        <!-- Readability Card -->
        ${readability && !readability.error ? `
          <div class="metric-card">
            <div class="metric-title">Readability Analysis</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px;">
              <div>
                <div class="metric-title" style="margin-bottom: 4px;">Flesch Score</div>
                <div class="metric-value" style="font-size: 18px;">${readability.flesch?.score || '0'}</div>
                <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${readability.flesch?.level || 'Unknown'}</div>
              </div>
              <div>
                <div class="metric-title" style="margin-bottom: 4px;">Grade Level</div>
                <div class="metric-value" style="font-size: 18px;">${readability.gradeLevel?.average || '0'}</div>
                <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Average Grade</div>
              </div>
            </div>
          </div>
        ` : ''}
        
        <!-- AI Analysis Card -->
        ${ai ? `
          <div class="metric-card">
            <div class="metric-title">AI Analysis</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px;">
              <div>
                <div class="metric-title" style="margin-bottom: 4px;">Sentiment</div>
                <div class="metric-value" style="font-size: 16px; text-transform: capitalize;">${ai.sentiment?.sentiment || 'neutral'}</div>
              </div>
              <div>
                <div class="metric-title" style="margin-bottom: 4px;">Language</div>
                <div class="metric-value" style="font-size: 16px; text-transform: capitalize;">${ai.language?.primary || 'unknown'}</div>
              </div>
            </div>
            
            <!-- Keywords -->
            ${ai.keywords && ai.keywords.length > 0 ? `
              <div style="margin-top: 16px;">
                <div class="metric-title" style="margin-bottom: 8px;">Top Keywords</div>
                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                  ${ai.keywords.slice(0, 8).map(k => 
                    `<span style="background: #e0e7ff; color: #3730a3; padding: 4px 8px; border-radius: 12px; font-size: 11px;">${k.word}</span>`
                  ).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        ` : ''}
        
        <!-- Content Analysis Card -->
        ${content ? `
          <div class="metric-card">
            <div class="metric-title">Content Analysis</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px;">
              <div>
                <div class="metric-title" style="margin-bottom: 4px;">Content Type</div>
                <div class="metric-value" style="font-size: 16px; text-transform: capitalize;">${content.primaryType || 'general'}</div>
                <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${content.confidence || 'low'} confidence</div>
              </div>
              <div>
                <div class="metric-title" style="margin-bottom: 4px;">Topics</div>
                <div style="font-size: 12px;">${ai.topics?.join(', ') || 'General'}</div>
              </div>
            </div>
          </div>
        ` : ''}
        
        <!-- Summary Card -->
        ${ai?.summary ? `
          <div class="metric-card">
            <div class="metric-title">AI Summary</div>
            <div style="margin-top: 12px; font-size: 14px; line-height: 1.5; color: #374151;">
              ${ai.summary.summary || 'Summary not available'}
            </div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 8px;">
              Generated from ${ai.summary.originalSentences || 0} sentences using ${ai.summary.method || 'AI'} method
            </div>
          </div>
        ` : ''}
        
        <!-- Performance Info -->
        <div class="metric-card" style="background: #f0f9ff; border-color: #bae6fd;">
          <div class="metric-title" style="color: #0369a1;">Performance</div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
            <span style="font-size: 12px; color: #0369a1;">
              ⚡ ${analysis.processingTime?.toFixed(2) || '0.00'}ms
              ${analysis.fromCache ? ' 📋 Cache Hit' : ''}
            </span>
            <span style="font-size: 11px; color: #0369a1;">
              v${analysis.metadata?.analysisVersion || '3.0.0'}
            </span>
          </div>
        </div>
      </div>
    `;
  }

  async saveAnalysis(analysis) {
    try {
      // Add to history
      this.analysisHistory.unshift({
        ...analysis,
        timestamp: Date.now(),
        source: analysis.metadata?.source || 'unknown'
      });
      
      // Keep only last 10 analyses
      this.analysisHistory = this.analysisHistory.slice(0, 10);
      
      // Update performance metrics
      this.performanceMetrics.totalAnalyses++;
      this.performanceMetrics.lastAnalysis = Date.now();
      
      // Save to storage
      await chrome.storage.local.set({
        lastAnalysis: analysis,
        analysisHistory: this.analysisHistory,
        performanceMetrics: this.performanceMetrics
      });
    } catch (error) {
      console.error('Failed to save analysis:', error);
    }
  }

  async loadPerformanceMetrics() {
    try {
      if (this.currentTab) {
        const response = await chrome.tabs.sendMessage(this.currentTab.id, {
          action: 'getPerformanceStats'
        });
        
        if (response?.success) {
          this.performanceMetrics = { ...this.performanceMetrics, ...response.data };
        }
      }
    } catch (error) {
      console.log('Could not load performance metrics:', error);
    }
  }

  showPerformanceTab() {
    this.switchTab('performance');
    this.displayPerformanceMetrics();
  }

  showAnalysisTab() {
    this.switchTab('analysis');
  }

  showHistoryTab() {
    this.switchTab('history');
    this.displayHistory();
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });
    document.getElementById(`${tabName}-content`).classList.remove('hidden');
  }

  displayPerformanceMetrics() {
    const container = document.getElementById('perf-metrics-grid');
    if (!container) return;
    
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div class="metric-card">
          <div class="metric-title">Total Analyses</div>
          <div class="metric-value">${this.performanceMetrics.totalAnalyses || 0}</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Cache Hit Rate</div>
          <div class="metric-value">${this.performanceMetrics.cacheHitRate || 0}%</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Avg Analysis Time</div>
          <div class="metric-value">${(this.performanceMetrics.avgAnalysisTime || 0).toFixed(1)}ms</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Cache Size</div>
          <div class="metric-value">${this.performanceMetrics.cacheSize || 0}</div>
        </div>
      </div>
    `;
  }

  displayHistory() {
    const container = document.getElementById('history-list');
    if (!container) return;
    
    if (this.analysisHistory.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: #9ca3af; padding: 40px;">
          <div style="font-size: 32px; margin-bottom: 8px;">📜</div>
          <div>No analysis history yet</div>
        </div>
      `;
      return;
    }
    
    container.innerHTML = this.analysisHistory.map((analysis, index) => `
      <div class="history-item" style="padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 8px; cursor: pointer;" onclick="ultraPopup.loadHistoryItem(${index})">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-weight: 600; font-size: 14px;">${analysis.metadata?.source || 'Unknown'}</span>
          <span style="font-size: 12px; color: #6b7280;">${new Date(analysis.timestamp).toLocaleTimeString()}</span>
        </div>
        <div style="font-size: 12px; color: #9ca3af;">
          ${analysis.basic?.words?.total || 0} words • ${analysis.basic?.readingTime?.average || '0 min'}
        </div>
      </div>
    `).join('');
  }

  loadHistoryItem(index) {
    const analysis = this.analysisHistory[index];
    if (analysis) {
      this.displayAnalysis(analysis);
      this.showAnalysisTab();
    }
  }

  startRealTimeUpdates() {
    // Placeholder for real-time updates
    setInterval(async () => {
      if (this.isRealTimeMode) {
        await this.loadPerformanceMetrics();
        if (document.getElementById('performance-content').classList.contains('hidden') === false) {
          this.displayPerformanceMetrics();
        }
      }
    }, 5000);
  }

  toggleRealTimeMode(enabled) {
    this.isRealTimeMode = enabled;
    console.log(`Real-time mode: ${enabled ? 'enabled' : 'disabled'}`);
  }

  showLoading() {
    document.getElementById('loading-overlay')?.classList.remove('hidden');
  }

  hideLoading() {
    document.getElementById('loading-overlay')?.classList.add('hidden');
  }

  showError(message) {
    const resultsContainer = document.getElementById('analysis-results');
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 160px; color: #dc2626;">
          <div style="font-size: 32px; margin-bottom: 8px;">❌</div>
          <div style="font-weight: 600; margin-bottom: 4px;">Analysis Error</div>
          <div style="font-size: 12px; text-align: center;">${message}</div>
        </div>
      `;
    }
  }

  async exportAnalysis() {
    if (this.analysisHistory.length === 0) {
      alert('No analysis history to export');
      return;
    }
    
    const exportData = {
      exportDate: new Date().toISOString(),
      version: '3.0.0',
      totalAnalyses: this.analysisHistory.length,
      performanceMetrics: this.performanceMetrics,
      analyses: this.analysisHistory
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `text-analysis-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  async clearHistory() {
    if (confirm('Are you sure you want to clear all analysis history?')) {
      this.analysisHistory = [];
      await chrome.storage.local.set({ analysisHistory: [] });
      this.displayHistory();
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.ultraPopup = new UltraOptimizedPopup();
});

// Export for global access
window.UltraOptimizedPopup = UltraOptimizedPopup;