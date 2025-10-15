/**
 * Browser Extension Security Manager
 * 
 * Implements comprehensive security hardening:
 * - Content Security Policy (CSP) enforcement
 * - Input validation and sanitization
 * - AES-256 data encryption at rest
 * - Security audit logging and monitoring
 * - GDPR compliance and data protection
 */

import * as crypto from 'crypto';
import { EventEmitter } from 'events';

export interface SecurityConfig {
  encryptionKey?: string;
  auditLogLevel: 'none' | 'basic' | 'detailed' | 'full';
  dataRetentionDays: number;
  enableCSP: boolean;
  enableInputValidation: boolean;
  enableAuditLogging: boolean;
  maxDataSize: number;
  sessionTimeout: number;
}

export interface SecurityEvent {
  type: 'access' | 'validation' | 'encryption' | 'csp_violation' | 'suspicious';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  source: string;
  details: any;
  userAgent?: string;
  origin?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitized?: any;
}

class EncryptionManager {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;
  
  constructor(encryptionKey?: string) {
    if (encryptionKey) {
      this.key = crypto.scryptSync(encryptionKey, 'salt', 32);
    } else {
      // Generate random key if none provided
      this.key = crypto.randomBytes(32);
      console.warn('Using generated encryption key. Set ENCRYPTION_KEY environment variable for production.');
    }
  }
  
