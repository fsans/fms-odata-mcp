# Use Node.js 18.19.1 LTS as base image (specific version for security)
FROM node:18.19.1-alpine

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY dist/ ./dist/
COPY LICENSE ./LICENSE

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001

# Change ownership of app directory
RUN chown -R mcp:nodejs /app
USER mcp

# Expose port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3333/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Set environment defaults
ENV MCP_TRANSPORT=http
ENV MCP_PORT=3333
ENV MCP_HOST=0.0.0.0

# Run the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
