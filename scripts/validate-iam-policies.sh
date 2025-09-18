#!/bin/bash

# IAM Policy Validation Script
# This script validates that the IAM policies work correctly

set -e

PROJECT_NAME="rag-api"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="us-east-1"

echo "🔍 Validating IAM Policies for $PROJECT_NAME"
echo "============================================="

# Function to test policy simulation
test_policy_simulation() {
    local role_name=$1
    local action=$2
    local resource=$3
    local description=$4
    
    echo "🧪 Testing: $description"
    echo "   Role: $role_name"
    echo "   Action: $action"
    echo "   Resource: $resource"
    
    result=$(aws iam simulate-principal-policy \
        --policy-source-arn "arn:aws:iam::$ACCOUNT_ID:role/$role_name" \
        --action-names "$action" \
        --resource-arns "$resource" \
        --query 'EvaluationResults[0].EvalDecision' \
        --output text 2>/dev/null || echo "ERROR")
    
    if [ "$result" = "allowed" ]; then
        echo "   ✅ ALLOWED"
    elif [ "$result" = "implicitDeny" ]; then
        echo "   ❌ DENIED (Implicit)"
    elif [ "$result" = "explicitDeny" ]; then
        echo "   ❌ DENIED (Explicit)"
    else
        echo "   ⚠️  ERROR: $result"
    fi
    echo ""
}

# Function to validate role exists
validate_role_exists() {
    local role_name=$1
    
    if aws iam get-role --role-name "$role_name" >/dev/null 2>&1; then
        echo "✅ Role $role_name exists"
        return 0
    else
        echo "❌ Role $role_name does not exist"
        return 1
    fi
}

# Function to validate policy exists
validate_policy_exists() {
    local policy_name=$1
    
    if aws iam get-policy --policy-arn "arn:aws:iam::$ACCOUNT_ID:policy/$policy_name" >/dev/null 2>&1; then
        echo "✅ Policy $policy_name exists"
        return 0
    else
        echo "❌ Policy $policy_name does not exist"
        return 1
    fi
}

echo ""
echo "📋 Step 1: Validating Roles and Policies Exist"
echo "==============================================="

# Validate roles
validate_role_exists "$PROJECT_NAME-dev-lambda-role"
validate_role_exists "$PROJECT_NAME-staging-lambda-role"
validate_role_exists "$PROJECT_NAME-production-lambda-role"

echo ""

# Validate policies
validate_policy_exists "$PROJECT_NAME-bedrock-access-policy"
validate_policy_exists "$PROJECT_NAME-lambda-execution-policy"
validate_policy_exists "$PROJECT_NAME-rds-access-policy"
validate_policy_exists "$PROJECT_NAME-secrets-manager-policy"

echo ""
echo "🧪 Step 2: Testing Development Environment Permissions"
echo "======================================================"

# Test Bedrock permissions
test_policy_simulation \
    "$PROJECT_NAME-dev-lambda-role" \
    "bedrock:InvokeModel" \
    "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0" \
    "Bedrock Claude model access"

test_policy_simulation \
    "$PROJECT_NAME-dev-lambda-role" \
    "bedrock:InvokeModel" \
    "arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v2:0" \
    "Bedrock Titan embedding model access"

# Test CloudWatch Logs permissions
test_policy_simulation \
    "$PROJECT_NAME-dev-lambda-role" \
    "logs:CreateLogGroup" \
    "arn:aws:logs:$REGION:$ACCOUNT_ID:log-group:/aws/lambda/rag-api-dev-api" \
    "CloudWatch Logs create log group"

test_policy_simulation \
    "$PROJECT_NAME-dev-lambda-role" \
    "logs:PutLogEvents" \
    "arn:aws:logs:$REGION:$ACCOUNT_ID:log-group:/aws/lambda/rag-api-dev-api:*" \
    "CloudWatch Logs put events"

# Test denied permissions (should fail)
test_policy_simulation \
    "$PROJECT_NAME-dev-lambda-role" \
    "s3:ListAllMyBuckets" \
    "*" \
    "S3 access (should be denied)"

echo ""
echo "🧪 Step 3: Testing Staging Environment Permissions"
echo "=================================================="

# Test RDS permissions
test_policy_simulation \
    "$PROJECT_NAME-staging-lambda-role" \
    "rds-db:connect" \
    "arn:aws:rds-db:$REGION:$ACCOUNT_ID:dbuser:prx-0123456789abcdef/staging_rag" \
    "RDS Proxy database connection"

