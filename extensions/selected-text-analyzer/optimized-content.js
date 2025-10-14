// Optimized Content Script v3.0.0
// High-performance content script with Google Cloud Console and GitHub integration

class OptimizedContentScript {
  constructor() {
    this.isInitialized = false;
    this.currentUrl = window.location.href;
    this.pageType = this.detectPageType();
    this.extractionCache = new Map();
    
    // Initialize based on page type
    this.initialize();
    
    console.log('📝 OptimizedContentScript v3.0.0 loaded for:', this.pageType);
  }

  /**
   * Initialize content script based on current page
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Set up message listener
      this.setupMessageListener();
      
      // Page-specific initialization
      switch (this.pageType) {
        case 'gcp-console':
          await this.initializeGCPConsole();
          break;
        case 'github':
          await this.initializeGitHub();
          break;
        case 'firebase':
          await this.initializeFirebase();
          break;
        default:
          await this.initializeGeneric();
      }
      
      // Set up selection monitoring
      this.setupSelectionMonitoring();
      
      this.isInitialized = true;
      console.log('✅ Content script initialized for:', this.pageType);
      
    } catch (error) {
      console.error('❌ Content script initialization failed:', error);
    }
  }

  /**
   * Detect current page type for specialized handling
   */
  detectPageType() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    
    if (hostname === 'console.cloud.google.com') {
      if (pathname.includes('/iam-admin/serviceaccounts')) {
        return 'gcp-console';
      }
      return 'gcp-general';
    }
    
    if (hostname === 'github.com') {
      return 'github';
    }
    
    if (hostname === 'firebase.google.com' || hostname.includes('firebase')) {
      return 'firebase';
    }
    
