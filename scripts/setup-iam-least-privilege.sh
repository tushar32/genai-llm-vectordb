#!/bin/bash

# IAM Least Privilege Setup Script for RAG API
# This script creates all necessary IAM roles and policies for least privilege access

set -e

# Configuration
PROJECT_NAME="rag-api"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="us-east-1"

echo "🚀 Setting up IAM Least Privilege Access for $PROJECT_NAME"
echo "Account ID: $ACCOUNT_ID"
echo "Region: $REGION"

# Function to create policy if it doesn't exist
create_policy_if_not_exists() {
    local policy_name=$1
    local policy_file=$2
    local description=$3
    
    echo "📋 Creating policy: $policy_name"
    
    # Check if policy exists
    if aws iam get-policy --policy-arn "arn:aws:iam::$ACCOUNT_ID:policy/$policy_name" >/dev/null 2>&1; then
        echo "   ✅ Policy $policy_name already exists"
        
        # Update policy version
        aws iam create-policy-version \
            --policy-arn "arn:aws:iam::$ACCOUNT_ID:policy/$policy_name" \
            --policy-document "file://$policy_file" \
            --set-as-default >/dev/null
        echo "   📝 Updated policy $policy_name to new version"
    else
        # Create new policy
        aws iam create-policy \
            --policy-name "$policy_name" \
            --policy-document "file://$policy_file" \
            --description "$description" >/dev/null
        echo "   ✅ Created policy $policy_name"
    fi
}

# Function to create role if it doesn't exist
create_role_if_not_exists() {
    local role_name=$1
    local trust_policy_file=$2
    local description=$3
    
    echo "👤 Creating role: $role_name"
    
    if aws iam get-role --role-name "$role_name" >/dev/null 2>&1; then
        echo "   ✅ Role $role_name already exists"
        
        # Update trust policy
        aws iam update-assume-role-policy \
            --role-name "$role_name" \
            --policy-document "file://$trust_policy_file" >/dev/null
        echo "   📝 Updated trust policy for $role_name"
    else
        # Create new role
        aws iam create-role \
            --role-name "$role_name" \
            --assume-role-policy-document "file://$trust_policy_file" \
            --description "$description" >/dev/null
        echo "   ✅ Created role $role_name"
    fi
}

# Function to attach policy to role
attach_policy_to_role() {
    local role_name=$1
    local policy_name=$2
    
    echo "🔗 Attaching policy $policy_name to role $role_name"
    
    aws iam attach-role-policy \
        --role-name "$role_name" \
        --policy-arn "arn:aws:iam::$ACCOUNT_ID:policy/$policy_name" >/dev/null
    echo "   ✅ Attached $policy_name to $role_name"
}

# Function to attach AWS managed policy to role
attach_aws_policy_to_role() {
    local role_name=$1
    local policy_arn=$2
    
    echo "🔗 Attaching AWS managed policy to role $role_name"
    
    aws iam attach-role-policy \
        --role-name "$role_name" \
        --policy-arn "$policy_arn" >/dev/null
    echo "   ✅ Attached AWS managed policy to $role_name"
}

# Step 1: Create Custom Policies
echo ""
echo "📋 Step 1: Creating Custom IAM Policies"
echo "========================================="

create_policy_if_not_exists \
    "$PROJECT_NAME-bedrock-access-policy" \
    "iam-policies/bedrock-policy.json" \
    "Bedrock access for RAG API"

create_policy_if_not_exists \
    "$PROJECT_NAME-lambda-execution-policy" \
    "iam-policies/lambda-execution-policy.json" \
    "Lambda execution permissions for RAG API"

create_policy_if_not_exists \
    "$PROJECT_NAME-rds-access-policy" \
    "iam-policies/rds-access-policy.json" \
    "RDS Proxy access for RAG API"

create_policy_if_not_exists \
    "$PROJECT_NAME-secrets-manager-policy" \
    "iam-policies/secrets-manager-policy.json" \
    "Secrets Manager access for RAG API"

create_policy_if_not_exists \
    "$PROJECT_NAME-deployment-user-policy" \
    "iam-policies/deployment-user-policy.json" \
    "Deployment permissions for RAG API CI/CD"

# Step 2: Create Lambda Execution Roles
echo ""
echo "👤 Step 2: Creating Lambda Execution Roles"
echo "==========================================="

create_role_if_not_exists \
    "$PROJECT_NAME-dev-lambda-role" \
    "trust-policies/lambda-trust-policy.json" \
    "Lambda execution role for RAG API development"

create_role_if_not_exists \
    "$PROJECT_NAME-staging-lambda-role" \
    "trust-policies/lambda-trust-policy.json" \
    "Lambda execution role for RAG API staging"

create_role_if_not_exists \
    "$PROJECT_NAME-production-lambda-role" \
    "trust-policies/lambda-trust-policy.json" \
    "Lambda execution role for RAG API production"

# Step 3: Attach Policies to Development Role
echo ""
echo "🔗 Step 3: Configuring Development Environment"
echo "=============================================="

attach_policy_to_role \
    "$PROJECT_NAME-dev-lambda-role" \
    "$PROJECT_NAME-lambda-execution-policy"

