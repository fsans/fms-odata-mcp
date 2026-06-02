# FileMaker Server OData MCP Server - Project Structure

## Directory Structure

```
FMS-ODATA-MCP/
├── src/
│   ├── bin/
│   │   └── cli.ts                        # CLI entry point (npx filemaker-odata-mcp)
│   ├── tools/
│   │   ├── index.ts                      # Tool registry and routing dispatcher
│   │   ├── odata.ts                      # 14 OData operation tools
│   │   ├── connection.ts                 # 8 connection/session tools
│   │   └── configuration.ts             # 4 saved-config tools
│   ├── config.ts                         # Load/validate config from env + file
│   ├── connection.ts                     # ConnectionManager: session map, inline/multi
│   ├── fm-version.ts                     # Version parsing, feature matrix, fallbacks
│   ├── http-server.ts                    # Express HTTP/HTTPS server mode
│   ├── index.ts                          # Main entry point, server initialization
│   ├── logger.ts                         # Debug logging with password redaction
│   ├── odata-client.ts                   # Axios OData client; URL builder; version cache
│   ├── odata-parser.ts                   # OData response/error parser; $apply/$filter builders
│   ├── simple-http-transport.ts          # Streamable HTTP transport (Dify/standard MCP)
│   ├── transport.ts                      # Transport factory (stdio | http | https)
│   ├── version.ts                        # Reads version from package.json at runtime
│   └── working-http-transport.ts        # HTTP transport with JSON-RPC notification fix
├── tests/
│   ├── unit/
│   │   ├── config-helpers.test.ts        # Config validation helpers
│   │   ├── config.test.ts                # Config loading and env parsing
│   │   ├── fm-version.test.ts            # Version parsing, feature matrix, fallbacks (55 tests)
│   │   ├── multi-session.test.ts         # ConnectionManager, multi-session routing (30 tests)
│   │   ├── odata-client.test.ts          # ODataClient HTTP layer
│   │   ├── odata-parser.test.ts          # Response/error parsing, $apply/$filter builders
│   │   └── tool-routing.test.ts          # Tool name→handler dispatch for all 26 tools
│   └── integration/
│       └── tools/
│           ├── configuration.test.ts     # Saved-config tool integration tests
│           ├── connection.test.ts        # Connection tool integration tests
│           └── odata.test.ts             # OData tool integration tests
├── dev_stuf/                             # Developer documentation (not published to npm)
│   ├── ARCHITECTURE.md
│   ├── CLAUDE_DESKTOP_PROMPTS.md
│   ├── CLAUDE_DESKTOP_SETUP.md
│   ├── DEPLOYMENT_SCENARIOS.md
│   ├── NPM_PUBLISHING.md
│   ├── PROJECT_STRUCTURE.md              # This file
│   ├── QUICK_REFERENCE.md
│   ├── QUICK_START_TEST.md
│   ├── ROADMAP.md
│   ├── TESTING_GUIDE.md
│   └── WINDSURF_SETUP.md
├── .env.example                          # Environment variable template
├── .gitignore
├── AGENTS.md                             # AI agent rules for this repo
├── CHANGELOG.md                          # Version history
├── CLAUDE.md                             # Claude Code guidance
├── CONTRIBUTING.md
├── docker-compose.yml
├── Dockerfile
├── package.json
├── README.md
├── start.sh                              # Build + Docker start convenience script
└── tsconfig.json

```

## File Descriptions

### Entry Points

#### `src/index.ts`
Main server entry point. Initializes the MCP `Server` from `@modelcontextprotocol/sdk`,
registers all 26 tool definitions from `src/tools/index.ts`, selects and starts the
transport (stdio / HTTP / HTTPS), and handles SIGTERM for graceful shutdown.

#### `src/bin/cli.ts`
CLI entry point for the `filemaker-odata-mcp` binary installed via npm.
Parses command-line flags (`--help`, `--version`) via `commander` and delegates to
`src/index.ts` for normal operation.

---

### Core Modules

#### `src/config.ts`
Loads and validates configuration from environment variables and the persisted config
file (`~/.fms-odata-mcp/config.json`). Exports `loadConfig()`, `saveConfig()`,
`validateConfig()`, and the `ServerConfig` / `SavedConnection` interfaces.

#### `src/connection.ts`
`ConnectionManager` class — the session registry for the whole server.

Key responsibilities:
- Stores a `Map<string, ODataClient>` keyed by session alias or config name
- `createInlineClient()` / `createInlineClientNamed()` — register one-off or named sessions
- `connectMulti()` — parallel bulk-connect with shared/per-entry credentials
- `getClientByName()` — side-effect-free lookup; does not change active session
- `setCurrentConnection()` — checks in-memory cache first, then saved config
- `listActiveSessions()` — returns `SessionInfo[]` with `isCurrent` and cached `fmVersion`
- `getServerVersion()` — delegates to the session's `ODataClient.getServerVersion()`

#### `src/odata-client.ts`
Axios-based HTTP client for FileMaker Server OData 4.01. One instance per session.

Key responsibilities:
- Constructs `/fmi/odata/v4/{database}/{table}` URLs with query params
- Executes GET / POST / PATCH / DELETE with Basic Auth
- `getServerVersion()` — lazy-fetches `$metadata`, caches result in `_cachedVersion`
- Redacts passwords from debug log output

#### `src/odata-parser.ts`
Stateless parsing helpers.

