#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function minifyHtml(content) {
  return content
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/\n+/g, '')
    .trim();
}

function minifyCss(content) {
  return content
    .replace(/\s+/g, ' ')
    .replace(/\/\*.*?\*\//g, '')
    .replace(/;\s*}/g, '}')
    .replace(/\s*{\s*/g, '{')
    .replace(/;\s*/g, ';')
    .trim();
}

function minifyJs(content) {
  return content
    .replace(/\s+/g, ' ')
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*.*?\*\//g, '')
    .trim();
}

function copyAndMinify(src, dest) {
  const stat = fs.statSync(src);
  
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const files = fs.readdirSync(src);
    for (const file of files) {
      if (file !== 'dist' && file !== 'node_modules') {
        copyAndMinify(path.join(src, file), path.join(dest, file));
      }
    }
  } else {
    let content = fs.readFileSync(src, 'utf8');
    
    if (src.endsWith('.html')) {
      content = minifyHtml(content);
    } else if (src.endsWith('.css')) {
      content = minifyCss(content);
    } else if (src.endsWith('.js')) {
      content = minifyJs(content);
    }
    
    fs.writeFileSync(dest, content);
  }
}

function buildWebsite() {
  const srcDir = 'website';
  const destDir = 'website/dist';
  
  // Clean destination
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  
  // Create destination directory
  fs.mkdirSync(destDir, { recursive: true });
  
  // Copy and minify all files
  copyAndMinify(srcDir, destDir);
  
  console.log(`✅ Website built successfully to ${destDir}`);
  console.log('📦 Files minified: HTML, CSS, JS');
  console.log('🚀 Ready for deployment');
}

// Run if called directly
if (require.main === module) {
  buildWebsite();
}

module.exports = { buildWebsite };