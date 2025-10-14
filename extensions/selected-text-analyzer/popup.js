// Popup logic for Selected Text Analyzer extension

let currentText = '';
let currentSource = '';

// Load stored text when popup opens
document.addEventListener('DOMContentLoaded', () => {
  loadStoredText();
  
  // Set up event listeners
  document.getElementById('analyze-btn').addEventListener('click', runAnalysis);
  document.getElementById('copy-btn').addEventListener('click', copyText);
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

// Display text information
function displayTextInfo() {
  // Hide no-data message
  document.getElementById('content').style.display = 'none';
  
  // Show analysis container
  const container = document.getElementById('analysis-container');
  container.style.display = 'block';
  
  // Update source
  const sourceText = currentSource === 'selection' ? 'Selected Text' : 'Full Page';
  document.getElementById('source').textContent = sourceText;
  
  // Update length
  document.getElementById('length').textContent = `${currentText.length} characters`;
  
  // Update text preview (show first 500 characters)
  const preview = currentText.length > 500 
    ? currentText.substring(0, 500) + '...' 
    : currentText;
  document.getElementById('text-preview').textContent = preview;
}

// Show no data message
function showNoDataMessage() {
  document.getElementById('content').style.display = 'block';
  document.getElementById('analysis-container').style.display = 'none';
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
  
  // Display results
  document.getElementById('char-count').textContent = charCount.toLocaleString();
  document.getElementById('char-no-space-count').textContent = charNoSpaceCount.toLocaleString();
  document.getElementById('word-count').textContent = wordCount.toLocaleString();
  document.getElementById('line-count').textContent = lineCount.toLocaleString();
  
  // Show results section
  document.getElementById('analysis-results').style.display = 'block';
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
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 2000);
  }).catch(err => {
    alert('Failed to copy text: ' + err);
  });
}
