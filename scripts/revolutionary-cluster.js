#!/usr/bin/env node
/**
 * Revolutionary Cluster Manager
 * Multi-core optimization with intelligent load balancing
 */

import cluster from 'cluster';
import { cpus } from 'os';
import process from 'process';
import { performance } from 'perf_hooks';

class RevolutionaryCluster {
  constructor(options = {}) {
    this.options = {
      workers: options.workers || cpus().length,
      maxWorkers: options.maxWorkers || cpus().length * 2,
      minWorkers: options.minWorkers || 1,
      restartDelay: options.restartDelay || 1000,
      gracefulTimeout: options.gracefulTimeout || 30000,
      healthCheckInterval: options.healthCheckInterval || 10000,
      autoScale: options.autoScale !== false,
      serverScript: options.serverScript || './src/ultra-performance/revolutionary-server.js',
      ...options
    };
    
    this.workers = new Map();
    this.metrics = {
      startTime: Date.now(),
      totalRequests: 0,
      errors: 0,
      restarts: 0,
      scalingEvents: 0
    };
    
    this.isShuttingDown = false;
  }
  
  /**
   * Start revolutionary cluster
   */
  start() {
    if (cluster.isPrimary) {
      this.startPrimary();
    } else {
      this.startWorker();
    }
  }
  
  /**
   * Start primary process
   */
  startPrimary() {
    console.log('\n🎆 Revolutionary Cluster Manager Starting...');
    console.log('=' * 60);
    console.log(`Primary process ${process.pid} starting with ${this.options.workers} workers`);
    console.log(`CPU cores: ${cpus().length}, Max workers: ${this.options.maxWorkers}`);
    
    // Set up process title
    process.title = 'revolutionary-cluster-primary';
    
    // Apply V8 optimizations
    this.applyV8Optimizations();
    
    // Fork initial workers
    for (let i = 0; i < this.options.workers; i++) {
      this.forkWorker();
    }
    
    // Setup cluster event handlers
    this.setupClusterEvents();
    
    // Start monitoring and auto-scaling
    this.startMonitoring();
    
    // Setup graceful shutdown
    this.setupGracefulShutdown();
    
    console.log(`\n✅ Revolutionary cluster started with ${this.workers.size} workers`);
    console.log(`🔍 Primary process listening for worker health and scaling events`);
  }
  
  /**
   * Start worker process
   */
  startWorker() {
    process.title = `revolutionary-worker-${process.pid}`;
    
    console.log(`💪 Worker ${process.pid} starting...`);
    
    // Apply worker-specific V8 optimizations
    this.applyV8Optimizations();
    
    // Import and start the revolutionary server
    import(this.options.serverScript).then(module => {
      if (module.default) {
        const server = new module.default({
          port: 0, // Let the system assign port for workers
          enableQuantum: process.env.ENABLE_QUANTUM === 'true',
          enableNeural: true,
          enableIntelligence: true,
          enableOrchestration: true
        });
        
        server.start().then(() => {
          console.log(`✅ Revolutionary worker ${process.pid} started successfully`);
          
          // Send ready signal to primary
          if (process.send) {
            process.send({ cmd: 'worker_ready', pid: process.pid });
          }
        }).catch(error => {
          console.error(`💥 Revolutionary worker ${process.pid} failed to start:`, error);
          process.exit(1);
        });
      } else {
        console.error(`💥 Revolutionary server module not found or invalid`);
        process.exit(1);
      }
    }).catch(error => {
      console.error(`💥 Failed to load revolutionary server:`, error);
      process.exit(1);
    });
  }
  
  /**
   * Apply V8 optimization flags
   */
  applyV8Optimizations() {
    try {
      // These optimizations are already applied via command line flags
      // but we can add runtime optimizations here
      
      if (global.gc) {
        // Schedule periodic garbage collection for memory optimization
        setInterval(() => {
          if (!this.isShuttingDown) {
            global.gc();
          }
        }, 30000); // Every 30 seconds
      }
      
      // Enable V8 optimization hints
      if (typeof v8 !== 'undefined' && v8.setFlagsFromString) {
        try {
          v8.setFlagsFromString('--optimize-for-size');
          v8.setFlagsFromString('--use-idle-notification');
        } catch (error) {
          // Flags may already be set
        }
      }
      
    } catch (error) {
      console.warn('V8 optimization setup warning:', error.message);
    }
  }
  
