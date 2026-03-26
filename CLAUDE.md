# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FileMaker Server OData MCP is a Model Context Protocol (MCP) server that exposes FileMaker Server's OData 4.01 API as MCP tools for use by AI agents (Claude Desktop, Windsurf, Cursor, Cline). It is published as an npm package (`fms-odata-mcp`).

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
} | docker run --rm -i --env-file .env filemaker-odata-mcp:latest'
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

**19 MCP tools** in three categories:
- `src/tools/odata.ts` — 11 tools for OData operations (list tables, query/get/create/update/delete records, metadata, count, service doc)
- `src/tools/connection.ts` — 4 tools for managing active connections (connect, set, list, get current)
- `src/tools/configuration.ts` — 4 tools for persisted connections in `~/.fms-odata-mcp/config.json`

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
FM_USER            Username (required)
FM_PASSWORD        Password (required)
FM_VERIFY_SSL      Verify SSL cert (default: true)
FM_TIMEOUT         Request timeout ms (default: 30000)
MCP_TRANSPORT      stdio|http|https (default: stdio)
MCP_PORT           HTTP/HTTPS port
MCP_HOST           Bind host (default: localhost)
MCP_CERT_PATH      SSL cert path (https only)
MCP_KEY_PATH       SSL key path (https only)
MCP_LOG_FILE       Enable file logging (true/false)
DEBUG              Debug namespace (e.g. fms-odata-mcp:*)
```

## Testing

Tests live in `tests/unit/` (unit) and `tests/integration/tools/` (integration). The jest config uses `ts-jest` with ESM support. Only unit tests are included in the default `npm test` run (pattern: `**/tests/unit/**/*.test.ts`).

## Known Gotchas

### Docker / HTTP transport
- **`MCP_HOST` must be `0.0.0.0`** inside a container. `localhost` binds only to the container's loopback, making the port unreachable even with `-p` mapping.
- **`.env` BOM**: if the `.env` file was created on Windows or with certain editors it may have a leading BOM (`\xc3\xa7` / `ç#`). `start.sh` strips it automatically. To fix permanently: `sed -i '' $'s/^\xc3\xa7//' .env`
- **`fm_odata_connect` field names**: the tool uses `user` (not `username`) and `verifySsl` (not `verifySSL`). Wrong field names silently fall back to empty strings, causing a 401.

### HTTP transport notification bug (`working-http-transport.ts`)
JSON-RPC notifications (e.g. `notifications/initialized`) have no `id` field and never generate a server response. The original `handleRequest` waited on a `responsePromise` that never resolved, causing any client that sends a notification before `tools/list` (Dify, standard MCP clients) to stall indefinitely. Fixed by detecting missing `id` and returning HTTP 204 immediately.

### Dify integration
- Dify's native MCP tool uses **Streamable HTTP** transport — configure the URL as `http://host.docker.internal:3333/mcp` (use `host.docker.internal`, not `localhost`, when Dify runs in Docker).
- If Dify returns 403, check the SSRF proxy (Squid): port 3333 must be in the `Safe_ports` ACL in `squid.conf`.
