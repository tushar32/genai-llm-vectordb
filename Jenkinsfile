pipeline {
    agent any
    
    environment {
        NODE_VERSION = '18'
        AWS_REGION = 'us-east-1'
        DOCKER_REGISTRY = credentials('ecr-registry')
        SLACK_CHANNEL = '#deployments'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                    env.BUILD_TAG = "${env.BRANCH_NAME}-${env.GIT_COMMIT_SHORT}-${env.BUILD_NUMBER}"
                }
            }
        }
        
        stage('Setup') {
            parallel {
                stage('Node.js Setup') {
                    steps {
                        sh """
                            nvm use ${NODE_VERSION}
                            npm ci
                        """
                    }
                }
                stage('Database Setup') {
                    steps {
                        script {
                            docker.image('pgvector/pgvector:pg15').withRun('-e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=vectordb_test -p 5432:5432') { c ->
                                sh 'sleep 10' // Wait for PostgreSQL to start
                                sh """
                                    export DB_HOST=localhost
                                    export DB_PORT=5432
                                    export DB_NAME=vectordb_test
                                    export DB_USER=postgres
                                    export DB_PASSWORD=postgres
                                    export NODE_ENV=test
                                    npm run migrate:latest
                                """
                            }
                        }
                    }
                }
            }
        }
        
        stage('Code Quality') {
            parallel {
                stage('TypeScript Build') {
                    steps {
                        sh 'npm run build'
                        archiveArtifacts artifacts: 'dist/**/*', fingerprint: true
                    }
                }
                stage('Linting') {
                    steps {
                        sh 'npm run lint'
                        publishHTML([
                            allowMissing: false,
                            alwaysLinkToLastBuild: true,
                            keepAll: true,
                            reportDir: 'lint-results',
                            reportFiles: 'index.html',
                            reportName: 'ESLint Report'
                        ])
                    }
                }
                stage('Security Scan') {
                    steps {
                        sh 'npm audit --audit-level moderate'
                        // Add Snyk or other security scanning tools
                        script {
                            if (env.SNYK_TOKEN) {
                                sh 'npx snyk test --severity-threshold=high'
                            }
                        }
                    }
                }
            }
        }
        
        stage('Testing') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        script {
                            docker.image('pgvector/pgvector:pg15').withRun('-e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=vectordb_test -p 5432:5432') { c ->
                                sh 'sleep 10'
                                sh """
                                    export DB_HOST=localhost
                                    export DB_PORT=5432
                                    export DB_NAME=vectordb_test
                                    export DB_USER=postgres
                                    export DB_PASSWORD=postgres
                                    export NODE_ENV=test
                                    npm run test:coverage
                                """
                            }
                        }
                        publishTestResults testResultsPattern: 'test-results.xml'
                        publishCoverage adapters: [
                            istanbulCoberturaAdapter('coverage/cobertura-coverage.xml')
                        ], sourceFileResolver: sourceFiles('STORE_LAST_BUILD')
                    }
                }
                stage('Migration Tests') {
                    steps {
                        script {
                            docker.image('pgvector/pgvector:pg15').withRun('-e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=migration_test -p 5433:5432') { c ->
                                sh 'sleep 10'
                                sh """
                                    export DB_HOST=localhost
                                    export DB_PORT=5433
                                    export DB_NAME=migration_test
                                    export DB_USER=postgres
                                    export DB_PASSWORD=postgres
                                    export NODE_ENV=test
                                    
                                    # Test forward migration
                                    npm run migrate:latest
                                    npm run migrate:status
                                    
                                    # Test rollback
                                    npm run migrate:rollback
                                    npm run migrate:latest
                                """
                            }
                        }
                    }
                }
            }
        }
        
        stage('Build Docker Image') {
            when {
                anyOf {
                    branch 'main'
                    branch 'develop'
                }
            }
            steps {
                script {
                    def image = docker.build("${DOCKER_REGISTRY}/rag-api:${BUILD_TAG}")
                    docker.withRegistry("https://${DOCKER_REGISTRY}", 'ecr-credentials') {
                        image.push()
                        image.push('latest')
                    }
                    env.DOCKER_IMAGE = "${DOCKER_REGISTRY}/rag-api:${BUILD_TAG}"
                }
            }
        }
        
        stage('Deploy to Staging') {
            when {
                branch 'develop'
            }
            environment {
                NODE_ENV = 'staging'
                AWS_CREDENTIALS = credentials('aws-staging-credentials')
            }
            steps {
                script {
                    // Run database migrations
                    withCredentials([
                        string(credentialsId: 'staging-db-host', variable: 'DB_HOST'),
                        string(credentialsId: 'staging-db-name', variable: 'DB_NAME'),
                        string(credentialsId: 'staging-db-user', variable: 'DB_USER'),
                        string(credentialsId: 'staging-db-password', variable: 'DB_PASSWORD')
                    ]) {
                        sh """
                            export DB_SSL=true
                            npm run migrate:latest
                        """
                    }
                    
                    // Deploy to AWS Lambda
                    withCredentials([
                        string(credentialsId: 'openai-api-key', variable: 'OPENAI_API_KEY')
                    ]) {
                        sh 'npm run deploy:staging'
                    }
                }
                
                // Run smoke tests
                sh 'npm run test:smoke'
                
                slackSend(
                    channel: SLACK_CHANNEL,
                    color: 'good',
                    message: "✅ RAG API deployed to staging: ${env.BUILD_URL}"
                )
            }
        }
        
        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            environment {
                NODE_ENV = 'production'
                AWS_CREDENTIALS = credentials('aws-production-credentials')
            }
            steps {
                script {
                    // Manual approval for production
                    input message: 'Deploy to Production?', ok: 'Deploy',
                          submitterParameter: 'DEPLOYER'
                    
                    // Run database migrations
                    withCredentials([
                        string(credentialsId: 'prod-db-host', variable: 'DB_HOST'),
                        string(credentialsId: 'prod-db-name', variable: 'DB_NAME'),
                        string(credentialsId: 'prod-db-user', variable: 'DB_USER'),
                        string(credentialsId: 'prod-db-password', variable: 'DB_PASSWORD')
                    ]) {
                        sh """
                            export DB_SSL=true
                            npm run migrate:latest
                        """
                    }
                    
                    // Deploy to AWS Lambda
                    withCredentials([
                        string(credentialsId: 'openai-api-key', variable: 'OPENAI_API_KEY')
                    ]) {
                        sh 'npm run deploy:production'
                    }
                    
                    // Deploy CloudFront
                    sh """
                        aws cloudformation deploy \
                            --template-file cloudfront-config.yml \
                            --stack-name rag-api-cloudfront-prod \
                            --parameter-overrides Stage=production
                    """
                }
                
                // Run health checks
                sh 'npm run test:health'
                
                slackSend(
                    channel: SLACK_CHANNEL,
                    color: 'good',
                    message: "🚀 RAG API deployed to production by ${env.DEPLOYER}: ${env.BUILD_URL}"
                )
            }
        }
    }
    
    post {
        always {
            // Clean up
            sh 'docker system prune -f'
            cleanWs()
        }
        
        failure {
            slackSend(
                channel: '#alerts',
                color: 'danger',
                message: "❌ RAG API pipeline failed: ${env.BUILD_URL}"
            )
            
            // Rollback on production failure
            script {
                if (env.BRANCH_NAME == 'main' && currentBuild.currentResult == 'FAILURE') {
                    sh """
                        aws lambda update-function-configuration \
                            --function-name rag-api-production \
                            --environment Variables="{ROLLBACK=true}"
                    """
                }
            }
        }
        
        success {
            // Archive build artifacts
            archiveArtifacts artifacts: 'dist/**/*', fingerprint: true
            
            // Generate and publish documentation
            sh 'npm run docs:generate'
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'docs',
                reportFiles: 'index.html',
                reportName: 'API Documentation'
            ])
        }
    }
}
