# Build Instructions & Troubleshooting

## Quick Start

### Fix TypeScript Build Issues

If you encounter TypeScript compilation errors or missing files:

```bash
# Quick fix for all build issues
npm run build:force

# Or step by step:
npm run clean
npm run build:fix
npm run build
```

### Start the Server

```bash
# Start with automatic build
npm start

# Or manually
npm run build
node server.js
```

## Build Process Explanation

### 1. TypeScript Compilation

The project uses TypeScript for the `tools/` directory. All `.ts` files need to be compiled to `.js` files in the `dist/` directory.

```bash
# Compile TypeScript
npx tsc

# Or use npm script
npm run build
```

### 2. Tool Building

The `tools/` directory contains TypeScript modules that need compilation:

- `browser-history.ts` → `dist/tools/browser-history.js`
- `types.ts` → `dist/tools/types.js`
- `index.ts` → `dist/tools/index.js`
- Plus all other tool modules

```bash
# Build tools specifically
npm run build:tools
```

### 3. Build Scripts

| Script | Purpose |
|--------|--------|
| `npm run build` | Full TypeScript build |
| `npm run build:tools` | Build tools only |
| `npm run build:fix` | Fix build issues automatically |
| `npm run build:force` | Clean + fix + build (nuclear option) |
| `npm run clean` | Remove all build artifacts |

## Common Issues & Solutions

### Issue: "Cannot find module './dist/tools/browser-history.js'"

**Cause:** TypeScript files haven't been compiled to JavaScript.

**Solution:**
```bash
npm run build:fix
# or
npm run build:force
```

### Issue: "Module not found" errors for tool imports

**Cause:** Missing compiled files in `dist/tools/`.

**Solution:**
```bash
# Check what's missing
ls dist/tools/

# Fix missing files
npm run build:fix
```

### Issue: TypeScript compilation errors

**Cause:** Type errors or configuration issues.

**Solution:**
```bash
# Check types without compiling
npm run typecheck

# Fix and force rebuild
npm run build:force
```

### Issue: "better-sqlite3" not found

**Cause:** Optional dependency not installed.

**Solution:**
The browser-history tool will work with mock data. To use real browser history:

```bash
npm install better-sqlite3
npm run build:force
```

## Directory Structure

```
LLM/
├── tools/                  # TypeScript source files
│   ├── browser-history.ts
│   ├── types.ts
│   ├── index.ts
│   └── ...
├── dist/                   # Compiled JavaScript files
│   └── tools/
│       ├── browser-history.js
│       ├── types.js
│       ├── index.js
│       └── ...
├── scripts/
│   ├── build-tools.js     # Original build script
│   └── fix-build.js       # Enhanced build fixer
└── server.js              # Main server (imports from dist/)
```

## Development Workflow

### 1. Making Changes to Tools

```bash
# Edit TypeScript files in tools/
vim tools/browser-history.ts

# Rebuild
npm run build:tools

# Test
npm start
```

### 2. Adding New Tools

1. Create `tools/my-tool.ts`
2. Add export to `tools/index.ts`
3. Run `npm run build`
4. Import in your application

### 3. Continuous Development

```bash
# Watch mode for TypeScript
npm run typecheck:watch

# In another terminal
npm run dev:server
```

## Production Deployment

```bash
# Clean build for production
npm run clean
npm run build:force
npm run verify:all

# Start production server
NODE_ENV=production npm start
```

## Debugging Build Issues

### Check Build Status

```bash
# Check if dist directory exists
ls -la dist/

# Check compiled tools
ls -la dist/tools/

# Check TypeScript config
cat tsconfig.json
```

### Manual Build Steps

If automated build fails:

```bash
# 1. Ensure directories exist
mkdir -p dist/tools

# 2. Run TypeScript compiler
npx tsc

# 3. Check for errors
echo $?

# 4. Verify output
ls dist/tools/
```

### Environment Variables

```bash
# Increase memory for large projects
export NODE_OPTIONS="--max-old-space-size=4096"

# Enable TypeScript debugging
export TS_NODE_DEBUG=1
```

## Tool-Specific Notes

### Browser History Tool

- Requires compilation due to TypeScript interfaces
- Falls back to mock data if SQLite unavailable
- Cross-platform support (Windows, macOS, Linux)

### Performance Optimizer

- Real-time metrics collection
- Memory usage monitoring
- Function execution timing

### Error Handler

- Centralized error logging
- Error statistics and reporting
- Context-aware error handling

## Support

If build issues persist:

1. Check Node.js version: `node --version` (requires >=18.0.0)
2. Check npm version: `npm --version` (requires >=8.0.0)
3. Clear npm cache: `npm cache clean --force`
4. Delete node_modules: `rm -rf node_modules && npm install`
5. Run: `npm run build:force`

For additional help, check the server logs when running `npm start`.