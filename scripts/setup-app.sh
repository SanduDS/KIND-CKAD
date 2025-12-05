#!/bin/bash
#
# CKAD Practice Platform - Application Setup Script
# Run this after deploy.sh and cloning the repository
#
# Usage: bash scripts/setup-app.sh
#

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

APP_DIR="/opt/ckad-platform"
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

cd $APP_DIR

# ============================================
# 1. Generate secrets if not exists
# ============================================
if [ ! -f .env ]; then
    log "🔐 Creating .env file..."
    
    # Generate random secrets
    JWT_SECRET=$(openssl rand -hex 64)
    JWT_REFRESH_SECRET=$(openssl rand -hex 64)
    
    cat > .env << EOF
# CKAD Practice Platform Configuration
# Generated on $(date)

# Server URLs
FRONTEND_URL=http://${SERVER_IP}
NEXT_PUBLIC_API_URL=http://${SERVER_IP}
NEXT_PUBLIC_WS_URL=ws://${SERVER_IP}

# JWT Secrets (auto-generated)
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

# Google OAuth (optional - configure for Google login)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://${SERVER_IP}/api/auth/google/callback

# Email OTP (optional - configure for email login)
# Get API key from https://resend.com
EMAIL_PROVIDER=resend
RESEND_API_KEY=
EMAIL_FROM=noreply@example.com

# Session Configuration
SESSION_TTL_MINUTES=60
SESSION_EXTENSION_MINUTES=30
MAX_CONCURRENT_SESSIONS=3
EOF

    log "✅ Environment file created"
    echo ""
    echo -e "${YELLOW}⚠️  Please edit .env to configure:${NC}"
    echo "   - GOOGLE_CLIENT_ID (for Google OAuth)"
    echo "   - GOOGLE_CLIENT_SECRET"
    echo "   - RESEND_API_KEY (for email OTP)"
    echo ""
fi

# ============================================
# 2. Build terminal container image
# ============================================
log "🐳 Building terminal container image..."
docker build -t ckad-terminal:latest -f docker/terminal/Dockerfile docker/terminal/
log "✅ Terminal image built"

# ============================================
# 3. Create Docker network (for KIND)
# ============================================
log "🌐 Creating Docker network..."
docker network create kind 2>/dev/null || true
log "✅ Docker network ready"

# ============================================
# 4. Build backend
# ============================================
log "🔧 Building backend..."
cd backend
npm ci --production 2>/dev/null || npm install --production
log "✅ Backend dependencies installed"

# Initialize database and seed tasks
log "📊 Initializing database..."
mkdir -p $APP_DIR/data
node src/db/seed.js
log "✅ Database seeded with CKAD tasks"

cd $APP_DIR

# ============================================
# 5. Build frontend
# ============================================
log "🎨 Building frontend..."
cd frontend
npm ci 2>/dev/null || npm install

# Set build-time env vars from .env
source $APP_DIR/.env
export NEXT_PUBLIC_API_URL
export NEXT_PUBLIC_WS_URL

npm run build

# Copy static files to standalone directory (required for Next.js standalone mode)
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/ 2>/dev/null || true

log "✅ Frontend built"

cd $APP_DIR

# ============================================
# 6. Setup systemd service
# ============================================
log "⚙️ Setting up systemd services..."

# Backend service
cat > /etc/systemd/system/ckad-backend.service << 'EOF'
[Unit]
Description=CKAD Practice Platform Backend
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ckad-platform/backend
EnvironmentFile=/opt/ckad-platform/.env
Environment=NODE_ENV=production
ExecStartPre=/opt/ckad-platform/scripts/cleanup-orphans.sh
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
StandardOutput=append:/opt/ckad-platform/logs/backend.log
StandardError=append:/opt/ckad-platform/logs/backend-error.log

[Install]
WantedBy=multi-user.target
EOF

# Frontend service
cat > /etc/systemd/system/ckad-frontend.service << 'EOF'
[Unit]
Description=CKAD Practice Platform Frontend
After=network.target ckad-backend.service
Wants=ckad-backend.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ckad-platform/frontend
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=always
RestartSec=10
StandardOutput=append:/opt/ckad-platform/logs/frontend.log
StandardError=append:/opt/ckad-platform/logs/frontend-error.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ckad-backend ckad-frontend
log "✅ Systemd services configured"

# ============================================
# 7. Setup Nginx
# ============================================
log "🌐 Setting up Nginx..."

cat > /etc/nginx/sites-available/ckad-platform << EOF
# CKAD Practice Platform Nginx Config
# Server IP: ${SERVER_IP}

# Rate limiting zones
limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone \$binary_remote_addr zone=auth:10m rate=1r/s;

upstream backend {
    server 127.0.0.1:3001;
    keepalive 32;
}

upstream frontend {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name ${SERVER_IP} _;

    # Security headers
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Health check
    location /nginx-health {
        access_log off;
        return 200 'OK';
        add_header Content-Type text/plain;
    }

    # Backend health
    location ~ ^/(healthz|readyz)\$ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    # Auth routes (rate limited)
    location /api/auth/ {
        limit_req zone=auth burst=5 nodelay;
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # API routes
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # WebSocket for terminal
    location /ws/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

ln -sf /etc/nginx/sites-available/ckad-platform /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx
log "✅ Nginx configured"

# ============================================
# 8. Create log directory
# ============================================
mkdir -p $APP_DIR/logs

# ============================================
# 9. Make scripts executable
# ============================================
chmod +x $APP_DIR/scripts/*.sh

# ============================================
# 10. Start services
# ============================================
log "🚀 Starting CKAD Platform..."
systemctl start ckad-backend
sleep 3
systemctl start ckad-frontend

# Wait for services to start
sleep 5

# Check health
if curl -s http://localhost:3001/healthz | grep -q "ok"; then
    log "✅ Backend is healthy!"
else
    echo -e "${YELLOW}⚠️  Backend might still be starting. Check logs:${NC}"
    echo "   tail -f /opt/ckad-platform/logs/backend.log"
fi

# ============================================
# Summary
# ============================================
echo ""
echo "============================================"
echo -e "${GREEN}✅ CKAD Practice Platform is ready!${NC}"
echo "============================================"
echo ""
echo "🌐 Access your platform at:"
echo "   http://${SERVER_IP}"
echo ""
echo "📋 Services:"
echo "   Backend:  systemctl status ckad-backend"
echo "   Frontend: systemctl status ckad-frontend"
echo "   Nginx:    systemctl status nginx"
echo ""
echo "📝 Logs:"
echo "   tail -f /opt/ckad-platform/logs/backend.log"
echo "   tail -f /opt/ckad-platform/logs/frontend.log"
echo ""
echo "⚠️  Configure authentication in .env:"
echo "   nano /opt/ckad-platform/.env"
echo ""
echo "🔒 For SSL with domain:"
echo "   ./scripts/setup-ssl.sh yourdomain.com"
echo ""
echo "============================================"
