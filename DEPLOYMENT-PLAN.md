# 🚀 CKAD Platform Deployment Plan

**Target Server:** Contabo VPS (4 vCPU, 8 GB RAM, 75 GB NVMe)  
**Server IP:** 173.212.204.27  
**Domain:** kind-k8s.duckdns.org  
**Estimated Time:** 2-3 hours total

---

## 📋 Phase 1: Infrastructure & Basic Deployment (45 min)

### Goal: Get the platform running on the VPS

#### Step 1.1: Server Preparation (10 min)

```bash
# SSH to server
ssh root@173.212.204.27

# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y docker.io docker-compose git curl wget sqlite3 nginx certbot python3-certbot-nginx

# Enable and start Docker
systemctl enable docker
systemctl start docker

# Install KIND
curl -Lo ./kind https://kind.sigs.k8s.io/dl/latest/kind-linux-amd64
chmod +x kind
mv kind /usr/local/bin/

# Install kubectl (for debugging)
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
mv kubectl /usr/local/bin/

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

#### Step 1.2: Clone & Configure Project (10 min)

```bash
# Create app directory
mkdir -p /opt/ckad-platform
cd /opt/ckad-platform

# Clone repository
git clone https://github.com/YOUR_USERNAME/Kind.git .

# Create data directory
mkdir -p data backups

# Create production environment file
cat > .env << 'EOF'
NODE_ENV=production
PORT=3001

# Domain
DOMAIN=kind-k8s.duckdns.org
FRONTEND_URL=https://kind-k8s.duckdns.org
BACKEND_URL=https://kind-k8s.duckdns.org

# JWT Secrets (CHANGE THESE!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-$(openssl rand -hex 32)
JWT_REFRESH_SECRET=your-refresh-secret-key-change-this-$(openssl rand -hex 32)

# Database
DATABASE_PATH=/opt/ckad-platform/data/ckad.db

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
GOOGLE_CALLBACK_URL=https://kind-k8s.duckdns.org/api/auth/google/callback

# Optional: Email (leave empty to use test login only)
EMAIL_PROVIDER=
SENDGRID_API_KEY=
EMAIL_FROM=
EOF

# Generate proper secrets
sed -i "s/your-super-secret-jwt-key-change-this-in-production-.*/$(openssl rand -hex 64)/" .env
sed -i "s/your-refresh-secret-key-change-this-.*/$(openssl rand -hex 64)/" .env
```

#### Step 1.3: Build & Deploy (20 min)

```bash
# Build terminal container image
docker build -t ckad-terminal:latest -f docker/terminal/Dockerfile .

# Install backend dependencies
cd backend
npm install --production
cd ..

# Install frontend dependencies and build
cd frontend
npm install

# Create frontend .env for build
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://kind-k8s.duckdns.org/api
NEXT_PUBLIC_WS_URL=wss://kind-k8s.duckdns.org
EOF

npm run build
cd ..

# Initialize database and seed tasks
cd backend
node src/db/seed.js
cd ..
```

#### Step 1.4: Quick Test (5 min)

```bash
# Test backend directly
cd /opt/ckad-platform/backend
node src/index.js &

# Test health endpoint
curl http://localhost:3001/healthz

# Stop test
pkill -f "node src/index.js"
```

### ✅ Phase 1 Checklist
- [ ] Docker installed and running
- [ ] KIND installed
- [ ] kubectl installed  
- [ ] Repository cloned
- [ ] .env configured
- [ ] Terminal image built
- [ ] Dependencies installed
- [ ] Database initialized
- [ ] Backend health check passes

---

## 📋 Phase 2: HTTPS & Production Setup (45 min)

### Goal: Secure the platform with HTTPS and systemd services

#### Step 2.1: Configure Nginx (10 min)

```bash
# Create Nginx config
cat > /etc/nginx/sites-available/ckad-platform << 'EOF'
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name kind-k8s.duckdns.org;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name kind-k8s.duckdns.org;

    # SSL will be configured by certbot
    # ssl_certificate /etc/letsencrypt/live/kind-k8s.duckdns.org/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/kind-k8s.duckdns.org/privkey.pem;

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

    # Health checks (no auth)
    location /healthz {
        proxy_pass http://127.0.0.1:3001;
    }

    location /readyz {
        proxy_pass http://127.0.0.1:3001;
    }

    # Frontend (Next.js)
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
EOF

