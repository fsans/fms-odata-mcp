# FMS-ODATA-MCP Implementation Plan

## Overview
Adapt the FileMaker Data API MCP patterns for FileMaker Server OData 4.01 API.

## Key Differences: Data API vs OData

### Authentication
- **Data API**: Token-based (login → token → requests → logout)
- **OData**: Basic Auth on every request (no token management needed)

### API Endpoints
- **Data API**: `/fmi/data/v{version}/databases/{database}`
- **OData**: `/fmi/odata/v4/{database}/{table}`

### Operations
- **Data API**: FileMaker-specific (layouts, scripts, portals)
- **OData**: Standard OData 4.01 ($filter, $select, $expand, etc.)

## Reusable Patterns from Data API MCP

### 1. Configuration System ✅
- Multi-connection management
- Environment variable support
- Secure credential storage (~/.filemaker-mcp/)
- Default connection support
- CLI configuration commands

### 2. Transport System ✅
- stdio (default for local use)
- HTTP (network deployment)
- HTTPS (secure network deployment)
- Health check endpoints
- Environment-based configuration

### 3. Project Structure ✅
```
src/
├── index.ts              # Main server with tool handlers
├── config.ts             # Configuration management
├── connection.ts         # Connection manager (simplified, no tokens)
├── transport.ts          # Transport abstraction
├── logger.ts             # Debug logging
├── bin/
│   └── cli.ts           # CLI tool
└── tools/
    ├── configuration.ts  # Config management tools
    ├── connection.ts     # Connection tools
    └── odata.ts         # OData-specific tools
```

### 4. CLI Commands ✅
```bash
fms-odata-mcp setup
fms-odata-mcp config add-connection <name> [options]
fms-odata-mcp config remove-connection <name>
fms-odata-mcp config list-connections
fms-odata-mcp config set-default <name>
fms-odata-mcp start
```

## Implementation Phases

### Phase 1: Project Setup ✅
- [x] Git repository initialized
- [x] Planning documentation created
- [ ] npm project initialization
- [ ] Dependencies installation
- [ ] TypeScript configuration
- [ ] Directory structure creation

### Phase 2: Core Infrastructure
- [ ] Configuration system (adapt from Data API)
- [ ] Connection manager (no token management)
- [ ] Transport system (stdio/HTTP/HTTPS)
- [ ] Logger implementation
- [ ] CLI tool setup

### Phase 3: OData Client Layer
- [ ] Basic Auth handler
- [ ] OData URL builder
- [ ] OData query parameters handler
- [ ] HTTP request wrapper
- [ ] Response parser
- [ ] Error handler

### Phase 4: OData Tools Implementation

#### Metadata Tools (3)
- [ ] `fm_odata_list_databases` - List available databases
- [ ] `fm_odata_get_metadata` - Get database schema ($metadata)
- [ ] `fm_odata_get_service_document` - Get service document

#### Query Tools (4)
- [ ] `fm_odata_query_records` - Query with OData filters
- [ ] `fm_odata_get_record` - Get single record by ID
- [ ] `fm_odata_get_records` - Get records (simple, no filters)
- [ ] `fm_odata_count_records` - Count records

#### CRUD Tools (3)
- [ ] `fm_odata_create_record` - Create new record (POST)
- [ ] `fm_odata_update_record` - Update record (PATCH)
- [ ] `fm_odata_delete_record` - Delete record (DELETE)

#### Advanced Tools (2)
- [ ] `fm_odata_batch_operations` - Batch requests
- [ ] `fm_odata_expand_related` - Navigate relationships

#### Configuration Tools (5) - Reuse from Data API
- [ ] `fm_odata_config_add_connection`
- [ ] `fm_odata_config_remove_connection`
- [ ] `fm_odata_config_list_connections`
- [ ] `fm_odata_config_get_connection`
- [ ] `fm_odata_config_set_default_connection`

#### Connection Tools (4) - Reuse from Data API
- [ ] `fm_odata_set_connection`
- [ ] `fm_odata_connect` - Inline credentials
- [ ] `fm_odata_list_connections`
- [ ] `fm_odata_get_current_connection`

### Phase 5: Testing
- [ ] Unit tests (config, connection, OData client)
- [ ] Integration tests (tools with mock server)
- [ ] E2E tests (against real FileMaker Server)

### Phase 6: Documentation
- [ ] API reference
- [ ] User guide
- [ ] Deployment guide
- [ ] Examples and use cases

### Phase 7: Packaging & Distribution
- [ ] npm package configuration
- [ ] Build scripts
- [ ] Version management
- [ ] npm publishing

## File Mapping: Data API → OData

