/**
 * Ultra-Fast Build System
 * 
 * Implements next-generation build performance optimization:
 * - Aggressive TypeScript incremental compilation
 * - Parallel compilation with worker threads
 * - Intelligent webpack optimization and caching
 * - Content-based build result caching
 * - Target: 2.3s → <1s build times (57% faster)
 */

import * as ts from 'typescript';
import * as webpack from 'webpack';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { EventEmitter } from 'events';

export interface BuildConfig {
  rootDir: string;
  outDir: string;
  cacheDir: string;
  maxWorkers: number;
  enableIncrementalCompilation: boolean;
  enableParallelBuild: boolean;
  enableWebpackOptimization: boolean;
  enableBuildCache: boolean;
}

export interface BuildMetrics {
  totalTime: number;
  compilationTime: number;
  bundlingTime: number;
  cacheHits: number;
  cacheMisses: number;
  filesProcessed: number;
  workersUsed: number;
  memoryUsage: number;
}

class IncrementalCompiler {
  private program: ts.Program | null = null;
  private host: ts.CompilerHost;
  private options: ts.CompilerOptions;
  private fileVersions = new Map<string, string>();
  private lastBuildTime = 0;

  constructor(private config: ts.CompilerOptions) {
    this.options = {
      ...config,
      incremental: true,
      tsBuildInfoFile: path.join(config.outDir || './dist', '.tsbuildinfo'),
      skipLibCheck: true,
      declaration: false, // Skip for faster builds
      sourceMap: process.env.NODE_ENV !== 'production'
    };
    
    this.host = this.createCompilerHost();
  }

  private createCompilerHost(): ts.CompilerHost {
    const host = ts.createCompilerHost(this.options);
    const originalReadFile = host.readFile;
    
    // Cache file reads
    const fileCache = new Map<string, { content: string; version: string; timestamp: number }>();
    
    host.readFile = (fileName: string) => {
      const cached = fileCache.get(fileName);
      if (cached && Date.now() - cached.timestamp < 5000) { // 5 second cache
        return cached.content;
      }
      
      const content = originalReadFile.call(host, fileName);
      if (content) {
        const version = crypto.createHash('md5').update(content).digest('hex');
        fileCache.set(fileName, { content, version, timestamp: Date.now() });
        this.fileVersions.set(fileName, version);
      }
      
      return content;
    };
    
    return host;
  }

  async compile(fileNames: string[]): Promise<{ success: boolean; diagnostics: ts.Diagnostic[]; duration: number }> {
    const startTime = performance.now();
    
    try {
      // Create or update program
      const oldProgram = this.program;
      this.program = ts.createProgram({
        rootNames: fileNames,
        options: this.options,
        host: this.host,
        oldProgram // Enable incremental compilation
      });
      
      // Get diagnostics
      const diagnostics = [
        ...this.program.getConfigFileParsingDiagnostics(),
        ...this.program.getSyntacticDiagnostics(),
        ...this.program.getSemanticDiagnostics()
      ];
      
      if (diagnostics.length > 0) {
        const duration = performance.now() - startTime;
        return { success: false, diagnostics, duration };
      }
      
      // Emit only changed files
      const emitResult = this.program.emit();
      
      const allDiagnostics = [
        ...diagnostics,
        ...emitResult.diagnostics
      ];
      
      const duration = performance.now() - startTime;
      this.lastBuildTime = Date.now();
      
      return {
        success: !emitResult.emitSkipped && allDiagnostics.length === 0,
        diagnostics: allDiagnostics,
        duration
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error('TypeScript compilation error:', error);
      return {
        success: false,
        diagnostics: [{
          file: undefined,
          start: undefined,
          length: undefined,
          messageText: `Compilation error: ${error.message}`,
          category: ts.DiagnosticCategory.Error,
          code: 0
        }],
        duration
      };
    }
  }

  getChangedFiles(fileNames: string[]): string[] {
    if (!this.program || this.lastBuildTime === 0) {
      return fileNames; // First build, all files are "changed"
    }
    
    const changed: string[] = [];
    
    for (const fileName of fileNames) {
      const sourceFile = this.program.getSourceFile(fileName);
      if (!sourceFile) {
        changed.push(fileName);
        continue;
      }
      
      // Check if file has changed since last build
      try {
        const stats = require('fs').statSync(fileName);
        if (stats.mtimeMs > this.lastBuildTime) {
          changed.push(fileName);
        }
      } catch (error) {
        changed.push(fileName);
      }
    }
    
    return changed;
  }
}

class ParallelBuilder {
  private workers: Worker[] = [];
  private taskQueue: Array<{ files: string[]; resolve: Function; reject: Function }> = [];
  private activeJobs = 0;
  
