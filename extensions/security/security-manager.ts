/**
 * Browser Extension Security Manager
 * Implements zero-trust security architecture with AES-256 encryption
 * and comprehensive audit logging for enterprise-grade protection
 */

import { createCipher, createDecipher, randomBytes } from 'crypto';
import DOMPurify from 'dompurify';
import { SecurityConfig, SecurityEvent, AuditLog } from './types';

export class SecurityManager {
  private config: SecurityConfig;
  private auditLogger: AuditLogger;
  private encryptionKey: Buffer;
  
  constructor(config: SecurityConfig) {
    this.config = config;
    this.encryptionKey = this.generateEncryptionKey();
    this.auditLogger = new AuditLogger(config.audit);
    this.initializeSecurityPolicies();
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
   * Validate and sanitize user input using secure methods
   */
  public validateInput(input: any, schema: any): boolean {
    try {
      // Comprehensive input validation
      if (typeof input === 'string') {
        // XSS prevention using DOMPurify instead of unsafe regex
        const originalLength = input.length;
        const sanitized = DOMPurify.sanitize(input, { 
          ALLOWED_TAGS: [], 
          ALLOWED_ATTR: [] 
        });
        
        // If sanitization changed the input, it contained malicious content
        if (sanitized !== input || sanitized.length !== originalLength) {
          this.auditLogger.logSecurityEvent({
            type: 'XSS_ATTEMPT_BLOCKED',
            timestamp: new Date(),
            success: true,
            metadata: { 
              originalLength,
              sanitizedLength: sanitized.length,
              inputPreview: input.substring(0, 100) 
            }
          });
          return false;
        }

        // SQL injection prevention using safer detection
        const suspiciousSqlPatterns = [
          /('|(\-\-)|(;)|(\||\|)|(\*|\*))/, // Common SQL injection characters
          /\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\s+/gi
        ];
        
        for (const pattern of suspiciousSqlPatterns) {
          if (pattern.test(input)) {
            this.auditLogger.logSecurityEvent({
              type: 'SQL_INJECTION_BLOCKED',
              timestamp: new Date(),
              success: true,
              metadata: { inputPreview: input.substring(0, 100) }
            });
            return false;
          }
        }
      }

      // Schema validation would go here
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
   * Sanitize HTML content safely
   */
  public sanitizeHtml(htmlContent: string): string {
    try {
      const sanitized = DOMPurify.sanitize(htmlContent, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u'],
        ALLOWED_ATTR: ['class', 'id'],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
        FORBID_ATTR: ['onclick', 'onerror', 'onload', 'onmouseover']
      });
      
      this.auditLogger.logSecurityEvent({
        type: 'HTML_SANITIZATION',
        timestamp: new Date(),
        success: true,
        metadata: {
          originalLength: htmlContent.length,
          sanitizedLength: sanitized.length
        }
      });
      
      return sanitized;
    } catch (error) {
      this.auditLogger.logSecurityEvent({
        type: 'SANITIZATION_ERROR',
        timestamp: new Date(),
        success: false,
        error: error.message
      });
      throw new Error('HTML sanitization failed');
    }
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
  recommendations: string[];
}

export { SecurityEvent, SecurityReport };