#!/usr/bin/env node

/**
 * Proxy Server - XX-Net Inspired Obfuscation Proxy
 * Integrated with LLM application for secure API requests
 * 
 * Features:
 * - HTTP/HTTPS proxy with traffic obfuscation
 * - Chrome browser behavior simulation
 * - Cross-platform support (Windows, macOS, Linux, Android, iOS)
 * - Multi-device connection support
 * - Configurable obfuscation algorithms
 * 
 * Usage:
 *   node proxy-server.js [options]
 *   
 * Options:
 *   --port <port>         Proxy port (default: 8080)
 *   --host <host>         Proxy host (default: 0.0.0.0)
 *   --config <file>       Configuration file path
 *   --preset <preset>     Use preset config: stealth, performance, development
 *   --no-obfuscation      Disable traffic obfuscation
 *   --no-chrome           Disable Chrome simulation
 */

const ObfuscationProxy = require('./obfuscation-proxy');
const ProxyConfig = require('./proxy-config');
const path = require('path');
const fs = require('fs');

class ProxyServer {
  constructor(options = {}) {
    this.options = options;
    this.proxyConfig = new ProxyConfig();
    this.proxy = null;
    this.config = null;
  }

  /**
   * Initialize and start the proxy server
   */
  async start() {
    try {
      // Load configuration
      this.config = this.loadConfiguration();
      
      console.log('\n🚀 Starting XX-Net Inspired Obfuscation Proxy...');
      console.log('━'.repeat(60));
      console.log(`Platform: ${process.platform}`);
      console.log(`Node Version: ${process.version}`);
      console.log('━'.repeat(60));
      
      // Create proxy instance
      this.proxy = new ObfuscationProxy(this.config);
      
      // Start the proxy
      await this.proxy.start();
      
      console.log('\n✅ Proxy Server Started Successfully!');
      console.log('━'.repeat(60));
      console.log(`🌐 Proxy Address: http://${this.config.host}:${this.config.port}`);
      console.log(`🔐 Obfuscation: ${this.config.obfuscation?.enabled ? 'Enabled' : 'Disabled'}`);
      console.log(`🌍 Chrome Simulation: ${this.config.simulateChrome ? 'Enabled' : 'Disabled'}`);
      console.log(`📱 Multi-device Support: ${this.config.host === '0.0.0.0' ? 'Enabled' : 'Disabled'}`);
      console.log('━'.repeat(60));
      
      // Display configuration instructions
      this.displayInstructions();
      
      // Setup signal handlers for graceful shutdown
      this.setupSignalHandlers();
      
      // Display statistics periodically
      if (this.config.enableLogging) {
        this.startStatsMonitor();
      }
      
    } catch (error) {
      console.error('\n❌ Failed to start proxy server:', error);
      process.exit(1);
    }
  }

  /**
   * Load configuration from file or use defaults
   */
  loadConfiguration() {
    let config;
    
    // Check if preset is specified
    if (this.options.preset) {
      console.log(`📋 Using preset configuration: ${this.options.preset}`);
      config = this.proxyConfig.getPresetConfig(this.options.preset);
    }
    // Check if config file is specified
    else if (this.options.config) {
      console.log(`📋 Loading configuration from: ${this.options.config}`);
      try {
        const configFile = fs.readFileSync(this.options.config, 'utf8');
        const userConfig = JSON.parse(configFile);
        config = this.proxyConfig.mergeConfig(userConfig);
      } catch (error) {
        console.warn(`⚠️  Failed to load config file: ${error.message}`);
        console.log('📋 Using default configuration');
        config = this.proxyConfig.getPlatformConfig();
      }
    }
    // Use platform-specific defaults
    else {
      console.log('📋 Using platform-specific default configuration');
      config = this.proxyConfig.getPlatformConfig();
    }
    
    // Override with command-line options
    if (this.options.port) {
      config.port = parseInt(this.options.port);
    }
    if (this.options.host) {
      config.host = this.options.host;
    }
    if (this.options.noObfuscation) {
      config.obfuscation = { ...config.obfuscation, enabled: false };
    }
    if (this.options.noChrome) {
      config.simulateChrome = false;
    }
    
    // Validate configuration
    const validation = this.proxyConfig.validateConfig(config);
    if (!validation.valid) {
      console.error('\n❌ Invalid configuration:');
      validation.errors.forEach(err => console.error(`  • ${err}`));
      process.exit(1);
    }
    
    return config;
  }

