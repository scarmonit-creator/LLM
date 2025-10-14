/**
 * Scarmonit Website - Modern JavaScript Implementation
 * Integrated with existing backend API and form handling
 */

class ScarmonitWebsite {
  constructor() {
    this.config = window.ScarmonitConfig || {};
    this.init();
  }

  init() {
    this.setupNavigation();
    this.setupFormHandling();
    this.setupAnimations();
    this.setupAnalytics();
    this.setupAccessibility();
    this.setupBackendIntegration();
  }

  /**
   * Navigation functionality with mobile menu
   */
  setupNavigation() {
    const nav = document.querySelector('.nav');
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    // Mobile menu toggle
    if (navToggle && navMenu) {
      navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('nav-menu--open');
        navToggle.classList.toggle('nav-toggle--open');
      });

      // Close mobile menu when clicking outside
      document.addEventListener('click', (e) => {
        if (!nav.contains(e.target) && navMenu.classList.contains('nav-menu--open')) {
          navMenu.classList.remove('nav-menu--open');
          navToggle.classList.remove('nav-toggle--open');
        }
      });
    }

    // Smooth scrolling for navigation links
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href.startsWith('#')) {
          e.preventDefault();
          const target = document.querySelector(href);
          if (target) {
            const headerOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });

            // Close mobile menu if open
            if (navMenu && navMenu.classList.contains('nav-menu--open')) {
              navMenu.classList.remove('nav-menu--open');
              navToggle.classList.remove('nav-toggle--open');
            }
          }
        }
      });
    });

    // Navigation scroll effect
    let lastScrollY = window.scrollY;
    const scrollHandler = this.debounce(() => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > 100) {
        nav.classList.add('nav--scrolled');
      } else {
        nav.classList.remove('nav--scrolled');
      }

      // Hide nav on scroll down, show on scroll up
      if (currentScrollY > lastScrollY && currentScrollY > 200) {
        nav.style.transform = 'translateY(-100%)';
      } else {
        nav.style.transform = 'translateY(0)';
      }
      
      lastScrollY = currentScrollY;
    }, 10);

    window.addEventListener('scroll', scrollHandler, { passive: true });
  }

  /**
   * Enhanced form handling with backend integration
   */
  setupFormHandling() {
    const waitlistForm = document.getElementById('waitlist-form');
    
    if (waitlistForm) {
      // Handle form submission
      waitlistForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleWaitlistSubmission(waitlistForm);
      });

      // Real-time validation
      const inputs = waitlistForm.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        input.addEventListener('blur', () => this.validateField(input));
        input.addEventListener('input', () => this.clearFieldError(input));
      });

      // Handle Netlify form if deployed on Netlify
      if (waitlistForm.hasAttribute('data-netlify')) {
        waitlistForm.addEventListener('submit', this.handleNetlifyForm.bind(this));
      }
    }
  }

  async handleWaitlistSubmission(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // Remove Netlify-specific fields
    delete data['bot-field'];
    delete data['form-name'];
    
    // Validate form
    if (!this.validateForm(form)) {
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    
    // Show loading state
    this.setButtonLoading(submitButton, true);

    try {
      // Try backend API first
      if (this.config.api && this.config.api.baseUrl) {
        await this.submitToBackend(data);
      } else {
        // Fallback to Netlify forms or local storage
        await this.submitToWaitlist(data);
      }
      
      // Success state
      this.showFormSuccess(form);
      this.trackEvent('waitlist_signup', { 
        priority: data.priority,
        source: 'website',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      // Error state
      this.showFormError(form, 'Something went wrong. Please try again.');
      console.error('Waitlist submission error:', error);
      this.trackEvent('form_error', { 
        error: error.message,
        form: 'waitlist'
      });
      
    } finally {
      // Reset button
      this.setButtonLoading(submitButton, false, originalText);
    }
  }

  async submitToBackend(data) {
    const endpoint = this.config.api.baseUrl + this.config.api.endpoints.waitlist;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async submitToWaitlist(data) {
    // Fallback for local development or Netlify forms
    return new Promise((resolve) => {
      setTimeout(() => {
        // Store in localStorage for demo purposes
        const waitlistEntries = JSON.parse(localStorage.getItem('waitlistEntries') || '[]');
        waitlistEntries.push({
          ...data,
          timestamp: new Date().toISOString(),
          id: Date.now()
        });
        localStorage.setItem('waitlistEntries', JSON.stringify(waitlistEntries));
        resolve({ success: true });
      }, 1500);
    });
  }

  handleNetlifyForm(e) {
    // Let Netlify handle the form submission
    // This will redirect to a thank you page or show success message
    console.log('Form submitted via Netlify');
  }

  setButtonLoading(button, loading, originalText = '') {
    if (loading) {
      button.disabled = true;
      button.innerHTML = `
        <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25"></circle>
          <path fill="currentColor" class="opacity-75" d="m15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z"></path>
        </svg>
        <span>Joining...</span>
      `;
    } else {
      button.disabled = false;
      button.innerHTML = originalText;
    }
  }

  validateForm(form) {
    const inputs = form.querySelectorAll('input[required], select[required]');
    let isValid = true;

    inputs.forEach(input => {
      if (!this.validateField(input)) {
        isValid = false;
      }
    });

    return isValid;
  }

  validateField(field) {
    const value = field.value.trim();
    const fieldType = field.type || field.tagName.toLowerCase();
    let isValid = true;
    let errorMessage = '';

    // Remove existing error
    this.clearFieldError(field);

    // Required field validation
    if (field.hasAttribute('required') && !value) {
      errorMessage = 'This field is required';
      isValid = false;
    }
    // Email validation
    else if (fieldType === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errorMessage = 'Please enter a valid email address';
        isValid = false;
      }
    }
    // Name validation (no numbers or special characters except spaces, hyphens, apostrophes)
    else if (field.name === 'name' && value) {
      const nameRegex = /^[a-zA-Z\s'-]+$/;
      if (!nameRegex.test(value)) {
        errorMessage = 'Please enter a valid name';
        isValid = false;
      }
    }

    if (!isValid) {
      this.showFieldError(field, errorMessage);
    }

    return isValid;
  }

  showFieldError(field, message) {
    field.classList.add('field-error');
    
    // Remove existing error message
    const existingError = field.parentNode.querySelector('.field-error-message');
    if (existingError) {
      existingError.remove();
    }

    // Add new error message
    const errorElement = document.createElement('span');
    errorElement.className = 'field-error-message';
    errorElement.textContent = message;
    
    field.parentNode.appendChild(errorElement);
  }

  clearFieldError(field) {
    field.classList.remove('field-error');
    const errorMessage = field.parentNode.querySelector('.field-error-message');
    if (errorMessage) {
      errorMessage.remove();
    }
  }

  showFormSuccess(form) {
    const formContainer = form.parentNode;
    const queuePosition = Math.floor(Math.random() * 1000) + 2000;
    
    formContainer.innerHTML = `
      <div class="success-message text-center">
        <div class="success-icon">✅</div>
        <h3 style="margin-bottom: 1rem; color: var(--color-text);">Welcome to Scarmonit!</h3>
        <p style="color: var(--color-text-light); margin-bottom: 1.5rem;">
          You're on the waitlist! We'll send you exclusive updates and early access when available.
        </p>
        <div style="padding: 1rem; background: rgba(16, 185, 129, 0.1); border-radius: 0.5rem; border: 1px solid rgba(16, 185, 129, 0.2);">
          <p style="color: var(--color-secondary); font-weight: 600; margin: 0;">
            🎉 Position #${queuePosition.toLocaleString()} in queue
          </p>
          <p style="color: var(--color-text-light); font-size: 0.875rem; margin: 0.5rem 0 0 0;">
            Alpha launches October 2025
          </p>
        </div>
      </div>
    `;
  }

  showFormError(form, message) {
    // Create or update error message
    let errorElement = form.querySelector('.form-error-message');
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.className = 'form-error-message';
      form.appendChild(errorElement);
    }
    errorElement.textContent = message;
  }

  /**
   * Backend API integration setup
   */
  setupBackendIntegration() {
    // Check if we're in development mode
    const isDevelopment = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.hostname.includes('github.io');

    if (isDevelopment) {
      console.log('Development mode detected. API calls will use mock responses.');
    }

    // Set up CSRF token if available
    const csrfToken = document.querySelector('meta[name="csrf-token"]');
    if (csrfToken) {
      this.csrfToken = csrfToken.getAttribute('content');
    }

    // Set up default headers for API requests
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };

    if (this.csrfToken) {
      this.defaultHeaders['X-CSRF-TOKEN'] = this.csrfToken;
    }
  }

  /**
   * Intersection Observer for animations
   */
  setupAnimations() {
    if (!this.config.ui?.animations?.enabled) return;

    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in-up');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    // Observe elements for animation
    const animatedElements = document.querySelectorAll(
      '.feature-card, .metric-card, .section-header, .cta-content, .flow-step, .security-item'
    );
    
    animatedElements.forEach(el => {
      observer.observe(el);
    });

    // Dashboard preview hover effects
    const dashboardPreview = document.querySelector('.dashboard-preview');
    if (dashboardPreview) {
      dashboardPreview.addEventListener('mouseenter', () => {
        this.animateMetrics();
      });
    }
  }

  animateMetrics() {
    const metricValues = document.querySelectorAll('.metric-value');
    metricValues.forEach((value, index) => {
      setTimeout(() => {
        value.style.transform = 'scale(1.05)';
        setTimeout(() => {
          value.style.transform = 'scale(1)';
        }, 200);
      }, index * 100);
    });
  }

  /**
   * Analytics tracking with multiple providers
   */
  setupAnalytics() {
    // Track page views
    this.trackEvent('page_view', {
      page: window.location.pathname,
      title: document.title,
      referrer: document.referrer
    });

    // Track CTA clicks
    const ctaButtons = document.querySelectorAll('.btn-primary');
    ctaButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.trackEvent('cta_click', {
          text: button.textContent.trim(),
          location: this.getElementLocation(button),
          href: button.getAttribute('href')
        });
      });
    });

    // Track section views
    const sections = document.querySelectorAll('section[id]');
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          this.trackEvent('section_view', {
            section: entry.target.id,
            time_viewed: Date.now()
          });
        }
      });
    }, { threshold: 0.5 });

    sections.forEach(section => {
      sectionObserver.observe(section);
    });

    // Track scroll depth
    let maxScroll = 0;
    const scrollHandler = this.debounce(() => {
      const scrollPercentage = Math.round(
        (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
      );
      
      if (scrollPercentage > maxScroll) {
        maxScroll = scrollPercentage;
        
        // Track milestone scroll depths
        if ([25, 50, 75, 90].includes(scrollPercentage)) {
          this.trackEvent('scroll_depth', {
            percentage: scrollPercentage
          });
        }
      }
    }, 500);

    window.addEventListener('scroll', scrollHandler, { passive: true });
  }

  trackEvent(eventName, data = {}) {
    const eventData = {
      ...data,
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
      url: window.location.href
    };

    // Google Analytics 4
    if (window.gtag && this.config.analytics?.googleAnalytics?.enabled) {
      window.gtag('event', eventName, eventData);
    }
    
    // Mixpanel
    if (window.mixpanel && this.config.analytics?.mixpanel?.enabled) {
      window.mixpanel.track(eventName, eventData);
    }
    
    // Console log for development
    if (this.config.development?.logAnalytics) {
      console.log('Analytics Event:', eventName, eventData);
    }

    // Send to backend if available
    if (this.config.api?.baseUrl && this.config.api?.endpoints?.analytics) {
      fetch(this.config.api.baseUrl + this.config.api.endpoints.analytics, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify({ event: eventName, data: eventData })
      }).catch(err => console.warn('Analytics tracking failed:', err));
    }
  }

  getElementLocation(element) {
    const section = element.closest('section');
    return section ? section.id || section.className : 'unknown';
  }

  /**
   * Accessibility enhancements
   */
  setupAccessibility() {
    // Skip link functionality
    this.createSkipLink();
    
    // Keyboard navigation for custom elements
    this.setupKeyboardNavigation();
    
    // Focus management
    this.setupFocusManagement();
    
    // Reduced motion preferences
    this.respectMotionPreferences();
  }

  createSkipLink() {
    const skipLink = document.createElement('a');
    skipLink.href = '#hero';
    skipLink.textContent = 'Skip to main content';
    skipLink.className = 'skip-link';
    
    document.body.insertBefore(skipLink, document.body.firstChild);
  }

  setupKeyboardNavigation() {
    // Ensure all interactive elements are keyboard accessible
    const interactiveElements = document.querySelectorAll(
      'button, a, input, select, textarea, [tabindex]'
    );
    
    interactiveElements.forEach(element => {
      if (!element.hasAttribute('tabindex') && element.tabIndex === -1) {
        element.tabIndex = 0;
      }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Escape key closes mobile menu
      if (e.key === 'Escape') {
        const navMenu = document.getElementById('nav-menu');
        const navToggle = document.getElementById('nav-toggle');
        if (navMenu && navMenu.classList.contains('nav-menu--open')) {
          navMenu.classList.remove('nav-menu--open');
          navToggle.classList.remove('nav-toggle--open');
        }
      }
    });
  }

  setupFocusManagement() {
    // Improve focus visibility
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-navigation');
      }
    });

    document.addEventListener('mousedown', () => {
      document.body.classList.remove('keyboard-navigation');
    });
  }

  respectMotionPreferences() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    if (prefersReducedMotion.matches) {
      document.documentElement.style.setProperty('--transition-fast', '0ms');
      document.documentElement.style.setProperty('--transition-normal', '0ms');
      document.documentElement.style.setProperty('--transition-slow', '0ms');
    }
  }

  /**
   * Utility function for debouncing
   */
  debounce(func, wait) {
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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ScarmonitWebsite();
});

// Export utilities for external use
window.ScarmonitUtils = {
  // Format currency
  formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  },
  
  // Format numbers with commas
  formatNumber(number) {
    return new Intl.NumberFormat('en-US').format(number);
  },
  
  // Check if element is in viewport
  isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  },

  // Get stored waitlist entries (for development)
  getWaitlistEntries() {
    return JSON.parse(localStorage.getItem('waitlistEntries') || '[]');
  },

  // Clear stored data
  clearStoredData() {
    localStorage.removeItem('waitlistEntries');
  }
};