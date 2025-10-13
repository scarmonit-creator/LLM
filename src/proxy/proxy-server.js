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
      console.log(
        `📱 Multi-device Support: ${this.config.host === '0.0.0.0' ? 'Enabled' : 'Disabled'}`
      );
      console.log('━'.repeat(60));

      // Display configuration instructions
      this.displayInstructions();

      // Setup signal handlers for graceful shutdown
      this.setupSignalHandlers();

      // Display statistics periodically
      if (this.config.enableLogging) {
        this.startStatsDisplay();
      }
    } catch (error) {
      console.error('❌ Failed to start proxy server:', error);
      process.exit(1);
    }
  }

  /**
   * Load configuration from options and files
   */
  loadConfiguration() {
    let config = {};

    // Check for config file
    if (this.options.config) {
      try {
        const configContent = fs.readFileSync(this.options.config, 'utf8');
        config = JSON.parse(configContent);
      } catch (error) {
        console.warn(`⚠️  Failed to load config file: ${error.message}`);
      }
    }

    // Apply preset if specified
    if (this.options.preset) {
      const preset = this.proxyConfig.getPreset(this.options.preset);
      if (preset) {
        config = { ...preset, ...config };
      }
    }

    // Apply command line options (highest priority)
    config = {
      ...config,
      port: this.options.port || config.port || 8080,
      host: this.options.host || config.host || '0.0.0.0',
      obfuscation: {
        enabled: this.options.obfuscation !== false,
        ...(config.obfuscation || {}),
      },
      simulateChrome: this.options.chrome !== false,
    };

    return this.proxyConfig.validate(config);
  }

  /**
   * Display configuration instructions for different platforms
   */
  displayInstructions() {
    console.log('\n📋 Configuration Instructions:');
    console.log('━'.repeat(60));

    // Windows
    console.log('\n🪟 Windows:');
    console.log('   Internet Options → Connections → LAN Settings');
    console.log(`   Proxy server: ${this.config.host}:${this.config.port}`);

    // macOS
    console.log('\n🍎 macOS:');
    console.log('   System Preferences → Network → Advanced → Proxies');
    console.log(`   Web Proxy (HTTP): ${this.config.host}:${this.config.port}`);
    console.log(`   Secure Web Proxy (HTTPS): ${this.config.host}:${this.config.port}`);

    // Linux
    console.log('\n🐧 Linux:');
    console.log(`   export http_proxy="http://${this.config.host}:${this.config.port}"`);
    console.log(`   export https_proxy="http://${this.config.host}:${this.config.port}"`);

    // Mobile
    console.log('\n📱 Mobile (Android/iOS):');
    console.log('   WiFi Settings → Proxy → Manual');
    console.log(`   Server: ${this.getLocalIP()}`);
    console.log(`   Port: ${this.config.port}`);

    console.log('\n━'.repeat(60));
  }

  /**
   * Get local IP address for mobile configuration
   */
  getLocalIP() {
    const os = require('os');
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal and non-IPv4 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }

    return this.config.host;
  }

  /**
   * Display periodic statistics
   */
  startStatsDisplay() {
    setInterval(() => {
      const stats = this.proxy.getStats();
      console.log('\n📊 Proxy Statistics:');
      console.log(`   Requests: ${stats.totalRequests}`);
      console.log(`   Active Connections: ${stats.activeConnections}`);
      console.log(`   Data Transferred: ${this.formatBytes(stats.bytesTransferred)}`);
      console.log(`   Uptime: ${this.formatUptime(stats.uptime)}`);
    }, 60000); // Display every minute
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Format uptime to human readable format
   */
  formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    const shutdown = async () => {
      console.log('\n\n🛑 Shutting down proxy server...');
      if (this.proxy) {
        await this.proxy.stop();
      }
      console.log('👋 Proxy server stopped gracefully.');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--port':
        options.port = parseInt(args[++i], 10);
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
        options.obfuscation = false;
        break;
      case '--no-chrome':
        options.chrome = false;
        break;
      case '--help':
      case '-h':
        displayHelp();
        process.exit(0);
        break;
      default:
        console.warn(`⚠️  Unknown option: ${arg}`);
    }
  }

  return options;
}

/**
 * Display help message
 */
function displayHelp() {
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
  --help, -h            Display this help message

Examples:
  node proxy-server.js
  node proxy-server.js --port 3128
  node proxy-server.js --preset stealth
  node proxy-server.js --config ./my-config.json --no-chrome
`);
}

/**
 * Main entry point
 */
async function main() {
  const options = parseArgs();
  const server = new ProxyServer(options);
  await server.start();
}

// Start server if run directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = ProxyServer;
