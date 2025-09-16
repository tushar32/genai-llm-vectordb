#!/bin/bash

# Database setup script for staging environment
# This script runs migrations and seeds for the staging database

set -e  # Exit on any error

echo "Setting up staging database..."

# Set environment variables for staging
export NODE_ENV=staging
export DB_HOST="rag-api-staging-proxy.proxy-cq9g6qc2s22h.us-east-1.rds.amazonaws.com"
export DB_PORT="5432"
export DB_NAME="rag-api-dev-db"
export DB_USER="dev_rag"
export DB_IAM_AUTH="true"
export BEDROCK_MODEL_ID="anthropic.claude-3-sonnet-20240229-v1:0"

echo "Running migrations..."
npm run migrate:latest

echo "Checking migration status..."
npm run migrate:status

echo "Running seeds..."
npm run seed:run

echo "Database setup completed successfully!"
