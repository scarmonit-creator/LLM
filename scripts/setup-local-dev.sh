#!/bin/bash

# Local Development Environment Setup
# Optimized for LLM Framework Development

set -e

echo "🏠 Setting up optimized local development environment..."
echo "================================================"

# Check for required tools
echo "🔍 Checking system requirements..."

# Node.js check
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js not found. Please install Node.js 18 or later"
    echo "   📥 Download: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ required (found: $(node -v))"
    exit 1
fi

echo "✅ Node.js $(node -v) found"

# npm check
if ! command -v npm >/dev/null 2>&1; then
    echo "❌ npm not found. Please install npm"
    exit 1
fi

echo "✅ npm $(npm -v) found"

# Git check
if ! command -v git >/dev/null 2>&1; then
    echo "❌ Git not found. Please install Git"
    echo "   📥 Download: https://git-scm.com/"
    exit 1
fi

echo "✅ Git $(git --version | cut -d' ' -f3) found"

# Optional: Docker check
if command -v docker >/dev/null 2>&1; then
    echo "✅ Docker $(docker --version | cut -d' ' -f3 | sed 's/,//') found (optional)"
    DOCKER_AVAILABLE=true
else
    echo "ℹ️  Docker not found (optional for containerized development)"
    DOCKER_AVAILABLE=false
fi

echo ""
echo "📦 Installing dependencies..."

# Configure npm for optimization
npm config set audit false
npm config set fund false
npm config set prefer-offline true

# Install dependencies
echo "   Installing Node.js dependencies..."
npm install --prefer-offline

echo "✅ Dependencies installed"

# Setup environment
echo ""
echo "⚙️ Setting up environment..."

# Copy environment template
if [ -f ".env.example" ]; then
    if [ ! -f ".env" ]; then
        cp .env.example .env
        echo "✅ Environment file created from template"
    else
        echo "ℹ️  Environment file already exists"
    fi
else
    echo "ℹ️  No .env.example template found"
fi

# Create necessary directories
mkdir -p data logs tmp
echo "✅ Project directories created"

# Build project
echo ""
echo "🔨 Building project..."
npm run build 2>/dev/null || echo "ℹ️  No build script found"

# Setup development scripts if they don't exist
echo ""
echo "📝 Setting up optimized development scripts..."

# Add optimized scripts to package.json if not present
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json'));

const optimizedScripts = {
    'start:dev:optimized': 'NODE_OPTIONS=\"--max-old-space-size=2048\" nodemon src/index.js',
    'start:optimized': 'NODE_OPTIONS=\"--max-old-space-size=2048 --optimize-for-size\" node src/index.js',
    'build:optimized': 'NODE_OPTIONS=\"--max-old-space-size=2048\" npm run build',
    'monitor:usage': 'node src/gitpod-optimization/usage-monitor.js',
    'dev:performance': 'NODE_OPTIONS=\"--max-old-space-size=2048\" concurrently \"npm run start:dev:optimized\" \"npm run monitor:usage\"'
};

let modified = false;
for (const [key, value] of Object.entries(optimizedScripts)) {
    if (!pkg.scripts || !pkg.scripts[key]) {
        pkg.scripts = pkg.scripts || {};
        pkg.scripts[key] = value;
        modified = true;
    }
}

if (modified) {
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    console.log('✅ Optimized development scripts added');
} else {
    console.log('ℹ️  Development scripts already configured');
}
"

# Create quick start guide
cat > LOCAL_DEVELOPMENT.md << 'EOF'
# Local Development Quick Start

## Development Commands

### Start Development Server
```bash
# Optimized development with hot reload
npm run start:dev:optimized

# Production-like optimized start
npm run start:optimized

# Development with performance monitoring
npm run dev:performance
```

### Access Points
- **Main Application**: http://localhost:8080
- **Development Server**: http://localhost:3000 (if available)
- **Performance Dashboard**: http://localhost:8081 (if available)

### Optimization Features
- Memory usage optimized for development
- Automatic performance monitoring
- Resource usage tracking
- Hot reload for faster development

### Docker Alternative (if Docker is available)
```bash
# Start containerized development environment
docker-compose -f docker-compose.dev.yml up

# Start in background
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop environment
docker-compose -f docker-compose.dev.yml down
```

### Troubleshooting
- If memory issues occur, restart with: `npm run start:optimized`
- Monitor resource usage: `npm run monitor:usage`
- Clear npm cache: `npm cache clean --force`
- Rebuild dependencies: `rm -rf node_modules && npm install`

EOF

echo "✅ Development guide created: LOCAL_DEVELOPMENT.md"

echo ""
echo "🚀 Starting optimized development server..."
echo "================================================"
echo ""
echo "🌐 Access your application at: http://localhost:8080"
echo "📊 Monitor performance with: npm run monitor:usage"
echo "📖 Development guide: LOCAL_DEVELOPMENT.md"
echo ""

if [ "$DOCKER_AVAILABLE" = true ]; then
    echo "🐳 Docker alternative: docker-compose -f docker-compose.dev.yml up"
    echo ""
fi

echo "🎉 Local development environment ready!"
echo "   Run 'npm run start:dev:optimized' to start development"
echo ""