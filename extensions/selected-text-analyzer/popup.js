// Popup logic for Selected Text Analyzer extension
let currentText = '';
let currentSource = '';

// Load stored text when popup opens
document.addEventListener('DOMContentLoaded', () => {
  loadStoredText();
  
  // Set up event listeners
  document.getElementById('analyze-btn').addEventListener('click', runAnalysis);
  document.getElementById('copy-btn').addEventListener('click', copyText);
  
  // Add listener for "Analyze Current Page" button if it exists
  const analyzePageBtn = document.getElementById('analyze-page-btn');
  if (analyzePageBtn) {
    analyzePageBtn.addEventListener('click', analyzeCurrentPage);
  }
  
  // Check for auto-analyze setting
  chrome.storage.local.get(['autoAnalyze'], (result) => {
    if (result.autoAnalyze && currentText) {
      // Auto-run analysis if enabled and text is available
      setTimeout(() => runAnalysis(), 100);
    }
  });
});

// Load text from storage
function loadStoredText() {
  chrome.storage.local.get(['analysisText', 'analysisSource', 'timestamp'], (result) => {
    if (result.analysisText) {
      currentText = result.analysisText;
      currentSource = result.analysisSource || 'unknown';
      
      displayTextInfo();
    } else {
      showNoDataMessage();
    }
  });
}

// Analyze current page text
function analyzeCurrentPage() {
  // Get current tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      // Show loading state
      const btn = document.getElementById('analyze-page-btn');
      if (btn) {
        btn.textContent = 'Loading...';
        btn.disabled = true;
      }
      
      // Request page text from background script
      chrome.runtime.sendMessage(
        { action: 'getPageText', tabId: tabs[0].id },
        (response) => {
          if (response && response.text) {
            currentText = response.text;
            currentSource = 'page';
            
            // Store the text
            chrome.storage.local.set({
              analysisText: currentText,
              analysisSource: currentSource,
              timestamp: Date.now()
            });
            
            // Display and analyze
            displayTextInfo();
            runAnalysis();
          } else {
            alert('Failed to extract page text. Make sure the page has loaded.');
          }
          
          // Reset button
          if (btn) {
            btn.textContent = 'Analyze Current Page';
            btn.disabled = false;
          }
        }
      );
    }
  });
}

// Display text information
function displayTextInfo() {
  // Hide no-data message
  const contentDiv = document.getElementById('content');
  if (contentDiv) {
    contentDiv.style.display = 'none';
  }
  
  // Show analysis container
  const container = document.getElementById('analysis-container');
  if (container) {
    container.style.display = 'block';
  }
  
  // Update source
  const sourceText = currentSource === 'selection' ? 'Selected Text' : 'Full Page';
  const sourceEl = document.getElementById('source');
  if (sourceEl) {
    sourceEl.textContent = sourceText;
  }
  
  // Update length
  const lengthEl = document.getElementById('length');
  if (lengthEl) {
    lengthEl.textContent = `${currentText.length} characters`;
  }
  
  // Update text preview (show first 500 characters)
  const preview = currentText.length > 500 
    ? currentText.substring(0, 500) + '...' 
    : currentText;
  const previewEl = document.getElementById('text-preview');
  if (previewEl) {
    previewEl.textContent = preview;
  }
}

// Show no data message
function showNoDataMessage() {
  const contentDiv = document.getElementById('content');
  if (contentDiv) {
    contentDiv.style.display = 'block';
  }
  
  const container = document.getElementById('analysis-container');
  if (container) {
    container.style.display = 'none';
  }
}

// Run text analysis
function runAnalysis() {
  if (!currentText) {
    alert('No text to analyze');
    return;
  }
  
  // Character count (total)
  const charCount = currentText.length;
  
  // Character count (no spaces)
  const charNoSpaceCount = currentText.replace(/\s/g, '').length;
  
  // Word count
  const words = currentText.trim().split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;
  
  // Line count
  const lines = currentText.split(/\n/);
  const lineCount = lines.length;
  
  // Sentence count (approximate)
  const sentences = currentText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = sentences.length;
  
  // Average word length
  const totalWordChars = words.join('').length;
  const avgWordLength = wordCount > 0 ? (totalWordChars / wordCount).toFixed(2) : 0;
  
  // Display results
  const charCountEl = document.getElementById('char-count');
  if (charCountEl) {
    charCountEl.textContent = charCount.toLocaleString();
  }
  
  const charNoSpaceEl = document.getElementById('char-no-space-count');
  if (charNoSpaceEl) {
    charNoSpaceEl.textContent = charNoSpaceCount.toLocaleString();
  }
  
  const wordCountEl = document.getElementById('word-count');
  if (wordCountEl) {
    wordCountEl.textContent = wordCount.toLocaleString();
  }
  
  const lineCountEl = document.getElementById('line-count');
  if (lineCountEl) {
    lineCountEl.textContent = lineCount.toLocaleString();
  }
  
  // Add sentence count if element exists
  const sentenceCountEl = document.getElementById('sentence-count');
  if (sentenceCountEl) {
    sentenceCountEl.textContent = sentenceCount.toLocaleString();
  }
  
  // Add average word length if element exists
  const avgWordLengthEl = document.getElementById('avg-word-length');
  if (avgWordLengthEl) {
    avgWordLengthEl.textContent = avgWordLength;
  }
  
  // Show results section
  const resultsDiv = document.getElementById('analysis-results');
  if (resultsDiv) {
    resultsDiv.style.display = 'block';
  }
}

// Copy text to clipboard
function copyText() {
  if (!currentText) {
    alert('No text to copy');
    return;
  }
  
  navigator.clipboard.writeText(currentText).then(() => {
    // Visual feedback
    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn) {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 2000);
    }
  }).catch(err => {
    alert('Failed to copy text: ' + err);
  });
}
