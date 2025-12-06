#!/bin/bash
#
# CKAD Platform Full Deployment Script
# Run this on a fresh Ubuntu 22.04+ VPS
#
# Usage: curl -sSL https://raw.githubusercontent.com/YOUR_REPO/Kind/main/scripts/full-deploy.sh | bash
#

set -e

# Configuration
DOMAIN="${DOMAIN:-kind-k8s.duckdns.org}"
EMAIL="${EMAIL:-admin@example.com}"
APP_DIR="/opt/ckad-platform"
REPO_URL="${REPO_URL:-https://github.com/YOUR_USERNAME/Kind.git}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║     CKAD Practice Platform - Full Deployment      ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# =========================================
# PHASE 1: System Preparation
# =========================================
log "Phase 1: System Preparation"

# Update system
log "Updating system packages..."
apt update && apt upgrade -y
success "System updated"

# Install dependencies
log "Installing dependencies..."
apt install -y \
    docker.io \
    docker-compose \
    git \
    curl \
    wget \
    sqlite3 \
    nginx \
    certbot \
    python3-certbot-nginx \
    jq \
    ufw

success "Dependencies installed"

# Start Docker
systemctl enable docker
systemctl start docker
success "Docker started"

# Install KIND
if ! command -v kind &> /dev/null; then
    log "Installing KIND..."
    curl -Lo ./kind https://kind.sigs.k8s.io/dl/latest/kind-linux-amd64
    chmod +x kind
    mv kind /usr/local/bin/
    success "KIND installed"
else
    success "KIND already installed"
fi

# Install kubectl
if ! command -v kubectl &> /dev/null; then
    log "Installing kubectl..."
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
    chmod +x kubectl
    mv kubectl /usr/local/bin/
    success "kubectl installed"
else
    success "kubectl already installed"
fi

# Install Node.js 20
if ! command -v node &> /dev/null; then
    log "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    success "Node.js installed"
else
    success "Node.js already installed: $(node -v)"
fi

# =========================================
# PHASE 2: Application Setup
# =========================================
log "Phase 2: Application Setup"

# Clone or update repository
if [ -d "$APP_DIR/.git" ]; then
    log "Updating existing repository..."
    cd $APP_DIR
    git pull
else
    log "Cloning repository..."
    mkdir -p $APP_DIR
    git clone $REPO_URL $APP_DIR
fi
cd $APP_DIR
success "Repository ready"

# Create directories
mkdir -p data backups
success "Directories created"

# Create .env if not exists
if [ ! -f .env ]; then
    log "Creating environment configuration..."
    cat > .env << EOF
NODE_ENV=production
PORT=3001

# Domain
DOMAIN=$DOMAIN
FRONTEND_URL=https://$DOMAIN
BACKEND_URL=https://$DOMAIN

# JWT Secrets (auto-generated)
JWT_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)

# Database
DATABASE_PATH=$APP_DIR/data/ckad.db

# Session Config
MAX_CONCURRENT_SESSIONS=4
SESSION_TTL_MINUTES=60
SESSION_EXTENSION_MINUTES=30

# KIND Config
KIND_API_PORT_START=30000
KIND_INGRESS_PORT_START=40000

# Terminal Container
TERMINAL_MEMORY_LIMIT=512m
TERMINAL_CPU_LIMIT=0.5

# Optional: Google OAuth (leave empty to disable)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://$DOMAIN/api/auth/google/callback

# Optional: Email (leave empty to use test login only)
EMAIL_PROVIDER=
SENDGRID_API_KEY=
EMAIL_FROM=
EOF
    success "Environment file created"
else
    warn ".env already exists, skipping"
fi

# Build terminal image
log "Building terminal container image..."
docker build -t ckad-terminal:latest -f docker/terminal/Dockerfile .
success "Terminal image built"

# Install backend dependencies
log "Installing backend dependencies..."
cd $APP_DIR/backend
npm install --production
success "Backend dependencies installed"

# Create frontend env
log "Configuring frontend..."
cd $APP_DIR/frontend
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=https://$DOMAIN/api
NEXT_PUBLIC_WS_URL=wss://$DOMAIN
EOF

# Install and build frontend
log "Building frontend (this may take a few minutes)..."
npm install
npm run build

# Copy static files for standalone
if [ -d ".next/static" ]; then
    cp -r .next/static .next/standalone/.next/
fi
if [ -d "public" ]; then
    cp -r public .next/standalone/