# Enable site
ln -sf /etc/nginx/sites-available/ckad-platform /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test config
nginx -t
```

#### Step 2.2: Get SSL Certificate (5 min)

```bash
# Temporarily allow HTTP for certbot
cat > /etc/nginx/sites-available/ckad-platform-temp << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name kind-k8s.duckdns.org;
    root /var/www/html;
    location /.well-known/acme-challenge/ {
        allow all;
    }
}
EOF

ln -sf /etc/nginx/sites-available/ckad-platform-temp /etc/nginx/sites-enabled/ckad-platform
systemctl reload nginx

# Get certificate
certbot certonly --webroot -w /var/www/html -d kind-k8s.duckdns.org --non-interactive --agree-tos --email your-email@example.com

# Restore production config
ln -sf /etc/nginx/sites-available/ckad-platform /etc/nginx/sites-enabled/ckad-platform
rm /etc/nginx/sites-available/ckad-platform-temp

# Uncomment SSL lines in nginx config
sed -i 's/# ssl_certificate/ssl_certificate/' /etc/nginx/sites-available/ckad-platform

# Reload nginx
systemctl reload nginx
```

#### Step 2.3: Create Systemd Services (15 min)

```bash
# Backend service
cat > /etc/systemd/system/ckad-backend.service << 'EOF'
[Unit]
Description=CKAD Platform Backend
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ckad-platform/backend
Environment=NODE_ENV=production
EnvironmentFile=/opt/ckad-platform/.env
ExecStartPre=/opt/ckad-platform/scripts/cleanup-orphans.sh
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Frontend service
cat > /etc/systemd/system/ckad-frontend.service << 'EOF'
[Unit]
Description=CKAD Platform Frontend
After=network.target ckad-backend.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ckad-platform/frontend
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start services
systemctl daemon-reload
systemctl enable ckad-backend ckad-frontend
systemctl start ckad-backend
sleep 5
systemctl start ckad-frontend
```

#### Step 2.4: Verify Deployment (10 min)

```bash
# Check services
systemctl status ckad-backend
systemctl status ckad-frontend
systemctl status nginx

# Check logs
journalctl -u ckad-backend -n 50
journalctl -u ckad-frontend -n 50

# Test endpoints
curl -k https://kind-k8s.duckdns.org/healthz
curl -k https://kind-k8s.duckdns.org/api/status

# Test login page
curl -sI https://kind-k8s.duckdns.org/login | head -5
```

### ✅ Phase 2 Checklist
- [ ] Nginx configured
- [ ] SSL certificate obtained
- [ ] Systemd services created
- [ ] Backend running
- [ ] Frontend running
- [ ] HTTPS working
- [ ] Login page accessible

---

## 📋 Phase 3: Security Hardening & Monitoring (30 min)

### Goal: Production-ready security and observability

#### Step 3.1: Container Security (10 min)

```bash
# Update terminal service with security hardening
cat >> /opt/ckad-platform/backend/src/services/terminal.js.patch << 'EOF'
# Apply these flags to docker run command:
# --read-only
# --pids-limit=100
# --security-opt=no-new-privileges
# --cap-drop=ALL
EOF

# For now, add memory and CPU limits (already in code)
# The terminal.js already has --memory and --cpus flags
```

#### Step 3.2: Setup Backup Cron (5 min)

```bash
# Make backup script executable
chmod +x /opt/ckad-platform/scripts/backup.sh
chmod +x /opt/ckad-platform/scripts/cleanup-orphans.sh

# Add cron jobs
cat > /etc/cron.d/ckad-platform << 'EOF'
# Backup database every 6 hours
0 */6 * * * root /opt/ckad-platform/scripts/backup.sh >> /var/log/ckad-backup.log 2>&1

# Cleanup orphans every hour (backup to backend scheduler)
0 * * * * root /opt/ckad-platform/scripts/cleanup-orphans.sh >> /var/log/ckad-cleanup.log 2>&1
EOF

