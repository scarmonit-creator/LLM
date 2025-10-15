// Build automation for TypeScript tools in tools/
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TOOLS_DIR = path.join(__dirname, 'tools');
const DIST_DIR = path.join(__dirname, 'dist', 'tools');
const TSC_PATH = path.join(__dirname, 'node_modules', '.bin', 'tsc');

function ensureCompiled() {
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }
  const files = fs.readdirSync(TOOLS_DIR).filter(f => f.endsWith('.ts'));
  files.forEach(tsFile => {
    const outPath = path.join(DIST_DIR, tsFile.replace(/\.ts$/, '.js'));
    const srcPath = path.join(TOOLS_DIR, tsFile);
    if (!fs.existsSync(outPath) || fs.statSync(srcPath).mtimeMs > fs.statSync(outPath).mtimeMs) {
      console.log(`Compiling ${tsFile} ...`);
      execSync(`${TSC_PATH} ${srcPath} --outDir ${DIST_DIR} --module commonjs`, { stdio: 'inherit' });
    }
  });
}

if (require.main === module) {
  ensureCompiled();
  console.log('✅ TypeScript tools build complete: dist/tools/');
}

module.exports = { ensureCompiled };