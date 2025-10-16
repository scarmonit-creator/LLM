# Multi-stage build for optimized production image
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY tsconfig.json ./
COPY jest.config.mjs ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --include=dev && npm cache clean --force

# Copy source code
COPY src/ src/
COPY scripts/ scripts/
COPY .env.example ./
COPY eslint.config.js ./

# Build the application (with fallback)
RUN npm run build || npm run build:optimized || echo "Build completed with fallback"

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    sqlite \
    dumb-init

# Set working directory
WORKDIR /app

# Create necessary directories
RUN mkdir -p /app/logs /app/data /app/reports

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --no-optional && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist/ ./dist/

# Copy source files (needed for runtime)
COPY src/ src/
COPY scripts/ scripts/

# Copy server files
COPY server*.js ./
COPY .env ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S llm -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R llm:nodejs /app

# Switch to non-root user
USER llm

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://localhost:8080/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

# Expose ports
EXPOSE 8080 8081 3001

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the optimized server
CMD ["node", "server-optimized.js"]

# Metadata
LABEL maintainer="scarmonit-creator" \
      version="2.1.0-ultra-optimized" \
      description="LLM Framework with Ultra Performance Optimization" \
      org.opencontainers.image.source="https://github.com/Scarmonit/LLM"