#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env"
IMAGE="filemaker-odata-mcp:latest"
CONTAINER="filemaker-odata-mcp"

# Require .env
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found. Copy .env.example to .env and fill in your values."
  exit 1
fi

# Build TypeScript if dist/ is missing or stale
if [ ! -d "dist" ] || [ "$(find src -name '*.ts' -newer dist/index.js 2>/dev/null | head -1)" != "" ]; then
  echo "Building TypeScript..."
  npm run build
fi

# Build Docker image
echo "Building Docker image..."
docker build -t "$IMAGE" .

# Remove existing container if present
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "Removing existing container..."
  docker rm -f "$CONTAINER"
fi

# Create a clean env file (strip BOM bytes and non-VAR=VALUE lines) for docker --env-file
CLEAN_ENV=$(mktemp /tmp/fms-odata-env.XXXXXX)
trap 'rm -f "$CLEAN_ENV"' EXIT
sed 's/^\xc3\xa7//' "$ENV_FILE" | grep -E '^[A-Za-z_][A-Za-z0-9_]*=' > "$CLEAN_ENV"

# Helper to read a value from the cleaned env (for display and port mapping)
_val() { grep -m1 "^${1}=" "$CLEAN_ENV" | cut -d= -f2- | tr -d '"'"'"; }

MCP_PORT=$(_val MCP_PORT)
MCP_PORT=${MCP_PORT:-3333}

echo "Starting container with settings from $ENV_FILE..."
echo "  FM_SERVER:     $(_val FM_SERVER)"
echo "  FM_DATABASE:   $(_val FM_DATABASE)"
echo "  FM_USER:       $(_val FM_USER)"
echo "  MCP_TRANSPORT: $(_val MCP_TRANSPORT)"
echo "  MCP_PORT:      $MCP_PORT"

docker run -d \
  --name "$CONTAINER" \
  --restart unless-stopped \
  --env-file "$CLEAN_ENV" \
  -p "${MCP_PORT}:${MCP_PORT}" \
  -v "$HOME/.fms-odata-mcp:/home/mcp/.fms-odata-mcp" \
  "$IMAGE"

echo ""
echo "Container started. Logs:"
docker logs -f "$CONTAINER"
