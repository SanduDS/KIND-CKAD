#!/bin/bash
#
# CKAD Platform - Clean Deployment Script
# Usage: DOMAIN=your-domain.com EMAIL=your@email.com ./scripts/full-deploy.sh
#

set -e

# Configuration
DOMAIN="${DOMAIN:-kind-k8s.duckdns.org}"
EMAIL="${EMAIL:-admin@example.com}"
APP_DIR="/opt/ckad-platform"

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
echo "║     CKAD Practice Platform - Clean Deployment     ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo ""

# =========================================
# PHASE 1: System Setup
# =========================================
log "Phase 1: System Setup"

# Update system
log "Updating system..."
apt update -y
apt upgrade -y
success "System updated"

# Check if Docker is already running
if docker ps &>/dev/null; then
    success "Docker already running: $(docker --version)"
else
    log "Installing Docker..."
    # Fix broken packages
    apt --fix-broken install -y 2>/dev/null || true
    # Install docker.io
    apt install -y docker.io
    systemctl enable docker
    systemctl start docker
    # Wait for Docker to start
    sleep 3
    if docker ps &>/dev/null; then
        success "Docker installed: $(docker --version)"
    else
        error "Docker failed to start. Check: journalctl -xeu docker.service"
    fi
fi

# Install other dependencies
log "Installing dependencies..."
apt install -y git curl wget sqlite3 nginx certbot python3-certbot-nginx jq ufw
success "Dependencies installed"

# Install KIND
if ! command -v kind &> /dev/null; then
    log "Installing KIND..."
    curl -Lo /usr/local/bin/kind https://kind.sigs.k8s.io/dl/latest/kind-linux-amd64
    chmod +x /usr/local/bin/kind
fi
success "KIND installed: $(kind version)"

# Install kubectl
if ! command -v kubectl &> /dev/null; then
    log "Installing kubectl..."
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
    chmod +x kubectl
    mv kubectl /usr/local/bin/
fi
success "kubectl installed: $(kubectl version --client --short 2>/dev/null || kubectl version --client)"

# Install Node.js 20
if ! command -v node &> /dev/null; then
    log "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
success "Node.js installed: $(node -v)"

# =========================================
# PHASE 2: Application Setup
# =========================================
log "Phase 2: Application Setup"

# Create app directory if it doesn't exist
mkdir -p $APP_DIR
cd $APP_DIR

# Check if repo is cloned (look for package.json in backend)
if [ ! -f "backend/package.json" ]; then
    error "Repository not found in $APP_DIR. Please clone first:
    git clone https://github.com/SanduDS/KIND-CKAD.git $APP_DIR"
fi

mkdir -p data backups

# Create .env if not exists
if [ ! -f .env ]; then
    log "Creating environment file..."
    cat > .env << EOF
NODE_ENV=production
PORT=3001
DOMAIN=$DOMAIN
FRONTEND_URL=https://$DOMAIN
BACKEND_URL=https://$DOMAIN
JWT_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)
DATABASE_PATH=$APP_DIR/data/ckad.db
MAX_CONCURRENT_SESSIONS=4
SESSION_TTL_MINUTES=60
SESSION_EXTENSION_MINUTES=30
KIND_API_PORT_START=30000
KIND_INGRESS_PORT_START=40000
TERMINAL_MEMORY_LIMIT=512m
TERMINAL_CPU_LIMIT=0.5
EOF
    success "Environment file created"
else
    success "Environment file exists"
fi

# Build terminal image
log "Building terminal container..."
docker build -t ckad-terminal:latest -f docker/terminal/Dockerfile .
success "Terminal image built"

# Install backend
log "Installing backend..."
cd $APP_DIR/backend
npm install --production --legacy-peer-deps
success "Backend installed"

# Setup frontend
log "Building frontend..."
cd $APP_DIR/frontend
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=https://$DOMAIN/api
NEXT_PUBLIC_WS_URL=wss://$DOMAIN
EOF
npm install --legacy-peer-deps
npm run build

# Copy static files to standalone (REQUIRED for Next.js standalone mode)
log "Copying static files to standalone..."
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
if [ -d "public" ]; then
    cp -r public .next/standalone/public
fi
# Verify static files exist
if [ -d ".next/standalone/.next/static" ]; then
    success "Frontend built (static files copied)"
else
    error "Static files not copied correctly"
fi

# Seed database
log "Initializing database..."
cd $APP_DIR/backend
node src/db/seed.js
success "Database initialized"

# =========================================
# PHASE 3: Services Setup
# =========================================
log "Phase 3: Services Setup"

cd $APP_DIR

# Create systemd services
log "Creating systemd services..."

cat > /etc/systemd/system/ckad-backend.service << EOF
[Unit]
Description=CKAD Backend
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=$APP_DIR/backend
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/ckad-frontend.service << EOF
[Unit]
Description=CKAD Frontend
After=network.target ckad-backend.service

[Service]
Type=simple
WorkingDirectory=$APP_DIR/frontend/.next/standalone
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
success "Systemd services created"

# Configure Nginx
log "Configuring Nginx..."
cat > /etc/nginx/sites-available/ckad-platform << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    # Session start - long timeout for KIND creation
    location = /api/session/start {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Health
    location /healthz { proxy_pass http://127.0.0.1:3001; }
    location /readyz { proxy_pass http://127.0.0.1:3001; }

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/ckad-platform /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
success "Nginx configured"

# Get SSL certificate
log "Getting SSL certificate..."
mkdir -p /var/www/html

# Temp HTTP config for certbot
cat > /etc/nginx/sites-available/temp << EOF
server {
    listen 80;
    server_name $DOMAIN;
    root /var/www/html;
    location /.well-known/acme-challenge/ { allow all; }
}
EOF
ln -sf /etc/nginx/sites-available/temp /etc/nginx/sites-enabled/ckad-platform
nginx -t && systemctl reload nginx

certbot certonly --webroot -w /var/www/html -d $DOMAIN --non-interactive --agree-tos --email $EMAIL || warn "Certbot failed - may need manual setup"

# Restore real config
ln -sf /etc/nginx/sites-available/ckad-platform /etc/nginx/sites-enabled/ckad-platform
rm -f /etc/nginx/sites-available/temp
nginx -t && systemctl reload nginx
success "SSL configured"

# Start services
log "Starting services..."
systemctl enable ckad-backend ckad-frontend nginx
systemctl start ckad-backend
sleep 3
systemctl start ckad-frontend
systemctl reload nginx
success "Services started"

# Setup firewall
log "Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
success "Firewall configured"

# =========================================
# DONE
# =========================================
echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║            Deployment Complete! 🎉                ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
echo "URL: https://$DOMAIN"
echo ""
echo "Test Login:"
echo "  Email: test@ckad.com"
echo "  Password: test123"
echo ""
echo "Commands:"
echo "  Logs:    journalctl -u ckad-backend -f"
echo "  Status:  systemctl status ckad-backend ckad-frontend"
echo "  Restart: systemctl restart ckad-backend ckad-frontend"
echo ""

# Verify
echo "Verifying..."
sleep 2
curl -s http://localhost:3001/healthz | jq . || warn "Backend not responding yet"
