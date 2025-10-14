// Enhanced content script for faster text extraction
// Injected into all pages for better performance

// Text extraction utilities
class TextExtractor {
  constructor() {
    this.cache = new Map();
    this.observers = [];
    this.setupMutationObserver();
  }

  // Setup mutation observer for dynamic content
  setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      let textChanged = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          textChanged = true;
        }
      });
      
      if (textChanged) {
        this.clearCache();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    
    this.observers.push(observer);
  }

  // Get all visible text with better performance
  getVisibleText() {
    const cacheKey = 'visible_text';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          // Skip hidden elements
          const style = getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip script and style elements
          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'meta', 'head'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textParts = [];
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent.trim();
      if (text) {
        textParts.push(text);
      }
    }

    const result = textParts.join(' ').replace(/\s+/g, ' ').trim();
    this.cache.set(cacheKey, result);
    return result;
  }

  // Get selected text with fallback
  getSelectedText() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return '';
    
    const range = selection.getRangeAt(0);
    return range.toString().trim();
  }

  // Get text from specific element
  getElementText(element) {
    if (!element) return '';
    
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textParts = [];
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent.trim();
      if (text) {
        textParts.push(text);
      }
    }

    return textParts.join(' ').replace(/\s+/g, ' ').trim();
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }

  // Cleanup observers
  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.clearCache();
  }
}

// Global text extractor instance
const textExtractor = new TextExtractor();

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    switch (request.action) {
      case 'getPageText':
        sendResponse({ text: textExtractor.getVisibleText() });
        break;
        
      case 'getSelectedText':
        sendResponse({ text: textExtractor.getSelectedText() });
        break;
        
      case 'getElementText':
        if (request.selector) {
          const element = document.querySelector(request.selector);
          sendResponse({ text: textExtractor.getElementText(element) });
        } else {
          sendResponse({ text: '' });
        }
        break;
        
      case 'clearCache':
        textExtractor.clearCache();
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Content script error:', error);
    sendResponse({ error: error.message });
  }
  
  return true; // Keep message channel open
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  textExtractor.cleanup();
});

// Auto-analyze on page load if enabled
chrome.storage.local.get(['autoAnalyze', 'autoAnalyzeDelay'], (result) => {
  if (result.autoAnalyze) {
    const delay = result.autoAnalyzeDelay || 2000; // Default 2 seconds
    setTimeout(() => {
      const text = textExtractor.getVisibleText();
      if (text && text.length > 100) { // Only analyze substantial content
        chrome.runtime.sendMessage({
          action: 'autoAnalyzeText',
          text: text,
          source: 'auto-page',
          url: window.location.href
        });
      }
    }, delay);
  }
});
