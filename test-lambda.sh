#!/bin/bash

# Test the deployed Lambda function URL
# Replace with your actual Lambda function URL

LAMBDA_URL="https://txuxb62x7watf2buhzzbwucntm0yygvz.lambda-url.us-east-1.on.aws/"

echo "Testing Lambda function deployment..."

# Test 1: Basic health check
echo "1. Testing basic invocation:"
curl -X POST "$LAMBDA_URL" \
  -H "Content-Type: application/json" \
  -d '{"test": "hello"}' \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n\n"

# Test 2: Test database connection (if your handler supports it)
echo "2. Testing database connection:"
curl -X POST "$LAMBDA_URL" \
  -H "Content-Type: application/json" \
  -d '{"action": "test-db"}' \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n\n"

# Test 3: Test RAG query (if your handler supports it)
echo "3. Testing RAG query:"
curl -X POST "$LAMBDA_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is artificial intelligence?",
    "collection": "default"
  }' \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n\n"

echo "Test completed!"
