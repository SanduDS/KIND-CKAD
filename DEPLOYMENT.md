# CKAD Practice Platform - Contabo Deployment Guide

## Prerequisites

- Contabo VPS with Ubuntu 22.04 or 24.04
- At least 8GB RAM, 4 vCPU recommended
- Root SSH access
- (Optional) Domain name pointing to server IP

## Quick Deployment Steps

### Step 1: SSH to Your Server

```bash
ssh root@YOUR_SERVER_IP
```

### Step 2: Download and Run Setup Script

```bash
# Download the deploy script
curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/scripts/deploy.sh -o deploy.sh

# Make executable and run
chmod +x deploy.sh
./deploy.sh
```

This installs: Docker, KIND, kubectl, Node.js 20, and configures the server.

### Step 3: Clone Your Repository

```bash
cd /opt/ckad-platform
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .
```

### Step 4: Run Application Setup

```bash
chmod +x scripts/*.sh
./scripts/setup-app.sh
```

This will:
- Generate JWT secrets
- Build the terminal Docker image
- Install dependencies
- Setup systemd service
- Configure Nginx
- Start the application

### Step 5: Configure Environment (Important!)

Edit the backend configuration:

```bash
nano /opt/ckad-platform/backend/.env
```

Update these values:

```env
# Your server's public IP or domain
FRONTEND_URL=http://YOUR_SERVER_IP

# Google OAuth (get from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://YOUR_SERVER_IP/api/auth/google/callback

# Email OTP (get from resend.com)
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
```

Then restart:

```bash
systemctl restart ckad-platform
```

### Step 6: (Optional) Setup SSL with Domain

If you have a domain pointing to your server:

```bash
./scripts/setup-ssl.sh yourdomain.com
```

## Verification

### Check Service Status

```bash
systemctl status ckad-platform
```

### Check Health Endpoint

```bash
curl http://localhost:3001/healthz
# Should return: {"status":"ok",...}
```

### Check Platform Status

```bash
curl http://localhost:3001/api/status
```

### View Logs

```bash
# Application logs
tail -f /opt/ckad-platform/logs/backend.log

# Error logs
tail -f /opt/ckad-platform/logs/backend-error.log

# Nginx logs
tail -f /var/log/nginx/access.log
```

## Management Commands

| Command | Description |
|---------|-------------|
| `systemctl status ckad-platform` | Check service status |
| `systemctl restart ckad-platform` | Restart backend |
| `systemctl stop ckad-platform` | Stop backend |
| `journalctl -u ckad-platform -f` | View service logs |
| `kind get clusters` | List active KIND clusters |
| `docker ps` | List running containers |

## Testing the API

### Send OTP (Email Auth)

```bash
curl -X POST http://YOUR_SERVER_IP/api/auth/email/otp \
  -H "Content-Type: application/json" \
  -d '{"email": "your@email.com"}'
```

### Check Platform Status

```bash
curl http://YOUR_SERVER_IP/api/status
```

## Troubleshooting

### Backend won't start

1. Check logs: `tail -f /opt/ckad-platform/logs/backend-error.log`
2. Verify Docker is running: `systemctl status docker`
3. Check port availability: `netstat -tlnp | grep 3001`

### KIND cluster creation fails

1. Check Docker: `docker info`
2. Check KIND: `kind --version`
3. Check available memory: `free -h`
4. Manual test: `kind create cluster --name test && kind delete cluster --name test`

### WebSocket connection fails

1. Check Nginx config: `nginx -t`
2. Verify WebSocket route in Nginx
3. Check firewall: `ufw status`

### Database issues

1. Check file permissions: `ls -la /opt/ckad-platform/data/`
2. Verify SQLite: `sqlite3 /opt/ckad-platform/data/ckad.db ".tables"`

## Backup & Restore

### Manual Backup

```bash
./scripts/backup.sh
```

### Setup Automatic Backups

```bash
# Add to crontab (every 6 hours)
crontab -e
# Add line:
0 */6 * * * /opt/ckad-platform/scripts/backup.sh
```

### Restore from Backup

```bash
gunzip /opt/ckad-platform/backups/ckad_backup_XXXXXX.db.gz
cp /opt/ckad-platform/backups/ckad_backup_XXXXXX.db /opt/ckad-platform/data/ckad.db
systemctl restart ckad-platform
```

## Security Checklist

- [ ] Change default SSH port (optional)
- [ ] Setup fail2ban: `apt install fail2ban`
- [ ] Configure firewall (done by setup script)
- [ ] Use strong JWT secrets (generated automatically)
- [ ] Setup SSL with domain
- [ ] Regular backups enabled

## Resource Monitoring

```bash
# CPU and Memory
htop

# Disk usage
df -h

# Docker resources
docker stats

# KIND clusters
kind get clusters
```

## Scaling Considerations

| Server RAM | Max Concurrent Sessions |
|------------|------------------------|
| 8 GB | 2-3 sessions |
| 16 GB | 5-6 sessions |
| 32 GB | 8-10 sessions |

**Your Server (8GB)**: Set `MAX_CONCURRENT_SESSIONS=3` for stability.

Adjust in `.env` if you upgrade your server.

