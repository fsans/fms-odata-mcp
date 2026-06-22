# Changelog

All notable changes to `filemaker-odata-mcp` are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.8.3] - 2026-06-22

Bug-fix and consistency release. No new tools; tool count remains 35
(29 standard + 6 optional schema editing).

### Fixed

- **Dockerfile healthcheck** — The healthcheck command used `require()` in an
  ESM project (`"type": "module"`), causing `ReferenceError: require is not
  defined` and making the container always report unhealthy. Now uses
  `node --input-type=commonjs -e`.

- **Logger file path** — File logs were written to `~/fms-odata-mcp/logs/`
  instead of `~/.fms-odata-mcp/logs/` due to a `".."` traversal in the path
  construction. Logs now correctly land alongside the config file.

- **Multi-field `groupBy` in client-side aggregate fallback** —
  `computeClientSideAggregate` typed `groupBy` as `string` but the tool schema
  passes `string[]`. Multi-field groupings (e.g. `['Region', 'Status']`)
  collapsed all records into a single bucket. Now builds a composite key from
  all groupBy fields and emits one column per field in the result rows.

- **`buildParameterizedFilter` `$` injection** — `String.replace` with a string
  replacement interprets `$&`, `$1`, etc. specially. A param value containing
  `$100` would corrupt the output. Now uses a function replacement so `$` is
  treated literally.

- **Aggregate filter not normalized** — The `filter` passed to
  `fm_odata_aggregate` was embedded directly into the `$apply` expression
  without going through `normalizeFilter`, so non-ASCII field names (and v26+
  FMFID resolution) were not applied. `normalizeFilter` is now public and
  called on the filter before building the `$apply` expression.

- **`http-server.ts` broken transport wiring** — The standalone HTTP entry
  point passed the `FileMakerODataServer` wrapper to `setupSimpleHttpTransport`,
  which expects a real MCP `Server` (with a `connect` method). Rewrote to
  construct a bare `Server` with the same request handlers.

- **`countdistinct` counted null/undefined** — The client-side fallback for
  `countdistinct` included `undefined` values for records missing the field,
  inflating the distinct count by 1. Null/undefined values are now excluded.

- **`runScript` URL not encoded** — Script names with spaces or special
  characters (`#`, `?`, `%`) were sent unencoded in the URL path. Now wrapped
  in `encodeURIComponent`.

### Changed

- **`fm_odata_list_connections`** — Now lists both active in-memory sessions
  and saved connections in a single combined view, differentiating it from
  `fm_odata_config_list_connections` (saved-only) and
  `fm_odata_list_active_sessions` (active-only). Previously it was a duplicate
  of `fm_odata_config_list_connections`.

- **`fm_odata_connect_multi` duplicate alias detection** — Now rejects the
  call up front when two entries resolve to the same alias, instead of
  silently overwriting the first session in the cache.

- **`getClient` cached-client warning** — When `verifySsl`/`timeout` are
  passed but a cached client already exists for the connection name, a debug
  log now surfaces that the caller-supplied options are being ignored, with
  guidance to call `removeClient()` first.

- **Error message format unified** — All tool error responses now use
  `Error: ${message}`. Previously `index.ts` used `Error executing tool: ...`
  while other handlers used `Error: ...`.

- **`normalizeFilter` signature** — Removed unused `table` parameter and made
  the method public (was private) so it can be called from the aggregate path.

### Tests

- Fixed `fm-version.test.ts` groupBy test to pass an array (`["Category"]`)
  instead of a string, matching the tool's JSON schema.
- Total: 251 tests across 8 suites (unchanged count; one test corrected).

---

## [0.8.2] - 2026-06-17

Enhanced FileMaker Server 2026 (v26) metadata parsing and automatic FMFID field
resolution. Tool count increases from 34 to 35 (29 standard + 6 optional schema editing).

### Added

