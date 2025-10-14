// Enhanced popup logic for Selected Text Analyzer extension
// Now includes autonomous execution controls and advanced automation features

class PopupController {
  constructor() {
    this.currentText = '';
    this.currentSource = '';
    this.isAutonomousMode = false;
    this.activeTab = null;
    
    this.initialize();
  }

  async initialize() {
    await this.loadStoredText();
    this.setupEventListeners();
    await this.checkAutonomousMode();
    await this.updateUI();
  }

  setupEventListeners() {
    // Original functionality
    document.getElementById('analyze-btn')?.addEventListener('click', () => this.runAnalysis());
    document.getElementById('copy-btn')?.addEventListener('click', () => this.copyText());
    document.getElementById('analyze-page-btn')?.addEventListener('click', () => this.analyzeCurrentPage());
    
    // New autonomous execution controls
    document.getElementById('start-autonomous-btn')?.addEventListener('click', () => this.startAutonomousMode());
    document.getElementById('stop-autonomous-btn')?.addEventListener('click', () => this.stopAutonomousMode());
    document.getElementById('fix-issues-btn')?.addEventListener('click', () => this.fixPageIssues());
    document.getElementById('extract-data-btn')?.addEventListener('click', () => this.extractPageData());
    
    // Advanced controls
    document.getElementById('screenshot-btn')?.addEventListener('click', () => this.takeScreenshot());
    document.getElementById('clear-storage-btn')?.addEventListener('click', () => this.clearStoredData());
    
    // Settings
    document.getElementById('settings-btn')?.addEventListener('click', () => this.toggleSettings());
    document.getElementById('save-settings-btn')?.addEventListener('click', () => this.saveSettings());
    
    // Auto-analyze setting
    chrome.storage.local.get(['autoAnalyze'], (result) => {
      if (result.autoAnalyze && this.currentText) {
        setTimeout(() => this.runAnalysis(), 100);
      }
    });
  }

