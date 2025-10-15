#!/bin/bash

# Autonomous Fly.io Deployment Script
# Complete end-to-end deployment with verification

set -e

echo "🚀 Starting Fly.io Deployment..."

# Check flyctl installation
if ! command -v flyctl &> /dev/null; then
    echo "❌ flyctl not installed. Installing..."
    curl -L https://fly.io/install.sh | sh
    export PATH="$HOME/.fly/bin:$PATH"
fi

# Login check
echo "🔐 Checking Fly.io authentication..."
if ! flyctl auth whoami &> /dev/null; then
    echo "❌ Not logged in to Fly.io. Please run: flyctl auth login"
    exit 1
fi

# Build verification
echo "🔧 Building application..."
npm run build

# Deploy with canary strategy
echo "🚢 Deploying to Fly.io (canary strategy)..."
flyctl deploy --strategy canary --wait-timeout 600

# Wait for deployment
echo "⏳ Waiting for deployment to stabilize..."
sleep 30

# Verify deployment
echo "✅ Verifying deployment..."
APP_URL="https://llm-framework-prod.fly.dev"

# Health check
if curl -f "$APP_URL/health" > /dev/null 2>&1; then
    echo "✅ Health check: PASSED"
else
    echo "❌ Health check: FAILED"
    exit 1
fi

# Status check
if curl -f "$APP_URL/api/status" > /dev/null 2>&1; then
    echo "✅ Status endpoint: OPERATIONAL"
else
    echo "❌ Status endpoint: FAILED"
    exit 1
fi

# Metrics check
if curl -f "$APP_URL/metrics" > /dev/null 2>&1; then
    echo "✅ Metrics endpoint: OPERATIONAL"
else
    echo "❌ Metrics endpoint: FAILED"
    exit 1
fi

echo "\n🎉 DEPLOYMENT SUCCESSFUL!"
echo "🌐 Application URL: $APP_URL"
echo "📊 Dashboard: $APP_URL:8081 (internal)"
echo "🔧 MCP Server: $APP_URL:3001 (internal)"
echo "📈 Metrics: $APP_URL/metrics"
echo "💚 Health: $APP_URL/health"

echo "\n✅ Fly.io deployment completed successfully!"