- **`fm_odata_describe_table`** — Returns full field metadata for a single table,
  including type, nullability, internal field ID (`FMFID`), computed/indexed flags,
  permissions (Read/ReadWrite), comments, and AI annotations. Enriched on v26+;
  basic info on older servers.

- **Automatic FMFID resolution in `$filter` (v26+)** — `ODataClient.normalizeFilter()`
  now resolves non-ASCII field names to their stable internal `FMFID` IDs when connected
  to FM Server 2026+. A name→FMFID lookup map is built from cached `$metadata` XML.
  Falls back to the existing double-quote auto-quoting strategy when the FMFID is not
  found or on older servers.

- **`parseMetadataForFields` v26 block-style parsing** — The parser now handles both
  self-closing `<Property ... />` tags (v22/v25) and block-style `<Property>...</Property>`
  elements containing child `<Annotation>` tags (v26+). Extracts:
  - `com.filemaker.odata.FieldID` → `FMFID:<id>`
  - `Org.OData.Core.V1.Computed` → `computed: true`
  - `com.filemaker.odata.Index` → `indexed: true`
  - `com.filemaker.odata.Calculation` → `calculation: true`
  - `Org.OData.Core.V1.Permissions` → `permissions: "Read" | "Read/Write"`
  - `com.filemaker.odata.FMComment` → `comment`
  - `com.filemaker.odata.AIAnnotation` → `aiAnnotation`

- **`field_id_in_metadata` feature flag** — Gated at FM Server `26.0.0`.
  Added to `FM_FEATURE_MATRIX` in `src/fm-version.ts`.

### Changed

- **`ODataClient` metadata caching** — `$metadata` XML is now cached after the first
  `getMetadata()` or `getServerVersion()` call, and a `_fieldIdMap` is built from it
  on v26+ servers.

### Tests

- New: v26 block-style Property annotation parsing, mixed self-closing/block-style
  fixtures, backward compat for v25, FMFID resolution in `normalizeFilter`,
  fallback to auto-quoting when FMFID is absent.
- Total: 251 tests across 8 suites (up from 244).

---

## [0.8.1] - 2026-06-17

FileMaker script execution via OData. Tool count increases from 32 to 34
(adds `fm_odata_run_script` and `fm_odata_list_scripts`).

### Added

- **`fm_odata_run_script`** — Run a FileMaker script by `scriptName` or `scriptId`
  (mutually exclusive). Accepts optional `scriptParam` (string, number, or JSON object).
  Returns `{ scriptName|scriptId, code, resultParameter, success }`. Non-zero script
  error codes surface as MCP tool errors.

- **`fm_odata_list_scripts`** — Parse `<Action>` elements from `$metadata` to list
  available scripts with their internal FMSID, parameter type, and return type.
  v26+ only; returns empty list on older servers.

- **`ODataClient.runScript(scriptName, scriptParam?)`** — POST to `/Script.{scriptName}`.

- **`ODataClient.runScriptById(scriptId, scriptParam?)`** — POST to `/Script.FMSID:{scriptId}`.
  v26+ preferred: calling by ID prevents breakage when scripts are renamed in FileMaker.

- **`ODataParser.parseMetadataForScripts`** — Extracts script metadata from `<Action Name="Script.*">`
  elements in `$metadata` XML.

- **`run_scripts` and `script_metadata` feature flags** — Added to `FM_FEATURE_MATRIX`.
  `run_scripts` gated at FM 19.0.0 (all supported servers). `script_metadata` gated at
  FM 26.0.0.

### Tests

- New: `tests/unit/odata-client.test.ts` — script execution tests (by name without
  param, with string param, with JSON object param, error handling, invalid response
  format, by ID without param, by ID with param, privilege failure).
- New: `tests/unit/odata-parser.test.ts` — `parseMetadataForScripts` tests (empty
  metadata, no Script actions, full parsing with all fields, missing optional fields).
- Total: 244 tests across 8 suites (up from 223).

---

