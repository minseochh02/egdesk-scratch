#!/bin/bash

# Test script for coding project routing through tunnel
# This script demonstrates the complete request flow

echo "🧪 Testing Coding Project Routing"
echo "=================================="
echo ""

# Configuration
TUNNEL_SERVICE="https://tunneling-service.onrender.com"
TUNNEL_ID="your-tunnel-id"  # Replace with actual tunnel ID
PROJECT_NAME="my-nextjs-app"  # Replace with actual project name
AUTH_TOKEN="your-auth-token"  # Replace with actual Supabase auth token

echo "Configuration:"
echo "  Tunnel Service: $TUNNEL_SERVICE"
echo "  Tunnel ID: $TUNNEL_ID"
echo "  Project Name: $PROJECT_NAME"
echo ""

# Test 1: Simple GET request to project root
echo "Test 1: GET request to project root"
echo "  URL: $TUNNEL_SERVICE/t/$TUNNEL_ID/p/$PROJECT_NAME/"
curl -X GET \
  "$TUNNEL_SERVICE/t/$TUNNEL_ID/p/$PROJECT_NAME/" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Accept: application/json" \
  -w "\n  Status: %{http_code}\n" \
  -s

echo ""

# Test 2: GET request to API endpoint
echo "Test 2: GET request to API endpoint"
echo "  URL: $TUNNEL_SERVICE/t/$TUNNEL_ID/p/$PROJECT_NAME/api/users"
curl -X GET \
  "$TUNNEL_SERVICE/t/$TUNNEL_ID/p/$PROJECT_NAME/api/users" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Accept: application/json" \
  -w "\n  Status: %{http_code}\n" \
  -s

echo ""

# Test 3: POST request with body
echo "Test 3: POST request with JSON body"
echo "  URL: $TUNNEL_SERVICE/t/$TUNNEL_ID/p/$PROJECT_NAME/api/posts"
curl -X POST \
  "$TUNNEL_SERVICE/t/$TUNNEL_ID/p/$PROJECT_NAME/api/posts" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Post","body":"This is a test"}' \
  -w "\n  Status: %{http_code}\n" \
  -s

echo ""

# Test 4: Static asset request
echo "Test 4: Static asset request"
echo "  URL: $TUNNEL_SERVICE/t/$TUNNEL_ID/p/$PROJECT_NAME/_next/static/css/app.css"
curl -X GET \
  "$TUNNEL_SERVICE/t/$TUNNEL_ID/p/$PROJECT_NAME/_next/static/css/app.css" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -w "\n  Status: %{http_code}\n" \
  -s -o /dev/null

echo ""

# Test 5: Query parameters
echo "Test 5: GET request with query parameters"
echo "  URL: $TUNNEL_SERVICE/t/$TUNNEL_ID/p/$PROJECT_NAME/api/search?q=test&limit=10"
curl -X GET \
  "$TUNNEL_SERVICE/t/$TUNNEL_ID/p/$PROJECT_NAME/api/search?q=test&limit=10" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Accept: application/json" \
  -w "\n  Status: %{http_code}\n" \
  -s

echo ""
echo "=================================="
echo "✅ Tests completed"
echo ""
echo "Expected Flow:"
echo "  1. Request → Tunneling Service (main.py)"
echo "  2. Service logs: '🔀 Routing to coding project: $PROJECT_NAME → /api/users'"
echo "  3. Service → WebSocket → Tunnel Client (tunnel-client.ts)"
echo "  4. Client calls parseProjectRoute('/p/$PROJECT_NAME/api/users')"
echo "  5. Client calls handleProjectRequest() → routeRequest()"
echo "  6. Router looks up '$PROJECT_NAME' in ProjectRegistry"
echo "  7. Router proxies to localhost:PORT/api/users"
echo "  8. Response flows back: Dev Server → Client → WebSocket → Service → External"
