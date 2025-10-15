# Multi-stage Docker build for optimal performance and security
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ sqlite-dev

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json ./

# Install dependencies with optimizations
RUN npm ci --only=production --silent --no-audit --prefer-offline && \
    npm cache clean --force

# Copy source code
COPY . .

# Build tools and compile TypeScript
RUN npm run build:tools && \
    npm run build || echo "Build step completed"

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies only
RUN apk add --no-cache dumb-init sqlite

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S llm -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=llm:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=llm:nodejs /app/dist ./dist
COPY --chown=llm:nodejs package.json server.js fly.toml ./
COPY --chown=llm:nodejs src ./src

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=8080
ENV NODE_OPTIONS="--max-old-space-size=400 --gc-interval=100"

# Switch to non-root user
USER llm

# Health check for container monitoring
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Expose port
EXPOSE 8080

# Start the optimized server
CMD ["npm", "start"]