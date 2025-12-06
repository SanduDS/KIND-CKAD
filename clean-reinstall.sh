#!/bin/bash
# Full Clean Reinstall - Run this on your production server

set -e  # Exit on error

APP_DIR="/opt/ckad-platform"

echo "╔═══════════════════════════════════════════════════╗"
echo "║     CKAD Platform - Clean Reinstall               ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

cd $APP_DIR

# Stop services
echo "▸ Stopping services..."
systemctl stop ckad-backend || true
systemctl stop ckad-frontend || true
echo "✓ Services stopped"
echo ""

# Delete old database
echo "▸ Deleting old database..."
rm -f data/ckad.db data/ckad.db-shm data/ckad.db-wal
echo "✓ Old database deleted"
echo ""

# Pull latest code
echo "▸ Pulling latest code..."
git checkout -- .
git pull
echo "✓ Code updated"
echo ""

# Rebuild terminal Docker image
echo "▸ Rebuilding terminal Docker image..."
docker build -t ckad-terminal:latest -f docker/terminal/Dockerfile .
echo "✓ Terminal image rebuilt"
echo ""

# Reinstall backend
echo "▸ Installing backend dependencies..."
cd backend
npm install --legacy-peer-deps
cd ..
echo "✓ Backend dependencies installed"
echo ""

# Rebuild frontend
echo "▸ Rebuilding frontend..."
cd frontend
npm install --legacy-peer-deps
rm -rf .next
npm run build

echo "▸ Copying static files..."
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/
[ -d "public" ] && cp -r public .next/standalone/ || true
cd ..
echo "✓ Frontend rebuilt"
echo ""

# Initialize fresh database
echo "▸ Initializing fresh database..."
cd backend
node src/db/seed.js
cd ..
echo "✓ Database initialized"
echo ""

# Verify database has tasks
TASK_COUNT=$(sqlite3 data/ckad.db "SELECT COUNT(*) FROM tasks;" 2>/dev/null || echo "0")
if [ "$TASK_COUNT" -lt 20 ]; then
  echo "✗ Error: Only $TASK_COUNT tasks in database (need 20)"
  exit 1
fi
echo "✓ Database has $TASK_COUNT tasks"
echo ""

# Start services
echo "▸ Starting services..."
systemctl start ckad-backend
systemctl start ckad-frontend
sleep 3
echo "✓ Services started"
echo ""

# Verify
echo "▸ Verifying..."
systemctl is-active --quiet ckad-backend && echo "✓ Backend running" || echo "✗ Backend failed"
systemctl is-active --quiet ckad-frontend && echo "✓ Frontend running" || echo "✗ Frontend failed"

TASK_COUNT=$(sqlite3 data/ckad.db "SELECT COUNT(*) FROM tasks;" 2>/dev/null || echo "0")
echo "✓ Database has $TASK_COUNT tasks"
echo ""

echo "╔═══════════════════════════════════════════════════╗"
echo "║     Installation Complete!                        ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
echo "Visit: https://kind-k8s.duckdns.org"
echo "Logs: journalctl -u ckad-backend -f"
echo ""
