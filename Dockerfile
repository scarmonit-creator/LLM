# Multi-stage build for optimal image size
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build || echo "No build step defined"

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/src ./src
COPY --from=builder /app/dist ./dist 2>/dev/null || true
COPY --from=builder /app/build ./build 2>/dev/null || true

# Copy other necessary files
COPY server.js orchestrator.ts tsconfig.json ./
COPY config ./config 2>/dev/null || true
COPY scripts ./scripts 2>/dev/null || true

# Create non-root user with specific UID/GID
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 8080 9091

# Set optimized environment variables
ENV NODE_ENV=production \
    PORT=8080 \
    NODE_OPTIONS="--max-old-space-size=450 --gc-interval=100" \
    AI_BRIDGE_HISTORY_LIMIT=1000 \
    AI_BRIDGE_MAX_QUEUE=2000 \
    AI_BRIDGE_CORS_ORIGINS=* \
    AI_BRIDGE_CLIENT_TTL_MS=900000 \
    AI_BRIDGE_CLEANUP_INTERVAL_MS=60000 \
    AI_BRIDGE_RATE_WINDOW_MS=60000 \
    AI_BRIDGE_RATE_MAX=200

# Add health check with improved configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://localhost:8080/health',{headers:{'User-Agent':'docker-health-check'}}).then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]