#!/usr/bin/env node

/**
 * AUTONOMOUS SECURITY SCANNER
 * Ultra-High Security Vulnerability Detection System
 * Real-time threat assessment and mitigation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class AutonomousSecurityScanner {
  constructor() {
    this.vulnerabilities = [];
    this.securityRules = {
      // Critical security patterns
      criticalPatterns: [
        /eval\s*\(/g,
        /innerHTML\s*=/g,
        /document\.write\s*\(/g,
        /\.\*\s*require\s*\(/g,
        /process\.env\[.*\]/g,
        /execSync\s*\(/g
      ],
      // Sensitive file patterns
      sensitiveFiles: [
        /\.env$/,
        /\.pem$/,
        /\.key$/,
        /password/i,
        /secret/i,
        /token/i
      ],
      // Dangerous dependencies
      dangerousDeps: [
        'eval',
        'vm2',
        'serialize-javascript'
      ]
    };
  }

  async runSecurityScan() {
    console.log('🔒 Autonomous Security Scanner Starting...');
    console.log('🛡️  Performing comprehensive security analysis...');
    
    const startTime = Date.now();
    
    try {
      // 1. Dependency vulnerability scan
      await this.scanDependencies();
      
      // 2. Code pattern analysis
      await this.scanCodePatterns();
      
      // 3. File system security check
      await this.scanFileSystem();
      
      // 4. Environment variable security
      await this.scanEnvironment();
      
      // 5. Generate security report
      this.generateSecurityReport();
      
      const scanTime = Date.now() - startTime;
      console.log(`✅ Security scan completed in ${scanTime}ms`);
      
    } catch (error) {
      console.error('❌ Security scan failed:', error.message);
      process.exit(1);
    }
  }

  async scanDependencies() {
    console.log('📦 Scanning dependencies for vulnerabilities...');
    
    try {
      // Run npm audit
      const auditResult = execSync('npm audit --json', { 
        encoding: 'utf8', 
        cwd: path.join(__dirname, '..') 
      });
      
      const audit = JSON.parse(auditResult);
      
      if (audit.vulnerabilities && Object.keys(audit.vulnerabilities).length > 0) {
        Object.entries(audit.vulnerabilities).forEach(([dep, vuln]) => {
          if (vuln.severity === 'high' || vuln.severity === 'critical') {
            this.vulnerabilities.push({
              type: 'dependency',
              severity: vuln.severity,
              package: dep,
              description: vuln.via?.[0]?.title || 'Unknown vulnerability',
              recommendation: 'Update dependency to latest secure version'
            });
          }
        });
      }
      
      console.log(`✅ Dependency scan complete - ${this.vulnerabilities.length} critical issues found`);
      
    } catch (error) {
      if (error.status === 1) {
        // npm audit found vulnerabilities
        console.log('⚠️  Vulnerabilities detected in dependencies');
      } else {
        console.log('⚠️  Dependency scan warning:', error.message);
      }
    }
  }

  async scanCodePatterns() {
    console.log('🔍 Scanning code for security patterns...');
    
    const projectRoot = path.join(__dirname, '..');
    const filesToScan = this.getJavaScriptFiles(projectRoot);
    
    for (const filePath of filesToScan) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        this.analyzeCodeContent(content, filePath);
      } catch (error) {
        console.log(`⚠️  Could not scan ${filePath}: ${error.message}`);
      }
    }
    
    console.log(`✅ Code pattern scan complete - analyzed ${filesToScan.length} files`);
  }

  analyzeCodeContent(content, filePath) {
    // Check for dangerous patterns
    this.securityRules.criticalPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        this.vulnerabilities.push({
          type: 'code-pattern',
          severity: 'high',
          file: filePath,
          pattern: pattern.toString(),
          matches: matches.length,
          description: `Dangerous code pattern detected: ${pattern}`,
          recommendation: 'Review and sanitize code pattern usage'
        });
      }
    });
    
    // Check for hardcoded secrets
    const secretPatterns = [
      /(['")`])[a-zA-Z0-9+\/]{32,}\1/g,
      /(?:password|token|key|secret)\s*[:=]\s*['"](\w+)['"]/gi
    ];
    
    secretPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        this.vulnerabilities.push({
          type: 'hardcoded-secret',
          severity: 'critical',
          file: filePath,
          matches: matches.length,
          description: 'Potential hardcoded secret detected',
          recommendation: 'Move secrets to environment variables'
        });
      }
    });
  }

  getJavaScriptFiles(dir) {
    const files = [];
    const excludeDirs = ['node_modules', '.git', 'dist', 'build'];
    
    const scanDir = (currentDir) => {
      try {
        const items = fs.readdirSync(currentDir);
        
        items.forEach(item => {
          const fullPath = path.join(currentDir, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory() && !excludeDirs.includes(item)) {
            scanDir(fullPath);
          } else if (stat.isFile() && (item.endsWith('.js') || item.endsWith('.ts'))) {
            files.push(fullPath);
          }
        });
      } catch (error) {
        console.log(`⚠️  Could not scan directory ${currentDir}: ${error.message}`);
      }
    };
    
    scanDir(dir);
    return files;
  }

  async scanFileSystem() {
    console.log('📁 Scanning file system security...');
    
    const projectRoot = path.join(__dirname, '..');
    
    // Check for sensitive files
    const allFiles = this.getAllFiles(projectRoot);
    
    allFiles.forEach(filePath => {
      const filename = path.basename(filePath);
      
      this.securityRules.sensitiveFiles.forEach(pattern => {
        if (pattern.test(filename)) {
          // Check if file is in .gitignore
          const isIgnored = this.checkIfGitIgnored(filePath);
          
          if (!isIgnored) {
            this.vulnerabilities.push({
              type: 'sensitive-file',
              severity: 'medium',
              file: filePath,
              description: 'Sensitive file not in .gitignore',
              recommendation: 'Add to .gitignore or move to secure location'
            });
          }
        }
      });
    });
    
    console.log('✅ File system scan complete');
  }

  getAllFiles(dir) {
    const files = [];
    const excludeDirs = ['node_modules', '.git'];
    
    const scanDir = (currentDir) => {
      try {
        const items = fs.readdirSync(currentDir);
        
        items.forEach(item => {
          const fullPath = path.join(currentDir, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory() && !excludeDirs.includes(item)) {
            scanDir(fullPath);
          } else if (stat.isFile()) {
            files.push(fullPath);
          }
        });
      } catch (error) {
        // Ignore permission errors
      }
    };
    
    scanDir(dir);
    return files;
  }

  checkIfGitIgnored(filePath) {
    try {
      const gitignorePath = path.join(__dirname, '..', '.gitignore');
      if (fs.existsSync(gitignorePath)) {
        const gitignore = fs.readFileSync(gitignorePath, 'utf8');
        const relativePath = path.relative(path.join(__dirname, '..'), filePath);
        return gitignore.split('\n').some(line => {
          line = line.trim();
          return line && !line.startsWith('#') && relativePath.includes(line);
        });
      }
    } catch (error) {
      // Ignore errors
    }
    return false;
  }

  async scanEnvironment() {
    console.log('🌍 Scanning environment security...');
    
    // Check for dangerous environment variables
    const dangerousEnvVars = Object.keys(process.env).filter(key => 
      key.toLowerCase().includes('password') ||
      key.toLowerCase().includes('secret') ||
      key.toLowerCase().includes('token')
    );
    
    if (dangerousEnvVars.length > 0) {
      console.log(`⚠️  Found ${dangerousEnvVars.length} potentially sensitive environment variables`);
    }
    
    console.log('✅ Environment scan complete');
  }

  generateSecurityReport() {
    console.log('\n📋 SECURITY SCAN RESULTS');
    console.log('========================\n');
    
    if (this.vulnerabilities.length === 0) {
      console.log('✅ No critical security issues detected!');
      return;
    }
    
    const grouped = this.vulnerabilities.reduce((acc, vuln) => {
      const severity = vuln.severity;
      if (!acc[severity]) acc[severity] = [];
      acc[severity].push(vuln);
      return acc;
    }, {});
    
    Object.entries(grouped).forEach(([severity, vulns]) => {
      console.log(`\n🚨 ${severity.toUpperCase()} SEVERITY (${vulns.length} issues):`);
      vulns.forEach((vuln, index) => {
        console.log(`\n${index + 1}. Type: ${vuln.type}`);
        console.log(`   Description: ${vuln.description}`);
        if (vuln.file) console.log(`   File: ${vuln.file}`);
        if (vuln.package) console.log(`   Package: ${vuln.package}`);
        console.log(`   Recommendation: ${vuln.recommendation}`);
      });
    });
    
    console.log('\n========================');
    console.log(`Total issues: ${this.vulnerabilities.length}`);
    
    // Write detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.vulnerabilities.length,
        critical: grouped.critical?.length || 0,
        high: grouped.high?.length || 0,
        medium: grouped.medium?.length || 0
      },
      vulnerabilities: this.vulnerabilities
    };
    
    fs.writeFileSync(
      path.join(__dirname, '..', 'security-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n📄 Detailed report saved to security-report.json');
    
    // Exit with error if critical issues found
    if (grouped.critical?.length > 0) {
      console.error('\n🚨 CRITICAL SECURITY ISSUES DETECTED - Immediate action required!');
      process.exit(1);
    }
  }
}

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const scanner = new AutonomousSecurityScanner();
  scanner.runSecurityScan().catch(error => {
    console.error('❌ Security scanner failed:', error);
    process.exit(1);
  });
}

export default AutonomousSecurityScanner;