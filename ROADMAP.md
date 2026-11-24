# FileMaker OData MCP - Roadmap & Future Enhancements

## Version History

- **v0.1.0** — Initial release: Basic OData 4.01 implementation (stdio transport)
- **v0.1.2** — Bug fixes and stability improvements
- **v0.2.0** — HTTP/HTTPS transport, Docker deployment, CLI binary
- **v0.2.6** — 19 MCP tools, enhanced connection management, NPM package published
- **v0.3.0** — Stability & correctness: bug fixes, security hardening, test coverage, Dify support
- **v0.3.1** — Patch release on top of v0.3.0
- **v0.4.0** — FileMaker 2025 advanced OData features (aggregation, type casting, parameterization). 22 tools.
- **v0.5.0** — Multi-session / multi-file support: `fm_odata_connect_multi`, session management,
  per-call `connection` param. 25 tools.
- **v0.5.1** — Server version detection, feature matrix, aggregate fallback. 26 tools.
- **v0.6.0 / v0.6.1** — FileMaker Server 2026 (v26) metadata comment/annotation extraction. 26 tools.
- **v0.7.0** — Schema (DDL) editing tools: create/alter/delete tables, fields, and indexes via
  `FileMaker_Tables` / `FileMaker_Indexes`. 32 tools total (26 standard + 6 opt-in schema editing).
- **v0.8.0** — Documentation overhaul and project reorganization. Working docs moved to `private/`,
  all public docs reviewed and updated, ROADMAP restructured with confirmed planned features.
- **v0.8.1** — Run FileMaker scripts via OData: `fm_odata_run_script`, `fm_odata_list_scripts`,
  call-by-name and call-by-FMSID. 34 tools total.
- **v0.8.2** — Enhanced v26 metadata parsing: child annotations inside `<Property>`, automatic
  FMFID resolution for non-ASCII field names in `$filter`, `fm_odata_describe_table`.
  35 tools total (29 standard + 6 optional schema editing).
- **v0.8.3** — Bug-fix and consistency release: Dockerfile healthcheck (ESM `require`),
  logger path, multi-field `groupBy` client-side fallback, `$` injection in
  `buildParameterizedFilter`, aggregate filter normalization, `http-server.ts`
  transport wiring, `countdistinct` null handling, `runScript` URL encoding,
  duplicate alias detection in `connect_multi`, unified error format.
  35 tools total (unchanged).
- **v0.9.0** — Major improvement release: batch operations (3 tools), pagination
  helper (1 tool), Bearer token auth (Phase 1), HTTP transport security,
  graceful shutdown, metadata cache invalidation, NaN guard, dependency patches,
  Node.js 24 LTS upgrade, dead code removal, expanded test coverage.
  39 tools total (33 standard + 6 optional schema editing).