fi
success "Frontend built"

# Initialize database
log "Initializing database..."
cd $APP_DIR/backend
node src/db/seed.js
success "Database initialized with sample tasks"

# =========================================
# PHASE 3: Services & HTTPS
# =========================================
log "Phase 3: Services & HTTPS Setup"

# Configure Nginx
log "Configuring Nginx..."
cat > /etc/nginx/sites-available/ckad-platform << 'NGINX'
# HTTP redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_PLACEHOLDER;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name DOMAIN_PLACEHOLDER;

    # SSL certificates (will be added by certbot)
    ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # API routes
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # WebSocket for terminal
    location /ws/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Health checks
    location /healthz {
        proxy_pass http://127.0.0.1:3001;
    }

    location /readyz {
        proxy_pass http://127.0.0.1:3001;
    }

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files caching
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
NGINX

# Replace domain placeholder
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/ckad-platform

# Enable site
ln -sf /etc/nginx/sites-available/ckad-platform /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Get SSL certificate
log "Obtaining SSL certificate..."
mkdir -p /var/www/html

# Temporarily use HTTP-only config for certbot
cat > /etc/nginx/sites-available/ckad-temp << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    root /var/www/html;
    location /.well-known/acme-challenge/ {
        allow all;
    }
}
EOF
ln -sf /etc/nginx/sites-available/ckad-temp /etc/nginx/sites-enabled/ckad-platform
nginx -t && systemctl reload nginx

# Get certificate
certbot certonly --webroot -w /var/www/html -d $DOMAIN --non-interactive --agree-tos --email $EMAIL || {
    warn "Certbot failed. You may need to run it manually later."
}

# Restore production config
ln -sf /etc/nginx/sites-available/ckad-platform /etc/nginx/sites-enabled/ckad-platform
rm -f /etc/nginx/sites-available/ckad-temp
nginx -t && systemctl reload nginx
success "Nginx configured"

# Install systemd services
log "Installing systemd services..."
cp $APP_DIR/systemd/ckad-backend.service /etc/systemd/system/
cp $APP_DIR/systemd/ckad-frontend.service /etc/systemd/system/

# Make scripts executable
chmod +x $APP_DIR/scripts/*.sh

systemctl daemon-reload
systemctl enable ckad-backend ckad-frontend nginx
success "Systemd services installed"

# Start services
log "Starting services..."
systemctl start ckad-backend
sleep 5
systemctl start ckad-frontend
systemctl reload nginx
success "Services started"

# =========================================
# PHASE 4: Security & Monitoring
# =========================================
log "Phase 4: Security & Monitoring"

# Configure firewall
log "Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
success "Firewall configured"

# Setup backup cron
log "Setting up backup cron..."
cat > /etc/cron.d/ckad-platform << EOF
# Backup database every 6 hours
0 */6 * * * root $APP_DIR/scripts/backup.sh >> /var/log/ckad-backup.log 2>&1

# Cleanup orphans every hour
0 * * * * root $APP_DIR/scripts/cleanup-orphans.sh >> /var/log/ckad-cleanup.log 2>&1
EOF
success "Backup cron configured"

# Setup log rotation
cat > /etc/logrotate.d/ckad-platform << EOF
/var/log/ckad-*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
}
EOF
success "Log rotation configured"

# =========================================
# VERIFICATION
# =========================================
echo ""
log "Verifying deployment..."
echo ""

# Check services
echo "Services Status:"
systemctl is-active ckad-backend && success "Backend: Running" || error "Backend: Failed"
systemctl is-active ckad-frontend && success "Frontend: Running" || error "Frontend: Failed"
systemctl is-active nginx && success "Nginx: Running" || error "Nginx: Failed"

# Check API
echo ""
echo "API Health:"
if curl -s http://localhost:3001/healthz | jq -e '.status == "ok"' > /dev/null 2>&1; then
    success "API responding"
else
    warn "API not responding yet (may need a moment)"
fi

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║            Deployment Complete! 🎉                ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
echo "Access your platform at: https://$DOMAIN"
echo ""
echo "Test Login Credentials:"
echo "  Email: test@ckad.com"
echo "  Password: test123"
echo ""
echo "Useful Commands:"
echo "  View logs:     journalctl -u ckad-backend -f"
echo "  Monitor:       $APP_DIR/scripts/monitor.sh"
echo "  Restart:       systemctl restart ckad-backend ckad-frontend"
echo ""

