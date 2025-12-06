#!/bin/bash
#
# CKAD Platform Health Monitor
#

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║         CKAD Platform Status Dashboard            ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_service() {
    if systemctl is-active --quiet $1; then
        echo -e "  ${GREEN}✓${NC} $2"
    else
        echo -e "  ${RED}✗${NC} $2"
    fi
}

echo "📦 Services:"
check_service ckad-backend "Backend API"
check_service ckad-frontend "Frontend (Next.js)"
check_service nginx "Nginx Reverse Proxy"
check_service docker "Docker Engine"

echo ""
echo "🐳 Active Sessions:"
CLUSTERS=$(kind get clusters 2>/dev/null | grep "^ckad-" | wc -l)
CONTAINERS=$(docker ps --filter "name=term-ckad-" --format "{{.Names}}" 2>/dev/null | wc -l)
echo "  KIND Clusters: $CLUSTERS"
echo "  Terminal Containers: $CONTAINERS"

if [ $CLUSTERS -gt 0 ]; then
    echo ""
    echo "  Active clusters:"
    kind get clusters 2>/dev/null | grep "^ckad-" | while read cluster; do
        echo "    - $cluster"
    done
fi

echo ""
echo "📊 System Resources:"
echo "  Memory: $(free -h | awk '/^Mem:/ {print $3 "/" $2 " (" int($3/$2*100) "%)"}')"
echo "  Disk:   $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')"
echo "  Load:   $(uptime | awk -F'load average:' '{print $2}')"

echo ""
echo "🔗 API Status:"
HEALTH=$(curl -s http://localhost:3001/healthz 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✓${NC} API responding"
    
    STATUS=$(curl -s http://localhost:3001/api/status 2>/dev/null)
    if [ $? -eq 0 ]; then
        ACTIVE=$(echo $STATUS | jq -r '.capacity.activeSessions' 2>/dev/null)
        MAX=$(echo $STATUS | jq -r '.capacity.maxConcurrentSessions' 2>/dev/null)
        AVAILABLE=$(echo $STATUS | jq -r '.capacity.availableSlots' 2>/dev/null)
        echo "  Capacity: $ACTIVE/$MAX sessions ($AVAILABLE available)"
    fi
else
    echo -e "  ${RED}✗${NC} API not responding"
fi

echo ""
echo "📝 Recent Logs (last 5 lines):"
echo "  Backend:"
journalctl -u ckad-backend -n 5 --no-pager 2>/dev/null | sed 's/^/    /'

echo ""
echo "⏰ Last backup:"
LAST_BACKUP=$(ls -t /opt/ckad-platform/backups/*.gz 2>/dev/null | head -1)
if [ -n "$LAST_BACKUP" ]; then
    echo "  $(basename $LAST_BACKUP) - $(stat -c %y "$LAST_BACKUP" | cut -d. -f1)"
else
    echo "  No backups found"
fi

echo ""

