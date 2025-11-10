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

```json
{
  "mcpServers": {
    "filemaker-odata": {
      "command": "node",
      "args": [
        "/Users/fsans/Desktop/FMS-ODATA-MCP/dist/index.js"
      ],
      "env": {
        "FM_SERVER": "https://192.168.0.24",
        "FM_DATABASE": "Contacts",
        "FM_USER": "admin",
        "FM_PASSWORD": "***REMOVED***"
      }
    }
  }
}
```

**Important Notes:**
- Replace `/Users/fsans/Desktop/FMS-ODATA-MCP` with your actual path if different
- Make sure to use HTTPS (not HTTP)
- If you already have other MCP servers configured, just add the "filemaker-odata" section inside the existing "mcpServers" object

### Step 3: Build the Project (if not done)

```bash
cd /Users/fsans/Desktop/FMS-ODATA-MCP
npm run build
```

### Step 4: Restart Claude Desktop

**Completely close and restart Claude Desktop** for changes to take effect:
1. Quit Claude Desktop completely (not just close the window)
2. Start Claude Desktop again

### Step 5: Verify Connection

In Claude Desktop, try saying:

```
Connect to my FileMaker Server with these credentials:
Server: https://192.168.0.24
Database: Contacts  
User: admin
Password: ***REMOVED***
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
3. Path to `dist/index.js` is correct and absolute (not relative)
4. You completely restarted Claude Desktop

**Test the path:**
```bash
node /Users/fsans/Desktop/FMS-ODATA-MCP/dist/index.js
```
If this doesn't start without errors, the path is wrong or build failed.

### Issue 2: "Connection failed"

**Check:**
1. FileMaker Server is running
2. OData is enabled for the Contacts database
3. Using HTTPS (not HTTP)
4. Credentials are correct

**Test manually:**
```bash
cd /Users/fsans/Desktop/FMS-ODATA-MCP
node test-connection.js
```

### Issue 3: Tools not showing in Claude

**Verify configuration:**
```bash
# Check if config file exists
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Check if build succeeded
ls -la /Users/fsans/Desktop/FMS-ODATA-MCP/dist/
```

### Issue 4: "Permission denied" errors

**Fix permissions:**
```bash
cd /Users/fsans/Desktop/FMS-ODATA-MCP
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
      "command": "node",
      "args": [
        "/Users/fsans/Desktop/FMS-ODATA-MCP/dist/index.js"
      ]
    }
  }
}
```

### 3. Make sure .env is in the project root with:
```
FM_SERVER=https://192.168.0.24
FM_DATABASE=Contacts
FM_USER=admin
FM_PASSWORD=***REMOVED***
```

## Verify MCP Server is Working

### Test 1: Check if server starts
```bash
cd /Users/fsans/Desktop/FMS-ODATA-MCP
node dist/index.js
```
Should show:
```
Starting FMS-ODATA-MCP Server...
Transport: stdio
Registered 19 tools
FMS-ODATA-MCP Server running on stdio
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

```json
{
  "mcpServers": {
    "filemaker-odata": {
      "command": "node",
      "args": [
        "/Users/fsans/Desktop/FMS-ODATA-MCP/dist/index.js"
      ],
      "env": {
        "FM_SERVER": "https://192.168.0.24",
        "FM_DATABASE": "Contacts",
        "FM_USER": "admin",
        "FM_PASSWORD": "***REMOVED***",
        "DEBUG": "fms-odata-mcp:*"
      }
    }
  }
}
```

The `DEBUG` line is optional but helpful for troubleshooting.

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
3. **Test the server manually**: `node test-connection.js`
4. **Verify FileMaker Server access**: `curl -k -u admin:***REMOVED*** https://192.168.0.24/fmi/odata/v4/Contacts`

## Need More Help?

Run this diagnostic:
```bash
cd /Users/fsans/Desktop/FMS-ODATA-MCP
echo "=== Testing MCP Server ==="
node test-connection.js
echo ""
echo "=== Checking Claude Config ==="
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
echo ""
echo "=== Checking Build ==="
ls -la dist/
```

Send the output for detailed help.
