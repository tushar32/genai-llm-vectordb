#!/bin/bash

# Script to check RDS Proxy connectivity from external network
# Run this from your local machine or any external server

RDS_PROXY_ENDPOINT="rag-api-staging-proxy.proxy-cq9g6qc2s22h.us-east-1.rds.amazonaws.com"
PORT="5432"

echo "🔍 Testing RDS Proxy connectivity..."
echo "Endpoint: $RDS_PROXY_ENDPOINT"
echo "Port: $PORT"
echo ""

# Test basic network connectivity
echo "1. Testing network reachability..."
if timeout 10 bash -c "</dev/tcp/$RDS_PROXY_ENDPOINT/$PORT"; then
    echo "✅ Network connection successful"
else
    echo "❌ Network connection failed"
    echo "   This means the RDS Proxy is NOT publicly accessible"
    echo "   You need to either:"
    echo "   - Make RDS Proxy publicly accessible, OR"
    echo "   - Use a self-hosted runner in the same VPC"
    exit 1
fi

# Test PostgreSQL connectivity (requires psql)
echo ""
echo "2. Testing PostgreSQL protocol..."
if command -v psql &> /dev/null; then
    echo "Attempting PostgreSQL connection (will likely fail due to auth, but confirms protocol)..."
    timeout 5 psql -h $RDS_PROXY_ENDPOINT -p $PORT -U test -d test -c "SELECT 1;" 2>&1 | head -3
else
    echo "psql not found, skipping PostgreSQL protocol test"
fi

echo ""
echo "3. DNS Resolution..."
nslookup $RDS_PROXY_ENDPOINT

echo ""
echo "🏁 Connectivity test complete"
