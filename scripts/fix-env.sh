#!/bin/bash
# Fix .env file with proper domain URLs

APP_DIR="/opt/ckad-platform"
DOMAIN="kind-k8s.duckdns.org"

cd $APP_DIR

# Backup existing .env
cp .env .env.backup

# Create corrected .env
cat > .env << EOF
# CKAD Practice Platform Configuration
# Updated: $(date)

# Server URLs (use domain, not IP)
FRONTEND_URL=http://${DOMAIN}
NEXT_PUBLIC_API_URL=http://${DOMAIN}
NEXT_PUBLIC_WS_URL=ws://${DOMAIN}

# JWT Secrets
JWT_SECRET=7172b14464445fa5354e9fb98af1f949e0145ecc4e51496c7993cf5dab89c122b5524d1144ff37f417c67c5906b05705a6f3ec2be80f796e2a0d78558f3b4bb8
JWT_REFRESH_SECRET=b246d8c9a85cb11ecf6885f4149c9280e176cfced736f871f36a540e414c0f78c86dce349a8d823dd58a82b722ee07acfc9fc9b7bc21c191ae04e2b794a69da5

# Google OAuth
GOOGLE_CLIENT_ID=245438798102-ffgiv61g2q0ad
GOOGLE_CLIENT_SECRET=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
GOOGLE_CALLBACK_URL=http://${DOMAIN}/api/auth/google/callback

# Email OTP
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_STESBwhA_3o
EMAIL_FROM=onboarding@resend.dev

# Session Configuration
SESSION_TTL_MINUTES=60
SESSION_EXTENSION_MINUTES=30
MAX_CONCURRENT_SESSIONS=3

# Database
DATABASE_PATH=/opt/ckad-platform/data/ckad.db
EOF

echo "✅ .env file updated with domain: ${DOMAIN}"
echo "📝 Restart services to apply changes:"
echo "   systemctl restart ckad-backend ckad-frontend"

