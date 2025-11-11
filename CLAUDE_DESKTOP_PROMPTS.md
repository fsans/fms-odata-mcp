# FileMaker OData MCP - Claude Desktop Prompt Reference

Quick reference guide for querying FileMaker Server data in Claude Desktop.

---

## 1. INITIAL CONNECTION

### Connect with Inline Credentials (Temporary)
```
Connect to my FileMaker server at http://192.168.0.24, 
database "Contacts", username "admin", password "mypassword"
```

### Use Pre-configured Connection
```
Switch to my "production" FileMaker connection
```

### List Available Connections
```
Show me all my FileMaker connections
```

### Check Current Connection
```
What FileMaker connection am I using?
```

---

## 2. DISCOVERY - START HERE AFTER CONNECTING

### List All Tables
```
What tables are in my FileMaker database?
```

### Get Database Schema/Metadata
```
Show me the metadata for my FileMaker database
```

### Get Service Document
```
Get the OData service document
```

---

## 3. SIMPLE QUERIES

### Get All Records
```
Show me all records from the Contacts table
```

### Get First N Records
```
Get the first 10 records from the Invoices table
```

### Get Specific Record by ID
```
Get record ID '12345' from the Contacts table
```

### Count All Records
```
How many records are in the Customers table?
```

---

## 4. FILTERED QUERIES

### Simple Filter
```
Find all contacts where LastName is 'Smith'
```

### Numeric Comparison
```
Show me invoices where Amount is greater than 1000
```

### Count with Filter
```
Count how many invoices have Status eq 'Pending'
```

### Multiple Conditions
```
Find contacts where City eq 'New York' and Status eq 'Active'
```

---

## 5. ADVANCED QUERIES

### Select Specific Fields Only
```
Get all contacts but only return FirstName, LastName, and Email fields
```

### Sort Results
```
Get all products ordered by Price descending
```

### Pagination (Skip/Top)
```
Get contacts 21-40 (skip first 20, get next 20)
```

### Complex Query with Multiple Options
```
Query the Contacts table, filter by City eq 'New York', 
select only FirstName, LastName, Email, order by LastName, 
and return the top 20 results
```

### Include Related Records (Expand)
```
Query Invoices and expand the Customer relationship
```

---

## 6. CREATE RECORDS

### Basic Create
```
Create a new contact with FirstName 'John', LastName 'Doe', 
Email 'john@example.com' in the Contacts table
```

### Create with Multiple Fields
```
Create a new invoice in Invoices table with 
InvoiceNumber '2024-001', CustomerID '123', 
Amount 1500.00, Status 'Pending'
```

---

## 7. UPDATE RECORDS

### Update Single Field
```
Update record '12345' in Contacts table, set Email to 'newemail@example.com'
```

### Update Multiple Fields
```
Update record '67890' in Invoices table, 
set Status to 'Paid' and PaidDate to '2024-01-15'
```

---

## 8. DELETE RECORDS

### Delete Single Record
```
Delete record '12345' from the Contacts table
```

---

## 9. ODATA FILTER SYNTAX REFERENCE

| Operator | OData Syntax | Example |
|----------|--------------|---------|
| Equals | `eq` | `Status eq 'Active'` |
| Not Equals | `ne` | `Status ne 'Deleted'` |
| Greater Than | `gt` | `Amount gt 1000` |
| Greater or Equal | `ge` | `Age ge 18` |
| Less Than | `lt` | `Price lt 50` |
| Less or Equal | `le` | `Quantity le 100` |
| And | `and` | `Status eq 'Active' and Age gt 18` |
| Or | `or` | `City eq 'NYC' or City eq 'LA'` |
| Not | `not` | `not (Status eq 'Deleted')` |

---

## 10. NATURAL LANGUAGE EXAMPLES

You can also ask in natural language - Claude will translate to the correct tool calls:

```
"What customers do I have in California?"
"Show me the 5 most recent orders"
"Find all unpaid invoices from last month"
"How many active projects are there?"
"Create a new customer record for Acme Corp"
"Update customer 123's email address"
"Delete the test record with ID 999"
```

---

## 11. CONFIGURATION MANAGEMENT (OPTIONAL)

### Save Connection Permanently
```
Add a new connection named "production" for server http://192.168.0.24, 
database "CRM", username "admin", password "secret"
```

### Remove Saved Connection
```
Remove the saved connection named "staging"
```

### Set Default Connection
```
Set "production" as my default FileMaker connection
```

---

## 12. TOOL REFERENCE TABLE

| Category | Tool Name | Purpose |
|----------|-----------|---------|
| **Connection** | `fm_odata_connect` | Connect with inline credentials |
| | `fm_odata_set_connection` | Use saved connection |
| | `fm_odata_list_connections` | List all connections |
| | `fm_odata_get_current_connection` | Show current connection |
| **Discovery** | `fm_odata_get_service_document` | Get service document |
| | `fm_odata_get_metadata` | Get metadata XML |
| | `fm_odata_list_tables` | List all tables |
| **Query** | `fm_odata_query_records` | Advanced query with filters |
| | `fm_odata_get_record` | Get single record by ID |
| | `fm_odata_get_records` | Simple get records |
| | `fm_odata_count_records` | Count records |
| **CRUD** | `fm_odata_create_record` | Create new record |
| | `fm_odata_update_record` | Update existing record |
| | `fm_odata_delete_record` | Delete record |
| **Config** | `fm_odata_config_add_connection` | Save connection |
| | `fm_odata_config_remove_connection` | Remove connection |
| | `fm_odata_config_list_connections` | List saved connections |
| | `fm_odata_config_set_default_connection` | Set default |

