import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import { Tool } from './types.js';

const execAsync = promisify(exec);

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

  async execute(args: any): Promise<any> {
    const { operation, path = '.', content, pattern, autoFix = false, config } = args;

    try {
      let command = '';
      let result: any = {};

      switch (operation) {
        case 'lint':
          // Run ESLint for code analysis
          const lintFix = autoFix ? '--fix' : '';
          command = `npx eslint ${path} ${lintFix} --format json`;
          try {
            const { stdout } = await execAsync(command);
            result = {
              success: true,
              issues: JSON.parse(stdout),
              fixed: autoFix,
            };
          } catch (error: any) {
            // ESLint returns non-zero exit code when issues found
            result = {
              success: false,
              issues: error.stdout ? JSON.parse(error.stdout) : [],
              error: error.message,
            };
          }
          break;

        case 'format':
          // Run Prettier for code formatting
          const formatWrite = autoFix ? '--write' : '--check';
          command = `npx prettier ${path} ${formatWrite}`;
          const { stdout: formatOut } = await execAsync(command);
          result = {
            success: true,
            output: formatOut,
            formatted: autoFix,
          };
          break;

        case 'test':
          // Run tests
          command = `npm test -- ${path || ''}`;
          const { stdout: testOut, stderr: testErr } = await execAsync(command);
          result = {
            success: true,
            output: testOut,
            errors: testErr || null,
          };
          break;

        case 'analyze':
          // Static code analysis
          const stats = await fs.stat(path);
          let files: string[] = [];

          if (stats.isDirectory()) {
            const dirContents = await fs.readdir(path, { recursive: true, withFileTypes: true });
            files = dirContents
              .filter((dirent) => dirent.isFile())
              .map((dirent) => `${path}/${dirent.name}`);
          } else {
            files = [path];
          }

          const analysis = {
            totalFiles: files.length,
            fileTypes: {} as any,
            totalLines: 0,
          };

          for (const file of files) {
            const ext = file.split('.').pop() || 'unknown';
            analysis.fileTypes[ext] = (analysis.fileTypes[ext] || 0) + 1;

            try {
              const fileContent = await fs.readFile(file, 'utf-8');
              analysis.totalLines += fileContent.split('\n').length;
            } catch (e) {
              // Skip files that can't be read
            }
          }

          result = {
            success: true,
            path,
            analysis,
          };
          break;

        case 'read':
          // Read file content
          if (!path) throw new Error('Path required for read operation');
          const fileContent = await fs.readFile(path, 'utf-8');
          result = {
            success: true,
            path,
            content: fileContent,
            size: fileContent.length,
          };
          break;

        case 'write':
          // Write file content
          if (!path) throw new Error('Path required for write operation');
          if (!content) throw new Error('Content required for write operation');
          await fs.writeFile(path, content, 'utf-8');
          result = {
            success: true,
            path,
            written: content.length,
          };
          break;

        case 'patch':
          // Apply code patch
          if (!path) throw new Error('Path required for patch operation');
          if (!content) throw new Error('Patch content required');

          const originalContent = await fs.readFile(path, 'utf-8');
          // Apply patch (simplified - in production use a proper patch library)
          await fs.writeFile(path, content, 'utf-8');

          result = {
            success: true,
            path,
            patched: true,
            backup: originalContent,
          };
          break;

        case 'fix':
          // Comprehensive auto-fix
          const fixes = [];

          // Run linter with fixes
          try {
            await execAsync(`npx eslint ${path} --fix`);
            fixes.push('eslint');
          } catch (e) {
            // Continue even if linting fails
          }

          // Run formatter
          try {
            await execAsync(`npx prettier ${path} --write`);
            fixes.push('prettier');
          } catch (e) {
            // Continue even if formatting fails
          }

          result = {
            success: true,
            path,
            fixes,
          };
          break;

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      return {
        success: true,
        operation,
        timestamp: new Date().toISOString(),
        ...result,
      };
    } catch (error: any) {
      return {
        success: false,
        operation,
        error: error.message,
      };
    }
  },
};

export default codeAnalysis;
