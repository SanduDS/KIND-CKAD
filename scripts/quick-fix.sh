#!/bin/bash
# Quick fix for JSON error and cleanup

APP_DIR="/opt/ckad-platform"

cd $APP_DIR

echo "🔧 Quick fixes..."

# 1. Cleanup orphaned KIND cluster
echo "🧹 Cleaning up orphaned clusters..."
chmod +x scripts/cleanup-sessions.sh
./scripts/cleanup-sessions.sh

# 2. Update Nginx config
echo "🌐 Updating Nginx config..."
cat > /etc/nginx/sites-available/ckad-platform << 'EOF'
# CKAD Practice Platform Nginx Config
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=1r/s;

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
    server_name kind-k8s.duckdns.org _;

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
    location ~ ^/(healthz|readyz)$ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Auth routes (rate limited)
    location /api/auth/ {
        limit_req zone=auth burst=5 nodelay;
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Accept application/json;
        proxy_set_header Content-Type application/json;
    }

    # API routes
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Accept application/json;
        proxy_set_header Content-Type application/json;
    }

    # WebSocket for terminal
    location /ws/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

# 3. Test and reload Nginx
nginx -t && systemctl reload nginx
echo "✅ Nginx updated"

# 4. Check backend is running
echo "🔍 Checking backend..."
if ! systemctl is-active --quiet ckad-backend; then
    echo "⚠️  Backend not running, starting..."
    systemctl start ckad-backend
    sleep 3
fi

# 5. Test API endpoint
echo "🧪 Testing API..."
curl -s http://localhost:3001/api/auth/test-login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@ckad.com","password":"test123"}' | head -20

echo ""
echo "✅ Quick fix complete!"
echo "🌐 Try login at: http://kind-k8s.duckdns.org"

