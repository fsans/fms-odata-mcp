# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FileMaker Server OData MCP is a Model Context Protocol (MCP) server that exposes FileMaker
Server's OData 4.01 API as MCP tools for use by AI agents (Claude Desktop, Windsurf,
Cursor, Cline). It is published as an npm package (`fms-odata-mcp`).

## Commands

```bash
# Build
npm run build          # Compile TypeScript to dist/
npm run watch          # Watch mode

# Run
npm start              # Run compiled dist/index.js
npm run dev            # Build then run

# Test
npm test               # Run unit tests (tests/unit/**/*.test.ts)
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage report

# Docker (convenience script — handles BOM stripping, build, and restart)
./start.sh             # Build image and start HTTP container from .env
```

To run a single test file:
```bash
npx jest tests/unit/odata-client.test.ts
```

### Manual stdio test (no persistent container needed)
```bash
bash -c '{
  echo '\''{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'\''; sleep 1
  echo '\''{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}'\''; sleep 1
  echo '\''{"jsonrpc":"2.0","method":"tools/call","id":2,"params":{"name":"fm_odata_connect","arguments":{"server":"https://FM_SERVER","database":"DB","user":"USER","password":"PASS","verifySsl":false}}}'\''; sleep 2
  echo '\''{"jsonrpc":"2.0","method":"tools/call","id":3,"params":{"name":"fm_odata_list_tables","arguments":{}}}'\''; sleep 5
} | docker run --rm -i --env-file .env fms-odata-mcp:latest'
```

## Architecture

Three-layer architecture communicating via the MCP protocol:

```
MCP Client (Claude, Windsurf, etc.)
        ↓ MCP protocol
Transport Layer  (src/transport.ts, src/simple-http-transport.ts)
        ↓ tool calls
Tools Handler    (src/tools/index.ts → odata.ts / connection.ts / configuration.ts)
        ↓ HTTP requests
OData Client     (src/odata-client.ts)
        ↓ Basic Auth + HTTP/HTTPS
FileMaker Server OData 4.01 API
```

**Transport modes** (set via `MCP_TRANSPORT` env var):
- `stdio` (default) — for local MCP clients like Claude Desktop
- `http` — binds on `MCP_PORT` (default 3333)
- `https` — binds on `MCP_PORT` (default 3443); requires `MCP_CERT_PATH` / `MCP_KEY_PATH`

**39 MCP tools** in four categories (33 standard + 6 optional schema editing when `FM_ALLOW_SCHEMA_EDITS=true`):
- `src/tools/odata.ts` — 20 tools for OData operations (list tables, describe_table, query/get/create/update/delete
  records, query_all_records, metadata, count, service doc, aggregate, cast, build_filter, run_script, list_scripts,
  bulk create/update/delete records). All
  connection-dependent tools accept an optional `connection` param for per-call session targeting without
  changing the active session.
- `src/tools/connection.ts` — 8 tools: connect, connect_multi, set_connection, list_connections,
  get_current_connection, list_active_sessions, describe_sessions, get_server_version
- `src/tools/configuration.ts` — 5 tools for persisted connections in `~/.fms-odata-mcp/config.json`
- `src/tools/schema.ts` — 6 optional schema (DDL) tools: create_table, add_fields, delete_table,
  delete_field, create_index, delete_index. Only registered when `FM_ALLOW_SCHEMA_EDITS=true`.

**Configuration precedence:** Environment variables → config file (`~/.fms-odata-mcp/config.json`) → defaults.

## Key Source Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Entry point: initializes server, registers tools, sets up transport |
| `src/config.ts` | Loads/saves config from env vars and `~/.fms-odata-mcp/config.json` |
| `src/connection.ts` | Active connection state management |
| `src/odata-client.ts` | Axios-based HTTP client; constructs URLs, handles Basic Auth, OData query params |
| `src/odata-parser.ts` | Parses OData JSON responses |
| `src/transport.ts` | Transport factory selecting stdio/http/https |
| `src/tools/schema.ts` | Schema (DDL) editing tools (opt-in via `FM_ALLOW_SCHEMA_EDITS`) |
| `src/tools/index.ts` | Tool registry and routing dispatcher |

## TypeScript Configuration

- **Module system:** ES Modules (`"module": "Node16"`) — use `.js` extensions in imports even for `.ts` source files
- **Target:** ES2022
- **Strict mode:** enabled
- **Output:** `dist/` directory

## Environment Variables

