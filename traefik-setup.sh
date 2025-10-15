#!/bin/bash

# Traefik Setup Script
# Automated setup for Traefik reverse proxy with the LLM application

set -e

echo "🚀 Setting up Traefik reverse proxy for LLM application..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if Docker and Docker Compose are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Dependencies check passed"
}

# Create necessary directories
create_directories() {
    print_status "Creating Traefik data directories..."
    
    mkdir -p traefik-data/{acme,logs,dynamic}
    
    # Set proper permissions for ACME storage
    chmod 700 traefik-data/acme
    
    # Create a basic dynamic configuration file
    cat > traefik-data/dynamic/default.yml << EOF
# Default dynamic configuration for Traefik
# Add your custom middleware and services here

http:
  middlewares:
    default-headers:
      headers:
        frameDeny: true
        sslRedirect: true
        browserXssFilter: true
        contentTypeNosniff: true
        forceSTSHeader: true
        stsIncludeSubdomains: true
        stsSeconds: 31536000
        stsPreload: true
        customRequestHeaders:
          X-Forwarded-Proto: https
EOF
    
    print_success "Directories created successfully"
}

# Generate secure password hash
generate_password() {
    print_status "Generating secure admin password..."
    
    # Check if htpasswd is available
    if command -v htpasswd &> /dev/null; then
        # Generate random password
        PASSWORD=$(openssl rand -base64 32)
        # Create hash
        HASH=$(htpasswd -nb admin "$PASSWORD" | sed -e s/\\$/\\$\\$/g)
        
        print_success "Admin password generated: $PASSWORD"
        print_warning "Save this password! It won't be shown again."
        
        # Add to environment file
        echo "TRAEFIK_ADMIN_PASSWORD_HASH=$HASH" >> .env.traefik.local
        print_success "Password hash added to .env.traefik.local"
    else
        print_warning "htpasswd not found. Please install apache2-utils or httpd-tools"
        print_warning "You can generate a password hash manually with:"
        print_warning "htpasswd -nb admin your_password | sed -e s/\\$/\\$\\$/g"
    fi
}

# Validate environment configuration
validate_config() {
    print_status "Validating configuration..."
    
    if [[ ! -f ".env.traefik" ]]; then
        print_error ".env.traefik file not found"
        exit 1
    fi
    
    # Check for required variables
    source .env.traefik
    
    if [[ -z "$TRAEFIK_DOMAIN" ]]; then
        print_warning "TRAEFIK_DOMAIN not set, using localhost"
    fi
    
    if [[ -z "$TRAEFIK_ACME_EMAIL" ]]; then
        print_error "TRAEFIK_ACME_EMAIL must be set for SSL certificates"
        exit 1
    fi
    
    print_success "Configuration validation passed"
}

# Start Traefik services
start_services() {
    print_status "Starting Traefik services..."
    
    # Load environment files
    ENV_FILES=""
    if [[ -f ".env.traefik" ]]; then
        ENV_FILES="$ENV_FILES --env-file .env.traefik"
    fi
    if [[ -f ".env.traefik.local" ]]; then
        ENV_FILES="$ENV_FILES --env-file .env.traefik.local"
    fi
    
    # Start services
    docker-compose -f docker-compose.traefik.yml $ENV_FILES up -d
    
    print_success "Traefik services started successfully"
}

# Display service information
show_info() {
    print_status "Service Information:"
    
    source .env.traefik 2>/dev/null || true
    DOMAIN=${TRAEFIK_DOMAIN:-localhost}
    API_DOMAIN=${TRAEFIK_API_DOMAIN:-traefik.localhost}
    API_PORT=${TRAEFIK_API_PORT:-8081}
    
    echo ""
    echo "📊 Traefik Dashboard: https://$API_DOMAIN (if DNS configured)"
    echo "📊 Local Dashboard: http://localhost:$API_PORT"
    echo "🌐 LLM Application: https://$DOMAIN (if DNS configured)"
    echo "🧪 Test Service: https://whoami.$DOMAIN (if DNS configured)"
    echo "📈 Metrics: http://localhost:9090/metrics"
    echo ""
    echo "🔑 Admin credentials: Check .env.traefik.local for password"
    echo ""
    echo "📋 View logs with: docker-compose -f docker-compose.traefik.yml logs -f"
    echo "🛑 Stop services with: docker-compose -f docker-compose.traefik.yml down"
    echo ""
}

# Health check
health_check() {
    print_status "Performing health check..."
    
    sleep 5
    
    if curl -s http://localhost:8081/ping > /dev/null; then
        print_success "Traefik is healthy and responding"
    else
        print_warning "Traefik may still be starting up. Check logs if issues persist."
    fi
}

# Main execution
main() {
    echo "🔧 Traefik Setup for LLM Application"
    echo "===================================="
    echo ""
    
    check_dependencies
    create_directories
    validate_config
    generate_password
    start_services
    health_check
    show_info
    
    print_success "🎉 Traefik setup completed successfully!"
}

# Run main function
main "$@"
