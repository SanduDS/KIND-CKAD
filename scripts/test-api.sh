#!/bin/bash
# Test API endpoints

echo "🧪 Testing API endpoints..."

BASE_URL="http://localhost:3001"

# Test health
echo ""
echo "1. Health check:"
curl -s "${BASE_URL}/healthz" | jq . || echo "Failed"

# Test login (get token)
echo ""
echo "2. Test login:"
TOKEN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/test-login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@ckad.com","password":"test123"}')

echo "$TOKEN_RESPONSE" | jq . || echo "$TOKEN_RESPONSE"

# Extract token
TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.accessToken // empty')

if [ -z "$TOKEN" ]; then
    echo "❌ Failed to get token"
    exit 1
fi

echo ""
echo "✅ Got token: ${TOKEN:0:20}..."

# Test session status
echo ""
echo "3. Session status:"
curl -s "${BASE_URL}/api/session/status" \
  -H "Authorization: Bearer ${TOKEN}" | jq . || echo "Failed"

# Test session start
echo ""
echo "4. Starting session (this may take 60s)..."
curl -s -X POST "${BASE_URL}/api/session/start" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq . || echo "Failed"

echo ""
echo "✅ API tests complete"

