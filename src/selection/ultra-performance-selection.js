/**
 * Ultra Performance Selection Handler
 * Optimizes selection event handling through debouncing, batching, and minimal rerendering
 * @module ultra-performance-selection
 */

// Debounce utility for selection events with proper cleanup
function debounce(func, wait = 100) {
  let timeout = null;
  
  const debouncedFn = function executedFunction(...args) {
    const later = () => {
      timeout = null;
      try {
        func.apply(this, args);
      } catch (error) {
        console.error('Debounced function error:', error);
      }
    };
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
  
  // Cleanup method to prevent memory leaks
  debouncedFn.cancel = function() {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  
  return debouncedFn;
}

// Batch update queue to minimize reflows - uses iteration instead of recursion
class BatchUpdateQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.rafId = null;
  }

  add(update) {
    if (typeof update !== 'function') {
      console.warn('BatchUpdateQueue: update must be a function');
      return;
    }
    this.queue.push(update);
    if (!this.isProcessing) {
      this.scheduleProcess();
    }
  }

  scheduleProcess() {
    this.isProcessing = true;
    
    // Use requestAnimationFrame with fallback
    const raf = typeof requestAnimationFrame !== 'undefined' 
      ? requestAnimationFrame 
      : (cb) => setTimeout(cb, 16);
    
    this.rafId = raf(() => this.process());
  }

  process() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    try {
      // Process all queued updates iteratively (not recursively)
      const updates = this.queue.splice(0, this.queue.length);
      
      for (const update of updates) {
        try {
          update();
        } catch (error) {
          console.error('BatchUpdateQueue update error:', error);
        }
      }
    } catch (error) {
      console.error('BatchUpdateQueue process error:', error);
    } finally {
      this.isProcessing = false;
      
      // If new items were added during processing, schedule another process
      if (this.queue.length > 0) {
        this.scheduleProcess();
      }
    }
  }

  clear() {
    this.queue = [];
    this.isProcessing = false;
    if (this.rafId !== null) {
      const caf = typeof cancelAnimationFrame !== 'undefined'
        ? cancelAnimationFrame
        : clearTimeout;
      caf(this.rafId);
      this.rafId = null;
    }
  }
}

// Performance-optimized selection manager
class UltraPerformanceSelection {
  constructor(options = {}) {
    this.debounceTime = options.debounceTime || 100;
    this.batchQueue = new BatchUpdateQueue();
    this.lastSelection = null;
    this.listeners = new Set();
    this.isActive = false;
    
    // Bind methods to preserve context
    this.handleSelectionChange = debounce(
      this._processSelection.bind(this),
      this.debounceTime
    );
  }

  _processSelection() {
    try {
      const selection = window.getSelection();
      
      if (!selection || selection.rangeCount === 0) {
        return;
      }

      const currentSelection = this._captureSelection(selection);
      
      // Skip if selection hasn't changed
      if (this._isSameSelection(currentSelection, this.lastSelection)) {
        return;
      }

      this.lastSelection = currentSelection;
      
      // Batch notify all listeners
      this.batchQueue.add(() => {
        this._notifyListeners(currentSelection);
      });
    } catch (error) {
      console.error('Selection processing error:', error);
    }
  }

  _captureSelection(selection) {
    try {
      if (selection.rangeCount === 0) {
        return null;
      }

      const range = selection.getRangeAt(0);
      return {
        text: selection.toString(),
        startContainer: range.startContainer,
        endContainer: range.endContainer,
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        collapsed: selection.isCollapsed,
        rangeCount: selection.rangeCount
      };
    } catch (error) {
      console.error('Capture selection error:', error);
      return null;
    }
  }

  _isSameSelection(sel1, sel2) {
    if (!sel1 || !sel2) {
      return sel1 === sel2;
    }

    return (
      sel1.text === sel2.text &&
      sel1.startContainer === sel2.startContainer &&
      sel1.endContainer === sel2.endContainer &&
      sel1.startOffset === sel2.startOffset &&
      sel1.endOffset === sel2.endOffset &&
      sel1.collapsed === sel2.collapsed
    );
  }

  _notifyListeners(selection) {
    for (const listener of this.listeners) {
      try {
        listener(selection);
      } catch (error) {
        console.error('Listener notification error:', error);
      }
    }
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('Listener must be a function');
    }
    this.listeners.add(listener);
    return () => this.unsubscribe(listener);
  }

  unsubscribe(listener) {
    this.listeners.delete(listener);
  }

  start() {
    if (this.isActive) {
      return;
    }

    try {
      document.addEventListener('selectionchange', this.handleSelectionChange);
      this.isActive = true;
    } catch (error) {
      console.error('Failed to start selection monitoring:', error);
    }
  }

  stop() {
    if (!this.isActive) {
      return;
    }

    try {
      document.removeEventListener('selectionchange', this.handleSelectionChange);
      this.handleSelectionChange.cancel();
      this.batchQueue.clear();
      this.isActive = false;
    } catch (error) {
      console.error('Failed to stop selection monitoring:', error);
    }
  }

  destroy() {
    this.stop();
    this.listeners.clear();
    this.lastSelection = null;
  }
}

// Export as named export and default
export { UltraPerformanceSelection, BatchUpdateQueue, debounce };
export default UltraPerformanceSelection;
