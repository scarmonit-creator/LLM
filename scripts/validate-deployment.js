#!/usr/bin/env node

/**
 * Deployment Validation Script
 * Validates deployment readiness before production release
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class DeploymentValidator {
  constructor() {
    this.validations = {
      passed: [],
      failed: [],
      warnings: []
    };
  }

  async validatePackageJson() {
    console.log('Validating package.json...');
    
    try {
      const pkgPath = path.join(process.cwd(), 'package.json');
      const pkgContent = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);

      // Check required fields
      const requiredFields = ['name', 'version', 'description', 'scripts'];
      const missingFields = requiredFields.filter(field => !pkg[field]);

      if (missingFields.length === 0) {
        this.validations.passed.push('package.json structure');
        console.log('✓ package.json is valid');
        return true;
      } else {
        this.validations.failed.push(`Missing fields: ${missingFields.join(', ')}`);
        console.log('✗ package.json is missing required fields');
        return false;
      }
    } catch (error) {
      this.validations.failed.push('package.json validation');
      console.log('✗ Failed to validate package.json:', error.message);
      return false;
    }
  }

  async validateDependencies() {
    console.log('Validating dependencies...');
    
    try {
      await execAsync('npm list --depth=0');
      this.validations.passed.push('dependency validation');
      console.log('✓ All dependencies are installed');
      return true;
    } catch (error) {
      // npm list returns non-zero if there are issues
      if (error.stdout && !error.stdout.includes('UNMET')) {
        this.validations.passed.push('dependency validation');
        console.log('✓ Dependencies validated (with warnings)');
        return true;
      }
      this.validations.failed.push('dependency validation');
      console.log('✗ Dependency issues detected');
      return false;
    }
  }

  async validateEnvironment() {
    console.log('Validating environment configuration...');
    
    const requiredEnvVars = [];
    const optionalEnvVars = ['A2A_PORT', 'BRIDGE_PORT', 'OLLAMA_BASE_URL'];
    
    // Check optional vars for warnings
    optionalEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        this.validations.warnings.push(`Optional env var ${envVar} not set`);
      }
    });

    // All required vars present
    if (requiredEnvVars.every(v => process.env[v])) {
      this.validations.passed.push('environment configuration');
      console.log('✓ Environment configuration validated');
      return true;
    } else {
      const missing = requiredEnvVars.filter(v => !process.env[v]);
      this.validations.failed.push(`Missing env vars: ${missing.join(', ')}`);
      console.log('✗ Missing required environment variables');
      return false;
    }
  }

  async validateFileStructure() {
    console.log('Validating file structure...');
    
    const requiredFiles = [
      'package.json',
      'README.md',
      '.github/workflows/a2a-self-test-ci.yml',
      'src/enhanced-a2a-server.js',
      'tests/integration/a2a-self-test-framework.test.js'
    ];

    const missingFiles = [];
    for (const file of requiredFiles) {
      try {
        await fs.access(path.join(process.cwd(), file));
      } catch (error) {
        missingFiles.push(file);
      }
    }

    if (missingFiles.length === 0) {
      this.validations.passed.push('file structure');
      console.log('✓ All required files present');
      return true;
    } else {
      this.validations.failed.push(`Missing files: ${missingFiles.join(', ')}`);
      console.log('✗ Missing required files:', missingFiles);
      return false;
    }
  }

  async validateTestCoverage() {
    console.log('Checking test coverage...');
    
    try {
      // Check if coverage directory exists
      const coveragePath = path.join(process.cwd(), 'coverage');
      await fs.access(coveragePath);
      
      this.validations.passed.push('test coverage available');
      console.log('✓ Test coverage data available');
      return true;
    } catch (error) {
      this.validations.warnings.push('No test coverage data found');
      console.log('⚠ Test coverage data not found (non-critical)');
      return true; // Not a blocking issue
    }
  }

  async validateGitStatus() {
    console.log('Validating git status...');
    
    try {
      const { stdout } = await execAsync('git status --porcelain');
      
      if (stdout.trim() === '') {
        this.validations.passed.push('git status clean');
        console.log('✓ Working directory is clean');
        return true;
      } else {
        this.validations.warnings.push('Uncommitted changes present');
        console.log('⚠ Uncommitted changes detected (non-critical in CI)');
        return true; // Not blocking in CI context
      }
    } catch (error) {
      this.validations.warnings.push('Git validation skipped');
      console.log('⚠ Git validation skipped');
      return true;
    }
  }

  async validate() {
    console.log('\n=== Deployment Validation ===\n');

    const results = [
      await this.validatePackageJson(),
      await this.validateDependencies(),
      await this.validateEnvironment(),
      await this.validateFileStructure(),
      await this.validateTestCoverage(),
      await this.validateGitStatus()
    ];

    console.log('\n=== Validation Summary ===\n');
    console.log(`Passed: ${this.validations.passed.length}`);
    console.log(`Failed: ${this.validations.failed.length}`);
    console.log(`Warnings: ${this.validations.warnings.length}`);

    if (this.validations.warnings.length > 0) {
      console.log('\nWarnings:');
      this.validations.warnings.forEach(warning => 
        console.log(`  ⚠ ${warning}`)
      );
    }

    if (this.validations.failed.length > 0) {
      console.log('\nFailures:');
      this.validations.failed.forEach(failure => 
        console.log(`  ✗ ${failure}`)
      );
    }

    const allPassed = results.every(r => r === true);
    
    console.log(`\n${allPassed ? '✓ READY' : '✗ NOT READY'} for deployment\n`);

    // Generate validation report
    const report = {
      timestamp: new Date().toISOString(),
      ready: allPassed,
      summary: {
        passed: this.validations.passed.length,
        failed: this.validations.failed.length,
        warnings: this.validations.warnings.length
      },
      details: this.validations
    };

    await fs.writeFile(
      'deployment-validation.json',
      JSON.stringify(report, null, 2)
    );

    console.log('✓ Validation report saved to deployment-validation.json\n');

    process.exit(allPassed ? 0 : 1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new DeploymentValidator();
  validator.validate().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

export default DeploymentValidator;
