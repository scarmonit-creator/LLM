import { exec } from 'child_process';
import { promisify } from 'util';
import { Tool } from './types.js';

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
      pattern,
      watch = false,
      bail = false,
      timeout,
      coverage = false,
    } = args;

    try {
      let command = '';
      let result: any = {};

      const watchFlag = watch ? '--watch' : '';
      const bailFlag = bail ? '--bail' : '';
      const timeoutFlag = timeout ? `--timeout ${timeout}` : '';

      switch (operation) {
        case 'test':
          // Run all tests
          command = `npm test ${path} ${watchFlag} ${bailFlag} ${timeoutFlag}`;
          if (coverage) {
            command = `npm test -- --coverage ${path}`;
          }
          break;

        case 'unit':
          // Run unit tests
          command = `npm test -- --testPathPattern=".*\\.(test|spec)\\.(ts|js)$" ${path} ${bailFlag}`;
          break;

        case 'integration':
          // Run integration tests
          command = `npm test -- --testPathPattern=".*\\.integration\\.(test|spec)\\.(ts|js)$" ${path} ${bailFlag}`;
          break;

        case 'e2e':
          // Run end-to-end tests
          command = `npm run test:e2e ${path} ${bailFlag}`;
          break;

        case 'coverage':
          // Generate coverage report
          command = `npm test -- --coverage ${path}`;
          break;

        case 'verify':
          // Comprehensive verification
          const verificationSteps = [
            { name: 'lint', cmd: 'npm run lint' },
            { name: 'type-check', cmd: 'npm run type-check' },
            { name: 'test', cmd: 'npm test' },
            { name: 'build', cmd: 'npm run build' },
          ];

          const results = [];
          for (const step of verificationSteps) {
            try {
              const { stdout, stderr } = await execAsync(step.cmd);
              results.push({
                step: step.name,
                success: true,
                output: stdout,
                errors: stderr || null,
              });
            } catch (error: any) {
              results.push({
                step: step.name,
                success: false,
                error: error.message,
              });
              if (bail) break;
            }
          }

          return {
            success: results.every(r => r.success),
            operation,
            verification: results,
            timestamp: new Date().toISOString(),
          };

        case 'benchmark':
          // Run performance benchmarks
          command = `npm run benchmark ${path}`;
          break;

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      // Execute command if not handled by switch statement
      if (command) {
        try {
          const { stdout, stderr } = await execAsync(command, {
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          });

          // Parse test results
          const testsPassed = stdout.match(/\d+ passed/)?.[0];
          const testsFailed = stdout.match(/\d+ failed/)?.[0];
          const testsTotal = stdout.match(/\d+ total/)?.[0];

          result = {
            success: !stderr && !testsFailed,
            output: stdout,
            errors: stderr || null,
            summary: {
              passed: testsPassed || '0 passed',
              failed: testsFailed || '0 failed',
              total: testsTotal || '0 total',
            },
          };
        } catch (error: any) {
          result = {
            success: false,
            output: error.stdout || '',
            error: error.message,
            stderr: error.stderr || null,
          };
        }
      }

      return {
        success: result.success || false,
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

export default testVerification;
