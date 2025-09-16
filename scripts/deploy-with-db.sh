#!/bin/bash

# Complete deployment script that deploys the application and sets up the database
# Usage: ./scripts/deploy-with-db.sh [stage]

STAGE=${1:-staging}

set -e  # Exit on any error

echo "Starting deployment to $STAGE..."

# Build and deploy the application
echo "Building and deploying application..."
npm run build
serverless deploy --stage $STAGE

# Set up database (migrations and seeds)
echo "Setting up database for $STAGE environment..."

if [ "$STAGE" = "staging" ]; then
    # Set environment variables for staging
    export NODE_ENV=staging
    export DB_HOST="rag-api-staging-proxy.proxy-cq9g6qc2s22h.us-east-1.rds.amazonaws.com"
    export DB_PORT="5432"
    export DB_NAME="rag-api-dev-db"
    export DB_USER="dev_rag"
    export DB_IAM_AUTH="true"
    export BEDROCK_MODEL_ID="anthropic.claude-3-sonnet-20240229-v1:0"
    
    echo "Running migrations for staging..."
    npm run migrate:latest
    
    echo "Running seeds for staging..."
    npm run seed:run
    
elif [ "$STAGE" = "dev" ]; then
    echo "For dev environment, run migrations locally with Docker:"
    echo "npm run db:up && npm run migrate:latest && npm run seed:run"
fi

echo "Deployment and database setup completed successfully!"
echo ""
echo "Next steps:"
echo "- Test your Lambda function"
echo "- Check CloudWatch logs if needed"
echo "- Verify database tables were created"
