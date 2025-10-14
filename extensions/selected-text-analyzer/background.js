// Service worker for Selected Text Analyzer extension

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'analyzeSelectedText',
    title: 'Analyze selected text',
    contexts: ['selection']
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
      // Open popup
      chrome.action.openPopup();
    });
  }
});

// Handle extension icon clicks (for full page text)
chrome.action.onClicked.addListener((tab) => {
  // Inject script to get page text
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      return document.body.innerText;
    }
  }, (results) => {
    if (results && results[0]) {
      const pageText = results[0].result;
      
      // Store the page text and source
      chrome.storage.local.set({
        analysisText: pageText,
        analysisSource: 'page',
        timestamp: Date.now()
      });
    }
  });
});
