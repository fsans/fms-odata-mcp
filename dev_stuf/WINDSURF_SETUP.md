# Windsurf (Cascade) MCP Configuration Guide

## Setting Up FileMaker OData MCP in Windsurf

Windsurf uses its own MCP configuration system separate from Claude Desktop. Here's how to set it up.

## Step 1: Locate Windsurf Configuration

Windsurf stores its MCP configuration in:

**macOS:**
```
~/.codeium/windsurf/mcp_server_config.json
```

**Windows:**
```
%USERPROFILE%\.codeium\windsurf\mcp_server_config.json
```

**Linux:**
```
~/.codeium/windsurf/mcp_server_config.json
```

## Step 2: Install the MCP Server

### Option A: NPM (Recommended)

```bash
npm install -g filemaker-odata-mcp
```

### Option B: Build from Source

```bash
git clone https://github.com/fsans/FMS-ODATA-MCP.git
cd FMS-ODATA-MCP
npm install && npm run build
```

## Step 3: Configure for Windsurf

Edit or create the Windsurf MCP configuration file:

```bash
# Create directory if it doesn't exist
mkdir -p ~/.codeium/windsurf

# Edit the configuration
code ~/.codeium/windsurf/mcp_server_config.json
```

Add this configuration:

```json
{
  "mcpServers": {
    "filemaker-odata": {
      "command": "npx",
      "args": [
        "-y",
        "filemaker-odata-mcp"
      ],
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

**Important:**
- Use absolute paths (not relative)
- Make sure path matches your actual installation directory
- For Windows, use forward slashes or double backslashes: `C:/Users/...` or `C:\\Users\\...`

## Step 4: Restart Windsurf

**Completely restart Windsurf:**
1. Close all Windsurf windows
2. Quit Windsurf completely from the dock/taskbar
3. Start Windsurf again

## Step 5: Verify Configuration

### Check if MCP Server is Loaded

In Windsurf's Cascade (AI chat), the MCP tools should now be available. Try asking:

```
What MCP tools are available?
```

Or specifically:

```
List all FileMaker tables
```

## Testing the Connection

### Quick Test from Terminal

```bash
curl -k -u your-username:your-password \
  https://your-filemaker-server.com/fmi/odata/v4/YourDatabase
```

Should return a JSON response listing available entity sets.

## Complete Configuration Examples

### Example 1: Development (Self-Signed Certificate)

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
        "FM_VERIFY_SSL": "false",
        "DEBUG": "fms-odata-mcp:*"
      }
    }
  }
}
```

### Example 2: Production (Valid SSL)

```json
{
  "mcpServers": {
    "filemaker-odata": {
      "command": "npx",
      "args": ["-y", "filemaker-odata-mcp"],
      "env": {
        "FM_SERVER": "https://filemaker.company.com",
        "FM_DATABASE": "Production",
        "FM_USER": "api_user",
        "FM_PASSWORD": "secure_password",
        "FM_VERIFY_SSL": "true"
      }
    }
  }
}
```

### Example 3: Multiple Connections

```json
{
  "mcpServers": {
    "filemaker-dev": {
      "command": "npx",
      "args": ["-y", "filemaker-odata-mcp"],
      "env": {
        "FM_SERVER": "https://your-filemaker-server.com",
        "FM_DATABASE": "YourDatabase",
        "FM_USER": "your-username",
        "FM_PASSWORD": "your-password",
        "FM_VERIFY_SSL": "false"
      }
    },
    "filemaker-prod": {
      "command": "npx",
      "args": ["-y", "filemaker-odata-mcp"],
      "env": {
        "FM_SERVER": "https://production.company.com",
        "FM_DATABASE": "CRM",
        "FM_USER": "api_user",
        "FM_PASSWORD": "prod_password",
        "FM_VERIFY_SSL": "true"
      }
    }
  }
}
```

## Using the MCP Tools in Windsurf

Once configured, you can use these commands in Cascade:

### Connection Commands

```
Connect to FileMaker Server
```

```
Switch to saved connection "production"
```

```
Show current FileMaker connection
```

### Data Queries

```
List all tables in my FileMaker database
```

```
Show me the first 10 contacts
```

```
Find contacts where first_name is "John"
```

```
Count how many records are in the contact table
```

### Data Manipulation

```
Create a new contact with:
- first_name: "Jane"
- last_name: "Doe"
- email: "jane@example.com"
```

```
Update contact with ID 123 to set email to "newemail@example.com"
```

## Troubleshooting

### Issue 1: MCP Server Not Loading

**Symptoms:**
- Cascade doesn't show FileMaker tools
- No error messages

**Solutions:**
1. Verify npx can run the server:
   ```bash
   npx filemaker-odata-mcp --help
   ```

2. Verify JSON syntax:
   ```bash
   cat ~/.codeium/windsurf/mcp_server_config.json | python3 -m json.tool
   ```

3. Check Windsurf logs:
   - Open Windsurf Developer Tools
   - Look for MCP-related errors

4. Restart Windsurf completely

### Issue 2: Connection Failed

**Symptoms:**
- Tools load but can't connect
- "Connection failed" errors

**Solutions:**
1. Verify FileMaker Server is accessible:
   ```bash
   curl -k -u your-username:your-password https://your-filemaker-server.com/fmi/odata/v4/YourDatabase
   ```

2. Check credentials in config file

