#!/bin/bash
#
# CKAD Practice Platform - Server Setup Script
# Run this on a fresh Contabo VPS (Ubuntu 22.04/24.04)
#
# Usage: curl -sSL https://raw.githubusercontent.com/YOUR_REPO/scripts/deploy.sh | bash
#        OR: bash deploy.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root (sudo bash deploy.sh)"
fi

log "🚀 Starting CKAD Practice Platform deployment..."

# ============================================
# 1. System Update
# ============================================
log "📦 Updating system packages..."
apt update && apt upgrade -y

# ============================================
# 2. Install Docker
# ============================================
log "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
    apt install -y apt-transport-https ca-certificates curl software-properties-common
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    log "✅ Docker installed successfully"
else
    log "✅ Docker already installed"
fi

# ============================================
# 3. Install KIND
# ============================================
log "☸️ Installing KIND..."
if ! command -v kind &> /dev/null; then
    curl -Lo /usr/local/bin/kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
    chmod +x /usr/local/bin/kind
    log "✅ KIND installed successfully"
else
    log "✅ KIND already installed"
fi

# ============================================
# 4. Install kubectl
# ============================================
log "☸️ Installing kubectl..."
if ! command -v kubectl &> /dev/null; then
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
    chmod +x kubectl
    mv kubectl /usr/local/bin/
    log "✅ kubectl installed successfully"
else
    log "✅ kubectl already installed"
fi

# ============================================
# 5. Install Node.js 20
# ============================================
log "📗 Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    log "✅ Node.js installed successfully"
else
    log "✅ Node.js already installed: $(node --version)"
fi

# ============================================
# 6. Install additional tools
# ============================================
log "🔧 Installing additional tools..."
apt install -y git curl wget htop vim nano jq unzip

# ============================================
# 7. Create application directory
# ============================================
log "📁 Setting up application directory..."
APP_DIR="/opt/ckad-platform"
mkdir -p $APP_DIR
mkdir -p $APP_DIR/data
mkdir -p $APP_DIR/logs
mkdir -p /tmp/kind-configs

# ============================================
# 8. Configure firewall
# ============================================
log "🔥 Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp    # SSH
    ufw allow 80/tcp    # HTTP
    ufw allow 443/tcp   # HTTPS
    ufw allow 3001/tcp  # Backend API (dev only)
    ufw --force enable
    log "✅ Firewall configured"
fi

# ============================================
# 9. Configure system limits
# ============================================
log "⚙️ Configuring system limits..."
cat >> /etc/sysctl.conf << 'EOF'
# CKAD Platform optimizations
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
vm.max_map_count = 262144
fs.file-max = 2097152
EOF
sysctl -p

# Increase file descriptor limits
cat >> /etc/security/limits.conf << 'EOF'
* soft nofile 65535
* hard nofile 65535
root soft nofile 65535
root hard nofile 65535
EOF

# ============================================
# 10. Create swap (if not exists)
# ============================================
log "💾 Checking swap..."
if [ ! -f /swapfile ]; then
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    log "✅ 4GB swap created"
else
    log "✅ Swap already exists"
fi

# ============================================
# Summary
# ============================================
echo ""
echo "============================================"
echo -e "${GREEN}✅ Server setup complete!${NC}"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. Clone your repository:"
echo "   cd /opt/ckad-platform"
echo "   git clone <your-repo-url> ."
echo ""
echo "2. Configure environment:"
echo "   cp backend/env.example backend/.env"
echo "   nano backend/.env"
echo ""
echo "3. Generate JWT secrets:"
echo "   openssl rand -hex 64"
echo ""
echo "4. Build and start services:"
echo "   docker compose build"
echo "   docker compose up -d"
echo ""
echo "============================================"

