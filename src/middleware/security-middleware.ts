import { Request, Response, NextFunction } from 'express';
import { security } from '../security/security-manager.js';
import { CSPEnforcer } from '../security/csp-enforcer.js';
import { InputValidator } from '../security/input-validator.js';

/**
 * Security Middleware Suite
 * Integrates all security measures into Express middleware
 */
export class SecurityMiddleware {
  // Apply all security headers
  public static securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      const headers = CSPEnforcer.getSecurityHeaders();
      
      Object.entries(headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      
      next();
    };
  }

  // Rate limiting middleware
  public static rateLimit(maxRequests: number = 100, windowMs: number = 60000) {
    return (req: Request, res: Response, next: NextFunction) => {
      const identifier = req.ip || req.socket.remoteAddress || 'unknown';
      
      if (!security.checkRateLimit(identifier, maxRequests, windowMs)) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }
      
      next();
    };
  }

  // Input sanitization middleware
  public static sanitizeInputs() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        if (req.body) {
          req.body = InputValidator.sanitizeObject(req.body);
        }
        
        if (req.query) {
          req.query = InputValidator.sanitizeObject(req.query);
        }
        
        if (req.params) {
          req.params = InputValidator.sanitizeObject(req.params);
        }
        
        next();
      } catch (error) {
        res.status(400).json({
          success: false,
          error: 'Invalid input data',
          details: error.message
        });
      }
    };
  }

  // API key authentication middleware
  public static authenticateAPIKey(requiredKey?: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
      
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: 'API key required'
        });
      }
      
      if (!InputValidator.validateAPIKey(apiKey as string)) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key format'
        });
      }
      
      if (requiredKey && apiKey !== requiredKey) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      next();
    };
  }

  // SQL injection protection for database queries
  public static sqlInjectionProtection() {
    return (req: Request, res: Response, next: NextFunction) => {
      const checkObject = (obj: any): boolean => {
        if (typeof obj === 'string') {
          return InputValidator.isSQLSafe(obj);
        }
        
        if (Array.isArray(obj)) {
          return obj.every(item => checkObject(item));
        }
        
        if (typeof obj === 'object' && obj !== null) {
          return Object.values(obj).every(value => checkObject(value));
        }
        
        return true;
      };
      
      const isRequestSafe = checkObject(req.body) && checkObject(req.query) && checkObject(req.params);
      
      if (!isRequestSafe) {
        return res.status(400).json({
          success: false,
          error: 'Potentially unsafe request detected'
        });
      }
      
      next();
    };
  }

  // Path traversal protection for file operations
  public static pathTraversalProtection() {
    return (req: Request, res: Response, next: NextFunction) => {
      const pathParams = ['path', 'file', 'filename', 'dir', 'directory'];
      
      for (const param of pathParams) {
        const value = req.body?.[param] || req.query?.[param] || req.params?.[param];
        
        if (value && !InputValidator.isPathSafe(value as string)) {
          return res.status(400).json({
            success: false,
            error: 'Unsafe path detected'
          });
        }
      }
      
      next();
    };
  }

  // Request size limiting
  public static requestSizeLimit(maxSizeBytes: number = 1024 * 1024) { // 1MB default
    return (req: Request, res: Response, next: NextFunction) => {
      const contentLength = parseInt(req.headers['content-length'] || '0');
      
      if (contentLength > maxSizeBytes) {
        return res.status(413).json({
          success: false,
          error: 'Request too large',
          maxSize: maxSizeBytes
        });
      }
      
      next();
    };
  }

  // Security audit logging
  public static auditLogging() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        };
        
        // Log suspicious activity
        if (res.statusCode >= 400) {
          console.log('[SECURITY AUDIT] Suspicious request:', logData);
        }
      });
      
      next();
    };
  }

  // Combine all security middleware
  public static createSecuritySuite(options: {
    rateLimit?: { maxRequests: number; windowMs: number };
    apiKey?: string;
    maxRequestSize?: number;
  } = {}) {
    const middlewares = [
      SecurityMiddleware.securityHeaders(),
      SecurityMiddleware.auditLogging(),
      SecurityMiddleware.requestSizeLimit(options.maxRequestSize),
      SecurityMiddleware.sanitizeInputs(),
      SecurityMiddleware.sqlInjectionProtection(),
      SecurityMiddleware.pathTraversalProtection()
    ];
    
    if (options.rateLimit) {
      middlewares.push(SecurityMiddleware.rateLimit(
        options.rateLimit.maxRequests,
        options.rateLimit.windowMs
      ));
    }
    
    if (options.apiKey) {
      middlewares.push(SecurityMiddleware.authenticateAPIKey(options.apiKey));
    }
    
    return middlewares;
  }
}
