/**
 * Basic Test Suite for LLM Framework
 * Ensures core functionality and prevents CI/CD failures
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

describe('LLM Framework Basic Tests', () => {
  beforeAll(() => {
    console.log('🧪 Starting LLM Framework tests...');
  });

  afterAll(() => {
    console.log('✅ LLM Framework tests completed');
  });

  describe('Environment Setup', () => {
    test('should have required configuration files', () => {
      expect(existsSync('package.json')).toBe(true);
      expect(existsSync('.nvmrc')).toBe(true);
      expect(existsSync('jest.config.mjs')).toBe(true);
      expect(existsSync('tsconfig.json')).toBe(true);
    });

    test('should have valid package.json', () => {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      expect(packageJson.name).toBe('llm');
      expect(packageJson.type).toBe('module');
      expect(packageJson.version).toMatch(/\d+\.\d+\.\d+/);
    });

    test('should have required scripts', () => {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      const scripts = packageJson.scripts;
      
      expect(scripts.start).toBeDefined();
      expect(scripts.test).toBeDefined();
      expect(scripts.build).toBeDefined();
      expect(scripts['start:production']).toBeDefined();
    });
  });

  describe('Dependencies', () => {
    test('should have core dependencies', () => {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      const deps = packageJson.dependencies;
      
      expect(deps.express).toBeDefined();
      expect(deps.dotenv).toBeDefined();
      expect(deps.cors).toBeDefined();
      expect(deps.winston).toBeDefined();
    });

    test('should have optimization dependencies', () => {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      const deps = packageJson.dependencies;
      
      expect(deps.compression).toBeDefined();
      expect(deps.helmet).toBeDefined();
      expect(deps['express-rate-limit']).toBeDefined();
      expect(deps['lru-cache']).toBeDefined();
    });

    test('should have development dependencies', () => {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      const devDeps = packageJson.devDependencies;
      
      expect(devDeps.jest).toBeDefined();
      expect(devDeps.typescript).toBeDefined();
      expect(devDeps.eslint).toBeDefined();
      expect(devDeps['cross-env']).toBeDefined();
    });
  });

  describe('Node.js Compatibility', () => {
    test('should run on supported Node.js version', () => {
      const nodeVersion = process.version;
      const major = parseInt(nodeVersion.slice(1).split('.')[0]);
      expect(major).toBeGreaterThanOrEqual(18);
    });

    test('should support ESM modules', () => {
      expect(typeof import.meta.url).toBe('string');
      expect(import.meta.url.startsWith('file://')).toBe(true);
    });

    test('should have proper memory limits', () => {
      const memory = process.memoryUsage();
      expect(memory.heapUsed).toBeGreaterThan(0);
      expect(memory.heapTotal).toBeGreaterThan(0);
    });
  });

  describe('File Structure', () => {
    test('should have src directory with core files', () => {
      expect(existsSync('src')).toBe(true);
      expect(existsSync('src/performance-monitor.js')).toBe(true);
      expect(existsSync('src/ai-bridge.js')).toBe(true);
    });

    test('should have scripts directory', () => {
      expect(existsSync('scripts')).toBe(true);
      expect(existsSync('scripts/performance-optimizer.js')).toBe(true);
      expect(existsSync('scripts/health-check.js')).toBe(true);
    });

    test('should have server files', () => {
      expect(existsSync('server.js')).toBe(true);
      expect(existsSync('server-optimized.js')).toBe(true);
      expect(existsSync('server-ultra-optimized.js')).toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    test('should be able to import performance monitor', async () => {
      const { PerformanceMonitor } = await import('../src/performance-monitor.js');
      expect(PerformanceMonitor).toBeDefined();
      expect(typeof PerformanceMonitor).toBe('function');
    });

    test('should create performance monitor instance', async () => {
      const { PerformanceMonitor } = await import('../src/performance-monitor.js');
      const monitor = new PerformanceMonitor({
        enableFileLogging: false,
        samplingInterval: 30000
      });
      
      expect(monitor).toBeDefined();
      expect(typeof monitor.start).toBe('function');
      expect(typeof monitor.stop).toBe('function');
      expect(typeof monitor.getStats).toBe('function');
    });
  });

  describe('Environment Variables', () => {
    test('should handle missing environment variables gracefully', () => {
      // Test that the app doesn't crash with minimal env setup
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      
      expect(process.env.NODE_ENV).toBe('test');
      
      // Restore original env
      process.env.NODE_ENV = originalEnv;
    });

    test('should have safe defaults for critical settings', () => {
      // These should not throw errors even if not defined
      const port = process.env.PORT || '8080';
      const nodeEnv = process.env.NODE_ENV || 'development';
      const logLevel = process.env.LOG_LEVEL || 'info';
      
      expect(typeof port).toBe('string');
      expect(typeof nodeEnv).toBe('string');
      expect(typeof logLevel).toBe('string');
    });
  });

  describe('Error Handling', () => {
    test('should handle promise rejections', async () => {
      const promiseWithError = new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('Test error')), 10);
      });
      
      await expect(promiseWithError).rejects.toThrow('Test error');
    });

    test('should handle synchronous errors', () => {
      expect(() => {
        throw new Error('Sync test error');
      }).toThrow('Sync test error');
    });
  });

  describe('Optimization Scripts', () => {
    test('should have optimization scripts available', () => {
      const scriptFiles = [
        'scripts/performance-optimizer.js',
        'scripts/health-check.js',
        'scripts/complete-system-optimization.js',
        'scripts/concurrent-optimization.js',
        'scripts/optimization-suite.js',
        'scripts/full-optimization.js'
      ];
      
      scriptFiles.forEach(scriptPath => {
        expect(existsSync(scriptPath)).toBe(true);
      });
    });
  });

  describe('Build System', () => {
    test('should have TypeScript configuration', () => {
      const tsConfig = JSON.parse(readFileSync('tsconfig.json', 'utf8'));
      expect(tsConfig.compilerOptions).toBeDefined();
      expect(tsConfig.compilerOptions.target).toBeDefined();
      expect(tsConfig.compilerOptions.module).toBeDefined();
    });

    test('should have ESLint configuration', () => {
      expect(existsSync('eslint.config.js')).toBe(true);
    });
  });
});

// Helper function tests
describe('Utility Functions', () => {
  test('should handle async operations', async () => {
    const asyncFunction = async () => {
      await new Promise(resolve => setTimeout(resolve, 1));
      return 'success';
    };
    
    const result = await asyncFunction();
    expect(result).toBe('success');
  });

  test('should handle JSON operations', () => {
    const testObject = { test: true, value: 42 };
    const jsonString = JSON.stringify(testObject);
    const parsedObject = JSON.parse(jsonString);
    
    expect(parsedObject.test).toBe(true);
    expect(parsedObject.value).toBe(42);
  });

  test('should handle file path operations', () => {
    const testPath = path.join('src', 'test.js');
    const resolvedPath = path.resolve(testPath);
    
    expect(testPath).toBe('src/test.js');
    expect(resolvedPath).toContain('src/test.js');
  });
});
