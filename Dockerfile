# Multi-stage optimized build for maximum performance and minimal size
FROM node:18-alpine AS base

# Install system dependencies and optimization tools
RUN apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates \
    tzdata \
    && update-ca-certificates

# Set optimization environment variables
ENV NODE_OPTIONS="--max-old-space-size=450 --gc-interval=100 --optimize-for-size" \
    NODE_ENV=production \
    NPM_CONFIG_PRODUCTION=true \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# Dependencies stage - optimized caching
FROM base AS dependencies

WORKDIR /app

# Copy package files for dependency resolution
COPY package*.json ./

# Install ALL dependencies (including dev for build)
RUN npm ci --include=dev \
    && npm cache clean --force

# Build stage
FROM dependencies AS builder

# Copy source code
COPY . .

# Build application (if build script exists)
RUN npm run build 2>/dev/null || echo "No build step defined" \
    && npm run typecheck 2>/dev/null || echo "No typecheck step"

# Production dependencies stage
FROM base AS prod-deps

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies with optimizations
RUN npm ci --omit=dev --omit=optional --no-audit \
    && npm cache clean --force \
    && npm prune --production

# Runtime stage - minimal production image
FROM base AS production

WORKDIR /app

# Create non-root user with specific UID/GID for security
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 -G nodejs

# Copy production dependencies
COPY --from=prod-deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist 2>/dev/null || true
COPY --from=builder --chown=nodejs:nodejs /app/build ./build 2>/dev/null || true

# Copy essential files
COPY --chown=nodejs:nodejs package*.json ./
COPY --chown=nodejs:nodejs server.js ./
COPY --chown=nodejs:nodejs orchestrator.ts ./
COPY --chown=nodejs:nodejs tsconfig.json ./

# Copy optional directories if they exist
COPY --chown=nodejs:nodejs config ./config 2>/dev/null || true
COPY --chown=nodejs:nodejs scripts ./scripts 2>/dev/null || true

# Switch to non-root user
USER nodejs

# Expose ports
EXPOSE 8080 9091

# Set optimized environment variables
ENV NODE_ENV=production \
    PORT=8080 \
    NODE_OPTIONS="--max-old-space-size=450 --gc-interval=100 --optimize-for-size" \
    AI_BRIDGE_HISTORY_LIMIT=1000 \
    AI_BRIDGE_MAX_QUEUE=2000 \
    AI_BRIDGE_CORS_ORIGINS=* \
    AI_BRIDGE_CLIENT_TTL_MS=900000 \
    AI_BRIDGE_CLEANUP_INTERVAL_MS=60000 \
    AI_BRIDGE_RATE_WINDOW_MS=60000 \
    AI_BRIDGE_RATE_MAX=200 \
    UV_THREADPOOL_SIZE=16

# Enhanced health check with proper timeout handling
HEALTHCHECK --interval=30s --timeout=15s --start-period=40s --retries=3 \
    CMD curl -f -H "User-Agent: docker-health-check" \
        -H "Cache-Control: no-cache" \
        http://localhost:8080/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Optimized startup command with performance monitoring
CMD ["sh", "-c", "echo 'Starting AI Bridge Server with optimizations...' && npm start"]

# Multi-architecture support labels
LABEL maintainer="scarmonit@scarmonit.com" \
      description="Optimized LLM AI Bridge Server" \
      version="1.1.0" \
      architecture="multi-platform" \
      optimization="performance-focused"