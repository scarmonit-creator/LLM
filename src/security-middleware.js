import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { z } from 'zod';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

/**
 * Military-grade Security Middleware System
 * Features: Advanced rate limiting, input validation, CORS security, API authentication
 */
class SecurityMiddleware {
  constructor(options = {}) {
    this.options = {
      // Rate limiting configuration
      rateLimit: {
        windowMs: options.rateLimitWindow || 15 * 60 * 1000, // 15 minutes
        maxRequests: options.maxRequests || 1000,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        enableDistributed: options.enableDistributedRateLimit || false,
        redisUrl: options.redisUrl || process.env.REDIS_URL
      },
      
      // CORS configuration
      cors: {
        origin: options.corsOrigin || process.env.CORS_ORIGIN || false,
        credentials: true,
        optionsSuccessStatus: 200,
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
        maxAge: 86400 // 24 hours
      },
      
      // Security headers configuration
      helmet: {
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "wss:", "https:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            mediaSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
            upgradeInsecureRequests: []
          }
        },
        hsts: {
          maxAge: 31536000, // 1 year
          includeSubDomains: true,
          preload: true
        },
        noSniff: true,
        xssFilter: true,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
        crossOriginEmbedderPolicy: false, // Disable for WebSocket compatibility
        crossOriginResourcePolicy: { policy: 'cross-origin' }
      },
      
      // Authentication configuration
      jwt: {
        secret: options.jwtSecret || process.env.JWT_SECRET || this.generateSecureSecret(),
        expiresIn: options.jwtExpiresIn || '24h',
        issuer: options.jwtIssuer || 'llm-server',
        audience: options.jwtAudience || 'llm-clients'
      },
      
      // Input validation configuration
      validation: {
        enableStrict: options.enableStrictValidation !== false,
        maxBodySize: options.maxBodySize || '10mb',
        maxUrlLength: options.maxUrlLength || 2048,
        maxHeaderSize: options.maxHeaderSize || '8kb'
      },
      
