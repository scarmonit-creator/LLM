FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Expose port
EXPOSE 8080

# Set environment
ENV PORT=8080
ENV NODE_ENV=production
ENV AI_BRIDGE_HISTORY_LIMIT=500
ENV AI_BRIDGE_MAX_QUEUE=1000
ENV AI_BRIDGE_CORS_ORIGINS=*
ENV AI_BRIDGE_CLIENT_TTL_MS=600000
ENV AI_BRIDGE_CLEANUP_INTERVAL_MS=30000
ENV AI_BRIDGE_RATE_WINDOW_MS=60000
ENV AI_BRIDGE_RATE_MAX=120

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]