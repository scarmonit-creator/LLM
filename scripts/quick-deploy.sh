#!/bin/bash

# Quick Deployment Script for AI Bridge
# Deploys to multiple platforms simultaneously

set -e

echo "🚀 AI BRIDGE QUICK DEPLOYMENT"
echo "=============================="
echo

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "src/ai-bridge.js" ]; then
    print_error "Not in LLM repository root. Please run from repository root."
    exit 1
fi

print_success "Repository structure validated"

# Function to deploy to Fly.io
deploy_fly() {
    print_status "Deploying to Fly.io..."
    
    if command -v fly >/dev/null 2>&1; then
        if [ -f "fly.toml" ]; then
            print_status "Using existing fly.toml configuration"
            fly deploy
            if [ $? -eq 0 ]; then
                print_success "✅ Fly.io deployment successful"
                echo "   URL: https://llm-ai-bridge.fly.dev"
                echo "   Health: https://llm-ai-bridge.fly.dev/health"
                return 0
            else
                print_error "❌ Fly.io deployment failed"
                return 1
            fi
        else
            print_warning "fly.toml not found, skipping Fly.io"
            return 1
        fi
    else
        print_warning "flyctl not installed, skipping Fly.io"
        print_status "Install with: curl -L https://fly.io/install.sh | sh"
        return 1
    fi
}

# Function to deploy to Railway
deploy_railway() {
    print_status "Deploying to Railway..."
    
    if command -v railway >/dev/null 2>&1; then
        if [ -f "railway.json" ]; then
            print_status "Using railway.json configuration"
            railway up
            if [ $? -eq 0 ]; then
                print_success "✅ Railway deployment successful"
                echo "   Check Railway dashboard for URL"
                return 0
            else
                print_error "❌ Railway deployment failed"
                return 1
            fi
        else
            print_warning "railway.json not found, skipping Railway"
            return 1
        fi
    else
        print_warning "railway CLI not installed, skipping Railway"
        print_status "Install with: npm install -g @railway/cli"
        return 1
    fi
}

# Function to build and test Docker
test_docker() {
    print_status "Testing Docker build..."
    
    if command -v docker >/dev/null 2>&1; then
        if [ -f "Dockerfile" ]; then
            print_status "Building Docker image..."
            docker build -t llm-ai-bridge:test . --quiet
            if [ $? -eq 0 ]; then
                print_success "✅ Docker build successful"
                
                # Test container startup
                print_status "Testing container startup..."
                CONTAINER_ID=$(docker run -d -p 8080:8080 llm-ai-bridge:test)
                sleep 3
                
                # Test health endpoint
                if curl -s --max-time 5 http://localhost:8080/health >/dev/null 2>&1; then
                    print_success "✅ Docker container healthy"
                    docker stop $CONTAINER_ID >/dev/null
                    docker rm $CONTAINER_ID >/dev/null
                    return 0
                else
                    print_warning "⚠️  Docker container started but health check failed"
                    docker stop $CONTAINER_ID >/dev/null
                    docker rm $CONTAINER_ID >/dev/null
                    return 1
                fi
            else
                print_error "❌ Docker build failed"
                return 1
            fi
        else
            print_warning "Dockerfile not found, skipping Docker test"
            return 1
        fi
    else
        print_warning "Docker not installed, skipping Docker test"
        return 1
    fi
}

# Main deployment sequence
echo "🎯 Starting deployment sequence..."
echo

SUCCESS_COUNT=0
TOTAL_ATTEMPTS=0

# Try Fly.io deployment
if deploy_fly; then
    ((SUCCESS_COUNT++))
fi
((TOTAL_ATTEMPTS++))

echo

# Try Railway deployment
if deploy_railway; then
    ((SUCCESS_COUNT++))
fi
((TOTAL_ATTEMPTS++))

echo

# Test Docker build
if test_docker; then
    ((SUCCESS_COUNT++))
fi
((TOTAL_ATTEMPTS++))

echo
echo "📊 DEPLOYMENT SUMMARY"
echo "===================="
echo "   Successful: $SUCCESS_COUNT/$TOTAL_ATTEMPTS"
echo "   Success rate: $(( SUCCESS_COUNT * 100 / TOTAL_ATTEMPTS ))%"
echo

if [ $SUCCESS_COUNT -gt 0 ]; then
    print_success "🎉 At least one deployment method successful!"
    echo
    print_status "Verify deployments with:"
    echo "   node scripts/deploy-verify.js"
    echo "   node scripts/deploy-verify.js https://your-custom-url.com"
    echo
    print_status "Next steps:"
    echo "   1. Load browser extension from extensions/selected-text-analyzer/"
    echo "   2. Test text analysis functionality"
    echo "   3. Monitor /api/status endpoints"
    exit 0
else
    print_error "❌ No deployments successful"
    echo
    print_status "Manual deployment options:"
    echo "   1. Render.com: Connect GitHub repo with render.yaml"
    echo "   2. Google Cloud Run: gcloud run deploy --source ."
    echo "   3. Any Docker host: docker build + docker run"
    exit 1
fi