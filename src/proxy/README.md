# 🚀 Obfuscation Proxy Module

Inspired by [XX-Net](https://github.com/XX-net/XX-Net), this module provides robust proxy and traffic obfuscation capabilities for circumventing network restrictions and enhancing privacy.

## 🔌 Features

- **Traffic Obfuscation**: Uses XOR cipher with key rotation to make traffic patterns unrecognizable
- **Chrome Browser Simulation**: Simulates Chrome browser behavior with realistic headers
- **Cross-Platform Support**: Works on Windows, macOS, Linux, Android, and iOS
- **Multi-Device Support**: Allows connections from multiple devices simultaneously
- **HTTP/HTTPS Proxy**: Full support for HTTP and HTTPS tunneling
- **Configurable**: Flexible configuration system with presets
- **Lightweight**: Minimal dependencies, runs on Node.js

## 📋 Files Overview

### `obfuscation-proxy.js`
Core proxy implementation with traffic obfuscation and header manipulation.

**Key Features:**
- HTTP request/response proxying
- HTTPS CONNECT tunneling
- Traffic obfuscation using XOR cipher
- Chrome user-agent and header simulation
- Connection tracking and statistics

### `proxy-config.js`
Configuration management for platform-specific settings.

**Key Features:**
- Platform-specific configuration (Windows/macOS/Linux/Android/iOS)
- Configuration presets (stealth, performance, development)
- Configuration validation and merging
- Default Chrome headers for realistic simulation

### `proxy-server.js`
Command-line server runner with CLI interface.

**Key Features:**
- CLI argument parsing
- Server lifecycle management
- Statistics monitoring
- Platform-specific configuration instructions
- Graceful shutdown handling

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/scarmonit-creator/LLM.git
cd LLM

# Install dependencies
npm install
```

### Basic Usage

```bash
# Start the proxy with default settings
node src/proxy/proxy-server.js

# Start on a custom port
node src/proxy/proxy-server.js --port 9090

# Use stealth preset for maximum obfuscation
node src/proxy/proxy-server.js --preset stealth

# Use performance preset for speed
node src/proxy/proxy-server.js --preset performance

# Use development preset (no obfuscation for testing)
node src/proxy/proxy-server.js --preset development

# Disable obfuscation
node src/proxy/proxy-server.js --no-obfuscation

# Disable Chrome simulation
node src/proxy/proxy-server.js --no-chrome
```

## 🛠️ Configuration

### Command-Line Options

```
Usage: node proxy-server.js [options]

Options:
  --port <port>         Proxy port (default: 8080)
  --host <host>         Proxy host (default: 0.0.0.0)
  --config <file>       Configuration file path
  --preset <preset>     Use preset config: stealth, performance, development
  --no-obfuscation      Disable traffic obfuscation
  --no-chrome           Disable Chrome simulation
  --help, -h            Show help message
```

### Configuration File

Create a JSON configuration file:

```json
{
  "port": 8080,
  "host": "0.0.0.0",
  "simulateChrome": true,
  "enableLogging": true,
  "obfuscation": {
    "enabled": true,
    "algorithm": "xor-rotation",
    "keyRotationInterval": 1000,
    "randomPadding": true
  },
  "trafficShaping": {
    "enabled": true,
    "randomizeTimings": true
  }
}
```

Then use it:

```bash
node src/proxy/proxy-server.js --config ./my-config.json
```

### Configuration Presets

#### Stealth (Maximum Obfuscation)
- Enabled obfuscation with random padding
- Chrome simulation enabled
- Traffic shaping with randomized timings
- Minimal logging

#### Performance (Speed Optimized)
- Basic obfuscation without padding
- Chrome simulation enabled
- No traffic shaping
- Increased connection limits

#### Development (Testing)
- No obfuscation
- No Chrome simulation
- Verbose logging
- Custom port (8888)

## 🌐 Client Configuration

### Browser Configuration

#### Chrome/Edge
1. Settings → System → Open proxy settings
2. Manual proxy setup
3. HTTP proxy: `localhost:8080`
4. HTTPS proxy: `localhost:8080`

#### Firefox
1. Settings → Network Settings → Settings
2. Manual proxy configuration
3. HTTP Proxy: `localhost` Port: `8080`
4. Also use this proxy for HTTPS

### System-Wide Proxy

#### Windows
```powershell
# Settings → Network & Internet → Proxy
# Enable "Use a proxy server"
# Address: localhost
# Port: 8080
```

#### macOS
```bash
# System Preferences → Network → Advanced → Proxies
# Enable "Web Proxy (HTTP)" and "Secure Web Proxy (HTTPS)"
# Server: localhost
# Port: 8080
```

#### Linux
```bash
export http_proxy=http://localhost:8080
export https_proxy=http://localhost:8080
export HTTP_PROXY=http://localhost:8080
export HTTPS_PROXY=http://localhost:8080
```

### Programmatic Usage

```javascript
const ObfuscationProxy = require('./obfuscation-proxy');

const proxy = new ObfuscationProxy({
  port: 8080,
  host: '0.0.0.0',
  simulateChrome: true,
  obfuscationKey: ObfuscationProxy.generateKey(),
  enableLogging: true
});

// Start the proxy
await proxy.start();

// Get statistics
const stats = proxy.getStats();
console.log('Requests:', stats.requests);
console.log('Active connections:', stats.activeConnections);
console.log('Bytes transferred:', stats.bytesTransferred);

// Stop the proxy
await proxy.stop();
```

## 🔒 Security Features

### Traffic Obfuscation
- **XOR Cipher**: Data is XORed with a rotating key
- **Key Rotation**: Key rotates every N bytes for better security
- **Random Padding**: Adds random padding to break traffic patterns
- **Protocol Mimicry**: Makes traffic appear as normal HTTPS

### Header Obfuscation
- **Chrome Simulation**: Realistic Chrome browser headers
- **Security Headers**: Modern security headers (sec-ch-ua, sec-fetch-*)
- **Proxy Header Removal**: Strips proxy-specific headers

### Privacy
- **No Logging Mode**: Can disable all logging
- **Local Operation**: All processing happens locally
- **No Data Storage**: No persistent data storage

## 📊 Statistics & Monitoring

The proxy provides real-time statistics:

- Total requests processed
- Active connections
- Bytes transferred
- Uptime
- Configuration details

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
node --test tests/proxy.test.js

# Run with npm (if configured in package.json)
npm test tests/proxy.test.js
```

Test the proxy with curl:

```bash
# Test HTTP
curl -x http://localhost:8080 http://example.com

# Test HTTPS
curl -x http://localhost:8080 https://example.com

# Test with LLM API
curl -x http://localhost:8080 https://api.openai.com/v1/models
```

## 🚀 Integration with LLM Application

Use the proxy with the LLM application:

### Environment Variables

```bash
export HTTP_PROXY=http://localhost:8080
export HTTPS_PROXY=http://localhost:8080
node src/index.js
```

### Programmatic Integration

```javascript
const https = require('https');
const HttpsProxyAgent = require('https-proxy-agent');

const agent = new HttpsProxyAgent('http://localhost:8080');

const options = {
  hostname: 'api.openai.com',
  path: '/v1/chat/completions',
  method: 'POST',
  agent: agent
};

const req = https.request(options, (res) => {
  // Handle response
});
```

## 🌍 Cross-Platform Notes

### Windows
- Runs as a console application
- Can be run as a Windows service (requires additional setup)
- Firewall rules may need to be configured

### macOS
- Requires Node.js installation
- May need to allow network connections in security settings

### Linux
- Supports systemd service configuration
- Can run as a daemon
- Supports both iptables and nftables

### Android
- Requires Termux or similar terminal emulator
- Install Node.js in Termux
- Configure Wi-Fi proxy to point to device IP

### iOS
- Requires jailbreak or similar terminal access
- Or run on a separate device and configure iOS proxy

## 🔍 Troubleshooting

### Port Already in Use
```bash
# Use a different port
node src/proxy/proxy-server.js --port 9090
```

### Connection Refused
- Check firewall settings
- Ensure proxy is running
- Verify port is correct

### SSL/TLS Errors
- The proxy uses CONNECT tunneling for HTTPS
- No SSL certificate installation needed
- SSL errors may indicate blocked connections

### Performance Issues
- Use performance preset: `--preset performance`
- Disable traffic shaping in config
- Increase connection limits

## 📚 API Reference

### ObfuscationProxy

#### Constructor
```javascript
new ObfuscationProxy(config)
```

#### Methods
- `start()` - Start the proxy server (async)
- `stop()` - Stop the proxy server (async)
- `getStats()` - Get current statistics
- `static generateKey()` - Generate obfuscation key

### ProxyConfig

#### Methods
- `getDefaultConfig()` - Get default configuration
- `getPlatformConfig()` - Get platform-specific config
- `validateConfig(config)` - Validate configuration
- `mergeConfig(userConfig)` - Merge with defaults
- `getPresetConfig(preset)` - Get preset configuration

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This module is part of the LLM project. See the main repository for license information.

## 🙏 Acknowledgments

- Inspired by [XX-Net](https://github.com/XX-net/XX-Net)
- XX-Net team for their innovative approach to circumvention
- The open-source community

## 📞 Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Check the main LLM repository README
- Review the test suite for usage examples

---

**Made with ❤️ for a free and open internet**
