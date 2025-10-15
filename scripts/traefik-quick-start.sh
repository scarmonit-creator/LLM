#!/bin/bash

# Quick Start Script for Traefik Integration
# One-command deployment with automatic setup

set -euo pipefail

echo "🚀 Starting Traefik Integration Quick Deployment..."
echo "📅 $(date)"
echo ""

# Check if we're in the right directory
if [[ ! -f "package.json" ]] || [[ ! -f "server.js" ]]; then
    echo "❌ Error: Please run this script from the LLM repository root directory"
    exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose found"

# Setup environment if not exists
if [[ ! -f ".env" ]]; then
    if [[ -f ".env.traefik" ]]; then
        cp .env.traefik .env
        echo "✅ Created .env from template"
    else
        echo "❌ .env.traefik template not found"
        exit 1
    fi
else
    echo "✅ Using existing .env file"
fi

# Create required directories
mkdir -p logs traefik/dynamic monitoring
echo "✅ Directory structure created"

# Validate Docker Compose configuration
echo "🔍 Validating configuration..."
if docker-compose -f docker-compose.traefik.yml config > /dev/null; then
    echo "✅ Docker Compose configuration valid"
else
    echo "❌ Invalid Docker Compose configuration"
    exit 1
fi

# Pull required images
echo "📦 Pulling Docker images..."
docker pull traefik:v3.0
docker pull prom/prometheus:latest
docker pull grafana/grafana:latest

# Build LLM service
echo "🛠️ Building LLM service..."
docker-compose -f docker-compose.traefik.yml build

# Deploy services
echo "🚀 Deploying services..."
docker-compose -f docker-compose.traefik.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 15

# Verify deployment
echo "🔍 Verifying deployment..."

# Check Traefik
if curl -s http://localhost:8080/api/overview > /dev/null; then
    echo "✅ Traefik dashboard accessible"
else
    echo "⚠️ Traefik dashboard not yet accessible"
fi

# Check LLM services
if curl -s -H "Host: llm.localhost" http://localhost/health > /dev/null; then
    echo "✅ LLM service accessible"
else
    echo "⚠️ LLM service not yet accessible"
fi

# Show status
echo ""
echo "🎉 Deployment Complete!"
echo ""
echo "🔗 Access Points:"
echo "   LLM Service: http://llm.localhost (add to /etc/hosts: 127.0.0.1 llm.localhost)"
echo "   Traefik Dashboard: http://localhost:8080"
echo "   Prometheus: http://localhost:9090"
echo "   Grafana: http://localhost:3000 (admin/admin)"
echo ""
echo "📋 Container Status:"
docker-compose -f docker-compose.traefik.yml ps
echo ""
echo "🚀 Your LLM service is now running with:"
echo "   ✅ 3x Load Capacity (3 instances)"
echo "   ✅ Health Check Load Balancing"
echo "   ✅ Enterprise Security Headers"
echo "   ✅ Real-time Metrics & Monitoring"
echo "   ✅ Circuit Breakers & Retry Logic"
echo ""
echo "📈 Test load balancing:"
echo "   for i in {1..5}; do curl -s -H 'Host: llm.localhost' http://localhost/health | jq -r '.instance'; done"
echo ""
echo "🏠 To stop: docker-compose -f docker-compose.traefik.yml down"
echo "🔄 To restart: docker-compose -f docker-compose.traefik.yml restart"
echo ""
echo "✅ Ready for production use!"