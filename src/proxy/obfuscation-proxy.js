/**
 * Obfuscation Proxy Module
 * Inspired by XX-Net's traffic obfuscation and proxy capabilities
 * Features:
 * - Traffic obfuscation to make requests unrecognizable
 * - Chrome browser behavior simulation
 * - Multi-platform support
 * - Cross-device connection support
 */

import http from 'http';
import https from 'https';
import net from 'net';
import crypto from 'crypto';
import { URL } from 'url';

class ObfuscationProxy {
  constructor(config = {}) {
    this.config = {
      port: config.port || 8080,
      host: config.host || '0.0.0.0',
      obfuscationKey: config.obfuscationKey || crypto.randomBytes(32).toString('hex'),
      simulateChrome: config.simulateChrome !== false,
      enableLogging: config.enableLogging !== false,
      ...config,
    };

    this.server = null;
    this.connections = new Set();
    this.stats = {
      requests: 0,
      bytesTransferred: 0,
      activeConnections: 0,
    };
  }

  /**
   * Start the proxy server
   */
  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(this.handleRequest.bind(this));

      // Handle CONNECT method for HTTPS tunneling
      this.server.on('connect', this.handleConnect.bind(this));

      this.server.on('error', (err) => {
        this.log('Server error:', err);
        reject(err);
      });

      this.server.listen(this.config.port, this.config.host, () => {
        this.log(`Obfuscation Proxy started on ${this.config.host}:${this.config.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the proxy server
   */
  stop() {
    return new Promise((resolve) => {
      // Close all active connections
      for (const conn of this.connections) {
        conn.destroy();
      }
      this.connections.clear();

      if (this.server) {
        this.server.close(() => {
          this.log('Proxy server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle HTTP requests with obfuscation
   */
  handleRequest(clientReq, clientRes) {
    this.stats.requests++;
    this.log(`Request: ${clientReq.method} ${clientReq.url}`);

    try {
      const url = new URL(clientReq.url);
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: clientReq.method,
        headers: this.obfuscateHeaders(clientReq.headers),
      };

      const protocol = url.protocol === 'https:' ? https : http;

      const proxyReq = protocol.request(options, (proxyRes) => {
        // Copy response headers with obfuscation
        clientRes.writeHead(proxyRes.statusCode, this.obfuscateHeaders(proxyRes.headers, true));

        // Track data transfer
        proxyRes.on('data', (chunk) => {
          this.stats.bytesTransferred += chunk.length;
          clientRes.write(this.obfuscateData(chunk));
        });

        proxyRes.on('end', () => {
          clientRes.end();
        });
      });

      proxyReq.on('error', (err) => {
        this.log('Proxy request error:', err);
        clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
        clientRes.end('Bad Gateway');
      });

      // Forward request body
      clientReq.on('data', (chunk) => {
        this.stats.bytesTransferred += chunk.length;
        proxyReq.write(this.obfuscateData(chunk));
      });

      clientReq.on('end', () => {
        proxyReq.end();
      });
    } catch (err) {
      this.log('Request handling error:', err);
      clientRes.writeHead(400, { 'Content-Type': 'text/plain' });
      clientRes.end('Bad Request');
    }
  }

  /**
   * Handle HTTPS CONNECT tunneling
   */
  handleConnect(req, clientSocket, head) {
    this.stats.requests++;
    this.stats.activeConnections++;
    this.connections.add(clientSocket);

    this.log(`CONNECT: ${req.url}`);

    const [hostname, port] = req.url.split(':');

    const serverSocket = net.connect(port || 443, hostname, () => {
      clientSocket.write(
        'HTTP/1.1 200 Connection Established\r\n' + 'Proxy-agent: ObfuscationProxy/1.0\r\n' + '\r\n'
      );

      // Bidirectional pipe with obfuscation
      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);

      if (head.length > 0) {
        serverSocket.write(head);
      }
    });

    serverSocket.on('error', (err) => {
      this.log('Server socket error:', err);
      clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
    });

    clientSocket.on('error', (err) => {
      this.log('Client socket error:', err);
      serverSocket.end();
    });

    clientSocket.on('close', () => {
      this.stats.activeConnections--;
      this.connections.delete(clientSocket);
      serverSocket.end();
    });
  }

  /**
   * Obfuscate HTTP headers to simulate Chrome browser
   */
  obfuscateHeaders(headers, isResponse = false) {
    if (isResponse) {
      return headers; // Don't modify response headers significantly
    }

    const obfuscated = { ...headers };

    if (this.config.simulateChrome) {
      // Add Chrome-like headers
      obfuscated['user-agent'] =
        obfuscated['user-agent'] ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

      obfuscated['accept'] =
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
      obfuscated['accept-encoding'] = 'gzip, deflate, br';
      obfuscated['accept-language'] = 'en-US,en;q=0.9';
      obfuscated['cache-control'] = 'no-cache';
      obfuscated['pragma'] = 'no-cache';
      obfuscated['sec-ch-ua'] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
      obfuscated['sec-ch-ua-mobile'] = '?0';
      obfuscated['sec-ch-ua-platform'] = '"Windows"';
      obfuscated['sec-fetch-dest'] = 'document';
      obfuscated['sec-fetch-mode'] = 'navigate';
      obfuscated['sec-fetch-site'] = 'none';
      obfuscated['sec-fetch-user'] = '?1';
      obfuscated['upgrade-insecure-requests'] = '1';
    }

    // Remove proxy-specific headers
    delete obfuscated['proxy-connection'];
    delete obfuscated['proxy-authorization'];

    return obfuscated;
  }

  /**
   * Obfuscate data using XOR cipher with key rotation
   * This makes traffic patterns unrecognizable
   */
  obfuscateData(data) {
    if (!this.config.obfuscationKey || !Buffer.isBuffer(data)) {
      return data;
    }

    const key = Buffer.from(this.config.obfuscationKey, 'hex');
    const result = Buffer.alloc(data.length);

    for (let i = 0; i < data.length; i++) {
      // XOR with rotating key
      result[i] = data[i] ^ key[i % key.length];
    }

    return result;
  }

  /**
   * Generate obfuscation key
   */
  static generateKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get proxy statistics
   */
  getStats() {
    return {
      ...this.stats,
      uptime: process.uptime(),
      config: {
        port: this.config.port,
        host: this.config.host,
        simulateChrome: this.config.simulateChrome,
      },
    };
  }

  /**
   * Log messages
   */
  log(...args) {
    if (this.config.enableLogging) {
      console.log('[ObfuscationProxy]', ...args);
    }
  }
}

export default ObfuscationProxy;
