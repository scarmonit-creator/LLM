// Enhanced service worker with Chrome Built-in AI Integration (Phase 2)
// Includes autonomous execution and AI-powered text analysis

class ExtensionController {
  constructor() {
    this.activeTabs = new Map();
    this.autonomousMode = false;
    this.currentTask = null;
    this.aiSession = null;
    this.summarizer = null;
    this.setupEventListeners();
    this.initializeAI();
  }

  // Phase 2: AI Integration - Initialize Chrome Built-in AI
  async initializeAI() {
    try {
      // Check Prompt API availability
      if (typeof ai !== 'undefined' && ai.languageModel) {
        const capabilities = await ai.languageModel.capabilities();
        if (capabilities.available === 'readily') {
          console.log('[AI] Prompt API available - Gemini Nano ready');
          this.aiSession = await ai.languageModel.create({
            systemPrompt: "You are a helpful text analyzer assistant. Analyze text for clarity, sentiment, readability, and provide actionable insights."
          });
        } else if (capabilities.available === 'after-download') {
          console.log('[AI] Gemini Nano model needs to be downloaded');
        } else {
          console.log('[AI] Prompt API not available on this browser');
        }
      }

      // Check Summarizer API availability
      if (typeof ai !== 'undefined' && ai.summarizer) {
        const sumCapabilities = await ai.summarizer.capabilities();
        if (sumCapabilities.available === 'readily') {
          console.log('[AI] Summarizer API available');
          this.summarizer = await ai.summarizer.create({
            type: 'key-points',
            format: 'markdown',
            length: 'medium'
          });
        }
      }
    } catch (error) {
      console.log('[AI] Built-in AI not available, falling back to traditional methods:', error);
    }
  }

  // AI-powered text analysis
  async analyzeTextWithAI(text) {
    if (!text || text.trim().length === 0) {
      return { error: 'No text provided' };
    }

    const results = {
      originalText: text,
      wordCount: text.split(/\s+/).length,
      charCount: text.length,
      aiAnalysis: null,
      summary: null,
      timestamp: new Date().toISOString()
    };

    try {
      // Use Chrome Built-in AI if available
      if (this.aiSession) {
        const prompt = `Analyze this text and provide: 1) Sentiment, 2) Key themes, 3) Readability score, 4) Suggestions for improvement\n\nText: ${text}`;
        results.aiAnalysis = await this.aiSession.prompt(prompt);
      }

      // Generate summary if text is long enough
      if (this.summarizer && text.length > 500) {
        results.summary = await this.summarizer.summarize(text);
      }

      // Fallback: Basic analysis without AI
      if (!results.aiAnalysis) {
        results.aiAnalysis = this.performBasicAnalysis(text);
      }
    } catch (error) {
      console.error('[AI] Analysis error:', error);
      results.aiAnalysis = this.performBasicAnalysis(text);
    }

    return results;
  }

  // Fallback: Basic text analysis without AI
  performBasicAnalysis(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/);
    const avgWordsPerSentence = words.length / sentences.length;

