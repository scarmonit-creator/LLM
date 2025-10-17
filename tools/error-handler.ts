/**
 * Error Handler and Recovery System
 * Provides comprehensive error handling, logging, and automatic recovery mechanisms
 */

import { Tool } from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ErrorReport {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  stack?: string;
  context?: any;
  resolved: boolean;
  recoveryAttempts: number;
}

export interface RecoveryStrategy {
  name: string;
  condition: (error: Error, context: any) => boolean;
  action: (error: Error, context: any) => Promise<boolean>;
  maxAttempts: number;
}

class ErrorManager {
  private errors: ErrorReport[] = [];
  private recoveryStrategies: RecoveryStrategy[] = [];
  private logFile: string = 'logs/error.log';
  
  constructor() {
    this.initializeRecoveryStrategies();
  }
  
  private initializeRecoveryStrategies(): void {
    // Network connectivity recovery
    this.recoveryStrategies.push({
      name: 'network_retry',
      condition: (error) => error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED'),
      action: async (error, context) => {
        console.log('Attempting network recovery...');
        await this.delay(2000); // Wait 2 seconds
        return true; // Retry the operation
      },
      maxAttempts: 3
    });
    
    // File system recovery
    this.recoveryStrategies.push({
      name: 'filesystem_recovery',
      condition: (error) => error.message.includes('ENOENT') || error.message.includes('EACCES'),
      action: async (error, context) => {
        if (context.filePath) {
          try {
            await fs.mkdir(path.dirname(context.filePath), { recursive: true });
            return true;
          } catch {
            return false;
          }
        }
        return false;
      },
      maxAttempts: 2
    });
    
    // Memory recovery
    this.recoveryStrategies.push({
      name: 'memory_recovery',
      condition: (error) => error.message.includes('out of memory') || error.message.includes('heap'),
      action: async (error, context) => {
        console.log('Attempting memory recovery...');
        if (global.gc) {
          global.gc();
        }
        await this.delay(1000);
        return true;
      },
      maxAttempts: 2
    });
    
    // API rate limit recovery
    this.recoveryStrategies.push({
      name: 'rate_limit_recovery',
      condition: (error) => error.message.includes('rate limit') || error.message.includes('429'),
      action: async (error, context) => {
        const backoffTime = Math.min(30000, 1000 * Math.pow(2, context.attempt || 1));
        console.log(`Rate limit hit, backing off for ${backoffTime}ms`);
        await this.delay(backoffTime);
        return true;
      },
      maxAttempts: 5
    });
  }
  
  async handleError(error: Error, context: any = {}): Promise<ErrorReport> {
    const report: ErrorReport = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level: this.determineLevel(error),
      message: error.message,
      stack: error.stack,
      context,
      resolved: false,
      recoveryAttempts: 0
    };
    
    this.errors.push(report);
    await this.logError(report);
    
    // Attempt recovery
    const recovered = await this.attemptRecovery(error, context, report);
    report.resolved = recovered;
    
    return report;
  }
  
  private async attemptRecovery(error: Error, context: any, report: ErrorReport): Promise<boolean> {
    for (const strategy of this.recoveryStrategies) {
      if (strategy.condition(error, context) && report.recoveryAttempts < strategy.maxAttempts) {
        console.log(`Attempting recovery with strategy: ${strategy.name}`);
        report.recoveryAttempts++;
        
        try {
          const success = await strategy.action(error, { ...context, attempt: report.recoveryAttempts });
          if (success) {
            console.log(`Recovery successful with strategy: ${strategy.name}`);
            return true;
          }
        } catch (recoveryError) {
          console.log(`Recovery strategy ${strategy.name} failed:`, recoveryError);
        }
      }
    }
    
    return false;
  }
  
  private determineLevel(error: Error): ErrorReport['level'] {
    if (error.message.includes('fatal') || error.name === 'FatalError') {
      return 'fatal';
    }
    if (error.message.includes('warn') || error.name === 'Warning') {
      return 'warn';
    }
    if (error.message.includes('info')) {
      return 'info';
    }
    return 'error';
  }
  
  private generateId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private async logError(report: ErrorReport): Promise<void> {
    try {
      const logDir = path.dirname(this.logFile);
      await fs.mkdir(logDir, { recursive: true });
      
      const logEntry = `[${report.timestamp}] ${report.level.toUpperCase()} ${report.id}: ${report.message}\n`;
      await fs.appendFile(this.logFile, logEntry);
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  getErrors(level?: ErrorReport['level']): ErrorReport[] {
    return level ? this.errors.filter(e => e.level === level) : this.errors;
  }
  
  getUnresolvedErrors(): ErrorReport[] {
    return this.errors.filter(e => !e.resolved);
  }
  
  clearErrors(): void {
    this.errors = [];
  }
  
  addRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
  }
}