attach_policy_to_role \
    "$PROJECT_NAME-dev-lambda-role" \
    "$PROJECT_NAME-bedrock-access-policy"

# Step 4: Attach Policies to Staging Role
echo ""
echo "🔗 Step 4: Configuring Staging Environment"
echo "==========================================="

attach_policy_to_role \
    "$PROJECT_NAME-staging-lambda-role" \
    "$PROJECT_NAME-lambda-execution-policy"

attach_policy_to_role \
    "$PROJECT_NAME-staging-lambda-role" \
    "$PROJECT_NAME-bedrock-access-policy"

attach_policy_to_role \
    "$PROJECT_NAME-staging-lambda-role" \
    "$PROJECT_NAME-rds-access-policy"

attach_policy_to_role \
    "$PROJECT_NAME-staging-lambda-role" \
    "$PROJECT_NAME-secrets-manager-policy"

# Attach AWS managed VPC policy for staging
attach_aws_policy_to_role \
    "$PROJECT_NAME-staging-lambda-role" \
    "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"

# Step 5: Attach Policies to Production Role
echo ""
echo "🔗 Step 5: Configuring Production Environment"
echo "============================================="

attach_policy_to_role \
    "$PROJECT_NAME-production-lambda-role" \
    "$PROJECT_NAME-lambda-execution-policy"

attach_policy_to_role \
    "$PROJECT_NAME-production-lambda-role" \
    "$PROJECT_NAME-bedrock-access-policy"

attach_policy_to_role \
    "$PROJECT_NAME-production-lambda-role" \
    "$PROJECT_NAME-rds-access-policy"

attach_policy_to_role \
    "$PROJECT_NAME-production-lambda-role" \
    "$PROJECT_NAME-secrets-manager-policy"

# Attach AWS managed VPC policy for production
attach_aws_policy_to_role \
    "$PROJECT_NAME-production-lambda-role" \
    "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"

# Step 6: Create Deployment User
echo ""
echo "👥 Step 6: Creating Deployment User"
echo "===================================="

DEPLOYMENT_USER="$PROJECT_NAME-deployment-user"

if aws iam get-user --user-name "$DEPLOYMENT_USER" >/dev/null 2>&1; then
    echo "   ✅ Deployment user $DEPLOYMENT_USER already exists"
else
    aws iam create-user \
        --user-name "$DEPLOYMENT_USER" \
        --path "/service-accounts/" >/dev/null
    echo "   ✅ Created deployment user $DEPLOYMENT_USER"
fi

# Attach deployment policy to user
aws iam attach-user-policy \
    --user-name "$DEPLOYMENT_USER" \
    --policy-arn "arn:aws:iam::$ACCOUNT_ID:policy/$PROJECT_NAME-deployment-user-policy" >/dev/null
echo "   🔗 Attached deployment policy to user"

# Create access key for deployment user
echo "   🔑 Creating access key for deployment user..."
ACCESS_KEY_OUTPUT=$(aws iam create-access-key --user-name "$DEPLOYMENT_USER" 2>/dev/null || echo "exists")

if [ "$ACCESS_KEY_OUTPUT" != "exists" ]; then
    echo "   ✅ Created new access key"
    echo "   📝 Save these credentials securely:"
    echo "   Access Key ID: $(echo $ACCESS_KEY_OUTPUT | jq -r '.AccessKey.AccessKeyId')"
    echo "   Secret Access Key: $(echo $ACCESS_KEY_OUTPUT | jq -r '.AccessKey.SecretAccessKey')"
else
    echo "   ⚠️  Access key already exists for this user"
fi

# Step 7: Display Summary
echo ""
echo "✅ IAM Least Privilege Setup Complete!"
echo "======================================"
echo ""
echo "Created Roles:"
echo "  • $PROJECT_NAME-dev-lambda-role"
echo "  • $PROJECT_NAME-staging-lambda-role"
echo "  • $PROJECT_NAME-production-lambda-role"
echo ""
echo "Created Policies:"
echo "  • $PROJECT_NAME-bedrock-access-policy"
echo "  • $PROJECT_NAME-lambda-execution-policy"
echo "  • $PROJECT_NAME-rds-access-policy"
echo "  • $PROJECT_NAME-secrets-manager-policy"
echo "  • $PROJECT_NAME-deployment-user-policy"
echo ""
echo "Created Users:"
echo "  • $PROJECT_NAME-deployment-user"
echo ""
echo "Next Steps:"
echo "1. Update your serverless.yml to use the new roles"
echo "2. Update your CI/CD pipeline to use the deployment user credentials"
echo "3. Test deployment in development environment"
echo "4. Remove admin access from your original user"
echo ""
echo "Role ARNs for serverless.yml:"
echo "  dev: arn:aws:iam::$ACCOUNT_ID:role/$PROJECT_NAME-dev-lambda-role"
echo "  staging: arn:aws:iam::$ACCOUNT_ID:role/$PROJECT_NAME-staging-lambda-role"
echo "  production: arn:aws:iam::$ACCOUNT_ID:role/$PROJECT_NAME-production-lambda-role"
