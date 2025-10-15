// LLM Selection Analyzer - Background Service Worker
// Handles context menu creation and text analysis requests

const SERVER_URL = 'http://localhost:8080';
const ANALYZE_ENDPOINT = '/api/analyze';

// Create context menu on extension startup
chrome.runtime.onStartup.addListener(createContextMenu);
chrome.runtime.onInstalled.addListener(createContextMenu);

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    // Context menu for selected text
    chrome.contextMenus.create({
      id: 'analyze-selection',
      title: 'Analyze Selected Text',
      contexts: ['selection']
    });
    
    // Context menu for current page
    chrome.contextMenus.create({
      id: 'analyze-page',
      title: 'Analyze Current Page',
      contexts: ['page']
    });
    
    // Extension action button
    chrome.contextMenus.create({
      id: 'analyze-tab',
      title: 'Analyze Current Tab',
      contexts: ['action']
    });
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    await handleAnalysisRequest(info, tab);
  } catch (error) {
    console.error('Analysis request failed:', error);
    showNotification('Analysis failed', error.message, 'error');
  }
});

// Handle extension action button clicks
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await handleAnalysisRequest({ menuItemId: 'analyze-tab' }, tab);
  } catch (error) {
    console.error('Tab analysis failed:', error);
    showNotification('Analysis failed', error.message, 'error');
  }
});

// Main analysis handler
async function handleAnalysisRequest(info, tab) {
  if (!tab || !tab.id) {
    throw new Error('No active tab found');
  }
  
  // Show processing indicator
  chrome.action.setBadgeText({ text: '...', tabId: tab.id });
  chrome.action.setBadgeBackgroundColor({ color: '#FFA500' });
  
  let textData;
  
  try {
    // Get text based on context
    switch (info.menuItemId) {
      case 'analyze-selection':
        textData = await getSelectedText(tab.id);
        break;
      case 'analyze-page':
      case 'analyze-tab':
        textData = await getCurrentPageText(tab.id);
        break;
      default:
        textData = await getCurrentPageText(tab.id);
    }
    
    if (!textData.text || textData.text.trim().length === 0) {
      throw new Error('No text found to analyze');
    }
    
    // Send to analysis server
    const result = await sendForAnalysis(textData);
    
    // Show success
    chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    
    // Clear badge after 3 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '', tabId: tab.id });
    }, 3000);
    
    // Show result notification
    showAnalysisResult(result, textData);
    
  } catch (error) {
    // Show error
    chrome.action.setBadgeText({ text: '✗', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#F44336' });
    
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '', tabId: tab.id });
    }, 3000);
    
    throw error;
  }
}

// Get selected text from current tab
async function getSelectedText(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    function: () => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      return {
        text: selectedText,
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        selectionStart: selection.rangeCount > 0 ? selection.getRangeAt(0).startOffset : 0,
        selectionEnd: selection.rangeCount > 0 ? selection.getRangeAt(0).endOffset : 0
      };
    }
  });
  
  if (!results || !results[0] || !results[0].result) {
    throw new Error('Failed to get selected text');
  }
  
  const result = results[0].result;
  
  if (!result.text || result.text.length === 0) {
    throw new Error('No text selected');
  }
  
  return result;
}

// Get current page text content
async function getCurrentPageText(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    function: () => {
      // Extract meaningful text content
      const extractText = () => {
        // Remove script and style elements
        const elementsToRemove = document.querySelectorAll('script, style, nav, header, footer, aside');
        const tempContainer = document.cloneNode(true);
        
        elementsToRemove.forEach(el => {
          const clone = tempContainer.querySelector(el.tagName.toLowerCase());
          if (clone) clone.remove();
        });
        
        // Get main content
        const main = tempContainer.querySelector('main, article, .content, .main-content, #content, #main');
        const contentElement = main || tempContainer.body || tempContainer;
        
        let text = contentElement.textContent || contentElement.innerText || '';
        
        // Clean up text
        text = text
          .replace(/\s+/g, ' ')  // Normalize whitespace
          .replace(/\n{3,}/g, '\n\n')  // Limit consecutive newlines
          .trim();
        
        // Limit size to prevent large payloads (100KB max)
        if (text.length > 100000) {
          text = text.substring(0, 100000) + '... [content truncated]';
        }
        
        return text;
      };
      
      return {
        text: extractText(),
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        domain: window.location.hostname,
        contentLength: document.body ? document.body.innerText.length : 0
      };
    }
  });
  
  if (!results || !results[0] || !results[0].result) {
    throw new Error('Failed to get page content');
  }
  
  const result = results[0].result;
  
  if (!result.text || result.text.trim().length === 0) {
    throw new Error('No readable content found on page');
  }
  
  return result;
}

// Send text data for analysis
async function sendForAnalysis(textData) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  try {
    const response = await fetch(`${SERVER_URL}${ANALYZE_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: textData.text,
        url: textData.url,
        title: textData.title,
        timestamp: textData.timestamp,
        metadata: {
          domain: textData.domain,
          contentLength: textData.contentLength,
          selectionStart: textData.selectionStart,
          selectionEnd: textData.selectionEnd,
          extensionVersion: chrome.runtime.getManifest().version
        }
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Analysis failed');
    }
    
    return result;
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Analysis request timed out');
    }
    
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to analysis server. Is it running on localhost:8080?');
    }
    
    throw error;
  }
}

// Show analysis result notification
function showAnalysisResult(result, textData) {
  const summary = result.data?.summary || 'Analysis completed';
  const confidence = result.data?.confidence || 0;
  
  let title = 'Text Analysis Complete';
  let message = `${summary}\n\nConfidence: ${Math.round(confidence * 100)}%`;
  
  if (textData.text.length > 500) {
    message += `\nAnalyzed ${textData.text.length} characters`;
  }
  
  showNotification(title, message, 'success');
  
  // Log detailed result for debugging
  console.log('Analysis Result:', result);
}

// Show notification to user
function showNotification(title, message, type = 'info') {
  const iconUrl = {
    success: 'icon32.png',
    error: 'icon32.png',
    info: 'icon32.png'
  }[type] || 'icon32.png';
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: iconUrl,
    title: title,
    message: message
  });
}

// Handle extension messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyze-selection') {
    handleAnalysisRequest({ menuItemId: 'analyze-selection' }, sender.tab)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Keep message channel open for async response
  }
});

console.log('LLM Selection Analyzer background script loaded');
