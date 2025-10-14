// Lightweight content script focused on low-latency selection extraction + utilities
(() => {
  // Throttle helper
  const throttle = (fn, wait = 200) => {
    let last = 0, t;
    return (...args) => {
      const now = Date.now();
      const rem = wait - (now - last);
      if (rem <= 0) { last = now; fn(...args); }
      else { clearTimeout(t); t = setTimeout(() => { last = Date.now(); fn(...args); }, rem); }
    };
  };

  // Fast selection getter
  const getSelectionText = () => {
    try {
      const sel = window.getSelection?.();
      return sel ? String(sel.toString()).trim() : '';
    } catch { return ''; }
  };

  // Respond to direct extraction requests quickly
  chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
    if (req?.action === 'getSelectionText') {
      sendResponse({ text: getSelectionText() });
      return true;
    }
    return false;
  });

  // Optionally cache last selection (for popup usage without re-querying background)
  const sendSelectionUpdate = throttle(() => {
    const text = getSelectionText();
    if (!text) return;
    try { chrome.storage?.session?.set?.({ lastSelection: text }); } catch {}
  }, 400);

  document.addEventListener('selectionchange', sendSelectionUpdate, { passive: true });
})();
