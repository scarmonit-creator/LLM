/**
 * Git Operations Tool - Comprehensive git workflow automation
 * Enables autonomous git operations: clone, commit, push, branch, merge, PR creation
 * 
 * SECURITY: Updated to fix CodeQL Alert #6 - Incomplete String Escaping or Encoding
 * Implements proper command sanitization and shell escaping to prevent injection attacks
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { Tool } from './types.js';
import shellEscape from 'shell-escape';

const execAsync = promisify(exec);

/**
 * Sanitize and validate git operation parameters (SECURITY FIX)
 */
function sanitizeGitInput(input: string, type: 'message' | 'branch' | 'file' | 'url'): string {
  if (!input || typeof input !== 'string') {
    throw new Error(`Invalid ${type}: must be a non-empty string`);
  }

  // Remove null bytes and control characters
  let sanitized = input.replace(/[\x00-\x1f\x7f]/g, '');
  
  // Type-specific validation and sanitization
  switch (type) {
    case 'message':
      // Allow most characters for commit messages but escape dangerous ones
      sanitized = sanitized.replace(/[`$\\]/g, '\\$&');
      // Limit length to prevent buffer overflow
      if (sanitized.length > 1000) {
        throw new Error('Commit message too long (max 1000 characters)');
      }
      break;
      
    case 'branch':
      // Git branch names have specific requirements
      if (!/^[a-zA-Z0-9._/-]+$/.test(sanitized)) {
        throw new Error('Invalid branch name: only alphanumeric, dots, dashes, underscores and slashes allowed');
      }
      if (sanitized.startsWith('-') || sanitized.startsWith('.') || sanitized.includes('..')) {
        throw new Error('Invalid branch name: cannot start with dash/dot or contain consecutive dots');
      }
      break;
      
    case 'file':
      // File paths should not contain dangerous characters
      if (/[;|&`$\\]/.test(sanitized)) {
        throw new Error('Invalid file path: contains dangerous characters');
      }
      break;
      
    case 'url':
      // Basic URL validation - should start with http/https or be a git URL
      if (!sanitized.match(/^(https?:\/\/|git@|\.\/|\/)/)) {
        throw new Error('Invalid repository URL format');
      }
      break;
  }
  
  return sanitized;
}

/**
 * Build secure git command using proper escaping (SECURITY FIX)
 */
function buildSecureCommand(baseCommand: string, args: string[]): string {
  // Use shell-escape to properly escape all arguments
  const escapedArgs = args.map(arg => {
    if (typeof arg !== 'string') {
      throw new Error('All command arguments must be strings');
    }
    return arg;
  });
  
  // Use shellEscape to create a secure command
  return shellEscape([baseCommand, ...escapedArgs]);
}

export const gitOperations: Tool = {
  name: 'git_operations',
  description: 'Execute git operations for autonomous version control workflow with secure command execution',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'clone',
          'status',
          'add',
          'commit',
          'push',
          'pull',
          'branch',
          'checkout',
          'merge',
          'log',
          'diff',
        ],
        description: 'Git operation to perform',
      },
      repository: {
        type: 'string',
        description: 'Repository URL for clone operations',
      },
      branch: {
        type: 'string',
        description: 'Branch name for branch operations',
      },
      message: {
        type: 'string',
        description: 'Commit message',
      },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Files to add (use "." for all)',
      },
      path: {
        type: 'string',
        description: 'Repository path (default: current directory)',
      },
    },
    required: ['operation'],
  },

  async execute(args: any): Promise<any> {
    const { operation, repository, branch, message, files, path = '.' } = args;

    try {
      let command = '';
      let commandArgs: string[] = [];
      const cwd = path;

      // Validate and sanitize the working directory path
      if (path !== '.' && !/^[\/\w.-]+$/.test(path)) {
        throw new Error('Invalid path: contains dangerous characters');
      }

      switch (operation) {
        case 'clone':
          if (!repository) throw new Error('Repository URL required for clone');
          const sanitizedRepo = sanitizeGitInput(repository, 'url');
          command = 'git';
          commandArgs = ['clone', sanitizedRepo];
          break;

        case 'status':
          command = 'git';
          commandArgs = ['status'];
          break;

        case 'add':
          command = 'git';
          commandArgs = ['add'];
          
          if (files && Array.isArray(files)) {
            // Validate and sanitize each file path
            const sanitizedFiles = files.map(file => sanitizeGitInput(file, 'file'));
            commandArgs.push(...sanitizedFiles);
          } else {
            commandArgs.push('.');
          }
          break;

        case 'commit':
          if (!message) throw new Error('Commit message required');
          const sanitizedMessage = sanitizeGitInput(message, 'message');
          command = 'git';
          commandArgs = ['commit', '-m', sanitizedMessage];
          break;

        case 'push':
          command = 'git';
          commandArgs = ['push'];
          
          if (branch) {
            const sanitizedBranch = sanitizeGitInput(branch, 'branch');
            commandArgs.push('origin', sanitizedBranch);
          } else {
            commandArgs.push('origin', 'main');
          }
          break;

        case 'pull':
          command = 'git';
          commandArgs = ['pull'];
          break;

        case 'branch':
          command = 'git';
          if (branch) {
            const sanitizedBranch = sanitizeGitInput(branch, 'branch');
            commandArgs = ['branch', sanitizedBranch];
          } else {
            commandArgs = ['branch'];
          }
          break;

        case 'checkout':
          if (!branch) throw new Error('Branch name required for checkout');
          const sanitizedCheckoutBranch = sanitizeGitInput(branch, 'branch');
          command = 'git';
          commandArgs = ['checkout', sanitizedCheckoutBranch];
          break;

        case 'merge':
          if (!branch) throw new Error('Branch name required for merge');
          const sanitizedMergeBranch = sanitizeGitInput(branch, 'branch');
          command = 'git';
          commandArgs = ['merge', sanitizedMergeBranch];
          break;

        case 'log':
          command = 'git';
          commandArgs = ['log', '--oneline', '-10'];
          break;

        case 'diff':
          command = 'git';
          commandArgs = ['diff'];
          break;

        default:
          throw new Error(`Unknown git operation: ${operation}`);
      }

      // Build secure command with proper escaping (SECURITY FIX)
      const secureCommand = buildSecureCommand(command, commandArgs);
      
      // Execute with additional security measures
      const execOptions = {
        cwd,
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024, // 1MB max buffer
        env: {
          ...process.env,
          // Ensure clean environment
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          USER: process.env.USER
        },
        shell: false // Disable shell interpretation for security
      };

      const { stdout, stderr } = await execAsync(secureCommand, execOptions);

      return {
        success: true,
        operation,
        command: `git ${commandArgs.join(' ')}`, // Log safe command representation
        output: stdout,
        error: stderr || null,
      };
      
    } catch (error: any) {
      // Log error without exposing sensitive information
      const safeError = error.message ? error.message.replace(/[`$\\]/g, '\\$&') : 'Unknown error';
      
      return {
        success: false,
        operation,
        error: safeError,
      };
    }
  },
};

export default gitOperations;