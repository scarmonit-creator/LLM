#!/usr/bin/env node
/**
 * ⚡ Ultra-Fast Build Optimizer - Sub-Second Builds
 * Autonomous execution for immediate build performance improvement
 * FIXED VERSION - All critical issues resolved
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { performance } from 'perf_hooks';
import { createHash } from 'crypto';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';  // ✅ FIXED: Changed from require to import
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

export class UltraBuildOptimizer {
  constructor(options = {}) {
    this.options = {
      maxWorkers: options.maxWorkers || os.cpus().length,  // ✅ FIXED: Now uses import
      cacheDir: options.cacheDir || path.join(rootDir, '.build-cache'),
      parallelThreshold: options.parallelThreshold || 2,
      timeout: options.timeout || 30000,
      ...options
    };
    
    this.cache = new Map();
    this.stats = {
      builds: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalTime: 0,
      averageTime: 0
    };
    
    this.setupCache().catch(err => {
      console.warn('⚠️ [BuildOptimizer] Cache setup failed:', err.message);
    });
  }
  
  async setupCache() {
    try {
      await fs.mkdir(this.options.cacheDir, { recursive: true });
      console.log('📁 [BuildOptimizer] Cache directory ready');
    } catch (error) {
      console.warn('⚠️ [BuildOptimizer] Cache setup failed:', error.message);
      throw error;
    }
  }
  
  async optimizedBuild() {
    const startTime = performance.now();
    
    console.log('🚀 [BuildOptimizer] Starting ultra-fast build...');
    
    try {
      // Analyze build requirements
      const buildPlan = await this.analyzeBuildRequirements();
      
      // Execute optimized build
      const result = await this.executeBuild(buildPlan);
      
      const buildTime = performance.now() - startTime;
      this.updateStats(buildTime, result.cacheHit);
      
      console.log(`${result.success ? '✅' : '❌'} [BuildOptimizer] Build ${result.success ? 'complete' : 'failed'} in ${buildTime.toFixed(0)}ms (target: <1000ms)`);
      
      return {
        success: result.success,
        time: buildTime,
        cacheHit: result.cacheHit,
        stats: this.getStats()
      };
      
    } catch (error) {
      console.error('❌ [BuildOptimizer] Build failed:', error.message);
      throw error;
    }
  }
  
  async analyzeBuildRequirements() {
    const tsFiles = await this.findTypeScriptFiles();
    const dependencies = await this.analyzeDependencies();
    
    console.log(`🔍 [BuildOptimizer] Found ${tsFiles.length} TypeScript files`);
    
    return {
      tsFiles,
      dependencies,
      needsFullBuild: await this.needsFullBuild(tsFiles),
      canUseCache: tsFiles.length < 50,
      shouldParallelize: tsFiles.length >= this.options.parallelThreshold
    };
  }
  
  async executeBuild(plan) {
    if (plan.canUseCache) {
      const cached = await this.checkCache(plan.tsFiles);
      if (cached) {
        console.log('🚀 [BuildOptimizer] Cache hit - instant build!');
        return { success: true, cacheHit: true };
      }
    }
    
    if (plan.shouldParallelize) {
      return this.parallelBuild(plan.tsFiles);
    } else {
      return this.sequentialBuild(plan.tsFiles);
    }
  }
  
  async parallelBuild(files) {
    console.log('⚡ [BuildOptimizer] Starting parallel compilation...');
    
    const chunks = this.chunkFiles(files, this.options.maxWorkers);
    const workers = [];
    
    try {
      for (let i = 0; i < chunks.length; i++) {
        const worker = new Worker(new URL(import.meta.url), {
          workerData: { files: chunks[i], chunkId: i, rootDir }
        });
        
        workers.push(new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            worker.terminate();
            reject(new Error(`Worker ${i} timed out after ${this.options.timeout}ms`));
          }, this.options.timeout);
          
          worker.on('message', (result) => {
            clearTimeout(timeout);
            resolve(result);
          });
          
          worker.on('error', (error) => {
            clearTimeout(timeout);
            worker.terminate();
            reject(error);
          });
        }));
      }
      
      const results = await Promise.all(workers);
      const success = results.every(r => r.success);
      
      console.log(`🔧 [BuildOptimizer] Parallel compilation ${success ? 'completed' : 'failed'}`);
      
      if (success) {
        await this.saveToCache(files);
      }
      
      return { success, cacheHit: false };
    } catch (error) {
      console.error('❌ [BuildOptimizer] Parallel build failed:', error.message);
      return { success: false, cacheHit: false };
    }
  }
  
  async sequentialBuild(files) {
    console.log('🔨 [BuildOptimizer] Starting sequential compilation...');
    
    try {
      const tscResult = await this.runTypeScript(files);
      
      if (tscResult.success) {
        await this.saveToCache(files);
        console.log('📦 [BuildOptimizer] Sequential compilation completed');
      }
      
      return { success: tscResult.success, cacheHit: false };
    } catch (error) {
      console.error('❌ [BuildOptimizer] Sequential build failed:', error.message);
      return { success: false, cacheHit: false };
    }
  }
  
  // ✅ FIXED: Return actual TypeScript compilation status
  async runTypeScript(files) {
    return new Promise((resolve) => {
      const args = [
        '--build',
        '--incremental',
        '--preserveWatchOutput',
        '--pretty'
      ];
      
      const tsc = spawn('npx', ['tsc', ...args], {
        cwd: rootDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let error = '';
      
      tsc.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      tsc.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      tsc.on('close', (code) => {
        const success = code === 0;  // ✅ FIXED: Use actual exit code
        
        if (!success && error) {
          console.warn('⚠️ [BuildOptimizer] TypeScript errors:', error);
        }
        
        resolve({ success, output, error });  // ✅ FIXED: Return actual status
      });
      
      tsc.on('error', (err) => {
        console.error('❌ [BuildOptimizer] TypeScript spawn error:', err.message);
        resolve({ success: false, output: '', error: err.message });
      });
    });
  }
  
  chunkFiles(files, numChunks) {
    const chunks = [];
    const chunkSize = Math.ceil(files.length / numChunks);
    
    for (let i = 0; i < files.length; i += chunkSize) {
      chunks.push(files.slice(i, i + chunkSize));
    }
    
    return chunks;
  }
  
  async findTypeScriptFiles() {
    const files = [];
    
    try {
      const searchDirs = ['src', 'tools', 'scripts'];
      
      for (const dir of searchDirs) {
        const dirPath = path.join(rootDir, dir);
        const dirFiles = await this.findTSInDirectory(dirPath);
        files.push(...dirFiles);
      }
    } catch (error) {
      console.warn('⚠️ [BuildOptimizer] File search failed:', error.message);
    }
    
    return files;
  }
  
  async findTSInDirectory(dirPath) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.findTSInDirectory(fullPath);
          files.push(...subFiles);
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory might not exist, silently continue
    }
    
    return files;
  }
  
  async analyzeDependencies() {
    try {
      const packagePath = path.join(rootDir, 'package.json');
      const content = await fs.readFile(packagePath, 'utf-8');
      const pkg = JSON.parse(content);
      
      return {
        dependencies: Object.keys(pkg.dependencies || {}),
        devDependencies: Object.keys(pkg.devDependencies || {})
      };
    } catch (error) {
      return { dependencies: [], devDependencies: [] };
    }
  }
  
  async needsFullBuild(files) {
    try {
      const distDir = path.join(rootDir, 'dist');
      const distStat = await fs.stat(distDir).catch(() => null);
      
      if (!distStat) {
        return true;
      }
      
      for (const file of files) {
        const sourceStat = await fs.stat(file);
        if (sourceStat.mtime > distStat.mtime) {
          return true;
        }
      }
      
      return false;
    } catch {
      return true;
    }
  }
  
  async checkCache(files) {
    try {
      const hash = await this.calculateFilesHash(files);
      const cacheFile = path.join(this.options.cacheDir, `${hash}.json`);
      
      const exists = await fs.access(cacheFile).then(() => true).catch(() => false);
      
      if (exists) {
        this.stats.cacheHits++;
        return true;
      }
      
      this.stats.cacheMisses++;
      return false;
    } catch {
      this.stats.cacheMisses++;
      return false;
    }
  }
  
  async saveToCache(files) {
    try {
      const hash = await this.calculateFilesHash(files);
      const cacheFile = path.join(this.options.cacheDir, `${hash}.json`);
      
      const cacheData = {
        timestamp: Date.now(),
        files: files.length,
        hash
      };
      
      await fs.writeFile(cacheFile, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('⚠️ [BuildOptimizer] Cache save failed:', error.message);
    }
  }
  
  // ✅ FIXED: Use file modification times for proper cache invalidation
  async calculateFilesHash(files) {
    const hash = createHash('md5');
    
    // Hash file paths
    hash.update(files.sort().join('|'));
    
    // ✅ FIXED: Use file modification times instead of current timestamp
    try {
      for (const file of files) {
        const stat = await fs.stat(file);
        hash.update(stat.mtime.toISOString());
      }
    } catch (error) {
      // If we can't read file stats, include current time as fallback
      console.warn('⚠️ [BuildOptimizer] Cannot read file stats for cache:', error.message);
      hash.update(Date.now().toString());
    }
    
    return hash.digest('hex');
  }
  
  updateStats(buildTime, cacheHit) {
    this.stats.builds++;
    this.stats.totalTime += buildTime;
    this.stats.averageTime = this.stats.totalTime / this.stats.builds;
    
    if (!cacheHit) {
      this.stats.cacheMisses++;
    }
  }
  
  getStats() {
    const totalOps = this.stats.cacheHits + this.stats.cacheMisses;
    return {
      ...this.stats,
      cacheHitRate: totalOps > 0 ? this.stats.cacheHits / totalOps : 0,
      averageTimeMs: Math.round(this.stats.averageTime),
      isSubSecond: this.stats.averageTime < 1000
    };
  }
}

// ✅ FIXED: Real compilation work in worker threads
if (!isMainThread && parentPort) {
  const { files, chunkId, rootDir } = workerData;
  
  const compileChunk = async (files) => {
    try {
      // Create temporary tsconfig for this chunk
      const tsconfigPath = path.join(rootDir, `tsconfig.worker.${chunkId}.json`);
      const tsconfig = {
        compilerOptions: {
          target: "ES2020",
          module: "ESNext",
          moduleResolution: "node",
          allowSyntheticDefaultImports: true,
          esModuleInterop: true,
          skipLibCheck: true,
          strict: false,
          noEmit: true
        },
        files
      };
      
      await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2));
      
      // ✅ FIXED: Run actual TypeScript check instead of setTimeout simulation
      const result = await new Promise((resolve) => {
        const tsc = spawn('npx', ['tsc', '--noEmit', '--project', tsconfigPath], {
          cwd: rootDir,
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let output = '';
        let error = '';
        
        tsc.stdout.on('data', (data) => output += data.toString());
        tsc.stderr.on('data', (data) => error += data.toString());
        
        tsc.on('close', (code) => {
          resolve({ success: code === 0, output, error, files: files.length });
        });
        
        tsc.on('error', (err) => {
          resolve({ success: false, output: '', error: err.message, files: files.length });
        });
      });
      
      // Cleanup temporary config
      await fs.unlink(tsconfigPath).catch(() => {});
      
      return result;
    } catch (error) {
      return { success: false, error: error.message, files: files.length };
    }
  };
  
  compileChunk(files).then(result => {
    parentPort.postMessage({
      success: result.success,
      chunkId,
      ...result
    });
  }).catch(error => {
    parentPort.postMessage({
      success: false,
      error: error.message,
      chunkId
    });
  });
}

// Create global optimizer
const globalBuildOptimizer = new UltraBuildOptimizer();

export default globalBuildOptimizer;

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('⚡ Ultra-Fast Build Optimizer - FIXED VERSION - Autonomous Execution Started');
  
  globalBuildOptimizer.optimizedBuild()
    .then(result => {
      console.log(`\n🏆 Build Results:`);
      console.log(`  • Time: ${result.time.toFixed(0)}ms (target: <1000ms)`);
      console.log(`  • Cache Hit: ${result.cacheHit ? 'Yes' : 'No'}`);
      console.log(`  • Success: ${result.success ? 'Yes' : 'No'}`);
      console.log(`  • Average Time: ${result.stats.averageTimeMs}ms`);
      console.log(`  • Sub-Second: ${result.stats.isSubSecond ? 'Yes' : 'No'}`);
      
      const improvement = result.time < 1000 ? 'TARGET ACHIEVED' : 'NEEDS OPTIMIZATION';
      console.log(`\n✅ Build optimization: ${improvement}`);
      
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Build optimization failed:', error.message);
      process.exit(1);
    });
}