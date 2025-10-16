/**
 * Unified Proxy Configuration Module
 * Supports both CommonJS (require) and ESM (import) for maximum compatibility
 * Cross-platform configuration for obfuscation proxy
 */

import os from 'os';
import path from 'path';
import { createRequire } from 'module';

// Support for CommonJS require in ESM
const require = createRequire(import.meta.url);

class ProxyConfig {
  constructor() {
    this.platform = os.platform();
    this.configDir = this.getConfigDirectory();
    this.cache = new Map(); // Performance optimization - config caching
  }

  /**
   * Get platform-specific configuration directory (optimized with caching)
   */
  getConfigDirectory() {
    if (this.cache.has('configDir')) {
      return this.cache.get('configDir');
    }

    let configDir;
    switch (this.platform) {
      case 'win32':
        configDir = path.join(process.env.APPDATA || '', 'ObfuscationProxy');
        break;
      case 'darwin':
        configDir = path.join(os.homedir(), 'Library', 'Application Support', 'ObfuscationProxy');
        break;
      case 'linux':
      case 'android':
        configDir = path.join(os.homedir(), '.obfuscation-proxy');
        break;
      default:
        configDir = path.join(os.homedir(), '.obfuscation-proxy');
    }
    
    this.cache.set('configDir', configDir);
    return configDir;
  }

  /**
   * Default configuration optimized for performance and circumvention
   */
  getDefaultConfig() {
    if (this.cache.has('defaultConfig')) {
      return this.cache.get('defaultConfig');
    }

    const defaultConfig = {
      // Basic proxy settings
      port: 8080,
      host: '127.0.0.1', // Secure default, override to 0.0.0.0 for multi-device

      // Obfuscation settings (optimized)
      obfuscationKey: null, // Auto-generated if not provided
      simulateChrome: true,
      enableLogging: process.env.NODE_ENV !== 'production',

      // Performance settings (enhanced)
      maxConnections: 200, // Increased from 100
      connectionTimeout: 30000, // 30 seconds
      requestTimeout: 60000, // 60 seconds
      keepAliveTimeout: 5000, // Keep-alive optimization
      maxSockets: 50, // Connection pooling

      // Security settings (hardened)
      allowedOrigins: [], // Secure default - no origins allowed
      blockList: [], // List of blocked domains
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // Limit each IP to 100 requests per windowMs
      },

      // Chrome simulation headers (latest Chrome 120)
      chromeHeaders: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        acceptLanguage: 'en-US,en;q=0.9',
        acceptEncoding: 'gzip, deflate, br, zstd', // Added zstd for latest Chrome
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        secChUa: '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        secChUaMobile: '?0',
        secChUaPlatform: '"Windows"',
        secFetchDest: 'document',
        secFetchMode: 'navigate',
        secFetchSite: 'none',
        secFetchUser: '?1'
      },

      // Platform-specific settings
      platform: {
        windows: {
          autoStart: false,
          systemProxy: false,
          processAffinity: 'auto' // CPU core optimization
        },
        macos: {
          autoStart: false,
          systemProxy: false,
          processAffinity: 'auto'
        },
        linux: {
          autoStart: false,
          systemProxy: false,
          processAffinity: 'auto'
        },
        android: {
          wifiOnly: false,
          batteryOptimization: true,
          lowMemoryMode: true
        },
        ios: {
          wifiOnly: false,
          backgroundMode: true,
          lowMemoryMode: true
        },
      },

      // Advanced obfuscation settings (enhanced)
      obfuscation: {
        enabled: true,
        algorithm: 'chacha20-poly1305', // Upgraded from XOR
        keyRotationInterval: 500, // Faster rotation
        randomPadding: true,
        mimicProtocol: 'https',
        headerObfuscation: true, // New feature
        payloadScrambling: true // New feature
      },

      // Traffic shaping (optimized)
      trafficShaping: {
        enabled: true,
        minDelay: 5, // Reduced for better performance
        maxDelay: 50, // Reduced for better performance
        burstLimit: 20, // Increased burst capacity
        randomizeTimings: true,
        adaptiveShaping: true // New adaptive feature
      },

      // DNS settings (enhanced)
      dns: {
        servers: [
          '1.1.1.1', '1.0.0.1', // Cloudflare (fastest)
          '8.8.8.8', '8.8.4.4', // Google
          '9.9.9.9', '149.112.112.112' // Quad9 (security focused)
        ],
        dohEnabled: true, // Enable DNS over HTTPS by default
        cacheTTL: 600, // 10 minutes (increased)
        failover: true, // Auto-failover between servers
        parallelQueries: true // Query multiple servers in parallel
      },