  /**
   * Fork a new worker
   */
  forkWorker() {
    const worker = cluster.fork();
    
    const workerInfo = {
      id: worker.id,
      pid: worker.process.pid,
      startTime: Date.now(),
      requests: 0,
      errors: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      isHealthy: true,
      lastHealthCheck: Date.now()
    };
    
    this.workers.set(worker.id, workerInfo);
    
    console.log(`🚀 Forked worker ${worker.id} (PID: ${worker.process.pid})`);
    
    return worker;
  }
  
  /**
   * Setup cluster event handlers
   */
  setupClusterEvents() {
    cluster.on('online', (worker) => {
      console.log(`✅ Worker ${worker.id} is online`);
    });
    
    cluster.on('listening', (worker, address) => {
      console.log(`🔊 Worker ${worker.id} listening on ${address.address}:${address.port}`);
    });
    
    cluster.on('disconnect', (worker) => {
      console.log(`🔌 Worker ${worker.id} disconnected`);
      this.workers.delete(worker.id);
    });
    
    cluster.on('exit', (worker, code, signal) => {
      console.log(`💥 Worker ${worker.id} died (code: ${code}, signal: ${signal})`);
      
      this.workers.delete(worker.id);
      this.metrics.restarts++;
      
      // Restart worker if not shutting down
      if (!this.isShuttingDown && !worker.exitedAfterDisconnect) {
        console.log(`🔁 Restarting worker ${worker.id} in ${this.options.restartDelay}ms...`);
        
        setTimeout(() => {
          if (!this.isShuttingDown) {
            this.forkWorker();
          }
        }, this.options.restartDelay);
      }
    });
    
    cluster.on('message', (worker, message) => {
      this.handleWorkerMessage(worker, message);
    });
  }
  
  /**
   * Handle messages from workers
   */
  handleWorkerMessage(worker, message) {
    const workerInfo = this.workers.get(worker.id);
    if (!workerInfo) return;
    
    switch (message.cmd) {
      case 'worker_ready':
        console.log(`✅ Worker ${worker.id} is ready`);
        workerInfo.isHealthy = true;
        break;
        
      case 'request_processed':
        workerInfo.requests++;
        this.metrics.totalRequests++;
        break;
        
      case 'error_occurred':
        workerInfo.errors++;
        this.metrics.errors++;
        break;
        
      case 'health_report':
        workerInfo.memoryUsage = message.memoryUsage || 0;
        workerInfo.cpuUsage = message.cpuUsage || 0;
        workerInfo.lastHealthCheck = Date.now();
        break;
        
      default:
        console.log(`Unknown message from worker ${worker.id}:`, message);
    }
  }
  
  /**
   * Start monitoring and auto-scaling
   */
  startMonitoring() {
    setInterval(() => {
      if (!this.isShuttingDown) {
        this.checkWorkerHealth();
        
        if (this.options.autoScale) {
          this.evaluateScaling();
        }
        
        this.logMetrics();
      }
    }, this.options.healthCheckInterval);
  }
  
  /**
   * Check worker health
   */
  checkWorkerHealth() {
    const now = Date.now();
    const unhealthyWorkers = [];
    
    for (const [workerId, workerInfo] of this.workers) {
      const timeSinceLastCheck = now - workerInfo.lastHealthCheck;
      
      if (timeSinceLastCheck > this.options.healthCheckInterval * 2) {
        workerInfo.isHealthy = false;
        unhealthyWorkers.push(workerId);
        console.warn(`⚠️ Worker ${workerId} appears unhealthy (no response in ${timeSinceLastCheck}ms)`);
      }
    }
    
    // Restart unhealthy workers
    for (const workerId of unhealthyWorkers) {
      const worker = cluster.workers[workerId];
      if (worker) {
        console.log(`🔁 Restarting unhealthy worker ${workerId}`);
        worker.kill('SIGTERM');
      }
    }
  }
  
  /**
   * Evaluate scaling needs
   */
  evaluateScaling() {
    const workerCount = this.workers.size;
    const avgMemoryUsage = this.calculateAverageMemoryUsage();
    const avgCpuUsage = this.calculateAverageCpuUsage();
    const requestsPerWorker = this.metrics.totalRequests / workerCount;
    
    // Scale up conditions
    const shouldScaleUp = (
      (avgCpuUsage > 80 || avgMemoryUsage > 80) &&
      workerCount < this.options.maxWorkers &&
      requestsPerWorker > 100
    );
    
    // Scale down conditions
    const shouldScaleDown = (
      avgCpuUsage < 30 &&
      avgMemoryUsage < 30 &&
      workerCount > this.options.minWorkers &&
      requestsPerWorker < 50
    );
    
    if (shouldScaleUp) {
      console.log(`📈 Scaling up: CPU ${avgCpuUsage}%, Memory ${avgMemoryUsage}%, Workers ${workerCount} -> ${workerCount + 1}`);
      this.forkWorker();
      this.metrics.scalingEvents++;
    } else if (shouldScaleDown) {
      console.log(`📉 Scaling down: CPU ${avgCpuUsage}%, Memory ${avgMemoryUsage}%, Workers ${workerCount} -> ${workerCount - 1}`);
      this.removeWorker();
      this.metrics.scalingEvents++;
    }
  }
  
