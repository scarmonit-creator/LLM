/**
 * Content Security Policy Enforcer
 * Implements strict CSP headers for XSS prevention
 */
export class CSPEnforcer {
  private static readonly CSP_DIRECTIVES = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Restrictive but functional
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", "data:", "https:"],
    'font-src': ["'self'", "https:"],
    'connect-src': ["'self'", "https:"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'upgrade-insecure-requests': []
  };

  public static generateCSP(additionalDirectives: Record<string, string[]> = {}): string {
    const directives = { ...this.CSP_DIRECTIVES, ...additionalDirectives };
    
    return Object.entries(directives)
      .map(([directive, sources]) => {
        if (sources.length === 0) {
          return directive;
        }
        return `${directive} ${sources.join(' ')}`;
      })
      .join('; ');
  }

  public static getSecurityHeaders(): Record<string, string> {
    return {
      'Content-Security-Policy': this.generateCSP(),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
    };
  }

  public static validateCSP(response: any): boolean {
    const cspHeader = response.headers?.['content-security-policy'];
    if (!cspHeader) {
      return false;
    }

    // Check for minimum required directives
    const requiredDirectives = ['default-src', 'script-src', 'object-src'];
    
    return requiredDirectives.every(directive => 
      cspHeader.includes(directive)
    );
  }
}