  encrypt(data: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.key);
    cipher.setAAD(Buffer.from('llm-extension', 'utf8'));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }
  
  decrypt(encryptedData: { encrypted: string; iv: string; tag: string }): string {
    const decipher = crypto.createDecipher(this.algorithm, this.key);
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    decipher.setAAD(Buffer.from('llm-extension', 'utf8'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  secureCompare(a: string, b: string): boolean {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}

class InputValidator {
  private patterns = {
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
    filename: /^[a-zA-Z0-9._-]+$/,
    alphanumeric: /^[a-zA-Z0-9]+$/,
    text: /^[a-zA-Z0-9\s.,!?;:()\[\]{}"\'`-]+$/
  };
  
  validateInput(input: any, rules: {
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
    pattern?: keyof typeof this.patterns | RegExp;
    minLength?: number;
    maxLength?: number;
    allowedValues?: any[];
    customValidator?: (value: any) => boolean;
  }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let sanitized = input;
    
    // Required check
    if (rules.required && (input === null || input === undefined || input === '')) {
      errors.push('Field is required');
      return { isValid: false, errors, warnings };
    }
    
    // Skip further validation if not required and empty
    if (!rules.required && (input === null || input === undefined || input === '')) {
      return { isValid: true, errors, warnings, sanitized };
    }
    
    // Type validation
    if (rules.type) {
      const actualType = Array.isArray(input) ? 'array' : typeof input;
      if (actualType !== rules.type) {
        errors.push(`Expected ${rules.type}, got ${actualType}`);
      }
    }
    
    // String-specific validations
    if (typeof input === 'string') {
      // Length validation
      if (rules.minLength && input.length < rules.minLength) {
        errors.push(`Minimum length is ${rules.minLength}`);
      }
      if (rules.maxLength && input.length > rules.maxLength) {
        errors.push(`Maximum length is ${rules.maxLength}`);
      }
      
      // Pattern validation
      if (rules.pattern) {
        const pattern = typeof rules.pattern === 'string' ? this.patterns[rules.pattern] : rules.pattern;
        if (pattern && !pattern.test(input)) {
          errors.push(`Invalid format`);
        }
      }
      
      // HTML/Script sanitization
      sanitized = this.sanitizeString(input);
      if (sanitized !== input) {
        warnings.push('Content was sanitized for security');
      }
    }
    
    // Allowed values validation
    if (rules.allowedValues && !rules.allowedValues.includes(input)) {
      errors.push(`Value not in allowed list`);
    }
    
    // Custom validation
    if (rules.customValidator && !rules.customValidator(input)) {
      errors.push('Custom validation failed');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized
    };
  }
  
  private sanitizeString(input: string): string {
    return input
      // Remove script tags
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove javascript: protocols
      .replace(/javascript:/gi, '')
      // Remove on* event handlers
      .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
      // Escape HTML entities
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      // Remove control characters
      .replace(/[\x00-\x1F\x7F]/g, '')
      // Limit length to prevent DoS
      .substring(0, 10000);
  }
  
  sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key);
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  }
}

class AuditLogger {
  private logs: SecurityEvent[] = [];
  private maxLogs: number;
  private logLevel: SecurityConfig['auditLogLevel'];
  
  constructor(logLevel: SecurityConfig['auditLogLevel'] = 'detailed', maxLogs: number = 10000) {
    this.logLevel = logLevel;
    this.maxLogs = maxLogs;
  }
  
  log(event: Omit<SecurityEvent, 'timestamp'>): void {
    if (this.logLevel === 'none') return;
    
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: Date.now()
    };
    
    // Add to memory log
    this.logs.push(fullEvent);
    
    // Trim logs if too many
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // Console output for critical events
    if (event.severity === 'critical' || event.severity === 'high') {
      console.warn(`[SECURITY ${event.severity.toUpperCase()}] ${event.type}:`, event.details);
    }
    
    // Could integrate with external logging systems here
    this.sendToSecurityMonitoring(fullEvent);
  }
  
  private sendToSecurityMonitoring(event: SecurityEvent): void {
    // In a real implementation, this would send to external monitoring
    // For now, just emit for potential listeners
    if (typeof window !== 'undefined' && window.postMessage) {
      window.postMessage({
        type: 'SECURITY_EVENT',
        event
      }, '*');
    }
  }
  
  getRecentEvents(hours: number = 24): SecurityEvent[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.logs.filter(log => log.timestamp > cutoff);
  }
  
  getSecuritySummary(hours: number = 24): {
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    trends: Array<{ hour: number; count: number }>;
  } {
    const events = this.getRecentEvents(hours);
    
    const bySeverity: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    const byType: Record<string, number> = {};
    const trends: Array<{ hour: number; count: number }> = [];
    
    // Count by severity and type
    for (const event of events) {
      bySeverity[event.severity]++;
      byType[event.type] = (byType[event.type] || 0) + 1;
    }
    
    // Calculate hourly trends
    for (let i = hours - 1; i >= 0; i--) {
      const hourStart = Date.now() - (i * 60 * 60 * 1000);
      const hourEnd = hourStart + (60 * 60 * 1000);
      const count = events.filter(e => e.timestamp >= hourStart && e.timestamp < hourEnd).length;
      trends.push({ hour: i, count });
    }
    
    return {
      total: events.length,
      bySeverity,
      byType,
      trends
    };
  }
  
  clear(): void {
    this.logs = [];
  }
}

class CSPEnforcer {
  private policies = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-eval'"], // Needed for dynamic imports
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", 'https://api.anthropic.com', 'wss://'],
    'frame-src': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"]
  };
  
  generateCSPHeader(): string {
    const directives = Object.entries(this.policies)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');
    
    return directives;
  }
  
  validateCSPCompliance(content: string): { compliant: boolean; violations: string[] } {
    const violations: string[] = [];
    
    // Check for inline scripts
    if (/<script\b[^>]*>(?!.*src=)[\s\S]*?<\/script>/i.test(content)) {
      violations.push('Inline scripts detected (CSP violation)');
    }
    
    // Check for inline event handlers
    if (/\s+on\w+\s*=/i.test(content)) {
      violations.push('Inline event handlers detected (CSP violation)');
    }
    
    // Check for javascript: protocols
    if (/javascript:/i.test(content)) {
      violations.push('javascript: protocol detected (CSP violation)');
    }
    
    // Check for eval() usage
    if (/\beval\s*\(/i.test(content)) {
      violations.push('eval() usage detected (CSP violation)');
    }
    
    return {
      compliant: violations.length === 0,
      violations
    };
  }
  
  addAllowedSource(directive: keyof typeof this.policies, source: string): void {
    if (!this.policies[directive].includes(source)) {
      this.policies[directive].push(source);
    }
  }
  
  removeAllowedSource(directive: keyof typeof this.policies, source: string): void {
    const index = this.policies[directive].indexOf(source);
    if (index > -1) {
      this.policies[directive].splice(index, 1);
    }
  }
}

class DataProtectionManager {
  private encryptionManager: EncryptionManager;
  private retentionPeriod: number;
  
  constructor(encryptionKey?: string, retentionDays: number = 30) {
    this.encryptionManager = new EncryptionManager(encryptionKey);
    this.retentionPeriod = retentionDays * 24 * 60 * 60 * 1000;
  }
  
  async storeSecurely(key: string, data: any, metadata?: { purpose: string; category: 'personal' | 'functional' | 'analytics' }): Promise<boolean> {
    try {
      const serialized = JSON.stringify({
        data,
        metadata: {
          ...metadata,
          stored: Date.now(),
          expires: Date.now() + this.retentionPeriod
        }
      });
      
      const encrypted = this.encryptionManager.encrypt(serialized);
      const storageKey = `secure_${this.encryptionManager.hash(key)}`;
      
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        // Browser extension storage
        await chrome.storage.local.set({ [storageKey]: encrypted });
      } else {
        // Node.js environment (for testing)
        const fs = require('fs').promises;
        const path = require('path');
        const secureDir = path.join(process.cwd(), '.secure-storage');
        await fs.mkdir(secureDir, { recursive: true });
        await fs.writeFile(
          path.join(secureDir, `${storageKey}.json`),
          JSON.stringify(encrypted)
        );
      }
      
      return true;
    } catch (error) {
      console.error('Secure storage error:', error);
      return false;
    }
  }
  
  async retrieveSecurely(key: string): Promise<any | null> {
    try {
      const storageKey = `secure_${this.encryptionManager.hash(key)}`;
      let encrypted;
      
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        // Browser extension storage
        const result = await chrome.storage.local.get(storageKey);
        encrypted = result[storageKey];
      } else {
        // Node.js environment
        const fs = require('fs').promises;
        const path = require('path');
        const filePath = path.join(process.cwd(), '.secure-storage', `${storageKey}.json`);
        try {
          const fileContent = await fs.readFile(filePath, 'utf-8');
          encrypted = JSON.parse(fileContent);
        } catch (error) {
          return null; // File doesn't exist
        }
      }
      
      if (!encrypted) return null;
      
      const decrypted = this.encryptionManager.decrypt(encrypted);
      const parsed = JSON.parse(decrypted);
      
      // Check expiration
      if (Date.now() > parsed.metadata.expires) {
        await this.deleteSecurely(key);
        return null;
      }
      
      return parsed.data;
    } catch (error) {
      console.error('Secure retrieval error:', error);
      return null;
    }
  }
  
  async deleteSecurely(key: string): Promise<boolean> {
    try {
      const storageKey = `secure_${this.encryptionManager.hash(key)}`;
      
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove(storageKey);
      } else {
        const fs = require('fs').promises;
        const path = require('path');
        const filePath = path.join(process.cwd(), '.secure-storage', `${storageKey}.json`);
        try {
          await fs.unlink(filePath);
        } catch (error) {
          // File might not exist
        }
      }
      
      return true;
    } catch (error) {
      console.error('Secure deletion error:', error);
      return false;
    }
  }
  
  async cleanupExpiredData(): Promise<number> {
    let cleaned = 0;
    
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        // Browser extension cleanup
        const all = await chrome.storage.local.get();
        for (const [storageKey, encrypted] of Object.entries(all)) {
          if (storageKey.startsWith('secure_')) {
            try {
              const decrypted = this.encryptionManager.decrypt(encrypted as any);
              const parsed = JSON.parse(decrypted);
              
              if (Date.now() > parsed.metadata.expires) {
                await chrome.storage.local.remove(storageKey);
                cleaned++;
              }
            } catch (error) {
              // Corrupted data, remove it
              await chrome.storage.local.remove(storageKey);
              cleaned++;
            }
          }
        }
      } else {
        // Node.js cleanup
        const fs = require('fs').promises;
        const path = require('path');
        const secureDir = path.join(process.cwd(), '.secure-storage');
        
        try {
          const files = await fs.readdir(secureDir);
          for (const file of files) {
            if (file.endsWith('.json')) {
              try {
                const filePath = path.join(secureDir, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const encrypted = JSON.parse(content);
                const decrypted = this.encryptionManager.decrypt(encrypted);
                const parsed = JSON.parse(decrypted);
                
                if (Date.now() > parsed.metadata.expires) {
                  await fs.unlink(filePath);
                  cleaned++;
                }
              } catch (error) {
                // Corrupted file, remove it
                await fs.unlink(path.join(secureDir, file));
                cleaned++;
              }
            }
          }
        } catch (error) {
          // Directory doesn't exist
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
    
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired secure data entries`);
    }
    
    return cleaned;
  }
}

export class SecurityManager extends EventEmitter {
  private config: SecurityConfig;
  private encryptionManager: EncryptionManager;
  private inputValidator: InputValidator;
  private auditLogger: AuditLogger;
  private cspEnforcer: CSPEnforcer;
  private dataProtectionManager: DataProtectionManager;
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  constructor(config: Partial<SecurityConfig> = {}) {
    super();
    
    this.config = {
      encryptionKey: process.env.ENCRYPTION_KEY,
      auditLogLevel: 'detailed',
      dataRetentionDays: 30,
      enableCSP: true,
      enableInputValidation: true,
      enableAuditLogging: true,
      maxDataSize: 10 * 1024 * 1024, // 10MB
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      ...config
    };
    
    this.encryptionManager = new EncryptionManager(this.config.encryptionKey);
    this.inputValidator = new InputValidator();
    this.auditLogger = new AuditLogger(this.config.auditLogLevel);
    this.cspEnforcer = new CSPEnforcer();
    this.dataProtectionManager = new DataProtectionManager(
      this.config.encryptionKey,
      this.config.dataRetentionDays
    );
    
    this.startPeriodicCleanup();
    this.logSecurityEvent('access', 'low', 'SecurityManager', { action: 'initialized' });
  }
  
  private startPeriodicCleanup(): void {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(async () => {
      await this.performSecurityMaintenance();
    }, 60 * 60 * 1000);
  }
  
  private async performSecurityMaintenance(): Promise<void> {
    try {
      const cleaned = await this.dataProtectionManager.cleanupExpiredData();
      if (cleaned > 0) {
        this.logSecurityEvent('access', 'low', 'SecurityManager', 
          { action: 'maintenance', cleaned });
      }
    } catch (error) {
      this.logSecurityEvent('suspicious', 'medium', 'SecurityManager',
        { action: 'maintenance_failed', error: error.message });
    }
  }
  
  // Public API
  validateInput(input: any, rules: any): ValidationResult {
    if (!this.config.enableInputValidation) {
      return { isValid: true, errors: [], warnings: [] };
    }
    
    const result = this.inputValidator.validateInput(input, rules);
    
    if (!result.isValid) {
      this.logSecurityEvent('validation', 'medium', 'InputValidator',
        { input: typeof input, errors: result.errors });
    }
    
    return result;
  }
  
  sanitizeInput(input: any): any {
    if (!this.config.enableInputValidation) {
      return input;
    }
    
    const sanitized = this.inputValidator.sanitizeObject(input);
    
    if (JSON.stringify(sanitized) !== JSON.stringify(input)) {
      this.logSecurityEvent('validation', 'low', 'InputValidator',
        { action: 'sanitized', originalType: typeof input });
    }
    
    return sanitized;
  }
  
  async storeSecurely(key: string, data: any, metadata?: any): Promise<boolean> {
    // Validate data size
    const dataSize = JSON.stringify(data).length;
    if (dataSize > this.config.maxDataSize) {
      this.logSecurityEvent('validation', 'high', 'DataProtection',
        { action: 'store_rejected', reason: 'size_exceeded', size: dataSize });
      return false;
    }
    
    const success = await this.dataProtectionManager.storeSecurely(key, data, metadata);
    
    this.logSecurityEvent('encryption', success ? 'low' : 'medium', 'DataProtection',
      { action: 'store', key: this.encryptionManager.hash(key), success, size: dataSize });
    
    return success;
  }
  
  async retrieveSecurely(key: string): Promise<any | null> {
    const data = await this.dataProtectionManager.retrieveSecurely(key);
    
    this.logSecurityEvent('encryption', 'low', 'DataProtection',
      { action: 'retrieve', key: this.encryptionManager.hash(key), found: data !== null });
    
    return data;
  }
  
  async deleteSecurely(key: string): Promise<boolean> {
    const success = await this.dataProtectionManager.deleteSecurely(key);
    
    this.logSecurityEvent('encryption', 'low', 'DataProtection',
      { action: 'delete', key: this.encryptionManager.hash(key), success });
    
    return success;
  }
  
  getCSPHeader(): string {
    if (!this.config.enableCSP) {
      return '';
    }
    
    return this.cspEnforcer.generateCSPHeader();
  }
  
  validateCSPCompliance(content: string): { compliant: boolean; violations: string[] } {
    if (!this.config.enableCSP) {
      return { compliant: true, violations: [] };
    }
    
    const result = this.cspEnforcer.validateCSPCompliance(content);
    
    if (!result.compliant) {
      this.logSecurityEvent('csp_violation', 'high', 'CSPEnforcer',
        { violations: result.violations });
    }
    
    return result;
  }
  
  logSecurityEvent(
    type: SecurityEvent['type'],
    severity: SecurityEvent['severity'],
    source: string,
    details: any
  ): void {
    if (!this.config.enableAuditLogging) return;
    
    this.auditLogger.log({
      type,
      severity,
      source,
      details,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      origin: typeof location !== 'undefined' ? location.origin : undefined
    });
    
    // Emit for external monitoring
    this.emit('securityEvent', { type, severity, source, details });
  }
  
  getSecuritySummary(hours: number = 24): any {
    return this.auditLogger.getSecuritySummary(hours);
  }
  
  async performSecurityAudit(): Promise<{
    score: number;
    issues: Array<{ severity: string; description: string; recommendation: string }>;
    recommendations: string[];
  }> {
    const issues: Array<{ severity: string; description: string; recommendation: string }> = [];
    const recommendations: string[] = [];
    let score = 100;
    
    // Check encryption key
    if (!this.config.encryptionKey) {
      issues.push({
        severity: 'high',
        description: 'No encryption key configured',
        recommendation: 'Set ENCRYPTION_KEY environment variable'
      });
      score -= 20;
    }
    
    // Check CSP configuration
    if (!this.config.enableCSP) {
      issues.push({
        severity: 'medium',
        description: 'Content Security Policy disabled',
        recommendation: 'Enable CSP for XSS protection'
      });
      score -= 10;
    }
    
    // Check audit logging
    if (this.config.auditLogLevel === 'none') {
      issues.push({
        severity: 'medium',
        description: 'Security audit logging disabled',
        recommendation: 'Enable audit logging for security monitoring'
      });
      score -= 10;
    }
    
    // Check data retention policy
    if (this.config.dataRetentionDays > 90) {
      issues.push({
        severity: 'low',
        description: 'Long data retention period',
        recommendation: 'Consider shorter retention for privacy compliance'
      });
      score -= 5;
    }
    
    // Generate recommendations
    if (score < 90) {
      recommendations.push('Review and address security issues identified');
    }
    if (!this.config.encryptionKey) {
      recommendations.push('Configure strong encryption key for production');
    }
    recommendations.push('Regularly review security audit logs');
    recommendations.push('Implement security monitoring dashboard');
    
    return { score: Math.max(0, score), issues, recommendations };
  }
  
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.auditLogger.clear();
    this.removeAllListeners();
  }
}

// Singleton instance
let securityManagerInstance: SecurityManager | null = null;

export function getSecurityManager(config?: Partial<SecurityConfig>): SecurityManager {
  if (!securityManagerInstance) {
    securityManagerInstance = new SecurityManager(config);
  }
  return securityManagerInstance;
}

export function destroySecurityManager(): void {
  if (securityManagerInstance) {
    securityManagerInstance.destroy();
    securityManagerInstance = null;
  }
}

// Browser extension integration
if (typeof chrome !== 'undefined' && chrome.runtime) {
  // Initialize security manager for browser extension
  const securityManager = getSecurityManager({
    auditLogLevel: 'detailed',
    dataRetentionDays: 7, // Shorter retention for browser extension
    enableCSP: true,
    enableInputValidation: true,
    enableAuditLogging: true
  });
  
  // Listen for CSP violations
  if (typeof document !== 'undefined') {
    document.addEventListener('securitypolicyviolation', (e) => {
      securityManager.logSecurityEvent('csp_violation', 'high', 'CSP',
        {
          directive: e.violatedDirective,
          blockedURI: e.blockedURI,
          lineNumber: e.lineNumber,
          source: e.sourceFile
        });
    });
  }
}