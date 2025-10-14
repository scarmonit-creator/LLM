// Options page JavaScript for Text Analyzer Pro
// Handles configuration management and user preferences

class OptionsManager {
  constructor() {
    this.defaultConfig = {
      autoAnalyze: true,
      autoOpen: true,
      autoAnalyzeDelay: 2000,
      cacheTimeout: 300000, // 5 minutes in ms
      maxCacheSize: 100,
      enableAdvancedMetrics: true,
      enableWordFrequency: true,
      minTextLength: 50,
      enableNotifications: true,
      debugMode: false,
      theme: 'auto'
    };
    
    this.currentConfig = { ...this.defaultConfig };
    this.initialize();
  }

  async initialize() {
    await this.loadConfig();
    this.setupEventListeners();
    this.updateUI();
    this.updateCacheInfo();
  }

  async loadConfig() {
    const stored = await chrome.storage.local.get(['config']);
    if (stored.config) {
      this.currentConfig = { ...this.defaultConfig, ...stored.config };
    }
  }

  async saveConfig() {
    await chrome.storage.local.set({ config: this.currentConfig });
    
    // Notify background script of config change
    chrome.runtime.sendMessage({
      action: 'updateConfig',
      config: this.currentConfig
    });
  }

  setupEventListeners() {
    // Save button
    document.getElementById('saveSettings').addEventListener('click', () => {
      this.saveSettings();
    });

    // Reset button
    document.getElementById('resetSettings').addEventListener('click', () => {
      this.resetToDefaults();
    });

    // Export button
    document.getElementById('exportSettings').addEventListener('click', () => {
      this.exportSettings();
    });

    // Import button
    document.getElementById('importSettings').addEventListener('click', () => {
      document.getElementById('importFile').click();
    });

    // Import file handler
    document.getElementById('importFile').addEventListener('change', (event) => {
      this.importSettings(event);
    });

    // Clear cache button
    document.getElementById('clearCache').addEventListener('click', () => {
      this.clearCache();
    });

    // Input change listeners
    this.setupInputListeners();
  }

  setupInputListeners() {
    const inputs = {
      // Checkboxes
      autoAnalyze: 'checkbox',
      autoOpen: 'checkbox',
      enableAdvancedMetrics: 'checkbox',
      enableWordFrequency: 'checkbox',
      enableNotifications: 'checkbox',
      debugMode: 'checkbox',
      
      // Numbers
      autoAnalyzeDelay: 'number',
      cacheTimeout: 'number',
      maxCacheSize: 'number',
      minTextLength: 'number',
      
      // Select
      theme: 'select'
    };

    Object.entries(inputs).forEach(([key, type]) => {
      const element = document.getElementById(key);
      if (element) {
        element.addEventListener('change', () => {
          if (type === 'checkbox') {
            this.currentConfig[key] = element.checked;
          } else if (type === 'number') {
            this.currentConfig[key] = type === 'cacheTimeout' 
              ? parseInt(element.value) * 60000 // Convert minutes to ms
              : parseInt(element.value);
          } else {
            this.currentConfig[key] = element.value;
          }
        });
      }
    });
  }

  updateUI() {
    // Update checkboxes
    const checkboxes = ['autoAnalyze', 'autoOpen', 'enableAdvancedMetrics', 
                       'enableWordFrequency', 'enableNotifications', 'debugMode'];
    
    checkboxes.forEach(key => {
      const element = document.getElementById(key);
      if (element) {
        element.checked = this.currentConfig[key];
      }
    });

    // Update number inputs
    document.getElementById('autoAnalyzeDelay').value = this.currentConfig.autoAnalyzeDelay;
    document.getElementById('cacheTimeout').value = Math.floor(this.currentConfig.cacheTimeout / 60000); // Convert ms to minutes
    document.getElementById('maxCacheSize').value = this.currentConfig.maxCacheSize;
    document.getElementById('minTextLength').value = this.currentConfig.minTextLength;

    // Update select
    document.getElementById('theme').value = this.currentConfig.theme;
  }

  async saveSettings() {
    try {
      await this.saveConfig();
      this.showStatus('Settings saved successfully!', 'success');
    } catch (error) {
      this.showStatus('Failed to save settings: ' + error.message, 'error');
    }
  }

  async resetToDefaults() {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      this.currentConfig = { ...this.defaultConfig };
      await this.saveConfig();
      this.updateUI();
      this.showStatus('Settings reset to defaults', 'success');
    }
  }

  exportSettings() {
    const data = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      config: this.currentConfig
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `text-analyzer-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    this.showStatus('Settings exported successfully', 'success');
  }

  async importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.config) {
        this.currentConfig = { ...this.defaultConfig, ...data.config };
        await this.saveConfig();
        this.updateUI();
        this.showStatus('Settings imported successfully', 'success');
      } else {
        throw new Error('Invalid settings file format');
      }
    } catch (error) {
      this.showStatus('Failed to import settings: ' + error.message, 'error');
    }
    
    event.target.value = ''; // Reset file input
  }

  async clearCache() {
    try {
      await chrome.runtime.sendMessage({ action: 'clearCache' });
      await this.updateCacheInfo();
      this.showStatus('Cache cleared successfully', 'success');
    } catch (error) {
      this.showStatus('Failed to clear cache: ' + error.message, 'error');
    }
  }

  async updateCacheInfo() {
    try {
      // Get cache statistics from storage
      const storage = await chrome.storage.local.get();
      const cacheKeys = Object.keys(storage).filter(key => 
        key.startsWith('text_') || key.startsWith('analysis_')
      );
      
      const cacheSize = cacheKeys.length;
      const storageSize = JSON.stringify(storage).length;
      
      document.getElementById('cacheUsage').textContent = 
        `${cacheSize} entries (~${Math.round(storageSize / 1024)} KB)`;
    } catch (error) {
      document.getElementById('cacheUsage').textContent = 'Unable to calculate';
    }
  }

  showStatus(message, type) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';
    
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  }

  // Validation helpers
  validateConfig(config) {
    const errors = [];
    
    if (config.autoAnalyzeDelay < 1000 || config.autoAnalyzeDelay > 10000) {
      errors.push('Auto-analyze delay must be between 1000-10000ms');
    }
    
    if (config.maxCacheSize < 10 || config.maxCacheSize > 1000) {
      errors.push('Cache size must be between 10-1000 entries');
    }
    
    if (config.minTextLength < 10 || config.minTextLength > 1000) {
      errors.push('Minimum text length must be between 10-1000 characters');
    }
    
    return errors;
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OptionsManager();
});

// Handle theme changes immediately
document.getElementById('theme')?.addEventListener('change', (e) => {
  const theme = e.target.value;
  document.body.setAttribute('data-theme', theme);
  
  // Apply theme immediately
  if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.body.style.backgroundColor = '#1a1a1a';
    document.body.style.color = '#ffffff';
    document.querySelector('.container').style.backgroundColor = '#2d2d2d';
  } else {
    document.body.style.backgroundColor = '#f5f5f5';
    document.body.style.color = '#333333';
    document.querySelector('.container').style.backgroundColor = '#ffffff';
  }
});

// Auto-save on input changes (debounced)
let saveTimeout;
function scheduleAutoSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    document.getElementById('saveSettings')?.click();
  }, 1000);
}

// Add auto-save to all inputs
document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('input, select');
  inputs.forEach(input => {
    if (input.id !== 'importFile') {
      input.addEventListener('change', scheduleAutoSave);
    }
  });
});
