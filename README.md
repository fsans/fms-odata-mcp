# FileMaker Server OData MCP

[![npm version](https://img.shields.io/npm/v/filemaker-odata-mcp.svg)](https://www.npmjs.com/package/filemaker-odata-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Model Context Protocol (MCP) server providing FileMaker Server OData 4.01 API integration
for AI assistants like Claude Desktop, Windsurf, Cursor, and Cline.

## Features

- 🔌 **19 MCP Tools** for FileMaker database operations
- 🔍 **Database Discovery** - Explore tables, fields, and metadata
- 📊 **CRUD Operations** - Create, read, update, and delete records
- 🔐 **Secure Connections** - SSL support for self-signed certificates
- 💾 **Connection Management** - Save and reuse database connections
- 📝 **OData 4.01 Standard** - Full query capabilities ($filter, $select, $orderby, etc.)

## Quick Start

### Installation

```bash
# Via NPM (recommended)
npm install -g filemaker-odata-mcp

# Or local development
git clone https://github.com/fsans/FMS-ODATA-MCP.git
cd FMS-ODATA-MCP
npm install
npm run build
```

## Deployment Modes

### 1. MCP Server Mode (Default)

For use with AI assistants that support MCP (Claude Desktop, Windsurf, Cursor, Cline).

#### Setup for Claude Desktop

1. **Locate your Claude config file:**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Add the MCP server:**

```json
{
  "mcpServers": {
    "filemaker": {
      "command": "npx",
      "args": ["-y", "filemaker-odata-mcp"],
      "env": {
        "FM_SERVER": "https://your-filemaker-server.com",
        "FM_DATABASE": "YourDatabase",
        "FM_USER": "your-username",
        "FM_PASSWORD": "your-password",
        "FM_VERIFY_SSL": "true"
      }
    }
  }
}
```

3. **For self-signed SSL certificates**, set `FM_VERIFY_SSL` to `"false"`

4. **Restart Claude Desktop**

#### Setup for Windsurf/Cursor

The server will be automatically detected when installed globally. For local development, add to your MCP config.

### 2. Standalone HTTP Server Mode

Run as a standalone HTTP server accessible from any application:

```bash
# Set environment variables for HTTP mode
export MCP_TRANSPORT=http
export MCP_PORT=3333
export MCP_HOST=0.0.0.0  # Listen on all interfaces

# Run the server
filemaker-odata-mcp
```

The server will start on `http://localhost:3333` with the following endpoints:

- **MCP endpoint**: `http://localhost:3333/mcp` (POST requests with JSON-RPC 2.0)
- **Health check**: `http://localhost:3333/health`
- **Server info**: `http://localhost:3333/mcp` (GET request)

#### Example HTTP Client Request

```bash
curl -X POST http://localhost:3333/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

#### HTTPS Mode

```bash
export MCP_TRANSPORT=https
export MCP_PORT=3443
export MCP_CERT_PATH=/path/to/cert.pem
export MCP_KEY_PATH=/path/to/key.pem
```

#### Integration Examples

**Python Example:**

```python
import requests

# List available tools
response = requests.post("http://localhost:3333/mcp", json={
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
})
tools = response.json()

# Query records
response = requests.post("http://localhost:3333/mcp", json={
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
        "name": "fm_odata_query_records",
        "arguments": {
            "table": "Contacts",
            "filter": "City eq 'New York'"
        }
    }
})
```

**JavaScript Example:**

```javascript
// Connect to FileMaker
const response = await fetch('http://localhost:3333/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
            name: 'fm_odata_connect',
            arguments: {
                server: 'https://your-server.com/fmi/odata/v4',
                database: 'Contacts',
                user: 'admin',
                password: 'secret',
                verifySsl: false
            }
        }
    })
});
```

### 3. Docker Deployment

#### Option A: Using Docker Run

```bash
# Pull the image
docker pull ghcr.io/fsans/filemaker-odata-mcp:latest

# Run the container
docker run -d \
  --name filemaker-odata-mcp \
  -p 3333:3333 \
  -e FM_SERVER=https://your-filemaker-server.com/fmi/odata/v4 \
  -e FM_DATABASE=YourDatabase \
  -e FM_USER=your-username \
  -e FM_PASSWORD=your-password \
  -e FM_VERIFY_SSL=false \
  -v ~/.fms-odata-mcp:/home/mcp/.fms-odata-mcp \
  filemaker-odata-mcp:latest
