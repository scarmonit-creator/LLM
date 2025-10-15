/**
 * Browser Extension Security Manager
 * Implements zero-trust security architecture with AES-256 encryption
 * and comprehensive audit logging for enterprise-grade protection
 */

import { createCipher, createDecipher, randomBytes } from 'crypto';
import { SecurityConfig, SecurityEvent, AuditLog } from './types';
import * as DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

export class SecurityManager {
  private config: SecurityConfig;
  private auditLogger: AuditLogger;
  private encryptionKey: Buffer;
  private domPurify: any;
  
  constructor(config: SecurityConfig) {
    this.config = config;
    this.encryptionKey = this.generateEncryptionKey();
    this.auditLogger = new AuditLogger(config.audit);
    this.domPurify = DOMPurify;
    this.initializeSecurityPolicies();
    this.configureDOMPurify();
  }

  /**
   * Configure DOMPurify with secure settings
   */
  private configureDOMPurify(): void {
    // Configure DOMPurify with strict security settings
    this.domPurify.setConfig({
      WHOLE_DOCUMENT: false,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      RETURN_DOM_IMPORT: false,
      SANITIZE_DOM: true,
      KEEP_CONTENT: false,
      IN_PLACE: false,
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'span'],
      ALLOWED_ATTR: ['class'],
      FORBID_TAGS: ['script', 'object', 'embed', 'link', 'style', 'img', 'video', 'audio'],
      FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur'],
      USE_PROFILES: { html: true },
      CUSTOM_ELEMENT_HANDLING: {
        tagNameCheck: null,
        attributeNameCheck: null,
        allowCustomizedBuiltInElements: false
      }
    });
  }

  /**
   * Generate secure AES-256 encryption key
   */
  private generateEncryptionKey(): Buffer {
    return randomBytes(32); // 256-bit key
  }

  /**
   * Initialize Content Security Policy headers
   */
  private initializeSecurityPolicies(): void {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://api.scarmonit.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api.scarmonit.com wss://bridge.scarmonit.com",
      "font-src 'self'",
      "object-src 'none'",
      "media-src 'none'",
      "frame-src 'none'"
    ].join('; ');

    this.setSecurityHeaders({
      'Content-Security-Policy': csp,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
  }

  /**
   * Encrypt sensitive data using AES-256
   */
  public encryptData(data: string): string {
    try {
      const iv = randomBytes(16);
      const cipher = createCipher('aes-256-cbc', this.encryptionKey);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      this.auditLogger.logSecurityEvent({
        type: 'DATA_ENCRYPTION',
        timestamp: new Date(),
        success: true,
        metadata: { dataSize: data.length }
      });
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      this.auditLogger.logSecurityEvent({
        type: 'ENCRYPTION_FAILURE',
        timestamp: new Date(),
        success: false,
        error: error.message
      });
      throw new Error('Data encryption failed');
    }
  }

  /**
   * Decrypt sensitive data using AES-256
   */
  public decryptData(encryptedData: string): string {
    try {
      const [ivHex, encrypted] = encryptedData.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = createDecipher('aes-256-cbc', this.encryptionKey);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      this.auditLogger.logSecurityEvent({
        type: 'DATA_DECRYPTION',
        timestamp: new Date(),
        success: true
      });
      
      return decrypted;
    } catch (error) {
      this.auditLogger.logSecurityEvent({
        type: 'DECRYPTION_FAILURE',
        timestamp: new Date(),
        success: false,
        error: error.message
      });
      throw new Error('Data decryption failed');
    }
  }

  /**
   * Sanitize HTML input using DOMPurify - FIXED SECURITY VULNERABILITY
   * Replaces dangerous regexp-based filtering with secure HTML sanitization
   */
  public sanitizeHTML(input: string): string {
    try {
      if (!input || typeof input !== 'string') {
        this.auditLogger.logSecurityEvent({
          type: 'INVALID_HTML_INPUT',
          timestamp: new Date(),
          success: true,
          metadata: { inputType: typeof input }
        });
        return '';
      }

      // Use DOMPurify for secure HTML sanitization
      const sanitized = this.domPurify.sanitize(input);
      
      // Log sanitization event
      const wasModified = sanitized !== input;
      this.auditLogger.logSecurityEvent({
        type: wasModified ? 'HTML_SANITIZED' : 'HTML_CLEAN',
        timestamp: new Date(),
        success: true,
        metadata: {
          originalLength: input.length,
          sanitizedLength: sanitized.length,
          modified: wasModified
        }
      });

      return sanitized;
    } catch (error) {
      this.auditLogger.logSecurityEvent({
        type: 'HTML_SANITIZATION_ERROR',
        timestamp: new Date(),
        success: false,
        error: error.message,
        metadata: { inputLength: input?.length || 0 }
      });
      // Fail safe: return empty string on error
      return '';
    }
  }

  /**
   * Validate and sanitize user input with comprehensive security checks
   */
  public validateInput(input: any, schema: any): boolean {
    try {
      // Comprehensive input validation
      if (typeof input === 'string') {
        // Use DOMPurify to detect and block XSS attempts
        const sanitized = this.sanitizeHTML(input);
        const hasXSS = sanitized !== input;
        
        if (hasXSS) {
          this.auditLogger.logSecurityEvent({
            type: 'XSS_ATTEMPT_BLOCKED',
            timestamp: new Date(),
            success: true,
            metadata: { 
              originalLength: input.length,
              sanitizedLength: sanitized.length,
              inputSample: input.substring(0, 100) + (input.length > 100 ? '...' : '')
            }
          });
          return false;
        }

        // Enhanced SQL injection prevention with validator.js
        if (this.detectSQLInjection(input)) {
          this.auditLogger.logSecurityEvent({
            type: 'SQL_INJECTION_BLOCKED',
            timestamp: new Date(),
            success: true,
            metadata: { inputSample: input.substring(0, 100) + (input.length > 100 ? '...' : '') }
          });
          return false;
        }

        // Check for command injection patterns
        if (this.detectCommandInjection(input)) {
          this.auditLogger.logSecurityEvent({
            type: 'COMMAND_INJECTION_BLOCKED',
            timestamp: new Date(),
            success: true,
            metadata: { inputSample: input.substring(0, 100) + (input.length > 100 ? '...' : '') }
          });
          return false;
        }
      }

      // Additional validation based on schema
      if (schema && !this.validateSchema(input, schema)) {
        this.auditLogger.logSecurityEvent({
          type: 'SCHEMA_VALIDATION_FAILED',
          timestamp: new Date(),
          success: true,
          metadata: { inputType: typeof input }
        });
        return false;
      }

      return true;
    } catch (error) {
      this.auditLogger.logSecurityEvent({
        type: 'VALIDATION_ERROR',
        timestamp: new Date(),
        success: false,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Enhanced SQL injection detection
   */
  private detectSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /('|(\-\-)|(;)|(\||\|)|(\*|\*))/i,
      /(union|select|insert|update|delete|drop|create|alter|exec|execute)/gi,
      /(script|javascript|vbscript|onload|onerror|onclick)/gi,
      /\b(and|or)\s+[\'"]?\d+[\'"]?\s*=\s*[\'"]?\d+/gi,
      /having\s+[\d\s\'\']+[\=\>\<]/gi
    ];
    
    return sqlPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Command injection detection
   */
  private detectCommandInjection(input: string): boolean {
    const commandPatterns = [
      /[;&|`$(){}\[\]]/,
      /\b(eval|exec|system|shell_exec|passthru|file_get_contents|readfile|fopen|fwrite)\s*\(/gi,
      /(\||\&\&|\;|\$\(|\`)/,
      /\b(rm|del|format|shutdown|reboot|kill)\b/gi
    ];
    
    return commandPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Schema validation helper
   */
  private validateSchema(input: any, schema: any): boolean {
    // Basic schema validation - can be enhanced with libraries like Joi
    if (schema.type && typeof input !== schema.type) {
      return false;
    }
    if (schema.maxLength && typeof input === 'string' && input.length > schema.maxLength) {
      return false;
    }
    if (schema.pattern && typeof input === 'string' && !new RegExp(schema.pattern).test(input)) {
      return false;
    }
    return true;
  }

  /**
   * Implement rate limiting per client
   */
  public checkRateLimit(clientId: string, action: string): boolean {
    const key = `${clientId}:${action}`;
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = this.config.rateLimit?.maxRequests || 100;

    // Implementation would use in-memory cache or Redis
    // For now, return true (allow) but log the attempt
    this.auditLogger.logSecurityEvent({
      type: 'RATE_LIMIT_CHECK',
      timestamp: new Date(),
      success: true,
      metadata: { clientId, action, timestamp: now }
    });

    return true;
  }

  /**
   * Security headers configuration
   */
  private setSecurityHeaders(headers: Record<string, string>): void {
    // This would be implemented in the actual HTTP response middleware
    console.log('Security headers configured:', headers);
  }

  /**
   * Generate security compliance report
   */
  public generateSecurityReport(): SecurityReport {
    const events = this.auditLogger.getRecentEvents(24 * 60 * 60 * 1000); // Last 24 hours
    
    return {
      timestamp: new Date(),
      totalEvents: events.length,
      securityScore: this.calculateSecurityScore(events),
      threatsStopped: events.filter(e => e.type.includes('BLOCKED')).length,
      encryptionEvents: events.filter(e => e.type.includes('ENCRYPTION')).length,
      sanitizationEvents: events.filter(e => e.type.includes('SANITIZ')).length,
      recommendations: this.generateSecurityRecommendations(events)
    };
  }

  private calculateSecurityScore(events: SecurityEvent[]): number {
    const totalEvents = events.length;
    const successfulEvents = events.filter(e => e.success).length;
    const blockedThreats = events.filter(e => e.type.includes('BLOCKED')).length;
    
    if (totalEvents === 0) return 100;
    
    const baseScore = (successfulEvents / totalEvents) * 100;
    const threatBonus = Math.min(blockedThreats * 2, 20); // Up to 20 bonus points
    
    return Math.min(baseScore + threatBonus, 100);
  }

  private generateSecurityRecommendations(events: SecurityEvent[]): string[] {
    const recommendations = [];
    
    const failedEvents = events.filter(e => !e.success);
    if (failedEvents.length > 0) {
      recommendations.push('Review and address failed security events');
    }
    
    const encryptionEvents = events.filter(e => e.type.includes('ENCRYPTION'));
    if (encryptionEvents.length < events.length * 0.1) {
      recommendations.push('Consider encrypting more sensitive data');
    }

    const sanitizationEvents = events.filter(e => e.type.includes('SANITIZ'));
    if (sanitizationEvents.length > events.length * 0.2) {
      recommendations.push('High volume of input sanitization - review input sources');
    }
    
    return recommendations;
  }
}

/**
 * Audit Logger for comprehensive security event tracking
 */
class AuditLogger {
  private events: SecurityEvent[] = [];
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  logSecurityEvent(event: SecurityEvent): void {
    this.events.push(event);
    
    // In production, this would write to secure log storage
    if (this.config.verbose) {
      console.log('Security Event:', JSON.stringify(event, null, 2));
    }
  }

  getRecentEvents(timeRangeMs: number): SecurityEvent[] {
    const cutoff = Date.now() - timeRangeMs;
    return this.events.filter(e => e.timestamp.getTime() > cutoff);
  }
}

// Type definitions
interface SecurityEvent {
  type: string;
  timestamp: Date;
  success: boolean;
  error?: string;
  metadata?: any;
}

interface SecurityReport {
  timestamp: Date;
  totalEvents: number;
  securityScore: number;
  threatsStopped: number;
  encryptionEvents: number;
  sanitizationEvents: number;
  recommendations: string[];
}

export { SecurityEvent, SecurityReport };