  constructor(private maxWorkers: number = require('os').cpus().length) {}
  
  async initializeWorkers(): Promise<void> {
    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = new Worker(__filename, {
        workerData: { isWorker: true }
      });
      
      worker.on('error', (error) => {
        console.error(`Worker ${i} error:`, error);
      });
      
      this.workers.push(worker);
    }
  }
  
  async compileInParallel(fileGroups: string[][]): Promise<any[]> {
    if (!isMainThread) {
      throw new Error('ParallelBuilder can only be used in main thread');
    }
    
    const promises = fileGroups.map(files => this.queueCompilation(files));
    return Promise.all(promises);
  }
  
  private queueCompilation(files: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ files, resolve, reject });
      this.processQueue();
    });
  }
  
  private processQueue(): void {
    if (this.taskQueue.length === 0 || this.activeJobs >= this.maxWorkers) {
      return;
    }
    
    const task = this.taskQueue.shift();
    if (!task) return;
    
    const availableWorker = this.workers.find(w => !w.listenerCount('message'));
    if (!availableWorker) {
      // No workers available, put task back
      this.taskQueue.unshift(task);
      return;
    }
    
    this.activeJobs++;
    
    const messageHandler = (result: any) => {
      availableWorker.off('message', messageHandler);
      availableWorker.off('error', errorHandler);
      this.activeJobs--;
      task.resolve(result);
      this.processQueue(); // Process next task
    };
    
    const errorHandler = (error: Error) => {
      availableWorker.off('message', messageHandler);
      availableWorker.off('error', errorHandler);
      this.activeJobs--;
      task.reject(error);
      this.processQueue();
    };
    
    availableWorker.on('message', messageHandler);
    availableWorker.on('error', errorHandler);
    
    availableWorker.postMessage({ files: task.files });
  }
  
  async destroy(): Promise<void> {
    await Promise.all(this.workers.map(worker => worker.terminate()));
    this.workers = [];
  }
}

// Worker thread code
if (!isMainThread && workerData?.isWorker) {
  const compiler = new IncrementalCompiler({
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true
  });
  
  parentPort?.on('message', async ({ files }) => {
    try {
      const result = await compiler.compile(files);
      parentPort?.postMessage(result);
    } catch (error) {
      parentPort?.postMessage({ success: false, error: error.message });
    }
  });
}

class WebpackOptimizer {
  private compiler: webpack.Compiler | null = null;
  private cache = new Map<string, any>();
  
  createOptimizedConfig(entry: string, outDir: string): webpack.Configuration {
    return {
      mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      entry,
      output: {
        path: outDir,
        filename: '[name].js',
        clean: true
      },
      cache: {
        type: 'filesystem',
        cacheDirectory: path.resolve('.webpack-cache'),
        compression: 'gzip'
      },
      optimization: {
        usedExports: true,
        sideEffects: false,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10
            },
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 5
            }
          }
        },
        minimize: process.env.NODE_ENV === 'production',
        minimizer: process.env.NODE_ENV === 'production' ? [
          new (require('terser-webpack-plugin'))({
            terserOptions: {
              compress: {
                drop_console: true,
                drop_debugger: true
              },
              mangle: true
            }
          })
        ] : []
      },
      resolve: {
        extensions: ['.ts', '.js', '.json'],
        alias: {
          '@': path.resolve('src')
        }
      },
      module: {
        rules: [
          {
            test: /\.ts$/,
            use: [
              {
                loader: 'ts-loader',
                options: {
                  transpileOnly: true, // Skip type checking for speed
                  experimentalWatchApi: true
                }
              }
            ],
            exclude: /node_modules/
          }
        ]
      },
      plugins: [
        new webpack.DefinePlugin({
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
        }),
        ...(process.env.NODE_ENV === 'production' ? [
          new webpack.optimize.AggressiveMergingPlugin()
        ] : [])
      ],
      stats: 'minimal'
    };
  }
  
  async build(config: webpack.Configuration): Promise<{ success: boolean; duration: number; stats?: webpack.Stats }> {
    const startTime = performance.now();
    
    return new Promise((resolve) => {
      this.compiler = webpack(config);
      
      this.compiler.run((err, stats) => {
        const duration = performance.now() - startTime;
        
        if (err) {
          console.error('Webpack build error:', err);
          resolve({ success: false, duration });
          return;
        }
        
        if (stats?.hasErrors()) {
          const errors = stats.toJson().errors;
          console.error('Webpack compilation errors:', errors);
          resolve({ success: false, duration, stats });
          return;
        }
        
        resolve({ success: true, duration, stats });
      });
    });
  }
}

