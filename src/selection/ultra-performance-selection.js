/**
 * Ultra Performance Selection Handler
 * Optimizes selection event handling through debouncing, batching, and minimal rerendering
 * @module ultra-performance-selection
 */

// Debounce utility for selection events
function debounce(func, wait = 100) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Batch update queue to minimize reflows
class BatchUpdateQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  add(update) {
    this.queue.push(update);
    if (!this.isProcessing) {
      this.process();
    }
  }

  process() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    requestAnimationFrame(() => {
      const updates = [...this.queue];
      this.queue = [];
      
      // Execute all batched updates in single frame
      updates.forEach(update => update());
      
      this.process();
    });
  }
}

const updateQueue = new BatchUpdateQueue();

// Selection state management with minimal rerender
class SelectionManager {
  constructor() {
    this.currentSelection = null;
    this.listeners = new Set();
    this.debouncedNotify = debounce(() => this.notifyListeners(), 150);
  }

  updateSelection(selection) {
    // Avoid unnecessary updates if selection hasn't changed
    if (this.isSameSelection(selection)) {
      return;
    }

    this.currentSelection = selection;
    this.debouncedNotify();
  }

  isSameSelection(newSelection) {
    if (!this.currentSelection || !newSelection) {
      return this.currentSelection === newSelection;
    }

    return (
      this.currentSelection.text === newSelection.text &&
      this.currentSelection.start === newSelection.start &&
      this.currentSelection.end === newSelection.end
    );
  }

  notifyListeners() {
    updateQueue.add(() => {
      this.listeners.forEach(listener => {
        listener(this.currentSelection);
      });
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSelection() {
    return this.currentSelection;
  }
}

const selectionManager = new SelectionManager();

// Optimized selection event handler
function handleSelectionChange() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    selectionManager.updateSelection(null);
    return;
  }

  const range = selection.getRangeAt(0);
  const selectionData = {
    text: selection.toString(),
    start: range.startOffset,
    end: range.endOffset,
    collapsed: selection.isCollapsed
  };

  selectionManager.updateSelection(selectionData);
}

// Throttled selection handler for maximum performance
const throttledSelectionHandler = debounce(handleSelectionChange, 100);

// Public API
export {
  selectionManager,
  handleSelectionChange,
  throttledSelectionHandler,
  BatchUpdateQueue,
  debounce
};

export default selectionManager;
