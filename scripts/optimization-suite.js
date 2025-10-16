#!/usr/bin/env node

/**
 * Optimization Suite Script
 * Orchestrates all optimization tools and processes
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

class OptimizationSuite {
  constructor(options = {}) {
    this.options = {
      parallel: options.parallel || false,
      verbose: options.verbose || false,
      skipTests: options.skipTests || false,
      outputDir: options.outputDir || 'reports'
    };
    
    this.results = {
      timestamp: new Date().toISOString(),
      suite: 'optimization-suite',
      options: this.options,
      optimizations: [],
      metrics: {
        startTime: Date.now(),
        endTime: null,
        duration: null
      },
      errors: [],
      warnings: []
    };
    
    this.optimizationTasks = [
      {
        name: 'System Health Check',
        script: 'health-check.js',
        priority: 1,
        required: true
      },
      {
        name: 'Performance Analysis',
        script: 'performance-optimizer.js',
        priority: 2,
        required: true
      },
      {
        name: 'Memory Optimization',
        script: 'autonomous-performance-optimizer.js',
        priority: 2,
        required: false
      },
      {
        name: 'System Optimization',
        script: 'system-optimization-complete.js',
        priority: 3,
        required: false
      },
      {
        name: 'Ultra Optimization',
        script: 'ultra-optimization-nexus.js',
        priority: 4,
        required: false
      },
      {
        name: 'Breakthrough Optimization',
        script: 'breakthrough-system-optimizer.js',
        priority: 5,
        required: false
      }
    ];
  }

  async runOptimizationSuite() {
    console.log('🚀 Starting Optimization Suite...');
    console.log(`⚙️  Mode: ${this.options.parallel ? 'Parallel' : 'Sequential'}`);
    console.log(`📋 Total optimizations: ${this.optimizationTasks.length}`);
    
    try {
      if (this.options.parallel) {
        await this.runParallelOptimizations();
      } else {
        await this.runSequentialOptimizations();
      }
      
      this.results.metrics.endTime = Date.now();
      this.results.metrics.duration = this.results.metrics.endTime - this.results.metrics.startTime;
      
      await this.generateSuiteReport();
      
      console.log('✅ Optimization Suite completed successfully!');
      console.log(`⏱️  Total time: ${Math.round(this.results.metrics.duration / 1000)}s`);
      console.log(`✅ Successful: ${this.results.optimizations.filter(o => o.status === 'completed').length}`);
      console.log(`❌ Failed: ${this.results.optimizations.filter(o => o.status === 'failed').length}`);
      
    } catch (error) {
      console.error('❌ Optimization Suite failed:', error.message);
      this.results.errors.push(error.message);
      process.exit(1);
    }
  }

  async runSequentialOptimizations() {
    console.log('🔄 Running optimizations sequentially...');
    
    // Sort by priority
    const sortedTasks = [...this.optimizationTasks].sort((a, b) => a.priority - b.priority);
    
    for (const task of sortedTasks) {
      try {
        console.log(`▶️  Starting: ${task.name}`);
        const result = await this.runOptimizationTask(task);
        
        this.results.optimizations.push({
          name: task.name,
          script: task.script,
          status: 'completed',
          duration: result.duration,
          output: result.output,
          timestamp: new Date().toISOString()
        });
        
        console.log(`✅ Completed: ${task.name} (${Math.round(result.duration)}ms)`);
        
      } catch (error) {
        const errorMsg = `${task.name}: ${error.message}`;
        
        if (task.required) {
          console.error(`❌ Critical failure in ${task.name}:`, error.message);
          this.results.errors.push(errorMsg);
          throw error;
        } else {
          console.warn(`⚠️  Optional task failed - ${task.name}:`, error.message);
          this.results.warnings.push(errorMsg);
          
          this.results.optimizations.push({
            name: task.name,
            script: task.script,
            status: 'failed',
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }

  async runParallelOptimizations() {
    console.log('⚡ Running optimizations in parallel...');
    
    // Group tasks by priority
    const priorityGroups = {};
    for (const task of this.optimizationTasks) {
      if (!priorityGroups[task.priority]) {
        priorityGroups[task.priority] = [];
      }
      priorityGroups[task.priority].push(task);
    }
    
    // Run each priority group sequentially, but tasks within groups in parallel
    const priorities = Object.keys(priorityGroups).sort((a, b) => a - b);
    
    for (const priority of priorities) {
      const tasks = priorityGroups[priority];
      console.log(`📋 Running priority ${priority} tasks (${tasks.length} tasks)`);
      
      const promises = tasks.map(task => this.runOptimizationTaskSafe(task));
      const results = await Promise.allSettled(promises);
      
      results.forEach((result, index) => {
        const task = tasks[index];
        
        if (result.status === 'fulfilled') {
          this.results.optimizations.push({
            name: task.name,
            script: task.script,
            status: 'completed',
            duration: result.value.duration,
            output: result.value.output,
            timestamp: new Date().toISOString()
          });
          console.log(`✅ Completed: ${task.name}`);
        } else {
          const errorMsg = `${task.name}: ${result.reason.message}`;
          
          if (task.required) {
            console.error(`❌ Critical failure in ${task.name}:`, result.reason.message);
            this.results.errors.push(errorMsg);
          } else {
            console.warn(`⚠️  Optional task failed - ${task.name}:`, result.reason.message);
            this.results.warnings.push(errorMsg);
          }
          
          this.results.optimizations.push({
            name: task.name,
            script: task.script,
            status: 'failed',
            error: result.reason.message,
            timestamp: new Date().toISOString()
          });
        }
      });
    }
  }

  async runOptimizationTaskSafe(task) {
    try {
      return await this.runOptimizationTask(task);
    } catch (error) {
      if (task.required) {
        throw error;
      }
      return { duration: 0, output: '', error: error.message };
    }
  }

  async runOptimizationTask(task) {
    const scriptPath = path.join(__dirname, task.script);
    
    if (!existsSync(scriptPath)) {
      throw new Error(`Script not found: ${task.script}`);
    }
    
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const child = spawn('node', [scriptPath], {
        stdio: this.options.verbose ? 'inherit' : 'pipe',
        env: {
          ...process.env,
          OPTIMIZATION_SUITE: 'true',
          NODE_ENV: process.env.NODE_ENV || 'production'
        }
      });
      
      let output = '';
      let error = '';
      
      if (!this.options.verbose) {
        child.stdout?.on('data', (data) => {
          output += data.toString();
        });
        
        child.stderr?.on('data', (data) => {
          error += data.toString();
        });
      }
      
      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        
        if (code === 0) {
          resolve({ duration, output, error });
        } else {
          reject(new Error(`Script exited with code ${code}: ${error || 'Unknown error'}`));
        }
      });
      
      child.on('error', (err) => {
        reject(new Error(`Failed to start script: ${err.message}`));
      });
      
      // Set timeout for long-running scripts
      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Script timeout: ${task.script}`));
      }, 300000); // 5 minutes
    });
  }

  async generateSuiteReport() {
    console.log('📊 Generating optimization suite report...');
    
    const summary = {
      totalOptimizations: this.optimizationTasks.length,
      completedOptimizations: this.results.optimizations.filter(o => o.status === 'completed').length,
      failedOptimizations: this.results.optimizations.filter(o => o.status === 'failed').length,
      totalDuration: this.results.metrics.duration,
      averageOptimizationTime: this.results.optimizations.length > 0 ?
        this.results.optimizations.reduce((sum, o) => sum + (o.duration || 0), 0) / this.results.optimizations.length : 0,
      successRate: (this.results.optimizations.filter(o => o.status === 'completed').length / this.optimizationTasks.length) * 100
    };
    
    const reportData = {
      ...this.results,
      summary
    };
    
    try {
      // Create output directory if it doesn't exist
      const outputDir = path.join(process.cwd(), this.options.outputDir);
      if (!existsSync(outputDir)) {
        await import('fs').then(fs => fs.mkdirSync(outputDir, { recursive: true }));
      }
      
      const reportPath = path.join(outputDir, `optimization-suite-${Date.now()}.json`);
      writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
      console.log(`📄 Report saved to: ${reportPath}`);
      
      // Also create a summary report
      const summaryPath = path.join(outputDir, 'optimization-suite-latest.json');
      writeFileSync(summaryPath, JSON.stringify(reportData, null, 2));
      
    } catch (error) {
      console.warn('⚠️  Could not save report:', error.message);
    }
  }

  // Static method to check optimization health
  static async checkOptimizationHealth() {
    const scriptsDir = path.join(path.dirname(__filename));
    const requiredScripts = [
      'health-check.js',
      'performance-optimizer.js',
      'system-optimization-complete.js'
    ];
    
    const missing = [];
    for (const script of requiredScripts) {
      if (!existsSync(path.join(scriptsDir, script))) {
        missing.push(script);
      }
    }
    
    if (missing.length > 0) {
      console.warn(`⚠️  Missing optimization scripts: ${missing.join(', ')}`);
      return false;
    }
    
    return true;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  const options = {
    parallel: args.includes('--parallel'),
    verbose: args.includes('--verbose'),
    skipTests: args.includes('--skip-tests')
  };
  
  if (args.includes('--help')) {
    console.log(`
🚀 Optimization Suite Usage:

node optimization-suite.js [options]

Options:
  --parallel     Run optimizations in parallel (faster but uses more resources)
  --verbose      Show detailed output from all optimization scripts
  --skip-tests   Skip validation tests
  --help         Show this help message

Examples:
  node optimization-suite.js
  node optimization-suite.js --parallel --verbose
  node optimization-suite.js --skip-tests
`);
    process.exit(0);
  }
  
  // Check health first
  const healthOk = await OptimizationSuite.checkOptimizationHealth();
  if (!healthOk) {
    console.error('❌ Optimization suite health check failed');
    process.exit(1);
  }
  
  const suite = new OptimizationSuite(options);
  suite.runOptimizationSuite().catch((error) => {
    console.error('❌ Suite execution failed:', error.message);
    process.exit(1);
  });
}

export default OptimizationSuite;
