#!/bin/bash
# Cloud deployment script for GClient Evaluator Service

set -e

echo "🚀 Deploying GClient Evaluator Service to Cloud"
echo "================================================"

# Build and push Docker image
echo "📦 Building Docker image..."
docker build -t gclient-evaluator:latest .

# Tag for registry (replace with your registry)
REGISTRY=${DOCKER_REGISTRY:-"your-registry.com"}
docker tag gclient-evaluator:latest $REGISTRY/gclient-evaluator:latest

echo "📤 Pushing to registry..."
docker push $REGISTRY/gclient-evaluator:latest

# Deploy with Docker Compose (local/development)
if [ "$1" == "local" ]; then
    echo "🔧 Starting local deployment..."
    docker-compose up -d
    echo "✅ Local deployment complete!"
    echo "🌐 Service available at: http://localhost"
    exit 0
fi

# Deploy to Kubernetes (production)
if [ "$1" == "k8s" ]; then
    echo "☸️  Deploying to Kubernetes..."
    kubectl apply -f kubernetes-deployment.yml
    
    echo "⏳ Waiting for deployment to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/gclient-evaluator
    
    # Get service endpoint
    SERVICE_IP=$(kubectl get service gclient-evaluator-service -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    
    echo "✅ Kubernetes deployment complete!"
    echo "🌐 Service available at: http://$SERVICE_IP"
    exit 0
fi

# Deploy to cloud platforms
case "$1" in
    "aws")
        echo "☁️  Deploying to AWS ECS..."
        # AWS ECS deployment commands here
        ;;
    "gcp")
        echo "☁️  Deploying to Google Cloud Run..."
        gcloud run deploy gclient-evaluator \
            --image=$REGISTRY/gclient-evaluator:latest \
            --port=8080 \
            --memory=512Mi \
            --cpu=1 \
            --min-instances=1 \
            --max-instances=10 \
            --allow-unauthenticated
        ;;
    "azure")
        echo "☁️  Deploying to Azure Container Instances..."
        # Azure deployment commands here
        ;;
    *)
        echo "Usage: $0 {local|k8s|aws|gcp|azure}"
        echo ""
        echo "Available deployment targets:"
        echo "  local  - Docker Compose (development)"
        echo "  k8s    - Kubernetes cluster"
        echo "  aws    - Amazon Web Services"
        echo "  gcp    - Google Cloud Platform"
        echo "  azure  - Microsoft Azure"
        exit 1
        ;;
esac

echo "🎯 Deployment complete!"
