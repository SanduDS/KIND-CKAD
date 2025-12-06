#!/bin/bash
#
# Test Frontend-Backend Connection
# Diagnoses connection issues between frontend and backend
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║   Frontend-Backend Connection Diagnostic          ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Check if running locally or on server
if [ -f "/opt/ckad-platform/.env" ]; then
    APP_DIR="/opt/ckad-platform"
    log "Detected server environment"
else
    APP_DIR="$(pwd)"
    log "Detected local environment"
fi

cd "$APP_DIR" || error "Cannot access $APP_DIR"

# 1. Check backend service
log "1. Checking backend service..."
if systemctl is-active --quiet ckad-backend 2>/dev/null; then
    success "Backend service is running"
    BACKEND_RUNNING=true
elif docker ps | grep -q ckad-backend; then
    success "Backend container is running"
    BACKEND_RUNNING=true
else
    error "Backend service/container is not running"
    BACKEND_RUNNING=false
fi

# 2. Check backend port
log "2. Checking backend port (3001)..."
if curl -f -s http://localhost:3001/healthz > /dev/null 2>&1; then
    success "Backend is responding on port 3001"
    BACKEND_ACCESSIBLE=true
else
    error "Backend is not accessible on port 3001"
    BACKEND_ACCESSIBLE=false
    if [ "$BACKEND_RUNNING" = true ]; then
        warn "Service is running but not responding - check logs"
    fi
fi

# 3. Check frontend service
log "3. Checking frontend service..."
if systemctl is-active --quiet ckad-frontend 2>/dev/null; then
    success "Frontend service is running"
    FRONTEND_RUNNING=true
elif docker ps | grep -q ckad-frontend; then
    success "Frontend container is running"
    FRONTEND_RUNNING=true
else
    error "Frontend service/container is not running"
    FRONTEND_RUNNING=false
fi

# 4. Check frontend port
log "4. Checking frontend port (3000)..."
if curl -f -s http://localhost:3000 > /dev/null 2>&1; then
    success "Frontend is responding on port 3000"
    FRONTEND_ACCESSIBLE=true
else
    error "Frontend is not accessible on port 3000"
    FRONTEND_ACCESSIBLE=false
fi

# 5. Test API endpoint
log "5. Testing API endpoint..."
if [ "$BACKEND_ACCESSIBLE" = true ]; then
    API_RESPONSE=$(curl -s http://localhost:3001/api/auth/test-login \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"test123"}' 2>&1)
    
    if echo "$API_RESPONSE" | grep -q "accessToken\|error"; then
        success "API endpoint is responding"
        echo "   Response: $(echo "$API_RESPONSE" | head -c 100)"
    else
        error "API endpoint returned unexpected response"
        echo "   Response: $API_RESPONSE"
    fi
else
    warn "Skipping API test - backend not accessible"
fi

# 6. Check environment variables
log "6. Checking environment configuration..."
if [ -f ".env" ]; then
    success ".env file exists"
    
    if grep -q "FRONTEND_URL" .env; then
        FRONTEND_URL=$(grep "FRONTEND_URL" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
        log "   FRONTEND_URL: $FRONTEND_URL"
    else
        warn "FRONTEND_URL not set in .env"
    fi
    
    if grep -q "NEXT_PUBLIC_API_URL" .env; then
        API_URL=$(grep "NEXT_PUBLIC_API_URL" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
        log "   NEXT_PUBLIC_API_URL: $API_URL"
    else
        warn "NEXT_PUBLIC_API_URL not set in .env (will use relative URLs)"
    fi
else
    warn ".env file not found"
fi

# 7. Check Nginx (if running)
log "7. Checking Nginx configuration..."
if systemctl is-active --quiet nginx 2>/dev/null; then
    success "Nginx is running"
    
    # Check if Nginx is proxying correctly
    if curl -f -s http://localhost/api/auth/test-login \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"email":"test","password":"test"}' > /dev/null 2>&1; then
        success "Nginx is proxying API requests"
    else
        warn "Nginx proxy test failed (may be expected if not configured)"
    fi
else
    log "Nginx is not running (using direct ports)"
fi

# 8. Check backend logs for errors
log "8. Checking recent backend logs..."
if [ "$BACKEND_RUNNING" = true ]; then
    if command -v journalctl &> /dev/null; then
        RECENT_ERRORS=$(journalctl -u ckad-backend -n 20 --no-pager 2>/dev/null | grep -i "error\|failed\|cannot" | tail -5)
        if [ -n "$RECENT_ERRORS" ]; then
            warn "Recent errors in backend logs:"
            echo "$RECENT_ERRORS" | sed 's/^/   /'
        else
            success "No recent errors in backend logs"
        fi
    elif docker ps | grep -q ckad-backend; then
        RECENT_ERRORS=$(docker logs ckad-backend 2>&1 | tail -20 | grep -i "error\|failed\|cannot" | tail -5)
        if [ -n "$RECENT_ERRORS" ]; then
            warn "Recent errors in backend logs:"
            echo "$RECENT_ERRORS" | sed 's/^/   /'
        else
            success "No recent errors in backend logs"
        fi
    fi
fi

# Summary
echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║   Summary                                        ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

if [ "$BACKEND_ACCESSIBLE" = true ] && [ "$FRONTEND_ACCESSIBLE" = true ]; then
    success "Both services are accessible"
    echo ""
    echo "Test the connection:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend API: http://localhost:3001"
    echo "  Health: http://localhost:3001/healthz"
    echo ""
    echo "If frontend still can't connect:"
    echo "  1. Check browser console for errors"
    echo "  2. Verify NEXT_PUBLIC_API_URL in frontend build"
    echo "  3. Check CORS configuration in backend"
    echo "  4. Rebuild frontend: cd frontend && npm run build"
else
    error "Services are not fully accessible"
    echo ""
    if [ "$BACKEND_RUNNING" = false ]; then
        echo "  → Start backend: systemctl start ckad-backend"
    fi
    if [ "$FRONTEND_RUNNING" = false ]; then
        echo "  → Start frontend: systemctl start ckad-frontend"
    fi
    if [ "$BACKEND_ACCESSIBLE" = false ] && [ "$BACKEND_RUNNING" = true ]; then
        echo "  → Check backend logs: journalctl -u ckad-backend -f"
    fi
fi

echo ""

