/**
 * Security Middleware for MCP Server
 * Implements comprehensive security measures including CSP, input validation, and XSS prevention
 */

import crypto from 'crypto';
import { z } from 'zod';

export class SecurityMiddleware {
  constructor(options = {}) {
    this.enableCSP = options.enableCSP !== false;
    this.enableXSSProtection = options.enableXSSProtection !== false;
    this.enableInputSanitization = options.enableInputSanitization !== false;
    this.maxInputSize = options.maxInputSize || 10485760; // 10MB
    this.allowedOrigins = options.allowedOrigins || ['localhost', '127.0.0.1'];
    
    // Security event tracking
    this.securityEvents = {
      blockedRequests: 0,
      sanitizedInputs: 0,
      xssAttempts: 0,
      injectionAttempts: 0,
      rateLimitViolations: 0,
      suspiciousPatterns: 0
    };
    
    // Known malicious patterns
    this.maliciousPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /eval\s*\(/gi,
      /Function\s*\(/gi,
      /setTimeout\s*\(/gi,
      /setInterval\s*\(/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi,
      /data:text\/html/gi,
      /vbscript:/gi,
    ];
    
    // SQL injection patterns
    this.sqlInjectionPatterns = [
      /('|(\-\-)|(;)|(\||\|)|(\*|\*))/gi,
      /(union|select|insert|delete|update|drop|create|alter|exec|execute)/gi,
      /script|javascript|vbscript|onload|onerror|onclick/gi,
    ];
    
    console.log('🛡️ Security Middleware initialized with comprehensive protection');
  }

  /**
   * Apply Content Security Policy headers
   */
  applyCSPHeaders(req, res, next) {
    if (!this.enableCSP) {
      return next();
    }

    // Strict CSP policy
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests"
    ];

    res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    next();
  }

  /**
   * Validate and sanitize input data
   */
  async sanitizeInput(input) {
    if (!this.enableInputSanitization) {
      return input;
    }

    try {
      // Check input size
      const inputSize = JSON.stringify(input).length;
      if (inputSize > this.maxInputSize) {
        throw new Error(`Input size ${inputSize} exceeds maximum ${this.maxInputSize}`);
      }

      // Deep sanitize object
      const sanitized = await this.deepSanitize(input);
      
      if (JSON.stringify(sanitized) !== JSON.stringify(input)) {
        this.securityEvents.sanitizedInputs++;
        console.log('🧹 Input sanitized for security');
      }
      
      return sanitized;
    } catch (error) {
      this.securityEvents.blockedRequests++;
      throw new Error(`Security validation failed: ${error.message}`);
    }
  }

  /**
   * Deep sanitize object recursively
   */
  async deepSanitize(obj) {
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }
    
    if (Array.isArray(obj)) {
      return Promise.all(obj.map(item => this.deepSanitize(item)));
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        const cleanKey = this.sanitizeString(key);
        const cleanValue = await this.deepSanitize(value);
        sanitized[cleanKey] = cleanValue;
      }
      return sanitized;
    }
    
    return obj;
  }

  /**
   * Sanitize string input
   */
  sanitizeString(str) {
    if (typeof str !== 'string') {
      return str;
    }

    let sanitized = str;
    let foundIssue = false;

    // Check for XSS patterns
    for (const pattern of this.maliciousPatterns) {
      if (pattern.test(sanitized)) {
        this.securityEvents.xssAttempts++;
        foundIssue = true;
        console.warn(`🚨 Detected XSS attempt: ${pattern}`);
      }
      sanitized = sanitized.replace(pattern, '[BLOCKED_XSS]');
    }

    // Check for SQL injection patterns
    for (const pattern of this.sqlInjectionPatterns) {
      if (pattern.test(sanitized)) {
        this.securityEvents.injectionAttempts++;
        foundIssue = true;
        console.warn(`🚨 Detected SQL injection attempt: ${pattern}`);
      }
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\b(password|token|secret|key|auth)\b/gi,
      /\b(admin|root|sudo)\b/gi,
      /\b(rm\s+-rf|format|delete|destroy)\b/gi,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(sanitized)) {
        this.securityEvents.suspiciousPatterns++;
        console.warn(`⚠️ Suspicious pattern detected: ${pattern}`);
      }
    }

    // Basic HTML entity encoding for XSS prevention
    if (this.enableXSSProtection) {
      sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }

    return sanitized;
  }

