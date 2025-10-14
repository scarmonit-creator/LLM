/**
 * Shared Utilities for Tools
 * Common functions and error handling patterns used across all tools
 */

/**
 * Custom error classes for better error handling
 */
export class ToolExecutionError extends Error {
  constructor(message: string, public readonly toolName: string, public readonly operation?: string) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string, public readonly config: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Standard result wrapper for all tool operations
 */
export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  duration?: number;
}

/**
 * Create a standardized success result
 */
export function createSuccessResult<T>(data: T, startTime?: number): ToolResult<T> {
  const timestamp = new Date().toISOString();
  const duration = startTime ? Date.now() - startTime : undefined;
  
  return {
    success: true,
    data,
    timestamp,
    duration
  };
}

/**
 * Create a standardized error result
 */
export function createErrorResult(error: string | Error, startTime?: number): ToolResult {
  const timestamp = new Date().toISOString();
  const duration = startTime ? Date.now() - startTime : undefined;
  const errorMessage = error instanceof Error ? error.message : error;
  
  return {
    success: false,
    error: errorMessage,
    timestamp,
    duration
  };
}

/**
 * Async wrapper with standardized error handling
 */
export async function executeWithErrorHandling<T>(
  operation: () => Promise<T>,
  toolName: string,
  operationName?: string
): Promise<ToolResult<T>> {
  const startTime = Date.now();
  
  try {
    const result = await operation();
    return createSuccessResult(result, startTime);
  } catch (error) {
    console.error(`Error in ${toolName}${operationName ? ` (${operationName})` : ''}:`, error);
    return createErrorResult(error instanceof Error ? error : new Error(String(error)), startTime);
  }
}

/**
 * Validate required parameters
 */
export function validateRequired(params: Record<string, any>, required: string[]): void {
  for (const field of required) {
    if (!(field in params) || params[field] === undefined || params[field] === null) {
      throw new ValidationError(`Missing required parameter: ${field}`, field);
    }
  }
}

/**
 * Validate parameter types
 */
export function validateTypes(params: Record<string, any>, schema: Record<string, string>): void {
  for (const [field, expectedType] of Object.entries(schema)) {
    if (field in params && params[field] !== null && params[field] !== undefined) {
      const actualType = typeof params[field];
      if (actualType !== expectedType) {
        throw new ValidationError(
          `Invalid type for parameter '${field}': expected ${expectedType}, got ${actualType}`,
          field
        );
      }
    }
  }
}

/**
 * Sanitize file paths to prevent directory traversal
 */
export function sanitizePath(path: string): string {
  // Remove any attempt to traverse directories
  const sanitized = path.replace(/\.\.[\\/]/g, '').replace(/^[\\/]/, '');
  return sanitized;
}

/**
 * Retry logic for operations that might fail temporarily
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  exponentialBackoff: boolean = true
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = exponentialBackoff ? delayMs * Math.pow(2, attempt) : delayMs;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Cache for storing frequently accessed data
 */
export class SimpleCache<T> {
  private cache = new Map<string, { value: T; timestamp: number; ttl: number }>();
  
  set(key: string, value: T, ttlMs: number = 300000): void { // Default 5 minutes
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }
  
  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) {
      return undefined;
    }
    
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    
    return item.value;
  }
  
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  size(): number {
    // Clean expired entries first
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
    return this.cache.size;
  }
}

/**
 * Environment configuration helper
 */
export class EnvironmentConfig {
  static get(key: string, defaultValue?: string): string {
    return process.env[key] ?? defaultValue ?? '';
  }
  
  static getRequired(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new ConfigurationError(`Missing required environment variable: ${key}`, key);
    }
    return value;
  }
  
  static getNumber(key: string, defaultValue?: number): number {
    const value = process.env[key];
    if (!value) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new ConfigurationError(`Missing required environment variable: ${key}`, key);
    }
    
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      throw new ConfigurationError(`Invalid number in environment variable ${key}: ${value}`, key);
    }
    return num;
  }
  
  static getBoolean(key: string, defaultValue?: boolean): boolean {
    const value = process.env[key];
    if (!value) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new ConfigurationError(`Missing required environment variable: ${key}`, key);
    }
    
    return value.toLowerCase() === 'true' || value === '1';
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static timers = new Map<string, number>();
  
  static start(operation: string): void {
    this.timers.set(operation, Date.now());
  }
  
  static end(operation: string): number {
    const startTime = this.timers.get(operation);
    if (!startTime) {
      throw new Error(`No timer found for operation: ${operation}`);
    }
    
    const duration = Date.now() - startTime;
    this.timers.delete(operation);
    return duration;
  }
  
  static measure<T>(operation: string, fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    return this.measureSync(operation, fn);
  }
  
  static async measureSync<T>(operation: string, fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    this.start(operation);
    try {
      const result = await fn();
      const duration = this.end(operation);
      return { result, duration };
    } catch (error) {
      this.end(operation); // Clean up timer even on error
      throw error;
    }
  }
}