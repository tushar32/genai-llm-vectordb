# IAM Least Privilege Access Guide for GenAI LLM Vector DB

## Table of Contents
1. [Overview](#overview)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Least Privilege Principles](#least-privilege-principles)
4. [Service-Specific IAM Policies](#service-specific-iam-policies)
5. [Environment-Specific Roles](#environment-specific-roles)
6. [Implementation Steps](#implementation-steps)
7. [Policy Testing & Validation](#policy-testing--validation)
8. [Monitoring & Auditing](#monitoring--auditing)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

## Overview

This guide provides a comprehensive approach to implementing least privilege access for your GenAI LLM Vector DB project, replacing the current admin access with granular, service-specific permissions.

### Current State
- **Problem**: Using IAM user with `AdministratorAccess` policy
- **Risk**: Excessive permissions, potential security vulnerabilities
- **Goal**: Implement least privilege access with role-based permissions

### Target Architecture
- Environment-specific IAM roles (dev, staging, production)
- Service-specific policies for each AWS service
- Automated policy validation and monitoring

## Current Architecture Analysis

Based on your project structure, you're using the following AWS services:

### Core Services
1. **AWS Lambda** - API handler function
2. **Amazon Bedrock** - LLM and embedding models
3. **Amazon RDS** - PostgreSQL with pgVector
4. **RDS Proxy** - Database connection pooling
5. **VPC** - Network isolation for staging/production
6. **Secrets Manager** - Database credentials (implied)

### Deployment Tools
- **Serverless Framework** - Infrastructure as Code
- **CloudFormation** - AWS resource provisioning

## Least Privilege Principles

### 1. Principle of Least Privilege (PoLP)
- Grant only the minimum permissions required
- Use specific resource ARNs instead of wildcards
- Implement time-based access where applicable

### 2. Defense in Depth
- Multiple layers of security controls
- Resource-level permissions
- Network-level restrictions

### 3. Regular Access Reviews
- Periodic permission audits
- Automated compliance checks
- Access pattern monitoring

## Service-Specific IAM Policies

### 1. Lambda Execution Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/lambda/rag-api-*"
    },
    {
      "Sid": "VPCAccess",
      "Effect": "Allow",
      "Action": [
        "ec2:CreateNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DeleteNetworkInterface",
        "ec2:AttachNetworkInterface",
        "ec2:DetachNetworkInterface"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "ec2:Region": ["us-east-1", "us-west-2"]
        }
      }
    }
  ]
}
```

### 2. Bedrock Access Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockModelAccess",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0",
        "arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v2:0",
        "arn:aws:bedrock:*::foundation-model/cohere.embed-english-v3"
      ]
    },
    {
      "Sid": "BedrockModelList",
      "Effect": "Allow",
      "Action": [
        "bedrock:ListFoundationModels"
      ],
      "Resource": "*"
    }
  ]
}
```

### 3. RDS and RDS Proxy Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RDSProxyConnect",
      "Effect": "Allow",
      "Action": [
        "rds-db:connect"
      ],
      "Resource": [
        "arn:aws:rds-db:us-east-1:ACCOUNT-ID:dbuser:prx-*/dev_rag",
        "arn:aws:rds-db:us-east-1:ACCOUNT-ID:dbuser:prx-*/staging_rag",
        "arn:aws:rds-db:us-east-1:ACCOUNT-ID:dbuser:prx-*/prod_rag"
      ]
    },
    {
      "Sid": "RDSDescribe",
      "Effect": "Allow",
      "Action": [
        "rds:DescribeDBProxies",
        "rds:DescribeDBProxyTargets"
      ],
      "Resource": [
        "arn:aws:rds:us-east-1:ACCOUNT-ID:db-proxy:rag-api-*-proxy"
      ]
    }
  ]
}
```

### 4. Secrets Manager Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SecretsManagerAccess",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:ACCOUNT-ID:secret:rag-api/*/database-*",
        "arn:aws:secretsmanager:us-east-1:ACCOUNT-ID:secret:rag-api/*/openai-*"
      ]
    }
  ]
}
```

## Environment-Specific Roles

### Development Environment Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AssumeRolePolicy",
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

**Attached Policies:**
- `rag-api-lambda-execution-policy`
- `rag-api-bedrock-access-policy`
- `AWSLambdaVPCAccessExecutionRole` (AWS managed - only for staging/prod)

### Staging Environment Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AssumeRolePolicy",
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

**Attached Policies:**
- `rag-api-lambda-execution-policy`
- `rag-api-bedrock-access-policy`
- `rag-api-rds-access-policy`
- `rag-api-secrets-manager-policy`
- `AWSLambdaVPCAccessExecutionRole` (AWS managed)

