// Service worker for Selected Text Analyzer extension

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'analyzeSelectedText',
    title: 'Analyze selected text',
    contexts: ['selection']
  });
  
  // Set default configuration for autonomous execution
  chrome.storage.local.set({
    autoAnalyze: true,
    autoOpen: true
  });
});

// Handle context menu clicks (for selected text)
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'analyzeSelectedText') {
    const selectedText = info.selectionText;
    
    // Store the selected text and source
    chrome.storage.local.set({
      analysisText: selectedText,
      analysisSource: 'selection',
      timestamp: Date.now()
    }, () => {
      // Open popup automatically
      chrome.action.openPopup();
    });
  }
});

// Listen for messages from popup to get page text
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageText') {
    chrome.scripting.executeScript({
      target: { tabId: request.tabId },
      func: () => {
        return document.body.innerText;
      }
    }, (results) => {
      if (results && results[0]) {
        sendResponse({ text: results[0].result });
      } else {
        sendResponse({ text: '' });
      }
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'analyzeText') {
    // Store analysis text for processing
    chrome.storage.local.set({
      analysisText: request.text,
      analysisSource: request.source || 'unknown',
      timestamp: Date.now()
    });
    sendResponse({ success: true });
  }
});

// Listen for keyboard shortcuts (if configured in manifest)
chrome.commands.onCommand.addListener((command) => {
  if (command === 'analyze-page') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            return document.body.innerText;
          }
        }, (results) => {
          if (results && results[0]) {
            chrome.storage.local.set({
              analysisText: results[0].result,
              analysisSource: 'page',
              timestamp: Date.now()
            }, () => {
              chrome.action.openPopup();
            });
          }
        });
      }
    });
  }
});
