import { z } from 'zod';

/**
 * Comprehensive Input Validator
 * Validates and sanitizes all user inputs to prevent injection attacks
 */
export class InputValidator {
  private static readonly MAX_STRING_LENGTH = 10000;
  private static readonly MAX_ARRAY_LENGTH = 1000;
  private static readonly MAX_OBJECT_KEYS = 100;

  // Common validation schemas
  public static readonly schemas = {
    email: z.string().email().max(254),
    url: z.string().url().max(2048),
    uuid: z.string().uuid(),
    alphanumeric: z.string().regex(/^[a-zA-Z0-9]+$/),
    safeString: z.string().max(this.MAX_STRING_LENGTH).refine(
      (val) => this.isSafeString(val),
      { message: 'String contains potentially unsafe content' }
    ),
    positiveInt: z.number().int().positive(),
    sqlSafeString: z.string().refine(
      (val) => this.isSQLSafe(val),
      { message: 'String contains potential SQL injection patterns' }
    )
  };

  // XSS Prevention
  public static sanitizeHTML(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // Remove dangerous script content
  public static removeScripts(input: string): string {
    return input
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/data:text\/html/gi, '');
  }

  // SQL Injection Prevention
  public static isSQLSafe(input: string): boolean {
    const dangerousPatterns = [
      /('|(\-\-)|(;)|(\|)|(\*))/, // Basic SQL injection patterns
      /(union|select|insert|update|delete|drop|create|alter|exec|execute)\s/i,
      /\b(or|and)\s+\d+\s*=\s*\d+/i, // OR/AND 1=1 patterns
      /\b(or|and)\s+['"]\w+['"]\s*=\s*['"]\w+['"]/i
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(input));
  }

  // General string safety check
  public static isSafeString(input: string): boolean {
    const unsafePatterns = [
      /<script/i,
      /javascript:/i,
      /data:text\/html/i,
      /vbscript:/i,
      /on\w+\s*=/i,
      /\${.*}/,  // Template literal injection
      /<%.*%>/,   // Template injection
      /{{.*}}/    // Mustache template injection
    ];
    
    return !unsafePatterns.some(pattern => pattern.test(input));
  }

  // Validate and sanitize object recursively
  public static sanitizeObject(obj: any, maxDepth: number = 10): any {
    if (maxDepth <= 0) {
      throw new Error('Maximum object depth exceeded');
    }

    if (typeof obj === 'string') {
      if (obj.length > this.MAX_STRING_LENGTH) {
        throw new Error('String length exceeds maximum allowed');
      }
      return this.removeScripts(obj);
    }

    if (Array.isArray(obj)) {
      if (obj.length > this.MAX_ARRAY_LENGTH) {
        throw new Error('Array length exceeds maximum allowed');
      }
      return obj.map(item => this.sanitizeObject(item, maxDepth - 1));
    }

    if (typeof obj === 'object' && obj !== null) {
      const keys = Object.keys(obj);
      if (keys.length > this.MAX_OBJECT_KEYS) {
        throw new Error('Object has too many keys');
      }

      const sanitized: any = {};
      for (const key of keys) {
        const sanitizedKey = this.removeScripts(key);
        sanitized[sanitizedKey] = this.sanitizeObject(obj[key], maxDepth - 1);
      }
      return sanitized;
    }

    return obj;
  }

  // Path traversal prevention
  public static isPathSafe(path: string): boolean {
    const dangerousPatterns = [
      /\.\./,           // Parent directory traversal
      /^\/[a-zA-Z]:/,  // Windows absolute path
      /^[a-zA-Z]:\\/,  // Windows drive path
      /\0/,            // Null byte
      /[<>:"|?*]/      // Invalid filename characters
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(path));
  }

  // Command injection prevention
  public static isCommandSafe(command: string): boolean {
    const dangerousPatterns = [
      /[;&|`$]/,                    // Command separators and substitution
      /\$\([^)]*\)/,               // Command substitution
      /`[^`]*`/,                   // Backtick command substitution
      /(^|\s)(rm|del|format|sudo|su|chmod|chown)\s/i,  // Dangerous commands
      /\\n/,                       // Newline escape
      /exec|eval|system|passthru/i  // Code execution functions
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(command));
  }

  // Validate API key format
  public static validateAPIKey(key: string): boolean {
    // API keys should be alphanumeric with specific length
    return /^[a-zA-Z0-9_-]{32,128}$/.test(key);
  }

  // Email validation with additional security checks
  public static validateEmail(email: string): boolean {
    try {
      this.schemas.email.parse(email);
      
      // Additional checks for email security
      const localPart = email.split('@')[0];
      
      // Prevent email injection
      if (localPart.includes('\n') || localPart.includes('\r')) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  // Create validation middleware for Express
  public static createValidationMiddleware(schema: z.ZodSchema) {
    return (req: any, res: any, next: any) => {
      try {
        // Sanitize request body
        if (req.body) {
          req.body = this.sanitizeObject(req.body);
        }
        
        // Validate with schema
        const validated = schema.parse(req.body);
        req.body = validated;
        
        next();
      } catch (error) {
        res.status(400).json({
          success: false,
          error: 'Invalid input data',
          details: error instanceof z.ZodError ? error.errors : undefined
        });
      }
    };
  }
}