## [0.8.0] - 2026-06-11

Documentation overhaul, project reorganization, and roadmap updates.
No functional code changes.

### Changed

- **Documentation reorganization** — Moved working/development docs (`ARCHITECTURE.md`,
  `TESTING_GUIDE.md`, `PROJECT_STRUCTURE.md`, etc.) from `dev_stuf/` to new `private/` folder.
  Added `private/` to `.gitignore` so internal working documents are excluded from publication.

- **All public documentation reviewed and updated** — `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`,
  `DOCKER.md`, `dev_stuf/*.md`: updated tool counts (32 total), `FM_ALLOW_SCHEMA_EDITS` references,
  MCP server key (`filemaker-odata`), broken link removals, and schema editing documentation.

- **ROADMAP.md** — Moved to repository root. Added v0.6.x/v0.7.0 history. Added 3 new planned
  features with confirmed FileMaker support: script execution, container upload, and batch requests.
  Assigned target versions: v0.8.1 (scripts), v0.8.3 (containers), v0.8.5 (batch), v0.9.0 (performance).

---

## [0.7.0] - 2026-06-11

FileMaker OData schema (DDL) editing support. Tool count: 26 by default,
32 when schema editing is enabled.

### Added

- **6 schema (DDL) tools** wrapping FileMaker's proprietary OData schema extension
  (`FileMaker_Tables` / `FileMaker_Indexes` system endpoints):
  - `fm_odata_create_table` — `POST /FileMaker_Tables` with table name and field definitions
  - `fm_odata_add_fields` — `PATCH /FileMaker_Tables/{table}` with a fields array
  - `fm_odata_delete_table` — `DELETE /FileMaker_Tables/{table}` (destructive)
  - `fm_odata_delete_field` — `DELETE /FileMaker_Tables/{table}/{field}` (destructive)
  - `fm_odata_create_index` — `POST /FileMaker_Indexes/{table}` with `{indexName}`
  - `fm_odata_delete_index` — `DELETE /FileMaker_Indexes/{table}/{field}`

- **`FM_ALLOW_SCHEMA_EDITS` environment flag** — schema tools are only registered when
  set to `true`. Disabled tools return a clear "schema editing is disabled" error if
  called anyway. New `getAllTools()` export evaluates the flag at request time.

- **`confirm: true` guard** — `fm_odata_delete_table` and `fm_odata_delete_field`
  refuse to execute without an explicit `confirm: true` argument, returning a warning
  describing the data that would be destroyed.

- **`ODataClient` DDL methods** — `createTable`, `addFields`, `deleteTable`,
  `deleteField`, `createIndex`, `deleteIndex` with URL-encoded path segments.
  New exported interfaces `FMFieldDefinition` and `FMTableDefinition`.

- All 6 tools accept the optional per-call `connection` parameter (multi-session).

### Tests

- New: `tests/unit/schema-tools.test.ts` — 23 tests covering env gating, routing,
  confirm-flag refusal, URL/body construction, special-character encoding, and
  error surfacing.
- Total: 223 tests across 8 suites (up from 200 across 7).

---

## [0.6.1] - 2026-06-10

FileMaker Server 2026 (v26) OData metadata enhancement support. Tool count stays 26.

(Iterative build 0.6.1 — replaces 0.6.0 for easier testing tracking.)

### Added

- **`metadata_comments` feature flag** — added to `FM_FEATURE_MATRIX` in `src/fm-version.ts`.
  Gated at FM Server `26.0.0` (FileMaker 2026). Exposed in `fm_odata_get_server_version`
  feature-compatibility report.

- **Version-gated metadata comment extraction** — `ODataParser.parseMetadataForTables` and
  `parseMetadataForFields` now accept an optional `serverVersion` parameter. When the
  connected server is v26+, table comments and AI annotations are extracted from
  OData `$metadata` XML annotations and surfaced in tool output. On v25 and older
  (or when version is unknown) the parser skips these elements entirely to avoid
  false positives.

