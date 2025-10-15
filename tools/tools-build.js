// Build automation for TypeScript tools in tools/
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Sanitize environment inputs and validate paths
function sanitizePath(inputPath) {
  // Resolve to absolute path and normalize
  const resolved = path.resolve(inputPath);
  
  // Ensure path doesn't contain shell metacharacters
  if (/[;&|`$()\\<>"']/.test(inputPath)) {
    throw new Error('Invalid characters in path');
  }
  
  return resolved;
}

const TOOLS_DIR = sanitizePath(path.join(__dirname, 'tools'));
const DIST_DIR = sanitizePath(path.join(__dirname, 'dist', 'tools'));
const TSC_PATH = sanitizePath(path.join(__dirname, 'node_modules', '.bin', 'tsc'));

function ensureCompiled() {
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  const files = fs.readdirSync(TOOLS_DIR).filter(f => f.endsWith('.ts'));

  files.forEach(tsFile => {
    const outPath = path.join(DIST_DIR, tsFile.replace(/\.ts$/, '.js'));
    const srcPath = sanitizePath(path.join(TOOLS_DIR, tsFile));

    if (!fs.existsSync(outPath) || fs.statSync(srcPath).mtimeMs > fs.statSync(outPath).mtimeMs) {
      console.log(`Compiling ${tsFile} ...`);
      
      // Use parameterized command with execFileSync for security
      // This prevents shell injection by not using a shell
      try {
        execFileSync(TSC_PATH, [
          srcPath,
          '--outDir',
          DIST_DIR,
          '--module',
          'commonjs'
        ], { 
          stdio: 'inherit',
          windowsVerbatimArguments: true // Prevents command line injection on Windows
        });
      } catch (error) {
        console.error(`Failed to compile ${tsFile}:`, error.message);
        throw error;
      }
    }
  });
}

if (require.main === module) {
  ensureCompiled();
  console.log('✅ TypeScript tools build complete: dist/tools/');
}

module.exports = { ensureCompiled };
