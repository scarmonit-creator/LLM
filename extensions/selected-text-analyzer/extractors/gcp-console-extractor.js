// Google Cloud Console Data Extractor
// Specialized for Firebase service accounts and GCP resource extraction

class GCPConsoleExtractor {
  constructor() {
    // Resilient selectors with multiple fallbacks for Google Cloud Console UI changes
    this.selectors = {
      serviceAccount: {
        // Firebase service account email patterns
        email: [
          '[data-testid="service-account-email"]',
          '.service-account-email',
          '[aria-label*="email"]',
          'input[value*="@"][value*=".iam.gserviceaccount.com"]',
          'span[title*="@"][title*=".iam.gserviceaccount.com"]'
        ],
        // Unique ID selectors
        uniqueId: [
          '[data-testid="unique-id"]',
          '.unique-id',
          '[aria-label*="Unique ID"]',
          'span[title*="105"]', // Firebase service accounts often start with 105
          '.metadata-value'
        ],
        // Account status
        status: [
          '[data-testid="account-status"]',
          '.account-status',
          '.status-indicator',
          '[aria-label*="status"]',
          '.enabled, .disabled'
        ]
      },
      navigation: {
        permissions: 'a[href*="permissions"], [role="tab"][aria-label*="Permissions"]',
        keys: 'a[href*="keys"], [role="tab"][aria-label*="Keys"]',
        metrics: 'a[href*="metrics"], [role="tab"][aria-label*="Metrics"]',
        logs: 'a[href*="logs"], [role="tab"][aria-label*="Logs"]'
      },
      data: {
        permissions: '.iam-permissions li, .permissions-list .permission-item, .role-binding',
        keys: '.service-account-keys tr, .key-list .key-row, .key-table tbody tr',
        projects: '.project-list .project-item, .gcp-project'
      }
    };
    
    this.cache = new Map();
    this.lastExtraction = null;
    
    console.log('🌍 GCPConsoleExtractor initialized for Firebase service accounts');
  }

  /**
   * Main extraction method - extracts all available GCP Console data
   * @param {object} options - Extraction options
   * @returns {object} Extracted data with metadata
   */
  async extractAll(options = {}) {
    const startTime = performance.now();
    
    try {
      const data = {
        timestamp: Date.now(),
        url: window.location.href,
        pageTitle: document.title,
        extractionId: this.generateId(),
        
        // Core service account data
        serviceAccount: await this.extractServiceAccount(),
        
        // Navigation and tabs
        navigation: this.extractNavigation(),
        
        // Permissions and access
        permissions: await this.extractPermissions(),
        
        // Service account keys
        keys: await this.extractKeys(),
        
        // Page metadata
        metadata: {
          extractionTime: performance.now() - startTime,
          elementsScanned: document.querySelectorAll('*').length,
          pageLoadState: document.readyState,
          viewportSize: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        }
      };
      
      // Validate and clean extracted data
      const cleanedData = this.validateAndClean(data);
      
      // Cache for potential re-use
      this.cache.set('lastExtraction', {
        data: cleanedData,
        timestamp: Date.now()
      });
      
      this.lastExtraction = cleanedData;
      
      console.log('✅ GCP Console extraction completed:', {
        serviceAccount: !!cleanedData.serviceAccount?.email,
        permissions: cleanedData.permissions?.length || 0,
        keys: cleanedData.keys?.length || 0,
        extractionTime: cleanedData.metadata.extractionTime + 'ms'
      });
      
      return cleanedData;
      
    } catch (error) {
      console.error('❌ GCP Console extraction failed:', error);
      return {
        error: error.message,
        timestamp: Date.now(),
        url: window.location.href,
        stack: error.stack
      };
    }
  }

