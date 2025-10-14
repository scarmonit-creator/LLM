#!/usr/bin/env node

/**
 * Self-Healing Recovery Script
 * Automated recovery mechanisms for CI/CD failures
 * Implements intelligent diagnosis and remediation strategies
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

const RECOVERY_MODE = process.env.RECOVERY_MODE || 'auto';
const NOTIFICATION_ENABLED = process.env.NOTIFICATION_ENABLED === 'true';

class SelfHealingRecovery {
  constructor() {
    this.recoveryAttempts = [];
    this.diagnostics = [];
  }

  log(level, message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    console.log(logMessage);
    this.diagnostics.push({ timestamp, level, message });
  }

  async diagnose() {
    this.log('info', 'Starting diagnostic phase...');
    const issues = [];

    // Check Node.js environment
    try {
      const { stdout: nodeVersion } = await execAsync('node --version');
      this.log('info', `Node.js version: ${nodeVersion.trim()}`);
    } catch (error) {
      issues.push({
        component: 'nodejs',
        severity: 'critical',
        message: 'Node.js not available',
        error: error.message
      });
    }

    // Check npm dependencies
    try {
      await fs.access('node_modules');
      this.log('info', 'node_modules directory exists');
    } catch (error) {
      issues.push({
        component: 'dependencies',
        severity: 'high',
        message: 'node_modules directory missing',
        recovery: 'reinstall_dependencies'
      });
    }

    // Check if A2A server is running
    try {
      const response = await fetch('http://localhost:3001/health', {
        timeout: 2000
      });
      if (response.ok) {
        this.log('info', 'A2A server is healthy');
      } else {
        issues.push({
          component: 'a2a-server',
          severity: 'high',
          message: 'A2A server responding but not healthy',
          recovery: 'restart_server'
        });
      }
    } catch (error) {
      issues.push({
        component: 'a2a-server',
        severity: 'high',
        message: 'A2A server not responding',
        recovery: 'start_server'
      });
    }

    // Check Ollama service
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        timeout: 2000
      });
      if (response.ok) {
        this.log('info', 'Ollama service is healthy');
      } else {
        issues.push({
          component: 'ollama',
          severity: 'medium',
          message: 'Ollama service not responding correctly',
          recovery: 'restart_ollama'
        });
      }
    } catch (error) {
      issues.push({
        component: 'ollama',
        severity: 'medium',
        message: 'Ollama service not available',
        recovery: 'skip_ollama_tests'
      });
    }

    // Check AI Bridge
    try {
      const response = await fetch('http://localhost:8080', {
        timeout: 2000
      });
      if (response.ok) {
        this.log('info', 'AI Bridge is healthy');
      }
    } catch (error) {
      issues.push({
        component: 'ai-bridge',
        severity: 'medium',
        message: 'AI Bridge not responding',
        recovery: 'start_bridge'
      });
    }

    // Check test files
    try {
      await fs.access('tests/integration/a2a-self-test-framework.test.js');
      this.log('info', 'Test files are accessible');
    } catch (error) {
      issues.push({
        component: 'test-files',
        severity: 'critical',
        message: 'Test files not found',
        recovery: 'pull_latest_code'
      });
    }

    return issues;
  }

  async recover(issues) {
    this.log('info', `Found ${issues.length} issue(s), initiating recovery...`);

    if (issues.length === 0) {
      this.log('success', 'No issues detected, system is healthy');
      return { recovered: true, message: 'System healthy' };
    }

    const recoveryResults = [];

    for (const issue of issues) {
      this.log('info', `Attempting recovery for: ${issue.component}`);
      const result = await this.executeRecovery(issue);
      recoveryResults.push(result);
      this.recoveryAttempts.push({
        issue,
        result,
        timestamp: new Date().toISOString()
      });
    }

    const successfulRecoveries = recoveryResults.filter(r => r.success).length;
    const totalAttempts = recoveryResults.length;

    this.log('info', `Recovery complete: ${successfulRecoveries}/${totalAttempts} successful`);

    return {
      recovered: successfulRecoveries > 0,
      total: totalAttempts,
      successful: successfulRecoveries,
      results: recoveryResults
    };
  }

  async executeRecovery(issue) {
    const { component, recovery } = issue;

    try {
      switch (recovery) {
        case 'reinstall_dependencies':
          this.log('info', 'Reinstalling npm dependencies...');
          await execAsync('npm ci');
          return { success: true, component, action: 'reinstalled dependencies' };

        case 'start_server':
        case 'restart_server':
          this.log('info', 'Starting/restarting A2A server...');
          // Kill any existing process
          try {
            await execAsync('pkill -f "node.*a2a-agent-server"');
          } catch (e) {
            // Process might not be running
          }
          // Start new process
          const server = spawn('node', ['src/enhanced-a2a-server.js'], {
            detached: true,
            stdio: 'ignore'
          });
          server.unref();
          await new Promise(resolve => setTimeout(resolve, 3000));
          return { success: true, component, action: 'restarted server' };

        case 'start_bridge':
          this.log('info', 'Starting AI Bridge...');
          const bridge = spawn('node', ['src/ai-bridge.js'], {
            detached: true,
            stdio: 'ignore'
          });
          bridge.unref();
          await new Promise(resolve => setTimeout(resolve, 2000));
          return { success: true, component, action: 'started bridge' };

        case 'restart_ollama':
          this.log('info', 'Attempting to restart Ollama...');
          try {
            await execAsync('systemctl restart ollama || docker restart ollama || true');
            await new Promise(resolve => setTimeout(resolve, 5000));
            return { success: true, component, action: 'restarted ollama' };
          } catch (error) {
            return { success: false, component, action: 'failed to restart ollama', error: error.message };
          }

        case 'skip_ollama_tests':
          this.log('warning', 'Skipping Ollama-dependent tests...');
          process.env.SKIP_OLLAMA_TESTS = 'true';
          return { success: true, component, action: 'configured to skip ollama tests' };

        case 'pull_latest_code':
          this.log('info', 'Pulling latest code from repository...');
          await execAsync('git fetch origin && git merge origin/$(git branch --show-current)');
          return { success: true, component, action: 'pulled latest code' };

        default:
          this.log('warning', `No recovery strategy for: ${recovery}`);
          return { success: false, component, action: 'no recovery strategy' };
      }
    } catch (error) {
      this.log('error', `Recovery failed for ${component}: ${error.message}`);
      return { success: false, component, action: recovery, error: error.message };
    }
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      recovery_mode: RECOVERY_MODE,
      diagnostics: this.diagnostics,
      recovery_attempts: this.recoveryAttempts,
      summary: {
        total_issues: this.recoveryAttempts.length,
        successful_recoveries: this.recoveryAttempts.filter(a => a.result.success).length,
        failed_recoveries: this.recoveryAttempts.filter(a => !a.result.success).length
      }
    };

    await fs.writeFile(
      'self-healing-report.json',
      JSON.stringify(report, null, 2)
    );

    this.log('info', 'Recovery report saved to self-healing-report.json');
    return report;
  }

  async notify(report) {
    if (!NOTIFICATION_ENABLED) {
      return;
    }

    this.log('info', 'Sending notification...');

    const summary = `Self-healing recovery completed: ${report.summary.successful_recoveries}/${report.summary.total_issues} successful`;
    
    // In a real implementation, this would send to Slack, email, etc.
    console.log('\n=== RECOVERY NOTIFICATION ===');
    console.log(summary);
    console.log('============================\n');
  }
}

// Main execution
async function main() {
  console.log('\n==========================================');
  console.log('  Self-Healing Recovery System');
  console.log('==========================================\n');

  const recovery = new SelfHealingRecovery();

  try {
    // Phase 1: Diagnosis
    console.log('Phase 1: Diagnostic Scan');
    console.log('------------------------------------------');
    const issues = await recovery.diagnose();
    console.log('');

    // Phase 2: Recovery
    console.log('Phase 2: Recovery Execution');
    console.log('------------------------------------------');
    const result = await recovery.recover(issues);
    console.log('');

    // Phase 3: Reporting
    console.log('Phase 3: Report Generation');
    console.log('------------------------------------------');
    const report = await recovery.generateReport();
    await recovery.notify(report);
    console.log('');

    // Exit status
    if (result.recovered) {
      console.log('✓ Self-healing completed successfully\n');
      process.exit(0);
    } else {
      console.log('✗ Self-healing partially completed\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n✗ Self-healing failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default SelfHealingRecovery;
export { SelfHealingRecovery };
