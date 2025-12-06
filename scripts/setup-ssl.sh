#!/bin/bash
#
# Setup SSL with Let's Encrypt (Certbot)
#
# Usage: bash scripts/setup-ssl.sh yourdomain.com
#

set -e

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
    echo "Usage: bash scripts/setup-ssl.sh yourdomain.com"
    exit 1
fi

GREEN='\033[0;32m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Install certbot
log "Installing Certbot..."
apt install -y certbot python3-certbot-nginx

# Get certificate
log "Obtaining SSL certificate for $DOMAIN..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect

# Update Nginx config with domain
log "Updating Nginx configuration..."
sed -i "s/server_name _;/server_name $DOMAIN;/" /etc/nginx/sites-available/ckad-platform

# Reload Nginx
nginx -t && systemctl reload nginx

# Setup auto-renewal
log "Setting up auto-renewal..."
systemctl enable certbot.timer
systemctl start certbot.timer

# Update backend config
log "Updating backend configuration..."
sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=https://$DOMAIN|" /opt/ckad-platform/backend/.env
sed -i "s|GOOGLE_CALLBACK_URL=.*|GOOGLE_CALLBACK_URL=https://$DOMAIN/api/auth/google/callback|" /opt/ckad-platform/backend/.env

# Restart backend
systemctl restart ckad-platform

echo ""
echo "============================================"
echo -e "${GREEN}✅ SSL setup complete!${NC}"
echo "============================================"
echo ""
echo "Your site is now available at: https://$DOMAIN"
echo ""
echo "Certificate auto-renewal is configured."
echo "Test renewal with: certbot renew --dry-run"
echo ""

