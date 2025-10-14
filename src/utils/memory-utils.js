// Memory-efficient utilities inspired by Chromium patterns

export class WeakRefCache {
  constructor(maxSize = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.cleanupTimer = setInterval(() => this._cleanup(), 30000); // 30s cleanup
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      this._cleanup();
    }
    this.cache.set(key, new WeakRef(value));
  }

  get(key) {
    const ref = this.cache.get(key);
    if (!ref) return undefined;
    
    const value = ref.deref();
    if (value === undefined) {
      this.cache.delete(key);
      return undefined;
    }
    return value;
  }

  _cleanup() {
    for (const [key, ref] of this.cache) {
      if (ref.deref() === undefined) {
        this.cache.delete(key);
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupTimer);
    this.cache.clear();
  }
}

export class ObjectPool {
  constructor(factory, resetFn, initialSize = 10) {
    this.factory = factory;
    this.resetFn = resetFn;
    this.pool = [];
    
    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  acquire() {
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    return this.factory();
  }

  release(obj) {
    if (this.resetFn) {
      this.resetFn(obj);
    }
    this.pool.push(obj);
  }
}

export class BatchProcessor {
  constructor(processFn, batchSize = 10, flushInterval = 200) {
    this.processFn = processFn;
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.queue = [];
    this.timer = null;
  }

  add(item) {
    this.queue.push(item);
    
    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    if (this.queue.length > 0) {
      const batch = this.queue.splice(0);
      this.processFn(batch);
    }
  }
}

// Chromium-inspired flat map for cache-friendly operations
export class FlatMap {
  constructor() {
    this.keys = [];
    this.values = [];
  }

  set(key, value) {
    const index = this.keys.indexOf(key);
    if (index >= 0) {
      this.values[index] = value;
    } else {
      this.keys.push(key);
      this.values.push(value);
    }
  }

  get(key) {
    const index = this.keys.indexOf(key);
    return index >= 0 ? this.values[index] : undefined;
  }

  has(key) {
    return this.keys.includes(key);
  }

  delete(key) {
    const index = this.keys.indexOf(key);
    if (index >= 0) {
      this.keys.splice(index, 1);
      this.values.splice(index, 1);
      return true;
    }
    return false;
  }

  clear() {
    this.keys.length = 0;
    this.values.length = 0;
  }

  get size() {
    return this.keys.length;
  }

  *entries() {
    for (let i = 0; i < this.keys.length; i++) {
      yield [this.keys[i], this.values[i]];
    }
  }
}

// Memory pressure monitor inspired by Chromium
export class MemoryPressureMonitor {
  constructor(warningThreshold = 0.8, criticalThreshold = 0.9) {
    this.warningThreshold = warningThreshold;
    this.criticalThreshold = criticalThreshold;
    this.listeners = new Set();
    this.monitoring = false;
    this.interval = null;
  }

  start(intervalMs = 5000) {
    if (this.monitoring) return;
    
    this.monitoring = true;
    this.interval = setInterval(() => {
      this.checkMemoryPressure();
    }, intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.monitoring = false;
  }

  onPressure(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  checkMemoryPressure() {
    const usage = process.memoryUsage();
    const heapUsed = usage.heapUsed;
    const heapTotal = usage.heapTotal;
    const usageRatio = heapUsed / heapTotal;

    let level = 'normal';
    if (usageRatio > this.criticalThreshold) {
      level = 'critical';
    } else if (usageRatio > this.warningThreshold) {
      level = 'warning';
    }

    if (level !== 'normal') {
      const event = {
        level,
        usage: usageRatio,
        heapUsed,
        heapTotal,
        timestamp: Date.now()
      };

      this.listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in memory pressure callback:', error);
        }
      });
    }
  }

  destroy() {
    this.stop();
    this.listeners.clear();
  }
}

// Task scheduler inspired by Chromium's task system
export class TaskScheduler {
  constructor() {
    this.queues = new Map(); // priority -> tasks[]
    this.running = false;
    this.currentTask = null;
  }

  schedule(task, priority = 'normal') {
    if (!this.queues.has(priority)) {
      this.queues.set(priority, []);
    }
    
    this.queues.get(priority).push(task);
    
    if (!this.running) {
      setImmediate(() => this.processTasks());
    }
  }

  async processTasks() {
    if (this.running) return;
    this.running = true;

    try {
      // Process tasks by priority: high -> normal -> low
      const priorities = ['high', 'normal', 'low'];
      
      for (const priority of priorities) {
        const queue = this.queues.get(priority);
        if (queue && queue.length > 0) {
          const task = queue.shift();
          this.currentTask = task;
          
          try {
            await task();
          } catch (error) {
            console.error('Task execution error:', error);
          }
          
          this.currentTask = null;
          
          // Yield control after each task
          if (queue.length > 0 || this._hasMoreTasks()) {
            setImmediate(() => this.processTasks());
            break;
          }
        }
      }
    } finally {
      this.running = false;
    }
  }

  _hasMoreTasks() {
    for (const queue of this.queues.values()) {
      if (queue.length > 0) return true;
    }
    return false;
  }

  clear() {
    this.queues.clear();
    this.currentTask = null;
    this.running = false;
  }
}

// Resource tracker for monitoring system resources
export class ResourceTracker {
  constructor() {
    this.snapshots = [];
    this.maxSnapshots = 100;
  }

  takeSnapshot(label = '') {
    const snapshot = {
      timestamp: Date.now(),
      label,
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime()
    };

    this.snapshots.push(snapshot);
    
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  getMemoryTrend(windowSize = 10) {
    const recent = this.snapshots.slice(-windowSize);
    if (recent.length < 2) return null;

    const first = recent[0];
    const last = recent[recent.length - 1];
    
    return {
      heapUsedDelta: last.memory.heapUsed - first.memory.heapUsed,
      heapTotalDelta: last.memory.heapTotal - first.memory.heapTotal,
      externalDelta: last.memory.external - first.memory.external,
      timeDelta: last.timestamp - first.timestamp,
      trend: last.memory.heapUsed > first.memory.heapUsed ? 'increasing' : 'decreasing'
    };
  }

  getCpuTrend(windowSize = 10) {
    const recent = this.snapshots.slice(-windowSize);
    if (recent.length < 2) return null;

    const first = recent[0];
    const last = recent[recent.length - 1];
    
    const userDelta = last.cpuUsage.user - first.cpuUsage.user;
    const systemDelta = last.cpuUsage.system - first.cpuUsage.system;
    const timeDelta = last.timestamp - first.timestamp;

    return {
      userCpuPercent: (userDelta / (timeDelta * 1000)) * 100,
      systemCpuPercent: (systemDelta / (timeDelta * 1000)) * 100,
      totalCpuPercent: ((userDelta + systemDelta) / (timeDelta * 1000)) * 100
    };
  }

  clear() {
    this.snapshots.length = 0;
  }
}