# FileMaker OData MCP - Quick Reference

**One-page guide to get started quickly**

---

## 1. BUILD THE SERVER

```bash
cd /Users/fsans/Desktop/FMS-ODATA-MCP
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

**Add This Configuration:**
```json
{
  "mcpServers": {
    "filemaker-odata": {
      "command": "node",
      "args": ["/Users/fsans/Desktop/FMS-ODATA-MCP/dist/index.js"],
      "env": {
        "FM_SERVER": "https://192.168.0.24",
        "FM_DATABASE": "Contacts",
        "FM_USER": "admin",
        "FM_PASSWORD": "***REMOVED***",
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

**Add This Configuration:**
```json
{
  "mcpServers": {
    "filemaker-odata": {
      "command": "node",
      "args": ["/Users/fsans/Desktop/FMS-ODATA-MCP/dist/index.js"],
      "env": {
        "FM_SERVER": "https://192.168.0.24",
        "FM_DATABASE": "Contacts",
        "FM_USER": "admin",
        "FM_PASSWORD": "***REMOVED***",
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

```bash
cd /Users/fsans/Desktop/FMS-ODATA-MCP
node test-connection.js
```

**Expected output:**
```
✓ Connection successful
✓ 15 tables discovered
✓ 99 contact records accessible
```

---

## 5. POSTMAN TESTING (Optional)

**Test URL:**
```
GET https://192.168.0.24/fmi/odata/v4/Contacts
```

**Authorization:**
- Type: Basic Auth
- Username: admin
- Password: ***REMOVED***

**Expected:** JSON listing all available tables

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
| `FM_SERVER` | Yes | `https://192.168.0.24` | Server URL (must be HTTPS) |
| `FM_DATABASE` | Yes | `Contacts` | Database name |
| `FM_USER` | Yes | `admin` | Username |
| `FM_PASSWORD` | Yes | `***REMOVED***` | Password |
| `FM_VERIFY_SSL` | No | `false` or `true` | Verify SSL (default: true) |
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

**Full tool reference:** See `CLAUDE_DESKTOP_PROMPTS.md` Section 12

---

## DOCUMENTATION MAP

- **QUICK_REFERENCE.md** ← You are here (start here!)
- **CLAUDE_DESKTOP_SETUP.md** - Detailed Claude Desktop setup
- **WINDSURF_SETUP.md** - Detailed Windsurf setup
- **CLAUDE_DESKTOP_PROMPTS.md** - Complete prompt examples & usage guide
- **README.md** - Project overview
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

1. **Run diagnostics:** `node test-connection.js`
2. **Check logs:** Enable `DEBUG: "fms-odata-mcp:*"`
3. **Verify build:** `ls -la dist/index.js`
4. **Test manually:** `curl -k -u user:pass https://server/fmi/odata/v4/database`

---

**Quick Setup Time:** ~5 minutes  
**Configuration Complexity:** Simple  
**Prerequisite:** Node.js installed, FileMaker Server accessible