3. Ensure HTTPS (not HTTP)

4. For self-signed certificates, use `FM_VERIFY_SSL: "false"`

5. Test FileMaker directly:
   ```bash
   curl -k -u your-username:your-password https://your-filemaker-server.com/fmi/odata/v4/YourDatabase
   ```

### Issue 3: Tools Load But Don't Work

**Symptoms:**
- Tools appear in Cascade
- Commands fail or timeout

**Solutions:**
1. Check environment variables are set correctly

2. Enable debug mode:
   ```json
   "env": {
     "DEBUG": "fms-odata-mcp:*",
     ...
   }
   ```

3. Check Windsurf console for errors

4. Verify npx is working:
   ```bash
   npx filemaker-odata-mcp --help
   ```

### Issue 4: Permission Errors

**Solutions:**
```bash
chmod 644 ~/.codeium/windsurf/mcp_server_config.json
npx filemaker-odata-mcp --help
```

## Windsurf vs Claude Desktop

Key differences:

| Feature | Windsurf | Claude Desktop |
|---------|----------|----------------|
| Config Location | `~/.codeium/windsurf/` | `~/Library/Application Support/Claude/` |
| Config File | `mcp_server_config.json` | `claude_desktop_config.json` |
| Restart Required | Yes, full restart | Yes, full quit/restart |
| Debug Access | Developer Tools | Console.app logs |
| Multiple Instances | Can run both | Can run both |

**Important:** You can have BOTH configurations active simultaneously. Windsurf and Claude Desktop use separate config files, so the same MCP server can work in both applications at the same time.

## Verify Setup

Run this diagnostic script:

```bash
#!/bin/bash

echo "=== FileMaker OData MCP Diagnostic ==="
echo ""

echo "1. Checking if npx can run the server..."
npx filemaker-odata-mcp --help > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "   ✓ npx filemaker-odata-mcp OK"
else
  echo "   ✗ npx not working - check Node.js install"
fi

echo ""
echo "2. Checking Windsurf config..."
if [ -f "$HOME/.codeium/windsurf/mcp_server_config.json" ]; then
  echo "   ✓ Config file exists"
  echo "   Content:"
  cat "$HOME/.codeium/windsurf/mcp_server_config.json"
else
  echo "   ✗ Config file not found"
  echo "   Create it at: ~/.codeium/windsurf/mcp_server_config.json"
fi

echo ""
echo "3. Testing FileMaker connection..."
curl -sk -u "$FM_USER:$FM_PASSWORD" "$FM_SERVER/fmi/odata/v4/$FM_DATABASE" | head -c 200

echo ""
echo "=== Diagnostic Complete ==="
```

Save as `windsurf-diagnostic.sh` and run:
```bash
chmod +x windsurf-diagnostic.sh
./windsurf-diagnostic.sh
```

## Quick Start Checklist

- [ ] MCP server is built (`npm run build`)
- [ ] Config file created at `~/.codeium/windsurf/mcp_server_config.json`
- [ ] Absolute path to `dist/index.js` is correct
- [ ] FileMaker credentials are correct
- [ ] `FM_VERIFY_SSL` set to `"false"` for self-signed certificates
- [ ] Windsurf completely restarted
- [ ] Test connection works: `node test-connection.js`
- [ ] Tools visible in Cascade AI chat

## Need Help?

If you're still having issues:

1. **Run the diagnostic script above**
2. **Check Windsurf Developer Tools** (Help > Toggle Developer Tools)
3. **Look for MCP-related errors** in the console
4. **Verify FileMaker Server** is accessible: `curl -k https://192.168.0.24/fmi/odata/v4/Contacts`
5. **Test the MCP server manually**: `node dist/index.js` (should not exit immediately)

## Additional Resources

- **Project Documentation**: See DEPLOYMENT_SCENARIOS.md for detailed deployment options
- **Testing Guide**: See TESTING_GUIDE.md for testing procedures
- **Quick Start**: See QUICK_START_TEST.md for rapid testing

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FM_SERVER` | Yes | - | FileMaker Server URL (must be HTTPS) |
| `FM_DATABASE` | Yes | - | Database name |
| `FM_USER` | Yes | - | Username |
| `FM_PASSWORD` | Yes | - | Password |
| `FM_VERIFY_SSL` | No | true | Verify SSL certificates (false for self-signed) |
| `FM_TIMEOUT` | No | 30000 | Request timeout in milliseconds |
| `DEBUG` | No | `fms-odata-mcp:*` | Enable debug logging |

## Success!

Once configured correctly, you should see 19 MCP tools available in Windsurf's Cascade interface:

**OData Tools (10)**
- fm_odata_get_service_document
- fm_odata_get_metadata
- fm_odata_list_tables
- fm_odata_query_records
- fm_odata_get_record
- fm_odata_get_records
- fm_odata_count_records
- fm_odata_create_record
- fm_odata_update_record
- fm_odata_delete_record

**Connection Tools (4)**
- fm_odata_connect
- fm_odata_set_connection
- fm_odata_list_connections
- fm_odata_get_current_connection

**Configuration Tools (5)**
- fm_odata_config_add_connection
- fm_odata_config_remove_connection
- fm_odata_config_list_connections
- fm_odata_config_get_connection
- fm_odata_config_set_default_connection

Now you can interact with your FileMaker database directly from Windsurf's Cascade!
