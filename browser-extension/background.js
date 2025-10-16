// Background service worker for text selection optimization
// Autonomous execution with comprehensive error handling and optimization

const API_BASE = 'http://localhost:3000';
const FALLBACK_PORTS = [3000, 3001, 8000, 8080];

// Enhanced selection capture with optimization analysis
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id || !tab.url) {
    console.warn('Invalid tab or URL');
    return;
  }

  try {
    // Inject optimized selection capture script
    const [{ result: selectionData }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: captureOptimizedSelection
    });

    const payload = {
      text: selectionData.text || '',
      selectedHtml: selectionData.html || '',
      url: tab.url || '',
      title: tab.title || '',
      domain: new URL(tab.url).hostname,
      timestamp: new Date().toISOString(),
      wordCount: selectionData.wordCount || 0,
      characterCount: selectionData.characterCount || 0,
      context: selectionData.context || {},
      optimization: {
        source: 'chrome-extension',
        version: chrome.runtime.getManifest().version,
        userAgent: navigator.userAgent
      }
    };

    // Send for autonomous optimization processing
    await sendForOptimization(payload);
    
    // Store for analytics and improvement
    await chrome.storage.local.set({
      lastSelection: payload,
      selectionCount: await incrementSelectionCount()
    });

    console.log('✅ Selection captured and sent for optimization:', {
      textLength: payload.text.length,
      url: payload.url,
      domain: payload.domain
    });
    
  } catch (error) {
    console.error('❌ Failed to capture/process selection:', error);
    await logError(error, tab);
  }
});

// Optimized selection capture function (injected into page)
function captureOptimizedSelection() {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (!selectedText) {
    return {
      text: '',
      html: '',
      wordCount: 0,
      characterCount: 0,
      context: { noSelection: true }
    };
  }

  // Capture rich context for optimization
  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
  
  // Extract contextual information
  const context = {
    tagName: element?.tagName?.toLowerCase() || 'unknown',
    className: element?.className || '',
    id: element?.id || '',
    parentTag: element?.parentElement?.tagName?.toLowerCase() || '',
    textBefore: getContextText(range.startContainer, range.startOffset, -50),
    textAfter: getContextText(range.endContainer, range.endOffset, 50),
    pageTitle: document.title,
    metaDescription: document.querySelector('meta[name="description"]')?.content || '',
    language: document.documentElement.lang || 'unknown'
  };

  // Calculate metrics
  const wordCount = selectedText.split(/\s+/).filter(word => word.length > 0).length;
  const characterCount = selectedText.length;
  
  // Capture HTML if available
  let selectedHtml = '';
  try {
    const clonedSelection = range.cloneContents();
    const div = document.createElement('div');
    div.appendChild(clonedSelection);
    selectedHtml = div.innerHTML;
  } catch (e) {
    selectedHtml = selectedText; // Fallback to plain text
  }

  return {
    text: selectedText,
    html: selectedHtml,
    wordCount,
    characterCount,
    context
  };
}

// Helper function to get context text
function getContextText(node, offset, length) {
  try {
    const text = node.textContent || '';
    if (length > 0) {
      return text.substring(offset, offset + length).trim();
    } else {
      return text.substring(Math.max(0, offset + length), offset).trim();
    }
  } catch (e) {
    return '';
  }
}

// Send selection data for optimization with retry logic
async function sendForOptimization(payload) {
  const maxRetries = 3;
  let lastError = null;

  for (const port of FALLBACK_PORTS) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const url = `http://localhost:${port}/api/ingest/selection`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Extension-Version': chrome.runtime.getManifest().version,
            'X-Request-ID': generateRequestId()
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('✅ Optimization processing initiated:', result);
        
        // Update success metrics
        await updateMetrics('success', port);
        return result;
        
      } catch (error) {
        lastError = error;
        console.warn(`❌ Attempt ${attempt}/${maxRetries} failed for port ${port}:`, error.message);
        
        if (attempt === maxRetries) {
          await updateMetrics('failure', port);
        }
      }
    }
  }

  throw new Error(`All connection attempts failed. Last error: ${lastError?.message}`);
}

// Generate unique request ID for tracking
function generateRequestId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Increment selection counter
async function incrementSelectionCount() {
  const { selectionCount = 0 } = await chrome.storage.local.get(['selectionCount']);
  const newCount = selectionCount + 1;
  return newCount;
}

// Update performance metrics
async function updateMetrics(result, port) {
  const { metrics = {} } = await chrome.storage.local.get(['metrics']);
  
  if (!metrics[port]) {
    metrics[port] = { success: 0, failure: 0, lastUsed: null };
  }
  
  metrics[port][result]++;
  metrics[port].lastUsed = new Date().toISOString();
  
  await chrome.storage.local.set({ metrics });
}

// Log errors for debugging and improvement
async function logError(error, tab) {
  const errorLog = {
    timestamp: new Date().toISOString(),
    error: error.message,
    stack: error.stack,
    url: tab?.url,
    title: tab?.title,
    userAgent: navigator.userAgent
  };
  
  const { errorLogs = [] } = await chrome.storage.local.get(['errorLogs']);
  errorLogs.push(errorLog);
  
  // Keep only last 50 errors
  if (errorLogs.length > 50) {
    errorLogs.splice(0, errorLogs.length - 50);
  }
  
  await chrome.storage.local.set({ errorLogs });
}

// Health check and self-optimization
chrome.runtime.onStartup.addListener(async () => {
  console.log('🚀 Text Selection Optimizer started');
  
  // Clear old data
  const { metrics = {} } = await chrome.storage.local.get(['metrics']);
  
  // Log startup metrics
  console.log('📊 Extension metrics:', metrics);
});

// Handle extension updates
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('🎉 Text Selection Optimizer installed');
    
    // Initialize storage
    await chrome.storage.local.set({
      selectionCount: 0,
      metrics: {},
      errorLogs: [],
      installDate: new Date().toISOString()
    });
    
  } else if (details.reason === 'update') {
    console.log('⬆️ Text Selection Optimizer updated to version', chrome.runtime.getManifest().version);
  }
});