class BuildCache {
  private cacheDir: string;
  private index = new Map<string, { hash: string; timestamp: number; outputs: string[] }>();
  
  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    this.loadIndex();
  }
  
  private async loadIndex(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      const indexPath = path.join(this.cacheDir, 'build-index.json');
      const indexData = await fs.readFile(indexPath, 'utf-8');
      const entries = JSON.parse(indexData);
      this.index = new Map(entries);
    } catch (error) {
      // Index doesn't exist, that's fine
      console.log('Creating new build cache index');
    }
  }
  
  private async saveIndex(): Promise<void> {
    try {
      const indexPath = path.join(this.cacheDir, 'build-index.json');
      const indexData = JSON.stringify(Array.from(this.index.entries()), null, 2);
      await fs.writeFile(indexPath, indexData);
    } catch (error) {
      console.error('Failed to save build cache index:', error);
    }
  }
  
  private async calculateHash(files: string[]): Promise<string> {
    const hasher = crypto.createHash('sha256');
    
    for (const file of files.sort()) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        hasher.update(file);
        hasher.update(content);
      } catch (error) {
        // File might not exist
        hasher.update(file);
      }
    }
    
    return hasher.digest('hex');
  }
  
  async get(key: string, files: string[]): Promise<string[] | null> {
    const entry = this.index.get(key);
    if (!entry) return null;
    
    // Check if files have changed
    const currentHash = await this.calculateHash(files);
    if (currentHash !== entry.hash) {
      this.index.delete(key);
      return null;
    }
    
    // Check if all output files exist
    for (const output of entry.outputs) {
      try {
        await fs.access(output);
      } catch (error) {
        this.index.delete(key);
        return null;
      }
    }
    
    return entry.outputs;
  }
  
  async set(key: string, files: string[], outputs: string[]): Promise<void> {
    const hash = await this.calculateHash(files);
    
    this.index.set(key, {
      hash,
      timestamp: Date.now(),
      outputs
    });
    
    await this.saveIndex();
  }
}

export class UltraFastBuildSystem extends EventEmitter {
  private config: BuildConfig;
  private compiler: IncrementalCompiler;
  private parallelBuilder: ParallelBuilder;
  private webpackOptimizer: WebpackOptimizer;
  private buildCache: BuildCache;
  private metrics: BuildMetrics;
  
  constructor(config: Partial<BuildConfig> = {}) {
    super();
    
    this.config = {
      rootDir: process.cwd(),
      outDir: './dist',
      cacheDir: './.build-cache',
      maxWorkers: require('os').cpus().length,
      enableIncrementalCompilation: true,
      enableParallelBuild: true,
      enableWebpackOptimization: true,
      enableBuildCache: true,
      ...config
    };
    
    this.compiler = new IncrementalCompiler({
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ES2020,
      outDir: this.config.outDir,
      strict: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true
    });
    
    this.parallelBuilder = new ParallelBuilder(this.config.maxWorkers);
    this.webpackOptimizer = new WebpackOptimizer();
    this.buildCache = new BuildCache(this.config.cacheDir);
    
    this.metrics = {
      totalTime: 0,
      compilationTime: 0,
      bundlingTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      filesProcessed: 0,
      workersUsed: 0,
      memoryUsage: 0
    };
  }
  
  async initialize(): Promise<void> {
    if (this.config.enableParallelBuild) {
      await this.parallelBuilder.initializeWorkers();
    }
  }
  
  async build(entry?: string): Promise<BuildMetrics> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    this.emit('buildStart');
    
