// High-performance browser content capture for LLM processing
// Optimized for minimal overhead and real-time processing

class LLMBrowserCapture {
  constructor() {
    this.config = {
      apiEndpoint: 'http://localhost:8080/ingest/look',
      debounceDelay: 500,
      maxTextLength: 5000,
      retryAttempts: 3
    };
    
    this.clientId = this.generateClientId();
    this.debounceTimer = null;
    this.performance = { captures: 0, errors: 0, avgLatency: 0 };
    
    this.init();
  }

  generateClientId() {
    return 'llm_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  init() {
    // Optimized event listeners with passive options
    document.addEventListener('selectionchange', this.handleSelectionChange.bind(this), { passive: true });
    document.addEventListener('mouseup', this.handleMouseUp.bind(this), { passive: true });
    document.addEventListener('keyup', this.handleKeyUp.bind(this), { passive: true });
    
    // Tab change detection
    this.captureTabMetadata();
    
    console.log('[LLM Capture] Initialized with client ID:', this.clientId);
  }

  handleSelectionChange() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.processSelection();
    }, this.config.debounceDelay);
  }

  handleMouseUp() {
    // Immediate capture for mouse selections
    setTimeout(() => this.processSelection(), 100);
  }

  handleKeyUp(event) {
    // Capture on Ctrl+A or other selection shortcuts
    if (event.ctrlKey && event.key === 'a') {
      setTimeout(() => this.processSelection(), 100);
    }
  }

  async processSelection() {
    const startTime = performance.now();
    
    try {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        return;
      }

      const selectedText = selection.toString().trim();
      if (!selectedText || selectedText.length < 3) {
        return;
      }

      // Truncate if too long
      const text = selectedText.length > this.config.maxTextLength 
        ? selectedText.substring(0, this.config.maxTextLength) + '...' 
        : selectedText;

      const payload = {
        type: 'look',
        source: 'selection',
        url: window.location.href,
        title: document.title,
        text: text,
        timestamp: new Date().toISOString(),
        clientId: this.clientId,
        metadata: {
          textLength: text.length,
          originalLength: selectedText.length,
          domain: window.location.hostname,
          path: window.location.pathname,
          userAgent: navigator.userAgent.substring(0, 200)
        }
      };

      await this.sendToAPI(payload);
      
      const endTime = performance.now();
      this.updatePerformanceMetrics(endTime - startTime);
      
    } catch (error) {
      console.error('[LLM Capture] Selection processing error:', error);
      this.performance.errors++;
    }
  }

  async captureTabMetadata() {
    try {
      const payload = {
        type: 'look',
        source: 'tab',
        url: window.location.href,
        title: document.title,
        text: '',
        timestamp: new Date().toISOString(),
        clientId: this.clientId,
        metadata: {
          domain: window.location.hostname,
          path: window.location.pathname,
          referrer: document.referrer,
          userAgent: navigator.userAgent.substring(0, 200),
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        }
      };

      await this.sendToAPI(payload);
    } catch (error) {
      console.error('[LLM Capture] Tab metadata error:', error);
    }
  }

  async sendToAPI(payload, attempt = 1) {
    try {
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-LLM-Client-ID': this.clientId,
          'X-LLM-Source': 'browser-extension'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[LLM Capture] Successfully sent:', result.id || 'unknown');
      
      this.performance.captures++;
      
    } catch (error) {
      console.error(`[LLM Capture] API error (attempt ${attempt}):`, error);
      
      if (attempt < this.config.retryAttempts) {
        await this.delay(1000 * attempt);
        return this.sendToAPI(payload, attempt + 1);
      }
      
      this.performance.errors++;
      throw error;
    }
  }

  updatePerformanceMetrics(latency) {
    const count = this.performance.captures;
    this.performance.avgLatency = ((this.performance.avgLatency * (count - 1)) + latency) / count;
  }

  getPerformanceStats() {
    return {
      ...this.performance,
      clientId: this.clientId,
      uptime: Date.now() - parseInt(this.clientId.split('_')[2])
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize capture when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.llmCapture = new LLMBrowserCapture();
  });
} else {
  window.llmCapture = new LLMBrowserCapture();
}

// Expose performance stats globally
window.getLLMCaptureStats = () => window.llmCapture?.getPerformanceStats() || null;