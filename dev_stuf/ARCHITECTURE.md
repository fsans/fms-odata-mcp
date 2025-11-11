# FileMaker Server OData MCP Server - Architecture

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         MCP Client (Cline)                       │
└───────────────────────────────┬─────────────────────────────────┘
                                │ MCP Protocol (stdio)
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                    FileMaker OData MCP Server                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Server Core (SDK Integration)                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   Tools Handler                            │ │
│  │  - list_databases    - query_records                       │ │
│  │  - get_metadata      - create_record                       │ │
│  │  - get_record        - update_record                       │ │
│  │  - delete_record     - execute_batch                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  Resources Handler                         │ │
│  │  - Service Documents  - Metadata                           │ │
│  │  - Table Access       - Resource Templates                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    OData Client Layer                      │ │
│  │  - URL Builder        - Response Parser                    │ │
│  │  - Request Handler    - Error Handler                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                 Connection Manager                         │ │
│  │  - Authentication     - Session Management                 │ │
│  │  - Connection Pool    - Retry Logic                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS/OData 4.01
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                      FileMaker Server                            │
│                       OData 4.01 API                             │
│              /fmi/odata/v4/{database}/{table}                    │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Server Core (SDK Integration)

**Responsibilities:**
- Initialize MCP server with capabilities
- Handle stdio transport
- Manage server lifecycle
- Route requests to appropriate handlers

**Key Classes:**
- `FileMakerODataServer` - Main server class
- Extends MCP SDK `Server` class

**Configuration:**
```typescript
{
  name: 'fms-odata-mcp',
  version: '1.0.0',
  capabilities: {
    resources: {},
    tools: {}
  }
}
```

### 2. Tools Handler

**Purpose:** Implement executable operations for FileMaker database interactions.

#### Tool Definitions

##### `list_databases`
```typescript
{
  name: 'list_databases',
  description: 'List all available databases on the FileMaker Server',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  }
}
```

##### `get_metadata`
```typescript
{
  name: 'get_metadata',
  description: 'Get the metadata (schema) for a FileMaker database',
  inputSchema: {
    type: 'object',
    properties: {
      database: {
        type: 'string',
        description: 'Database name'
      }
    },
    required: ['database']
  }
}
```

##### `query_records`
```typescript
{
  name: 'query_records',
  description: 'Query records from a table with OData filters',
  inputSchema: {
    type: 'object',
    properties: {
      database: { type: 'string', description: 'Database name' },
      table: { type: 'string', description: 'Table/layout name' },
      filter: { type: 'string', description: 'OData $filter expression' },
      select: { type: 'string', description: 'Comma-separated field names' },
      orderby: { type: 'string', description: 'OData $orderby expression' },
      top: { type: 'number', description: 'Maximum records to return' },
      skip: { type: 'number', description: 'Number of records to skip' },
      expand: { type: 'string', description: 'Related records to expand' },
      count: { type: 'boolean', description: 'Include total count' }
    },
    required: ['database', 'table']
  }
}
```

##### `get_record`
```typescript
{
  name: 'get_record',
  description: 'Get a specific record by ID',
  inputSchema: {
    type: 'object',
    properties: {
      database: { type: 'string', description: 'Database name' },
      table: { type: 'string', description: 'Table/layout name' },
      recordId: { type: 'string', description: 'Record ID' }
    },
    required: ['database', 'table', 'recordId']
  }
}
```

##### `create_record`
```typescript
{
  name: 'create_record',
  description: 'Create a new record in a table',
  inputSchema: {
    type: 'object',
    properties: {
      database: { type: 'string', description: 'Database name' },
      table: { type: 'string', description: 'Table/layout name' },
      data: { type: 'object', description: 'Field values for the new record' }
    },
    required: ['database', 'table', 'data']
  }
}
```