      // Monitoring and metrics (new)
      monitoring: {
        enabled: true,
        metricsInterval: 30000, // 30 seconds
        healthChecks: true,
        performanceLogging: process.env.NODE_ENV !== 'production'
      }
    };

    this.cache.set('defaultConfig', defaultConfig);
    return defaultConfig;
  }

  /**
   * Get platform-specific configuration (cached)
   */
  getPlatformConfig() {
    const cacheKey = `platformConfig_${this.platform}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const config = this.getDefaultConfig();
    const platformSettings = config.platform[this.platform] || config.platform.linux;

    const platformConfig = {
      ...config,
      ...platformSettings,
      platform: this.platform,
      configDir: this.configDir,
    };

    this.cache.set(cacheKey, platformConfig);
    return platformConfig;
  }

  /**
   * Enhanced configuration validation with detailed error reporting
   */
  validate(config) {
    const errors = [];
    const warnings = [];

    // Port validation
    if (!config.port || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
      errors.push('Invalid port number: must be an integer between 1 and 65535');
    }

    // Host validation
    if (!config.host || typeof config.host !== 'string') {
      errors.push('Host is required and must be a valid string');
    }

    // Connection limits
    if (config.maxConnections && (!Number.isInteger(config.maxConnections) || config.maxConnections < 1)) {
      errors.push('maxConnections must be a positive integer');
    }

    // Security checks
    if (config.host === '0.0.0.0' && process.env.NODE_ENV === 'production') {
      warnings.push('Host 0.0.0.0 in production may expose proxy to external access');
    }

    if (config.allowedOrigins && config.allowedOrigins.includes('*')) {
      warnings.push('Wildcard origin (*) allows all domains - consider restricting');
    }

    // Performance validation
    if (config.connectionTimeout && config.connectionTimeout < 5000) {
      warnings.push('connectionTimeout below 5 seconds may cause connection issues');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Smart configuration merging with validation
   */
  mergeConfig(userConfig = {}) {
    const defaultConfig = this.getPlatformConfig();
    
    const merged = {
      ...defaultConfig,
      ...userConfig,
      chromeHeaders: {
        ...defaultConfig.chromeHeaders,
        ...(userConfig.chromeHeaders || {}),
      },
      obfuscation: {
        ...defaultConfig.obfuscation,
        ...(userConfig.obfuscation || {}),
      },
      trafficShaping: {
        ...defaultConfig.trafficShaping,
        ...(userConfig.trafficShaping || {}),
      },
      dns: {
        ...defaultConfig.dns,
        ...(userConfig.dns || {}),
      },
      monitoring: {
        ...defaultConfig.monitoring,
        ...(userConfig.monitoring || {}),
      }
    };

    // Auto-optimize based on environment
    if (process.env.NODE_ENV === 'production') {
      merged.enableLogging = false;
      merged.monitoring.performanceLogging = false;
    }

    return merged;
  }

  /**
   * Enhanced preset configurations for different scenarios
   */
  getPresetConfig(preset) {
    const baseConfig = this.getDefaultConfig();
    const cacheKey = `preset_${preset}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const presets = {
      // Ultra-stealth configuration
      stealth: {
        ...baseConfig,
        simulateChrome: true,
        enableLogging: false,
        obfuscation: {
          ...baseConfig.obfuscation,
          enabled: true,
          algorithm: 'chacha20-poly1305',
          randomPadding: true,
          keyRotationInterval: 250, // Very frequent rotation
          headerObfuscation: true,
          payloadScrambling: true
        },
        trafficShaping: {
          ...baseConfig.trafficShaping,
          enabled: true,
          randomizeTimings: true,
          adaptiveShaping: true,
          minDelay: 20,
          maxDelay: 200
        },
        dns: {
          ...baseConfig.dns,
          dohEnabled: true,
          parallelQueries: false // Sequential for stealth
        }
      },

      // High-performance configuration
      performance: {
        ...baseConfig,
        simulateChrome: true,
        maxConnections: 500, // Much higher
        connectionTimeout: 10000, // Shorter timeout
        keepAliveTimeout: 2000,
        maxSockets: 100,
        obfuscation: {
          ...baseConfig.obfuscation,
          enabled: true,
          algorithm: 'xor-rotation', // Faster algorithm
          randomPadding: false,
          keyRotationInterval: 2000 // Less frequent
        },
        trafficShaping: {
          ...baseConfig.trafficShaping,
          enabled: false, // Disabled for max speed
        },
        dns: {
          ...baseConfig.dns,
          parallelQueries: true,
          cacheTTL: 3600 // Longer caching
        }
      },

      // Development/testing configuration
      development: {
        ...baseConfig,
        port: 8888,
        host: '127.0.0.1',
        enableLogging: true,
        simulateChrome: false,
        obfuscation: {
          ...baseConfig.obfuscation,
          enabled: false,
        },
        trafficShaping: {
          ...baseConfig.trafficShaping,
          enabled: false,
        },
        monitoring: {
          ...baseConfig.monitoring,
          enabled: true,
          performanceLogging: true,
          metricsInterval: 10000 // More frequent in dev
        }
      },

      // Low-resource configuration (for mobile/embedded)
      minimal: {
        ...baseConfig,
        maxConnections: 50,
        connectionTimeout: 20000,
        maxSockets: 20,
        obfuscation: {
          ...baseConfig.obfuscation,
          enabled: true,
          algorithm: 'xor-rotation',
          randomPadding: false,
          keyRotationInterval: 5000
        },
        trafficShaping: {
          ...baseConfig.trafficShaping,
          enabled: true,
          minDelay: 10,
          maxDelay: 100,
          burstLimit: 5
        },
        dns: {
          ...baseConfig.dns,
          servers: ['1.1.1.1', '8.8.8.8'], // Only 2 servers
          parallelQueries: false,
          cacheTTL: 300
        },
        monitoring: {
          enabled: false,
          metricsInterval: 60000,
          healthChecks: true,
          performanceLogging: false
        }
      }
    };

    const config = presets[preset] || baseConfig;
    this.cache.set(cacheKey, config);
    return config;
  }

  /**
   * Performance optimization: Clear cache when needed
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export for both CommonJS and ESM compatibility
const ProxyConfigInstance = new ProxyConfig();

// ESM export (default)
export default ProxyConfig;
export { ProxyConfig };

// CommonJS export for backward compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProxyConfig;
  module.exports.default = ProxyConfig;
  module.exports.ProxyConfig = ProxyConfig;
}

// Global registration for require() compatibility in mixed environments
if (typeof globalThis !== 'undefined') {
  globalThis.ProxyConfig = ProxyConfig;
}