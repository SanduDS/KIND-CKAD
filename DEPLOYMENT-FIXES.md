# Deployment Fixes - Quick Guide

## Issues Fixed

1. ✅ **.env file** - Fixed mixed IPv6/domain URLs
2. ✅ **Frontend API URLs** - Now uses relative URLs (works with domain)
3. ✅ **Backend .env loading** - Multiple path fallbacks
4. ✅ **Login button** - Added error handling and console logs
5. ✅ **WebSocket URLs** - Uses relative URLs based on current domain

## Quick Deploy

### On Your Server:

```bash
cd /opt/ckad-platform

# Pull latest fixes
git pull

# Run fix script
chmod +x scripts/fix-env.sh scripts/deploy-fixes.sh
./scripts/deploy-fixes.sh
```

### Or Manual Steps:

```bash
# 1. Fix .env
./scripts/fix-env.sh

# 2. Pull code
git pull

# 3. Rebuild frontend
cd frontend
source ../.env
export NEXT_PUBLIC_API_URL
export NEXT_PUBLIC_WS_URL
npm run build
cp -r .next/static .next/standalone/.next/
cd ..

# 4. Restart services
systemctl restart ckad-backend ckad-frontend

# 5. Check logs
tail -f logs/backend.log
```

## Test Login

```
Email: test@ckad.com
Password: test123
```

## Verify

1. Open browser console (F12)
2. Go to http://kind-k8s.duckdns.org
3. Try login - check console for errors
4. Check network tab for API calls

## Troubleshooting

### Login button not working
- Check browser console for errors
- Verify backend is running: `systemctl status ckad-backend`
- Check backend logs: `tail -f logs/backend.log`

### API calls failing
- Verify .env has correct domain
- Check CORS in backend config
- Verify Nginx is proxying correctly

### WebSocket not connecting
- Check browser console
- Verify WebSocket URL is using same domain
- Check Nginx WebSocket config