##### `update_record`
```typescript
{
  name: 'update_record',
  description: 'Update an existing record',
  inputSchema: {
    type: 'object',
    properties: {
      database: { type: 'string', description: 'Database name' },
      table: { type: 'string', description: 'Table/layout name' },
      recordId: { type: 'string', description: 'Record ID' },
      data: { type: 'object', description: 'Field values to update' }
    },
    required: ['database', 'table', 'recordId', 'data']
  }
}
```

##### `delete_record`
```typescript
{
  name: 'delete_record',
  description: 'Delete a record',
  inputSchema: {
    type: 'object',
    properties: {
      database: { type: 'string', description: 'Database name' },
      table: { type: 'string', description: 'Table/layout name' },
      recordId: { type: 'string', description: 'Record ID' }
    },
    required: ['database', 'table', 'recordId']
  }
}
```

##### `execute_batch`
```typescript
{
  name: 'execute_batch',
  description: 'Execute multiple operations in a single batch request',
  inputSchema: {
    type: 'object',
    properties: {
      database: { type: 'string', description: 'Database name' },
      operations: {
        type: 'array',
        description: 'Array of operations to execute',
        items: {
          type: 'object',
          properties: {
            method: { type: 'string', enum: ['GET', 'POST', 'PATCH', 'DELETE'] },
            url: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    },
    required: ['database', 'operations']
  }
}
```

### 3. Resources Handler

**Purpose:** Expose database information as MCP resources.

#### Resource Templates

##### Service Document
```
URI Template: odata://{database}/service
Description: Get the OData service document listing available entity sets
```

##### Metadata Document
```
URI Template: odata://{database}/metadata
Description: Get the EDMX metadata document describing the database schema
```

##### Table Data
```
URI Template: odata://{database}/{table}
Description: Access records from a specific table
```

### 4. OData Client Layer

**Responsibilities:**
- Construct OData-compliant URLs
- Handle HTTP requests/responses
- Parse OData JSON responses
- Handle OData errors

**Key Classes:**
- `ODataClient` - Main client class
- `ODataQueryBuilder` - URL construction
- `ODataResponseParser` - Response parsing
- `ODataErrorHandler` - Error handling

**URL Construction Examples:**
```typescript
// Query with filters
buildUrl({
  database: 'Contacts',
  table: 'People',
  filter: "LastName eq 'Smith'",
  select: 'FirstName,LastName,Email',
  orderby: 'LastName asc',
  top: 10
})
// Result: /fmi/odata/v4/Contacts/People?$filter=LastName eq 'Smith'&$select=FirstName,LastName,Email&$orderby=LastName asc&$top=10

// Expand related records
buildUrl({
  database: 'Sales',
  table: 'Invoices',
  expand: 'Customer,LineItems'
})
// Result: /fmi/odata/v4/Sales/Invoices?$expand=Customer,LineItems
```

### 5. Connection Manager

**Responsibilities:**
- Manage authentication
- Handle connection pooling
- Implement retry logic
- Manage sessions

**Authentication Flow:**
```typescript
1. Read credentials from environment variables
2. Create Basic Auth header: Base64(username:password)
3. Include in all requests: Authorization: Basic {encoded}
4. Handle 401 responses and re-authenticate if needed
```

**Configuration:**
```typescript
interface ConnectionConfig {
  serverUrl: string;
  username: string;
  password: string;
  defaultDatabase?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}
```

## Data Flow

### Query Records Flow

```
1. User Request (via Cline)
   ↓
2. MCP Client sends CallToolRequest
   {
     name: 'query_records',
     arguments: {
       database: 'Contacts',
       table: 'People',
       filter: "City eq 'Madrid'"
     }
   }
   ↓
3. Server validates input
   ↓
4. ODataQueryBuilder constructs URL
   /fmi/odata/v4/Contacts/People?$filter=City eq 'Madrid'
   ↓
5. ConnectionManager adds auth headers
   ↓
6. HTTP GET request to FileMaker Server
   ↓
7. FileMaker Server processes query
   ↓
8. OData JSON response returned
   {
     "@odata.context": "...",
     "value": [
       { "ID": "1", "FirstName": "John", "LastName": "Doe", "City": "Madrid" }
     ]
   }
   ↓
9. ODataResponseParser formats response
   ↓
10. Return to MCP Client
    {
      content: [{ type: 'text', text: JSON.stringify(...) }]
    }
```