### Production Environment Role

Same as staging but with production-specific resource ARNs and additional monitoring permissions.

## Implementation Steps

### Step 1: Create Custom IAM Policies

1. **Create Bedrock Policy**
```bash
aws iam create-policy \
  --policy-name rag-api-bedrock-access-policy \
  --policy-document file://policies/bedrock-policy.json \
  --description "Bedrock access for RAG API"
```

2. **Create RDS Policy**
```bash
aws iam create-policy \
  --policy-name rag-api-rds-access-policy \
  --policy-document file://policies/rds-policy.json \
  --description "RDS Proxy access for RAG API"
```

3. **Create Lambda Execution Policy**
```bash
aws iam create-policy \
  --policy-name rag-api-lambda-execution-policy \
  --policy-document file://policies/lambda-policy.json \
  --description "Lambda execution permissions for RAG API"
```

### Step 2: Create Environment-Specific Roles

1. **Development Role**
```bash
aws iam create-role \
  --role-name rag-api-dev-lambda-role \
  --assume-role-policy-document file://trust-policies/lambda-trust-policy.json \
  --description "Lambda execution role for RAG API development"
```

2. **Staging Role**
```bash
aws iam create-role \
  --role-name rag-api-staging-lambda-role \
  --assume-role-policy-document file://trust-policies/lambda-trust-policy.json \
  --description "Lambda execution role for RAG API staging"
```

### Step 3: Attach Policies to Roles

1. **Development Environment**
```bash
# Attach custom policies
aws iam attach-role-policy \
  --role-name rag-api-dev-lambda-role \
  --policy-arn arn:aws:iam::ACCOUNT-ID:policy/rag-api-lambda-execution-policy

aws iam attach-role-policy \
  --role-name rag-api-dev-lambda-role \
  --policy-arn arn:aws:iam::ACCOUNT-ID:policy/rag-api-bedrock-access-policy
```

2. **Staging Environment**
```bash
# Attach all policies including RDS and VPC
aws iam attach-role-policy \
  --role-name rag-api-staging-lambda-role \
  --policy-arn arn:aws:iam::ACCOUNT-ID:policy/rag-api-lambda-execution-policy

aws iam attach-role-policy \
  --role-name rag-api-staging-lambda-role \
  --policy-arn arn:aws:iam::ACCOUNT-ID:policy/rag-api-bedrock-access-policy

aws iam attach-role-policy \
  --role-name rag-api-staging-lambda-role \
  --policy-arn arn:aws:iam::ACCOUNT-ID:policy/rag-api-rds-access-policy

aws iam attach-role-policy \
  --role-name rag-api-staging-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole
```

### Step 4: Update Serverless Configuration

Update your `serverless.yml` to use the new roles:

```yaml
provider:
  name: aws
  runtime: nodejs20.x
  region: ${opt:region, 'us-east-1'}
  stage: ${opt:stage, 'dev'}
  # Remove the iam.role.statements and use specific roles
  iam:
    role: ${self:custom.lambdaRole.${opt:stage, 'dev'}}

custom:
  lambdaRole:
    dev: arn:aws:iam::ACCOUNT-ID:role/rag-api-dev-lambda-role
    staging: arn:aws:iam::ACCOUNT-ID:role/rag-api-staging-lambda-role
    production: arn:aws:iam::ACCOUNT-ID:role/rag-api-production-lambda-role
```

### Step 5: Create Deployment User with Limited Permissions

Create a deployment user with only the permissions needed for serverless deployments:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ServerlessDeployment",
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "lambda:*",
        "apigateway:*",
        "s3:*",
        "iam:PassRole"
      ],
      "Resource": "*",
      "Condition": {
        "StringLike": {
          "cloudformation:StackName": "rag-api-*"
        }
      }
    },
    {
      "Sid": "IAMPassRole",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": [
        "arn:aws:iam::ACCOUNT-ID:role/rag-api-*-lambda-role"
      ]
    }
  ]
}
```

## Policy Testing & Validation

### 1. Policy Simulator
Use AWS Policy Simulator to test permissions:

```bash
# Test Bedrock access
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::ACCOUNT-ID:role/rag-api-dev-lambda-role \
  --action-names bedrock:InvokeModel \
  --resource-arns "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0"
```

### 2. CloudTrail Analysis
Monitor actual API calls to ensure policies are working:

```bash
# Check recent Bedrock API calls
aws logs filter-log-events \
  --log-group-name CloudTrail/BedrockAPILogs \
  --start-time $(date -d '1 hour ago' +%s)000 \
  --filter-pattern "{ $.eventName = InvokeModel }"