  async loadStoredText() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['analysisText', 'analysisSource', 'timestamp', 'tabId'], (result) => {
        if (result.analysisText) {
          this.currentText = result.analysisText;
          this.currentSource = result.analysisSource || 'unknown';
          this.displayTextInfo();
        } else {
          this.showNoDataMessage();
        }
        resolve();
      });
    });
  }

  async checkAutonomousMode() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        this.activeTab = tabs[0];
        
        // Check if autonomous mode is active for this tab
        chrome.storage.local.get(['autonomousMode', 'autonomousTabId'], (result) => {
          this.isAutonomousMode = result.autonomousMode && result.autonomousTabId === tabs[0].id;
          this.updateAutonomousControls();
        });
      }
    } catch (error) {
      console.error('Failed to check autonomous mode:', error);
    }
  }

  updateAutonomousControls() {
    const startBtn = document.getElementById('start-autonomous-btn');
    const stopBtn = document.getElementById('stop-autonomous-btn');
    const statusEl = document.getElementById('autonomous-status');
    
    if (this.isAutonomousMode) {
      if (startBtn) startBtn.style.display = 'none';
      if (stopBtn) stopBtn.style.display = 'block';
      if (statusEl) {
        statusEl.textContent = 'Autonomous Mode: ACTIVE';
        statusEl.className = 'status active';
      }
    } else {
      if (startBtn) startBtn.style.display = 'block';
      if (stopBtn) stopBtn.style.display = 'none';
      if (statusEl) {
        statusEl.textContent = 'Autonomous Mode: INACTIVE';
        statusEl.className = 'status inactive';
      }
    }
  }

  async updateUI() {
    // Update page info
    if (this.activeTab) {
      const pageTitle = document.getElementById('page-title');
      const pageUrl = document.getElementById('page-url');
      
      if (pageTitle) {
        pageTitle.textContent = this.activeTab.title || 'Unknown Page';
      }
      if (pageUrl) {
        pageUrl.textContent = this.activeTab.url || '';
        pageUrl.title = this.activeTab.url || '';
      }
    }
    
    // Check for page issues
    await this.checkPageIssues();
  }

  async analyzeCurrentPage() {
    if (!this.activeTab) return;
    
    const btn = document.getElementById('analyze-page-btn');
    if (btn) {
      btn.textContent = 'Loading...';
      btn.disabled = true;
    }
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getPageText',
        tabId: this.activeTab.id
      });
      
      if (response && response.text) {
        this.currentText = response.text;
        this.currentSource = 'page';
        
        // Store the text
        chrome.storage.local.set({
          analysisText: this.currentText,
          analysisSource: this.currentSource,
          timestamp: Date.now()
        });
        
        this.displayTextInfo();
        this.runAnalysis();
      } else {
        this.showError('Failed to extract page text. Make sure the page has loaded.');
      }
    } catch (error) {
      this.showError('Error analyzing page: ' + error.message);
    } finally {
      if (btn) {
        btn.textContent = 'Analyze Current Page';
        btn.disabled = false;
      }
    }
  }

  async startAutonomousMode() {
    if (!this.activeTab) return;
    
    const btn = document.getElementById('start-autonomous-btn');
    if (btn) {
      btn.textContent = 'Starting...';
      btn.disabled = true;
    }
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'startAutonomousMode',
        tabId: this.activeTab.id
      });
      
      if (response?.success) {
        this.isAutonomousMode = true;
        chrome.storage.local.set({
          autonomousMode: true,
          autonomousTabId: this.activeTab.id
        });
        
        this.updateAutonomousControls();
        this.showSuccess('Autonomous mode started successfully!');
      } else {
        this.showError('Failed to start autonomous mode');
      }
    } catch (error) {
      this.showError('Error starting autonomous mode: ' + error.message);
    } finally {
      if (btn) {
        btn.textContent = 'Start Autonomous Mode';
        btn.disabled = false;
      }
    }
  }

  async stopAutonomousMode() {
    const response = await chrome.runtime.sendMessage({
      action: 'stopAutonomousMode'
    });
    
    if (response?.success) {
      this.isAutonomousMode = false;
      chrome.storage.local.set({
        autonomousMode: false,
        autonomousTabId: null
      });
      
      this.updateAutonomousControls();
      this.showSuccess('Autonomous mode stopped');
    }
  }

  async fixPageIssues() {
    if (!this.activeTab) return;
    
    const btn = document.getElementById('fix-issues-btn');
    if (btn) {
      btn.textContent = 'Fixing...';
      btn.disabled = true;
    }
    
    try {
      // First, check for issues
      const response = await chrome.tabs.sendMessage(this.activeTab.id, {
        action: 'analyzePageIssues'
      });
      
      if (response?.success) {
        const issues = response.issues;
        
        if (issues.length > 0) {
          this.displayIssues(issues);
          
          // Start fixing
          const fixResponse = await chrome.tabs.sendMessage(this.activeTab.id, {
            action: 'startAutonomousExecution',
            task: {
              type: 'fix_issues',
              issues: issues
            }
          });
          
          if (fixResponse?.success) {
            this.showSuccess(`Found and fixing ${issues.length} issues`);
          }
        } else {
          this.showSuccess('No issues found on this page');
        }
      }
    } catch (error) {
      this.showError('Error fixing page issues: ' + error.message);
    } finally {
      if (btn) {
        btn.textContent = 'Fix Page Issues';
        btn.disabled = false;
      }
    }
  }

  async extractPageData() {
    if (!this.activeTab) return;
    
    try {
      const response = await chrome.tabs.sendMessage(this.activeTab.id, {
        action: 'getPageData'
      });
      
      if (response?.success) {
        this.displayExtractedData(response.data);
        
        // Store extracted data
        chrome.storage.local.set({
          lastExtractedData: response.data,
          extractionTime: Date.now()
        });
        
        this.showSuccess('Page data extracted successfully');
      }
    } catch (error) {
      this.showError('Error extracting page data: ' + error.message);
    }
  }

  async takeScreenshot() {
    const btn = document.getElementById('screenshot-btn');
    if (btn) {
      btn.textContent = 'Taking...';
      btn.disabled = true;
    }
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'takeScreenshot'
      });
      
      if (response?.success) {
        // Create download link
        const link = document.createElement('a');
        link.href = response.dataUrl;
        link.download = `screenshot-${Date.now()}.png`;
        link.click();
        
        this.showSuccess('Screenshot saved');
      }
    } catch (error) {
      this.showError('Error taking screenshot: ' + error.message);
    } finally {
      if (btn) {
        btn.textContent = 'Take Screenshot';
        btn.disabled = false;
      }
    }
  }

  async checkPageIssues() {
    if (!this.activeTab) return;
    
    try {
      const response = await chrome.tabs.sendMessage(this.activeTab.id, {
        action: 'analyzePageIssues'
      });
      
      if (response?.success) {
        const issueCount = response.issues.length;
        const issueCountEl = document.getElementById('issue-count');
        
        if (issueCountEl) {
          if (issueCount > 0) {
            issueCountEl.textContent = `${issueCount} issues detected`;
            issueCountEl.className = 'issue-count warning';
          } else {
            issueCountEl.textContent = 'No issues detected';
            issueCountEl.className = 'issue-count success';
          }
        }
      }
    } catch (error) {
      console.log('Could not check page issues (content script not loaded):', error);
    }
  }

  displayTextInfo() {
    // Hide no-data message
    const contentDiv = document.getElementById('content');
    if (contentDiv) contentDiv.style.display = 'none';
    
    // Show analysis container
    const container = document.getElementById('analysis-container');
    if (container) container.style.display = 'block';
    
    // Update source
    const sourceText = this.currentSource === 'selection' ? 'Selected Text' : 'Full Page';
    const sourceEl = document.getElementById('source');
    if (sourceEl) sourceEl.textContent = sourceText;
    
    // Update length
    const lengthEl = document.getElementById('length');
    if (lengthEl) lengthEl.textContent = `${this.currentText.length.toLocaleString()} characters`;
    
    // Update text preview
    const preview = this.currentText.length > 500 
      ? this.currentText.substring(0, 500) + '...' 
      : this.currentText;
    const previewEl = document.getElementById('text-preview');
    if (previewEl) previewEl.textContent = preview;
  }

  showNoDataMessage() {
    const contentDiv = document.getElementById('content');
    if (contentDiv) contentDiv.style.display = 'block';
    
    const container = document.getElementById('analysis-container');
    if (container) container.style.display = 'none';
  }

  runAnalysis() {
    if (!this.currentText) {
      this.showError('No text to analyze');
      return;
    }
    
    // Character count (total)
    const charCount = this.currentText.length;
    
    // Character count (no spaces)
    const charNoSpaceCount = this.currentText.replace(/\s/g, '').length;
    
    // Word count
    const words = this.currentText.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;
    
    // Line count
    const lines = this.currentText.split(/\n/);
    const lineCount = lines.length;
    
    // Sentence count (approximate)
    const sentences = this.currentText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceCount = sentences.length;
    
    // Average word length
    const totalWordChars = words.join('').length;
    const avgWordLength = wordCount > 0 ? (totalWordChars / wordCount).toFixed(2) : 0;
    
    // Paragraph count
    const paragraphs = this.currentText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const paragraphCount = paragraphs.length;
    
    // Reading time (average 200 words per minute)
    const readingTimeMinutes = Math.ceil(wordCount / 200);
    
    // Display results
    this.updateStatElement('char-count', charCount.toLocaleString());
    this.updateStatElement('char-no-space-count', charNoSpaceCount.toLocaleString());
    this.updateStatElement('word-count', wordCount.toLocaleString());
    this.updateStatElement('line-count', lineCount.toLocaleString());
    this.updateStatElement('sentence-count', sentenceCount.toLocaleString());
    this.updateStatElement('paragraph-count', paragraphCount.toLocaleString());
    this.updateStatElement('avg-word-length', avgWordLength);
    this.updateStatElement('reading-time', `${readingTimeMinutes} min`);
    
    // Show results section
    const resultsDiv = document.getElementById('analysis-results');
    if (resultsDiv) resultsDiv.style.display = 'block';
  }

  updateStatElement(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  copyText() {
    if (!this.currentText) {
      this.showError('No text to copy');
      return;
    }
    
    navigator.clipboard.writeText(this.currentText).then(() => {
      const copyBtn = document.getElementById('copy-btn');
      if (copyBtn) {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
      }
    }).catch(err => {
      this.showError('Failed to copy text: ' + err);
    });
  }

  displayIssues(issues) {
    const container = document.getElementById('issues-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    issues.forEach((issue, index) => {
      const issueEl = document.createElement('div');
      issueEl.className = 'issue-item';
      issueEl.innerHTML = `
        <div class="issue-type">${issue.type.replace('_', ' ')}</div>
        <div class="issue-description">${issue.description}</div>
        <div class="issue-count">${issue.elements.length} element(s)</div>
      `;
      container.appendChild(issueEl);
    });
    
    container.style.display = 'block';
  }

  displayExtractedData(data) {
    const container = document.getElementById('extracted-data-container');
    if (!container) return;
    
    container.innerHTML = `
      <h3>Extracted Page Data</h3>
      <div><strong>Title:</strong> ${data.title}</div>
      <div><strong>URL:</strong> ${data.url}</div>
      <div><strong>Links:</strong> ${data.links?.length || 0}</div>
      <div><strong>Forms:</strong> ${data.forms?.length || 0}</div>
      <div><strong>Errors:</strong> ${data.errors?.length || 0}</div>
      <div><strong>Text Length:</strong> ${data.text?.length || 0} characters</div>
    `;
    
    container.style.display = 'block';
  }

  toggleSettings() {
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel) {
      const isVisible = settingsPanel.style.display === 'block';
      settingsPanel.style.display = isVisible ? 'none' : 'block';
      
      if (!isVisible) {
        this.loadSettings();
      }
    }
  }

  loadSettings() {
    chrome.storage.local.get([
      'autoAnalyze', 'autonomousExecution', 'maxRetries', 'delayBetweenActions', 'debugMode'
    ], (result) => {
      const autoAnalyze = document.getElementById('auto-analyze');
      const autonomousExecution = document.getElementById('autonomous-execution');
      const maxRetries = document.getElementById('max-retries');
      const delayBetweenActions = document.getElementById('delay-between-actions');
      const debugMode = document.getElementById('debug-mode');
      
      if (autoAnalyze) autoAnalyze.checked = result.autoAnalyze || false;
      if (autonomousExecution) autonomousExecution.checked = result.autonomousExecution || false;
      if (maxRetries) maxRetries.value = result.maxRetries || 3;
      if (delayBetweenActions) delayBetweenActions.value = result.delayBetweenActions || 1000;
      if (debugMode) debugMode.checked = result.debugMode || false;
    });
  }

  saveSettings() {
    const autoAnalyze = document.getElementById('auto-analyze')?.checked || false;
    const autonomousExecution = document.getElementById('autonomous-execution')?.checked || false;
    const maxRetries = parseInt(document.getElementById('max-retries')?.value) || 3;
    const delayBetweenActions = parseInt(document.getElementById('delay-between-actions')?.value) || 1000;
    const debugMode = document.getElementById('debug-mode')?.checked || false;
    
    chrome.storage.local.set({
      autoAnalyze,
      autonomousExecution,
      maxRetries,
      delayBetweenActions,
      debugMode
    }, () => {
      this.showSuccess('Settings saved');
    });
  }

  clearStoredData() {
    chrome.storage.local.clear(() => {
      this.currentText = '';
      this.currentSource = '';
      this.showNoDataMessage();
      this.showSuccess('All stored data cleared');
    });
  }

  showError(message) {
    this.showMessage(message, 'error');
  }

  showSuccess(message) {
    this.showMessage(message, 'success');
  }

  showMessage(message, type) {
    const messageEl = document.getElementById('message');
    if (messageEl) {
      messageEl.textContent = message;
      messageEl.className = `message ${type}`;
      messageEl.style.display = 'block';
      
      setTimeout(() => {
        messageEl.style.display = 'none';
      }, 3000);
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
