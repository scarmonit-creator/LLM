/**
 * Chromium Browser.cc Optimization Patterns
 * Applied to LLM Framework for Text Selection and Tab Management
 * 
 * Based on analysis of: https://source.chromium.org/chromium/chromium/src/+/main:chrome/browser/ui/browser.cc
 */

// Pattern 1: Active Tab Change Subscription Model
// Chromium uses RegisterActiveTabDidChange() and GetActiveTabInterface() for efficient tab state tracking
class TabChangeSubscriber {
  constructor() {
    this.activeTabCallbacks = new Set();
    this.pendingUpdates = new Map();
    this.updateScheduled = false;
  }

  // Chromium pattern: Centralized registration for active tab changes
  registerActiveTabDidChange(callback) {
    this.activeTabCallbacks.add(callback);
    return () => this.activeTabCallbacks.delete(callback);
  }

  // Chromium pattern: Batch UI updates to avoid redundant processing
  scheduleUIUpdate(updateKey, updateFn) {
    this.pendingUpdates.set(updateKey, updateFn);
    
    if (!this.updateScheduled) {
      this.updateScheduled = true;
      requestAnimationFrame(() => this.processPendingUIUpdates());
    }
  }

  // Chromium pattern: ProcessPendingUIUpdates() - executes batched changes
  processPendingUIUpdates() {
    const updates = Array.from(this.pendingUpdates.values());
    this.pendingUpdates.clear();
    this.updateScheduled = false;
    
    updates.forEach(updateFn => updateFn());
  }

  // Chromium pattern: OnActiveTabChanged() - notifies all subscribers
  notifyActiveTabChange(oldTab, newTab) {
    this.activeTabCallbacks.forEach(callback => {
      try {
        callback(oldTab, newTab);
      } catch (error) {
        console.error('Tab change callback error:', error);
      }
    });
  }
}

// Pattern 2: Selection State Management with Lazy Updates
// Chromium uses OnTabStripModelChanged with selection parameter to minimize redundant work
class OptimizedSelectionManager {
  constructor() {
    this.currentSelection = null;
    this.selectionChangeHandlers = [];
    this.lastProcessedSelection = null;
  }

  // Chromium pattern: Check if selection actually changed before processing
  onSelectionChanged(newSelection) {
    if (this.isSelectionEqual(this.lastProcessedSelection, newSelection)) {
      return; // Skip redundant updates
    }

    this.lastProcessedSelection = this.cloneSelection(newSelection);
    this.currentSelection = newSelection;
    
    // Defer expensive operations
    this.scheduleSelectionProcessing();
  }

  isSelectionEqual(sel1, sel2) {
    if (!sel1 || !sel2) return sel1 === sel2;
    return sel1.anchorNode === sel2.anchorNode &&
           sel1.anchorOffset === sel2.anchorOffset &&
           sel1.focusNode === sel2.focusNode &&
           sel1.focusOffset === sel2.focusOffset;
  }

  cloneSelection(selection) {
    if (!selection) return null;
    return {
      anchorNode: selection.anchorNode,
      anchorOffset: selection.anchorOffset,
      focusNode: selection.focusNode,
      focusOffset: selection.focusOffset,
      text: selection.toString()
    };
  }

  scheduleSelectionProcessing() {
    if (this.processingTimer) clearTimeout(this.processingTimer);
    this.processingTimer = setTimeout(() => {
      this.processSelection();
    }, 16); // ~60fps
  }

  processSelection() {
    this.selectionChangeHandlers.forEach(handler => handler(this.currentSelection));
  }

  addSelectionHandler(handler) {
    this.selectionChangeHandlers.push(handler);
  }
}

// Pattern 3: UpdateToolbar Pattern - Conditional UI Updates
// Chromium uses UpdateToolbar(changed_flags) to update only what changed
class ConditionalUIUpdater {
  constructor() {
    this.dirtyFlags = {
      SELECTION: 1 << 0,
      TAB: 1 << 1,
      CONTENT: 1 << 2,
      LOADING: 1 << 3
    };
    this.currentFlags = 0;
  }

  markDirty(flag) {
    this.currentFlags |= flag;
  }

  // Chromium pattern: Only update components that have changed
  updateUI() {
    if (this.currentFlags & this.dirtyFlags.SELECTION) {
      this.updateSelectionUI();
    }
    if (this.currentFlags & this.dirtyFlags.TAB) {
      this.updateTabUI();
    }
    if (this.currentFlags & this.dirtyFlags.CONTENT) {
      this.updateContentUI();
    }
    if (this.currentFlags & this.dirtyFlags.LOADING) {
      this.updateLoadingUI();
    }
    
    this.currentFlags = 0; // Clear flags after update
  }

  updateSelectionUI() { /* Implementation */ }
  updateTabUI() { /* Implementation */ }
  updateContentUI() { /* Implementation */ }
  updateLoadingUI() { /* Implementation */ }
}

// Pattern 4: OnTabDeactivated/OnTabActivated Pattern
// Chromium properly cleans up resources when tabs deactivate
class TabLifecycleManager {
  constructor() {
    this.activeTabResources = new Map();
  }

  onTabActivated(tabId) {
    const resources = this.initializeTabResources(tabId);
    this.activeTabResources.set(tabId, resources);
  }

  // Chromium pattern: Clean up when tab is deactivated to free memory
  onTabDeactivated(tabId) {
    const resources = this.activeTabResources.get(tabId);
    if (resources) {
      this.cleanupResources(resources);
      this.activeTabResources.delete(tabId);
    }
  }

  initializeTabResources(tabId) {
    return {
      selectionObserver: null,
      contentScripts: [],
      eventListeners: []
    };
  }

  cleanupResources(resources) {
    if (resources.selectionObserver) {
      resources.selectionObserver.disconnect();
    }
    resources.eventListeners.forEach(listener => listener.remove());
  }
}

// Integration Class: Combines all optimization patterns
export class ChromiumOptimizedTabManager {
  constructor() {
    this.subscriber = new TabChangeSubscriber();
    this.selectionManager = new OptimizedSelectionManager();
    this.uiUpdater = new ConditionalUIUpdater();
    this.lifecycleManager = new TabLifecycleManager();
  }

  initialize() {
    // Register for tab changes
    this.subscriber.registerActiveTabDidChange((oldTab, newTab) => {
      this.lifecycleManager.onTabDeactivated(oldTab?.id);
      this.lifecycleManager.onTabActivated(newTab?.id);
      this.uiUpdater.markDirty(this.uiUpdater.dirtyFlags.TAB);
      this.subscriber.scheduleUIUpdate('tab-change', () => this.uiUpdater.updateUI());
    });

    // Register selection handler
    this.selectionManager.addSelectionHandler((selection) => {
      this.uiUpdater.markDirty(this.uiUpdater.dirtyFlags.SELECTION);
      this.subscriber.scheduleUIUpdate('selection-change', () => this.uiUpdater.updateUI());
    });

    // Monitor selection changes
    document.addEventListener('selectionchange', () => {
      const selection = window.getSelection();
      this.selectionManager.onSelectionChanged(selection);
    });
  }
}

// Export optimization patterns
export { TabChangeSubscriber, OptimizedSelectionManager, ConditionalUIUpdater, TabLifecycleManager };
