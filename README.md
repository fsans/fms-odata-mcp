# FileMaker Server OData 4.01 MCP Server

An MCP (Model Context Protocol) server for interacting with FileMaker Server's OData 4.01 API.

## Overview

This MCP server provides tools and resources to interact with FileMaker Server databases through their OData 4.01 compliant REST API. It enables querying, creating, updating, and deleting records in FileMaker databases.

## Project Status

🚧 **Planning Phase** - This project is currently in the planning and architecture design phase.

## FileMaker Server OData API

FileMaker Server exposes databases through an OData 4.01 compliant RESTful API that supports:

- **Metadata Discovery**: Service document and metadata XML ($metadata)
- **CRUD Operations**: Create, Read, Update, Delete records
- **Query Options**: $filter, $select, $orderby, $top, $skip, $expand, $count
- **Batch Operations**: Multiple operations in a single request
- **Navigation Properties**: Related records through relationships
- **Functions**: Built-in OData functions for filtering and transformations

### OData 4.01 Standard Features

- JSON format (default)
- Atom/XML format support
- ETags for optimistic concurrency
- Delta queries for change tracking
- Pagination support
- Complex type support
- Collection support

## Quick Start

**New to this project? Start here:**

1. **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - One-page setup guide (start here!)
2. **[CLAUDE_DESKTOP_SETUP.md](CLAUDE_DESKTOP_SETUP.md)** - Detailed Claude Desktop configuration
3. **[WINDSURF_SETUP.md](WINDSURF_SETUP.md)** - Detailed Windsurf configuration
4. **[CLAUDE_DESKTOP_PROMPTS.md](CLAUDE_DESKTOP_PROMPTS.md)** - Complete prompt examples and usage

## Architecture Plan

### MCP Server Components

1. **Connection Management**
   - Server URL configuration
   - Database selection
   - Authentication (Basic Auth)
   - Session management

2. **Tools** (Executable Operations)
   - `list_databases` - List available databases
   - `get_metadata` - Get database schema/metadata
   - `query_records` - Query records with OData filters
   - `get_record` - Get a specific record by ID
   - `create_record` - Create a new record
   - `update_record` - Update an existing record
   - `delete_record` - Delete a record
   - `execute_batch` - Execute batch operations
   - `get_related_records` - Navigate relationships

3. **Resources** (Data Sources)
   - `odata://{database}/service` - Service document
   - `odata://{database}/metadata` - Database metadata
   - `odata://{database}/{table}` - Table/Layout access

### Technology Stack

- **Language**: TypeScript
- **Runtime**: Node.js
- **SDK**: @modelcontextprotocol/sdk
- **HTTP Client**: axios or node-fetch
- **OData Client**: odata-client or custom implementation
- **Authentication**: Basic Auth (username/password)

## Configuration Requirements

The MCP server will require the following environment variables:

- `FILEMAKER_SERVER_URL` - Base URL of the FileMaker Server (e.g., https://server.example.com)
- `FILEMAKER_USERNAME` - FileMaker account username
- `FILEMAKER_PASSWORD` - FileMaker account password
- `FILEMAKER_DATABASE` - (Optional) Default database name

## OData URL Structure

```
{server}/fmi/odata/v4/{database-name}/{table-name}
{server}/fmi/odata/v4/{database-name}/$metadata
```

### Example Queries

```
# Get all records from Contacts table
GET /fmi/odata/v4/MyDatabase/Contacts

# Get record by ID
GET /fmi/odata/v4/MyDatabase/Contacts('123')

# Filter records
GET /fmi/odata/v4/MyDatabase/Contacts?$filter=LastName eq 'Smith'

# Select specific fields
GET /fmi/odata/v4/MyDatabase/Contacts?$select=FirstName,LastName,Email

# Order and limit
GET /fmi/odata/v4/MyDatabase/Contacts?$orderby=LastName&$top=10

# Count records
GET /fmi/odata/v4/MyDatabase/Contacts/$count

# Expand related records
GET /fmi/odata/v4/MyDatabase/Invoices?$expand=Customer
```

## Development Phases

### Phase 1: Project Setup ✅
- [x] Initialize git repository
- [ ] Create project structure
- [ ] Initialize npm project
- [ ] Install dependencies
- [ ] Configure TypeScript

### Phase 2: Core Implementation
- [ ] Implement OData client wrapper
- [ ] Create MCP server boilerplate
- [ ] Implement connection management
- [ ] Add authentication handling

### Phase 3: Tools Implementation
- [ ] Implement list_databases tool
- [ ] Implement get_metadata tool
- [ ] Implement query_records tool
- [ ] Implement get_record tool
- [ ] Implement create_record tool
- [ ] Implement update_record tool
- [ ] Implement delete_record tool

### Phase 4: Resources Implementation
- [ ] Implement service document resource
- [ ] Implement metadata resource
- [ ] Implement table resource templates

### Phase 5: Advanced Features
- [ ] Batch operations support
- [ ] Related records navigation
- [ ] Error handling and validation
- [ ] Retry logic and resilience

### Phase 6: Testing & Documentation
- [ ] Create example usage scenarios
- [ ] Test with real FileMaker Server
- [ ] Write comprehensive documentation
- [ ] Create setup guide

### Phase 7: Installation & Configuration
- [ ] Add to MCP settings
- [ ] Test integration
- [ ] Document configuration steps

## Security Considerations

- Credentials stored in environment variables (not in code)
- HTTPS required for production
- Account permissions controlled by FileMaker Server
- No credential exposure in logs

## Future Enhancements

- OAuth 2.0 support (if FileMaker adds support)
- Caching metadata for performance
- Query builder helper
- Support for container fields
- Script execution (if exposed via OData)
- Streaming large result sets

## References

- [OData 4.01 Specification](https://www.odata.org/documentation/)
- [FileMaker Server Documentation](https://help.claris.com/)
- [MCP Protocol Documentation](https://modelcontextprotocol.io/)

## License

TBD

## Contributing

TBD