  /**
   * Extract Firebase service account information
   * @returns {object} Service account data
   */
  async extractServiceAccount() {
    const account = {};
    
    // Extract email with multiple fallback strategies
    account.email = this.findWithFallbacks(this.selectors.serviceAccount.email) ||
                   this.extractFromPageText(/firebase-adminsdk-[\w-]+@[\w-]+\.iam\.gserviceaccount\.com/i) ||
                   this.extractFromAttributes('value', /@.*\.iam\.gserviceaccount\.com/) ||
                   this.extractFromAttributes('title', /@.*\.iam\.gserviceaccount\.com/);
    
    // Extract unique ID (typically starts with 105 for Firebase service accounts)
    account.uniqueId = this.findWithFallbacks(this.selectors.serviceAccount.uniqueId) ||
                      this.extractFromPageText(/105\d{18,20}/) ||
                      this.extractFromAttributes('data-id', /\d{15,25}/);
    
    // Extract status
    account.status = this.findWithFallbacks(this.selectors.serviceAccount.status) ||
                    this.detectStatus();
    
    // Extract additional metadata from the page
    account.displayName = this.extractFromPageText(/Display name[:\s]+([^\n\r]+)/i, 1);
    account.description = this.extractFromPageText(/Description[:\s]+([^\n\r]+)/i, 1);
    account.created = this.extractFromPageText(/Created[:\s]+([^\n\r]+)/i, 1);
    
    return account;
  }

  /**
   * Extract navigation tabs and links
   * @returns {object} Navigation data
   */
  extractNavigation() {
    const nav = {};
    
    for (const [key, selector] of Object.entries(this.selectors.navigation)) {
      const element = document.querySelector(selector);
      if (element) {
        nav[key] = {
          text: element.textContent?.trim(),
          href: element.href,
          active: this.isActiveTab(element),
          available: true
        };
      } else {
        nav[key] = { available: false };
      }
    }
    
    return nav;
  }

  /**
   * Extract IAM permissions and roles
   * @returns {Array} Permissions list
   */
  async extractPermissions() {
    const permissions = [];
    
    // Try multiple selector strategies
    for (const selector of this.selectors.data.permissions.split(', ')) {
      const elements = document.querySelectorAll(selector);
      
      for (const element of elements) {
        const permission = {
          text: element.textContent?.trim(),
          role: element.querySelector('.role, .permission-role')?.textContent?.trim(),
          resource: element.querySelector('.resource, .permission-resource')?.textContent?.trim(),
          type: this.classifyPermission(element.textContent)
        };
        
        if (permission.text && permission.text.length > 0) {
          permissions.push(permission);
        }
      }
    }
    
    // Deduplicate based on text content
    return this.deduplicateArray(permissions, 'text');
  }

  /**
   * Extract service account keys
   * @returns {Array} Keys list
   */
  async extractKeys() {
    const keys = [];
    
    // Try table-based extraction first
    const keyRows = document.querySelectorAll(this.selectors.data.keys);
    
    for (const row of keyRows) {
      const cells = row.querySelectorAll('td, th');
      
      if (cells.length >= 2) {
        const key = {
          keyId: cells[0]?.textContent?.trim(),
          created: cells[1]?.textContent?.trim(),
          expires: cells[2]?.textContent?.trim(),
          algorithm: cells[3]?.textContent?.trim(),
          status: this.extractKeyStatus(row)
        };
        
        // Only add if we have meaningful key data
        if (key.keyId && key.keyId !== 'Key ID' && key.keyId.length > 5) {
          keys.push(key);
        }
      }
    }
    
    return keys;
  }