- **v0.9.1** — Patch release: fix duplicate server startup when launched via the
  `fms-odata-mcp` CLI binary (#16).
- **v0.9.2** — Patch release: lazy resolution of saved named connections
  (per-call `connection` param works on cold start without
  `fm_odata_set_connection`), env-var default connection fallback, Bearer auth
  persistence in saved connections, cold-start fixes for
  `fm_odata_get_server_version` / `fm_odata_get_current_connection`.
- **v0.9.3** — Patch release: fix TLS handshake `decode_error` (SSL alert 50)
  on OpenSSL 3.5+ hosts against FileMaker Server (#18), new
  `FM_TLS_MAX_VERSION` env var; surface underlying socket/TLS error details in
  connection failures.
- **v0.9.4** — Patch release: dependency security updates (`npm audit` clean;
  express 4.22.3, axios 1.20, MCP SDK 1.30+); git history scrubbed of a
  committed TLS private key and test credential (re-clone advised).

---

## ✅ Completed

### v0.2.x — Foundation

- **HTTP/HTTPS Transport** — Standalone server mode (`MCP_TRANSPORT=http|https`)
- **Docker Deployment** — Full Docker and Docker Compose support with health checks
- **CLI Binary** — `fms-odata-mcp` command, installable via `npm install -g` or `npx`
- **19 MCP Tools** — Discovery, Queries, CRUD, Connection, and Configuration
- **Saved Connections** — Persisted connection config in `~/.fms-odata-mcp/config.json`
- **Debug Logging** — `DEBUG=fms-odata-mcp:*` support with password redaction

### v0.3.x — Stability & Correctness

- **SIGTERM handling** — Graceful Docker shutdown
- **CORS fix** — Preflight failures resolved
- **JSON-RPC response correlation** — Concurrent HTTP requests no longer mismatched
- **Security: password redaction** — Credentials scrubbed from debug logs
- **Dify / Streamable HTTP support** — JSON-RPC notifications return HTTP 204 immediately

### v0.4.0 — FileMaker 2025 / 2024+ Expression Builders

- **`fm_odata_aggregate`** — Server-side `$apply` aggregation (FM v22.0.1+ / FM 2025)
- **`fm_odata_cast`** — Type coercion via `Field/Edm.Type` paths (FM v21.1+ / FM 2024)
- **`fm_odata_build_filter`** — Parameterized `$filter` via `@alias` (FM v21.1+ / FM 2024)
- **Lambda operators `any`/`all`** — Explicitly **not implemented** (unsupported by FileMaker Server)

### v0.5.x — Multi-Session & Version Awareness

- **`fm_odata_connect_multi`** — Bulk-connect N databases in one call
- **`fm_odata_list_active_sessions`** — Live in-memory session list
- **`fm_odata_describe_sessions`** — Merged `$metadata` schema across all sessions
- **Per-call `connection` parameter** — Target any session without changing the active one
- **`fm_odata_get_server_version`** — Version detection + feature-compatibility matrix
- **Version-gated fallbacks** — `aggregate` falls back to client-side on older servers

### v0.6.x — FileMaker 2026 Metadata Comments (partial)

- **`metadata_comments` feature flag** — Gated at FM Server `26.0.0`
- **`fm_odata_list_tables` — `includeDetails`** — Returns table comments on v26+
- **`fm_odata_describe_sessions`** — Enriched with `comment` and `aiAnnotation`

### v0.7.0 — Schema Editing (DDL)

- **6 schema tools** wrapping `FileMaker_Tables` / `FileMaker_Indexes`:
  `fm_odata_create_table`, `fm_odata_add_fields`, `fm_odata_delete_table`,
  `fm_odata_delete_field`, `fm_odata_create_index`, `fm_odata_delete_index`
- **Opt-in gating** — Only registered when `FM_ALLOW_SCHEMA_EDITS=true`
- **Confirm guards** — Destructive operations require `confirm: true`
- **Multi-session** — All DDL tools accept per-call `connection` parameter

### v0.8.1 — Run FileMaker Scripts

> **Important: Call scripts by stable internal FMSID (v26+)**
> Starting with v0.8.1, when connected to FileMaker Server 2026 (v26+), you can run
> scripts by their internal `FMSID` instead of the script name. This prevents
> integration breakage when scripts are renamed in FileMaker Pro.

- **`fm_odata_run_script`** — Run a FileMaker script by `scriptName` or `scriptId`
  (mutually exclusive), with optional `scriptParam` (string, number, or JSON object).
  Returns `{ scriptResult: { code, resultParameter } }`. Non-zero error codes surface
  as MCP tool errors.
- **`fm_odata_list_scripts`** — Parse `<Action>` elements from `$metadata` to list
  available scripts with their internal FMSID, parameter type, and return type.
  v26+ only; returns empty list on older servers.
- **`ODataClient.runScript(scriptName, scriptParam?)`** — POST to `/Script.{scriptName}`.
- **`ODataClient.runScriptById(scriptId, scriptParam?)`** — POST to `/Script.FMSID:{scriptId}`.
  Preferred on v26+: calling by ID prevents breakage when scripts are renamed.
- **Script metadata in `$metadata` (v26+)** — FM Server 26 exposes scripts as `<Action>`
  elements with `com.filemaker.odata.ScriptID` annotations.
- **Limitations**: Script names cannot contain `@`, `&`, `/` or start with a number;
  only web-compatible script steps run successfully; scripts that modify data must
  include `Commit Records/Requests`.

### v0.8.2 — Enhanced v26 Metadata Parsing

> **Important: Automatic FMFID Resolution for non-ASCII field names**
> Starting with v0.8.2, when connected to FileMaker Server 2026 (v26+), the MCP
> server **automatically resolves non-ASCII field names to their internal `FMFID`
> IDs** in `$filter` expressions. This eliminates the need for double-quote escaping
> and prevents query breakage when fields are renamed. On v25 and older servers,
> the previous auto-quoting strategy remains as the fallback.

- **`parseMetadataForFields` rewrite** — Parses child `<Annotation>` elements inside
  `<Property>` blocks (v26+) while preserving self-closing `<Property ... />` support
  for v22/v25 backward compatibility.
- **Enriched `FieldInfo`** — New fields on v26+:
  - `fieldId` (`FMFID:<int>`) — stable internal field ID
  - `computed` / `calculation` — `true` for calculated fields
  - `indexed` — `true` if the field is indexed
  - `permissions` — `"Read"` or `"Read/Write"`
  - `comment` — from `com.filemaker.odata.FMComment`
  - `aiAnnotation` — from `com.filemaker.odata.AIAnnotation`
- **Automatic FMFID resolution in `$filter`** — `ODataClient` builds a name→FMFID
  lookup map from cached metadata. Non-ASCII identifiers are substituted with
  their `FMFID` on v26+; falls back to double-quote auto-quoting when unavailable
  or on older servers.
- **`fm_odata_describe_table`** — New tool returning full field metadata for a single
  table (types, IDs, flags, permissions, comments).
- **`field_id_in_metadata` feature flag** — Gated at FM Server `26.0.0`.

### v0.9.0 — Batch Operations, Pagination, Bearer Auth, Security & Stability

- **`fm_odata_create_records` / `fm_odata_update_records` / `fm_odata_delete_records`** —
  Bulk CRUD via OData `$batch` (multipart/mixed) with parallel fallback strategy.
  Configurable cap via `FM_BATCH_MAX_ITEMS` (default 100).
- **`fm_odata_query_all_records`** — Pagination helper following `@odata.nextLink`
  with `$skip` fallback. Default page size 100 via `Prefer: odata.maxpagesize`,
  hard cap 50,000 records.
- **Bearer token authentication (Phase 1)** — `authType` + `bearerToken` on
  `fm_odata_connect` and `fm_odata_connect_multi`. `FM_AUTH_TYPE` / `FM_BEARER_TOKEN`
  env vars. Backward compatible (Basic Auth default).
- **MCP transport security** — Optional `MCP_AUTH_TOKEN` for HTTP/HTTPS transport.
- **Graceful shutdown** — HTTP server listener closed on SIGTERM/SIGINT.
- **Metadata cache invalidation** — Cached `$metadata` invalidated after schema mutations.
- **NaN guard** — `parseInt` guarded against non-numeric config values.
- **Dependency patches** — express, axios, MCP SDK updated to fix vulnerabilities.
- **Node.js 24 LTS** — Upgraded from EOL Node.js 18.
- **Dead code removed** — `http-server.ts`, batch stub, `formatBatchResults`.
- **Test coverage expanded** — 378 tests across 18 suites (up from 251/8).
- **39 tools total** (33 standard + 6 optional schema editing).

### v0.9.1 – v0.9.4 — Patch releases

- **v0.9.1** — Fixed duplicate server startup via `fms-odata-mcp` CLI binary (#16).
- **v0.9.2** — Lazy resolution of saved named connections; cold-start fixes.
- **v0.9.3** — TLS handshake `decode_error` fix on OpenSSL 3.5+; `FM_TLS_MAX_VERSION`;
  underlying error details surfaced in connection failures.
- **v0.9.4** — `npm audit` clean (0 vulnerabilities); git history scrubbed of a
  committed TLS private key (rotated) and test credential (redacted).
- **Current state**: 394 tests across 18 suites.

---

## 🔧 In Progress / Planned

### 1. Container Field Support — Upload & Download (v0.9.5)

**Status**: ✅ Completed (feature/containers)  
**Priority**: High  
**Estimated Effort**: 2-3 days  
**FileMaker Support**: Yes — confirmed via Claris docs / fms-odata-spec.
Three relevant endpoints:

- **Base64 inline (create/update)** — include base64 string + `@com.filemaker.odata.Filename` /
  `@com.filemaker.odata.ContentType` annotation properties in POST/PATCH JSON body.
  Only GIF, PNG, JPEG, TIFF, PDF are supported; media type is inferred from the first bytes.
- **Binary upload** — `PATCH /{table}({id})/{containerField}` with raw binary body,
  `Content-Type` header, and `Content-Disposition: inline; filename=...` header.
- **Binary download** — `GET /{table}({id})/{field}/$value` returns the raw bytes
  (also works for plain fields — returns the value as text). Container fields are
  **excluded** from normal record responses, so this is the only way to read them.

**Description**: Full container field lifecycle. Today the MCP can neither upload
nor download container data — agents must fall back to FileMaker scripts or the
Data API. Base64 keeps the protocol text-only (works over stdio); binary
upload/download applies to the HTTP transport path.

**Implementation Tasks**:
- [x] `uploadContainerBase64(table, recordId, field, base64Data, filename, contentType)`
  to `ODataClient` — PATCH JSON body with base64 value + annotation properties
- [x] `uploadContainerBinary(table, recordId, field, binaryData, filename, contentType)`
  to `ODataClient` — PATCH binary body with proper headers
- [x] `getFieldValue(table, recordId, field)` / `downloadContainer(...)` to
  `ODataClient` — GET `/{table}({id})/{field}/$value`, return base64 + detected
  content type (MCP responses are JSON; raw bytes must be base64-wrapped)
- [x] New tool: `fm_odata_upload_container` — `table`, `recordId`, `field`,
  `base64Data`, `filename`, `contentType`
- [x] New tool: `fm_odata_download_container` — `table`, `recordId`, `field`;
  returns `{ base64Data, filename?, contentType }`
- [x] New tool (or extend `get_record`): `fm_odata_get_field_value` for scalar
  fields (text/number returned unwrapped)
- [x] Validate base64 input; warn about media-type inference (FileMaker infers
  from first bytes — misidentification is possible)
- [x] Unit tests for base64 construction, binary path (mocked), error handling

---

### 2. Enhanced Error Handling (v0.9.5)

**Status**: 📋 Planned — partially delivered  
**Priority**: High  
**Estimated Effort**: 2-3 days

**Already done**: underlying socket/TLS error details are surfaced in connection
failures (v0.9.3). Remaining work:

**Implementation Tasks**:
- [ ] Structured error codes (e.g., `FM_AUTH_ERROR`, `FM_NOT_FOUND`, `FM_SCHEMA_ERROR`)
- [ ] Error recovery strategies (retry with backoff on transient failures)
- [ ] Connection retry logic for network timeouts
- [ ] Better timeout handling (distinguish connect vs read timeouts)
- [ ] User-friendly error formatting for MCP tool responses

---

### 3. FileMaker `Prefer` Headers & Record IDs (v0.9.5 / v1.0.0)

**Status**: 📋 Planned  
**Priority**: Medium  
**Estimated Effort**: 1-2 days  
**FileMaker Support**: Yes — three FileMaker-specific `Prefer` values documented
in fms-odata-spec.

FileMaker ignores `Prefer: return=representation`, so create/update responses
don't include the new record's internal ID. FileMaker-specific Prefer headers
may close that gap:

**Implementation Tasks**:
- [ ] Test `Prefer: fmodata.entity-ids` on create/update — if it returns record
  IDs, expose them in `create_record` / `create_records` responses
- [ ] Test `Prefer: fmodata.basic-timestamp` and `fmodata.gmtoffset` — expose as
  optional request options on write tools if they change timestamp semantics
- [ ] Confirm `Prefer: return=representation` is truly ignored (already noted in
  code) — document the limitation for users

---

### 4. MCP Protocol Surface (v1.0.0)

**Status**: 📋 Planned  
**Priority**: Medium  
**Estimated Effort**: 3-4 days

The server currently declares empty `resources: {}` and uses no annotations or
structured output. MCP 2025-spec additions would improve agent UX:

**Implementation Tasks**:
- [ ] **Tool annotations** — `readOnlyHint` on query/describe tools,
  `destructiveHint` on delete/schema tools (helps clients auto-confirm)
- [ ] **`outputSchema` + `structuredContent`** — typed tool responses per MCP
  2025-06-18 spec (record objects, table lists, metadata)
- [ ] **MCP Resources** — expose `$metadata`, table lists, and record pages as
  `mcp://` resources for clients that support resource subscriptions
- [ ] **Progress notifications** — `notifications/progress` during
  `query_all_records` pagination
- [ ] **Completion** — `completion/complete` for table/field/script name args

---

### 5. Performance Optimization (v1.0.0)

**Status**: 📋 Planned — partially delivered  
**Priority**: Medium  
**Estimated Effort**: 2-3 days

**Already done**: `$metadata` caching per session (with invalidation on schema
mutations), `Prefer: odata.maxpagesize` server-driven paging, server version
detection cached (v0.5.1). Remaining work:

**Implementation Tasks**:
- [ ] Connection keep-alive / pooling optimization (axios agent config)
- [ ] Request/response compression (`Accept-Encoding: gzip`)
- [ ] Metadata cache TTL / refresh strategy (currently invalidated only on
  schema edits — stale on out-of-band schema changes)

---

### 6. Integration Testing with Live Servers

**Status**: 📋 Planned  
**Priority**: High  
**Estimated Effort**: 5-7 days

**Already done**: integration test suites are wired into `npm test` (3 files,
tool-level, mocked transport). Remaining work needs a real server:

**Implementation Tasks**:
- [ ] Live-server test fixture (FM Server for Linux in Docker if license permits,
  or documented setup for a dedicated test server)
- [ ] Integration suite: connect → query → create → update → delete → metadata
- [ ] Schema editing integration tests (destructive tests on throwaway DB)
- [ ] Multi-session integration tests
- [ ] Version-gated feature matrix verification against real FM servers
- [ ] CI pipeline (GitHub Actions) — currently only `docker.yml` exists;
  add a `test` job running `npm run typecheck && npm test`, plus
  `npm audit --audit-level=high`

---

### 7. Documentation & Examples

**Status**: 📋 Planned  
**Priority**: Medium  
**Estimated Effort**: Ongoing

**Implementation Tasks**:
- [ ] Comprehensive `$filter` expression cookbook (common patterns, pitfalls —
  include the `id`-field limitation and `row_id`/`uuid` workarounds)
- [ ] Advanced query patterns (nested `$expand`, `$apply` pipelines)
- [ ] Schema editing cookbook (create-table workflows, field type reference)
- [ ] Troubleshooting guide (401, 404, 500 errors, SSL issues, TLS alert 50)
- [ ] Video tutorials (low priority)

---

## 🎯 Future Considerations (Not Committed)

1. **OAuth 2.0 token refresh (Phase 2/3)** — auto-refresh Bearer tokens via an
   IdP flow. Phase 1 (pre-existing token passthrough) shipped in v0.9.0.
2. **Express 5 migration** — stayed on 4.x for plan 008; E5 has breaking changes
   (query parser defaults, removed methods). Evaluate when 4.x approaches EOL.
3. **`$ref` relationship helpers** — link/unlink related records via
   `/{table}({id})/{nav}/$ref`. Supported by FileMaker; niche use case.
4. **REST API Wrapper** — Simplified REST endpoints for non-OData users.
5. **Real-time updates** — FileMaker OData has no delta/sync token, so this
   would be polling-based change detection at best. Low value; revisit only if
   a concrete use case appears.
6. **Data transformation tools** — Built-in field mapping, computed fields.

### Explicitly unsupported by FileMaker OData (do NOT plan)

- `$search`, `$compute`, lambda operators (`any`/`all`), `id`-field filtering
  (internal `id` is reserved — use `row_id`/`uuid` or `fm_odata_get_record`),
  `Prefer: return=representation` (ignored server-side), delta/sync tokens.

---

## 📅 Release Timeline

| Version | Status | Highlights |
|---------|--------|------------|
| v0.2.6 | Released | 19 tools, HTTP/HTTPS, Docker, NPM |
| v0.3.0 | Released | Stability, security, Dify support |
| v0.4.0 | Released | `aggregate`, `cast`, `build_filter` |
| v0.5.0 | Released | Multi-session, `connect_multi` |
| v0.5.1 | Released | Server version detection, feature matrix |
| v0.6.1 | Released | v26 metadata comments |
| v0.7.0 | Released | Schema DDL editing (opt-in) |
| v0.8.0 | Released | Documentation overhaul, project reorganization |
| v0.8.1 | Released | Script execution (`fm_odata_run_script`, call-by-ID on v26+) |
| v0.8.2 | Released | Enhanced v26 metadata (field IDs, options, permissions, FMFID) |
| v0.8.3 | Released | Bug fixes and consistency improvements (13 fixes) |
| v0.9.0 | Released | Batch ops, pagination, Bearer auth, security fixes, Node 24, 39 tools |
| v0.9.1 | Released | Fix CLI binary starting two server instances (#16) |
| v0.9.2 | Released | Lazy saved-connection resolution, cold-start fixes |
| v0.9.3 | Released | TLS handshake decode_error fix on OpenSSL 3.5+ |
| v0.9.4 | Released | Dependency security updates (audit clean), git history scrub |
| v0.9.5 | Planned | Container upload/download, FM Prefer headers, error handling |
| v1.0.0 | Future | MCP protocol surface (resources, annotations, structured output), perf |

---

## 🤝 Contributing

Want to help implement these features? See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Priority Areas for Contributors**:
1. Container field tools (upload + `/$value` download)
2. Integration testing with live FileMaker Server
3. Structured error handling and retry logic
4. MCP protocol surface (tool annotations, `outputSchema`, resources)
5. Documentation and examples

---

## 📞 Feedback

Have suggestions for the roadmap?
- Open a [GitHub Issue](https://github.com/fsans/fms-odata-mcp/issues)
- Start a [Discussion](https://github.com/fsans/fms-odata-mcp/discussions)
- Submit a Pull Request

---

**Last Updated**: November 2026 (v0.9.4 released; v0.9.5+ planned)
