// Git Operations Tool
import { execSync } from 'child_process';

export class GitOperations {
  constructor() {
    this.name = 'git_operations';
    this.description = 'Performs Git operations like status, commit, push, pull';
  }

  async getStatus(directory = '.') {
    try {
      const output = execSync('git status --porcelain', { 
        cwd: directory,
        encoding: 'utf8'
      });
      return this.parseStatus(output);
    } catch (error) {
      throw new Error(`Git status failed: ${error.message}`);
    }
  }

  parseStatus(output) {
    const lines = output.trim().split('\n').filter(line => line);
    return lines.map(line => {
      const status = line.substring(0, 2);
      const file = line.substring(3);
      return { status, file };
    });
  }

  async commit(message, directory = '.') {
    try {
      execSync(`git add .`, { cwd: directory });
      execSync(`git commit -m "${message}"`, { cwd: directory });
      return { success: true, message: 'Committed successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getCurrentBranch(directory = '.') {
    try {
      const branch = execSync('git branch --show-current', {
        cwd: directory,
        encoding: 'utf8'
      }).trim();
      return branch;
    } catch (error) {
      throw new Error(`Failed to get current branch: ${error.message}`);
    }
  }
}

export default GitOperations;