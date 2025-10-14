import { exec } from 'child_process';
import { promisify } from 'util';
import { Tool } from './types';

const execAsync = promisify(exec);

/**
 * Test & Verification Tool - Comprehensive testing and validation
 * Enables autonomous test execution, coverage analysis, and verification
 */
export const testVerification: Tool = {
  name: 'test_verification',
  description: 'Run tests, verify functionality, and analyze coverage',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['test', 'coverage', 'e2e', 'unit', 'integration', 'verify', 'benchmark'],
        description: 'Test operation to perform',
      },
      path: {
        type: 'string',
        description: 'Test file or directory path',
      },
      pattern: {
        type: 'string',
        description: 'Test file pattern (e.g., "*.test.ts")',
      },
      watch: {
        type: 'boolean',
        description: 'Run tests in watch mode',
      },
      bail: {
        type: 'boolean',
        description: 'Stop on first test failure',
      },
      timeout: {
        type: 'number',
        description: 'Test timeout in milliseconds',
      },
      coverage: {
        type: 'boolean',
        description: 'Enable coverage reporting',
      },
    },
    required: ['operation'],
  },

  async execute(args: any): Promise<any> {
    const {
      operation,
      path = '',
      _pattern,
      watch = false,
      bail = false,
      timeout,
      coverage = false,
    } = args;

    try {
      // Build command based on operation
      let command = '';

      switch (operation) {
        case 'test':
          command = 'npm test';
          break;
        case 'unit':
          command = 'npm run test:unit';
          break;
        case 'integration':
          command = 'npm run test:integration';
          break;
        case 'e2e':
          command = 'npm run test:e2e';
          break;
        case 'coverage':
          command = 'npm run test:coverage';
          break;
        case 'verify':
          command = 'npm run verify:all';
          break;
        case 'benchmark':
          command = 'npm run test:benchmark';
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      // Add path if specified
      if (path) {
        command += ` ${path}`;
      }

      // Add flags
      if (watch) command += ' --watch';
      if (bail) command += ' --bail';
      if (timeout) command += ` --testTimeout=${timeout}`;
      if (coverage) command += ' --coverage';

      console.log(`Executing: ${command}`);

      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      // Parse test results
      const results: any = {
        success: true,
        command,
        output: stdout,
        errors: stderr || '',
        timestamp: new Date().toISOString(),
      };

      // Extract test metrics from output
      const testsPassed = (stdout.match(/\d+ passing/i) || [])[0];
      const testsFailed = (stdout.match(/\d+ failing/i) || [])[0];
      const coverage_match = stdout.match(/All files[^\n]*?([\d.]+)%/);

      if (testsPassed) results.passed = testsPassed;
      if (testsFailed) results.failed = testsFailed;
      if (coverage_match) results.coverage = coverage_match[1] + '%';

      return results;
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        output: error.stdout || '',
        errors: error.stderr || error.message,
        timestamp: new Date().toISOString(),
      };
    }
  },
};