      ...options
    };
    
    this.securityMetrics = {
      blockedRequests: 0,
      rateLimitedRequests: 0,
      authenticationFailures: 0,
      validationFailures: 0,
      suspiciousActivityDetected: 0,
      startTime: Date.now()
    };
    
    this.initializeValidationSchemas();
    this.initializeSecurityMonitoring();
  }
  
  // Generate secure JWT secret if not provided
  generateSecureSecret() {
    const secret = crypto.randomBytes(64).toString('hex');
    console.warn('⚠️  JWT secret generated automatically. For production, set JWT_SECRET environment variable');
    return secret;
  }
  
  // Initialize input validation schemas
  initializeValidationSchemas() {
    this.schemas = {
      // API request validation
      apiRequest: z.object({
        query: z.string().max(1000).optional(),
        count: z.number().int().min(1).max(1000).optional(),
        page: z.number().int().min(1).max(1000).optional(),
        sort: z.enum(['asc', 'desc']).optional(),
        filter: z.string().max(500).optional()
      }),
      
      // WebSocket message validation
      websocketMessage: z.object({
        type: z.enum(['ping', 'pong', 'message', 'subscribe', 'unsubscribe', 'metrics', 'performance']),
        data: z.any().optional(),
        id: z.string().max(100).optional(),
        timestamp: z.number().optional()
      }),
      
      // Authentication validation
      credentials: z.object({
        username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
        password: z.string().min(8).max(128),
        rememberMe: z.boolean().optional()
      }),
      
      // General input sanitization
      sanitizedString: z.string().transform((str) => {
        return str
          .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
          .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') // Remove iframe tags
          .replace(/javascript:/gi, '') // Remove javascript: protocol
          .replace(/on\w+\s*=/gi, '') // Remove event handlers
          .trim();
      })
    };
  }
  
  // Initialize security monitoring
  initializeSecurityMonitoring() {
    // Monitor for suspicious patterns
    setInterval(() => {
      this.analyzeSecurityMetrics();
    }, 300000); // Every 5 minutes
  }
  
  // Analyze security metrics for suspicious patterns
  analyzeSecurityMetrics() {
    const timeWindow = 300000; // 5 minutes
    const currentTime = Date.now();
    const windowStart = currentTime - timeWindow;
    
    // Calculate rates
    const blockedRequestRate = this.securityMetrics.blockedRequests / (timeWindow / 60000); // per minute
    const authFailureRate = this.securityMetrics.authenticationFailures / (timeWindow / 60000);
    const validationFailureRate = this.securityMetrics.validationFailures / (timeWindow / 60000);
    
    // Detect suspicious patterns
    if (blockedRequestRate > 10) {
      console.warn(`🚨 High blocked request rate: ${blockedRequestRate.toFixed(2)} requests/min`);
      this.securityMetrics.suspiciousActivityDetected++;
    }
    
    if (authFailureRate > 5) {
      console.warn(`🚨 High authentication failure rate: ${authFailureRate.toFixed(2)} failures/min`);
      this.securityMetrics.suspiciousActivityDetected++;
    }
    
    if (validationFailureRate > 20) {
      console.warn(`🚨 High validation failure rate: ${validationFailureRate.toFixed(2)} failures/min`);
      this.securityMetrics.suspiciousActivityDetected++;
    }
    
    // Reset counters for next window
    this.resetSecurityCounters();
  }
  
  // Reset security counters
  resetSecurityCounters() {
    this.securityMetrics.blockedRequests = 0;
    this.securityMetrics.rateLimitedRequests = 0;
    this.securityMetrics.authenticationFailures = 0;
    this.securityMetrics.validationFailures = 0;
  }
  
  // Create advanced rate limiter
  createRateLimiter(options = {}) {
    const config = {
      windowMs: options.windowMs || this.options.rateLimit.windowMs,
      max: (req) => {
        // Different limits for different endpoints and user types
        if (req.headers.authorization) {
          // Authenticated users get higher limits
          if (req.path.startsWith('/api/')) return options.authApiLimit || 500;
          return options.authLimit || 2000;
        }
        
        // Different limits for different endpoints
        if (req.path === '/health') return options.healthLimit || 1000;
        if (req.path === '/metrics') return options.metricsLimit || 100;
        if (req.path.startsWith('/api/')) return options.apiLimit || 100;
        if (req.path.startsWith('/ws')) return options.wsLimit || 50;
        
        return options.defaultLimit || this.options.rateLimit.maxRequests;
      },
      message: {
        error: 'Too many requests from this IP',
        retryAfter: Math.ceil(this.options.rateLimit.windowMs / 1000 / 60) + ' minutes',
        type: 'rate_limit_exceeded'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (req) => {
        // Use IP + User-Agent for better rate limiting
        return req.ip + ':' + (req.headers['user-agent'] || 'unknown').substring(0, 50);
      },
      skip: (req) => {
        // Skip rate limiting for certain conditions
        return req.headers['x-skip-rate-limit'] === 'true' && this.isInternalRequest(req);
      },
      onLimitReached: (req) => {
        this.securityMetrics.rateLimitedRequests++;
        console.warn(`⚠️ Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
      }
    };
    
    return rateLimit(config);
  }
  
  // Create CORS middleware
  createCorsMiddleware() {
    return cors({
      ...this.options.cors,
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = this.getAllowedOrigins();
        
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        
        // Check for wildcard patterns
        const isAllowed = allowedOrigins.some(allowed => {
          if (allowed.includes('*')) {
            const pattern = allowed.replace(/\*/g, '.*');
            return new RegExp(`^${pattern}$`).test(origin);
          }
          return false;
        });
        
        if (isAllowed) {
          return callback(null, true);
        }
        
        console.warn(`🚨 CORS blocked origin: ${origin}`);
        this.securityMetrics.blockedRequests++;
        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      }
    });
  }
  
  // Get allowed origins list
  getAllowedOrigins() {
    const origins = this.options.cors.origin;
    
    if (typeof origins === 'string') {
      return origins.split(',').map(o => o.trim());
    }
    
    if (Array.isArray(origins)) {
      return origins;
    }
    
    if (origins === true) {
      return ['*'];
    }
    
    return [];
  }
  
  // Create Helmet security middleware
  createHelmetMiddleware() {
    return helmet(this.options.helmet);
  }
  
  // Create input validation middleware
  createValidationMiddleware(schema = 'apiRequest') {
    return (req, res, next) => {
      try {
        const validationSchema = this.schemas[schema];
        
        if (!validationSchema) {
          throw new Error(`Unknown validation schema: ${schema}`);
        }
        
        // Validate different parts of the request
        const validationTargets = {
          query: req.query,
          body: req.body,
          params: req.params
        };
        
        // Combine all request data for validation
        const requestData = {
          ...req.query,
          ...req.body,
          ...req.params
        };
        
        const validatedData = validationSchema.parse(requestData);
        
        // Attach validated data to request
        req.validated = validatedData;
        
        next();
      } catch (error) {
        this.securityMetrics.validationFailures++;
        console.warn(`⚠️ Input validation failed:`, error.message);
        
        res.status(400).json({
          error: 'Invalid input data',
          details: error.errors || [error.message],
          type: 'validation_error'
        });
      }
    };
  }
  
  // Create JWT authentication middleware
  createAuthMiddleware(options = {}) {
    const config = {
      required: options.required !== false,
      skipPaths: options.skipPaths || ['/health', '/metrics', '/'],
      ...options
    };
    
    return (req, res, next) => {
      // Skip authentication for certain paths
      if (config.skipPaths.includes(req.path)) {
        return next();
      }
      
      const token = this.extractTokenFromRequest(req);
      
      if (!token) {
        if (config.required) {
          this.securityMetrics.authenticationFailures++;
          return res.status(401).json({
            error: 'Authentication required',
            message: 'No token provided',
            type: 'authentication_error'
          });
        }
        return next();
      }
      
      try {
        const decoded = jwt.verify(token, this.options.jwt.secret, {
          issuer: this.options.jwt.issuer,
          audience: this.options.jwt.audience
        });
        
        req.user = decoded;
        req.authenticated = true;
        
        next();
      } catch (error) {
        this.securityMetrics.authenticationFailures++;
        console.warn(`⚠️ JWT verification failed:`, error.message);
        
        res.status(401).json({
          error: 'Invalid token',
          message: error.message,
          type: 'authentication_error'
        });
      }
    };
  }
  
  // Extract token from request
  extractTokenFromRequest(req) {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Check query parameter
    if (req.query.token) {
      return req.query.token;
    }
    
    // Check cookies
    if (req.cookies && req.cookies.token) {
      return req.cookies.token;
    }
    
    return null;
  }
  
  // Generate JWT token
  generateToken(payload, options = {}) {
    const tokenPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      jti: crypto.randomBytes(16).toString('hex') // Unique token ID
    };
    
    return jwt.sign(tokenPayload, this.options.jwt.secret, {
      expiresIn: options.expiresIn || this.options.jwt.expiresIn,
      issuer: this.options.jwt.issuer,
      audience: this.options.jwt.audience
    });
  }
  
  // Create comprehensive security middleware stack
  createSecurityStack(options = {}) {
    const middlewares = [];
    
    // Add Helmet security headers
    middlewares.push(this.createHelmetMiddleware());
    
    // Add CORS protection
    middlewares.push(this.createCorsMiddleware());
    
    // Add rate limiting
    middlewares.push(this.createRateLimiter(options.rateLimit));
    
    // Add request size limits
    middlewares.push(this.createRequestSizeLimiter());
    
    // Add security headers
    middlewares.push(this.createCustomSecurityHeaders());
    
    // Add request logging for security monitoring
    middlewares.push(this.createSecurityLoggingMiddleware());
    
    return middlewares;
  }
  
  // Create request size limiter
  createRequestSizeLimiter() {
    return (req, res, next) => {
      const maxBodySize = this.parseSize(this.options.validation.maxBodySize);
      const maxUrlLength = this.options.validation.maxUrlLength;
      const maxHeaderSize = this.parseSize(this.options.validation.maxHeaderSize);
      
      // Check URL length
      if (req.url.length > maxUrlLength) {
        this.securityMetrics.blockedRequests++;
        return res.status(414).json({
          error: 'URL too long',
          maxLength: maxUrlLength,
          type: 'request_too_large'
        });
      }
      
      // Check header size
      const headerSize = JSON.stringify(req.headers).length;
      if (headerSize > maxHeaderSize) {
        this.securityMetrics.blockedRequests++;
        return res.status(431).json({
          error: 'Request header fields too large',
          maxSize: this.options.validation.maxHeaderSize,
          type: 'request_too_large'
        });
      }
      
      // Check content length
      const contentLength = parseInt(req.headers['content-length'] || '0');
      if (contentLength > maxBodySize) {
        this.securityMetrics.blockedRequests++;
        return res.status(413).json({
          error: 'Request entity too large',
          maxSize: this.options.validation.maxBodySize,
          type: 'request_too_large'
        });
      }
      
      next();
    };
  }
  
  // Parse size string to bytes
  parseSize(size) {
    if (typeof size === 'number') return size;
    
    const units = {
      b: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024
    };
    
    const match = size.toLowerCase().match(/^(\d+)([a-z]+)$/);
    if (!match) return 0;
    
    const [, num, unit] = match;
    return parseInt(num) * (units[unit] || 1);
  }
  
  // Create custom security headers middleware
  createCustomSecurityHeaders() {
    return (req, res, next) => {
      // Add custom security headers
      res.setHeader('X-Server-Version', 'LLM-Ultra-2.1.0');
      res.setHeader('X-Security-Level', 'Military-Grade');
      res.setHeader('X-Request-ID', crypto.randomUUID());
      res.setHeader('X-Rate-Limit-Policy', 'Adaptive');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      next();
    };
  }
  
  // Create security logging middleware
  createSecurityLoggingMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Log security-relevant request information
      const securityLog = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        origin: req.headers.origin,
        authenticated: !!req.headers.authorization,
        contentType: req.headers['content-type'],
        contentLength: req.headers['content-length'] || 0
      };
      
      // Detect suspicious patterns
      if (this.isSuspiciousRequest(req)) {
        console.warn('🚨 Suspicious request detected:', securityLog);
        this.securityMetrics.suspiciousActivityDetected++;
      }
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        // Log security events
        if (res.statusCode >= 400) {
          console.warn(`⚠️ Security event - ${res.statusCode}:`, {
            ...securityLog,
            statusCode: res.statusCode,
            duration
          });
        }
      });
      
      next();
    };
  }
  
  // Detect suspicious request patterns
  isSuspiciousRequest(req) {
    const suspiciousPatterns = [
      // SQL injection patterns
      /('|(\-\-)|;|\||\*|%|\?|\.|\[|\]|\{|\}|\^|\$|\+|\(|\)|=|!|>|<|&)/,
      // XSS patterns
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      // Path traversal patterns
      /\.\.\//,
      /\.\.\\\\|\.\.\\/,
      // Command injection patterns
      /[;&|`$]/,
      // Common attack strings
      /(union|select|insert|delete|drop|create|alter|exec|execute)/gi
    ];
    
    const testString = `${req.url} ${JSON.stringify(req.query)} ${JSON.stringify(req.body)}`;
    
    return suspiciousPatterns.some(pattern => pattern.test(testString));
  }
  
  // Check if request is from internal source
  isInternalRequest(req) {
    const internalIPs = ['127.0.0.1', '::1', '10.', '192.168.', '172.16.'];
    return internalIPs.some(ip => req.ip.startsWith(ip));
  }
  
  // Get security metrics
  getSecurityMetrics() {
    const uptime = Math.floor((Date.now() - this.securityMetrics.startTime) / 1000);
    
    return {
      uptime,
      ...this.securityMetrics,
      rates: {
        blockedRequestsPerMinute: uptime > 0 ? (this.securityMetrics.blockedRequests / (uptime / 60)).toFixed(2) : 0,
        authFailuresPerMinute: uptime > 0 ? (this.securityMetrics.authenticationFailures / (uptime / 60)).toFixed(2) : 0,
        validationFailuresPerMinute: uptime > 0 ? (this.securityMetrics.validationFailures / (uptime / 60)).toFixed(2) : 0
      }
    };
  }
  
  // Reset security metrics
  resetMetrics() {
    this.securityMetrics = {
      blockedRequests: 0,
      rateLimitedRequests: 0,
      authenticationFailures: 0,
      validationFailures: 0,
      suspiciousActivityDetected: 0,
      startTime: Date.now()
    };
  }
}

export default SecurityMiddleware;