```

#### Option B: Using Docker Compose (Recommended)

1. **Clone and build:**

```bash
git clone https://github.com/fsans/FMS-ODATA-MCP.git
cd FMS-ODATA-MCP
npm run build
```

2. **Configure environment:**

```bash
# Copy and edit the compose file
cp docker-compose.yml my-docker-compose.yml
# Edit my-docker-compose.yml with your FileMaker credentials
```

3. **Start the server:**

```bash
docker-compose -f my-docker-compose.yml up -d
```

#### Option C: Docker Compose with HTTPS

```bash
# Start with Nginx reverse proxy for HTTPS
docker-compose -f docker-compose.yml --profile https up -d
```

Place your SSL certificates in the `./ssl` directory:
- `ssl/cert.pem` - SSL certificate
- `ssl/key.pem` - SSL private key

#### Docker Features

- **Health checks** - Automatic monitoring of server status
- **Persistent connections** - Mount volume to save connection configurations
- **Non-root user** - Security best practices
- **Alpine Linux** - Small image size (~50MB)
- **Signal handling** - Graceful shutdown with dumb-init

#### Accessing the Server

Once running, access the server at:
- HTTP: `http://localhost:3333`
- HTTPS (with Nginx): `https://localhost`

Check the health endpoint:

```bash
curl http://localhost:3333/health
```

### First Steps

Once connected, try these prompts in Claude:

```text
What tables are in my FileMaker database?

Show me the first 5 records from the Contacts table

Find all contacts where LastName equals "Smith"

Create a new contact with name "John Doe" and email "john@example.com"
```

## Documentation

- **[Quick Reference](./dev_stuf/QUICK_REFERENCE.md)** - One-page setup guide
- **[Prompt Examples](./dev_stuf/CLAUDE_DESKTOP_PROMPTS.md)** - Complete prompt reference  
- **[Claude Desktop Setup](./dev_stuf/CLAUDE_DESKTOP_SETUP.md)** - Detailed configuration
- **[Windsurf Setup](./dev_stuf/WINDSURF_SETUP.md)** - IDE integration guide
- **[Docker Deployment](./DOCKER.md)** - Complete Docker guide with production examples

## Available Tools

| Category      | Tools                                                                 |
|---------------|-----------------------------------------------------------------------|
| **Discovery** | `fm_odata_list_tables`, `fm_odata_get_metadata`, `fm_odata_get_service_document` |
| **Queries**   | `fm_odata_query_records`, `fm_odata_get_record`, `fm_odata_get_records`, `fm_odata_count_records` |
| **CRUD**      | `fm_odata_create_record`, `fm_odata_update_record`, `fm_odata_delete_record` |
| **Connection**| `fm_odata_connect`, `fm_odata_set_connection`, `fm_odata_list_connections`, `fm_odata_get_current_connection` |
| **Config**    | `fm_odata_config_add_connection`, `fm_odata_config_remove_connection`, `fm_odata_config_list_connections` |

## Requirements

- **Node.js** 18.0.0 or higher
- **FileMaker Server** with OData API enabled
- **FileMaker Account** with appropriate access privileges

## Environment Variables

### FileMaker Connection

| Variable      | Description                                    | Required | Default |
|---------------|------------------------------------------------|----------|---------|
| `FM_SERVER`   | FileMaker Server URL                           | Yes      | -       |
| `FM_DATABASE` | Database name                                  | Yes      | -       |
| `FM_USER`     | Username                                       | Yes      | -       |
| `FM_PASSWORD` | Password                                       | Yes      | -       |
| `FM_VERIFY_SSL`| Verify SSL certificates                        | No       | `true`  |
| `FM_TIMEOUT`  | Request timeout (ms)                           | No       | `30000` |

### HTTP/HTTPS Transport

| Variable        | Description                                    | Required | Default                           |
|-----------------|------------------------------------------------|----------|-----------------------------------|
| `MCP_TRANSPORT` | Transport type: `stdio`, `http`, or `https`     | No       | `stdio`                           |
| `MCP_PORT`      | Port for HTTP/HTTPS server                     | No       | `3333` (HTTP), `3443` (HTTPS)    |
| `MCP_HOST`      | Host to bind to                                | No       | `localhost`                       |
| `MCP_CERT_PATH` | Path to SSL certificate (HTTPS only)           | No       | -                                 |
| `MCP_KEY_PATH`  | Path to SSL private key (HTTPS only)           | No       | -                                 |

## OData Query Syntax

The server supports OData 4.01 query options:

```text
$filter   - Filter records (e.g., "Age gt 18")
$select   - Select specific fields
$orderby  - Sort results
$top      - Limit results
$skip     - Skip records (pagination)
$expand   - Include related records
$count    - Include total count
```

**Example prompts:**

```text
Get contacts where Age is greater than 18

Show only Name and Email fields from Contacts

Sort contacts by LastName in descending order

Get the first 10 contacts, skip the first 20
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/fsans/FMS-ODATA-MCP/issues)
- **Discussions**: [GitHub Discussions](https://github.com/fsans/FMS-ODATA-MCP/discussions)

## Changelog

See [dev_stuf/VERSIONING.md](./dev_stuf/VERSIONING.md) for version history.

---

Made with ❤️ for the FileMaker and AI communities
