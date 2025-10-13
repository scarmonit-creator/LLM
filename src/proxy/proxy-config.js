/**
 * Proxy Configuration Module
 * Cross-platform configuration for obfuscation proxy
 * Inspired by XX-Net's multi-platform support
 */

const os = require('os');
const path = require('path');

class ProxyConfig {
  constructor() {
    this.platform = os.platform();
    this.configDir = this.getConfigDirectory();
  }

  /**
   * Get platform-specific configuration directory
   */
  getConfigDirectory() {
    switch (this.platform) {
      case 'win32':
        return path.join(process.env.APPDATA || '', 'ObfuscationProxy');
      case 'darwin':
        return path.join(os.homedir(), 'Library', 'Application Support', 'ObfuscationProxy');
      case 'linux':
      case 'android':
        return path.join(os.homedir(), '.obfuscation-proxy');
      default:
        return path.join(os.homedir(), '.obfuscation-proxy');
    }
  }

  /**
   * Default configuration optimized for circumvention
   */
  getDefaultConfig() {
    return {
      // Basic proxy settings
      port: 8080,
      host: '0.0.0.0', // Allow connections from all network interfaces for multi-device support
      
      // Obfuscation settings
      obfuscationKey: null, // Auto-generated if not provided
      simulateChrome: true,
      enableLogging: true,
      
      // Performance settings
      maxConnections: 100,
      connectionTimeout: 30000, // 30 seconds
      requestTimeout: 60000, // 60 seconds
      
      // Security settings
      allowedOrigins: ['*'], // Allow all origins by default
      blockList: [], // List of blocked domains
      
      // Chrome simulation headers (updated for latest Chrome)
      chromeHeaders: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        acceptLanguage: 'en-US,en;q=0.9',
        acceptEncoding: 'gzip, deflate, br',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        secChUa: '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        secChUaMobile: '?0',
        secChUaPlatform: '"Windows"'
      },
      
      // Platform-specific settings
      platform: {
        windows: {
          autoStart: false,
          systemProxy: false
        },
        macos: {
          autoStart: false,
          systemProxy: false
        },
        linux: {
          autoStart: false,
          systemProxy: false
        },
        android: {
          wifiOnly: false,
          batteryOptimization: true
        },
        ios: {
          wifiOnly: false,
          backgroundMode: true
        }
      },
      
      // Advanced obfuscation settings
      obfuscation: {
        enabled: true,
        algorithm: 'xor-rotation', // XOR with key rotation
        keyRotationInterval: 1000, // Rotate key every 1000 bytes
        randomPadding: true, // Add random padding to make traffic patterns irregular
        mimicProtocol: 'https' // Mimic HTTPS traffic patterns
      },
      
      // Traffic shaping to avoid detection
      trafficShaping: {
        enabled: true,
        minDelay: 10, // Minimum delay between requests (ms)
        maxDelay: 100, // Maximum delay between requests (ms)
        burstLimit: 10, // Maximum burst of requests
        randomizeTimings: true // Randomize request timings
      },
      
      // DNS settings
      dns: {
        servers: ['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1'],
        dohEnabled: false, // DNS over HTTPS
        cacheTTL: 300 // 5 minutes
      }
    };
  }

  /**
   * Get platform-specific configuration
   */
  getPlatformConfig() {
    const config = this.getDefaultConfig();
    const platformSettings = config.platform[this.platform] || {};
    
    return {
      ...config,
      ...platformSettings,
      platform: this.platform,
      configDir: this.configDir
    };
  }

  /**
   * Validate configuration
   */
  validateConfig(config) {
    const errors = [];
    
    if (!config.port || config.port < 1 || config.port > 65535) {
      errors.push('Invalid port number');
    }
    
    if (!config.host) {
      errors.push('Host is required');
    }
    
    if (config.maxConnections && config.maxConnections < 1) {
      errors.push('maxConnections must be at least 1');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Merge user config with defaults
   */
  mergeConfig(userConfig = {}) {
    const defaultConfig = this.getPlatformConfig();
    
    return {
      ...defaultConfig,
      ...userConfig,
      chromeHeaders: {
        ...defaultConfig.chromeHeaders,
        ...(userConfig.chromeHeaders || {})
      },
      obfuscation: {
        ...defaultConfig.obfuscation,
        ...(userConfig.obfuscation || {})
      },
      trafficShaping: {
        ...defaultConfig.trafficShaping,
        ...(userConfig.trafficShaping || {})
      },
      dns: {
        ...defaultConfig.dns,
        ...(userConfig.dns || {})
      }
    };
  }

  /**
   * Get recommended configuration for different use cases
   */
  getPresetConfig(preset) {
    const baseConfig = this.getDefaultConfig();
    
    const presets = {
      // Maximum stealth configuration
      stealth: {
        ...baseConfig,
        simulateChrome: true,
        enableLogging: false,
        obfuscation: {
          ...baseConfig.obfuscation,
          enabled: true,
          randomPadding: true,
          keyRotationInterval: 500
        },
        trafficShaping: {
          ...baseConfig.trafficShaping,
          enabled: true,
          randomizeTimings: true
        }
      },
      
      // Performance-optimized configuration
      performance: {
        ...baseConfig,
        simulateChrome: true,
        maxConnections: 200,
        connectionTimeout: 15000,
        obfuscation: {
          ...baseConfig.obfuscation,
          enabled: true,
          randomPadding: false
        },
        trafficShaping: {
          ...baseConfig.trafficShaping,
          enabled: false
        }
      },
      
      // Development/testing configuration
      development: {
        ...baseConfig,
        port: 8888,
        enableLogging: true,
        simulateChrome: false,
        obfuscation: {
          ...baseConfig.obfuscation,
          enabled: false
        },
        trafficShaping: {
          ...baseConfig.trafficShaping,
          enabled: false
        }
      }
    };
    
    return presets[preset] || baseConfig;
  }
}

module.exports = ProxyConfig;
