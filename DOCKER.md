# Docker Deployment Guide

This guide covers deploying the FileMaker OData MCP server using Docker.

## Quick Start

```bash
# Run with environment variables
docker run -d \
  --name filemaker-odata-mcp \
  -p 3333:3333 \
  -e FM_SERVER=https://your-filemaker-server.com/fmi/odata/v4 \
  -e FM_DATABASE=YourDatabase \
  -e FM_USER=your-username \
  -e FM_PASSWORD=your-password \
  ghcr.io/fsans/filemaker-odata-mcp:latest
```

## Configuration

### Environment Variables

All environment variables from the main README are supported in Docker:

| Variable      | Description                                    | Example                                         |
|---------------|------------------------------------------------|-------------------------------------------------|
| `FM_SERVER`   | FileMaker Server URL                           | `https://fms.example.com/fmi/odata/v4`          |
| `FM_DATABASE` | Database name                                  | `Contacts`                                      |
| `FM_USER`     | Username                                       | `admin`                                         |
| `FM_PASSWORD` | Password                                       | `secret`                                        |
| `FM_VERIFY_SSL`| SSL verification                               | `false`                                         |
| `MCP_TRANSPORT`| Transport type                                 | `http`                                          |
| `MCP_PORT`    | Server port                                    | `3333`                                          |
| `MCP_HOST`    | Bind address                                   | `0.0.0.0`                                       |

### Persistent Storage

To save connection configurations:

```bash
docker run -d \
  --name filemaker-odata-mcp \
  -p 3333:3333 \
  -v ~/.fms-odata-mcp:/home/mcp/.fms-odata-mcp \
  -e FM_SERVER=... \
  ghcr.io/fsans/filemaker-odata-mcp:latest
```

## Docker Compose

### Basic Setup

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  filemaker-odata-mcp:
    image: ghcr.io/fsans/filemaker-odata-mcp:latest
    restart: unless-stopped
    ports:
      - "3333:3333"
    environment:
      - FM_SERVER=https://your-filemaker-server.com/fmi/odata/v4
      - FM_DATABASE=YourDatabase
      - FM_USER=your-username
      - FM_PASSWORD=your-password
      - FM_VERIFY_SSL=false
    volumes:
      - ~/.fms-odata-mcp:/home/mcp/.fms-odata-mcp
```

Run with:

```bash
docker-compose up -d
```

### HTTPS with Nginx

For production deployments with HTTPS:

```yaml
version: '3.8'

services:
  filemaker-odata-mcp:
    image: ghcr.io/fsans/filemaker-odata-mcp:latest
    restart: unless-stopped
    environment:
      - FM_SERVER=...
    # No port exposed - accessed through Nginx

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - filemaker-odata-mcp
```

## Building from Source

To build the Docker image locally:

```bash
# Clone the repository
git clone https://github.com/fsans/FMS-ODATA-MCP.git
cd FMS-ODATA-MCP

# Build the application
npm install
npm run build

# Build the Docker image
docker build -t filemaker-odata-mcp:local .

# Run the local image

```bash
docker run -d \
  --name filemaker-odata-mcp \
  -p 3333:3333 \
  -e FM_SERVER=... \
  filemaker-odata-mcp:local
```

## Health Checks

The Docker image includes built-in health checks:

```bash
# Check health status
docker ps

# View health logs
docker inspect --format='{{.State.Health}}' filemaker-odata-mcp

# Manual health check

```bash
curl http://localhost:3333/health
```

## Security Considerations

1. **Use environment files** for sensitive data:

```bash
docker run --env-file .env filemaker-odata-mcp:latest
```

2. **Network isolation**:

```bash
docker network create mcp-network
docker run --network mcp-network filemaker-odata-mcp:latest
```

3. **Resource limits**:

```yaml
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 512M
```

## Troubleshooting

### View Logs

```bash
# Container logs
docker logs filemaker-odata-mcp

# Follow logs
docker logs -f filemaker-odata-mcp

# Docker Compose logs
docker-compose logs -f
```

### Common Issues

1. **Port already in use**:

```bash
# Check what's using the port
lsof -i :3333

# Use a different port
docker run -p 3334:3333 filemaker-odata-mcp:latest
```

2. **Connection refused**:
- Check FileMaker Server is accessible from Docker
- Verify SSL settings (`FM_VERIFY_SSL=false` for self-signed certs)

3. **Permission issues**:

```bash
# Fix volume permissions
sudo chown -R 1001:1001 ~/.fms-odata-mcp
```

### Production Deployment

For production use:

1. **Use Docker secrets** for passwords

2. **Enable HTTPS** with proper certificates

3. **Set up monitoring** with health checks

4. **Use restart policies**

5. **Log aggregation** (ELK stack, etc.)

Example production compose file:

```yaml
version: '3.8'

services:
  filemaker-odata-mcp:
    image: ghcr.io/fsans/filemaker-odata-mcp:latest
    restart: always
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1'
          memory: 1G
    environment:
      - FM_SERVER=${FM_SERVER}
      - FM_DATABASE=${FM_DATABASE}
      - FM_USER=${FM_USER}
      - FM_PASSWORD_FILE=/run/secrets/fm_password
    secrets:
      - fm_password
    volumes:
      - mcp-data:/home/mcp/.fms-odata-mcp
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3333/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  mcp-data:

secrets:
  fm_password:
    file: ./secrets/fm_password.txt
```
