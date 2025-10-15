// Advanced Security Hardening Implementation
// Comprehensive security middleware and utilities for LLM Framework

import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import cors from 'cors';
import { body, validationResult, param, query } from 'express-validator';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import winston from 'winston';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

// Security configuration interface
interface SecurityConfig {
  rateLimit: {
    windowMs: number;
    max: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
  };
  slowDown: {
    windowMs: number;
    delayAfter: number;
    delayMs: number;
  };
  cors: {
    origin: string[];
    methods: string[];
    allowedHeaders: string[];
    credentials: boolean;
  };
  helmet: {
    contentSecurityPolicy: boolean;
    crossOriginEmbedderPolicy: boolean;
    hsts: {
      maxAge: number;
      includeSubDomains: boolean;
    };
  };
  apiKeys: {
    rotationIntervalMs: number;
    maxAge: number;
    algorithm: string;
  };
  audit: {
    enabled: boolean;
    logLevel: string;
    retentionDays: number;
  };
}

// Default security configuration
const defaultConfig: SecurityConfig = {
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },
  slowDown: {
    windowMs: 15 * 60 * 1000,
    delayAfter: 50,
    delayMs: 500
  },
  cors: {
    origin: ['http://localhost:3000', 'https://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    credentials: true
  },
  helmet: {
    contentSecurityPolicy: true,
    crossOriginEmbedderPolicy: true,
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true
    }
  },
  apiKeys: {
    rotationIntervalMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
    algorithm: 'sha256'
  },
  audit: {
    enabled: true,
    logLevel: 'info',
    retentionDays: 90
  }
};

class SecurityHardening {
  private config: SecurityConfig;
  private redis?: Redis;
  private logger: winston.Logger;
  private apiKeys: Map<string, { key: string; created: number; lastUsed: number }> = new Map();
  private blacklistedIPs: Set<string> = new Set();
  private suspiciousPatterns: RegExp[];

  constructor(config?: Partial<SecurityConfig>) {
    this.config = { ...defaultConfig, ...config };
    this.setupLogger();
    this.setupRedis();
    this.setupSuspiciousPatterns();
  }