- **`fm_odata_list_tables` — optional `includeDetails` parameter** — when set to `true`
  and the server is v26+, table names are returned with their user-provided comments
  (e.g. `contact — Contact table`). Defaults to `false` for backwards compatibility.

- **`fm_odata_describe_sessions` — enriched field metadata** — when connected to a v26+
  server, the merged schema output now includes `comment` on tables and both `comment`
  and `aiAnnotation` on fields.

### Server-side fixes (no MCP code changes required)

FileMaker Server v26 fixed the following OData issues; MCP clients benefit automatically:

- Value-list metadata crash (8309 / "FirstValues" column reference) — metadata requests
  for files with field-based value lists no longer fail.
- Text resembling timestamps no longer misinterpreted as timestamps.
- OData log file 35 MB hang resolved.
- Negative decimal values between -1 and 0 (e.g. `-0.25`) now emitted as valid JSON.
- Webhooks now fire on Delete All Records / Truncate Table, returning `ROWID -1`.
- `?` values in number fields now returned as `null` (valid JSON) instead of literal `?`.
- Null bytes in text fields are now escaped/omitted in JSON, XML, and HTML responses.
- Excel OData connection failure due to missing `ROWID` property is fixed.

### Tests

- New: v26 metadata parser tests — comment extraction gated by server version,
  AI annotation parsing, backwards-compatibility for v25 and unknown servers.
- New: `metadata_comments` feature-matrix assertions in `fm-version.test.ts`.
- Updated: `parseMetadataForTables` tests now expect `TableInfo[]` instead of `string[]`.
- Total: 199 tests across 7 suites (up from 191).

---

## [0.5.1] - 2026-06-02

Server version detection, feature compatibility matrix, and smart fallbacks.
Tool count increases from 25 to 26.

### Added

- **`fm_odata_get_server_version`** — detects FileMaker Server version from `$metadata`
  XML (cached per session, zero extra HTTP calls on subsequent uses). Returns structured
  JSON: `{ session, server, database, version, features }` where `features` is a
  compatibility map (`basic_odata`, `cast`, `build_filter`, `aggregate`).

- **`src/fm-version.ts`** — new module: `FMServerVersion` interface, `FM_FEATURE_MATRIX`,
  `parseServerVersion()`, `compareVersions()`, `isFeatureSupported()`,
  `featureWarning()`, `buildFeatureReport()`.

- **Version detection** reads the `Org.OData.Core.V1.ProductVersion` annotation in
  `$metadata` XML first; falls back to the `Version` attribute on `edmx:Edmx`; returns
  `null` if undetectable. Result is cached in `ODataClient._cachedVersion` for the
  session lifetime.

- **Feature compatibility matrix**:
  - `basic_odata` — FM 19.0.0+ (all supported servers)
  - `cast` — FM 21.1.0+ (FileMaker 2024)
  - `build_filter` — FM 21.1.0+ (FileMaker 2024)
  - `aggregate` — FM 22.0.1+ (FileMaker 2025)

### Changed

- **`fm_odata_aggregate`** — now version-gated: executes server-side `$apply` on
  FM 22.0.1+; falls back to client-side computation (sum/avg/min/max/count/countdistinct
  and groupBy) capped at 10 000 records on older or unknown servers. A `[Compatibility]`
  advisory notice is prepended to the result when the fallback is used.

- **`fm_odata_cast`** and **`fm_odata_build_filter`** — prepend an advisory notice
  when the server version is known-incompatible or undetectable. Expression is always
  returned; no hard errors.

- **`fm_odata_list_active_sessions`** — appends `| FM Server x.x.x` when version is
  already cached for a session (zero extra HTTP calls).

### Tests

