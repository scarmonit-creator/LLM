/**
 * Scarmonit Website - Modern JavaScript Implementation
 * Following proven business design best practices for user experience
 */

class ScarmonitWebsite {
  constructor() {
    this.init();
  }

  init() {
    this.setupNavigation();
    this.setupFormHandling();
    this.setupAnimations();
    this.setupAnalytics();
    this.setupAccessibility();
  }

  /**
   * Navigation functionality
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
    }

    // Smooth scrolling for navigation links
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href.startsWith('#')) {
          e.preventDefault();
          const target = document.querySelector(href);
          if (target) {
            target.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
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
    window.addEventListener('scroll', () => {
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
    });
  }

  /**
   * Form handling with validation and submission
   */
  setupFormHandling() {
    const waitlistForm = document.getElementById('waitlist-form');
    
    if (waitlistForm) {
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
    }
  }

  async handleWaitlistSubmission(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // Validate form
    if (!this.validateForm(form)) {
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    
    // Show loading state
    submitButton.disabled = true;
    submitButton.innerHTML = `
      <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25"></circle>
        <path fill="currentColor" class="opacity-75" d="m15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z"></path>
      </svg>
      <span>Joining...</span>
    `;

    try {
      // Simulate API call (replace with actual endpoint)
      await this.submitToWaitlist(data);
      
      // Success state
      this.showFormSuccess(form);
      this.trackEvent('waitlist_signup', { priority: data.priority });
      
    } catch (error) {
      // Error state
      this.showFormError(form, 'Something went wrong. Please try again.');
      console.error('Waitlist submission error:', error);
      
    } finally {
      // Reset button
      submitButton.disabled = false;
      submitButton.innerHTML = originalText;
    }
  }

  async submitToWaitlist(data) {
    // This would integrate with your backend API
    // For now, simulate a successful submission
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
      }, 2000);
    });
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
    // Name validation (no numbers or special characters)
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
    errorElement.style.cssText = 'color: #ef4444; font-size: 0.875rem; margin-top: 0.25rem; display: block;';
    
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
    formContainer.innerHTML = `
      <div class="success-message text-center">
        <div class="success-icon" style="font-size: 3rem; margin-bottom: 1rem;">✅</div>
        <h3 style="margin-bottom: 1rem; color: var(--color-text);">Welcome to Scarmonit!</h3>
        <p style="color: var(--color-text-light); margin-bottom: 1.5rem;">
          You're on the waitlist! We'll send you exclusive updates and early access when available.
        </p>
        <div style="padding: 1rem; background: rgba(16, 185, 129, 0.1); border-radius: 0.5rem; border: 1px solid rgba(16, 185, 129, 0.2);">
          <p style="color: var(--color-secondary); font-weight: 600; margin: 0;">
            🎉 Position #${Math.floor(Math.random() * 1000) + 2000} in queue
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
      errorElement.style.cssText = 'color: #ef4444; background: rgba(239, 68, 68, 0.1); padding: 1rem; border-radius: 0.5rem; margin-top: 1rem; text-align: center;';
      form.appendChild(errorElement);
    }
    errorElement.textContent = message;
  }

  /**
   * Intersection Observer for animations
   */
  setupAnimations() {
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
      '.feature-card, .metric-card, .section-header, .cta-content'
    );
    
    animatedElements.forEach(el => {
      observer.observe(el);
    });

    // Dashboard preview hover effect
    const dashboardPreview = document.querySelector('.dashboard-preview');
    if (dashboardPreview) {
      let isHovering = false;
      
      dashboardPreview.addEventListener('mouseenter', () => {
        isHovering = true;
        this.animateMetrics();
      });
      
      dashboardPreview.addEventListener('mouseleave', () => {
        isHovering = false;
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
   * Analytics tracking
   */
  setupAnalytics() {
    // Track page views
    this.trackEvent('page_view', {
      page: window.location.pathname,
      title: document.title
    });

    // Track CTA clicks
    const ctaButtons = document.querySelectorAll('.btn-primary');
    ctaButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.trackEvent('cta_click', {
          text: button.textContent.trim(),
          location: this.getElementLocation(button)
        });
      });
    });

    // Track section views
    const sections = document.querySelectorAll('section[id]');
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.trackEvent('section_view', {
            section: entry.target.id
          });
        }
      });
    }, { threshold: 0.5 });

    sections.forEach(section => {
      sectionObserver.observe(section);
    });
  }

  trackEvent(eventName, data = {}) {
    // Integration with analytics services (GA4, Mixpanel, etc.)
    if (window.gtag) {
      window.gtag('event', eventName, data);
    }
    
    if (window.mixpanel) {
      window.mixpanel.track(eventName, data);
    }
    
    // Console log for development
    console.log('Analytics Event:', eventName, data);
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
    skipLink.href = '#main-content';
    skipLink.textContent = 'Skip to main content';
    skipLink.className = 'skip-link sr-only';
    skipLink.style.cssText = `
      position: absolute;
      top: -40px;
      left: 6px;
      background: var(--color-primary);
      color: white;
      padding: 8px;
      border-radius: 4px;
      text-decoration: none;
      font-weight: bold;
      z-index: 1000;
      transition: top 0.3s;
    `;
    
    skipLink.addEventListener('focus', () => {
      skipLink.style.top = '6px';
    });
    
    skipLink.addEventListener('blur', () => {
      skipLink.style.top = '-40px';
    });
    
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
    
    // Custom keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Alt + H for home/hero section
      if (e.altKey && e.key === 'h') {
        e.preventDefault();
        document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' });
      }
      
      // Alt + F for features section
      if (e.altKey && e.key === 'f') {
        e.preventDefault();
        document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  setupFocusManagement() {
    // Trap focus in modal dialogs if any
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const modal = document.querySelector('.modal:not(.hidden)');
        if (modal) {
          this.trapFocus(e, modal);
        }
      }
    });
  }

  trapFocus(e, container) {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    
    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        lastFocusable.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        firstFocusable.focus();
        e.preventDefault();
      }
    }
  }

  respectMotionPreferences() {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    if (prefersReducedMotion.matches) {
      // Disable animations for users who prefer reduced motion
      document.documentElement.style.setProperty('--transition-fast', '0ms');
      document.documentElement.style.setProperty('--transition-normal', '0ms');
      document.documentElement.style.setProperty('--transition-slow', '0ms');
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ScarmonitWebsite();
});

// Additional utility functions
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
  
  // Debounce function for performance
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
  }
};