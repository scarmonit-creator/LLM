import { exec } from 'child_process';
import { promisify } from 'util';
import { Tool } from './types.js';

const execAsync = promisify(exec);

/**
 * Git Operations Tool - Comprehensive git workflow automation
 * Enables autonomous git operations: clone, commit, push, branch, merge, PR creation
 */
export const gitOperations: Tool = {
  name: 'git_operations',
  description: 'Execute git operations for autonomous version control workflow',
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
      const cwd = path;

      switch (operation) {
        case 'clone':
          if (!repository) throw new Error('Repository URL required for clone');
          command = `git clone ${repository}`;
          break;

        case 'status':
          command = 'git status';
          break;

        case 'add':
          const fileList = files?.join(' ') || '.';
          command = `git add ${fileList}`;
          break;

        case 'commit':
          if (!message) throw new Error('Commit message required');
          command = `git commit -m "${message.replace(/"/g, '\\"')}"`;
          break;

        case 'push':
          const pushBranch = branch || 'main';
          command = `git push origin ${pushBranch}`;
          break;

        case 'pull':
          command = 'git pull';
          break;

        case 'branch':
          if (branch) {
            command = `git branch ${branch}`;
          } else {
            command = 'git branch';
          }
          break;

        case 'checkout':
          if (!branch) throw new Error('Branch name required for checkout');
          command = `git checkout ${branch}`;
          break;

        case 'merge':
          if (!branch) throw new Error('Branch name required for merge');
          command = `git merge ${branch}`;
          break;

        case 'log':
          command = 'git log --oneline -10';
          break;

        case 'diff':
          command = 'git diff';
          break;

        default:
          throw new Error(`Unknown git operation: ${operation}`);
      }

      const { stdout, stderr } = await execAsync(command, { cwd });

      return {
        success: true,
        operation,
        output: stdout,
        error: stderr || null,
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

export default gitOperations;