### Core Files
| Data API | OData | Changes |
|----------|-------|---------|
| `src/config.ts` | Same | Update connection interface |
| `src/connection.ts` | Simplified | Remove TokenManager |
| `src/transport.ts` | Same | Reuse as-is |
| `src/logger.ts` | Same | Reuse as-is |
| `src/index.ts` | Modified | New tool handlers |
| `src/bin/cli.ts` | Modified | Update command names |

### New Files
- `src/odata-client.ts` - OData HTTP client with Basic Auth
- `src/odata-url-builder.ts` - Build OData URLs
- `src/odata-parser.ts` - Parse OData responses
- `src/tools/odata.ts` - OData-specific tool handlers

### Removed Files
- `src/token-manager.ts` - Not needed for Basic Auth

## Configuration Format

### Connection Config
```json
{
  "connections": {
    "production": {
      "name": "production",
      "server": "https://fms.example.com",
      "database": "Sales",
      "user": "admin",
      "password": "encrypted",
      "version": "v4"  // OData version, always v4
    }
  },
  "defaultConnection": "production"
}
```

### Environment Variables
```bash
# Connection
FM_SERVER=https://fms.example.com
FM_DATABASE=Sales
FM_USER=admin
FM_PASSWORD=secret

# Transport
MCP_TRANSPORT=stdio  # stdio | http | https
MCP_PORT=3000
MCP_HOST=localhost

# HTTPS only
MCP_CERT_PATH=/path/to/cert.pem
MCP_KEY_PATH=/path/to/key.pem
```

## OData URL Patterns

```
# Service Document
GET /fmi/odata/v4/{database}

# Metadata
GET /fmi/odata/v4/{database}/$metadata

# Entity Set (Table)
GET /fmi/odata/v4/{database}/{table}

# Single Entity by ID
GET /fmi/odata/v4/{database}/{table}('{id}')

# Query with filters
GET /fmi/odata/v4/{database}/{table}?$filter=Name eq 'John'&$select=Name,Email

# Create
POST /fmi/odata/v4/{database}/{table}
Body: { "Name": "John", "Email": "john@example.com" }

# Update
PATCH /fmi/odata/v4/{database}/{table}('{id}')
Body: { "Email": "newemail@example.com" }

# Delete
DELETE /fmi/odata/v4/{database}/{table}('{id}')
```

## Authentication Implementation

### Basic Auth
```typescript
class ODataClient {
  private getAuthHeader(user: string, password: string): string {
    const credentials = Buffer.from(`${user}:${password}`).toString('base64');
    return `Basic ${credentials}`;
  }

  async request(config: {
    method: string;
    url: string;
    user: string;
    password: string;
    data?: any;
  }): Promise<any> {
    const headers = {
      'Authorization': this.getAuthHeader(config.user, config.password),
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    return axios({
      method: config.method,
      url: config.url,
      headers,
      data: config.data
    });
  }
}
```

## Tool Response Format

### Success Response
```typescript
{
  content: [{
    type: 'text',
    text: JSON.stringify({
      '@odata.context': '...',
      '@odata.count': 10,
      'value': [...]
    }, null, 2)
  }]
}
```

### Error Response
```typescript
{
  content: [{
    type: 'text',
    text: 'Error: Unable to connect to FileMaker Server\nDetails: ...'
  }],
  isError: true
}
```

## Testing Strategy

### Unit Tests
- Configuration management
- OData URL builder
- Basic Auth handler
- Response parser

### Integration Tests
- Connection switching
- Tool execution
- Error handling
- Configuration persistence

### E2E Tests
- Against real FileMaker Server
- All CRUD operations
- Query operations with filters
- Metadata retrieval

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4",
    "axios": "^1.7.9",
    "commander": "^12.1.0",
    "debug": "^4.4.3",
    "dotenv": "^16.4.7",
    "express": "^4.18.2"
  },
  "devDependencies": {
    "@jest/globals": "^30.2.0",
    "@types/debug": "^4.1.12",
    "@types/express": "^4.17.21",
    "@types/jest": "^30.0.0",
    "@types/node": "^22.10.5",
    "jest": "^30.2.0",
    "ts-jest": "^29.4.5",
    "typescript": "^5.7.3"
  }
}
```

## Next Steps

1. Initialize npm project
2. Install dependencies
3. Set up TypeScript configuration
4. Create directory structure
5. Implement core infrastructure (config, connection, transport)
6. Implement OData client layer
7. Implement tools
8. Add tests
9. Create documentation
10. Package and publish

## Success Criteria

✅ Multi-connection support with secure storage
✅ Dual transport (stdio + HTTP/HTTPS)
✅ All 12 OData tools implemented
✅ Configuration and connection tools (9 tools)
✅ Comprehensive error handling
✅ Full test coverage
✅ Complete documentation
✅ npm package published
