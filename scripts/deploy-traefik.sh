#!/bin/bash

# LLM Service Traefik Deployment Script
# Automated deployment with comprehensive validation and monitoring

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_ROOT}/.env"
TRAEFIK_ENV_TEMPLATE="${PROJECT_ROOT}/.env.traefik"
DOCKER_COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.traefik.yml"
TRAEFIK_DIR="${PROJECT_ROOT}/traefik"
LOG_FILE="${PROJECT_ROOT}/logs/traefik-deployment.log"

# Functions
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} $message"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message"
            ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} $message"
            ;;
    esac
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

check_requirements() {
    log "INFO" "Checking system requirements..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log "ERROR" "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log "ERROR" "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log "ERROR" "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    
    log "INFO" "✅ All requirements satisfied"
}

setup_environment() {
    log "INFO" "Setting up environment configuration..."
    
    # Create logs directory
    mkdir -p "${PROJECT_ROOT}/logs"
    
    # Create Traefik directory structure
    mkdir -p "${TRAEFIK_DIR}/dynamic"
    
    # Copy environment template if .env doesn't exist
    if [[ ! -f "$ENV_FILE" ]]; then
        if [[ -f "$TRAEFIK_ENV_TEMPLATE" ]]; then
            cp "$TRAEFIK_ENV_TEMPLATE" "$ENV_FILE"
            log "INFO" "Created .env file from template. Please customize it before deployment."
        else
            log "ERROR" "Environment template not found: $TRAEFIK_ENV_TEMPLATE"
            exit 1
        fi
    else
        log "INFO" "Using existing .env file"
    fi
    
    # Validate environment file
    source "$ENV_FILE"
    
    if [[ -z "${LLM_HOST:-}" ]]; then
        log "ERROR" "LLM_HOST is not set in .env file"
        exit 1
    fi
    
    log "INFO" "✅ Environment configured for host: $LLM_HOST"
}

validate_configuration() {
    log "INFO" "Validating Traefik configuration..."
    
    # Check Docker Compose file
    if [[ ! -f "$DOCKER_COMPOSE_FILE" ]]; then
        log "ERROR" "Docker Compose file not found: $DOCKER_COMPOSE_FILE"
        exit 1
    fi
    
    # Validate Docker Compose syntax
    if ! docker-compose -f "$DOCKER_COMPOSE_FILE" config &> /dev/null; then
        log "ERROR" "Invalid Docker Compose configuration"
        docker-compose -f "$DOCKER_COMPOSE_FILE" config
        exit 1
    fi
    
    # Check middleware configuration
    if [[ ! -f "${TRAEFIK_DIR}/dynamic/llm-middleware.yml" ]]; then
        log "ERROR" "Traefik middleware configuration not found"
        exit 1
    fi
    
    log "INFO" "✅ Configuration validation passed"
}

build_images() {
    log "INFO" "Building LLM service Docker images..."
    
    cd "$PROJECT_ROOT"
    
    # Build LLM service image
    if ! docker-compose -f "$DOCKER_COMPOSE_FILE" build llm-service-1; then
        log "ERROR" "Failed to build LLM service image"
        exit 1
    fi
    
    log "INFO" "✅ Docker images built successfully"
}

deploy_services() {
    log "INFO" "Deploying Traefik and LLM services..."
    
    cd "$PROJECT_ROOT"
    
    # Pull latest Traefik image
    docker pull traefik:v3.0
    
    # Deploy services
    if ! docker-compose -f "$DOCKER_COMPOSE_FILE" up -d; then
        log "ERROR" "Failed to deploy services"
        exit 1
    fi
    
    log "INFO" "✅ Services deployed successfully"
}

wait_for_services() {
    log "INFO" "Waiting for services to become healthy..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        log "DEBUG" "Health check attempt $attempt/$max_attempts"
        
        # Check Traefik
        if curl -s http://localhost:8080/api/overview &> /dev/null; then
            log "INFO" "✅ Traefik is healthy"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            log "ERROR" "Services did not become healthy within expected time"
            docker-compose -f "$DOCKER_COMPOSE_FILE" logs
            exit 1
        fi
        
        sleep 10
        ((attempt++))
    done
    
    # Test LLM services
    local services=("llm-service-1" "llm-service-2" "llm-service-3")
    for service in "${services[@]}"; do
        if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T "$service" curl -s http://localhost:8080/health &> /dev/null; then
            log "INFO" "✅ $service is healthy"
        else
            log "WARN" "⚠️  $service may not be fully healthy yet"
        fi
    done
}