```
FM_SERVER          FileMaker Server URL (required)
FM_DATABASE        Database name (required)
FM_USER            Username (required for Basic auth)
FM_PASSWORD        Password (required for Basic auth)
FM_AUTH_TYPE       Authentication method: "basic" (default) or "bearer"
FM_BEARER_TOKEN    Bearer token (required when FM_AUTH_TYPE=bearer)
FM_VERIFY_SSL      Verify SSL cert (default: true)
FM_TIMEOUT         Request timeout ms (default: 30000)
FM_BATCH_MAX_ITEMS Max records per batch operation (default: 100)
FM_MAX_RECORDS     Max records from query_all_records (default: 10000, hard cap 50000)
FM_ALLOW_SCHEMA_EDITS  Enable schema (DDL) tools (default: false)
MCP_TRANSPORT      stdio|http|https (default: stdio)
MCP_PORT           HTTP/HTTPS port
MCP_HOST           Bind host (default: localhost)
MCP_CERT_PATH      SSL cert path (https only)
MCP_KEY_PATH       SSL key path (https only)
MCP_AUTH_TOKEN     Bearer token for MCP transport auth (optional, Plan 006)
MCP_LOG_FILE       Enable file logging (true/false)
DEBUG              Debug namespace (e.g. fms-odata-mcp:*)
```

## Testing

Tests live in `tests/unit/` (unit) and `tests/integration/tools/` (integration). The jest
config uses `ts-jest` with ESM support. Only unit tests are included in the default `npm test`
run (pattern: `**/tests/unit/**/*.test.ts`).

## Known Gotchas

### Docker / HTTP transport
- **`MCP_HOST` must be `0.0.0.0`** inside a container. `localhost` binds only to the
  container's loopback, making the port unreachable even with `-p` mapping.
- **`.env` BOM**: if the `.env` file was created on Windows or with certain editors it may
  have a leading BOM (`\xc3\xa7` / `ç#`). `start.sh` strips it automatically. To fix permanently:
  `sed -i '' $'s/^\xc3\xa7//' .env`
- **`fm_odata_connect` field names**: the tool uses `user` (not `username`) and `verifySsl`
  (not `verifySSL`). Wrong field names silently fall back to empty strings, causing a 401.

### HTTP transport notification bug (`working-http-transport.ts`)
JSON-RPC notifications (e.g. `notifications/initialized`) have no `id` field and never
generate a server response. The original `handleRequest` waited on a `responsePromise` that
never resolved, causing any client that sends a notification before `tools/list` (Dify,
standard MCP clients) to stall indefinitely. Fixed by detecting missing `id` and returning
HTTP 204 immediately.

### Dify integration
- Dify's native MCP tool uses **Streamable HTTP** transport — configure the URL as
  `http://host.docker.internal:3333/mcp` (use `host.docker.internal`, not `localhost`, when
  Dify runs in Docker).
- If Dify returns 403, check the SSRF proxy (Squid): port 3333 must be in the `Safe_ports` ACL in `squid.conf`.

### Known FileMaker OData limitations — cannot filter on the `id` field
**Affects**: `fm_odata_query_records`, `fm_odata_query_all_records`, `fm_odata_count_records`,
`fm_odata_aggregate` — any tool that sends a `$filter` to FileMaker.

**Symptom**: Any comparison operator on the `id` field (`id eq N`, `id gt N`, `id lt N`,
`id ge N`, `id le N`, `id ne N`) fails with `OData Error [-1002]: Error: syntax error in
URL at: ' eq '` (or `gt`/`lt`/etc.). This is a FileMaker Server OData parser limitation:
`id` is a reserved internal field and cannot be used in `$filter` expressions.

**What DOES work**: Filtering on any other field works correctly, including:
- String values with spaces: `company eq 'Digital Dreams'` ✅
- Numeric fields: `row_id eq 1`, `update_unix_time gt 0` ✅
- String functions: `contains(company, 'Digital')`, `startswith(company, 'Digital')` ✅
- Compound filters on non-`id` fields ✅

**Workaround for users**: Use `row_id`, `uuid`, or any business field instead of `id`
for filtering. To find a record by its internal `id`, use `fm_odata_get_record` which
takes the record ID directly (not via `$filter`).

**This is NOT a code bug** — the `odataEncode()` function correctly encodes spaces as
`%20` and FileMaker accepts this inside string literals. Verified live against
FileMaker Server with the `Contacts` database.
