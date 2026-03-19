#!/bin/bash

# Test script for Docker deployment
set -e

echo "🐳 Testing Docker deployment..."

# Build the image
echo "Building Docker image..."
docker build -t filemaker-odata-mcp:test .

# Run the container
echo "Starting container..."
docker run -d --name test-container \
  -e MCP_TRANSPORT=http \
  -e MCP_PORT=3333 \
  -p 3333:3333 \
  filemaker-odata-mcp:test

# Wait for startup
echo "Waiting for server to start..."
sleep 5

# Test health endpoint
echo "Testing health endpoint..."
curl -f http://localhost:3333/health

# Test MCP endpoint
echo "Testing MCP endpoint..."
curl -f -X POST http://localhost:3333/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }' | jq .

# Clean up
echo "Cleaning up..."
docker stop test-container
docker rm test-container
docker rmi filemaker-odata-mcp:test

echo "✅ All tests passed!"
