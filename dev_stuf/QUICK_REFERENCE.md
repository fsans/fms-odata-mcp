# FileMaker OData MCP - Quick Reference

**One-page guide to get started quickly**

---

## 1. INSTALL THE SERVER

### Option A: NPM (Recommended - no build needed)

```bash
npm install -g filemaker-odata-mcp
# or use directly without installing:
npx filemaker-odata-mcp
```

### Option B: Build from Source

```bash
git clone https://github.com/fsans/FMS-ODATA-MCP.git
cd FMS-ODATA-MCP
npm install
npm run build
```

---

## 2. CHOOSE YOUR SETUP

### Option A: Claude Desktop

**Config Location (macOS):**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Add This Configuration (using npx):**
```json
{
  "mcpServers": {
    "filemaker-odata": {
      "command": "npx",
      "args": ["-y", "filemaker-odata-mcp"],
      "env": {
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

**Restart:** Completely quit and restart Claude Desktop

**Detailed Guide:** See `CLAUDE_DESKTOP_SETUP.md`

---

### Option B: Windsurf (Cascade)

**Config Location (macOS):**
```
~/.codeium/windsurf/mcp_server_config.json
```

**Add This Configuration (using npx):**
```json
{
  "mcpServers": {
    "filemaker-odata": {
      "command": "npx",
      "args": ["-y", "filemaker-odata-mcp"],
      "env": {
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

**Restart:** Completely quit and restart Windsurf

**Detailed Guide:** See `WINDSURF_SETUP.md`

---

## 3. SSL CONFIGURATION

**Use `FM_VERIFY_SSL: "false"` for:**
- Local development (192.168.x.x)
- Self-signed certificates
- Testing environments

**Use `FM_VERIFY_SSL: "true"` (or omit) for:**
- Production with valid SSL certificates
- Public servers

⚠️ **Security Warning:** Only disable SSL verification in trusted, isolated environments.

---

## 4. TEST CONNECTION

**Via curl:**

```bash
curl -k -u your-username:your-password \
  https://your-filemaker-server.com/fmi/odata/v4/YourDatabase
```

**Expected output:** JSON listing available entity sets.

---

## 5. POSTMAN TESTING (Optional)

**Test URL:**
```
GET https://your-filemaker-server.com/fmi/odata/v4/YourDatabase
```

**Authorization:**
- Type: Basic Auth
- Username: `your-username`
- Password: `your-password`

**Expected:** JSON listing all available entity sets

---

## 6. START USING

### In Claude Desktop or Windsurf, ask:

```
What tables are in my FileMaker database?
```

```
Show me the first 10 records from the Contacts table
```

```
Find all contacts where LastName is 'Smith'
```

**Full prompt guide:** See `CLAUDE_DESKTOP_PROMPTS.md`

---

## COMMON ISSUES

### Tools Not Showing
1. Check absolute path to `dist/index.js`
2. Verify JSON syntax (no trailing commas)
3. Completely restart Claude/Windsurf
4. Run: `node dist/index.js` (should not error)

### Connection Failed
1. Verify FileMaker Server is running
2. Check credentials are correct
3. Test with: `node test-connection.js`
4. For self-signed certs: Use `FM_VERIFY_SSL: "false"`

### SSL Certificate Error
- **Development:** Use `FM_VERIFY_SSL: "false"`
- **Production:** Get valid SSL certificate or use HTTP (not recommended)

---

## ENVIRONMENT VARIABLES

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `FM_SERVER` | Yes | `https://fms.example.com` | FileMaker Server URL |
| `FM_DATABASE` | Yes | `YourDatabase` | Database name |
| `FM_USER` | Yes | `your-username` | Username |
| `FM_PASSWORD` | Yes | `your-password` | Password |
| `FM_VERIFY_SSL` | No | `false` or `true` | Verify SSL (default: `true`) |
| `FM_TIMEOUT` | No | `30000` | Request timeout in ms |
| `MCP_TRANSPORT` | No | `stdio`, `http`, `https` | Transport mode (default: `stdio`) |
| `MCP_PORT` | No | `3333` | Port for HTTP/HTTPS mode |
| `DEBUG` | No | `fms-odata-mcp:*` | Enable debug logging |

---

## AVAILABLE TOOLS (19 Total)

**Data Operations:**
- List tables, Get metadata
- Query records, Get single record
- Count records
- Create, Update, Delete records

**Connection Management:**
- Connect, List connections
- Set/Get current connection

**Configuration:**
- Add/Remove connections
- Set default connection

**Full tool reference:** See `CLAUDE_DESKTOP_PROMPTS.md`

**Docker / HTTP server:** See `../DOCKER.md`

---

## DOCUMENTATION MAP

- **QUICK_REFERENCE.md** - You are here (start here!)
- **CLAUDE_DESKTOP_SETUP.md** - Detailed Claude Desktop setup
- **WINDSURF_SETUP.md** - Detailed Windsurf setup
- **CLAUDE_DESKTOP_PROMPTS.md** - Complete prompt examples & usage guide
- **README.md** - Project overview
- **DOCKER.md** - Docker and HTTP server deployment
- **TESTING_GUIDE.md** - Testing procedures

---

## CONFIGURATION CHECKLIST

- [ ] Server built (`npm run build`)
- [ ] Config file created with correct path
- [ ] Credentials set correctly
- [ ] `FM_VERIFY_SSL` set appropriately
- [ ] Application restarted
- [ ] Connection test successful
- [ ] Tools visible in application

---

## NEED HELP?

1. **Check logs:** Enable `DEBUG: "fms-odata-mcp:*"` in your MCP env config
2. **Verify npx works:** `npx filemaker-odata-mcp --help`
3. **Test FileMaker directly:** `curl -k -u user:pass https://server/fmi/odata/v4/database`
4. **Docker option:** See `../DOCKER.md` for containerized deployment

---

**Quick Setup Time:** ~5 minutes  
**Configuration Complexity:** Simple  
**Prerequisite:** Node.js installed, FileMaker Server accessible
