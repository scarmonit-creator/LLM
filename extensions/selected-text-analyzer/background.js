// Enhanced service worker for Selected Text Analyzer extension
// Now includes autonomous execution and advanced browser control

class ExtensionController {
  constructor() {
    this.activeTabs = new Map();
    this.autonomousMode = false;
    this.currentTask = null;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Create context menu on install
    chrome.runtime.onInstalled.addListener(() => {
      this.createContextMenus();
      this.setDefaultConfiguration();
    });

    // Handle context menu clicks
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab);
    });

    // Listen for messages from popup and content scripts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Listen for keyboard shortcuts
    chrome.commands.onCommand.addListener((command) => {
      this.handleKeyboardCommand(command);
    });

    // Monitor tab updates for autonomous execution
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && this.autonomousMode) {
        this.handleTabUpdate(tabId, tab);
      }
    });

    // Handle navigation events for task continuity
    chrome.webNavigation.onCompleted.addListener((details) => {
      if (this.autonomousMode && details.frameId === 0) {
        this.handleNavigationComplete(details);
      }
    });
  }

  createContextMenus() {
    // Remove existing menus
    chrome.contextMenus.removeAll(() => {
      // Text analysis menu
      chrome.contextMenus.create({
        id: 'analyzeSelectedText',
        title: 'Analyze selected text',
        contexts: ['selection']
      });

      // Page analysis menu
      chrome.contextMenus.create({
        id: 'analyzeFullPage',
        title: 'Analyze full page',
        contexts: ['page']
      });

      // Autonomous execution menu
      chrome.contextMenus.create({
        id: 'startAutonomous',
        title: 'Start autonomous mode',
        contexts: ['page']
      });

      // Quick fix menu
      chrome.contextMenus.create({
        id: 'quickFixPage',
        title: 'Quick fix page issues',
        contexts: ['page']
      });
    });
  }

  setDefaultConfiguration() {
    chrome.storage.local.set({
      autoAnalyze: true,
      autoOpen: true,
      autonomousExecution: true,
      maxRetries: 3,
      delayBetweenActions: 1000,
      debugMode: false
    });
  }

  async handleContextMenuClick(info, tab) {
    switch (info.menuItemId) {
      case 'analyzeSelectedText':
        await this.analyzeSelectedText(info, tab);
        break;
      case 'analyzeFullPage':
        await this.analyzeFullPage(tab);
        break;
      case 'startAutonomous':
        await this.startAutonomousMode(tab);
        break;
      case 'quickFixPage':
        await this.quickFixPage(tab);
        break;
    }
  }

  async analyzeSelectedText(info, tab) {
    const selectedText = info.selectionText;
    
    // Store the selected text and source
    await chrome.storage.local.set({
      analysisText: selectedText,
      analysisSource: 'selection',
      timestamp: Date.now(),
      tabId: tab.id
    });

    // Open popup automatically
    chrome.action.openPopup();
  }

  async analyzeFullPage(tab) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText
      });

      if (results && results[0]) {
        await chrome.storage.local.set({
          analysisText: results[0].result,
          analysisSource: 'page',
          timestamp: Date.now(),
          tabId: tab.id
        });

        chrome.action.openPopup();
      }
    } catch (error) {
      console.error('Failed to analyze page:', error);
      this.showNotification('Analysis Failed', 'Could not analyze the current page.');
    }
  }

  async startAutonomousMode(tab) {
    this.autonomousMode = true;
    this.activeTabs.set(tab.id, {
      url: tab.url,
      title: tab.title,
      startTime: Date.now()
    });

    // Inject content script if not already present
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (error) {
      console.log('Content script already injected or injection failed:', error);
    }

    // Start autonomous execution
    const task = {
      type: 'autonomous_analysis',
      tabId: tab.id,
      startUrl: tab.url,
      timestamp: Date.now()
    };

    const response = await this.sendMessageToTab(tab.id, {
      action: 'startAutonomousExecution',
      task: task
    });

    if (response?.success) {
      this.showNotification('Autonomous Mode Started', 'The extension is now analyzing and fixing page issues automatically.');
      this.currentTask = task;
    } else {
      this.showNotification('Startup Failed', 'Could not start autonomous mode on this page.');
    }
  }

  async quickFixPage(tab) {
    try {
      // Inject content script if needed
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (error) {
      console.log('Content script already injected:', error);
    }

    // Analyze and fix page issues
    const response = await this.sendMessageToTab(tab.id, {
      action: 'analyzePageIssues'
    });

    if (response?.success) {
      const issues = response.issues;
      
      if (issues.length > 0) {
        this.showNotification('Issues Found', `Found ${issues.length} issues. Attempting to fix automatically.`);
        
        // Start autonomous fixing
        await this.sendMessageToTab(tab.id, {
          action: 'startAutonomousExecution',
          task: {
            type: 'quick_fix',
            issues: issues,
            tabId: tab.id
          }
        });
      } else {
        this.showNotification('No Issues', 'No issues detected on this page.');
      }
    }
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'getPageText':
          await this.handleGetPageText(request, sendResponse);
          break;
        case 'analyzeText':
          await this.handleAnalyzeText(request, sendResponse);
          break;
        case 'executeAction':
          await this.handleExecuteAction(request, sender, sendResponse);
          break;
        case 'startAutonomousMode':
          await this.handleStartAutonomousMode(request, sender, sendResponse);
          break;
        case 'stopAutonomousMode':
          await this.handleStopAutonomousMode(request, sender, sendResponse);
          break;
        case 'getTabData':
          await this.handleGetTabData(request, sendResponse);
          break;
        case 'dataExtracted':
          await this.handleDataExtracted(request, sender);
          break;
        case 'autonomousExecutionFailed':
          await this.handleAutonomousExecutionFailed(request, sender);
          break;
        case 'takeScreenshot':
          await this.handleTakeScreenshot(request, sendResponse);
          break;
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleGetPageText(request, sendResponse) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: request.tabId },
        func: () => document.body.innerText
      });

      if (results && results[0]) {
        sendResponse({ text: results[0].result });
      } else {
        sendResponse({ text: '' });
      }
    } catch (error) {
      sendResponse({ text: '', error: error.message });
    }
  }

  async handleAnalyzeText(request, sendResponse) {
    await chrome.storage.local.set({
      analysisText: request.text,
      analysisSource: request.source || 'unknown',
      timestamp: Date.now()
    });
    sendResponse({ success: true });
  }

  async handleExecuteAction(request, sender, sendResponse) {
    if (!sender.tab) {
      sendResponse({ success: false, error: 'No tab context' });
      return;
    }

    try {
      const response = await this.sendMessageToTab(sender.tab.id, {
        action: 'executeAction',
        actionData: request.actionData
      });
      sendResponse(response);
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleStartAutonomousMode(request, sender, sendResponse) {
    if (sender.tab) {
      await this.startAutonomousMode(sender.tab);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'No tab context' });
    }
  }

  async handleStopAutonomousMode(request, sender, sendResponse) {
    this.autonomousMode = false;
    this.currentTask = null;
    
    if (sender.tab) {
      this.activeTabs.delete(sender.tab.id);
      await this.sendMessageToTab(sender.tab.id, {
        action: 'stopAutonomousExecution'
      });
    }
    
    sendResponse({ success: true });
  }

  async handleGetTabData(request, sendResponse) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        const response = await this.sendMessageToTab(tabs[0].id, {
          action: 'getPageData'
        });
        sendResponse(response);
      } else {
        sendResponse({ success: false, error: 'No active tab' });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleDataExtracted(request, sender) {
    // Store extracted data for analysis
    await chrome.storage.local.set({
      extractedData: request.data,
      extractionTask: request.task,
      extractionTime: Date.now(),
      tabId: sender.tab?.id
    });

    console.log('Data extracted:', request.data);
  }

  async handleAutonomousExecutionFailed(request, sender) {
    this.showNotification('Execution Failed', `Autonomous execution failed: ${request.error}`);
    
    // Reset autonomous mode for this tab
    if (sender.tab) {
      this.activeTabs.delete(sender.tab.id);
    }

    // If this was the current task, reset it
    if (this.currentTask && this.currentTask.tabId === sender.tab?.id) {
      this.currentTask = null;
    }
  }

  async handleTakeScreenshot(request, sendResponse) {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: 'png',
        quality: 90
      });
      sendResponse({ success: true, dataUrl });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleKeyboardCommand(command) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) return;

    switch (command) {
      case 'analyze-page':
        await this.analyzeFullPage(tabs[0]);
        break;
      case 'start-autonomous':
        await this.startAutonomousMode(tabs[0]);
        break;
      case 'fix-page-issues':
        await this.quickFixPage(tabs[0]);
        break;
    }
  }

  async handleTabUpdate(tabId, tab) {
    if (this.activeTabs.has(tabId)) {
      // Page has loaded, continue autonomous execution
      const tabData = this.activeTabs.get(tabId);
      
      // Update tab data
      tabData.url = tab.url;
      tabData.title = tab.title;
      
      // Continue or restart autonomous execution
      setTimeout(async () => {
        try {
          await this.sendMessageToTab(tabId, {
            action: 'startAutonomousExecution',
            task: this.currentTask || {
              type: 'continue_autonomous',
              tabId: tabId,
              timestamp: Date.now()
            }
          });
        } catch (error) {
          console.error('Failed to continue autonomous execution:', error);
        }
      }, 1000);
    }
  }

  async handleNavigationComplete(details) {
    if (this.activeTabs.has(details.tabId)) {
      console.log('Navigation completed for autonomous tab:', details.url);
      
      // Give the page time to load then continue execution
      setTimeout(async () => {
        try {
          await this.sendMessageToTab(details.tabId, {
            action: 'analyzePageIssues'
          });
        } catch (error) {
          console.error('Failed to analyze page after navigation:', error);
        }
      }, 2000);
    }
  }

  async sendMessageToTab(tabId, message) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Message sending failed:', chrome.runtime.lastError);
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { success: true });
        }
      });
    });
  }

  showNotification(title, message) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon48.png'), // You may need to add an icon
      title: title,
      message: message
    });
  }
}

// Initialize the extension controller
const extensionController = new ExtensionController();

console.log('🚀 Enhanced Browser Extension Controller initialized');