    return {
      sentiment: 'neutral',
      sentences: sentences.length,
      avgWordsPerSentence: avgWordsPerSentence.toFixed(1),
      readability: avgWordsPerSentence < 15 ? 'easy' : avgWordsPerSentence < 25 ? 'moderate' : 'complex',
      note: 'Basic analysis (AI not available)'
    };
  }

  setupEventListeners() {
    // Phase 1: Security - Proper service worker lifecycle management
    chrome.runtime.onInstalled.addListener((details) => {
      this.createContextMenus();
      this.setDefaultConfiguration();
      
      // Handle updates
      if (details.reason === 'update') {
        console.log(`[Update] Updated from version ${details.previousVersion}`);
        this.handleExtensionUpdate(details.previousVersion);
      }
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab);
    });

    // Phase 3: Performance - Proper message passing with async handling
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    chrome.commands.onCommand.addListener((command) => {
      this.handleKeyboardCommand(command);
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (this.autonomousMode && changeInfo.status === 'complete') {
        this.handleAutonomousExecution(tabId, tab);
      }
    });
  }

  createContextMenus() {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'analyze-text-ai',
        title: 'Analyze with AI',
        contexts: ['selection']
      });

      chrome.contextMenus.create({
        id: 'summarize-text',
        title: 'Summarize',
        contexts: ['selection']
      });

      chrome.contextMenus.create({
        id: 'analyze-page',
        title: 'Analyze Current Page',
        contexts: ['page']
      });
    });
  }

  async setDefaultConfiguration() {
    // Phase 3: Use chrome.storage for persistence
    const config = {
      autoAnalysis: false,
      aiEnabled: true,
      summaryLength: 'medium',
      notificationsEnabled: true
    };

    await chrome.storage.local.set({ config });
  }

  async handleExtensionUpdate(previousVersion) {
    // Migrate data if needed
    console.log(`[Migration] Checking migration from ${previousVersion}`);
    const data = await chrome.storage.local.get();
    // Add migration logic here if needed
  }

  async handleContextMenuClick(info, tab) {
    const selectedText = info.selectionText;

    if (info.menuItemId === 'analyze-text-ai') {
      const analysis = await this.analyzeTextWithAI(selectedText);
      this.displayAnalysisResults(analysis, tab.id);
    } else if (info.menuItemId === 'summarize-text') {
      const summary = await this.generateSummary(selectedText);
      this.displaySummary(summary, tab.id);
    } else if (info.menuItemId === 'analyze-page') {
      this.analyzeCurrentPage(tab.id);
    }
  }

  async generateSummary(text) {
    if (this.summarizer && text.length > 200) {
      try {
        return await this.summarizer.summarize(text);
      } catch (error) {
        console.error('[AI] Summarization error:', error);
      }
    }
    return text.length > 200 ? text.substring(0, 200) + '...' : text;
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'analyzeText':
          const analysis = await this.analyzeTextWithAI(request.text);
          sendResponse({ success: true, data: analysis });
          break;

        case 'summarize':
          const summary = await this.generateSummary(request.text);
          sendResponse({ success: true, data: { summary } });
          break;

        case 'checkAIAvailability':
          sendResponse({
            success: true,
            data: {
              promptAPI: !!this.aiSession,
              summarizer: !!this.summarizer
            }
          });
          break;

        case 'getPageInfo':
          this.getPageInfo(sender.tab.id).then(info => {
            sendResponse({ success: true, data: info });
          });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('[Message Handler] Error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  handleKeyboardCommand(command) {
    if (command === 'analyze-page') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          this.analyzeCurrentPage(tabs[0].id);
        }
      });
    }
  }

  async analyzeCurrentPage(tabId) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return {
            title: document.title,
            text: document.body.innerText,
            url: window.location.href,
            forms: document.forms.length,
            links: document.links.length,
            images: document.images.length
          };
        }
      });

      if (results[0]?.result) {
        const pageData = results[0].result;
        const analysis = await this.analyzeTextWithAI(pageData.text.substring(0, 5000));
        
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon48.png',
          title: 'Page Analysis Complete',
          message: `Analyzed: ${pageData.title}\nWords: ${analysis.wordCount}\nForms: ${pageData.forms}`,
          priority: 2
        });

        // Store analysis in session storage
        await chrome.storage.session.set({
          [`analysis_${tabId}`]: { ...analysis, pageData }
        });
      }
    } catch (error) {
      console.error('[Page Analysis] Error:', error);
    }
  }

  async displayAnalysisResults(analysis, tabId) {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (results) => {
        console.log('[AI Analysis Results]', results);
        // Results are displayed in popup
      },
      args: [analysis]
    });

    // Store in session for popup access
    await chrome.storage.session.set({ lastAnalysis: analysis });
  }

  async displaySummary(summary, tabId) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'Text Summary',
      message: summary.substring(0, 200),
      priority: 1
    });

    await chrome.storage.session.set({ lastSummary: summary });
  }

  async handleAutonomousExecution(tabId, tab) {
    if (!this.currentTask) return;

    console.log(`[Autonomous] Processing task on tab ${tabId}`);
    // Autonomous execution logic here
  }

  async getPageInfo(tabId) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        url: window.location.href,
        title: document.title,
        readyState: document.readyState
      })
    });
    return results[0]?.result || {};
  }
}

// Initialize the controller
const controller = new ExtensionController();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ExtensionController };
}
