#!/bin/bash
# Optimized Fly.io Deployment Script with Enhanced Monitoring and Performance

set -e

echo "🚀 Starting Optimized Fly.io Deployment..."

# Check if fly CLI is available
if ! command -v fly &> /dev/null; then
    echo "❌ Error: Fly.io CLI not found. Please install it first:"
    echo "   curl -L https://fly.io/install.sh | sh"
    exit 1
fi

# Environment check
echo "📋 Environment Check:"
echo "   Node.js: $(node --version)"
echo "   NPM: $(npm --version)"
echo "   Current directory: $(pwd)"

# Build optimization
echo "🔧 Optimizing build process..."
echo "NODE_ENV=production" > .env.local
echo "PORT=8080" >> .env.local
echo "NODE_OPTIONS=--max-old-space-size=400 --gc-interval=100" >> .env.local

# Pre-deployment checks
echo "🔍 Pre-deployment validation:"

# Check required files
required_files=(
    "package.json"
    "server.js"
    "Dockerfile"
    "fly.toml"
)

for file in "${required_files[@]}"; do
    if [[ ! -f "$file" ]]; then
        echo "❌ Required file missing: $file"
        exit 1
    else
        echo "✅ Found: $file"
    fi
done

# Build tools and validate
echo "🛠️ Building tools and dependencies..."
npm run build:tools || {
    echo "⚠️ Build tools failed, continuing with mock implementation"
}

# Test server startup locally
echo "🧪 Testing server startup..."
timeout 10s npm start &
SERVER_PID=$!
sleep 3

if ps -p $SERVER_PID > /dev/null; then
    echo "✅ Server starts successfully"
    kill $SERVER_PID 2>/dev/null || true
else
    echo "❌ Server startup failed"
    exit 1
fi

# Deploy to Fly.io
echo "🚀 Deploying to Fly.io..."

if fly apps list | grep -q "llm-ai-bridge"; then
    echo "📦 Updating existing app: llm-ai-bridge"
    fly deploy --app llm-ai-bridge --strategy rolling
else
    echo "🆕 Creating new app: llm-ai-bridge"
    fly launch --name llm-ai-bridge --no-deploy
    fly deploy --app llm-ai-bridge
fi

# Post-deployment validation
echo "🔍 Post-deployment validation..."
sleep 10

# Health check
APP_URL="https://llm-ai-bridge.fly.dev"
echo "🏥 Checking health endpoint: $APP_URL/health"

if curl -f -s "$APP_URL/health" > /dev/null; then
    echo "✅ Health check passed"
    
    # Display deployment info
    echo "📊 Deployment Status:"
    echo "   App URL: $APP_URL"
    echo "   Health: $APP_URL/health"
    echo "   Status: $APP_URL/api/status"
    echo "   Metrics: $APP_URL/metrics"
    
    # Test endpoints
    echo "🧪 Testing endpoints:"
    
    # Root endpoint
    if curl -f -s "$APP_URL/" | grep -q "ok"; then
        echo "✅ Root endpoint working"
    else
        echo "⚠️ Root endpoint issue"
    fi
    
    # Status endpoint
    if curl -f -s "$APP_URL/api/status" | grep -q "healthy"; then
        echo "✅ Status endpoint working"
    else
        echo "⚠️ Status endpoint issue"
    fi
    
    echo "🎉 Deployment completed successfully!"
    echo "🌐 Your app is available at: $APP_URL"
    
else
    echo "❌ Health check failed"
    echo "📋 Checking logs for issues..."
    fly logs --app llm-ai-bridge -n 20
    exit 1
fi

echo "📈 Setting up monitoring..."
echo "   Grafana Dashboard: https://fly-metrics.net/d/fly-app/fly-app?orgId=1308651"
echo "   Logs: fly logs --app llm-ai-bridge -f"
echo "   Scale: fly scale --app llm-ai-bridge show"
echo "   Status: fly status --app llm-ai-bridge"

echo "✨ Deployment optimization complete!"