  /**
   * Remove a worker for scaling down
   */
  removeWorker() {
    const workers = Object.values(cluster.workers).filter(w => w);
    if (workers.length > this.options.minWorkers) {
      const worker = workers[0];
      console.log(`🗑️ Removing worker ${worker.id} for scaling down`);
      worker.disconnect();
      
      setTimeout(() => {
        if (!worker.isDead()) {
          worker.kill('SIGTERM');
        }
      }, 5000);
    }
  }
  
  /**
   * Calculate average memory usage
   */
  calculateAverageMemoryUsage() {
    const workers = Array.from(this.workers.values());
    if (workers.length === 0) return 0;
    
    const totalMemory = workers.reduce((sum, worker) => sum + worker.memoryUsage, 0);
    return Math.round(totalMemory / workers.length);
  }
  
  /**
   * Calculate average CPU usage
   */
  calculateAverageCpuUsage() {
    const workers = Array.from(this.workers.values());
    if (workers.length === 0) return 0;
    
    const totalCpu = workers.reduce((sum, worker) => sum + worker.cpuUsage, 0);
    return Math.round(totalCpu / workers.length);
  }
  
  /**
   * Log cluster metrics
   */
  logMetrics() {
    const uptime = Math.round((Date.now() - this.metrics.startTime) / 1000);
    const workerCount = this.workers.size;
    const avgMemory = this.calculateAverageMemoryUsage();
    const avgCpu = this.calculateAverageCpuUsage();
    
    console.log(`\n📈 Cluster Metrics (${uptime}s uptime):`);
    console.log(`  Workers: ${workerCount} active`);
    console.log(`  Requests: ${this.metrics.totalRequests} total`);
    console.log(`  Errors: ${this.metrics.errors} total`);
    console.log(`  Restarts: ${this.metrics.restarts}`);
    console.log(`  Scaling Events: ${this.metrics.scalingEvents}`);
    console.log(`  Avg Memory: ${avgMemory}%`);
    console.log(`  Avg CPU: ${avgCpu}%`);
  }
  
  /**
   * Setup graceful shutdown
   */
  setupGracefulShutdown() {
    const gracefulShutdown = (signal) => {
      console.log(`\n🛑 Received ${signal}, initiating graceful cluster shutdown...`);
      this.isShuttingDown = true;
      
      const workers = Object.values(cluster.workers).filter(w => w);
      let shutdownWorkers = workers.length;
      
      if (shutdownWorkers === 0) {
        console.log('✅ No workers to shutdown, exiting...');
        process.exit(0);
      }
      
      console.log(`🛑 Shutting down ${shutdownWorkers} workers...`);
      
      // Disconnect all workers
      workers.forEach(worker => {
        worker.disconnect();
        
        worker.on('disconnect', () => {
          shutdownWorkers--;
          console.log(`🛑 Worker ${worker.id} disconnected (${shutdownWorkers} remaining)`);
          
          if (shutdownWorkers === 0) {
            console.log('✅ All workers shutdown gracefully');
            process.exit(0);
          }
        });
      });
      
      // Force shutdown after timeout
      setTimeout(() => {
        console.log('⏰ Graceful shutdown timeout, forcing exit...');
        workers.forEach(worker => {
          if (!worker.isDead()) {
            worker.kill('SIGKILL');
          }
        });
        process.exit(1);
      }, this.options.gracefulTimeout);
    };
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }
}

// Auto-start cluster
const cluster_manager = new RevolutionaryCluster({
  workers: parseInt(process.env.CLUSTER_WORKERS) || cpus().length,
  maxWorkers: parseInt(process.env.MAX_WORKERS) || cpus().length * 2,
  autoScale: process.env.AUTO_SCALE !== 'false',
  serverScript: process.env.SERVER_SCRIPT || './src/ultra-performance/revolutionary-server.js'
});

cluster_manager.start();

export default RevolutionaryCluster;