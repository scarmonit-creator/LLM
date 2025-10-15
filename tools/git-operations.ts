import { exec } from 'child_process';
import { promisify } from 'util';
import shellescape from 'shell-escape';

const execAsync = promisify(exec);

export interface GitArgs {
  operation: 'init' | 'clone' | 'add' | 'commit' | 'push' | 'pull' | 'branch' | 'checkout' | 'merge' | 'log' | 'diff';
  repoUrl?: string;
  message?: string;
  branch?: string;
  files?: string[];
  directory?: string;
}

export interface GitResult {
  success: boolean;
  operation: string;
  output?: string;
  error?: string | null;
}

const gitOperations = {
  name: 'git_operations',
  description:
    'Execute git operations including init, clone, add, commit, push, pull, branch, checkout, merge, log, and diff. Supports all common git workflows.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['init', 'clone', 'add', 'commit', 'push', 'pull', 'branch', 'checkout', 'merge', 'log', 'diff'],
        description: 'Git operation to perform',
      },
      repoUrl: {
        type: 'string',
        description: 'Repository URL (for clone operation)',
      },
      message: {
        type: 'string',
        description: 'Commit message (for commit operation)',
      },
      branch: {
        type: 'string',
        description: 'Branch name (for branch, checkout, merge, push operations)',
      },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Files to add (for add operation)',
      },
      directory: {
        type: 'string',
        description: 'Working directory for git operations',
      },
    },
    required: ['operation'],
  },
  execute: async (args: GitArgs): Promise<GitResult> => {
    const { operation, repoUrl, message, branch, files, directory } = args;
    const cwd = directory || process.cwd();
    let command: string;

    try {
      switch (operation) {
        case 'init':
          command = 'git init';
          break;
        case 'clone':
          if (!repoUrl) throw new Error('Repository URL required for clone');
          command = `git clone ${shellescape([repoUrl])}`;
          break;
        case 'add':
          const fileList = files?.join(' ') || '.';
          command = `git add ${fileList}`;
          break;
        case 'commit':
          if (!message) throw new Error('Commit message required');
          // Proper string escaping with shell-escape library
          command = `git commit -m ${shellescape([message])}`;
          break;
        case 'push':
          const pushBranch = branch || 'main';
          command = `git push origin ${shellescape([pushBranch])}`;
          break;
        case 'pull':
          command = 'git pull';
          break;
        case 'branch':
          if (branch) {
            command = `git branch ${shellescape([branch])}`;
          } else {
            command = 'git branch';
          }
          break;
        case 'checkout':
          if (!branch) throw new Error('Branch name required for checkout');
          command = `git checkout ${shellescape([branch])}`;
          break;
        case 'merge':
          if (!branch) throw new Error('Branch name required for merge');
          command = `git merge ${shellescape([branch])}`;
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
