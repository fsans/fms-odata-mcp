# Deployment Scenarios - FMS-ODATA-MCP

## Understanding the Two Connection Types

### 1. MCP Server Transport (How Claude/Cline connects to THIS server)
This is how the AI assistant communicates with the MCP server.

**Options:**
- **stdio** (default) - For local use with Claude Desktop/Cline/Windsurf
- **HTTP** - For remote MCP server deployments
- **HTTPS** - For secure remote MCP server deployments

### 2. FileMaker Connection (How THIS server connects to FileMaker)
This is how the MCP server communicates with FileMaker Server.

**Always HTTPS:**
- FileMaker Server OData API requires HTTPS
- HTTP connections are blocked by FileMaker Server
- Certificate validation is configurable

## Deployment Scenarios

### Scenario 1: Local Development (Most Common)

**Setup:**
```
[Claude Desktop] --stdio--> [MCP Server] --HTTPS--> [FileMaker Server]
   (local)                    (local)              (192.168.0.24)
```

**Configuration:**
```json
{
  "mcpServers": {
    "filemaker": {
      "command": "node",
      "args": ["/path/to/FMS-ODATA-MCP/dist/index.js"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "FM_SERVER": "https://your-filemaker-server.com",
        "FM_DATABASE": "YourDatabase",
        "FM_USER": "your-username",
        "FM_PASSWORD": "your-password",
        "FM_VERIFY_SSL": "false"
      }
    }
  }
}
```

**Use Case:**
- Developer working locally
- FileMaker Server on local network
- Self-signed certificates acceptable

---

### Scenario 2: Shared MCP Server (Team Environment)

**Setup:**
```
[Claude Desktop] --HTTP--> [MCP Server] --HTTPS--> [FileMaker Server]
   (laptop A)             (shared server)          (production server)
   
[Claude Desktop] --HTTP--> [MCP Server]
   (laptop B)             (shared server)
```

**MCP Server Configuration:**
```bash
# On the shared server
export MCP_TRANSPORT=http
export MCP_PORT=3000
export MCP_HOST=0.0.0.0
export FM_SERVER=https://filemaker.company.com
export FM_DATABASE=${FM_DATABASE}
export FM_USER=${FM_USER}
export FM_PASSWORD=${FM_PASSWORD}
export FM_VERIFY_SSL=true

node dist/index.js
```

**Client Configuration:**
```json
{
  "mcpServers": {
    "filemaker": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "http://mcp-server.company.com:3000/mcp",
        "-H", "Content-Type: application/json",
        "-d", "@-"
      ]
    }
  }
}
```

**Use Case:**
- Multiple team members
- Centralized MCP server
- Production FileMaker Server with valid SSL

---

### Scenario 3: Co-located with FileMaker Server

**Setup:**
```
[Claude Desktop] --HTTPS--> [MCP Server] --HTTPS--> [FileMaker Server]
   (remote)                (same machine)          (localhost)
```

**Configuration on FileMaker Server:**
```bash
export MCP_TRANSPORT=https
export MCP_PORT=3443
export MCP_CERT_PATH=/path/to/cert.pem
export MCP_KEY_PATH=/path/to/key.pem
export FM_SERVER=https://localhost
export FM_DATABASE=Production
export FM_USER=admin
export FM_PASSWORD=password
export FM_VERIFY_SSL=false  # localhost with self-signed

node dist/index.js
```

**Use Case:**
- Maximum performance (localhost connection)
- Secure external access
- Reduced network latency

---

### Scenario 4: NPM Global Installation

**Setup:**
```
[Claude Desktop] --stdio--> [filemaker-odata-mcp] --HTTPS--> [FileMaker Server]
                             (npm global / npx)           (any server)
```

**Installation:**
```bash
npm install -g filemaker-odata-mcp
# or use npx without installing:
npx filemaker-odata-mcp
```

**Configuration:**
```json
{
  "mcpServers": {
    "filemaker": {
      "command": "npx",
      "args": ["-y", "filemaker-odata-mcp"],
      "env": {
        "FM_SERVER": "https://filemaker.company.com",
        "FM_DATABASE": "Contacts",
        "FM_USER": "admin",
        "FM_PASSWORD": "password",
        "FM_VERIFY_SSL": "true"
      }
    }
  }
}
```

**Use Case:**
- Clean installation
- No source code needed
- Production FileMaker Server

---

## Configuration Reference

### MCP Transport Settings