- New: `tests/unit/fm-version.test.ts` — 55 tests covering version parsing (8 EDMX
  fixture variants), `compareVersions`, `isFeatureSupported` across all boundaries,
  `featureWarning`, `buildFeatureReport` for v19/v22/null, all 6 client-side aggregate
  methods, groupBy, server-side path, and `fm_odata_get_server_version` routing.
- Total: 191 tests across 7 suites (up from 146 across 6 suites).

---

## [0.5.0] - 2026-06-02

### Added

- **`fm_odata_connect_multi`** — bulk-connect N databases in one call.
  Accepts a shared `server`/`user`/`password` plus a `databases` array
  where each entry can override credentials and set an `alias` and `primary` flag.
  Connects and tests all sessions in parallel; sets the primary (or first
  successful) session as active. Designed for FileMaker separation-of-concerns
  solutions (LOGIC + DATA files) and multi-solution server setups.

- **`fm_odata_list_active_sessions`** — list all live in-memory sessions.
  Returns alias, server, database, user, and which session is currently active.
  Replaces guessing for AI agents working in multi-file environments.

- **`fm_odata_describe_sessions`** — merged schema across all active sessions.
  Calls `$metadata` on every session in parallel, returns a flat annotated table
  list `[{table, connection, fieldCount, fields[]}]`. Flags table name collisions
  across sessions and suggests using the `connection` param to disambiguate.

- **Per-call `connection` parameter** on all 11 connection-dependent OData tools
  (`fm_odata_get_service_document`, `fm_odata_get_metadata`, `fm_odata_list_tables`,
  `fm_odata_query_records`, `fm_odata_get_record`, `fm_odata_get_records`,
  `fm_odata_count_records`, `fm_odata_aggregate`, `fm_odata_create_record`,
  `fm_odata_update_record`, `fm_odata_delete_record`).
  Lets AI agents target a specific session per call without changing the active
  session pointer. Stateless tools (`fm_odata_cast`, `fm_odata_build_filter`)
  are unaffected.

- **`ConnectionManager.getClientByName()`** — side-effect-free session lookup
  by alias; does not mutate the active connection pointer.

- **`ConnectionManager.listActiveSessions()`** — returns `SessionInfo[]` for all
  in-memory sessions including `isCurrent` flag.

- **Explicit alias support** in `ConnectionManager.createInlineClientNamed()` —
  multi-connect sessions are registered under human-readable aliases rather than
  auto-generated `inline_…` keys.

### Changed

- **`fm_odata_set_connection`** — now accepts runtime session aliases (inline /
  multi-connect) in addition to persisted config names.

- **`ConnectionManager.setCurrentConnection()`** — checks in-memory session cache
  first, then falls back to persisted config, eliminating the need to re-register
  inline sessions.

### Fixed

- **`working-http-transport.ts` TypeScript strict-null error** — pre-existing
  `TS2345` ("undefined not assignable to string | number") in the pending-response
  map lookup; guarded with an explicit null check.

### Tests

- New: `tests/unit/multi-session.test.ts` — 30 tests covering ConnectionManager
  primitives, tool routing for all 3 new tools, per-call connection targeting,
  session switching, collision detection.
- Extended: `tests/unit/tool-routing.test.ts` — 3 new routing assertions.
- Total: 146 tests across 6 suites (up from 121 across 5 suites).

---

## [0.4.0] - 2026-06-01

Three new expression-builder tools for FileMaker Server 2025 OData capabilities.
All three are **connection-free** — they build query expressions locally and return
strings ready to pass into existing tools like `fm_odata_query_records`.
Total tool count increases from 19 to 22.

### Added

- **`fm_odata_aggregate`** — server-side aggregation via OData `$apply`
  (requires FileMaker Server v22.0.1+ / FileMaker 2025 or later).
  Accepts `table`, `method` (sum/average/min/max/countdistinct/count), `alias`,
  optional `field`, `groupBy` array, and `filter` pre-condition.
  Internally builds `groupby((…),aggregate(…))` / `filter(…)/…` expressions via
  `ODataParser.buildApplyExpression()` and executes a GET with `?$apply=…`.