const errorManager = new ErrorManager();

/**
 * Helper function to find most common errors
 */
function getMostCommonErrors(errors: ErrorReport[]): Array<{ message: string; count: number }> {
  const errorCounts: Record<string, number> = {};

  errors.forEach(error => {
    const key = error.message.substring(0, 100); // Truncate for grouping
    errorCounts[key] = (errorCounts[key] || 0) + 1;
  });

  return Object.entries(errorCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([message, count]) => ({ message, count }));
}

export const errorHandler: Tool = {
  name: 'error_handler',
  description: 'Comprehensive error handling, logging, and recovery system',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['handle', 'report', 'recover', 'clear', 'analyze', 'configure'],
        description: 'Error handling operation to perform'
      },
      error: {
        type: 'object',
        description: 'Error object to handle (for handle operation)'
      },
      context: {
        type: 'object',
        description: 'Additional context for error handling'
      },
      level: {
        type: 'string',
        enum: ['info', 'warn', 'error', 'fatal'],
        description: 'Filter errors by level (for report operation)'
      },
      strategy: {
        type: 'object',
        description: 'Recovery strategy to add (for configure operation)'
      }
    },
    required: ['operation']
  },
  
  async execute(params: any): Promise<any> {
    const { operation, error, context = {}, level, strategy } = params;
    
    try {
      switch (operation) {
        case 'handle':
          if (!error) {
            throw new Error('Error object is required for handle operation');
          }
          const errorObj = new Error(error.message || 'Unknown error');
          errorObj.stack = error.stack;
          return await errorManager.handleError(errorObj, context);
          
        case 'report':
          return {
            success: true,
            errors: errorManager.getErrors(level),
            unresolved: errorManager.getUnresolvedErrors(),
            timestamp: new Date().toISOString()
          };
          
        case 'recover':
          const unresolvedErrors = errorManager.getUnresolvedErrors();
          const recoveryResults = [];
          
          for (const errorReport of unresolvedErrors) {
            if (errorReport.stack) {
              const error = new Error(errorReport.message);
              error.stack = errorReport.stack;
              const recovered = await errorManager.handleError(error, errorReport.context);
              recoveryResults.push(recovered);
            }
          }
          
          return {
            success: true,
            recoveryResults,
            timestamp: new Date().toISOString()
          };
          
        case 'clear':
          errorManager.clearErrors();
          return {
            success: true,
            message: 'All errors cleared',
            timestamp: new Date().toISOString()
          };
          
        case 'analyze':
          const errors = errorManager.getErrors();
          const analysis = {
            total: errors.length,
            byLevel: {
              info: errors.filter(e => e.level === 'info').length,
              warn: errors.filter(e => e.level === 'warn').length,
              error: errors.filter(e => e.level === 'error').length,
              fatal: errors.filter(e => e.level === 'fatal').length
            },
            resolved: errors.filter(e => e.resolved).length,
            unresolved: errors.filter(e => !e.resolved).length,
            mostCommonErrors: getMostCommonErrors(errors),
            recentErrors: errors.slice(-10)
          };
          
          return {
            success: true,
            analysis,
            timestamp: new Date().toISOString()
          };
          
        case 'configure':
          if (strategy) {
            errorManager.addRecoveryStrategy(strategy);
            return {
              success: true,
              message: `Recovery strategy '${strategy.name}' added`,
              timestamp: new Date().toISOString()
            };
          } else {
            return {
              success: false,
              error: 'Strategy object is required for configure operation',
              timestamp: new Date().toISOString()
            };
          }
          
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
};

// Global error handlers
process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  await errorManager.handleError(error, { type: 'uncaughtException' });
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  const error = reason instanceof Error ? reason : new Error(String(reason));
  await errorManager.handleError(error, { type: 'unhandledRejection' });
});

export { errorManager, ErrorManager };
export default errorHandler;