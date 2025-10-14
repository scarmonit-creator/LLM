#!/usr/bin/env node

/**
 * Branch Format Optimizer
 * Optimizes and validates branch naming conventions based on configuration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class BranchOptimizer {
  constructor(configPath = '.codex/branch-format-config.json') {
    this.config = this.loadConfig(configPath);
    this.currentBranch = this.getCurrentBranch();
  }

  loadConfig(configPath) {
    try {
      const configFile = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configFile);
    } catch (error) {
      console.error(`Failed to load config from ${configPath}:`, error.message);
      return this.getDefaultConfig();
    }
  }

  getDefaultConfig() {
    return {
      branchFormats: {
        standard: {
          format: 'codex/{feature}',
          tags: ['{feature}', '{date}', '{time}']
        }
      },
      rules: {
        maxLength: 50,
        allowedCharacters: 'a-z0-9-',
        validation: {
          pattern: '^(codex|feat|auto)/[a-z0-9-]+$'
        }
      }
    };
  }

  getCurrentBranch() {
    try {
      return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    } catch (error) {
      console.error('Failed to get current branch:', error.message);
      return 'main';
    }
  }

  generateBranchName(type, description, options = {}) {
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const format = this.config.branchFormats[type]?.format || this.config.branchFormats.standard.format;
    
    let branchName = format
      .replace('{type}', type)
      .replace('{category}', options.category || type)
      .replace('{feature}', description)
      .replace('{description}', description)
      .replace('{timestamp}', timestamp)
      .replace('{date}', timestamp)
      .replace('{time}', new Date().toTimeString().split(' ')[0].replace(/:/g, ''))
      .replace('{issue-id}', options.issueId || '')
      .replace('{priority}', options.priority || 'normal')
      .replace('{author}', options.author || 'auto');

    return this.sanitizeBranchName(branchName);
  }

  sanitizeBranchName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-\/]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, this.config.rules.maxLength);
  }

  validateBranchName(branchName) {
    const pattern = new RegExp(this.config.rules.validation.pattern);
    const isValid = pattern.test(branchName);
    const length = branchName.length;
    const maxLength = this.config.rules.maxLength;

    return {
      isValid,
      errors: [
        ...(!isValid ? ['Branch name does not match required pattern'] : []),
        ...(length > maxLength ? [`Branch name exceeds maximum length (${length}/${maxLength})`] : [])
      ]
    };
  }

  suggestOptimization(branchName) {
    const suggestions = [];
    
    // Check if current format can be optimized
    if (branchName.startsWith('codex/') && !branchName.includes('-')) {
      const feature = branchName.replace('codex/', '');
      const optimized = this.generateBranchName('optimize', feature);
      suggestions.push({
        type: 'format_optimization',
        current: branchName,
        suggested: optimized,
        reason: 'Enhanced format with categorization and timestamp'
      });
    }

    // Check for naming conventions
    if (branchName.includes('_')) {
      suggestions.push({
        type: 'naming_convention',
        current: branchName,
        suggested: branchName.replace(/_/g, '-'),
        reason: 'Use hyphens instead of underscores for consistency'
      });
    }

    // Check for length optimization
    if (branchName.length > 40) {
      suggestions.push({
        type: 'length_optimization',
        current: branchName,
        suggested: this.sanitizeBranchName(branchName),
        reason: 'Reduce branch name length for better readability'
      });
    }

    return suggestions;
  }

  cleanupStaleBranches() {
    if (!this.config.automation?.cleanupStale?.enabled) {
      return { message: 'Stale branch cleanup is disabled' };
    }

    try {
      const branches = execSync('git branch -r --merged', { encoding: 'utf8' })
        .split('\n')
        .map(branch => branch.trim())
        .filter(branch => branch && !branch.includes('HEAD'));

      const staleBranches = branches.filter(branch => {
        // Check if branch should be excluded
        const excludePatterns = this.config.automation.cleanupStale.excludePatterns || [];
        return !excludePatterns.some(pattern => branch.includes(pattern));
      });

      return {
        message: `Found ${staleBranches.length} potential stale branches`,
        branches: staleBranches
      };
    } catch (error) {
      return { error: `Failed to analyze branches: ${error.message}` };
    }
  }

  generateReport() {
    const validation = this.validateBranchName(this.currentBranch);
    const suggestions = this.suggestOptimization(this.currentBranch);
    const cleanup = this.cleanupStaleBranches();

    return {
      currentBranch: this.currentBranch,
      validation,
      suggestions,
      cleanup,
      timestamp: new Date().toISOString()
    };
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const optimizer = new BranchOptimizer();

  switch (args[0]) {
    case 'generate':
      const type = args[1] || 'standard';
      const description = args[2] || 'new-feature';
      const options = args[3] ? JSON.parse(args[3]) : {};
      console.log(optimizer.generateBranchName(type, description, options));
      break;

    case 'validate':
      const branchName = args[1] || optimizer.currentBranch;
      const validation = optimizer.validateBranchName(branchName);
      console.log(JSON.stringify(validation, null, 2));
      break;

    case 'suggest':
      const suggestions = optimizer.suggestOptimization(args[1] || optimizer.currentBranch);
      console.log(JSON.stringify(suggestions, null, 2));
      break;

    case 'cleanup':
      const cleanup = optimizer.cleanupStaleBranches();
      console.log(JSON.stringify(cleanup, null, 2));
      break;

    case 'report':
      const report = optimizer.generateReport();
      console.log(JSON.stringify(report, null, 2));
      break;

    default:
      console.log(`
Branch Optimizer - Usage:

  node branch-optimizer.js generate [type] [description] [options]
  node branch-optimizer.js validate [branch-name]
  node branch-optimizer.js suggest [branch-name]
  node branch-optimizer.js cleanup
  node branch-optimizer.js report

Examples:
  node branch-optimizer.js generate optimize "branch-format" '{"category":"feat"}'
  node branch-optimizer.js validate codex/unit-tests-for-feature
  node branch-optimizer.js suggest
  node branch-optimizer.js report
`);
  }
}

module.exports = BranchOptimizer;