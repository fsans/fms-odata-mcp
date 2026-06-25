# FileMaker OData MCP - Quick Reference

**One-page guide to get started quickly**

---

## 1. INSTALL THE SERVER

### Option A: NPM (Recommended - no build needed)

```bash
npm install -g fms-odata-mcp
# or use directly without installing:
npx fms-odata-mcp
```

### Option B: Build from Source

```bash
git clone https://github.com/fsans/fms-odata-mcp.git
cd fms-odata-mcp
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
      "args": ["-y", "fms-odata-mcp"],
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
      "args": ["-y", "fms-odata-mcp"],
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

**Detailed Guide:** See Windsurf/Cursor documentation in your IDE settings

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
3. Test with: `curl -k -u user:pass https://server/fmi/odata/v4/database`
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
| `FM_ALLOW_SCHEMA_EDITS` | No | `true` or `false` | Enable schema (DDL) tools (default: `false`) |
| `MCP_TRANSPORT` | No | `stdio`, `http`, `https` | Transport mode (default: `stdio`) |
| `MCP_PORT` | No | `3333` | Port for HTTP/HTTPS mode |
| `DEBUG` | No | `fms-odata-mcp:*` | Enable debug logging |

---

## AVAILABLE TOOLS (35 Total — 29 standard + 6 optional schema editing)

**Data Operations:**
- List tables, Get metadata, Get service document
- Query records, Get single record, Get records
- Count records
- Create, Update, Delete records

**FileMaker 2024/2025+ (connection-free expression builders):**
- `fm_odata_aggregate` — server-side aggregation via `$apply` (FM v22.0.1+ / FM 2025);
  falls back to client-side computation on older servers
- `fm_odata_cast` — type coercion via `Field/Edm.Type` (FM v21.1+ / FM 2024)
- `fm_odata_build_filter` — parameterized `$filter` via `@alias` (FM v21.1+ / FM 2024)

**Connection Management:**
- `fm_odata_connect` — connect with inline credentials
- `fm_odata_connect_multi` — bulk-connect N databases (LOGIC + DATA separation model)
- `fm_odata_set_connection` — switch active session (saved config or runtime alias)
- `fm_odata_list_connections` — list saved connections
- `fm_odata_get_current_connection` — show active connection

**Multi-Session / Multi-File:**
- `fm_odata_list_active_sessions` — list all live sessions with alias, status, and cached FM version
- `fm_odata_describe_sessions` — merged schema across all sessions (table → connection map)
- `fm_odata_get_server_version` — detect FM Server version + feature-compatibility report

All connection-dependent OData tools accept an optional `connection` param to target
a specific session per call without changing the active connection.

**Configuration:**
- Add/Remove/Get/List saved connections
- Set default connection

**Schema Editing (DDL)** — only available when `FM_ALLOW_SCHEMA_EDITS=true`:
- `fm_odata_create_table` — create a table with field definitions
- `fm_odata_add_fields` — add fields to an existing table
- `fm_odata_delete_table` — delete a table (destructive, requires `confirm: true`)
- `fm_odata_delete_field` — delete a field (destructive, requires `confirm: true`)
- `fm_odata_create_index` — create an index on a field
- `fm_odata_delete_index` — delete a field index

**Full tool reference:** See `CLAUDE_DESKTOP_PROMPTS.md`

**Docker / HTTP server:** See `../DOCKER.md`

---

## DOCUMENTATION MAP

- **QUICK_REFERENCE.md** - You are here (start here!)
- **CLAUDE_DESKTOP_SETUP.md** - Detailed Claude Desktop setup
- **CLAUDE_DESKTOP_PROMPTS.md** - Complete prompt examples & usage guide
- **README.md** - Project overview
- **DOCKER.md** - Docker and HTTP server deployment
- **ROADMAP.md** - Completed and planned features

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
2. **Verify npx works:** `npx fms-odata-mcp --help`
3. **Test FileMaker directly:** `curl -k -u user:pass https://server/fmi/odata/v4/database`
4. **Docker option:** See `../DOCKER.md` for containerized deployment

---

**Quick Setup Time:** ~5 minutes  
**Configuration Complexity:** Simple  
**Prerequisite:** Node.js installed, FileMaker Server accessible
