#!/bin/bash

# Free Server Deployment Script
# Supports multiple free hosting platforms

set -e

PLATFORM=${1:-"render"}
APP_NAME=${2:-"llm-ai-bridge"}

echo "🚀 Starting deployment to $PLATFORM..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required files exist
check_requirements() {
    print_status "Checking requirements..."
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found!"
        exit 1
    fi
    
    if [ ! -f "src/ai-bridge.js" ]; then
        print_error "src/ai-bridge.js not found!"
        exit 1
    fi
    
    print_success "All requirements satisfied"
}

# Deploy to Render.com
deploy_render() {
    print_status "Deploying to Render.com..."
    
    if [ ! -f "render.yaml" ]; then
        print_error "render.yaml not found! Creating default configuration..."
        # render.yaml should already exist from previous step
        exit 1
    fi
    
    print_success "Render configuration found"
    print_status "To complete deployment:"
    echo "1. Push this branch to GitHub"
    echo "2. Go to https://dashboard.render.com/"
    echo "3. Connect your GitHub repository"
    echo "4. Render will auto-deploy using render.yaml"
    echo "5. Your app will be available at: https://${APP_NAME}.onrender.com"
    echo "6. Health check: https://${APP_NAME}.onrender.com/health"
}

# Deploy to Railway
deploy_railway() {
    print_status "Deploying to Railway..."
    
    # Create railway.json if it doesn't exist
    if [ ! -f "railway.json" ]; then
        print_status "Creating railway.json..."
        cat > railway.json << EOF
{
  "\$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
EOF
        git add railway.json
        git commit -m "Add Railway deployment configuration"
    fi
    
    print_success "Railway configuration ready"
    print_status "To complete deployment:"
    echo "1. Install Railway CLI: npm install -g @railway/cli"
    echo "2. Login: railway login"
    echo "3. Deploy: railway up"
    echo "4. Your app will be available at the provided Railway URL"
}

# Deploy to Fly.io
deploy_fly() {
    print_status "Deploying to Fly.io..."
    
    # Create fly.toml if it doesn't exist
    if [ ! -f "fly.toml" ]; then
        print_status "Creating fly.toml..."
        cat > fly.toml << EOF
app = "${APP_NAME}"
primary_region = "sjc"

[build]
  builder = "heroku/buildpacks:20"

[env]
  NODE_ENV = "production"
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
  
  [http_service.checks]
    grace_period = "10s"
    interval = "30s"
    method = "GET"
    path = "/health"
    timeout = "5s"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
EOF
        git add fly.toml
        git commit -m "Add Fly.io deployment configuration"
    fi
    
    print_success "Fly.io configuration ready"
    print_status "To complete deployment:"
    echo "1. Install Fly CLI: https://fly.io/docs/getting-started/installing-flyctl/"
    echo "2. Login: fly auth login"
    echo "3. Deploy: fly deploy"
    echo "4. Your app will be available at: https://${APP_NAME}.fly.dev"
}

# Deploy to Koyeb
deploy_koyeb() {
    print_status "Deploying to Koyeb..."
    
    # Create .koyeb/config.yaml if it doesn't exist
    if [ ! -d ".koyeb" ]; then
        mkdir -p .koyeb
    fi
    
    if [ ! -f ".koyeb/config.yaml" ]; then
        print_status "Creating Koyeb configuration..."
        cat > .koyeb/config.yaml << EOF
version: "1"
name: ${APP_NAME}
runtime: nodejs18
build:
  commands:
    - npm install
run:
  command: npm start
ports:
  - port: 8080
    protocol: http
    public: true
health_check:
  http:
    path: "/health"
    port: 8080
resources:
  cpu: "0.1"
  memory: "128Mi"
EOF
        git add .koyeb/
        git commit -m "Add Koyeb deployment configuration"
    fi
    
    print_success "Koyeb configuration ready"
    print_status "To complete deployment:"
    echo "1. Go to https://app.koyeb.com/"
    echo "2. Create new service from Git repository"
    echo "3. Connect your GitHub repository"
    echo "4. Koyeb will auto-deploy using the configuration"
}

# Deploy to Google Cloud Run (Free tier)
deploy_cloudrun() {
    print_status "Deploying to Google Cloud Run..."
    
    # Create Dockerfile if it doesn't exist
    if [ ! -f "Dockerfile" ]; then
        print_status "Creating Dockerfile..."
        cat > Dockerfile << EOF
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

CMD ["npm", "start"]
EOF
        git add Dockerfile
        git commit -m "Add Dockerfile for Cloud Run deployment"
    fi
    
    # Create .gcloudignore
    if [ ! -f ".gcloudignore" ]; then
        cat > .gcloudignore << EOF
node_modules/
.git/
.gitignore
README.md
.env
.env.*
tests/
*.test.js
coverage/
EOF
        git add .gcloudignore
        git commit -m "Add .gcloudignore for Cloud Run"
    fi
    
    print_success "Cloud Run configuration ready"
    print_status "To complete deployment:"
    echo "1. Install Google Cloud SDK"
    echo "2. Login: gcloud auth login"
    echo "3. Set project: gcloud config set project YOUR_PROJECT_ID"
    echo "4. Enable Cloud Run: gcloud services enable run.googleapis.com"
    echo "5. Deploy: gcloud run deploy ${APP_NAME} --source . --platform managed --region us-central1 --allow-unauthenticated"
}

# Deploy to Back4App Containers
deploy_back4app() {
    print_status "Deploying to Back4App Containers..."
    
    # Create back4app.json if it doesn't exist
    if [ ! -f "back4app.json" ]; then
        print_status "Creating back4app.json..."
        cat > back4app.json << EOF
{
  "name": "${APP_NAME}",
  "description": "LLM AI Bridge Server",
  "repository": "https://github.com/scarmonit-creator/LLM",
  "logo": "https://cdn.back4app.com/public/b4a-containers/back4app-logo.png",
  "keywords": ["ai", "llm", "bridge", "websocket", "express"],
  "stack": "container",
  "env": {
    "NODE_ENV": {
      "description": "Node environment",
      "value": "production"
    },
    "PORT": {
      "description": "Port number",
      "value": "8080"
    }
  },
  "formation": {
    "web": {
      "quantity": 1,
      "size": "FREE"
    }
  },
  "image": "heroku/nodejs",
  "addons": [],
  "buildpacks": [
    {
      "url": "heroku/nodejs"
    }
  ]
}
EOF
        git add back4app.json
        git commit -m "Add Back4App deployment configuration"
    fi
    
    print_success "Back4App configuration ready"
    print_status "To complete deployment:"
    echo "1. Go to https://containers.back4app.com/"
    echo "2. Create new container from GitHub"
    echo "3. Connect your repository and deploy"
}

# Main deployment logic
case $PLATFORM in
    "render")
        check_requirements
        deploy_render
        ;;
    "railway")
        check_requirements
        deploy_railway
        ;;
    "fly")
        check_requirements
        deploy_fly
        ;;
    "koyeb")
        check_requirements
        deploy_koyeb
        ;;
    "cloudrun")
        check_requirements
        deploy_cloudrun
        ;;
    "back4app")
        check_requirements
        deploy_back4app
        ;;
    "all")
        check_requirements
        print_status "Creating configurations for all platforms..."
        deploy_render
        deploy_railway
        deploy_fly
        deploy_koyeb
        deploy_cloudrun
        deploy_back4app
        print_success "All platform configurations created!"
        ;;
    *)
        print_error "Unknown platform: $PLATFORM"
        echo "Supported platforms: render, railway, fly, koyeb, cloudrun, back4app, all"
        echo "Usage: ./deploy-free.sh [platform] [app-name]"
        exit 1
        ;;
esac

print_success "Deployment configuration complete for $PLATFORM!"
print_status "Next steps:"
echo "1. Commit and push your changes to GitHub"
echo "2. Follow the platform-specific instructions above"
echo "3. Test the deployment with: curl https://your-app-url/health"

echo ""
echo "🎉 Happy deploying!"