- `ODataParser.parseQueryResponse()` / `parseServiceDocument()` / `parseMetadata()`
- `ODataParser.formatError()` — normalises Axios/OData errors into readable strings
- `ODataParser.buildApplyExpression()` — builds `$apply=groupby((…),aggregate(…))` strings
- `ODataParser.buildCastExpression()` — builds `Field/Edm.Type` path segments
- `ODataParser.buildParameterizedFilter()` / `formatParamValue()` — `@alias` substitution

#### `src/fm-version.ts`
Server version detection and feature compatibility matrix (added in v0.5.1).

- `parseServerVersion(xml)` — extracts version from `$metadata` XML;
  tries `Org.OData.Core.V1.ProductVersion` annotation first, then `edmx:Edmx Version`
  attribute; returns `null` if undetectable
- `compareVersions(a, b)` — semver-style numeric comparison
- `isFeatureSupported(feature, version)` — consults `FM_FEATURE_MATRIX`
- `featureWarning(feature, version)` — returns advisory notice string or `null`
- `buildFeatureReport(version)` — returns `{ feature: { supported, minVersion } }` map
- `FM_FEATURE_MATRIX` — gates: `basic_odata` (FM 19+), `cast`/`build_filter` (FM 21.1+),
  `aggregate` (FM 22.0.1+)

#### `src/transport.ts`
Transport factory. Reads `MCP_TRANSPORT` env var and returns a `StdioServerTransport`,
`SimpleHttpTransport`, or `HttpsTransport` accordingly.

#### `src/http-server.ts`
Express server for HTTP/HTTPS transport mode. Registers CORS before routes, handles
`/health` and `/mcp` endpoints, implements graceful shutdown.

#### `src/working-http-transport.ts`
HTTP transport with the JSON-RPC notification fix: detects requests with no `id` field
(notifications), returns HTTP 204 immediately instead of waiting on a promise that never
resolves (which caused Dify and other standard MCP clients to stall).

#### `src/simple-http-transport.ts`
Streamable HTTP transport for MCP clients that use the newer streaming protocol
(e.g. Dify with `streamable_http`).

#### `src/logger.ts`
Thin wrapper around the `debug` package. All namespaces are prefixed `fms-odata-mcp:`.
Passwords are redacted before log output via a regex scrub.

#### `src/version.ts`
Reads the package version from `package.json` at runtime so the server's reported
version is always in sync with npm.

---

### Tools Layer (`src/tools/`)

#### `src/tools/index.ts`
Tool registry and routing dispatcher. Exports:
- `TOOL_DEFINITIONS` — array of all 26 MCP tool definition objects
- `handleToolCall(name, args)` — dispatches to the correct handler by set-membership lookup
- Named sets: `odataToolNames`, `connectionToolNames`, `configToolNames`

#### `src/tools/odata.ts`
Handlers for all 14 OData operation tools:
- `fm_odata_get_service_document`, `fm_odata_get_metadata`, `fm_odata_list_tables`
- `fm_odata_query_records`, `fm_odata_get_record`, `fm_odata_get_records`
- `fm_odata_count_records`, `fm_odata_create_record`, `fm_odata_update_record`
- `fm_odata_delete_record`
- `fm_odata_aggregate` — version-gated; server-side `$apply` on FM 22.0.1+,
  client-side fallback on older/unknown servers
- `fm_odata_cast` — prepends advisory notice when server version is incompatible
- `fm_odata_build_filter` — prepends advisory notice when server version is incompatible

All 11 connection-dependent tools accept an optional `connection` param to target
a specific session without changing the active session pointer.

#### `src/tools/connection.ts`
Handlers for all 8 connection/session tools:
- `fm_odata_connect`, `fm_odata_connect_multi`, `fm_odata_set_connection`
- `fm_odata_list_connections`, `fm_odata_get_current_connection`
- `fm_odata_list_active_sessions`, `fm_odata_describe_sessions`
- `fm_odata_get_server_version`

#### `src/tools/configuration.ts`
Handlers for all 4 saved-config tools:
- `fm_odata_config_add_connection`, `fm_odata_config_remove_connection`
- `fm_odata_config_get_connection`, `fm_odata_config_list_connections`
- `fm_odata_config_set_default_connection`

---

### Tests (`tests/`)

Unit tests run via `npm test` (jest + ts-jest, ESM mode). Integration tests in
`tests/integration/` are excluded from the default run.

| Test file | What it covers | Tests |
|-----------|---------------|-------|
| `unit/config-helpers.test.ts` | Config validation helpers | — |
| `unit/config.test.ts` | Env var loading, file loading | — |
| `unit/fm-version.test.ts` | Version parsing, feature matrix, client-side fallback | 55 |
| `unit/multi-session.test.ts` | ConnectionManager primitives, multi-connect, collision detection | 30 |
| `unit/odata-client.test.ts` | HTTP layer, URL construction | — |
| `unit/odata-parser.test.ts` | Response/error parsing, $apply/$filter/$cast builders | — |
| `unit/tool-routing.test.ts` | All 26 tool name→handler dispatch assertions | — |

**Total: 191 tests across 7 suites.**

---

## Development Workflow

```bash
npm run build          # TypeScript compile → dist/
npm test               # Run unit tests (jest, tests/unit/**)
npm run test:coverage  # With coverage report
npm run dev            # Build then run
./start.sh             # Build image and start HTTP Docker container
```
