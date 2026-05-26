# Quick Start Testing Guide

## Step 1: Configure Windsurf/Cline to Use the MCP Server

### Option A: Using Environment Variables (Recommended for Testing)

1. **Open Cline MCP Settings**
   - In Windsurf, go to Settings → Extensions → Cline → MCP Settings
   - Or directly edit: `~/.config/Windsurf/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

2. **Add this configuration:**
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

3. **Restart Windsurf** to load the new MCP server

### Option B: Using Inline Connection (No Pre-configuration)

Just start the server and connect via tool call (Step 3 below).

## Step 2: Verify Server is Accessible

```bash
npx filemaker-odata-mcp --help
```

**Expected output:** Help text listing available options and environment variables.

## Step 3: Test in Cline/Windsurf

### Test 1: Connect to FileMaker Server

**What to ask Cline:**
```
Connect to my FileMaker Server:
- Server: https://your-filemaker-server.com
- Database: YourDatabase
- User: your-username
- Password: your-password
```

**What should happen:**
- Cline calls `fm_odata_connect` tool
- Returns: "Connected to http://192.168.0.24/Contacts as fsans"

**If it fails:**
- Check FileMaker Server is running at 192.168.0.24
- Verify OData is enabled in FileMaker Server Admin Console
- Check your network can reach 192.168.0.24

### Test 2: List Available Tables

**What to ask Cline:**
```
List all tables in this database
```

**What should happen:**
- Cline calls `fm_odata_list_tables` tool
- Returns list including: contact, address, phone, email

### Test 3: Get Records

**What to ask Cline:**
```
Show me 3 records from the contact table
```

**What should happen:**
- Cline calls `fm_odata_get_records` tool
- Returns JSON with 3 contact records
- Shows fields like FirstName, LastName, Email, etc.

### Test 4: Query with Filter

**What to ask Cline:**
```
Find contacts where FirstName equals 'John'
```

**What should happen:**
- Cline calls `fm_odata_query_records` tool with filter
- Returns contacts matching the filter

### Test 5: Count Records

**What to ask Cline:**
```
How many total contacts are in the database?
```

**What should happen:**
- Cline calls `fm_odata_count_records` tool
- Returns total count number

### Test 6: Create a Test Record

**What to ask Cline:**
```
Create a new contact:
- FirstName: TestUser
- LastName: MCPTest
- Email: test@mcp.local
```

**What should happen:**
- Cline calls `fm_odata_create_record` tool
- Returns success with new record details
- New record appears in FileMaker

### Test 7: Get Metadata

**What to ask Cline:**
```
Show me the database schema metadata
```

**What should happen:**
- Cline calls `fm_odata_get_metadata` tool
- Returns XML metadata (EDMX format)

## Step 4: Verify in FileMaker Pro

1. Open FileMaker Pro
2. Connect to your Contacts database
3. Check the contact table
4. Verify the test record was created (TestUser MCPTest)

## Common Issues and Solutions

### Issue: "No active connection"

**Solution:**
Make sure you connected first (Test 1). The server needs an active connection before using other tools.

### Issue: "Connection failed"

**Possible causes:**
1. FileMaker Server not running
   - Check: Open FileMaker Server Admin Console
   - Verify: Database is hosted and running

2. OData not enabled
   - Go to FileMaker Server Admin Console → Configuration → OData
   - Enable OData for the Contacts database

3. Wrong credentials
   - Double-check username: fsans
   - Double-check password: wakawaka
   - Verify user has access to Contacts database

4. Network issue
   - Can you ping 192.168.0.24?
   - Try: `ping 192.168.0.24`
   - Try in browser: `http://192.168.0.24/fmi/odata/v4/Contacts`

### Issue: "401 Unauthorized"

**Solution:**
- Verify username and password are correct
- Check user has FileMaker privilege set that allows OData access
- In FileMaker Pro, check Security → Manage Security → Privilege Sets

### Issue: "404 Not Found"

**Solution:**
- Database name is case-sensitive - must be exactly "Contacts"
- Table names are case-sensitive - use "contact" not "Contact"

### Issue: Tools not showing in Cline

**Solution:**
1. Check MCP settings are correct
2. Restart Windsurf completely
3. Check Cline MCP logs for errors
4. Verify the path to dist/index.js is correct

## Debug Mode

To see detailed logs:

```bash
export DEBUG=fms-odata-mcp:*
npx filemaker-odata-mcp
```

This will show all internal operations and help identify issues.

## Manual Testing (Alternative Method)

If Cline integration isn't working, test the server directly:

```bash
# In one terminal, start the server
npx filemaker-odata-mcp

# The server is now running on stdio, waiting for MCP requests
```

## Next Steps After Successful Testing

1. ✅ Test all 22 tools (see full list in TESTING_GUIDE.md)
2. ✅ Try complex queries with multiple filters
3. ✅ Test CRUD operations (Create, Read, Update, Delete)
4. ✅ Save connections for later use
5. ✅ Test with other databases

## Quick Reference: All Available Tools

### OData Operations
- `fm_odata_get_service_document`
- `fm_odata_get_metadata`
- `fm_odata_list_tables`
- `fm_odata_query_records`
- `fm_odata_get_record`
- `fm_odata_get_records`
- `fm_odata_count_records`
- `fm_odata_create_record`
- `fm_odata_update_record`
- `fm_odata_delete_record`

### Connection Management
- `fm_odata_connect`
- `fm_odata_set_connection`
- `fm_odata_list_connections`
- `fm_odata_get_current_connection`

### Configuration Management
- `fm_odata_config_add_connection`
- `fm_odata_config_remove_connection`
- `fm_odata_config_list_connections`
- `fm_odata_config_get_connection`
- `fm_odata_config_set_default_connection`

## Need More Help?

See the comprehensive TESTING_GUIDE.md for:
- Detailed test scenarios
- OData filter syntax examples
- Advanced query options
- Troubleshooting guide