  /**
   * Find element text using multiple fallback selectors
   * @param {Array} selectors - Array of CSS selectors to try
   * @returns {string|null} Found text or null
   */
  findWithFallbacks(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim() || element.value?.trim();
        if (text && text.length > 0) {
          return text;
        }
      }
    }
    return null;
  }

  /**
   * Extract data from page text using regex
   * @param {RegExp} pattern - Regex pattern to match
   * @param {number} group - Capture group to return (default 0)
   * @returns {string|null} Matched text or null
   */
  extractFromPageText(pattern, group = 0) {
    const pageText = document.body.textContent;
    const match = pageText.match(pattern);
    return match ? match[group] : null;
  }

  /**
   * Extract data from element attributes
   * @param {string} attribute - Attribute name to search
   * @param {RegExp} pattern - Pattern to match in attribute value
   * @returns {string|null} Matched value or null
   */
  extractFromAttributes(attribute, pattern) {
    const elements = document.querySelectorAll(`[${attribute}]`);
    
    for (const element of elements) {
      const value = element.getAttribute(attribute);
      if (value && pattern.test(value)) {
        return value.match(pattern)[0];
      }
    }
    
    return null;
  }

  /**
   * Detect account status from various UI indicators
   * @returns {string} Status (enabled/disabled/unknown)
   */
  detectStatus() {
    // Check for common status indicators
    if (document.querySelector('.enabled, [aria-label*="enabled"], .status-enabled')) {
      return 'Enabled';
    }
    
    if (document.querySelector('.disabled, [aria-label*="disabled"], .status-disabled')) {
      return 'Disabled';
    }
    
    // Check page text for status indicators
    const pageText = document.body.textContent.toLowerCase();
    if (pageText.includes('service account status') && pageText.includes('enabled')) {
      return 'Enabled';
    }
    
    return 'Unknown';
  }

  /**
   * Check if navigation element is active/selected
   * @param {Element} element - Navigation element
   * @returns {boolean} True if active
   */
  isActiveTab(element) {
    return element.classList.contains('active') ||
           element.classList.contains('selected') ||
           element.getAttribute('aria-selected') === 'true' ||
           element.getAttribute('aria-current') === 'page';
  }

  /**
   * Classify permission type based on content
   * @param {string} text - Permission text
   * @returns {string} Permission type
   */
  classifyPermission(text) {
    if (!text) return 'unknown';
    
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('admin') || lowerText.includes('owner')) return 'admin';
    if (lowerText.includes('editor') || lowerText.includes('write')) return 'editor';
    if (lowerText.includes('viewer') || lowerText.includes('read')) return 'viewer';
    if (lowerText.includes('service') || lowerText.includes('account')) return 'service';
    
    return 'custom';
  }

  /**
   * Extract key status from table row
   * @param {Element} row - Table row element
   * @returns {string} Key status
   */
  extractKeyStatus(row) {
    const statusElement = row.querySelector('.status, .key-status, [data-status]');
    if (statusElement) {
      return statusElement.textContent?.trim() || statusElement.getAttribute('data-status');
    }
    
    // Check for visual indicators
    if (row.classList.contains('disabled') || row.querySelector('.disabled')) {
      return 'Disabled';
    }
    
    return 'Active';
  }

  /**
   * Remove duplicate entries from array based on property
   * @param {Array} array - Array to deduplicate
   * @param {string} property - Property to use for deduplication
   * @returns {Array} Deduplicated array
   */
  deduplicateArray(array, property) {
    const seen = new Set();
    return array.filter(item => {
      const value = item[property];
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
  }

  /**
   * Validate and clean extracted data
   * @param {object} data - Raw extracted data
   * @returns {object} Cleaned and validated data
   */
  validateAndClean(data) {
    // Remove empty values and validate structure
    const clean = (obj) => {
      if (Array.isArray(obj)) {
        return obj.filter(item => item && Object.keys(item).length > 0)
                 .map(item => clean(item));
      } else if (obj && typeof obj === 'object') {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value !== null && value !== undefined && value !== '') {
            cleaned[key] = clean(value);
          }
        }
        return cleaned;
      }
      return obj;
    };
    
    const cleanedData = clean(data);
    
    // Add validation warnings
    cleanedData.validation = {
      hasServiceAccount: !!(cleanedData.serviceAccount?.email || cleanedData.serviceAccount?.uniqueId),
      hasPermissions: !!(cleanedData.permissions?.length > 0),
      hasKeys: !!(cleanedData.keys?.length > 0),
      isComplete: false
    };
    
    // Mark as complete if we have core service account info
    cleanedData.validation.isComplete = 
      cleanedData.validation.hasServiceAccount && 
      (cleanedData.validation.hasPermissions || cleanedData.validation.hasKeys);
    
    return cleanedData;
  }

  /**
   * Generate unique extraction ID
   * @returns {string} Unique identifier
   */
  generateId() {
    return `gcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get cached extraction data
   * @param {number} maxAge - Maximum age of cached data in ms
   * @returns {object|null} Cached data or null
   */
  getCachedData(maxAge = 30000) {
    const cached = this.cache.get('lastExtraction');
    if (cached && (Date.now() - cached.timestamp) < maxAge) {
      return cached.data;
    }
    return null;
  }

  /**
   * Clear extraction cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 GCP Console extractor cache cleared');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GCPConsoleExtractor;
} else if (typeof window !== 'undefined') {
  window.GCPConsoleExtractor = GCPConsoleExtractor;
}