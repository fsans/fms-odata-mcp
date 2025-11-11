# FileMaker Server OData MCP

[![npm version](https://img.shields.io/npm/v/filemaker-odata-mcp.svg)](https://www.npmjs.com/package/filemaker-odata-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Model Context Protocol (MCP) server providing FileMaker Server OData 4.01 API integration for AI assistants like Claude Desktop, Windsurf, Cursor, and Cline.

## Features

- 🔌 **19 MCP Tools** for FileMaker database operations
- 🔍 **Database Discovery** - Explore tables, fields, and metadata
- 📊 **CRUD Operations** - Create, read, update, and delete records
- 🔐 **Secure Connections** - SSL support for self-signed certificates
- 💾 **Connection Management** - Save and reuse database connections
- 📝 **OData 4.01 Standard** - Full query capabilities ($filter, $select, $orderby, etc.)

## Quick Start

### Installation

```bash
# Via NPM (recommended)
npm install -g filemaker-odata-mcp

# Or local development
git clone https://github.com/fsans/FMS-ODATA-MCP.git
cd FMS-ODATA-MCP
npm install
npm run build
```

### Setup for Claude Desktop

1. **Locate your Claude config file:**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Add the MCP server:**

```json
{
  "mcpServers": {
    "filemaker": {
      "command": "npx",
      "args": ["-y", "filemaker-odata-mcp"],
      "env": {
        "FM_SERVER": "https://your-filemaker-server.com",
        "FM_DATABASE": "YourDatabase",
        "FM_USER": "your-username",
        "FM_PASSWORD": "your-password",
        "FM_VERIFY_SSL": "true"
      }
    }
  }
}
```

3. **For self-signed SSL certificates**, set `FM_VERIFY_SSL` to `"false"`

4. **Restart Claude Desktop**

### First Steps

Once connected, try these prompts in Claude:

```
What tables are in my FileMaker database?

Show me the first 5 records from the Contacts table

Find all contacts where LastName equals "Smith"

Create a new contact with name "John Doe" and email "john@example.com"
```

## Documentation

- **[Quick Reference](./dev_stuf/QUICK_REFERENCE.md)** - One-page setup guide
- **[Prompt Examples](./dev_stuf/CLAUDE_DESKTOP_PROMPTS.md)** - Complete prompt reference  
- **[Claude Desktop Setup](./dev_stuf/CLAUDE_DESKTOP_SETUP.md)** - Detailed configuration
- **[Windsurf Setup](./dev_stuf/WINDSURF_SETUP.md)** - IDE integration guide

## Available Tools

| Category | Tools |
|----------|-------|
| **Discovery** | `fm_odata_list_tables`, `fm_odata_get_metadata`, `fm_odata_get_service_document` |
| **Queries** | `fm_odata_query_records`, `fm_odata_get_record`, `fm_odata_get_records`, `fm_odata_count_records` |
| **CRUD** | `fm_odata_create_record`, `fm_odata_update_record`, `fm_odata_delete_record` |
| **Connection** | `fm_odata_connect`, `fm_odata_set_connection`, `fm_odata_list_connections`, `fm_odata_get_current_connection` |
| **Config** | `fm_odata_config_add_connection`, `fm_odata_config_remove_connection`, `fm_odata_config_list_connections` |

## Requirements

- **Node.js** 18.0.0 or higher
- **FileMaker Server** with OData API enabled
- **FileMaker Account** with appropriate access privileges

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `FM_SERVER` | FileMaker Server URL | Yes | - |
| `FM_DATABASE` | Database name | Yes | - |
| `FM_USER` | Username | Yes | - |
| `FM_PASSWORD` | Password | Yes | - |
| `FM_VERIFY_SSL` | Verify SSL certificates | No | `true` |
| `FM_TIMEOUT` | Request timeout (ms) | No | `30000` |

## OData Query Syntax

The server supports OData 4.01 query options:

```
$filter   - Filter records (e.g., "Age gt 18")
$select   - Select specific fields
$orderby  - Sort results
$top      - Limit results
$skip     - Skip records (pagination)
$expand   - Include related records
$count    - Include total count
```

**Example prompts:**
```
Get contacts where Age is greater than 18

Show only Name and Email fields from Contacts

Sort contacts by LastName in descending order

Get the first 10 contacts, skip the first 20
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/fsans/FMS-ODATA-MCP/issues)
- **Discussions**: [GitHub Discussions](https://github.com/fsans/FMS-ODATA-MCP/discussions)

## Changelog

See [dev_stuf/VERSIONING.md](./dev_stuf/VERSIONING.md) for version history.

---

Made with ❤️ for the FileMaker and AI communities