Controls how AI assistants connect to the MCP server:

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `MCP_TRANSPORT` | stdio, http, https | stdio | How clients connect to MCP server |
| `MCP_PORT` | 1-65535 | 3333 | Port for HTTP/HTTPS transport |
| `MCP_HOST` | hostname/IP | localhost | Bind address for HTTP/HTTPS |
| `MCP_CERT_PATH` | file path | - | Certificate for HTTPS transport |
| `MCP_KEY_PATH` | file path | - | Private key for HTTPS transport |

### FileMaker Connection Settings

Controls how MCP server connects to FileMaker:

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `FM_SERVER` | https://... | *required* | FileMaker Server URL (HTTPS only) |
| `FM_DATABASE` | string | *required* | Database name |
| `FM_USER` | string | *required* | Username |
| `FM_PASSWORD` | string | *required* | Password |
| `FM_VERIFY_SSL` | true, false | true | Verify SSL certificates |
| `FM_TIMEOUT` | milliseconds | 30000 | Request timeout |

**Important Notes:**
- `FM_SERVER` must use HTTPS protocol
- `FM_VERIFY_SSL=false` allows self-signed certificates
- Use `FM_VERIFY_SSL=true` for production with valid certificates

---

## Security Considerations

### Certificate Validation

**Development/Local Networks:**
```bash
FM_VERIFY_SSL=false  # Allow self-signed certificates
```

**Production:**
```bash
FM_VERIFY_SSL=true   # Require valid certificates
```

### When to Use Self-Signed Certificates

✅ **Acceptable:**
- Local development environments
- Internal corporate networks
- Testing environments
- Private networks (192.168.x.x, 10.x.x.x)

❌ **Not Recommended:**
- Public-facing servers
- Production environments
- When connecting over internet
- Compliance-regulated environments

### Securing Credentials

**Best Practices:**
1. Use environment variables (not hardcoded)
2. Use `.env` files (add to .gitignore)
3. Use secret management systems in production
4. Rotate passwords regularly
5. Use dedicated API accounts with minimal privileges

---

## Troubleshooting by Scenario

### Scenario 1 Issues (Local stdio)

**Problem:** "Connection failed"
- ✓ Check FileMaker Server is running
- ✓ Verify you're using HTTPS (not HTTP)
- ✓ Set `FM_VERIFY_SSL=false` for self-signed certs
- ✓ Test: `curl -k https://your-filemaker-server.com/fmi/odata/v4/YourDatabase`

### Scenario 2 Issues (HTTP MCP Server)

**Problem:** "MCP server not responding"
- ✓ Check MCP server is running: `curl http://server:3000/health`
- ✓ Verify firewall allows port 3000
- ✓ Check MCP_HOST is set to 0.0.0.0 (not localhost)

### Scenario 3 Issues (HTTPS MCP Server)

**Problem:** "Certificate error"
- ✓ Verify MCP_CERT_PATH and MCP_KEY_PATH are correct
- ✓ Check certificate permissions (readable by node process)
- ✓ Ensure certificate matches hostname

### Scenario 4 Issues (NPM Global)

**Problem:** "Command not found"
- ✓ Use `npx -y filemaker-odata-mcp` instead of a global install
- ✓ Or reinstall: `npm install -g filemaker-odata-mcp`
- ✓ Verify PATH includes npm global bin: `npm list -g filemaker-odata-mcp`

---

## Performance Considerations

### Latency

**Best to Worst:**
1. Co-located (Scenario 3): ~1-5ms to FileMaker
2. Local Network (Scenario 1): ~1-10ms to FileMaker
3. Shared Server (Scenario 2): Depends on network
4. Remote (Scenario 4): Depends on internet connection

### Recommendations

- **Development**: Scenario 1 (stdio + local FileMaker)
- **Team (< 10 users)**: Scenario 2 (shared MCP server)
- **Production**: Scenario 3 (co-located) or Scenario 4 (npm global)
- **High Performance**: Scenario 3 (co-located on FileMaker Server)

---

## Next Steps

### For Development
1. Use Scenario 1 with `FM_VERIFY_SSL=false`
2. Test with local FileMaker Server
3. Iterate quickly

### For Production
1. Get valid SSL certificate for FileMaker Server
2. Use `FM_VERIFY_SSL=true`
3. Deploy as Scenario 3 or 4
4. Monitor and log all connections
5. Implement backup strategies

### For NPM Publication
1. Complete documentation
2. Add comprehensive tests
3. Create clean GitHub repository
4. Test NPM package locally
5. Publish to NPM registry
