# Multi-stage build for Lambda Web Adapter
FROM public.ecr.aws/lambda/nodejs:20 as lambda-base

# Copy Lambda Web Adapter
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4 /lambda-adapter /opt/extensions/lambda-adapter

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built application (TypeScript compiled to JavaScript)
COPY dist/ ./dist/

# Set environment variables for Lambda Web Adapter
ENV AWS_LWA_ENABLE_COMPRESSION=true
ENV AWS_LWA_REMOVE_BASE_PATH=/Prod
ENV PORT=8080

# Lambda Web Adapter will start our Lambda handler wrapper
CMD ["node", "dist/lambda-server.js"]

# Development stage for local development
FROM node:20-alpine as development

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./
COPY .env.example ./

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the Lambda handler wrapper for local testing
CMD ["node", "dist/lambda-server.js"]