# Test Secrets Manager permissions
test_policy_simulation \
    "$PROJECT_NAME-staging-lambda-role" \
    "secretsmanager:GetSecretValue" \
    "arn:aws:secretsmanager:$REGION:$ACCOUNT_ID:secret:rag-api/staging/database-abc123" \
    "Secrets Manager get secret value"

# Test VPC permissions
test_policy_simulation \
    "$PROJECT_NAME-staging-lambda-role" \
    "ec2:CreateNetworkInterface" \
    "*" \
    "VPC network interface creation"

echo ""
echo "🔍 Step 4: Checking Policy Attachments"
echo "======================================"

# Function to check policy attachments
check_policy_attachment() {
    local role_name=$1
    local policy_name=$2
    
    if aws iam list-attached-role-policies --role-name "$role_name" --query "AttachedPolicies[?PolicyName=='$policy_name']" --output text | grep -q "$policy_name"; then
        echo "✅ Policy $policy_name is attached to role $role_name"
    else
        echo "❌ Policy $policy_name is NOT attached to role $role_name"
    fi
}

# Check dev role attachments
echo "Development role attachments:"
check_policy_attachment "$PROJECT_NAME-dev-lambda-role" "$PROJECT_NAME-bedrock-access-policy"
check_policy_attachment "$PROJECT_NAME-dev-lambda-role" "$PROJECT_NAME-lambda-execution-policy"

echo ""
echo "Staging role attachments:"
check_policy_attachment "$PROJECT_NAME-staging-lambda-role" "$PROJECT_NAME-bedrock-access-policy"
check_policy_attachment "$PROJECT_NAME-staging-lambda-role" "$PROJECT_NAME-lambda-execution-policy"
check_policy_attachment "$PROJECT_NAME-staging-lambda-role" "$PROJECT_NAME-rds-access-policy"
check_policy_attachment "$PROJECT_NAME-staging-lambda-role" "$PROJECT_NAME-secrets-manager-policy"
check_policy_attachment "$PROJECT_NAME-staging-lambda-role" "AWSLambdaVPCAccessExecutionRole"

echo ""
echo "🔐 Step 5: Security Validation"
echo "=============================="

# Check for overly permissive policies
echo "Checking for wildcard resources in custom policies..."

for policy in "$PROJECT_NAME-bedrock-access-policy" "$PROJECT_NAME-lambda-execution-policy" "$PROJECT_NAME-rds-access-policy" "$PROJECT_NAME-secrets-manager-policy"; do
    echo "Analyzing policy: $policy"
    
    # Get policy document
    policy_version=$(aws iam get-policy --policy-arn "arn:aws:iam::$ACCOUNT_ID:policy/$policy" --query 'Policy.DefaultVersionId' --output text)
    policy_doc=$(aws iam get-policy-version --policy-arn "arn:aws:iam::$ACCOUNT_ID:policy/$policy" --version-id "$policy_version" --query 'PolicyVersion.Document')
    
    # Check for wildcards (basic check)
    wildcard_count=$(echo "$policy_doc" | grep -o '\*' | wc -l)
    if [ "$wildcard_count" -gt 5 ]; then
        echo "   ⚠️  Policy $policy contains $wildcard_count wildcards - review for least privilege"
    else
        echo "   ✅ Policy $policy appears to follow least privilege principles"
    fi
done

echo ""
echo "📊 Step 6: Generating Summary Report"
echo "===================================="

# Count total policies and roles
total_roles=$(aws iam list-roles --query "Roles[?starts_with(RoleName, '$PROJECT_NAME-')]" --output text | wc -l)
total_policies=$(aws iam list-policies --scope Local --query "Policies[?starts_with(PolicyName, '$PROJECT_NAME-')]" --output text | wc -l)

echo "Summary:"
echo "  • Total custom roles created: $total_roles"
echo "  • Total custom policies created: $total_policies"
echo "  • Environments configured: dev, staging, production"
echo ""

# Check if deployment user exists
if aws iam get-user --user-name "$PROJECT_NAME-deployment-user" >/dev/null 2>&1; then
    echo "✅ Deployment user exists and is ready for CI/CD"
else
    echo "⚠️  Deployment user not found - run setup script to create"
fi

echo ""
echo "🎯 Validation Complete!"
echo "======================"
echo ""
echo "Next steps:"
echo "1. If all tests passed, update your serverless.yml to use the new roles"
echo "2. Test deployment in development environment"
echo "3. Monitor CloudTrail logs for any permission issues"
echo "4. Remove admin access from your original user once everything works"
echo ""
echo "To monitor ongoing access patterns:"
echo "  aws logs filter-log-events --log-group-name CloudTrail/APILogs --start-time \$(date -d '1 hour ago' +%s)000"
