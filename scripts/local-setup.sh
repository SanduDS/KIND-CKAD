#!/bin/bash
#
# Local Development Setup Script
# Sets up the CKAD Platform for local testing with Docker
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║   CKAD Platform - Local Development Setup        ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    error "Docker is not installed. Please install Docker first."
fi

if ! docker ps &> /dev/null; then
    error "Docker is not running. Please start Docker first."
fi

success "Docker is installed and running"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    error "Docker Compose is not installed. Please install Docker Compose first."
fi

success "Docker Compose is available"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    log "Creating .env file from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        success ".env file created"
        warn "Please edit .env file with your configuration (optional for local testing)"
    else
        error ".env.example not found"
    fi
else
    success ".env file already exists"
fi

# Create necessary directories
log "Creating data and logs directories..."
mkdir -p data logs
success "Directories created"

# Generate JWT secrets if not set
if ! grep -q "JWT_SECRET=.*[^=]$" .env 2>/dev/null || grep -q "JWT_SECRET=dev-jwt-secret" .env 2>/dev/null; then
    log "Generating JWT secrets..."
    JWT_SECRET=$(openssl rand -hex 32)
    JWT_REFRESH_SECRET=$(openssl rand -hex 32)
    
    # Update .env file
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
        sed -i '' "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET|" .env
    else
        # Linux
        sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
        sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET|" .env
    fi
    success "JWT secrets generated"
fi

# Build and start services
log "Building Docker images (this may take a few minutes)..."
if command -v docker-compose &> /dev/null; then
    docker-compose -f docker-compose.local.yml build
else
    docker compose -f docker-compose.local.yml build
fi
success "Docker images built"

# Start services
log "Starting services..."
if command -v docker-compose &> /dev/null; then
    docker-compose -f docker-compose.local.yml up -d
else
    docker compose -f docker-compose.local.yml up -d
fi
success "Services started"

# Wait for services to be healthy
log "Waiting for services to be ready..."
sleep 5

# Check backend health
log "Checking backend health..."
for i in {1..30}; do
    if curl -f http://localhost:3001/healthz &>/dev/null; then
        success "Backend is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        warn "Backend health check failed. Check logs with: docker logs ckad-backend-local"
    else
        sleep 2
    fi
done

# Check frontend health
log "Checking frontend health..."
for i in {1..30}; do
    if curl -f http://localhost:3000 &>/dev/null; then
        success "Frontend is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        warn "Frontend health check failed. Check logs with: docker logs ckad-frontend-local"
    else
        sleep 2
    fi
done

# Initialize database
log "Initializing database..."
if command -v docker-compose &> /dev/null; then
    docker-compose -f docker-compose.local.yml exec -T backend node src/db/seed.js || warn "Database seeding failed (may already be seeded)"
else
    docker compose -f docker-compose.local.yml exec -T backend node src/db/seed.js || warn "Database seeding failed (may already be seeded)"
fi
success "Database initialized"

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║           Setup Complete!                          ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:3001"
echo "📊 Health Check: http://localhost:3001/healthz"
echo ""
echo "Useful commands:"
echo "  View logs:        docker logs -f ckad-backend-local"
echo "                    docker logs -f ckad-frontend-local"
echo "  Stop services:    docker-compose -f docker-compose.local.yml down"
echo "  Restart:          docker-compose -f docker-compose.local.yml restart"
echo "  Rebuild:          docker-compose -f docker-compose.local.yml up -d --build"
echo ""


