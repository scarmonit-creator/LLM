// Optimized service worker for selected-text-analyzer
// Focus: low-latency selection/page extraction, robust messaging, graceful AI fallback

class ExtensionController {
  constructor() {
    this.autonomousMode = false;
    this.aiSession = null;
    this.summarizer = null;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    // Don't block startup on AI init; fire-and-forget to reduce cold-start latency
    this.initializeAI().catch(err => console.warn('[AI:init] skipped', err));
  }

  // Initialize Chrome Built-in AI, if available
  async initializeAI() {
    if (typeof ai === 'undefined') return;
    try {
      if (ai.languageModel) {
        const caps = await ai.languageModel.capabilities();
        if (caps.available === 'readily') {
          this.aiSession = await ai.languageModel.create({
            systemPrompt: 'You are a concise, actionable text analysis assistant.'
          });
        }
      }
      if (ai.summarizer) {
        const sumCaps = await ai.summarizer.capabilities();
        if (sumCaps.available === 'readily') {
          this.summarizer = await ai.summarizer.create({ type: 'key-points', format: 'markdown', length: 'medium' });
        }
      }
    } catch (e) {
      console.warn('[AI] unavailable, continuing without it', e);
    }
  }

  // Sanitize and clamp input to avoid excessive payloads and UI stalls
  sanitizeText(input, maxLen = 8000) {
    if (!input) return '';
    const text = String(input).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]+/g, ' ').trim();
    if (text.length > maxLen) return text.slice(0, maxLen);
    return text;
  }

  // Basic non-AI analysis (fast path)
  performBasicAnalysis(text) {
    const t = this.sanitizeText(text, 8000);
    if (!t) return { error: 'No text provided' };
    const sentences = t.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = t.split(/\s+/).filter(Boolean);
    const avg = sentences.length ? words.length / sentences.length : words.length;
    return {
      sentiment: 'neutral',
      sentences: sentences.length,
      wordCount: words.length,
      charCount: t.length,
      avgWordsPerSentence: Number.isFinite(avg) ? Number(avg.toFixed(1)) : 0,
      readability: avg < 15 ? 'easy' : avg < 25 ? 'moderate' : 'complex',
      note: 'Basic analysis (no on-device AI)'
    };
  }

  // AI-powered analysis with graceful fallback and timeout
  async analyzeTextWithAI(text, { timeoutMs = 2500 } = {}) {
    const t = this.sanitizeText(text);
    if (!t) return { error: 'No text provided' };

    const basic = this.performBasicAnalysis(t);
    // If no AI, return basic immediately
    if (!this.aiSession) return { ...basic, aiAnalysis: null, summary: null, timestamp: new Date().toISOString() };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const prompt = `Analyze the text. Return JSON with keys: sentiment, themes, readabilityNote, suggestions (array of short items). Text:\n\n${t}`;
      const resp = await this.aiSession.prompt(prompt, { signal: controller.signal });
      clearTimeout(timer);
      let aiAnalysis = resp;
      // If the model returned plain text, wrap it
      if (typeof aiAnalysis === 'string') aiAnalysis = { raw: aiAnalysis };

      let summary = null;
      if (this.summarizer && t.length > 500) {
        try { summary = await this.summarizer.summarize(t); } catch (e) { console.warn('[AI:sum] fail', e); }
      }
      return { ...basic, aiAnalysis, summary, timestamp: new Date().toISOString() };
    } catch (e) {
      clearTimeout(timer);
      console.warn('[AI] analysis timeout/fail, using basic', e);
      return { ...basic, aiAnalysis: null, summary: null, timestamp: new Date().toISOString() };
    }
  }

  setupEventListeners() {
    chrome.runtime.onInstalled.addListener((details) => {
      this.createContextMenus();
      this.ensureDefaultConfig();
      if (details.reason === 'update') {
        console.log('[Update] from', details.previousVersion);
      }
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab).catch(err => console.error('[ContextMenu]', err));
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender).then((res) => {
        sendResponse({ success: true, data: res });
      }).catch(err => {
        console.error('[Message]', err);
        sendResponse({ success: false, error: String(err?.message || err) });
      });
      return true; // async
    });

    chrome.commands.onCommand.addListener((command) => {
      if (command === 'analyze-page') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) this.analyzeCurrentPage(tabs[0].id).catch(e => console.error(e));
        });
      }
    });
  }

  createContextMenus() {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({ id: 'analyze-text-ai', title: 'Analyze selection', contexts: ['selection'] });
      chrome.contextMenus.create({ id: 'summarize-text', title: 'Summarize selection', contexts: ['selection'] });
      chrome.contextMenus.create({ id: 'analyze-page', title: 'Analyze current page', contexts: ['page'] });
    });
  }

  async ensureDefaultConfig() {
    const defaults = { aiEnabled: true, notificationsEnabled: true, summaryLength: 'medium' };
    const stored = await chrome.storage.local.get('config');
    await chrome.storage.local.set({ config: { ...defaults, ...(stored?.config || {}) } });
  }

  async handleContextMenuClick(info, tab) {
    const tabId = tab?.id;
    if (!tabId) return;

    if (info.menuItemId === 'analyze-text-ai') {
      const text = this.sanitizeText(info.selectionText || '');
      const analysis = await this.analyzeTextWithAI(text);
      await this.storeSession({ lastAnalysis: analysis });
      this.notify('Selection analyzed', `Words: ${analysis.wordCount}`);
    } else if (info.menuItemId === 'summarize-text') {
      const text = this.sanitizeText(info.selectionText || '');
      const summary = await this.getSummary(text);
      await this.storeSession({ lastSummary: summary });
      this.notify('Selection summarized', summary.slice(0, 180));
    } else if (info.menuItemId === 'analyze-page') {
      await this.analyzeCurrentPage(tabId);
    }
  }

  async getSummary(text) {
    const t = this.sanitizeText(text, 4000);
    if (!t) return '';
    if (this.summarizer && t.length > 200) {
      try { return await this.summarizer.summarize(t); } catch (e) { console.warn('[sum]', e); }
    }
    return t.length > 400 ? `${t.slice(0, 400)}…` : t;
  }

  async handleMessage(request, sender) {
    switch (request?.action) {
      case 'analyzeText':
        return await this.analyzeTextWithAI(request.text);
      case 'summarize':
        return { summary: await this.getSummary(request.text) };
      case 'getPageInfo':
        return await this.getPageInfo(sender?.tab?.id);
      case 'extractSelection':
        return await this.extractSelection(sender?.tab?.id);
      default:
        throw new Error('Unknown action');
    }
  }

  async extractSelection(tabId) {
    if (!tabId) return { text: '' };
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const sel = window.getSelection?.();
        return { text: sel ? String(sel.toString()).trim() : '' };
      }
    });
    return res?.result || { text: '' };
  }

  async analyzeCurrentPage(tabId) {
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => ({
          title: document.title,
          text: document.body?.innerText || '',
          url: location.href,
          forms: document.forms?.length || 0,
          links: document.links?.length || 0,
          images: document.images?.length || 0,
        })
      });
      const page = res?.result || { title: '', text: '' };
      const analysis = await this.analyzeTextWithAI(page.text.slice(0, 12000));
      await this.storeSession({ [`analysis_${tabId}`]: { ...analysis, pageData: page } });
      this.notify('Page analysis complete', `Words: ${analysis.wordCount} | Forms: ${page.forms}`);
    } catch (e) {
      console.error('[PageAnalysis]', e);
    }
  }

  async getPageInfo(tabId) {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({ url: location.href, title: document.title, readyState: document.readyState })
    });
    return res?.result || {};
  }

  async storeSession(obj) {
    try { await chrome.storage.session.set(obj); } catch (e) { console.warn('[storage:session]', e); }
  }

  notify(title, message) {
    try {
      chrome.notifications?.create?.({ type: 'basic', iconUrl: 'icon48.png', title, message: String(message || '').slice(0, 200), priority: 1 });
    } catch (e) {
      // notifications permission may be missing; ignore
    }
  }
}

const controller = new ExtensionController();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ExtensionController };
}