# Test backup
/opt/ckad-platform/scripts/backup.sh
ls -la /opt/ckad-platform/backups/
```

#### Step 3.3: Setup Firewall (5 min)

```bash
# Install UFW if not present
apt install -y ufw

# Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw --force enable
ufw status
```

#### Step 3.4: Setup Log Rotation (5 min)

```bash
# Create logrotate config
cat > /etc/logrotate.d/ckad-platform << 'EOF'
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
```

#### Step 3.5: Create Monitoring Script (5 min)

```bash
# Simple health monitoring script
cat > /opt/ckad-platform/scripts/monitor.sh << 'EOF'
#!/bin/bash
# Quick health check

echo "=== CKAD Platform Status ==="
echo ""

echo "📦 Services:"
systemctl is-active ckad-backend && echo "  ✅ Backend running" || echo "  ❌ Backend stopped"
systemctl is-active ckad-frontend && echo "  ✅ Frontend running" || echo "  ❌ Frontend stopped"
systemctl is-active nginx && echo "  ✅ Nginx running" || echo "  ❌ Nginx stopped"
systemctl is-active docker && echo "  ✅ Docker running" || echo "  ❌ Docker stopped"

echo ""
echo "🐳 Docker Resources:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "term-|NAME"
echo ""
echo "KIND Clusters:"
kind get clusters 2>/dev/null || echo "  None"

echo ""
echo "📊 System Resources:"
echo "  Memory: $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
echo "  Disk: $(df -h / | awk 'NR==2 {print $3 "/" $2}')"
echo "  Load: $(uptime | awk -F'load average:' '{print $2}')"

echo ""
echo "🔗 API Health:"
curl -s http://localhost:3001/healthz | jq -r '.status' 2>/dev/null || echo "  ❌ API not responding"
curl -s http://localhost:3001/api/status | jq -r '.capacity' 2>/dev/null || echo ""
EOF

chmod +x /opt/ckad-platform/scripts/monitor.sh
```

### ✅ Phase 3 Checklist
- [ ] Firewall configured (UFW)
- [ ] Backup cron jobs running
- [ ] Log rotation configured
- [ ] Monitoring script created
- [ ] First backup completed

---

## 🧪 Final Verification

```bash
# Run full verification
cd /opt/ckad-platform

# Check all services
./scripts/monitor.sh

# Test complete flow
echo ""
echo "=== Testing Login ==="
curl -s -X POST https://kind-k8s.duckdns.org/api/auth/test-login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@ckad.com","password":"test123"}' | jq '.success'

echo ""
echo "=== Browser Test ==="
echo "Open: https://kind-k8s.duckdns.org"
echo "Login: test@ckad.com / test123"
echo "Start a session and verify terminal works"
```

---

## 📌 Quick Reference

### Service Commands
```bash
# View logs
journalctl -u ckad-backend -f
journalctl -u ckad-frontend -f

# Restart services
systemctl restart ckad-backend ckad-frontend nginx

# Check status
./scripts/monitor.sh
```

### Emergency Recovery
```bash
# If sessions are stuck
./scripts/cleanup-orphans.sh

# If database is corrupted
# Restore from backup:
cp /opt/ckad-platform/backups/latest.db.gz /tmp/
gunzip /tmp/latest.db.gz
cp /tmp/latest.db /opt/ckad-platform/data/ckad.db
systemctl restart ckad-backend
```

### Update Deployment
```bash
cd /opt/ckad-platform
git pull
cd frontend && npm run build && cd ..
systemctl restart ckad-backend ckad-frontend
```

---

## 📅 Timeline Summary

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1: Infrastructure | 45 min | ⬜ Pending |
| Phase 2: HTTPS & Services | 45 min | ⬜ Pending |
| Phase 3: Security & Monitoring | 30 min | ⬜ Pending |
| **Total** | **~2 hours** | |

---

## 🎯 Success Criteria

1. ✅ https://kind-k8s.duckdns.org loads login page
2. ✅ Test login works (test@ckad.com / test123)
3. ✅ Session can be started
4. ✅ Terminal connects and kubectl works
5. ✅ Tasks are displayed
6. ✅ Session can be extended and stopped
7. ✅ Services auto-restart on reboot

