/**
 * Scarmonit Frontend Configuration
 * Integrates redesigned frontend with existing backend infrastructure
 */

const ScarmonitConfig = {
  // API Configuration - matches your current backend
  api: {
    baseUrl: window.location.hostname === 'localhost' 
      ? 'http://localhost:3000/api'
      : 'https://api.scarmonit.com/api',
    endpoints: {
      waitlist: '/waitlist',
      contact: '/contact',
      auth: '/auth',
      gmail: '/gmail',
      plaid: '/plaid',
      transactions: '/transactions',
      categories: '/categories',
      insights: '/insights'
    },
    timeout: 10000
  },

  // Form Configuration - matches your current form structure
  forms: {
    waitlist: {
      action: '/api/waitlist',
      method: 'POST',
      fields: {
        name: { required: true, type: 'text' },
        email: { required: true, type: 'email' },
        priority: { required: true, type: 'select' },
        note: { required: false, type: 'textarea' }
      },
      successRedirect: '/thank-you',
      analytics: {
        event: 'waitlist_signup',
        category: 'conversion'
      }
    }
  },

  // Analytics Configuration
  analytics: {
    googleAnalytics: {
      measurementId: 'G-XXXXXXXXX', // Replace with your GA4 ID
      enabled: true
    },
    mixpanel: {
      token: 'your-mixpanel-token', // Replace with your Mixpanel token
      enabled: false
    },
    events: {
      pageView: 'page_view',
      waitlistSignup: 'waitlist_signup',
      ctaClick: 'cta_click',
      sectionView: 'section_view',
      formSubmit: 'form_submit',
      errorOccurred: 'error_occurred'
    }
  },

  // Feature Flags - matches your roadmap
  features: {
    gmailIntegration: true,
    plaidIntegration: true, // Beta phase
    aiInsights: false, // GA phase
    mobileApp: false, // GA phase
    multiUser: false, // GA phase
    exportFeatures: false // Beta phase
  },

  // Security Configuration
  security: {
    csrf: {
      enabled: true,
      tokenName: '_token'
    },
    rateLimit: {
      waitlist: { requests: 5, window: 300 }, // 5 requests per 5 minutes
      contact: { requests: 3, window: 600 }   // 3 requests per 10 minutes
    }
  },

  // UI Configuration
  ui: {
    theme: {
      primary: '#2563eb',
      secondary: '#10b981',
      accent: '#f59e0b'
    },
    animations: {
      enabled: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      duration: {
        fast: 150,
        normal: 300,
        slow: 500
      }
    },
    breakpoints: {
      mobile: 768,
      tablet: 1024,
      desktop: 1200
    }
  },

  // Integration with existing backend services
  services: {
    gmail: {
      watchEnabled: true,
      parseReceipts: true,
      categories: ['receipts', 'confirmations', 'statements']
    },
    plaid: {
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
      products: ['transactions', 'accounts', 'identity'],
      countryCodes: ['US', 'CA']
    },
    ai: {
      categorization: {
        enabled: true,
        confidence: 0.8,
        fallbackToRules: true
      },
      insights: {
        enabled: false, // Will be enabled in GA phase
        refreshInterval: 3600000 // 1 hour
      }
    }
  },

  // Error Handling
  errors: {
    retry: {
      attempts: 3,
      delay: 1000,
      exponential: true
    },
    reporting: {
      enabled: true,
      endpoint: '/api/errors',
      includeUserAgent: true,
      includeUrl: true
    }
  },

  // Development Configuration
  development: {
    debug: process.env.NODE_ENV === 'development',
    mockApi: false,
    showGrid: false,
    logAnalytics: true
  }
};

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScarmonitConfig;
} else {
  window.ScarmonitConfig = ScarmonitConfig;
}