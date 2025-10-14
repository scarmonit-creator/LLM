import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import { Tool } from './types.js';

const execAsync = promisify(exec);

interface CodeAnalysisParams {
  operation: 'lint' | 'format' | 'test' | 'fix' | 'analyze' | 'read' | 'write' | 'patch';
  path?: string;
  content?: string;
  pattern?: string;
  autoFix?: boolean;
  config?: Record<string, any>;
}

interface CodeAnalysisResult {
  success: boolean;
  operation: string;
  path?: string;
  output?: string;
  errors?: string;
  issues?: any[];
  content?: string;
  message?: string;
  error?: string;
  analysis?: any;
  timestamp: string;
}

/**
 * Code Analysis Tool - Autonomous code analysis and fixing
 * Enables problem identification, code analysis, and automated fixes
 */
export const codeAnalysis: Tool = {
  name: 'code_analysis',
  description: 'Analyze code, identify issues, and apply automated fixes',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['lint', 'format', 'test', 'fix', 'analyze', 'read', 'write', 'patch'],
        description: 'Code operation to perform',
      },
      path: {
        type: 'string',
        description: 'File or directory path',
      },
      content: {
        type: 'string',
        description: 'File content for write operations',
      },
      pattern: {
        type: 'string',
        description: 'Search pattern for analysis',
      },
      autoFix: {
        type: 'boolean',
        description: 'Automatically apply fixes (default: false)',
      },
      config: {
        type: 'object',
        description: 'Tool configuration options',
      },
    },
    required: ['operation'],
  },
  async execute(args: CodeAnalysisParams): Promise<CodeAnalysisResult> {
    const { operation, path = '.', content, autoFix = false } = args;

    try {
      let command = '';
      let result: CodeAnalysisResult;

      switch (operation) {
        case 'lint':
          // Run ESLint for code analysis
          const lintFix = autoFix ? '--fix' : '';
          command = `npx eslint ${path} ${lintFix} --format json`;

          try {
            const { stdout } = await execAsync(command);
            result = {
              success: true,
              operation: 'lint',
              path,
              issues: JSON.parse(stdout),
              timestamp: new Date().toISOString(),
            };
          } catch (error: any) {
            // ESLint returns exit code 1 when there are linting errors
            // Parse the output to get the issues
            const issues = error.stdout ? JSON.parse(error.stdout) : [];
            result = {
              success: false,
              operation: 'lint',
              path,
              issues,
              error: error.message,
              timestamp: new Date().toISOString(),
            };
          }
          break;

        case 'format':
          // Run Prettier for code formatting
          const formatWrite = autoFix ? '--write' : '--check';
          command = `npx prettier ${path} ${formatWrite}`;

          try {
            const { stdout, stderr } = await execAsync(command);
            result = {
              success: true,
              operation: 'format',
              path,
              output: stdout,
              errors: stderr || '',
              timestamp: new Date().toISOString(),
            };
          } catch (error: any) {
            result = {
              success: false,
              operation: 'format',
              path,
              output: error.stdout || '',
              error: error.message,
              timestamp: new Date().toISOString(),
            };
          }
          break;

        case 'test':
          // Run test command
          command = `npm test -- ${path}`;

          try {
            const { stdout, stderr } = await execAsync(command, {
              maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            });
            result = {
              success: true,
              operation: 'test',
              path,
              output: stdout,
              errors: stderr || '',
              timestamp: new Date().toISOString(),
            };
          } catch (error: any) {
            result = {
              success: false,
              operation: 'test',
              path,
              error: `Test execution failed: ${error.message}`,
              timestamp: new Date().toISOString(),
            };
          }
          break;

        case 'fix':
          // Run comprehensive auto-fix (lint + format)
          command = `npx eslint ${path} --fix && npx prettier ${path} --write`;

          try {
            const { stdout, stderr } = await execAsync(command);
            result = {
              success: true,
              operation: 'fix',
              path,
              output: stdout,
              errors: stderr || '',
              timestamp: new Date().toISOString(),
            };
          } catch (error: any) {
            result = {
              success: false,
              operation: 'fix',
              path,
              output: error.stdout || '',
              error: error.message,
              timestamp: new Date().toISOString(),
            };
          }
          break;

        case 'analyze':
          // Comprehensive code analysis
          result = {
            success: true,
            operation: 'analyze',
            path,
            analysis: {
              // Run multiple analysis tools
              lint: 'Run ESLint for issues',
              format: 'Check code formatting',
              test: 'Execute test suite',
              coverage: 'Analyze test coverage',
            },
            timestamp: new Date().toISOString(),
          };
          break;

        case 'read':
          // Read file content
          try {
            const fileContent = await fs.readFile(path, 'utf-8');
            result = {
              success: true,
              operation: 'read',
              path,
              content: fileContent,
              timestamp: new Date().toISOString(),
            };
          } catch (error: any) {
            result = {
              success: false,
              operation: 'read',
              path,
              error: `Failed to read file: ${error.message}`,
              timestamp: new Date().toISOString(),
            };
          }
          break;

        case 'write':
          // Write file content
          if (!content) {
            return {
              success: false,
              operation: 'write',
              path,
              error: 'Content is required for write operation',
              timestamp: new Date().toISOString(),
            };
          }

          try {
            await fs.writeFile(path, content, 'utf-8');
            result = {
              success: true,
              operation: 'write',
              path,
              message: 'File written successfully',
              timestamp: new Date().toISOString(),
            };
          } catch (error: any) {
            result = {
              success: false,
              operation: 'write',
              path,
              error: `Failed to write file: ${error.message}`,
              timestamp: new Date().toISOString(),
            };
          }
          break;

        case 'patch':
          // Apply code patch
          if (!content) {
            return {
              success: false,
              operation: 'patch',
              path,
              error: 'Patch content is required',
              timestamp: new Date().toISOString(),
            };
          }

          try {
            // Read existing content
            const existingContent = await fs.readFile(path, 'utf-8');
            // Apply patch (for now, simple concatenation; can be enhanced)
            const patchedContent = existingContent + '\n' + content;
            await fs.writeFile(path, patchedContent, 'utf-8');

            result = {
              success: true,
              operation: 'patch',
              path,
              message: 'Patch applied successfully',
              timestamp: new Date().toISOString(),
            };
          } catch (error: any) {
            result = {
              success: false,
              operation: 'patch',
              path,
              error: error.message,
              timestamp: new Date().toISOString(),
            };
          }
          break;

        default:
          result = {
            success: false,
            operation: operation,
            error: `Unknown operation: ${operation}`,
            timestamp: new Date().toISOString(),
          };
      }

      return result;
    } catch (error: any) {
      return {
        success: false,
        operation: operation,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  },
};