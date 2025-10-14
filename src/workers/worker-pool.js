#!/usr/bin/env node

/**
 * Advanced Worker Thread Pool for CPU-Intensive Task Offloading
 * High-performance parallel processing inspired by Chromium's task scheduling
 */

import { Worker, isMainThread, parentPort, MessageChannel } from 'worker_threads';
import { EventEmitter } from 'node:events';
import { cpus } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * High-performance worker pool with intelligent task scheduling
 * Supports CPU-intensive operations without blocking the main thread
 */
class WorkerPool extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration with optimal defaults
    this.maxWorkers = options.maxWorkers ?? cpus().length;
    this.minWorkers = options.minWorkers ?? Math.max(1, Math.floor(this.maxWorkers / 2));
    this.workerScript = options.workerScript ?? this.getDefaultWorkerScript();
    this.taskTimeout = options.taskTimeout ?? 30000; // 30 seconds
    this.idleTimeout = options.idleTimeout ?? 60000; // 1 minute
    this.maxQueueSize = options.maxQueueSize ?? 1000;
    
    // Worker management
    this.workers = new Map(); // workerId -> workerInfo
    this.availableWorkers = [];
    this.busyWorkers = new Set();
    this.taskQueue = [];
    this.nextWorkerId = 1;
    
    // Performance tracking
    this.statistics = {
      tasksCompleted: 0,
      tasksQueued: 0,
      tasksFailed: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      maxProcessingTime: 0,
      workersCreated: 0,
      workersDestroyed: 0,
      queueTimeouts: 0
    };
    
    // Task tracking
    this.activeTasks = new Map(); // taskId -> taskInfo
    this.nextTaskId = 1;
    
    // Lifecycle state
    this.isDestroyed = false;
    this.isShuttingDown = false;
    
    this.initialize();
  }
  
  /**
   * Initialize worker pool with minimum workers
   */
  async initialize() {
    for (let i = 0; i < this.minWorkers; i++) {
      await this.createWorker();
    }
    
    // Start maintenance timer
    this.startMaintenance();
    
    this.emit('initialized', {
      minWorkers: this.minWorkers,
      maxWorkers: this.maxWorkers,
      initialWorkers: this.workers.size
    });
  }
  
  /**
   * Create a new worker instance
   */
  async createWorker() {
    if (this.workers.size >= this.maxWorkers) {
      throw new Error(`Cannot create worker: pool at maximum size (${this.maxWorkers})`);
    }
    
    const workerId = this.nextWorkerId++;
    const worker = new Worker(this.workerScript, {
      transferList: [],
      resourceLimits: {
        maxOldGenerationSizeMb: 128,
        maxYoungGenerationSizeMb: 64
      }
    });
    
    const workerInfo = {
      id: workerId,
      worker,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      tasksCompleted: 0,
      totalProcessingTime: 0,
      currentTask: null,
      isAvailable: true
    };
    
    // Set up worker event handlers
    this.setupWorkerHandlers(workerInfo);
    
    // Add to pool
    this.workers.set(workerId, workerInfo);
    this.availableWorkers.push(workerInfo);
    this.statistics.workersCreated++;
    
    this.emit('worker_created', { workerId, totalWorkers: this.workers.size });
    
    return workerInfo;
  }
  
  /**
   * Set up event handlers for a worker
   */
  setupWorkerHandlers(workerInfo) {
    const { worker, id: workerId } = workerInfo;
    
    worker.on('message', (message) => {
      this.handleWorkerMessage(workerId, message);
    });
    
    worker.on('error', (error) => {
      this.handleWorkerError(workerId, error);
    });
    
    worker.on('exit', (exitCode) => {
      this.handleWorkerExit(workerId, exitCode);
    });
    
    // Send initialization message
    worker.postMessage({
      type: 'init',
      workerId,
      config: {
        timeout: this.taskTimeout
      }
    });
  }
  
  /**
   * Handle messages from workers
   */
  handleWorkerMessage(workerId, message) {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;
    
    switch (message.type) {
      case 'task_completed':
        this.handleTaskCompleted(workerId, message);
        break;
        
      case 'task_error':
        this.handleTaskError(workerId, message);
        break;
        
      case 'heartbeat':
        workerInfo.lastUsed = Date.now();
        break;
        
      default:
        this.emit('worker_message', { workerId, message });
    }
  }
  
  /**
   * Handle task completion from worker
   */
  handleTaskCompleted(workerId, message) {
    const { taskId, result, processingTime } = message;
    const workerInfo = this.workers.get(workerId);
    const taskInfo = this.activeTasks.get(taskId);
    
    if (!taskInfo || !workerInfo) return;
    
    // Update statistics
    this.statistics.tasksCompleted++;
    this.statistics.totalProcessingTime += processingTime;
    this.statistics.averageProcessingTime = 
      this.statistics.totalProcessingTime / this.statistics.tasksCompleted;
    this.statistics.maxProcessingTime = 
      Math.max(this.statistics.maxProcessingTime, processingTime);
    
    // Update worker info
    workerInfo.tasksCompleted++;
    workerInfo.totalProcessingTime += processingTime;
    workerInfo.lastUsed = Date.now();
    workerInfo.currentTask = null;
    workerInfo.isAvailable = true;
    
    // Clear timeout
    if (taskInfo.timeoutId) {
      clearTimeout(taskInfo.timeoutId);
    }
    
    // Remove from tracking
    this.activeTasks.delete(taskId);
    this.busyWorkers.delete(workerInfo);
    this.availableWorkers.push(workerInfo);
    
    // Resolve task promise
    taskInfo.resolve(result);
    
    this.emit('task_completed', {
      taskId,
      workerId,
      result,
      processingTime
    });
    
    // Process next task in queue
    this.processQueue();
  }
  
  /**
   * Handle task error from worker
   */
  handleTaskError(workerId, message) {
    const { taskId, error } = message;
    const taskInfo = this.activeTasks.get(taskId);
    const workerInfo = this.workers.get(workerId);
    
    if (!taskInfo || !workerInfo) return;
    
    this.statistics.tasksFailed++;
    
    // Update worker state
    workerInfo.currentTask = null;
    workerInfo.isAvailable = true;
    workerInfo.lastUsed = Date.now();
    
    // Clear timeout
    if (taskInfo.timeoutId) {
      clearTimeout(taskInfo.timeoutId);
    }
    
    // Remove from tracking
    this.activeTasks.delete(taskId);
    this.busyWorkers.delete(workerInfo);
    this.availableWorkers.push(workerInfo);
    
    // Reject task promise
    taskInfo.reject(new Error(error));
    
    this.emit('task_error', { taskId, workerId, error });
    
    // Process next task
    this.processQueue();
  }
  
  /**
   * Handle worker error
   */
  handleWorkerError(workerId, error) {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;
    
    this.emit('worker_error', { workerId, error: error.message });
    
    // If worker has active task, fail it
    if (workerInfo.currentTask) {
      const taskInfo = this.activeTasks.get(workerInfo.currentTask.id);
      if (taskInfo) {
        taskInfo.reject(new Error(`Worker error: ${error.message}`));
        this.activeTasks.delete(workerInfo.currentTask.id);
      }
    }
    
    // Remove and replace worker
    this.removeWorker(workerId);
    
    // Create replacement if needed
    if (this.workers.size < this.minWorkers && !this.isShuttingDown) {
      this.createWorker().catch(err => {
        this.emit('error', new Error(`Failed to create replacement worker: ${err.message}`));
      });
    }
  }
  
  /**
   * Handle worker exit
   */
  handleWorkerExit(workerId, exitCode) {
    this.emit('worker_exit', { workerId, exitCode });
    this.removeWorker(workerId);
  }
  
  /**
   * Execute a task using the worker pool
   */
  async execute(taskData, options = {}) {
    if (this.isDestroyed || this.isShuttingDown) {
      throw new Error('Worker pool is shut down');
    }
    
    if (this.taskQueue.length >= this.maxQueueSize) {
      throw new Error(`Task queue full (${this.maxQueueSize})`);
    }
    
    const taskId = this.nextTaskId++;
    const priority = options.priority ?? 'normal';
    const timeout = options.timeout ?? this.taskTimeout;
    
    // Create task promise
    const taskPromise = new Promise((resolve, reject) => {
      const taskInfo = {
        id: taskId,
        data: taskData,
        priority,
        timeout,
        queuedAt: Date.now(),
        resolve,
        reject,
        timeoutId: null
      };
      
      // Set up timeout
      if (timeout > 0) {
        taskInfo.timeoutId = setTimeout(() => {
          this.handleTaskTimeout(taskId);
        }, timeout);
      }
      
      this.activeTasks.set(taskId, taskInfo);
      
      // Try immediate execution or queue
      if (this.availableWorkers.length > 0) {
        this.assignTaskToWorker(taskInfo);
      } else {
        this.queueTask(taskInfo);
      }
    });
    
    this.statistics.tasksQueued++;
    return taskPromise;
  }
  
  /**
   * Queue a task for later execution
   */
  queueTask(taskInfo) {
    // Insert based on priority
    if (taskInfo.priority === 'high') {
      this.taskQueue.unshift(taskInfo);
    } else {
      this.taskQueue.push(taskInfo);
    }
    
    // Try to create more workers if needed
    if (this.workers.size < this.maxWorkers && this.taskQueue.length > this.workers.size) {
      this.createWorker().catch(err => {
        this.emit('warning', `Failed to create additional worker: ${err.message}`);
      });
    }
    
    this.emit('task_queued', {
      taskId: taskInfo.id,
      queueSize: this.taskQueue.length,
      priority: taskInfo.priority
    });
  }
  
  /**
   * Assign a task to an available worker
   */
  assignTaskToWorker(taskInfo) {
    const workerInfo = this.availableWorkers.pop();
    if (!workerInfo) {
      this.queueTask(taskInfo);
      return;
    }
    
    // Update worker state
    workerInfo.isAvailable = false;
    workerInfo.currentTask = taskInfo;
    workerInfo.lastUsed = Date.now();
    
    this.busyWorkers.add(workerInfo);
    
    // Send task to worker
    workerInfo.worker.postMessage({
      type: 'execute_task',
      taskId: taskInfo.id,
      taskData: taskInfo.data,
      startTime: Date.now()
    });
    
    this.emit('task_assigned', {
      taskId: taskInfo.id,
      workerId: workerInfo.id,
      queueTime: Date.now() - taskInfo.queuedAt
    });
  }
  
  /**
   * Process queued tasks
   */
  processQueue() {
    while (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      const taskInfo = this.taskQueue.shift();
      this.assignTaskToWorker(taskInfo);
    }
  }
  
  /**
   * Handle task timeout
   */
  handleTaskTimeout(taskId) {
    const taskInfo = this.activeTasks.get(taskId);
    if (!taskInfo) return;
    
    this.statistics.queueTimeouts++;
    
    // Find and terminate the worker handling this task
    for (const [workerId, workerInfo] of this.workers) {
      if (workerInfo.currentTask && workerInfo.currentTask.id === taskId) {
        // Terminate worker and create replacement
        this.terminateWorker(workerId);
        break;
      }
    }
    
    this.activeTasks.delete(taskId);
    taskInfo.reject(new Error(`Task timeout after ${taskInfo.timeout}ms`));
    
    this.emit('task_timeout', { taskId, timeout: taskInfo.timeout });
  }
  
  /**
   * Remove a worker from the pool
   */
  removeWorker(workerId) {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;
    
    // Remove from available workers
    const availableIndex = this.availableWorkers.indexOf(workerInfo);
    if (availableIndex !== -1) {
      this.availableWorkers.splice(availableIndex, 1);
    }
    
    // Remove from busy workers
    this.busyWorkers.delete(workerInfo);
    
    // Remove from main collection
    this.workers.delete(workerId);
    this.statistics.workersDestroyed++;
    
    this.emit('worker_removed', { workerId, remainingWorkers: this.workers.size });
  }
  
  /**
   * Terminate a worker forcefully
   */
  async terminateWorker(workerId) {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;
    
    try {
      await workerInfo.worker.terminate();
    } catch (error) {
      this.emit('warning', `Error terminating worker ${workerId}: ${error.message}`);
    }
    
    this.removeWorker(workerId);
    
    // Create replacement if needed
    if (this.workers.size < this.minWorkers && !this.isShuttingDown) {
      this.createWorker().catch(err => {
        this.emit('error', new Error(`Failed to create replacement worker: ${err.message}`));
      });
    }
  }
  
  /**
   * Start maintenance timer for pool optimization
   */
  startMaintenance() {
    this.maintenanceTimer = setInterval(() => {
      this.performMaintenance();
    }, 60000); // Every minute
    
    this.maintenanceTimer.unref();
  }
  
  /**
   * Perform pool maintenance
   */
  performMaintenance() {
    const now = Date.now();
    let idleWorkers = 0;
    
    // Check for idle workers
    for (const [workerId, workerInfo] of this.workers) {
      if (workerInfo.isAvailable && now - workerInfo.lastUsed > this.idleTimeout) {
        idleWorkers++;
        
        // Remove excess idle workers
        if (this.workers.size > this.minWorkers) {
          this.terminateWorker(workerId);
        }
      }
    }
    
    this.emit('maintenance', {
      totalWorkers: this.workers.size,
      availableWorkers: this.availableWorkers.length,
      busyWorkers: this.busyWorkers.size,
      idleWorkers,
      queueSize: this.taskQueue.length
    });
  }
  
  /**
   * Get default worker script path
   */
  getDefaultWorkerScript() {
    const currentFile = fileURLToPath(import.meta.url);
    const currentDir = path.dirname(currentFile);
    return path.join(currentDir, 'task-worker.js');
  }
  
  /**
   * Get pool statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      currentWorkers: this.workers.size,
      availableWorkers: this.availableWorkers.length,
      busyWorkers: this.busyWorkers.size,
      queuedTasks: this.taskQueue.length,
      activeTasks: this.activeTasks.size,
      efficiency: this.statistics.tasksCompleted > 0 
        ? (this.statistics.tasksCompleted / (this.statistics.tasksCompleted + this.statistics.tasksFailed)) 
        : 0,
      uptime: Date.now() - (this.statistics.startTime ?? Date.now())
    };
  }
  
  /**
   * Shutdown the worker pool gracefully
   */
  async shutdown(timeout = 30000) {
    this.isShuttingDown = true;
    
    // Stop maintenance
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = null;
    }
    
    this.emit('shutting_down', {
      activeWorkers: this.workers.size,
      activeTasks: this.activeTasks.size
    });
    
    // Wait for active tasks to complete or timeout
    const shutdownPromise = this.waitForTasks(timeout);
    
    try {
      await shutdownPromise;
    } catch (error) {
      this.emit('warning', `Shutdown timeout: ${error.message}`);
    }
    
    // Terminate all workers
    const terminationPromises = [];
    for (const [workerId] of this.workers) {
      terminationPromises.push(this.terminateWorker(workerId));
    }
    
    await Promise.all(terminationPromises);
    
    this.isDestroyed = true;
    this.emit('shutdown_complete', { finalStatistics: this.getStatistics() });
  }
  
  /**
   * Wait for active tasks to complete
   */
  async waitForTasks(timeout) {
    if (this.activeTasks.size === 0) return;
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Shutdown timeout waiting for tasks'));
      }, timeout);
      
      const checkTasks = () => {
        if (this.activeTasks.size === 0) {
          clearTimeout(timeoutId);
          resolve();
        } else {
          setTimeout(checkTasks, 100);
        }
      };
      
      checkTasks();
    });
  }
}

export { WorkerPool };