    try {
      // Find TypeScript files
      const tsFiles = await this.findTypeScriptFiles();
      this.metrics.filesProcessed = tsFiles.length;
      
      // Check build cache
      const cacheKey = entry || 'default';
      if (this.config.enableBuildCache) {
        const cached = await this.buildCache.get(cacheKey, tsFiles);
        if (cached) {
          this.metrics.cacheHits++;
          this.emit('cacheHit', { key: cacheKey, outputs: cached });
          
          const duration = performance.now() - startTime;
          this.metrics.totalTime = duration;
          
          console.log(`Build cache hit! Completed in ${duration.toFixed(2)}ms`);
          return this.metrics;
        } else {
          this.metrics.cacheMisses++;
        }
      }
      
      // TypeScript compilation
      const compileStartTime = performance.now();
      let compileResult;
      
      if (this.config.enableParallelBuild && tsFiles.length > 10) {
        // Parallel compilation for large projects
        const fileGroups = this.chunkFiles(tsFiles, this.config.maxWorkers);
        this.metrics.workersUsed = fileGroups.length;
        
        const results = await this.parallelBuilder.compileInParallel(fileGroups);
        compileResult = this.mergeCompileResults(results);
      } else {
        // Single-threaded compilation
        compileResult = await this.compiler.compile(tsFiles);
      }
      
      this.metrics.compilationTime = performance.now() - compileStartTime;
      
      if (!compileResult.success) {
        this.emit('compilationError', compileResult.diagnostics);
        throw new Error('TypeScript compilation failed');
      }
      
      // Webpack bundling (if enabled)
      if (this.config.enableWebpackOptimization && entry) {
        const bundleStartTime = performance.now();
        
        const webpackConfig = this.webpackOptimizer.createOptimizedConfig(
          entry,
          this.config.outDir
        );
        
        const bundleResult = await this.webpackOptimizer.build(webpackConfig);
        this.metrics.bundlingTime = performance.now() - bundleStartTime;
        
        if (!bundleResult.success) {
          this.emit('bundlingError', bundleResult.stats);
          throw new Error('Webpack bundling failed');
        }
      }
      
      // Update build cache
      if (this.config.enableBuildCache) {
        const outputs = await this.findOutputFiles();
        await this.buildCache.set(cacheKey, tsFiles, outputs);
      }
      
      const totalTime = performance.now() - startTime;
      this.metrics.totalTime = totalTime;
      this.metrics.memoryUsage = process.memoryUsage().heapUsed - startMemory;
      
      this.emit('buildComplete', this.metrics);
      
      console.log(`Ultra-fast build completed in ${totalTime.toFixed(2)}ms`);
      console.log(`  - Compilation: ${this.metrics.compilationTime.toFixed(2)}ms`);
      console.log(`  - Bundling: ${this.metrics.bundlingTime.toFixed(2)}ms`);
      console.log(`  - Cache hit rate: ${this.getCacheHitRate().toFixed(1)}%`);
      
      return this.metrics;
    } catch (error) {
      this.emit('buildError', error);
      throw error;
    }
  }
  
  private async findTypeScriptFiles(): Promise<string[]> {
    const files: string[] = [];
    
    const walk = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== 'dist') {
            await walk(fullPath);
          }
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
          files.push(fullPath);
        }
      }
    };
    
    await walk(path.join(this.config.rootDir, 'src'));
    return files;
  }
  
  private async findOutputFiles(): Promise<string[]> {
    const files: string[] = [];
    
    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.name.endsWith('.js') || entry.name.endsWith('.js.map')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Directory might not exist
      }
    };
    
    await walk(this.config.outDir);
    return files;
  }
  
  private chunkFiles(files: string[], chunks: number): string[][] {
    const result: string[][] = [];
    const chunkSize = Math.ceil(files.length / chunks);
    
    for (let i = 0; i < files.length; i += chunkSize) {
      result.push(files.slice(i, i + chunkSize));
    }
    
    return result;
  }
  
  private mergeCompileResults(results: any[]): any {
    const merged = {
      success: true,
      diagnostics: [],
      duration: 0
    };
    
    for (const result of results) {
      if (!result.success) {
        merged.success = false;
      }
      merged.diagnostics.push(...result.diagnostics);
      merged.duration = Math.max(merged.duration, result.duration);
    }
    
    return merged;
  }
  
  getCacheHitRate(): number {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    return total > 0 ? (this.metrics.cacheHits / total) * 100 : 0;
  }
  
  getMetrics(): BuildMetrics {
    return { ...this.metrics };
  }
  
  async destroy(): Promise<void> {
    await this.parallelBuilder.destroy();
    this.removeAllListeners();
  }
}

// Export singleton instance
let buildSystemInstance: UltraFastBuildSystem | null = null;

export function getBuildSystem(config?: Partial<BuildConfig>): UltraFastBuildSystem {
  if (!buildSystemInstance) {
    buildSystemInstance = new UltraFastBuildSystem(config);
  }
  return buildSystemInstance;
}

export async function destroyBuildSystem(): Promise<void> {
  if (buildSystemInstance) {
    await buildSystemInstance.destroy();
    buildSystemInstance = null;
  }
}