---

## 13. WORKFLOW TIPS

1. **Always connect first** before querying data
2. **Start with discovery** - run `What tables are in my database?`
3. **Use natural language** - Claude will translate to correct tool calls
4. **Include table names** - Be specific about which table you're querying
5. **Test with simple queries** before complex filters
6. **Use OData syntax** for precise filtering when needed

---

## 14. COMMON PATTERNS

### Pattern: Explore → Query → Create
```
1. "What tables are in my database?"
2. "Show me the first 5 records from Contacts"
3. "Create a new contact with FirstName 'Jane', LastName 'Smith'"
```

### Pattern: Filter → Count → Export
```
1. "Find all contacts where City eq 'Boston'"
2. "Count how many contacts have City eq 'Boston'"
3. "Get all Boston contacts with only Name and Email fields"
```

### Pattern: Find → Update → Verify
```
1. "Get record '12345' from Contacts"
2. "Update record '12345', set Email to 'new@email.com'"
3. "Get record '12345' from Contacts"
```

---

## 15. TESTING WITH POSTMAN

Before using with Claude Desktop, you can test your FileMaker OData connection with Postman:

### URL Structure
```
{server}/fmi/odata/v4/{database-name}
```

### Example URLs to Test

**1. Service Document (List all tables)**
```
GET http://192.168.0.24/fmi/odata/v4/Contacts
```

**2. Metadata (Database schema)**
```
GET http://192.168.0.24/fmi/odata/v4/Contacts/$metadata
```

**3. Query a Table**
```
GET http://192.168.0.24/fmi/odata/v4/Contacts/YourTableName
```

**4. Count Records**
```
GET http://192.168.0.24/fmi/odata/v4/Contacts/YourTableName/$count
```

### Postman Setup

1. **Method**: GET
2. **URL**: Use one of the URLs above
3. **Authorization**: 
   - Type: Basic Auth
   - Username: Your FileMaker username
   - Password: Your FileMaker password
4. **Headers**: 
   - `Accept: application/json` (optional, OData defaults to JSON)

### Example: Testing Service Document

1. Open Postman
2. Create new GET request
3. URL: `http://your-server/fmi/odata/v4/your-database`
4. Go to Authorization tab → Select "Basic Auth"
5. Enter your FileMaker username and password
6. Click "Send"

**Expected Response**: JSON showing all available tables/entity sets

### Example: Testing a Table Query

1. URL: `http://your-server/fmi/odata/v4/your-database/contacts?$top=5`
2. Authorization: Basic Auth with credentials
3. Click "Send"

**Expected Response**: JSON array with first 5 records from contacts table

### Common Postman Test URLs

```
# Service document
http://your-server/fmi/odata/v4/your-database

# Metadata XML
http://your-server/fmi/odata/v4/your-database/$metadata

# First 10 records from a table
http://your-server/fmi/odata/v4/your-database/TableName?$top=10

# Filtered query
http://your-server/fmi/odata/v4/your-database/TableName?$filter=Status eq 'Active'

# Count records
http://your-server/fmi/odata/v4/your-database/TableName/$count
```

### Troubleshooting Postman Tests

- **401 Unauthorized**: Check username/password
- **404 Not Found**: Verify server URL and database name (case-sensitive)
- **Connection Error**: Ensure FileMaker Server is accessible from your network
- **SSL Certificate Error**: 
  - For local/development: Use `http://` instead of `https://`
  - For self-signed certificates: Disable SSL verification (see SSL Configuration below)
  - For production: Use valid SSL certificates

### SSL Configuration

The MCP server includes SSL verification control:

**Via Environment Variable:**
```bash
FM_VERIFY_SSL=false  # Disable SSL verification (not recommended for production)
FM_VERIFY_SSL=true   # Enable SSL verification (default, recommended)
```

**Via Config File (`~/.fms-odata-mcp/config.json`):**
```json
{
  "filemaker": {
    "verifySsl": false
  }
}
```

**Default Behavior:**
- SSL verification is **enabled by default** (secure)
- Only disable for local development or testing with self-signed certificates
- Never disable SSL verification in production environments

**When to Disable SSL Verification:**
- Testing with local FileMaker Server using self-signed certificates
- Development environments without proper SSL setup
- Internal networks with self-signed certificates

**Security Warning:** Disabling SSL verification makes connections vulnerable to man-in-the-middle attacks. Only use this option in trusted, isolated environments.

---

## 16. TROUBLESHOOTING

### Connection Issues
- Verify server URL includes protocol (http:// or https://)
- Check username and password
- Ensure database name is exact (case-sensitive)
- Test with: `What FileMaker connection am I using?`

### Query Issues
- Check table name spelling (use: `What tables are in my database?`)
- Verify field names in metadata
- Use correct OData syntax for filters
- Start simple, add complexity gradually

---

**END OF REFERENCE**

For detailed documentation, see:
- README.md - Project overview
- CLAUDE_DESKTOP_SETUP.md - Installation guide
- TESTING_GUIDE.md - Testing information
