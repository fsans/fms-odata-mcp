# Testing Guide - FMS-ODATA-MCP

## Test Environment Setup

### Local FileMaker Server Configuration
- **Host**: 192.168.0.24
- **User**: fsans
- **Password**: wakawaka
- **Database**: Contacts

### Available Tables
- `contact` - Main contact table
- `address` - Address information
- `phone` - Phone numbers
- `email` - Email addresses

### Available Layouts
- `contact` - Contact layout for OData access

### Test Scripts
- `handle_remote_call` - Accepts JSON parameter, returns same parameter

## Testing with Cline/Claude Desktop

### Step 1: Start the Server

```bash
cd /Users/fsans/Documents/GitHub/FMS-ODATA-MCP
npm run build
npm start
```

Or use the dev command:
```bash
npm run dev
```

### Step 2: Configure MCP in Windsurf/Cline

Add to your MCP settings (`~/.config/Windsurf/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`):

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

## Test Scenarios

### Test 1: Connection
```
Ask Cline: "Connect to the FileMaker Server using these credentials:
- Server: https://your-filemaker-server.com
- Database: YourDatabase
- User: your-username
- Password: your-password"
```

**Expected Tool Call**: `fm_odata_connect`

**Expected Result**: "Connected to https://your-filemaker-server.com/YourDatabase as your-username"

### Test 2: List Tables
```
Ask Cline: "List all available tables in the database"
```

**Expected Tool Call**: `fm_odata_list_tables`

**Expected Result**: List containing: contact, address, phone, email

### Test 3: Query Records
```
Ask Cline: "Get all records from the contact table, limit to 5"
```

**Expected Tool Call**: `fm_odata_get_records` or `fm_odata_query_records`

**Expected Result**: JSON array with up to 5 contact records

### Test 4: Query with Filter
```
Ask Cline: "Find contacts where FirstName equals 'John'"
```

**Expected Tool Call**: `fm_odata_query_records` with filter parameter

**Expected Result**: Filtered contact records

### Test 5: Get Metadata
```
Ask Cline: "Show me the database schema/metadata"
```

**Expected Tool Call**: `fm_odata_get_metadata`

**Expected Result**: XML metadata document (EDMX)

### Test 6: Count Records
```
Ask Cline: "How many contacts are in the database?"
```

**Expected Tool Call**: `fm_odata_count_records`

**Expected Result**: Total count number

### Test 7: Create Record
```
Ask Cline: "Create a new contact with FirstName='Test', LastName='User', Email='test@example.com'"
```

**Expected Tool Call**: `fm_odata_create_record`

**Expected Result**: Success message with new record details

### Test 8: Get Single Record
```
Ask Cline: "Get the contact record with ID '1'"
```

**Expected Tool Call**: `fm_odata_get_record`

**Expected Result**: Single contact record

### Test 9: Update Record
```
Ask Cline: "Update contact ID '1', set Email to 'newemail@example.com'"
```

**Expected Tool Call**: `fm_odata_update_record`

**Expected Result**: Success message

### Test 10: Delete Record
```
Ask Cline: "Delete the contact with ID '999'"
```

**Expected Tool Call**: `fm_odata_delete_record`

**Expected Result**: Success message

### Test 11: Query with Multiple Options
```
Ask Cline: "Get contacts, filter by LastName='Smith', order by FirstName ascending, limit to 10, select only FirstName, LastName, and Email fields"
```

**Expected Tool Call**: `fm_odata_query_records` with multiple parameters

**Expected Result**: Filtered, ordered, limited results with selected fields

### Test 12: Configuration Management
```
Ask Cline: "Save this connection as 'local' for future use"
```

**Expected Tool Call**: `fm_odata_config_add_connection`

**Expected Result**: Connection saved successfully

## Manual Testing with curl (HTTP Transport)

If running in HTTP mode:

```bash
# Set environment
export MCP_TRANSPORT=http
export MCP_PORT=3000
npm start

# Test health endpoint
curl http://localhost:3000/health

# Test MCP endpoint
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/list"}'
```

## Debugging

### Enable Debug Logging
```bash
export DEBUG=fms-odata-mcp:*
npm start
```

### Check Logs
```bash
tail -f logs/server.log
```

### Common Issues

#### Connection Failed
- Verify FileMaker Server is running
- Check network connectivity to 192.168.0.24
- Verify OData is enabled in FileMaker Server
- Check credentials are correct

#### 401 Unauthorized
- Verify username and password
- Check user has appropriate privileges in FileMaker

#### 404 Not Found - Table/Database
- Verify database name is correct (case-sensitive)
- Verify table name matches the actual FileMaker table name
- Check OData is enabled for the database

#### Empty Results
- Check if there are records in the table
- Verify filter syntax is correct for OData 4.01
- Use fm_odata_count_records to verify records exist

## OData Filter Syntax Examples

```
# Equality
FirstName eq 'John'

# Greater than
Age gt 25

# Less than
Age lt 65

# And
FirstName eq 'John' and LastName eq 'Smith'

# Or
FirstName eq 'John' or FirstName eq 'Jane'

# Contains (use 'contains' function)
contains(Email, '@example.com')

# Starts with
startswith(LastName, 'Sm')

# Ends with
endswith(Email, '.com')
```

## Expected Behaviors

### Tool Responses
- All tools return `content` array with `text` type
- Errors include `isError: true`
- Success messages are clear and informative
- Data is formatted as JSON (pretty-printed)

### Connection Management
- Inline connections (`fm_odata_connect`) don't persist
- Configuration connections (`fm_odata_config_add_connection`) persist in `~/.fms-odata-mcp/config.json`
- Current connection is maintained throughout session
- Connection testing happens automatically

### Error Handling
- Clear error messages
- HTTP errors are caught and formatted
- OData errors are parsed and displayed
- Network errors are handled gracefully

### Test 13: Multi-Session Connect

```
Ask Cline: "Connect to two databases: LOGIC file at https://your-server.com
database 'CRM_Logic' and DATA file database 'CRM_Data', both using
username 'api' and password 'secret'. Call them 'logic' and 'data'."
```

**Expected Tool Call**: `fm_odata_connect_multi`

**Expected Result**: Both sessions connected; primary session set to "logic"

### Test 14: List Active Sessions

```
Ask Cline: "List all my active FileMaker sessions"
```

**Expected Tool Call**: `fm_odata_list_active_sessions`

**Expected Result**: JSON list of sessions with alias, server, database, user, isCurrent flag

### Test 15: Per-Call Connection Targeting

```
Ask Cline: "Query the contact table using the 'data' session"
```

**Expected Tool Call**: `fm_odata_query_records` with `connection: "data"`

**Expected Result**: Records from the "data" session without changing active session

### Test 16: Server Version Detection

```
Ask Cline: "What version of FileMaker Server am I connected to?"
```

**Expected Tool Call**: `fm_odata_get_server_version`

**Expected Result**: JSON with `version` (e.g. `"22.0.1.300"`), `features` map
showing which capabilities are supported

### Test 17: Describe Sessions (Multi-File Schema)

```
Ask Cline: "Show me the merged schema across all my active sessions"
```

**Expected Tool Call**: `fm_odata_describe_sessions`

**Expected Result**: Flat table list annotated with which session each table comes
from; collision warnings if the same table name appears in multiple sessions

---

## Next Steps After Testing

1. Report any bugs or issues
2. Test with different FileMaker databases
3. Test all 26 tools
4. Verify OData filter expressions work correctly
5. Test with related records (expand parameter)
6. Test multi-file solutions with `fm_odata_connect_multi`
7. Performance testing with large datasets