```

### 3. Access Analyzer
Use AWS Access Analyzer to identify unused permissions:

```bash
# Create access analyzer
aws accessanalyzer create-analyzer \
  --analyzer-name rag-api-analyzer \
  --type ACCOUNT
```

## Monitoring & Auditing

### 1. CloudWatch Metrics
Monitor permission denials:

```json
{
  "MetricName": "IAMPermissionDenials",
  "Namespace": "RAG-API/Security",
  "Dimensions": [
    {
      "Name": "Environment",
      "Value": "staging"
    }
  ]
}
```

### 2. CloudTrail Logging
Enable detailed API logging:

```yaml
# CloudFormation template for CloudTrail
Resources:
  RAGAPICloudTrail:
    Type: AWS::CloudTrail::Trail
    Properties:
      TrailName: rag-api-security-trail
      S3BucketName: !Ref SecurityLogsBucket
      IncludeGlobalServiceEvents: true
      IsMultiRegionTrail: true
      EnableLogFileValidation: true
      EventSelectors:
        - ReadWriteType: All
          IncludeManagementEvents: true
          DataResources:
            - Type: "AWS::Bedrock::*"
              Values: ["arn:aws:bedrock:*"]
```

### 3. AWS Config Rules
Monitor IAM policy compliance:

```json
{
  "ConfigRuleName": "rag-api-iam-compliance",
  "Source": {
    "Owner": "AWS",
    "SourceIdentifier": "IAM_POLICY_NO_STATEMENTS_WITH_ADMIN_ACCESS"
  },
  "Scope": {
    "ComplianceResourceTypes": [
      "AWS::IAM::Role",
      "AWS::IAM::Policy"
    ]
  }
}
```

## Best Practices

### 1. Regular Policy Reviews
- **Monthly**: Review access patterns using CloudTrail
- **Quarterly**: Audit unused permissions with Access Analyzer
- **Annually**: Complete security assessment

### 2. Automated Compliance
```yaml
# GitHub Actions workflow for policy validation
name: IAM Policy Validation
on:
  pull_request:
    paths:
      - 'iam-policies/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Validate IAM Policies
        run: |
          aws iam simulate-principal-policy \
            --policy-source-arn ${{ secrets.TEST_ROLE_ARN }} \
            --action-names $(cat test-actions.txt) \
            --resource-arns $(cat test-resources.txt)
```

### 3. Emergency Access Procedures
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EmergencyAccess",
      "Effect": "Allow",
      "Action": "*",
      "Resource": "*",
      "Condition": {
        "Bool": {
          "aws:MultiFactorAuthPresent": "true"
        },
        "DateLessThan": {
          "aws:CurrentTime": "2024-01-01T00:00:00Z"
        }
      }
    }
  ]
}
```

## Troubleshooting

### Common Issues

1. **Access Denied Errors**
```bash
# Check effective permissions
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::ACCOUNT-ID:role/rag-api-staging-lambda-role \
  --action-names bedrock:InvokeModel \
  --resource-arns "*"
```

2. **VPC Connection Issues**
```bash
# Verify VPC endpoints
aws ec2 describe-vpc-endpoints \
  --filters Name=service-name,Values=com.amazonaws.us-east-1.bedrock-runtime
```

3. **RDS Proxy Authentication**
```bash
# Test RDS proxy connection
aws rds describe-db-proxy-targets \
  --db-proxy-name rag-api-staging-proxy
```

### Debugging Commands

```bash
# Get current role permissions
aws sts get-caller-identity

# List attached policies
aws iam list-attached-role-policies \
  --role-name rag-api-staging-lambda-role

# Get policy document
aws iam get-policy-version \
  --policy-arn arn:aws:iam::ACCOUNT-ID:policy/rag-api-bedrock-access-policy \
  --version-id v1
```

## Migration Checklist

- [ ] Create custom IAM policies
- [ ] Create environment-specific roles
- [ ] Attach policies to roles
- [ ] Update serverless.yml configuration
- [ ] Create deployment user with limited permissions
- [ ] Test all functionality in development
- [ ] Deploy to staging and validate
- [ ] Monitor for access denied errors
- [ ] Update CI/CD pipelines
- [ ] Document new access patterns
- [ ] Remove admin access from original user
- [ ] Set up monitoring and alerting

## Conclusion

Implementing least privilege access significantly improves your security posture while maintaining functionality. This guide provides a comprehensive approach to transitioning from admin access to granular, service-specific permissions.

Remember to:
- Test thoroughly in development before production deployment
- Monitor access patterns and adjust policies as needed
- Regularly review and audit permissions
- Keep documentation updated as your architecture evolves

For questions or issues, refer to the troubleshooting section or AWS documentation for specific services.
