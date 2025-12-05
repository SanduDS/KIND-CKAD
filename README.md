# CKAD Practice Platform

🎯 A hands-on Kubernetes practice environment for CKAD certification preparation.

## Overview

This platform provides isolated, time-limited Kubernetes clusters for practicing CKAD (Certified Kubernetes Application Developer) exam tasks. Each user gets their own KIND cluster with a web-based terminal.

## Features

- 🔐 **Authentication**: Email OTP or Google OAuth
- ☸️ **Real Clusters**: Full Kubernetes cluster per session (KIND)
- 🖥️ **Web Terminal**: Browser-based kubectl access
- 📝 **Practice Tasks**: CKAD-style exercises with varying difficulty
- ⏱️ **Timed Sessions**: 60-minute sessions with extension option
- 🧹 **Auto-cleanup**: Sessions automatically destroyed after timeout

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Contabo VPS                       │
│                                                      │
│  ┌─────────────┐    ┌──────────────────────────┐   │
│  │   Nginx     │───▶│  Frontend (Next.js)       │   │
│  │  (Reverse   │    └──────────────────────────┘   │
│  │   Proxy)    │                                    │
│  │             │    ┌──────────────────────────┐   │
│  │             │───▶│  Backend (Node.js)        │   │
│  └─────────────┘    │  - REST API               │   │
│                     │  - WebSocket Terminal     │   │
│                     └──────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  KIND Clusters (per user session)             │   │
│  │  ┌─────────────┐  ┌─────────────┐            │   │
│  │  │ ckad-abc123 │  │ ckad-def456 │  ...       │   │
│  │  └─────────────┘  └─────────────┘            │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Ubuntu 22.04/24.04 VPS (8GB+ RAM recommended)
- Domain name (optional, for SSL)

### Installation

```bash
# 1. SSH to your server
ssh root@YOUR_SERVER_IP

# 2. Install dependencies
apt update && apt upgrade -y
apt install -y docker.io nodejs npm nginx git curl

# Install KIND
curl -Lo /usr/local/bin/kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x /usr/local/bin/kind

# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && mv kubectl /usr/local/bin/

# 3. Clone repository
git clone https://github.com/YOUR_USERNAME/ckad-platform.git /opt/ckad-platform
cd /opt/ckad-platform

# 4. Run setup
chmod +x scripts/*.sh
./scripts/setup-app.sh

# 5. Configure authentication (edit .env)
nano .env
```

### Configuration

Edit `/opt/ckad-platform/.env`:

```env
# For Email OTP login
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com

# For Google OAuth login
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

### SSL Setup (Optional)

```bash
./scripts/setup-ssl.sh yourdomain.com
```

## Usage

1. Open `http://YOUR_SERVER_IP` in browser
2. Login with email OTP or Google
3. Click "Start Practice Session"
4. Use the terminal to complete tasks
5. Session auto-ends after 60 minutes

## Project Structure

```
ckad-platform/
├── backend/           # Node.js API server
│   ├── src/
│   │   ├── api/       # REST endpoints
│   │   ├── services/  # KIND, terminal management
│   │   ├── models/    # Database models
│   │   └── websocket/ # Terminal WebSocket
│   └── Dockerfile
├── frontend/          # Next.js web app
│   ├── src/
│   │   ├── app/       # Pages
│   │   ├── components/# UI components
│   │   └── lib/       # API client, stores
│   └── Dockerfile
├── docker/
│   └── terminal/      # Terminal container image
├── scripts/           # Deployment scripts
├── nginx/             # Nginx config
└── docker-compose.yml
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/email/otp` | POST | Send OTP |
| `/api/auth/email/verify` | POST | Verify OTP |
| `/api/auth/google` | GET | Google OAuth |
| `/api/session/start` | POST | Start session |
| `/api/session/stop` | POST | End session |
| `/api/tasks` | GET | List tasks |
| `/ws/terminal` | WS | Terminal access |

## Resource Limits

| Server RAM | Max Concurrent Sessions |
|------------|------------------------|
| 8 GB | 2-3 |
| 16 GB | 5-6 |
| 32 GB | 8-10 |

## Management

```bash
# Check service status
systemctl status ckad-backend
systemctl status ckad-frontend

# View logs
tail -f /opt/ckad-platform/logs/backend.log

# Restart services
systemctl restart ckad-backend ckad-frontend

# Manual cleanup
./scripts/cleanup-orphans.sh
```

## Troubleshooting

### Session won't start

1. Check available memory: `free -h`
2. Check Docker: `docker info`
3. Check KIND: `kind get clusters`
4. View logs: `tail -f /opt/ckad-platform/logs/backend.log`

### Terminal disconnects

1. Check WebSocket in browser console
2. Verify Nginx WebSocket config
3. Check backend health: `curl localhost:3001/healthz`

## Security

- JWT authentication with refresh tokens
- Rate limiting on all endpoints
- Isolated KIND clusters per user
- Resource-limited terminal containers
- No host Docker socket access for users

## Contributing

1. Fork the repository
2. Create feature branch
3. Submit pull request

## License

MIT

## Credits

Built with:
- [KIND](https://kind.sigs.k8s.io/) - Kubernetes in Docker
- [Next.js](https://nextjs.org/) - React framework
- [xterm.js](https://xtermjs.org/) - Terminal emulator
- [Express](https://expressjs.com/) - Node.js framework