  private setupLogger(): void {
    this.logger = winston.createLogger({
      level: this.config.audit.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ 
          filename: 'logs/security-audit.log',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5
        }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  private setupRedis(): void {
    if (process.env.REDIS_URL) {
      try {
        this.redis = new Redis(process.env.REDIS_URL);
        console.log('✅ Redis connected for security store');
      } catch (error) {
        console.warn('⚠️  Redis connection failed, using memory store');
      }
    }
  }

  private setupSuspiciousPatterns(): void {
    this.suspiciousPatterns = [
      // SQL Injection patterns
      /('|(\-\-)|;|(\||\|)|(\*|\*))/i,
      // XSS patterns
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      // Command injection patterns
      /[;&|`$()\{\}]/,
      // Path traversal
      /\.\.[\/\\]/,
      // LDAP injection
      /[()\*\\]/
    ];
  }

  // Main security middleware factory
  public getSecurityMiddleware() {
    return [
      this.getHelmetMiddleware(),
      this.getCORSMiddleware(),
      this.getRateLimitMiddleware(),
      this.getSlowDownMiddleware(),
      this.getRequestValidationMiddleware(),
      this.getAuditMiddleware()
    ];
  }

  // Helmet security headers
  public getHelmetMiddleware() {
    return helmet({
      contentSecurityPolicy: this.config.helmet.contentSecurityPolicy ? {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
          scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdn.socket.io"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'", "https:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      } : false,
      crossOriginEmbedderPolicy: this.config.helmet.crossOriginEmbedderPolicy,
      hsts: {
        maxAge: this.config.helmet.hsts.maxAge,
        includeSubDomains: this.config.helmet.hsts.includeSubDomains
      },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: 'same-origin' }
    });
  }

  // CORS configuration
  public getCORSMiddleware() {
    return cors({
      origin: (origin, callback) => {
        if (!origin || this.config.cors.origin.includes(origin)) {
          callback(null, true);
        } else {
          this.auditLog('cors_violation', { origin, allowed: this.config.cors.origin });
          callback(new Error('CORS policy violation'));
        }
      },
      methods: this.config.cors.methods,
      allowedHeaders: this.config.cors.allowedHeaders,
      credentials: this.config.cors.credentials
    });
  }

  // Rate limiting middleware
  public getRateLimitMiddleware() {
    const store = this.redis ? new (require('rate-limit-redis'))({
      client: this.redis,
      prefix: 'rl:'
    }) : undefined;

    return rateLimit({
      windowMs: this.config.rateLimit.windowMs,
      max: this.config.rateLimit.max,
      store,
      skip: (req) => {
        // Skip rate limiting for whitelisted IPs
        const clientIP = this.getClientIP(req);
        return this.isWhitelistedIP(clientIP);
      },
      onLimitReached: (req, res) => {
        const clientIP = this.getClientIP(req);
        this.auditLog('rate_limit_exceeded', {
          ip: clientIP,
          userAgent: req.get('User-Agent'),
          endpoint: req.path
        });
      },
      standardHeaders: true,
      legacyHeaders: false
    });
  }

  // Slow down middleware for progressive delays
  public getSlowDownMiddleware() {
    return slowDown({
      windowMs: this.config.slowDown.windowMs,
      delayAfter: this.config.slowDown.delayAfter,
      delayMs: this.config.slowDown.delayMs,
      onLimitReached: (req, res) => {
        this.auditLog('slow_down_triggered', {
          ip: this.getClientIP(req),
          endpoint: req.path
        });
      }
    });
  }

  // Request validation and sanitization
  public getRequestValidationMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Check for suspicious patterns
      const requestData = JSON.stringify({
        body: req.body,
        query: req.query,
        params: req.params
      });

      for (const pattern of this.suspiciousPatterns) {
        if (pattern.test(requestData)) {
          this.auditLog('suspicious_pattern_detected', {
            ip: this.getClientIP(req),
            pattern: pattern.toString(),
            data: requestData.substring(0, 200) // Limit log data
          });
          
          return res.status(400).json({
            error: 'Request contains suspicious patterns',
            code: 'SUSPICIOUS_INPUT'
          });
        }
      }

      // Sanitize string inputs
      this.sanitizeRequestData(req);
      next();
    };
  }

  // Audit logging middleware
  public getAuditMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.audit.enabled) {
        return next();
      }

      const startTime = Date.now();
      const clientIP = this.getClientIP(req);
      
      // Log request
      this.auditLog('request', {
        method: req.method,
        path: req.path,
        ip: clientIP,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        // Log response
        this.auditLog('response', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          ip: clientIP
        });

        // Flag suspicious activity
        if (res.statusCode >= 400 || duration > 10000) {
          this.auditLog('suspicious_response', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            ip: clientIP
          });
        }
      });

      next();
    };
  }

  // API Key authentication middleware
  public getAPIKeyMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const apiKey = req.get('X-API-Key') || req.get('Authorization')?.replace('Bearer ', '');
      
      if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
      }

      if (!this.validateAPIKey(apiKey)) {
        this.auditLog('invalid_api_key', {
          ip: this.getClientIP(req),
          key: apiKey.substring(0, 8) + '...' // Log only first 8 chars
        });
        
        return res.status(401).json({ error: 'Invalid API key' });
      }

      // Update last used timestamp
      this.updateAPIKeyUsage(apiKey);
      next();
    };
  }

  // Input sanitization
  private sanitizeRequestData(req: Request): void {
    if (req.body && typeof req.body === 'object') {
      req.body = this.sanitizeObject(req.body);
    }
    
    if (req.query && typeof req.query === 'object') {
      req.query = this.sanitizeObject(req.query);
    }
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return DOMPurify.sanitize(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  }

  // Utility methods
  private getClientIP(req: Request): string {
    return req.ip ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           (req.connection as any)?.socket?.remoteAddress ||
           'unknown';
  }

  private isWhitelistedIP(ip: string): boolean {
    const whitelistedIPs = (process.env.WHITELISTED_IPS || '').split(',');
    return whitelistedIPs.includes(ip);
  }

  private auditLog(event: string, data: any): void {
    if (!this.config.audit.enabled) return;
    
    this.logger.info(event, {
      event,
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  // API Key management
  public generateAPIKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  public addAPIKey(key: string): void {
    this.apiKeys.set(key, {
      key,
      created: Date.now(),
      lastUsed: Date.now()
    });
  }

  public validateAPIKey(key: string): boolean {
    const apiKeyData = this.apiKeys.get(key);
    if (!apiKeyData) return false;
    
    // Check if key has expired
    const now = Date.now();
    if (now - apiKeyData.created > this.config.apiKeys.maxAge) {
      this.apiKeys.delete(key);
      return false;
    }
    
    return true;
  }

  private updateAPIKeyUsage(key: string): void {
    const apiKeyData = this.apiKeys.get(key);
    if (apiKeyData) {
      apiKeyData.lastUsed = Date.now();
    }
  }

  public revokeAPIKey(key: string): boolean {
    return this.apiKeys.delete(key);
  }

  // IP blacklisting
  public blacklistIP(ip: string): void {
    this.blacklistedIPs.add(ip);
    this.auditLog('ip_blacklisted', { ip });
  }

  public unblacklistIP(ip: string): void {
    this.blacklistedIPs.delete(ip);
    this.auditLog('ip_unblacklisted', { ip });
  }

  public isBlacklistedIP(ip: string): boolean {
    return this.blacklistedIPs.has(ip);
  }

  // Input validation helpers
  public validateEmail = (email: string): boolean => {
    return validator.isEmail(email);
  };

  public validateURL = (url: string): boolean => {
    return validator.isURL(url);
  };

  public validateJSON = (json: string): boolean => {
    try {
      JSON.parse(json);
      return true;
    } catch {
      return false;
    }
  };

  // Validation rule factories
  public createEmailValidation() {
    return body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email format');
  }

  public createPasswordValidation() {
    return body('password')
      .isLength({ min: 8, max: 128 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/);
  }

  public createAPIKeyValidation() {
    return [param('apiKey').isHexadecimal().isLength({ min: 64, max: 64 })];
  }

  // Security scan results
  public getSecurityStatus(): any {
    return {
      timestamp: new Date().toISOString(),
      status: 'secure',
      activeAPIKeys: this.apiKeys.size,
      blacklistedIPs: this.blacklistedIPs.size,
      config: {
        rateLimitEnabled: true,
        corsEnabled: true,
        helmetEnabled: true,
        auditingEnabled: this.config.audit.enabled
      },
      recommendations: this.getSecurityRecommendations()
    };
  }

  private getSecurityRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (!process.env.REDIS_URL) {
      recommendations.push('Consider using Redis for distributed rate limiting');
    }
    
    if (this.apiKeys.size === 0) {
      recommendations.push('No API keys configured - consider implementing API authentication');
    }
    
    if (!this.config.helmet.contentSecurityPolicy) {
      recommendations.push('Content Security Policy is disabled - enable for XSS protection');
    }
    
    return recommendations;
  }

  // Cleanup expired keys and logs
  public cleanup(): void {
    const now = Date.now();
    
    // Remove expired API keys
    for (const [key, data] of this.apiKeys.entries()) {
      if (now - data.created > this.config.apiKeys.maxAge) {
        this.apiKeys.delete(key);
        this.auditLog('api_key_expired', { key: key.substring(0, 8) + '...' });
      }
    }
    
    console.log(`🧹 Security cleanup: ${this.apiKeys.size} active API keys`);
  }

  // Start periodic cleanup
  public startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanup();
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }
}

export { SecurityHardening, type SecurityConfig };