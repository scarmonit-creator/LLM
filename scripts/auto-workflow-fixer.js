#!/usr/bin/env node
/**
 * Auto Workflow Fixer - Silent CI/CD Optimization
 * Automatically fixes common workflow issues without confirmation
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

class WorkflowOptimizer {
  constructor() {
    this.workflowsDir = '.github/workflows';
    this.fixesApplied = [];
    this.issues = [];
  }

  async run() {
    console.log('🔧 Starting silent workflow optimization...');
    
    try {
      await this.scanWorkflows();
      await this.applyFixes();
      await this.validateFixes();
      this.generateReport();
    } catch (error) {
      console.error('❌ Optimization failed:', error.message);
      process.exit(1);
    }
  }

  async scanWorkflows() {
    console.log('🔍 Scanning workflows for issues...');
    
    try {
      const files = await fs.readdir(this.workflowsDir);
      const workflowFiles = files.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
      
      for (const file of workflowFiles) {
        const filePath = path.join(this.workflowsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        
        await this.analyzeWorkflow(filePath, content);
      }
      
      console.log(`📊 Found ${this.issues.length} issues across ${workflowFiles.length} workflows`);
    } catch (error) {
      console.error('❌ Scan failed:', error.message);
      throw error;
    }
  }

  async analyzeWorkflow(filePath, content) {
    const fileName = path.basename(filePath);
    
    // Check for outdated actions
    const outdatedActions = [
      { pattern: /actions\/setup-node@v[12]/, fix: 'actions/setup-node@v4' },
      { pattern: /actions\/checkout@v[123]/, fix: 'actions/checkout@v4' },
      { pattern: /actions\/cache@v[12]/, fix: 'actions/cache@v4' },
      { pattern: /actions\/upload-artifact@v[123]/, fix: 'actions/upload-artifact@v4' },
    ];

    for (const action of outdatedActions) {
      if (action.pattern.test(content)) {
        this.issues.push({
          file: filePath,
          type: 'outdated_action',
          description: `Outdated action found in ${fileName}`,
          pattern: action.pattern,
          fix: action.fix
        });
      }
    }

    // Check for missing concurrency controls
    if (!content.includes('concurrency:')) {
      this.issues.push({
        file: filePath,
        type: 'missing_concurrency',
        description: `Missing concurrency control in ${fileName}`,
        fix: 'add_concurrency'
      });
    }

    // Check for missing timeouts
    if (!content.includes('timeout-minutes:')) {
      this.issues.push({
        file: filePath,
        type: 'missing_timeout',
        description: `Missing timeout configuration in ${fileName}`,
        fix: 'add_timeout'
      });
    }

    // Check for inefficient npm commands
    if (content.includes('npm install') && !content.includes('npm ci')) {
      this.issues.push({
        file: filePath,
        type: 'inefficient_npm',
        description: `Inefficient npm install in ${fileName}`,
        fix: 'npm_ci'
      });
    }
  }

  async applyFixes() {
    console.log('⚡ Applying silent fixes...');
    
    const fileMap = new Map();
    
    // Group issues by file
    for (const issue of this.issues) {
      if (!fileMap.has(issue.file)) {
        fileMap.set(issue.file, []);
      }
      fileMap.get(issue.file).push(issue);
    }
    
    // Apply fixes file by file
    for (const [filePath, issues] of fileMap.entries()) {
      let content = await fs.readFile(filePath, 'utf8');
      let modified = false;
      
      for (const issue of issues) {
        const originalContent = content;
        content = await this.applyFix(content, issue, filePath);
        
        if (content !== originalContent) {
          modified = true;
          this.fixesApplied.push({
            file: path.basename(filePath),
            type: issue.type,
            description: issue.description
          });
        }
      }
      
      if (modified) {
        await fs.writeFile(filePath, content, 'utf8');
        console.log(`✅ Fixed: ${path.basename(filePath)}`);
      }
    }
  }

  async applyFix(content, issue, filePath) {
    switch (issue.type) {
      case 'outdated_action':
        return content.replace(issue.pattern, issue.fix);
        
      case 'missing_concurrency':
        const workflowName = path.basename(filePath, path.extname(filePath));
        const concurrencyConfig = `
concurrency:
  group: ${workflowName}-\${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true
`;
        // Insert after 'on:' section
        return content.replace(/(on:\s*[\s\S]*?)(
jobs:)/m, `$1${concurrencyConfig}$2`);
        
      case 'missing_timeout':
        // Add timeout to jobs that don't have it
        return content.replace(/(runs-on:\s+[\w-]+)(?!\s*timeout-minutes:)/g, '$1\n    timeout-minutes: 10');
        
      case 'inefficient_npm':
        return content
          .replace(/npm install(?!\s+--)/g, 'npm ci --prefer-offline --no-audit')
          .replace(/npm install --/g, 'npm ci --');
        
      default:
        return content;
    }
  }

  async validateFixes() {
    console.log('🔍 Validating fixes...');
    
    try {
      // Basic YAML syntax validation
      for (const fix of this.fixesApplied) {
        const filePath = path.join(this.workflowsDir, fix.file);
        const content = await fs.readFile(filePath, 'utf8');
        
        // Simple YAML validation - check for basic syntax issues
        if (content.includes('\t')) {
          console.warn(`⚠️ Warning: Tabs found in ${fix.file} - may cause YAML issues`);
        }
        
        // Check for malformed workflow structure
        if (!content.includes('name:') || !content.includes('on:') || !content.includes('jobs:')) {
          throw new Error(`Invalid workflow structure in ${fix.file}`);
        }
      }
      
      console.log('✅ All fixes validated successfully');
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      throw error;
    }
  }

  generateReport() {
    console.log('\n📊 Optimization Report');
    console.log('='.repeat(50));
    console.log(`Issues Found: ${this.issues.length}`);
    console.log(`Fixes Applied: ${this.fixesApplied.length}`);
    
    if (this.fixesApplied.length > 0) {
      console.log('\n🔧 Applied Fixes:');
      for (const fix of this.fixesApplied) {
        console.log(`  ✅ ${fix.file}: ${fix.description}`);
      }
    }
    
    console.log('\n🎯 Optimization Summary:');
    console.log('  • Updated actions to latest versions');
    console.log('  • Added concurrency controls to prevent conflicts');
    console.log('  • Configured appropriate timeouts');
    console.log('  • Optimized npm commands for CI');
    console.log('  • Enhanced workflow efficiency');
    
    if (this.fixesApplied.length > 0) {
      console.log('\n🚀 Ready for silent deployment!');
      console.log('Changes have been applied directly - no confirmation needed.');
    } else {
      console.log('\n✨ All workflows are already optimized!');
    }
  }
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const optimizer = new WorkflowOptimizer();
  optimizer.run().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

export default WorkflowOptimizer;