#!/usr/bin/env node

/**
 * AUTONOMOUS ASSET OPTIMIZER
 * Ultra-Performance Asset Optimization Pipeline
 * Real-time compression and optimization
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class AutonomousAssetOptimizer {
  constructor() {
    this.optimizationStats = {
      filesProcessed: 0,
      totalSizeBefore: 0,
      totalSizeAfter: 0,
      compressionRatio: 0,
      processingTime: 0
    };
    
    this.optimizers = {
      js: this.optimizeJavaScript.bind(this),
      css: this.optimizeCSS.bind(this),
      json: this.optimizeJSON.bind(this),
      html: this.optimizeHTML.bind(this),
      md: this.optimizeMarkdown.bind(this)
    };
  }

  async runOptimization() {
    console.log('🎯 Autonomous Asset Optimizer Starting...');
    console.log('⚡ Performing ultra-performance asset optimization...');
    
    const startTime = performance.now();
    
    try {
      const projectRoot = path.join(__dirname, '..');
      
      // Find all optimizable files
      const files = this.findOptimizableFiles(projectRoot);
      console.log(`📁 Found ${files.length} files to optimize`);
      
      // Process files by type
      for (const file of files) {
        await this.optimizeFile(file);
      }
      
      // Generate optimization report
      this.optimizationStats.processingTime = performance.now() - startTime;
      this.generateOptimizationReport();
      
    } catch (error) {
      console.error('❌ Asset optimization failed:', error.message);
      process.exit(1);
    }
  }

  findOptimizableFiles(dir) {
    const files = [];
    const extensions = ['.js', '.css', '.json', '.html', '.md'];
    const excludeDirs = ['node_modules', '.git', 'dist', 'build'];
    
    const scanDir = (currentDir) => {
      try {
        const items = fs.readdirSync(currentDir);
        
        items.forEach(item => {
          const fullPath = path.join(currentDir, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory() && !excludeDirs.includes(item)) {
            scanDir(fullPath);
          } else if (stat.isFile()) {
            const ext = path.extname(item);
            if (extensions.includes(ext)) {
              files.push({
                path: fullPath,
                type: ext.slice(1), // Remove dot
                size: stat.size,
                name: item
              });
            }
          }
        });
      } catch (error) {
        console.log(`⚠️  Could not scan directory ${currentDir}: ${error.message}`);
      }
    };
    
    scanDir(dir);
    return files;
  }

  async optimizeFile(fileInfo) {
    try {
      const content = fs.readFileSync(fileInfo.path, 'utf8');
      const optimizer = this.optimizers[fileInfo.type];
      
      if (optimizer) {
        const optimized = optimizer(content, fileInfo);
        
        if (optimized !== content) {
          // Create backup if significant optimization
          const sizeDiff = content.length - optimized.length;
          if (sizeDiff > content.length * 0.1) { // 10% or more reduction
            const backupPath = fileInfo.path + '.backup';
            if (!fs.existsSync(backupPath)) {
              fs.writeFileSync(backupPath, content);
            }
          }
          
          // Write optimized version
          fs.writeFileSync(fileInfo.path, optimized);
          
          // Update statistics
          this.optimizationStats.filesProcessed++;
          this.optimizationStats.totalSizeBefore += content.length;
          this.optimizationStats.totalSizeAfter += optimized.length;
          
          const reduction = ((content.length - optimized.length) / content.length * 100).toFixed(1);
          console.log(`✅ ${fileInfo.name}: ${this.formatBytes(content.length)} → ${this.formatBytes(optimized.length)} (${reduction}% reduction)`);
        }
      }
    } catch (error) {
      console.log(`⚠️  Could not optimize ${fileInfo.path}: ${error.message}`);
    }
  }

  optimizeJavaScript(content, fileInfo) {
    // Skip already minified files
    if (fileInfo.name.includes('.min.') || fileInfo.name.includes('-min.')) {
      return content;
    }
    
    let optimized = content;
    
    // Remove comments (preserve license comments)
    optimized = optimized.replace(/\/\*[\s\S]*?\*\//g, (match) => {
      if (match.toLowerCase().includes('license') || 
          match.toLowerCase().includes('copyright') ||
          match.includes('@license') ||
          match.includes('@copyright')) {
        return match;
      }
      return '';
    });
    
    // Remove single-line comments (preserve shebangs and licenses)
    optimized = optimized.replace(/\/\/.*$/gm, (match) => {
      if (match.includes('#!') || 
          match.toLowerCase().includes('license') ||
          match.toLowerCase().includes('copyright')) {
        return match;
      }
      return '';
    });
    
    // Optimize whitespace
    optimized = optimized
      .replace(/\s{2,}/g, ' ')        // Multiple spaces to single
      .replace(/\n\s*\n/g, '\n')      // Multiple newlines to single
      .replace(/;\s*}/g, '}')        // Remove semicolon before closing brace
      .replace(/\s*{\s*/g, '{')       // Remove spaces around opening brace
      .replace(/}\s*/g, '}')         // Remove spaces after closing brace
      .trim();
    
    return optimized;
  }

  optimizeCSS(content, fileInfo) {
    // Skip already minified files
    if (fileInfo.name.includes('.min.') || fileInfo.name.includes('-min.')) {
      return content;
    }
    
    let optimized = content;
    
    // Remove comments (preserve license comments)
    optimized = optimized.replace(/\/\*[\s\S]*?\*\//g, (match) => {
      if (match.toLowerCase().includes('license') || 
          match.toLowerCase().includes('copyright')) {
        return match;
      }
      return '';
    });
    
    // Optimize whitespace and formatting
    optimized = optimized
      .replace(/\s{2,}/g, ' ')         // Multiple spaces to single
      .replace(/\n\s*\n/g, '\n')       // Multiple newlines to single
      .replace(/;\s*}/g, '}')         // Remove semicolon before closing brace
      .replace(/\s*{\s*/g, '{')        // Remove spaces around opening brace
      .replace(/}\s*/g, '}')          // Remove spaces after closing brace
      .replace(/;\s*(?=\w)/g, ';')    // Remove spaces after semicolons
      .replace(/:\s*/g, ':')          // Remove spaces after colons
      .replace(/,\s*/g, ',')          // Remove spaces after commas
      .trim();
    
    // Optimize colors
    optimized = optimized
      .replace(/#([0-9a-fA-F])\1([0-9a-fA-F])\2([0-9a-fA-F])\3/g, '#$1$2$3') // #aabbcc → #abc
      .replace(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g, 'rgb($1,$2,$3)'); // Optimize rgb()
    
    return optimized;
  }

  optimizeJSON(content, fileInfo) {
    try {
      // Parse and re-stringify to normalize formatting
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed);
    } catch (error) {
      console.log(`⚠️  Invalid JSON in ${fileInfo.name}: ${error.message}`);
      return content;
    }
  }

  optimizeHTML(content, fileInfo) {
    let optimized = content;
    
    // Remove comments (preserve conditional comments)
    optimized = optimized.replace(/<!--[\s\S]*?-->/g, (match) => {
      if (match.includes('[if') || match.includes('[endif')) {
        return match; // Keep conditional comments
      }
      return '';
    });
    
    // Optimize whitespace
    optimized = optimized
      .replace(/\s{2,}/g, ' ')          // Multiple spaces to single
      .replace(/\n\s*\n/g, '\n')        // Multiple newlines to single
      .replace(/>\s+</g, '><')         // Remove whitespace between tags
      .replace(/\s*=\s*/g, '=')        // Remove spaces around equals
      .trim();
    
    return optimized;
  }

  optimizeMarkdown(content, fileInfo) {
    // Light optimization for markdown - preserve formatting but reduce whitespace
    let optimized = content;
    
    // Remove excessive blank lines (keep double newlines for paragraphs)
    optimized = optimized
      .replace(/\n{3,}/g, '\n\n')       // Max 2 consecutive newlines
      .replace(/[ \t]{2,}/g, ' ')      // Multiple spaces to single (except code blocks)
      .trim();
    
    return optimized;
  }

  generateOptimizationReport() {
    console.log('\n🎯 ASSET OPTIMIZATION RESULTS');
    console.log('==============================\n');
    
    const { filesProcessed, totalSizeBefore, totalSizeAfter, processingTime } = this.optimizationStats;
    
    if (filesProcessed === 0) {
      console.log('✅ No files required optimization!');
      return;
    }
    
    const compressionRatio = ((totalSizeBefore - totalSizeAfter) / totalSizeBefore * 100).toFixed(1);
    const spaceSaved = totalSizeBefore - totalSizeAfter;
    
    console.log(`📊 Files Processed: ${filesProcessed}`);
    console.log(`📦 Size Before: ${this.formatBytes(totalSizeBefore)}`);
    console.log(`📦 Size After: ${this.formatBytes(totalSizeAfter)}`);
    console.log(`💾 Space Saved: ${this.formatBytes(spaceSaved)} (${compressionRatio}%)`);
    console.log(`⏱️  Processing Time: ${processingTime.toFixed(2)}ms`);
    
    // Performance metrics
    const throughput = (totalSizeBefore / 1024 / 1024) / (processingTime / 1000); // MB/s
    console.log(`⚡ Throughput: ${throughput.toFixed(2)} MB/s`);
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        filesProcessed,
        sizeBefore: this.formatBytes(totalSizeBefore),
        sizeAfter: this.formatBytes(totalSizeAfter),
        spaceSaved: this.formatBytes(spaceSaved),
        compressionRatio: compressionRatio + '%',
        processingTime: processingTime.toFixed(2) + 'ms',
        throughput: throughput.toFixed(2) + ' MB/s'
      },
      performance: {
        compressionRatio: parseFloat(compressionRatio),
        processingSpeed: throughput,
        efficiency: filesProcessed / (processingTime / 1000)
      }
    };
    
    fs.writeFileSync(
      path.join(__dirname, '..', 'asset-optimization-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n📄 Detailed report saved to asset-optimization-report.json');
    
    // Performance assessment
    if (compressionRatio > 20) {
      console.log('\n🏆 EXCELLENT optimization results achieved!');
    } else if (compressionRatio > 10) {
      console.log('\n✅ GOOD optimization results achieved!');
    } else if (compressionRatio > 5) {
      console.log('\n👍 DECENT optimization results achieved!');
    } else {
      console.log('\n📊 Minimal optimization opportunities found - assets already well-optimized!');
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const optimizer = new AutonomousAssetOptimizer();
  optimizer.runOptimization().catch(error => {
    console.error('❌ Asset optimization failed:', error);
    process.exit(1);
  });
}

export default AutonomousAssetOptimizer;