- **`fm_odata_cast`** — server-side type coercion via OData property path segments
  (requires FileMaker Server v21.1+ / FileMaker 2024 or later).
  Accepts an array of `{field, type}` pairs and an optional `context`
  (`select` or `filter`). Returns `Field/Edm.Type` expressions ready for use in
  `$select` or embedded in `$filter`. No active connection required.
  Supported types: `String`, `Int32`, `Int64`, `Decimal`, `Double`, `Boolean`,
  `Date`, `TimeOfDay`, `DateTimeOffset`.

- **`fm_odata_build_filter`** — parameterized `$filter` builder via OData `@alias`
  syntax (requires FileMaker Server v21.1+ / FileMaker 2024 or later).
  Accepts a `template` string with `@alias` placeholders, a `params` map, and an
  optional `mode`:
  - `resolved` (default): substitutes alias values into the template and returns a
    plain filter string for immediate use in `fm_odata_query_records`.
  - `raw`: returns the OData parameterized query string form
    (`$filter=…&@alias=value`) for manual URL construction.
  String values are auto-quoted and internal single quotes doubled; numbers,
  booleans, and `null` are passed through as-is. No active connection required.

- **`ODataParser.buildApplyExpression()`** — static helper building `$apply`
  expressions from structured aggregation inputs.

- **`ODataParser.buildCastExpression()`** — static helper producing
  `Field/Edm.Type` path segments; normalises bare type names and `Edm.`-prefixed
  names to the same output.

- **`ODataParser.buildParameterizedFilter()`** — static helper for `@alias`
  substitution in filter templates; supports resolved and raw modes.

- **`ODataClient.aggregateRecords()`** — new method executing GET with `?$apply=`.

- **`AGENTS.md`** — project-level rules file for AI agents: no attribution footers
  in commits, documented FileMaker OData unsupported features (lambda `any`/`all`,
  `$search`, geo functions).

### Not implemented (FileMaker limitation)

- **Lambda operators `any` / `all`** — officially unsupported by FileMaker Server
  OData (listed in Claris `odata-unsupported-features.html`, current as of 2026).
  Will not be implemented until Claris adds support.

### Tests

- 22 new unit tests: `buildApplyExpression` (9), `buildCastExpression` (6),
  `buildParameterizedFilter` (10), plus 6 routing/behaviour tests for the new tools.
- Total: 121 tests across 5 suites (up from 90).

---

## [0.3.1] - 2026-05-25

Patch release on top of 0.3.0. Version bump and npm publish housekeeping.

### Changed

- Version bumped to 0.3.1 for npm release consistency

---

## [0.3.0] - 2026-05-25

Major stability and correctness release. All changes since 0.2.8 are included here.
FileMaker 2025 advanced OData features (aggregation, type casting, parametrization)
were deferred from this release to keep it focused on reliability; they are
implemented in v0.4.0. Lambda operators (`any`/`all`) remain unsupported by
FileMaker Server OData and are not planned.

### Added