  /**
   * Validate origin for CORS protection
   */
  validateOrigin(origin) {
    if (!origin) {
      return false;
    }

    const url = new URL(origin);
    return this.allowedOrigins.some(allowed => 
      url.hostname === allowed || url.hostname.endsWith(`.${allowed}`)
    );
  }

  /**
   * Generate secure session token
   */
  generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate API key format and strength
   */
  validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Check key format (at least 32 characters, contains numbers and letters)
    const keyRegex = /^[a-zA-Z0-9]{32,}$/;
    if (!keyRegex.test(apiKey)) {
      return false;
    }

    // Check for common weak patterns
    const weakPatterns = [
      /^(test|demo|sample|example)/i,
      /^(123|abc|password)/i,
      /(.)\1{5,}/g, // Repeated characters
    ];

    for (const pattern of weakPatterns) {
      if (pattern.test(apiKey)) {
        console.warn('⚠️ Weak API key pattern detected');
        return false;
      }
    }

    return true;
  }

  /**
   * Encrypt sensitive data for storage
   */
  async encryptSensitiveData(data, key) {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm,
    };
  }

  /**
   * Decrypt sensitive data from storage
   */
  async decryptSensitiveData(encryptedData, key) {
    const { encrypted, iv, authTag, algorithm } = encryptedData;
    
    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  /**
   * Create security audit log entry
   */
  createAuditLogEntry(event, clientId, details = {}) {
    return {
      timestamp: new Date().toISOString(),
      event,
      clientId,
      details,
      severity: this.getEventSeverity(event),
      id: crypto.randomUUID(),
    };
  }

  /**
   * Get event severity level
   */
  getEventSeverity(event) {
    const severityMap = {
      xss_attempt: 'high',
      sql_injection: 'high',
      rate_limit_exceeded: 'medium',
      invalid_auth: 'medium',
      suspicious_pattern: 'low',
      input_sanitized: 'low',
    };
    
    return severityMap[event] || 'medium';
  }

  /**
   * Check for prompt injection attempts
   */
  detectPromptInjection(input) {
    const promptInjectionPatterns = [
      /ignore\s+(previous|above|all)\s+instructions/gi,
      /system\s*:\s*you\s+are\s+now/gi,
      /forget\s+(everything|all|previous)/gi,
      /new\s+instructions?\s*:/gi,
      /override\s+system\s+prompt/gi,
      /act\s+as\s+if\s+you\s+are/gi,
      /pretend\s+to\s+be/gi,
      /roleplay\s+as/gi,
    ];

    for (const pattern of promptInjectionPatterns) {
      if (pattern.test(input)) {
        this.securityEvents.injectionAttempts++;
        console.warn(`🚨 Potential prompt injection detected: ${pattern}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Validate file upload security
   */
  validateFileUpload(file) {
    if (!file) {
      return { valid: false, reason: 'No file provided' };
    }

    // Check file size
    if (file.size > this.maxInputSize) {
      return { valid: false, reason: 'File too large' };
    }

    // Check file type
    const allowedTypes = [
      'text/plain',
      'application/json',
      'text/csv',
      'text/markdown',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return { valid: false, reason: 'File type not allowed' };
    }

    // Check file extension
    const allowedExtensions = ['.txt', '.json', '.csv', '.md'];
    const extension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(extension)) {
      return { valid: false, reason: 'File extension not allowed' };
    }

    return { valid: true };
  }

  /**
   * Generate Content Security Policy nonce
   */
  generateCSPNonce() {
    return crypto.randomBytes(16).toString('base64');
  }

  /**
   * Hash sensitive data for logging
   */
  hashSensitiveData(data) {
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Validate request headers for security
   */
  validateHeaders(headers) {
    const issues = [];

    // Check for suspicious user agents
    const userAgent = headers['user-agent'];
    if (userAgent) {
      const suspiciousUA = [
        /bot/i,
        /crawler/i,
        /spider/i,
        /scraper/i,
        /curl/i,
        /wget/i,
      ];

      for (const pattern of suspiciousUA) {
        if (pattern.test(userAgent)) {
          issues.push(`Suspicious user agent: ${pattern}`);
        }
      }
    }

    // Check for suspicious headers
    const suspiciousHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'x-cluster-client-ip',
    ];

    for (const header of suspiciousHeaders) {
      if (headers[header]) {
        issues.push(`Proxy header detected: ${header}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Create security report
   */
  createSecurityReport() {
    const total = Object.values(this.securityEvents).reduce((sum, count) => sum + count, 0);
    
    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalSecurityEvents: total,
        severityDistribution: {
          high: this.securityEvents.xssAttempts + this.securityEvents.injectionAttempts,
          medium: this.securityEvents.blockedRequests + this.securityEvents.rateLimitViolations,
          low: this.securityEvents.sanitizedInputs + this.securityEvents.suspiciousPatterns,
        },
      },
      events: this.securityEvents,
      configuration: {
        cspEnabled: this.enableCSP,
        xssProtectionEnabled: this.enableXSSProtection,
        inputSanitizationEnabled: this.enableInputSanitization,
        maxInputSize: `${(this.maxInputSize / 1024 / 1024).toFixed(2)}MB`,
        allowedOrigins: this.allowedOrigins,
      },
      recommendations: this.getSecurityRecommendations(),
    };
  }

  /**
   * Get security recommendations based on events
   */
  getSecurityRecommendations() {
    const recommendations = [];

    if (this.securityEvents.xssAttempts > 10) {
      recommendations.push('Consider implementing stricter XSS protection');
    }

    if (this.securityEvents.injectionAttempts > 5) {
      recommendations.push('Review input validation rules for injection protection');
    }

    if (this.securityEvents.rateLimitViolations > 50) {
      recommendations.push('Consider lowering rate limits or implementing CAPTCHA');
    }

    if (this.securityEvents.suspiciousPatterns > 20) {
      recommendations.push('Review suspicious pattern detection rules');
    }

    if (recommendations.length === 0) {
      recommendations.push('Security posture is good - continue monitoring');
    }

    return recommendations;
  }

  /**
   * Express middleware wrapper
   */
  middleware() {
    return async (req, res, next) => {
      try {
        // Apply CSP headers
        this.applyCSPHeaders(req, res, () => {});

        // Validate headers
        const headerValidation = this.validateHeaders(req.headers);
        if (!headerValidation.valid) {
          this.securityEvents.suspiciousPatterns++;
          console.warn('⚠️ Suspicious headers detected:', headerValidation.issues);
        }

        // Validate origin for CORS
        const origin = req.headers.origin;
        if (origin && !this.validateOrigin(origin)) {
          this.securityEvents.blockedRequests++;
          return res.status(403).json({
            error: 'Origin not allowed',
            security: true,
          });
        }

        // Sanitize request body if present
        if (req.body) {
          req.body = await this.sanitizeInput(req.body);
        }

        // Sanitize query parameters
        if (req.query) {
          req.query = await this.sanitizeInput(req.query);
        }

        next();
      } catch (error) {
        this.securityEvents.blockedRequests++;
        console.error('🚨 Security middleware error:', error.message);
        
        res.status(400).json({
          error: 'Security validation failed',
          message: error.message,
          security: true,
        });
      }
    };
  }

  /**
   * Get security statistics
   */
  getStats() {
    const total = Object.values(this.securityEvents).reduce((sum, count) => sum + count, 0);
    
    return {
      totalEvents: total,
      events: this.securityEvents,
      configuration: {
        cspEnabled: this.enableCSP,
        xssProtectionEnabled: this.enableXSSProtection,
        inputSanitizationEnabled: this.enableInputSanitization,
        maxInputSize: this.maxInputSize,
      },
      health: {
        status: total > 1000 ? 'high_activity' : 'normal',
        riskLevel: this.calculateRiskLevel(),
      },
    };
  }

  /**
   * Calculate current risk level
   */
  calculateRiskLevel() {
    const { xssAttempts, injectionAttempts, blockedRequests } = this.securityEvents;
    const highRiskEvents = xssAttempts + injectionAttempts + blockedRequests;
    
    if (highRiskEvents > 50) {
      return 'high';
    } else if (highRiskEvents > 10) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Reset security event counters
   */
  resetSecurityEvents() {
    Object.keys(this.securityEvents).forEach(key => {
      this.securityEvents[key] = 0;
    });
    
    console.log('🔄 Security event counters reset');
  }

  /**
   * Destroy security middleware
   */
  destroy() {
    this.resetSecurityEvents();
    console.log('🗑️ Security Middleware destroyed');
  }
}

export default SecurityMiddleware;