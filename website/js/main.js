/**
 * Main JavaScript for Scarmonit Website
 * Handles navigation, animations, waitlist, and feature interactions
 */
class ScarmonitWebsite {
  constructor() {
    this.init();
  }
  init() {
    // Mobile Navigation
    this.setupMobileNav();
    // Smooth scrolling
    this.setupSmoothScroll();
    // Feature cards interaction
    this.setupFeatureCards();
    // Waitlist form
    this.setupWaitlistForm();
    // Intersection Observer for animations
    this.setupScrollAnimations();
    // Navigation highlighting
    this.setupNavHighlight();
    // Keyboard accessibility
    this.setupAccessibility();
    // Respect motion preferences
    this.respectMotionPreferences();
    // Backend integration (if applicable)
    this.setupBackendIntegration();
  }
  setupMobileNav() {
    const menuBtn = document.querySelector('.mobile-menu-btn');
    const nav = document.querySelector('.nav');
    if (!menuBtn || !nav) return;
    menuBtn.addEventListener('click', () => {
      const isOpen = menuBtn.getAttribute('aria-expanded') === 'true';
      menuBtn.setAttribute('aria-expanded', !isOpen);
      nav.classList.toggle('active');
    });
    // Close menu on navigation
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        menuBtn.setAttribute('aria-expanded', 'false');
        nav.classList.remove('active');
      });
    });
    // Close menu on outside click
    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target) && !menuBtn.contains(e.target)) {
        menuBtn.setAttribute('aria-expanded', 'false');
        nav.classList.remove('active');
      }
    });
  }
  setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          e.preventDefault();
          const navHeight = document.querySelector('.nav').offsetHeight;
          const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - navHeight;
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
      });
    });
  }
  setupFeatureCards() {
    const cards = document.querySelectorAll('.feature-card');
    cards.forEach(card => {
      card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-10px)';
      });
      card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
      });
    });
  }
  setupWaitlistForm() {
    const form = document.getElementById('waitlist-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = form.querySelector('#email');
      const nameInput = form.querySelector('#name');
      const submitBtn = form.querySelector('button[type="submit"]');
      const successMsg = document.querySelector('.success-message');
      const errorMsg = document.querySelector('.error-message');
      if (!emailInput || !nameInput) return;
      const email = emailInput.value.trim();
      const name = nameInput.value.trim();
      // Basic validation
      if (!email || !name) {
        this.showMessage(errorMsg, 'Please fill in all fields.');
        return;
      }
      if (!this.validateEmail(email)) {
        this.showMessage(errorMsg, 'Please enter a valid email address.');
        return;
      }
      // Disable button during submission
      submitBtn.disabled = true;
      submitBtn.textContent = 'Joining...';
      try {
        // Simulate API call (replace with actual API endpoint)
        await this.submitToWaitlist({ email, name });
        // Success
        this.showMessage(successMsg, 'Thank you for joining our waitlist!');
        form.reset();
        // Track in localStorage for demo purposes
        this.trackWaitlistEntry({ email, name });
      } catch (error) {
        // Error
        this.showMessage(errorMsg, 'Something went wrong. Please try again.');
      } finally {
        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.textContent = 'Join Waitlist';
      }
    });
  }
  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }
  showMessage(element, message) {
    if (!element) return;
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => {
      element.style.display = 'none';
    }, 5000);
  }
  async submitToWaitlist(data) {
    // In production, replace this with actual API endpoint
    // Example: return fetch('/api/waitlist', { method: 'POST', body: JSON.stringify(data) });
    return new Promise((resolve) => {
      setTimeout(() => resolve(), 1000);
    });
  }
  trackWaitlistEntry(data) {
    try {
      const entries = JSON.parse(localStorage.getItem('waitlistEntries') || '[]');
      entries.push({
        ...data,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('waitlistEntries', JSON.stringify(entries));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }
  setupScrollAnimations() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);
    // Observe elements with fade-in-on-scroll class
    const elements = document.querySelectorAll('.fade-in-on-scroll');
    elements.forEach(el => observer.observe(el));
  }
  setupNavHighlight() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
    const observerOptions = {
      threshold: 0.3,
      rootMargin: '-20% 0px -70% 0px'
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${id}`) {
              link.classList.add('active');
            }
          });
        }
      });
    }, observerOptions);
    sections.forEach(section => observer.observe(section));
  }
  setupAccessibility() {
    // Track keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-navigation');
      }
    });
    document.addEventListener('mousedown', () => {
      document.body.classList.remove('keyboard-navigation');
    });
  }
  setupBackendIntegration() {
    // Proper URL validation for client-side
    const allowedHosts = ['scarmonit-creator.github.io', 'scarmonit.com'];
    const currentHost = window.location.hostname;
    const isValidHost = allowedHosts.some(host => currentHost === host || currentHost.endsWith('.' + host));
    
    if (isValidHost) {
      // Backend integration for GitHub Pages or production domain
      console.log('Backend integration enabled for:', currentHost);
      // Add backend integration code here
    }
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