- **`fm_odata_test_connection_detailed`** — new tool that surfaces the real underlying
  error (network, SSL, auth) when a connection attempt fails, replacing opaque failures
  ([#8](https://github.com/fsans/FMS-ODATA-MCP/issues/8))
- **Docker localhost warning** — server prints a clear warning at startup when
  `MCP_HOST=localhost` is detected inside a container, guiding users to use `0.0.0.0`
  ([#10](https://github.com/fsans/FMS-ODATA-MCP/issues/10))

### Fixed

- **OData URL construction** — fixed FileMaker-incompatible URL building that caused
  query failures on certain table/filter combinations
  ([#2](https://github.com/fsans/FMS-ODATA-MCP/pull/2))
- **OData response parser** — corrected response parsing bugs introduced by the above;
  regex metacharacters in table names are now properly escaped
  ([#11](https://github.com/fsans/FMS-ODATA-MCP/issues/11))
- **Tool routing** — tools are now dispatched by exact name-set lookup instead of
  fragile string-prefix matching, preventing mis-routing of similarly named tools
  ([#2](https://github.com/fsans/FMS-ODATA-MCP/issues/2))
- **JSON-RPC response correlation** — concurrent HTTP requests no longer receive each
  other's responses; responses are matched by request `id`
  ([#3](https://github.com/fsans/FMS-ODATA-MCP/issues/3))
- **CORS middleware ordering** — CORS headers are now registered before route handlers,
  fixing preflight (`OPTIONS`) request failures
  ([#6](https://github.com/fsans/FMS-ODATA-MCP/issues/6))
- **SIGTERM / graceful shutdown** — server now handles `SIGTERM` for clean Docker
  container stops; `dumb-init` no longer required to avoid zombie processes
  ([#20](https://github.com/fsans/FMS-ODATA-MCP/issues/20))
- **Failed inline connection cleanup** — a failed `fm_odata_connect` call no longer
  leaves a broken partial connection in state; the real error is reported
  ([#14](https://github.com/fsans/FMS-ODATA-MCP/issues/14))
- **`validateConfig` at startup** — configuration is now validated when the server
  starts, not lazily on first use; misconfigured environments fail fast with a clear
  message ([#15](https://github.com/fsans/FMS-ODATA-MCP/issues/15))
- **Centralised default ports** — default HTTP (3333) and HTTPS (3443) ports now live
  in a single shared constants file, eliminating drift between transport modules
  ([#12](https://github.com/fsans/FMS-ODATA-MCP/issues/12))
- **Runtime version** — server version is now read from `package.json` at runtime
  instead of being hardcoded, so it always matches the published package
  ([#9](https://github.com/fsans/FMS-ODATA-MCP/issues/9))

### Security

- **Password redaction in debug logs** — passwords are scrubbed from tool argument
  objects before they are written to debug output, preventing credential exposure in
  log files ([#22](https://github.com/fsans/FMS-ODATA-MCP/issues/22))

### Refactored

- **Config saved-file schema** — tightened validation schema for
  `~/.fms-odata-mcp/config.json`; added field trimming and a dedicated `verifySsl`
  helper to centralise SSL flag coercion
  ([#16](https://github.com/fsans/FMS-ODATA-MCP/issues/16),
  [#17](https://github.com/fsans/FMS-ODATA-MCP/issues/17),
  [#18](https://github.com/fsans/FMS-ODATA-MCP/issues/18))

### Tests

- Added unit tests for tool routing and config helpers; tightened mock typings
- Removed unused MCP schema imports from `tools/odata.ts`
- Removed unused `Express` import from `simple-http-transport.ts`

---

## [0.2.8] - 2026-03-26

### Changed

- Version bump to 0.2.8; documentation updates

---

## [0.2.7] - 2026-03-24

### Changed

- Documentation updates

---

## [0.2.6] - 2026-03-19

### Added

- Multi-platform Docker support (ARM64 / Apple M-series)

---

## [0.2.x] - 2026-03-19

Early patch releases (0.2.2 – 0.2.5) addressing Docker image naming, case sensitivity,
and initial ARM64 build pipeline issues.

---

## [0.2.0] - 2026-03-xx

### Added

- HTTP and HTTPS transport modes (`MCP_TRANSPORT=http|https`)
- Docker deployment with Docker Compose and health checks
- `filemaker-odata-mcp` CLI binary (installable via `npm install -g` or `npx`)

---

## [0.1.x] - 2026-xx-xx

### Added

- Initial release with 19 MCP tools over stdio transport
- OData 4.01 CRUD operations against FileMaker Server
- Saved and default connection management (`~/.fms-odata-mcp/config.json`)
- SSL support with optional certificate verification bypass
- `DEBUG=filemaker-odata-mcp:*` logging support
