// Background service worker for Selected Text Capture extension

chrome.runtime.onInstalled.addListener(() => {
  console.log('Selected Text Capture extension installed');

  // Set default configuration
  chrome.storage.sync.get(['serverUrl', 'apiToken'], (cfg) => {
    if (!cfg.serverUrl) {
      chrome.storage.sync.set({
        serverUrl: 'http://localhost:8080',
        apiToken: ''
      });
    }
  });
});

/**
 * Post selection to server
 * @param {string} serverUrl - Server URL
 * @param {string} apiToken - API token for authentication
 * @param {Object} payload - Selection data
 * @returns {Promise<boolean>} Success status
 */
async function postSelection(serverUrl, apiToken, payload) {
  try {
    const res = await fetch(`${serverUrl}/api/selection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Token': apiToken || ''
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const error = await res.text();
      console.error('Server returned error:', res.status, error);
      return false;
    }

    const result = await res.json();
    console.log('Selection saved:', result);
    return true;
  } catch (error) {
    console.error('Failed to post selection:', error);
    return false;
  }
}

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Execute script to get selected text
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        selection: window.getSelection ? String(window.getSelection()) : '',
        pageText: document.body ? document.body.innerText.slice(0, 5000) : ''
      })
    });

    const selectedText = result?.selection?.trim() || '';

    if (!selectedText) {
      console.log('No text selected');
      // Could show a notification here
      return;
    }

    // Get configuration
    const { serverUrl, apiToken } = await chrome.storage.sync.get(['serverUrl', 'apiToken']);

    // Send to server
    const success = await postSelection(
      serverUrl || 'http://localhost:8080',
      apiToken || '',
      {
        url: tab.url || '',
        title: tab.title || '',
        selectedText,
        source: 'extension'
      }
    );

    if (success) {
      console.log('Selection captured successfully');
      // Could show success notification
    } else {
      console.error('Failed to capture selection');
      // Could show error notification
    }
  } catch (error) {
    console.error('Selection capture failed:', error);
  }
});

// Handle context menu (future enhancement)
// chrome.contextMenus.create({
//   id: 'capture-selection',
//   title: 'Capture selection',
//   contexts: ['selection']
// });