### Create Record Flow

```
1. User Request
   ↓
2. MCP Client sends CallToolRequest
   {
     name: 'create_record',
     arguments: {
       database: 'Contacts',
       table: 'People',
       data: {
         FirstName: 'Jane',
         LastName: 'Smith',
         Email: 'jane@example.com'
       }
     }
   }
   ↓
3. Server validates input
   ↓
4. ODataClient constructs POST request
   POST /fmi/odata/v4/Contacts/People
   Body: { FirstName: 'Jane', LastName: 'Smith', ... }
   ↓
5. FileMaker Server creates record
   ↓
6. Response with created record (including new ID)
   {
     "@odata.context": "...",
     "ID": "123",
     "FirstName": "Jane",
     ...
   }
   ↓
7. Return success with new record data
```

## Error Handling Strategy

### HTTP Error Codes

```typescript
- 400 Bad Request → Invalid OData query syntax
- 401 Unauthorized → Invalid credentials
- 403 Forbidden → Insufficient permissions
- 404 Not Found → Database/table doesn't exist
- 500 Internal Server Error → FileMaker Server error
```

### Error Response Format

```typescript
{
  content: [{
    type: 'text',
    text: 'Error message with details'
  }],
  isError: true
}
```

### Retry Logic

```typescript
- Network errors: Retry up to 3 times with exponential backoff
- 401 errors: Re-authenticate once, then fail
- 5xx errors: Retry up to 2 times
- 4xx errors (except 401): Fail immediately
```

## Security Considerations

### Credential Management
- Never log credentials
- Read from environment variables only
- Use HTTPS for all connections
- Support for connection strings

### Input Validation
- Sanitize all user inputs
- Validate OData query syntax
- Prevent injection attacks
- Validate field names against metadata

### Access Control
- Respect FileMaker Server permissions
- Limited by authenticated user's privileges
- No privilege escalation

## Performance Optimization

### Caching Strategy
```typescript
- Metadata: Cache for 5 minutes (configurable)
- Service documents: Cache for 1 hour
- Record data: No caching (real-time)
```

### Connection Pooling
```typescript
- Maintain persistent connections
- Reuse HTTP agents
- Connection timeout: 30 seconds
- Idle timeout: 60 seconds
```

### Request Optimization
```typescript
- Use $select to limit fields
- Use $top for pagination
- Use $count=true when needed
- Batch related operations
```

## Testing Strategy

### Unit Tests
- Individual tool handlers
- URL construction
- Response parsing
- Error handling

### Integration Tests
- Against mock FileMaker Server
- Full request/response cycle
- Authentication flow
- Error scenarios

### End-to-End Tests
- Against real FileMaker Server (test instance)
- All tools
- All resources
- Batch operations

## Deployment

### Prerequisites
- Node.js 18+
- FileMaker Server 19+ with OData enabled
- Valid FileMaker account with appropriate privileges

### Configuration
1. Set environment variables
2. Add to MCP settings
3. Restart MCP client
4. Verify connection

### Monitoring
- Log all requests (without sensitive data)
- Track error rates
- Monitor response times
- Alert on authentication failures

## Future Enhancements

### Phase 2 Features
- Streaming large result sets
- Bulk import/export
- Advanced query builder
- Metadata caching improvements

### Phase 3 Features
- Container field support
- Script execution (if available)
- Custom functions
- Webhooks/notifications

### Phase 4 Features
- Multi-server support
- Load balancing
- Failover handling
- Performance analytics