  /**
   * Display proxy configuration instructions
   */
  displayInstructions() {
    console.log('\n📖 Configuration Instructions:');
    console.log('━'.repeat(60));
    console.log('\n1. Configure your browser or application to use this proxy:');
    console.log(`   • HTTP Proxy: ${this.config.host}:${this.config.port}`);
    console.log(`   • HTTPS Proxy: ${this.config.host}:${this.config.port}`);
    
    console.log('\n2. For system-wide proxy (optional):');
    
    switch (process.platform) {
      case 'win32':
        console.log('   Windows:');
        console.log('   • Settings > Network & Internet > Proxy');
        console.log('   • Set manual proxy: localhost:' + this.config.port);
        break;
        
      case 'darwin':
        console.log('   macOS:');
        console.log('   • System Preferences > Network > Advanced > Proxies');
        console.log('   • Enable Web Proxy (HTTP) and Secure Web Proxy (HTTPS)');
        console.log('   • Set server: localhost, port: ' + this.config.port);
        break;
        
      case 'linux':
        console.log('   Linux:');
        console.log('   • export http_proxy=http://localhost:' + this.config.port);
        console.log('   • export https_proxy=http://localhost:' + this.config.port);
        break;
    }
    
    console.log('\n3. For LLM API integration:');
    console.log('   • Set HTTP_PROXY and HTTPS_PROXY environment variables');
    console.log('   • Or configure proxy in your API client');
    
    console.log('\n4. Test the proxy:');
    console.log('   • curl -x http://localhost:' + this.config.port + ' https://api.openai.com');
    console.log('━'.repeat(60));
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    const shutdown = async (signal) => {
      console.log(`\n\n⚠️  Received ${signal}, shutting down gracefully...`);
      
      if (this.proxy) {
        await this.proxy.stop();
      }
      
      console.log('✅ Proxy server stopped successfully');
      process.exit(0);
    };
    
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  /**
   * Start statistics monitor
   */
  startStatsMonitor() {
    setInterval(() => {
      if (this.proxy) {
        const stats = this.proxy.getStats();
        console.log('\n📊 Statistics:');
        console.log(`   • Total Requests: ${stats.requests}`);
        console.log(`   • Active Connections: ${stats.activeConnections}`);
        console.log(`   • Bytes Transferred: ${this.formatBytes(stats.bytesTransferred)}`);
        console.log(`   • Uptime: ${this.formatUptime(stats.uptime)}`);
      }
    }, 60000); // Display stats every minute
  }

  /**
   * Format bytes for display
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format uptime for display
   */
  formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${hours}h ${minutes}m ${secs}s`;
  }
}

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--port':
        options.port = args[++i];
        break;
      case '--host':
        options.host = args[++i];
        break;
      case '--config':
        options.config = args[++i];
        break;
      case '--preset':
        options.preset = args[++i];
        break;
      case '--no-obfuscation':
        options.noObfuscation = true;
        break;
      case '--no-chrome':
        options.noChrome = true;
        break;
      case '--help':
      case '-h':
        console.log(`
XX-Net Inspired Obfuscation Proxy Server

Usage: node proxy-server.js [options]

Options:
  --port <port>         Proxy port (default: 8080)
  --host <host>         Proxy host (default: 0.0.0.0)
  --config <file>       Configuration file path
  --preset <preset>     Use preset config: stealth, performance, development
  --no-obfuscation      Disable traffic obfuscation
  --no-chrome           Disable Chrome simulation
  --help, -h            Show this help message

Examples:
  node proxy-server.js
  node proxy-server.js --port 9090
  node proxy-server.js --preset stealth
  node proxy-server.js --config ./my-config.json
`);
        process.exit(0);
    }
  }
  
  return options;
}

// Main entry point
if (require.main === module) {
  const options = parseArgs();
  const server = new ProxyServer(options);
  server.start();
}

module.exports = ProxyServer;
