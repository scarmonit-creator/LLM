/**
 * Optimized LLM Framework Server with Performance Monitoring
 * 
 * COMPLETE INTEGRATION:
 * - Performance monitoring with real-time dashboard
 * - Secure Firebase configuration
 * - Memory management optimization
 * - Health check endpoints
 * - WebSocket support for live metrics
 * - Prometheus metrics export
 * 
 * Based on optimization analysis and security requirements
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');

// Import optimized components
const OptimizedMemoryManager = require('./memory/optimized-memory-manager');

// Import TypeScript modules (will be compiled)
let PerformanceMonitor, MemoryPerformanceIntegration, SecureFirebaseConfig;
try {
  PerformanceMonitor = require('./monitoring/performance-monitor').default;
  MemoryPerformanceIntegration = require('./monitoring/memory-integration').default;
  SecureFirebaseConfig = require('../config/firebase-secure').default;
} catch (error) {
  console.log('⚠️  TypeScript modules not compiled yet - run: npm run build');
  console.log('   Falling back to basic configuration');
}

class OptimizedLLMServer {
  constructor(options = {}) {
    this.config = {
      port: options.port || process.env.PORT || 8080,
      dashboardPort: options.dashboardPort || 8081,
      enableMonitoring: options.enableMonitoring !== false,
      enableFirebase: options.enableFirebase !== false,
      enableMetrics: options.enableMetrics !== false,
      ...options
    };
    
    this.app = express();
    this.server = null;
    this.memoryManager = null;
    this.performanceMonitor = null;
    this.memoryIntegration = null;
    this.firebase = null;
    
    this.initializeServer();
  }

  /**
   * Initialize optimized server with all components
   */
  async initializeServer() {
    console.log('🚀 Initializing Optimized LLM Server...');
    
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'", 'ws:', 'wss:']
        }
      }
    }));
    
    this.app.use(compression());
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Initialize core components
    await this.initializeMemoryManager();
    await this.initializePerformanceMonitoring();
    await this.initializeFirebase();
    
    // Setup routes
    this.setupHealthRoutes();
    this.setupMetricsRoutes();
    this.setupDashboardRoutes();
    this.setupAPIRoutes();
    
    // Error handling
    this.setupErrorHandling();
  }

  /**
   * Initialize optimized memory manager
   */
  async initializeMemoryManager() {
    console.log('🧠 Initializing Optimized Memory Manager...');
    
    this.memoryManager = new OptimizedMemoryManager({
      maxMemoryMB: 2048,
      maxCacheSize: 50000,
      defaultTTL: 7200000, // 2 hours
      cleanupInterval: 300000, // 5 minutes
      backgroundProcessing: true,
      metricsEnabled: true
    });
    
    // Setup memory pressure alerts
    this.memoryManager.on('memoryPressure', (data) => {
      console.log(`🚨 Memory pressure: ${data.level} at ${data.usage}%`);
      if (this.performanceMonitor) {
        this.performanceMonitor.recordMetric('memory.pressure_alert', data.usage, {
          level: data.level
        });
      }
    });
    
    console.log('✅ Memory Manager initialized');
  }

  /**
   * Initialize performance monitoring with dashboard
   */
  async initializePerformanceMonitoring() {
    if (!this.config.enableMonitoring || !PerformanceMonitor) {
      console.log('⚠️  Performance monitoring disabled or not available');
      return;
    }
    
    console.log('📊 Initializing Performance Monitoring...');
    
    try {
      this.performanceMonitor = new PerformanceMonitor({
        websocketPort: this.config.dashboardPort,
        metricsRetentionHours: 24,
        alertingEnabled: true,
        dashboardEnabled: true,
        prometheusEnabled: this.config.enableMetrics
      });
      
      await this.performanceMonitor.startMonitoring();
      
      // Integrate with memory manager
      if (MemoryPerformanceIntegration && this.memoryManager) {
        this.memoryIntegration = new MemoryPerformanceIntegration(
          this.performanceMonitor,
          this.memoryManager
        );
        await this.memoryIntegration.initialize();
        console.log('🔗 Memory-Performance integration active');
      }
      
      console.log('✅ Performance monitoring initialized');
      
    } catch (error) {
      console.error('❌ Performance monitoring setup failed:', error);
    }
  }

  /**
   * Initialize secure Firebase configuration
   */
  async initializeFirebase() {
    if (!this.config.enableFirebase || !SecureFirebaseConfig) {
      console.log('⚠️  Firebase disabled or not available');
      return;
    }
    
    console.log('🔥 Initializing Secure Firebase...');
    
    try {
      this.firebase = await SecureFirebaseConfig.initialize();
      
      // Log security report
      const securityReport = SecureFirebaseConfig.getSecurityReport();
      console.log('🔒 Firebase Security Report:', securityReport);
      
      // Record security metrics
      if (this.performanceMonitor) {
        this.performanceMonitor.recordMetric('firebase.security_score', 
          securityReport.isSecure ? 100 : 50, {
          method: securityReport.method
        });
      }
      
      console.log('✅ Firebase initialized securely');
      
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error);
    }
  }

  /**
   * Setup health check endpoints
   */
  setupHealthRoutes() {
    // Basic health check
    this.app.get('/health', (req, res) => {
      const startTime = Date.now();
      
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        components: {
          memoryManager: this.memoryManager ? 'active' : 'disabled',
          performanceMonitor: this.performanceMonitor ? 'active' : 'disabled',
          firebase: this.firebase ? 'active' : 'disabled'
        },
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        }
      };
      
      // Record API response time
      if (this.performanceMonitor) {
        const duration = Date.now() - startTime;
        this.performanceMonitor.recordApiResponse('/health', duration, 200);
      }
      
      res.json(health);
    });
    
    // Detailed health check
    this.app.get('/health/detailed', async (req, res) => {
      const startTime = Date.now();
      
      try {
        const detailed = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          memory: this.memoryManager ? this.memoryManager.getMetrics() : null,
          performance: this.performanceMonitor ? this.performanceMonitor.getCurrentMetrics() : null,
          firebase: this.firebase ? SecureFirebaseConfig.getSecurityReport() : null
        };
        
        // Record API response time
        if (this.performanceMonitor) {
          const duration = Date.now() - startTime;
          this.performanceMonitor.recordApiResponse('/health/detailed', duration, 200);
        }
        
        res.json(detailed);
        
      } catch (error) {
        const duration = Date.now() - startTime;
        if (this.performanceMonitor) {
          this.performanceMonitor.recordApiResponse('/health/detailed', duration, 500);
        }
        
        res.status(500).json({
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Setup metrics endpoints
   */
  setupMetricsRoutes() {
    if (!this.config.enableMetrics) return;
    
    // Prometheus metrics endpoint
    this.app.get('/metrics', (req, res) => {
      if (this.performanceMonitor) {
        const metrics = this.performanceMonitor.exportPrometheusMetrics();
        res.set('Content-Type', 'text/plain');
        res.send(metrics);
      } else {
        res.status(503).send('Metrics not available');
      }
    });
    
    // JSON metrics endpoint
    this.app.get('/api/metrics', (req, res) => {
      const hours = parseInt(req.query.hours) || 1;
      
      try {
        const metrics = {
          system: this.performanceMonitor ? this.performanceMonitor.getCurrentMetrics() : null,
          memory: this.memoryManager ? this.memoryManager.getMetrics() : null,
          report: this.performanceMonitor ? this.performanceMonitor.generateReport(hours) : null
        };
        
        res.json(metrics);
        
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  /**
   * Setup dashboard routes
   */
  setupDashboardRoutes() {
    // Serve monitoring dashboard
    this.app.get('/dashboard', (req, res) => {
      const dashboardPath = path.join(__dirname, 'monitoring', 'dashboard.html');
      res.sendFile(dashboardPath);
    });
    
    // Static assets for dashboard
    this.app.use('/dashboard/assets', express.static(path.join(__dirname, 'monitoring', 'assets')));
  }

  /**
   * Setup API routes with performance tracking
   */
  setupAPIRoutes() {
    // Performance-tracked middleware
    const trackPerformance = (req, res, next) => {
      req.startTime = Date.now();
      
      const originalSend = res.send;
      res.send = function(body) {
        if (this.performanceMonitor) {
          const duration = Date.now() - req.startTime;
          this.performanceMonitor.recordApiResponse(
            req.path, 
            duration, 
            res.statusCode
          );
        }
        originalSend.call(this, body);
      }.bind(this);
      
      next();
    };
    
    // Apply performance tracking to all API routes
    this.app.use('/api', trackPerformance);
    
    // Memory operations API
    this.app.post('/api/memory/store', async (req, res) => {
      try {
        const { key, value, type, options } = req.body;
        
        if (!this.memoryManager) {
          return res.status(503).json({ error: 'Memory manager not available' });
        }
        
        const result = await this.memoryManager.store(key, value, type, options);
        res.json({ success: true, result });
        
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });
    
    this.app.get('/api/memory/retrieve/:key', async (req, res) => {
      try {
        const { key } = req.params;
        
        if (!this.memoryManager) {
          return res.status(503).json({ error: 'Memory manager not available' });
        }
        
        const result = await this.memoryManager.retrieve(key);
        if (result !== null) {
          res.json({ success: true, data: result });
        } else {
          res.status(404).json({ error: 'Key not found' });
        }
        
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });
    
    // Memory optimization trigger
    this.app.post('/api/memory/optimize', async (req, res) => {
      try {
        if (!this.memoryIntegration) {
          return res.status(503).json({ error: 'Memory integration not available' });
        }
        
        const reason = req.body.reason || 'manual';
        await this.memoryIntegration.triggerMemoryOptimization(reason);
        
        res.json({ success: true, message: 'Memory optimization triggered' });
        
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      if (this.performanceMonitor) {
        this.performanceMonitor.recordApiResponse(req.path, 0, 404);
      }
      
      res.status(404).json({
        error: 'Not Found',
        path: req.path,
        timestamp: new Date().toISOString()
      });
    });
    
    // Global error handler
    this.app.use((error, req, res, next) => {
      console.error('Server error:', error);
      
      if (this.performanceMonitor) {
        this.performanceMonitor.recordMetric('server.errors', 1, {
          error: error.name || 'UnknownError'
        });
      }
      
      res.status(500).json({
        error: 'Internal Server Error',
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Start the optimized server
   */
  async start() {
    try {
      this.server = this.app.listen(this.config.port, () => {
        console.log(`🚀 Optimized LLM Server running on port ${this.config.port}`);
        console.log(`📊 Dashboard: http://localhost:${this.config.port}/dashboard`);
        console.log(`🔍 Health: http://localhost:${this.config.port}/health`);
        console.log(`📈 Metrics: http://localhost:${this.config.port}/metrics`);
        
        if (this.performanceMonitor) {
          console.log(`📡 WebSocket Dashboard: ws://localhost:${this.config.dashboardPort}`);
        }
      });
      
      // Graceful shutdown
      this.setupGracefulShutdown();
      
    } catch (error) {
      console.error('❌ Server startup failed:', error);
      process.exit(1);
    }
  }

  /**
   * Setup graceful shutdown
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`🔄 Received ${signal}, shutting down gracefully...`);
      
      // Stop performance monitoring
      if (this.performanceMonitor) {
        await this.performanceMonitor.stopMonitoring();
      }
      
      // Cleanup memory integration
      if (this.memoryIntegration) {
        this.memoryIntegration.destroy();
      }
      
      // Close server
      if (this.server) {
        this.server.close(() => {
          console.log('👋 Server shut down complete');
          process.exit(0);
        });
      }
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// CLI execution
if (require.main === module) {
  const server = new OptimizedLLMServer({
    port: process.env.PORT || 8080,
    enableMonitoring: process.env.ENABLE_MONITORING !== 'false',
    enableFirebase: process.env.ENABLE_FIREBASE !== 'false',
    enableMetrics: process.env.ENABLE_METRICS !== 'false'
  });
  
  server.start().catch(error => {
    console.error('Server failed to start:', error);
    process.exit(1);
  });
}

module.exports = OptimizedLLMServer;