validate_deployment() {
    log "INFO" "Validating deployment..."
    
    local errors=0
    
    # Test Traefik dashboard
    if curl -s http://localhost:8080/api/overview | grep -q '"routers"'; then
        log "INFO" "✅ Traefik dashboard accessible"
    else
        log "ERROR" "❌ Traefik dashboard not accessible"
        ((errors++))
    fi
    
    # Test load balancing
    local responses=()
    for i in {1..6}; do
        response=$(curl -s -H "Host: ${LLM_HOST}" http://localhost/health | jq -r '.instance // "unknown"' 2>/dev/null || echo "unknown")
        responses+=("$response")
        sleep 1
    done
    
    local unique_responses=($(printf "%s\n" "${responses[@]}" | sort -u))
    if [[ ${#unique_responses[@]} -gt 1 ]]; then
        log "INFO" "✅ Load balancing working (instances: ${unique_responses[*]})"
    else
        log "WARN" "⚠️  Load balancing may not be working properly"
        ((errors++))
    fi
    
    # Test SSL redirect (if configured)
    if [[ "${LLM_HOST}" != "localhost" ]] && [[ "${LLM_HOST}" != *".localhost" ]]; then
        if curl -s -I -H "Host: ${LLM_HOST}" http://localhost/ | grep -q "301\|302"; then
            log "INFO" "✅ HTTPS redirect working"
        else
            log "WARN" "⚠️  HTTPS redirect may not be configured"
        fi
    fi
    
    if [[ $errors -eq 0 ]]; then
        log "INFO" "✅ Deployment validation passed"
    else
        log "WARN" "⚠️  Deployment validation completed with $errors warnings"
    fi
}

show_status() {
    log "INFO" "Deployment Status:"
    echo ""
    echo "🔗 Service URLs:"
    echo "   LLM Service: http://${LLM_HOST} (or http://localhost with Host header)"
    echo "   Traefik Dashboard: http://localhost:8080"
    
    if [[ -n "${PROMETHEUS_HOST:-}" ]]; then
        echo "   Prometheus: http://${PROMETHEUS_HOST} (or http://localhost:9090)"
    fi
    
    if [[ -n "${GRAFANA_HOST:-}" ]]; then
        echo "   Grafana: http://${GRAFANA_HOST} (or http://localhost:3000)"
    fi
    
    echo ""
    echo "📊 Container Status:"
    docker-compose -f "$DOCKER_COMPOSE_FILE" ps
    
    echo ""
    echo "🏥 Health Status:"
    curl -s -H "Host: ${LLM_HOST}" http://localhost/health | jq '.' 2>/dev/null || echo "Health check failed"
    
    echo ""
    echo "📝 Useful Commands:"
    echo "   View logs: docker-compose -f $DOCKER_COMPOSE_FILE logs -f"
    echo "   Stop services: docker-compose -f $DOCKER_COMPOSE_FILE down"
    echo "   Restart services: docker-compose -f $DOCKER_COMPOSE_FILE restart"
    echo "   Scale LLM service: docker-compose -f $DOCKER_COMPOSE_FILE up -d --scale llm-service-1=5"
}

cleanup() {
    log "INFO" "Performing cleanup..."
    # Add any cleanup tasks here
}

# Trap for cleanup on exit
trap cleanup EXIT

# Main execution
main() {
    log "INFO" "Starting Traefik deployment for LLM service"
    log "INFO" "Timestamp: $(date)"
    log "INFO" "Project root: $PROJECT_ROOT"
    
    check_requirements
    setup_environment
    validate_configuration
    build_images
    deploy_services
    wait_for_services
    validate_deployment
    show_status
    
    log "INFO" "🎉 Traefik deployment completed successfully!"
    log "INFO" "📋 Check the status above and logs at: $LOG_FILE"
}

# Execute main function
main "$@"