    return 'generic';
  }

  /**
   * Initialize GCP Console specific features
   */
  async initializeGCPConsole() {
    // Add extraction button for service accounts
    this.addGCPExtractionButton();
    
    // Monitor for dynamic content updates
    this.observeGCPChanges();
    
    // Pre-cache service account data if available
    await this.preCacheGCPData();
  }

  /**
   * Initialize GitHub specific features
   */
  async initializeGitHub() {
    // Add repository analysis tools
    this.addGitHubAnalysisTools();
    
    // Monitor for page navigation
    this.observeGitHubNavigation();
  }

  /**
   * Initialize Firebase Console features
   */
  async initializeFirebase() {
    // Similar to GCP Console but with Firebase-specific selectors
    this.addFirebaseTools();
  }

  /**
   * Initialize generic page features
   */
  async initializeGeneric() {
    // Basic text analysis and selection tools
    this.setupBasicTools();
  }

  /**
   * Set up message listener for background communication
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open
    });
  }

  /**
   * Handle messages from background script
   */
  async handleMessage(request, sender, sendResponse) {
    try {
      const { action, data } = request;
      let result;
      
      switch (action) {
        case 'extractGCPData':
          result = await this.extractGCPData(data);
          break;
        case 'analyzeSelection':
          result = await this.analyzeCurrentSelection();
          break;
        case 'getPageInfo':
          result = this.getPageInfo();
          break;
        case 'performHealthCheck':
          result = await this.performHealthCheck();
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
      sendResponse({ success: true, data: result });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Extract Google Cloud Console data
   */
  async extractGCPData(options = {}) {
    if (this.pageType !== 'gcp-console') {
      throw new Error('Not on GCP Console page');
    }
    
    try {
      // Check cache first
      const cacheKey = `gcp_data_${window.location.href}`;
      const cached = this.extractionCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < 30000) {
        return cached.data;
      }
      
      // Initialize GCP extractor
      if (typeof GCPConsoleExtractor === 'undefined') {
        throw new Error('GCPConsoleExtractor not loaded');
      }
      
      const extractor = new GCPConsoleExtractor();
      const extractedData = await extractor.extractAll(options);
      
      // Cache the result
      this.extractionCache.set(cacheKey, {
        data: extractedData,
        timestamp: Date.now()
      });
      
      return extractedData;
      
    } catch (error) {
      throw new Error(`GCP data extraction failed: ${error.message}`);
    }
  }

  /**
   * Analyze current text selection
   */
  async analyzeCurrentSelection() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (!selectedText) {
      throw new Error('No text selected');
    }
    
    // Send to background for analysis
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'analyzeText', data: { text: selectedText } },
        (response) => {
          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error));
          }
        }
      );
    });
  }

  /**
   * Get comprehensive page information
   */
  getPageInfo() {
    return {
      url: window.location.href,
      title: document.title,
      pageType: this.pageType,
      timestamp: Date.now(),
      
      metadata: {
        charset: document.characterSet,
        language: document.documentElement.lang,
        viewport: document.querySelector('meta[name="viewport"]')?.content,
        description: document.querySelector('meta[name="description"]')?.content,
        keywords: document.querySelector('meta[name="keywords"]')?.content
      },
      
      content: {
        headings: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
          .map(h => ({ level: h.tagName, text: h.textContent.trim() })),
        
        paragraphs: Array.from(document.querySelectorAll('p'))
          .slice(0, 10) // Limit for performance
          .map(p => p.textContent.trim())
          .filter(t => t.length > 0),
        
        links: Array.from(document.querySelectorAll('a[href]'))
          .slice(0, 20) // Limit for performance
          .map(a => ({ text: a.textContent.trim(), href: a.href })),
        
        images: Array.from(document.querySelectorAll('img'))
          .slice(0, 10) // Limit for performance
          .map(img => ({
            src: img.src,
            alt: img.alt,
            width: img.naturalWidth,
            height: img.naturalHeight
          }))
      },
      
      performance: {
        loadTime: performance.now(),
        elementsCount: document.querySelectorAll('*').length,
        documentSize: document.documentElement.innerHTML.length,
        readyState: document.readyState
      }
    };
  }

  /**
   * Perform health check on current page
   */
  async performHealthCheck() {
    const issues = [];
    
    // Check for broken images
    const brokenImages = Array.from(document.querySelectorAll('img'))
      .filter(img => !img.complete || img.naturalHeight === 0);
    if (brokenImages.length > 0) {
      issues.push({ type: 'broken_images', count: brokenImages.length });
    }
    
    // Check for form validation errors
    const invalidFields = document.querySelectorAll(':invalid');
    if (invalidFields.length > 0) {
      issues.push({ type: 'invalid_forms', count: invalidFields.length });
    }
    
    // Check for accessibility issues
    const missingAlt = document.querySelectorAll('img:not([alt])');
    if (missingAlt.length > 0) {
      issues.push({ type: 'accessibility', count: missingAlt.length, detail: 'missing_alt_text' });
    }
    
    // Check for performance issues
    const heavyElements = document.querySelectorAll('*').length;
    if (heavyElements > 5000) {
      issues.push({ type: 'performance', detail: 'heavy_dom', count: heavyElements });
    }
    
    return {
      timestamp: Date.now(),
      url: window.location.href,
      pageType: this.pageType,
      issues,
      summary: {
        totalIssues: issues.length,
        criticalIssues: issues.filter(i => i.type === 'broken_images' || i.type === 'invalid_forms').length,
        healthScore: Math.max(0, 100 - (issues.length * 10))
      }
    };
  }

  /**
   * Add GCP Console extraction button
   */
  addGCPExtractionButton() {
    // Only add if not already present
    if (document.getElementById('gcp-extractor-button')) return;
    
    const button = document.createElement('button');
    button.id = 'gcp-extractor-button';
    button.innerHTML = '🌍 Extract GCP Data';
    button.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 10000;
      padding: 8px 12px;
      background: #1a73e8;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
    
    button.onclick = async () => {
      try {
        button.innerHTML = '⏳ Extracting...';
        const data = await this.extractGCPData();
        button.innerHTML = '✅ Extracted!';
        
        // Show summary
        console.log('GCP Data Extracted:', data);
        
        setTimeout(() => {
          button.innerHTML = '🌍 Extract GCP Data';
        }, 2000);
        
      } catch (error) {
        button.innerHTML = '❌ Failed';
        console.error('Extraction failed:', error);
        
        setTimeout(() => {
          button.innerHTML = '🌍 Extract GCP Data';
        }, 2000);
      }
    };
    
    document.body.appendChild(button);
  }

  /**
   * Add GitHub analysis tools
   */
  addGitHubAnalysisTools() {
    // Only add if not already present
    if (document.getElementById('github-analyzer-button')) return;
    
    const button = document.createElement('button');
    button.id = 'github-analyzer-button';
    button.innerHTML = '🐱 Analyze Repo';
    button.style.cssText = `
      position: fixed;
      top: 50px;
      right: 10px;
      z-index: 10000;
      padding: 8px 12px;
      background: #24292e;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
    
    button.onclick = async () => {
      try {
        button.innerHTML = '⏳ Analyzing...';
        
        // Send analysis request to background
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { action: 'analyzeGitHubPage', data: {} },
            resolve
          );
        });
        
        if (response.success) {
          button.innerHTML = '✅ Analyzed!';
          console.log('GitHub Analysis:', response.data);
        } else {
          throw new Error(response.error);
        }
        
        setTimeout(() => {
          button.innerHTML = '🐱 Analyze Repo';
        }, 2000);
        
      } catch (error) {
        button.innerHTML = '❌ Failed';
        console.error('GitHub analysis failed:', error);
        
        setTimeout(() => {
          button.innerHTML = '🐱 Analyze Repo';
        }, 2000);
      }
    };
    
    document.body.appendChild(button);
  }

  /**
   * Add Firebase Console tools
   */
  addFirebaseTools() {
    // Similar to GCP Console but with Firebase-specific features
    console.log('Firebase tools initialized');
  }

  /**
   * Set up basic tools for generic pages
   */
  setupBasicTools() {
    // Add text selection analysis
    console.log('Basic tools initialized for generic page');
  }

  /**
   * Set up selection monitoring for text analysis
   */
  setupSelectionMonitoring() {
    let selectionTimeout;
    
    document.addEventListener('selectionchange', () => {
      clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(() => {
        this.handleSelectionChange();
      }, 500); // Debounce selection changes
    });
  }

  /**
   * Handle selection changes
   */
  async handleSelectionChange() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText.length > 10) {
      // Show analysis hint for substantial selections
      this.showSelectionHint(selection);
    }
  }

  /**
   * Show hint for text selection analysis
   */
  showSelectionHint(selection) {
    // Remove existing hint
    const existingHint = document.getElementById('selection-analysis-hint');
    if (existingHint) {
      existingHint.remove();
    }
    
    // Create hint element
    const hint = document.createElement('div');
    hint.id = 'selection-analysis-hint';
    hint.innerHTML = '🔍 Right-click to analyze selection';
    hint.style.cssText = `
      position: absolute;
      background: #333;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      z-index: 10000;
      pointer-events: none;
      opacity: 0.9;
    `;
    
    // Position near selection
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    hint.style.left = (rect.left + window.scrollX) + 'px';
    hint.style.top = (rect.bottom + window.scrollY + 5) + 'px';
    
    document.body.appendChild(hint);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      hint.remove();
    }, 3000);
  }

  /**
   * Observe GCP Console changes for dynamic content
   */
  observeGCPChanges() {
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if service account data might have changed
          const hasServiceAccountElements = Array.from(mutation.addedNodes)
            .some(node => node.nodeType === 1 && 
                         (node.textContent?.includes('@') || 
                          node.textContent?.includes('service account')));
          
          if (hasServiceAccountElements) {
            shouldUpdate = true;
          }
        }
      });
      
      if (shouldUpdate) {
        // Clear cache to force fresh extraction
        this.extractionCache.clear();
        console.log('🔄 GCP Console content updated, cache cleared');
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Observe GitHub navigation changes
   */
  observeGitHubNavigation() {
    // GitHub uses client-side routing, so monitor URL changes
    let currentUrl = window.location.href;
    
    const checkUrlChange = () => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        console.log('🔄 GitHub navigation detected:', currentUrl);
        
        // Clear cache and re-initialize if needed
        this.extractionCache.clear();
        
        // Update page type if needed
        this.pageType = this.detectPageType();
      }
    };
    
    // Check for URL changes periodically
    setInterval(checkUrlChange, 1000);
    
    // Also listen to popstate events
    window.addEventListener('popstate', checkUrlChange);
  }

  /**
   * Pre-cache GCP data if available
   */
  async preCacheGCPData() {
    try {
      // Wait for page to fully load
      if (document.readyState !== 'complete') {
        await new Promise(resolve => {
          window.addEventListener('load', resolve);
        });
      }
      
      // Extract and cache service account data
      setTimeout(async () => {
        try {
          await this.extractGCPData();
          console.log('📋 GCP data pre-cached successfully');
        } catch (error) {
          console.log('⚠️ GCP pre-cache failed (normal if no service account data):', error.message);
        }
      }, 1000);
      
    } catch (error) {
      console.warn('GCP pre-caching failed:', error);
    }
  }

  /**
   * Clear extraction cache
   */
  clearCache() {
    this.extractionCache.clear();
    console.log('🧹 Content script cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.extractionCache.size,
      entries: Array.from(this.extractionCache.keys()),
      oldestEntry: Math.min(...Array.from(this.extractionCache.values()).map(v => v.timestamp)),
      newestEntry: Math.max(...Array.from(this.extractionCache.values()).map(v => v.timestamp))
    };
  }
}

// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new OptimizedContentScript();
  });
} else {
  new OptimizedContentScript();
}

// Export for testing
if (typeof window !== 'undefined') {
  window.OptimizedContentScript = OptimizedContentScript;
}