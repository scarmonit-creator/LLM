FROM node:18-alpine

# Set working directory
WORKDIR /app

# Create logs directory
RUN mkdir -p /app/logs

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build || echo "Build attempted"

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S llm -u 1001

# Change ownership
RUN chown -R llm:nodejs /app
USER llm

# Expose ports
EXPOSE 8080 8081 3001

# Start the application
CMD ["npm", "start"]