#!/bin/bash
# Deploy all fixes to server

set -e

APP_DIR="/opt/ckad-platform"
DOMAIN="kind-k8s.duckdns.org"

cd $APP_DIR

echo "🔧 Applying fixes..."

# 1. Fix .env file
echo "📝 Fixing .env file..."
chmod +x scripts/fix-env.sh
./scripts/fix-env.sh

# 2. Pull latest code
echo "📥 Pulling latest code..."
git pull

# 3. Rebuild frontend with new env vars
echo "🎨 Rebuilding frontend..."
cd frontend
source $APP_DIR/.env
export NEXT_PUBLIC_API_URL
export NEXT_PUBLIC_WS_URL
npm run build
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
cd $APP_DIR

# 4. Restart services
echo "🔄 Restarting services..."
systemctl restart ckad-backend
sleep 2
systemctl restart ckad-frontend

# 5. Check status
echo ""
echo "✅ Fixes applied!"
echo ""
echo "📊 Service status:"
systemctl status ckad-backend --no-pager -l | head -5
systemctl status ckad-frontend --no-pager -l | head -5
echo ""
echo "🌐 Access at: http://${DOMAIN}"
echo ""
echo "🧪 Test login:"
echo "   Email: test@ckad.com"
echo "   Password: test123"

