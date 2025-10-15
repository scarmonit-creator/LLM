import crypto from 'crypto';
import { z } from 'zod';

/**
 * Enterprise-Grade Security Manager
 * Implements comprehensive security hardening for the LLM framework
 */
export class SecurityManager {
  private static instance: SecurityManager;
  private encryptionKey: Buffer;
  private rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map();
  private auditLog: Array<{ timestamp: Date; event: string; details: any }> = [];

  private constructor() {
    // Generate or load encryption key
    this.encryptionKey = this.initializeEncryptionKey();
    this.startCleanupTimer();
  }

  public static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  // AES-256 Data Encryption
  public encrypt(data: string): { encrypted: string; iv: string } {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      this.logSecurityEvent('data_encrypted', { size: data.length });
      
      return {
        encrypted: encrypted + authTag.toString('hex'),
        iv: iv.toString('hex')
      };
    } catch (error) {
      this.logSecurityEvent('encryption_failed', { error: error.message });
      throw new Error('Encryption failed');
    }
  }

  public decrypt(encryptedData: string, iv: string): string {
    try {
      const authTag = Buffer.from(encryptedData.slice(-32), 'hex');
      const encrypted = encryptedData.slice(0, -32);
      
      const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      this.logSecurityEvent('data_decrypted', { size: decrypted.length });
      
      return decrypted;
    } catch (error) {
      this.logSecurityEvent('decryption_failed', { error: error.message });
      throw new Error('Decryption failed');
    }
  }

  // Input Validation & Sanitization
  public sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      // Remove script tags and potential XSS vectors
      let sanitized = input
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/data:text\/html/gi, '')
        .trim();
      
      // Limit length to prevent DoS
      if (sanitized.length > 10000) {
        sanitized = sanitized.substring(0, 10000);
        this.logSecurityEvent('input_truncated', { originalLength: input.length });
      }
      
      return sanitized;
    }
    
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item)).slice(0, 1000); // Limit array size
    }
    
    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {};
      let keyCount = 0;
      
      for (const [key, value] of Object.entries(input)) {
        if (keyCount >= 100) break; // Prevent object pollution
        
        const sanitizedKey = this.sanitizeInput(key);
        sanitized[sanitizedKey] = this.sanitizeInput(value);
        keyCount++;
      }
      
      return sanitized;
    }
    
    return input;
  }

  // Rate Limiting
  public checkRateLimit(identifier: string, maxRequests: number = 100, windowMs: number = 60000): boolean {
    const now = Date.now();
    const key = `rateLimit:${identifier}`;
    
    const record = this.rateLimitStore.get(key);
    
    if (!record || now > record.resetTime) {
      // Reset or create new rate limit record
      this.rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return true;
    }
    
    if (record.count >= maxRequests) {
      this.logSecurityEvent('rate_limit_exceeded', { identifier, count: record.count });
      return false;
    }
    
    record.count++;
    return true;
  }

  // Content Security Policy Headers
  public getCSPHeaders(): Record<string, string> {
    return {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Allow inline for development
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' https:",
        "connect-src 'self' https:",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "base-uri 'self'"
      ].join('; '),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    };
  }

  // SQL Injection Prevention
  public validateSQLQuery(query: string): boolean {
    const dangerousPatterns = [
      /('|(\-\-)|(;)|(\|)|(\*))/, // Common SQL injection patterns
      /(union|select|insert|update|delete|drop|create|alter|exec|execute)/i,
      /script|javascript|vbscript|onload|onerror/i
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        this.logSecurityEvent('sql_injection_attempt', { query: query.substring(0, 100) });
        return false;
      }
    }
    
    return true;
  }

  // Audit Logging
  private logSecurityEvent(event: string, details: any): void {
    const logEntry = {
      timestamp: new Date(),
      event,
      details: this.sanitizeInput(details)
    };
    
    this.auditLog.push(logEntry);
    
    // Keep only last 1000 entries
    if (this.auditLog.length > 1000) {
      this.auditLog.shift();
    }
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SECURITY] ${event}:`, details);
    }
  }

  // Security Metrics
  public getSecurityMetrics(): any {
    const eventCounts: Record<string, number> = {};
    
    for (const entry of this.auditLog) {
      eventCounts[entry.event] = (eventCounts[entry.event] || 0) + 1;
    }
    
    return {
      totalEvents: this.auditLog.length,
      eventCounts,
      rateLimitRecords: this.rateLimitStore.size,
      recentEvents: this.auditLog.slice(-10)
    };
  }

  // Memory-safe cleanup
  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      
      // Clean expired rate limit records
      for (const [key, record] of this.rateLimitStore) {
        if (now > record.resetTime) {
          this.rateLimitStore.delete(key);
        }
      }
      
      // Clean old audit logs (keep last 24 hours)
      const cutoff = new Date(now - 24 * 60 * 60 * 1000);
      this.auditLog = this.auditLog.filter(entry => entry.timestamp > cutoff);
      
    }, 300000); // Every 5 minutes
  }

  private initializeEncryptionKey(): Buffer {
    const keyString = process.env.ENCRYPTION_KEY || 'default-development-key-change-in-production';
    
    if (keyString === 'default-development-key-change-in-production' && process.env.NODE_ENV === 'production') {
      console.warn('⚠️  WARNING: Using default encryption key in production! Set ENCRYPTION_KEY environment variable.');
    }
    
    return crypto.scryptSync(keyString, 'salt', 32);
  }

  // Vulnerability Scanner
  public scanForVulnerabilities(code: string): Array<{ type: string; severity: string; line?: number; description: string }> {
    const vulnerabilities: Array<{ type: string; severity: string; line?: number; description: string }> = [];
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
      // Check for potential XSS vulnerabilities
      if (line.includes('innerHTML') && !line.includes('sanitize')) {
        vulnerabilities.push({
          type: 'XSS',
          severity: 'HIGH',
          line: index + 1,
          description: 'Potential XSS vulnerability: innerHTML usage without sanitization'
        });
      }
      
      // Check for SQL injection vulnerabilities
      if (line.includes('SELECT') && line.includes('+')) {
        vulnerabilities.push({
          type: 'SQL_INJECTION',
          severity: 'CRITICAL',
          line: index + 1,
          description: 'Potential SQL injection: String concatenation in SQL query'
        });
      }
      
      // Check for hardcoded secrets
      if (/password|secret|key|token/i.test(line) && /['"][^'"]{8,}['"]/g.test(line)) {
        vulnerabilities.push({
          type: 'HARDCODED_SECRET',
          severity: 'HIGH',
          line: index + 1,
          description: 'Potential hardcoded secret detected'
        });
      }
    });
    
    return vulnerabilities;
  }
}

// Export singleton instance
export const security = SecurityManager.getInstance();
