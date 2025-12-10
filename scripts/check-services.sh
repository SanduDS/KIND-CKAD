#!/bin/bash
#
# Quick service health check script
#

echo "=== CKAD Platform Service Status ==="
echo ""

# Check backend
echo "📦 Backend (port 3001):"
if systemctl is-active --quiet ckad-backend; then
    echo "  ✅ Service: Running"
    if curl -s http://localhost:3001/healthz > /dev/null 2>&1; then
        echo "  ✅ API: Responding"
        curl -s http://localhost:3001/healthz | jq . 2>/dev/null || echo "  ⚠️  Response not JSON"
    else
        echo "  ❌ API: Not responding"
    fi
else
    echo "  ❌ Service: Not running"
fi

# Check frontend
echo ""
echo "🎨 Frontend (port 3000):"
if systemctl is-active --quiet ckad-frontend; then
    echo "  ✅ Service: Running"
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "  ✅ Server: Responding"
    else
        echo "  ❌ Server: Not responding"
    fi
else
    echo "  ❌ Service: Not running"
fi

# Check Nginx
echo ""
echo "🌐 Nginx:"
if systemctl is-active --quiet nginx; then
    echo "  ✅ Service: Running"
    nginx -t 2>&1 | grep -q "successful" && echo "  ✅ Config: Valid" || echo "  ❌ Config: Invalid"
else
    echo "  ❌ Service: Not running"
fi

# Check Docker
echo ""
echo "🐳 Docker:"
if systemctl is-active --quiet docker; then
    echo "  ✅ Service: Running"
    docker ps > /dev/null 2>&1 && echo "  ✅ Daemon: Accessible" || echo "  ❌ Daemon: Not accessible"
else
    echo "  ❌ Service: Not running"
fi

# Check ports
echo ""
echo "🔌 Port Status:"
netstat -tlnp 2>/dev/null | grep -E ":(3000|3001)" | awk '{print "  " $4 " -> " $7}' || ss -tlnp 2>/dev/null | grep -E ":(3000|3001)" | awk '{print "  " $4 " -> " $6}'

# Recent logs
echo ""
echo "📝 Recent Backend Logs (last 5 lines):"
journalctl -u ckad-backend -n 5 --no-pager 2>/dev/null | tail -5 | sed 's/^/  /'

echo ""
echo "📝 Recent Frontend Logs (last 5 lines):"
journalctl -u ckad-frontend -n 5 --no-pager 2>/dev/null | tail -5 | sed 's/^/  /'

echo ""


