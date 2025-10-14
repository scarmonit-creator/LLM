// Content script for advanced browser automation
// This enables full browser control capabilities

class BrowserController {
  constructor() {
    this.isActive = false;
    this.currentTask = null;
    this.errorCount = 0;
    this.maxRetries = 3;
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'startAutonomousExecution':
          this.startAutonomousMode(request.task);
          sendResponse({ success: true });
          break;
        case 'stopAutonomousExecution':
          this.stopAutonomousMode();
          sendResponse({ success: true });
          break;
        case 'executeAction':
          this.executeAction(request.actionData)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true; // Keep message channel open
        case 'analyzePageIssues':
          this.analyzePageIssues()
            .then(issues => sendResponse({ success: true, issues }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true;
        case 'getPageData':
          sendResponse({ 
            success: true, 
            data: this.extractPageData() 
          });
          break;
      }
    });
  }

  async startAutonomousMode(task) {
    this.isActive = true;
    this.currentTask = task;
    this.errorCount = 0;
    
    console.log('🤖 Starting autonomous execution mode:', task);
    
    try {
      // Analyze current page for issues
      const issues = await this.analyzePageIssues();
      
      if (issues.length > 0) {
        console.log('📋 Found issues to resolve:', issues);
        
        // Execute fixes for each issue
        for (const issue of issues) {
          if (!this.isActive) break;
          
          await this.resolveIssue(issue);
        }
      }
      
      // Execute the main task
      await this.executeTask(task);
      
    } catch (error) {
      console.error('❌ Autonomous execution failed:', error);
      this.handleError(error);
    }
  }

  stopAutonomousMode() {
    this.isActive = false;
    this.currentTask = null;
    console.log('🛑 Autonomous execution stopped');
  }

  async analyzePageIssues() {
    const issues = [];
    
    // Check for common page issues
    // Form validation errors
    const formErrors = document.querySelectorAll('.error, .invalid, [aria-invalid="true"]');
    if (formErrors.length > 0) {
      issues.push({
        type: 'form_errors',
        elements: Array.from(formErrors),
        description: 'Form validation errors detected'
      });
    }
    
    // Missing required fields
    const requiredFields = document.querySelectorAll('input[required]:invalid, select[required]:invalid, textarea[required]:invalid');
    if (requiredFields.length > 0) {
      issues.push({
        type: 'required_fields',
        elements: Array.from(requiredFields),
        description: 'Required fields need to be filled'
      });
    }
    
    // Broken images
    const brokenImages = Array.from(document.querySelectorAll('img')).filter(img => 
      !img.complete || img.naturalHeight === 0
    );
    if (brokenImages.length > 0) {
      issues.push({
        type: 'broken_images',
        elements: brokenImages,
        description: 'Broken or missing images detected'
      });
    }
    
    // Loading states that are stuck
    const loadingElements = document.querySelectorAll('.loading, .spinner, [aria-busy="true"]');
    if (loadingElements.length > 0) {
      issues.push({
        type: 'stuck_loading',
        elements: Array.from(loadingElements),
        description: 'Elements appear to be stuck in loading state'
      });
    }
    
    return issues;
  }

  async resolveIssue(issue) {
    console.log(`🔧 Resolving issue: ${issue.type}`);
    
    try {
      switch (issue.type) {
        case 'form_errors':
          await this.fixFormErrors(issue.elements);
          break;
        case 'required_fields':
          await this.fillRequiredFields(issue.elements);
          break;
        case 'broken_images':
          await this.fixBrokenImages(issue.elements);
          break;
        case 'stuck_loading':
          await this.handleStuckLoading(issue.elements);
          break;
      }
      
      console.log(`✅ Successfully resolved: ${issue.type}`);
    } catch (error) {
      console.error(`❌ Failed to resolve ${issue.type}:`, error);
    }
  }

  async fixFormErrors(errorElements) {
    for (const element of errorElements) {
      // Try to find associated input field
      const associatedInput = this.findAssociatedInput(element);
      if (associatedInput) {
        // Clear the field and try common valid values
        await this.fillFieldIntelligently(associatedInput);
      }
    }
  }

  async fillRequiredFields(requiredFields) {
    for (const field of requiredFields) {
      if (field.value.trim() === '') {
        await this.fillFieldIntelligently(field);
      }
    }
  }

  async fillFieldIntelligently(field) {
    const fieldType = field.type || 'text';
    const fieldName = (field.name || field.id || '').toLowerCase();
    
    // Generate appropriate test data based on field characteristics
    let value = '';
    
    if (fieldType === 'email' || fieldName.includes('email')) {
      value = 'test@example.com';
    } else if (fieldType === 'password' || fieldName.includes('password')) {
      value = 'TestPassword123!';
    } else if (fieldType === 'tel' || fieldName.includes('phone')) {
      value = '555-123-4567';
    } else if (fieldName.includes('name')) {
      value = 'Test User';
    } else if (fieldType === 'number') {
      value = '1';
    } else if (fieldType === 'date') {
      value = new Date().toISOString().split('T')[0];
    } else if (field.tagName.toLowerCase() === 'select') {
      // Select the first valid option
      const options = field.querySelectorAll('option');
      if (options.length > 1) {
        field.selectedIndex = 1; // Skip the first option (usually placeholder)
      }
      return;
    } else {
      value = 'Test Value';
    }
    
    // Simulate human-like typing
    field.focus();
    field.value = '';
    
    for (let i = 0; i < value.length; i++) {
      field.value += value[i];
      field.dispatchEvent(new Event('input', { bubbles: true }));
      await this.wait(50); // Small delay between keystrokes
    }
    
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.blur();
  }

  async fixBrokenImages(brokenImages) {
    for (const img of brokenImages) {
      // Hide broken images to improve page appearance
      img.style.display = 'none';
      
      // Or replace with placeholder
      const placeholder = document.createElement('div');
      placeholder.style.cssText = `
        width: ${img.width || 100}px;
        height: ${img.height || 100}px;
        background-color: #f0f0f0;
        border: 1px solid #ccc;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: #666;
      `;
      placeholder.textContent = 'Image unavailable';
      
      img.parentNode?.replaceChild(placeholder, img);
    }
  }

  async handleStuckLoading(loadingElements) {
    for (const element of loadingElements) {
      // Try to trigger completion of loading state
      element.setAttribute('aria-busy', 'false');
      element.classList.remove('loading', 'spinner');
      
      // Try to find and click retry buttons
      const retryButton = element.querySelector('.retry, .reload, button');
      if (retryButton) {
        retryButton.click();
        await this.wait(1000);
      }
    }
  }

  findAssociatedInput(errorElement) {
    // Try various methods to find the associated input
    
    // Check for explicit association via 'for' attribute or aria-describedby
    const labelFor = errorElement.getAttribute('for');
    if (labelFor) {
      return document.getElementById(labelFor);
    }
    
    // Check if error is inside a form group with an input
    const formGroup = errorElement.closest('.form-group, .field, .input-group');
    if (formGroup) {
      const input = formGroup.querySelector('input, select, textarea');
      if (input) return input;
    }
    
    // Check siblings
    const siblings = Array.from(errorElement.parentElement?.children || []);
    for (const sibling of siblings) {
      if (sibling.tagName && ['INPUT', 'SELECT', 'TEXTAREA'].includes(sibling.tagName)) {
        return sibling;
      }
    }
    
    return null;
  }

  async executeTask(task) {
    if (!task || !this.isActive) return;
    
    console.log('🎯 Executing main task:', task);
    
    // Implement task-specific logic based on task type
    if (task.type === 'form_submission') {
      await this.handleFormSubmission(task);
    } else if (task.type === 'navigation') {
      await this.handleNavigation(task);
    } else if (task.type === 'data_extraction') {
      await this.handleDataExtraction(task);
    } else if (task.type === 'page_interaction') {
      await this.handlePageInteraction(task);
    }
  }

  async handleFormSubmission(task) {
    const forms = document.querySelectorAll('form');
    
    for (const form of forms) {
      // Validate form before submission
      const isValid = form.checkValidity();
      
      if (isValid) {
        console.log('📤 Submitting form');
        
        // Try to find submit button
        const submitBtn = form.querySelector('input[type="submit"], button[type="submit"], button:not([type])');
        
        if (submitBtn && !submitBtn.disabled) {
          submitBtn.click();
          await this.wait(2000);
          break;
        }
      } else {
        console.log('⚠️ Form validation failed, attempting to fix...');
        const invalidFields = form.querySelectorAll(':invalid');
        
        for (const field of invalidFields) {
          await this.fillFieldIntelligently(field);
        }
        
        // Retry submission
        if (form.checkValidity()) {
          const submitBtn = form.querySelector('input[type="submit"], button[type="submit"], button:not([type])');
          if (submitBtn && !submitBtn.disabled) {
            submitBtn.click();
            await this.wait(2000);
          }
        }
      }
    }
  }

  async handleNavigation(task) {
    if (task.url) {
      window.location.href = task.url;
    } else if (task.action === 'back') {
      window.history.back();
    } else if (task.action === 'forward') {
      window.history.forward();
    } else if (task.action === 'reload') {
      window.location.reload();
    }
  }

  async handleDataExtraction(task) {
    const data = this.extractPageData();
    
    // Send extracted data back to extension
    chrome.runtime.sendMessage({
      action: 'dataExtracted',
      data: data,
      task: task
    });
  }

  async handlePageInteraction(task) {
    if (task.selector && task.action) {
      const elements = document.querySelectorAll(task.selector);
      
      for (const element of elements) {
        switch (task.action) {
          case 'click':
            element.click();
            break;
          case 'focus':
            element.focus();
            break;
          case 'scroll':
            element.scrollIntoView({ behavior: 'smooth' });
            break;
        }
        
        await this.wait(500);
      }
    }
  }

  extractPageData() {
    return {
      title: document.title,
      url: window.location.href,
      text: document.body.innerText,
      links: Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.textContent.trim(),
        href: a.href
      })),
      forms: Array.from(document.querySelectorAll('form')).map(form => ({
        id: form.id,
        action: form.action,
        method: form.method,
        fields: Array.from(form.querySelectorAll('input, select, textarea')).map(field => ({
          name: field.name,
          type: field.type,
          required: field.required,
          value: field.value
        }))
      })),
      errors: Array.from(document.querySelectorAll('.error, .invalid, [aria-invalid="true"]')).map(el => ({
        text: el.textContent.trim(),
        type: el.className
      }))
    };
  }

  async executeAction(actionData) {
    const { type, selector, value, options } = actionData;
    
    const elements = selector ? document.querySelectorAll(selector) : [];
    
    if (elements.length === 0 && selector) {
      throw new Error(`No elements found for selector: ${selector}`);
    }
    
    switch (type) {
      case 'click':
        elements[0]?.click();
        break;
        
      case 'fill':
        if (elements[0] && value) {
          elements[0].value = value;
          elements[0].dispatchEvent(new Event('input', { bubbles: true }));
          elements[0].dispatchEvent(new Event('change', { bubbles: true }));
        }
        break;
        
      case 'select':
        if (elements[0] && value) {
          elements[0].value = value;
          elements[0].dispatchEvent(new Event('change', { bubbles: true }));
        }
        break;
        
      case 'scroll':
        if (selector) {
          elements[0]?.scrollIntoView({ behavior: 'smooth', ...options });
        } else {
          window.scrollTo({ top: value || 0, behavior: 'smooth' });
        }
        break;
        
      case 'wait':
        await this.wait(value || 1000);
        break;
        
      case 'screenshot':
        // This would need to be handled by the background script
        throw new Error('Screenshot action must be handled by background script');
        
      default:
        throw new Error(`Unknown action type: ${type}`);
    }
    
    return { success: true, action: type, selector };
  }

  handleError(error) {
    this.errorCount++;
    console.error(`💥 Error in autonomous execution (${this.errorCount}/${this.maxRetries}):`, error);
    
    if (this.errorCount >= this.maxRetries) {
      console.error('🚨 Max retries reached, stopping autonomous execution');
      this.stopAutonomousMode();
      
      // Report error back to extension
      chrome.runtime.sendMessage({
        action: 'autonomousExecutionFailed',
        error: error.message,
        retryCount: this.errorCount
      });
    } else {
      // Try to recover and continue
      console.log('🔄 Attempting to recover and continue...');
      setTimeout(() => {
        if (this.currentTask) {
          this.executeTask(this.currentTask);
        }
      }, 2000);
    }
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize the browser controller
const browserController = new BrowserController();

// Make it globally accessible for debugging
window.browserController = browserController;

console.log('🚀 Advanced Browser Controller initialized');
