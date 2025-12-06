# Quick Start - Local Testing

Get the CKAD Platform running locally in 3 steps:

## 1. Setup Environment

```bash
# Copy environment template
cp backend/env.example .env

# Generate JWT secrets (optional - defaults work for testing)
openssl rand -hex 32  # Use for JWT_SECRET
openssl rand -hex 32  # Use for JWT_REFRESH_SECRET
```

## 2. Start Services

```bash
# Option A: Use the setup script (recommended)
chmod +x scripts/local-setup.sh
./scripts/local-setup.sh

# Option B: Manual start
docker-compose -f docker-compose.local.yml up -d --build
```

## 3. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/healthz

## Test Login

Use the test login endpoint (no email/Google OAuth needed):

```bash
curl -X POST http://localhost:3001/api/auth/test-login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

Or use the login page at http://localhost:3000 and click "Test Login".

## Useful Commands

```bash
# View logs
docker-compose -f docker-compose.local.yml logs -f

# Stop services
docker-compose -f docker-compose.local.yml down

# Restart after code changes
docker-compose -f docker-compose.local.yml up -d --build
```

For more details, see [LOCAL-SETUP.md](LOCAL-SETUP.md).

