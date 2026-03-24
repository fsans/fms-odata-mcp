# Claude Desktop MCP Configuration Guide

## Step-by-Step Setup for Claude Desktop

### Step 1: Find Claude Desktop Configuration File

The configuration file location depends on your OS:

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

### Step 2: Edit Configuration File

Open the file in a text editor and add this configuration:

**For Development/Testing (Self-Signed Certificates):**
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

**For Production (Valid SSL Certificates):**
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

**Important Notes:**
- `npx -y filemaker-odata-mcp` automatically uses the latest published version (no local install needed)
- Use HTTPS (not HTTP) for FileMaker Server URLs
- Set `FM_VERIFY_SSL` to `"false"` only for development/testing with self-signed certificates
- Set `FM_VERIFY_SSL` to `"true"` (or omit it) for production with valid SSL certificates
- If you already have other MCP servers configured, just add the "filemaker-odata" section inside the existing "mcpServers" object

### SSL Configuration Guide

**When to use `FM_VERIFY_SSL: "false"`:**
- Local development with self-signed certificates
- Testing environments
- Internal networks without proper SSL setup

**When to use `FM_VERIFY_SSL: "true"` (or omit):**
- Production environments
- Public-facing servers
- Any server with valid, trusted SSL certificates

**Security Warning:** Disabling SSL verification (`"false"`) makes connections vulnerable to man-in-the-middle attacks. Only use this in trusted, isolated environments.

### Step 3: Install Node.js (if not done)

Ensure Node.js 18+ is installed:

```bash
node --version
```

If using `npx`, no separate build or install step is needed — it fetches `filemaker-odata-mcp` automatically.

### Step 4: Restart Claude Desktop

**Completely close and restart Claude Desktop** for changes to take effect:
1. Quit Claude Desktop completely (not just close the window)
2. Start Claude Desktop again

### Step 5: Verify Connection

In Claude Desktop, try saying:

```
Connect to my FileMaker Server with these credentials:
Server: https://your-filemaker-server.com
Database: YourDatabase  
User: your-username
Password: your-password
```

Or simply:
```
List all available FileMaker tables
```

## Troubleshooting

### Issue 1: "MCP server not found" or "No tools available"

**Check:**
1. Configuration file path is correct for your OS
2. File is valid JSON (use a JSON validator)
3. `npx` is available: `npx --version`
4. You completely restarted Claude Desktop

**Test npx works:**
```bash
npx filemaker-odata-mcp --help
```

### Issue 2: "Connection failed"

**Check:**
1. FileMaker Server is running
2. OData is enabled for the Contacts database
3. Using HTTPS (not HTTP)
4. Credentials are correct

**Test manually:**
```bash
curl -k -u your-username:your-password \
  https://your-filemaker-server.com/fmi/odata/v4/YourDatabase
```

### Issue 3: Tools not showing in Claude

**Verify configuration:**
```bash
# Check if config file exists
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Verify npx can find the package
npx filemaker-odata-mcp --help
```

### Issue 4: "Permission denied" errors

**Fix permissions (local install only):**
```bash
chmod +x dist/index.js
npm run build
```

## Alternative: Using Environment from Separate File

If you prefer not to put credentials directly in the config, you can use a .env file:

### 1. Create .env file (already created as .env.test)
```bash
cp .env.test .env
```

### 2. Update Claude config to NOT include env vars:
```json
{
  "mcpServers": {
    "filemaker-odata": {
      "command": "npx",
      "args": [
        "-y",
        "filemaker-odata-mcp"
      ]
    }
  }
}
```

### 3. Make sure .env is in the project root with:
```
FM_SERVER=https://your-filemaker-server.com
FM_DATABASE=YourDatabase
FM_USER=your-username
FM_PASSWORD=your-password
```

## Verify MCP Server is Working

### Test 1: Check if server starts
```bash
npx filemaker-odata-mcp
```
Should show:
```
Starting filemaker-odata-mcp Server...
Transport: stdio
Registered 19 tools
filemaker-odata-mcp Server running on stdio
```

Press Ctrl+C to stop.

### Test 2: Check configuration syntax
```bash
# Validate JSON
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | python3 -m json.tool
```
Should output formatted JSON without errors.

## Complete Working Example

Here's a complete example of what your `claude_desktop_config.json` should look like:

**Development/Testing (with self-signed certificates):**
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
        "FM_VERIFY_SSL": "false",
        "DEBUG": "fms-odata-mcp:*"
      }
    }
  }
}
```

**Production (with valid SSL certificates):**
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

**Note:** The `DEBUG` line is optional but helpful for troubleshooting. The `FM_VERIFY_SSL` setting is critical - use `"false"` only for development/testing with self-signed certificates.

## What to Tell Claude

Once configured, you can ask Claude:

1. **To connect:**
   - "Connect to my FileMaker database"
   - "Use the FileMaker OData connection"

2. **To query:**
   - "List all tables in my database"
   - "Show me contacts from the contact table"
   - "How many records are in the contact table?"

3. **To manage data:**
   - "Create a new contact with name John Doe"
   - "Update contact ID 123 with email john@example.com"
   - "Find all contacts where first name is John"

## Still Not Working?

If you still have issues:

1. **Check Claude Desktop logs** (usually in Console.app on Mac)
2. **Enable debug mode** by adding `"DEBUG": "fms-odata-mcp:*"` to env in config
3. **Test npx works**: `npx filemaker-odata-mcp --help`
4. **Verify FileMaker Server access**: `curl -k -u your-username:your-password https://your-filemaker-server.com/fmi/odata/v4/YourDatabase`

## Need More Help?

Run this diagnostic:
```bash
echo "=== Testing npx ==="
npx filemaker-odata-mcp --help
echo ""
echo "=== Checking Claude Config ==="
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
echo ""
echo "=== Testing FileMaker Access ==="
curl -k -u your-username:your-password https://your-filemaker-server.com/fmi/odata/v4/YourDatabase
```

Send the output for detailed help.
