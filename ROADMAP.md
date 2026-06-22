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

---

## ✅ Completed

### v0.2.x — Foundation

- **HTTP/HTTPS Transport** — Standalone server mode (`MCP_TRANSPORT=http|https`)
- **Docker Deployment** — Full Docker and Docker Compose support with health checks
- **CLI Binary** — `filemaker-odata-mcp` command, installable via `npm install -g` or `npx`
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

> **Note (v26 metadata gap):** The v0.6.x implementation only parses `comment` and
> `aiAnnotation`. FileMaker Server 26 exposes significantly richer field metadata
> as child `<Annotation>` elements inside `<Property>` tags. See "Enhanced v26
> Metadata Parsing" in the Planned section below for the full list of annotations
> to be added.

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

---

## 🔧 In Progress / Planned

### 1. Upload Container Data (v0.8.4)

**Status**: 📋 Planned  
**Priority**: Medium  
**Estimated Effort**: 2-3 days  
**FileMaker Support**: Yes — confirmed via Claris docs. Two methods available:
- **Base64 inline** — include base64 string + `@com.filemaker.odata.Filename` /
  `@com.filemaker.odata.ContentType` annotation properties in POST (create) or PATCH
  (update record) JSON body
- **Binary upload** — `PATCH /{table}({id})/{containerField}` with raw binary body,
  `Content-Type` header, and `Content-Disposition: inline; filename=...` header

**Description**: Upload files into FileMaker container fields via OData. Supports both
base64-encoded data (simpler, works with MCP text-only protocol) and direct binary upload
(for larger files when using HTTP transport).

**Implementation Tasks**:
- [ ] Add `uploadContainerBase64(table, recordId, field, base64Data, filename, contentType)`
  to `ODataClient` — PATCH JSON body with base64 value + annotation properties
- [ ] Add `uploadContainerBinary(table, recordId, field, binaryData, filename, contentType)`
  to `ODataClient` — PATCH binary body to `/{table}({id})/{field}` with proper headers
- [ ] New tool: `fm_odata_upload_container` — accepts `table`, `recordId`, `field`,
  `base64Data` (string), `filename`, `contentType`. Uses base64 path by default.
- [ ] New tool: `fm_odata_create_record_with_container` — extends `create_record` to accept
  container fields as base64 + metadata
- [ ] Validate base64 input; reject if not valid base64 string
- [ ] Handle media type inference failures (FileMaker infers from first bytes;
  misidentification can occur with base64)
- [ ] Unit tests for base64 construction, binary path (mocked), error handling

---

### 2. Enhanced Error Handling (v0.8.5)

**Status**: 📋 Planned  
**Priority**: High  
**Estimated Effort**: 2-3 days

**Implementation Tasks**:
- [ ] Structured error codes (e.g., `FM_AUTH_ERROR`, `FM_NOT_FOUND`, `FM_SCHEMA_ERROR`)
- [ ] Error recovery strategies (retry with backoff on transient failures)
- [ ] Connection retry logic for network timeouts
- [ ] Better timeout handling (distinguish connect vs read timeouts)
- [ ] User-friendly error formatting for MCP tool responses

---

### 3. OData Batch Requests (v0.8.6)

**Status**: 📋 Planned  
**Priority**: High  
**Estimated Effort**: 3-4 days  
**FileMaker Support**: Yes — FileMaker Server supports OData `$batch` via `multipart/mixed`
(see [Claris docs](https://help.claris.com/en/odata-guide/content/batch-requests.html))

**Current State**: A stub `batch()` method exists in `ODataClient` but executes requests
sequentially instead of using true OData batch format.

**Implementation Tasks**:
- [ ] Build proper `multipart/mixed` batch request body per OData 4.01 spec
- [ ] Add `Content-ID` correlation for change sets (atomic operations)
- [ ] Parse `multipart/mixed` response boundaries
- [ ] New tool: `fm_odata_batch` — accept array of operations, return correlated results
- [ ] Handle batch-level vs operation-level errors
- [ ] Unit tests for request construction and response parsing

---

### 4. Performance Optimization (v0.9.0)

**Status**: 📋 Planned  
**Priority**: Medium  
**Estimated Effort**: 3-4 days

**Implementation Tasks**:
- [ ] Metadata caching (cache `$metadata` XML per session with TTL)
- [ ] Connection keep-alive / pooling optimization
- [ ] Request/response compression (`Accept-Encoding: gzip`)
- [ ] Cache server version detection result (already done in v0.5.1)
- [ ] Batch operation optimization (depends on Batch Requests feature above)

---

### 5. Integration Testing with Live Servers

**Status**: � Planned  
**Priority**: High  
**Estimated Effort**: 5-7 days

**Implementation Tasks**:
- [ ] Docker-based FileMaker Server test fixture (if available / license permitting)
- [ ] Integration test suite: connect → query → create → update → delete → metadata
- [ ] Schema editing integration tests (destructive tests isolated to throwaway DB)
- [ ] Multi-session integration tests
- [ ] Version-gated feature matrix verification against real FM servers
- [ ] CI pipeline integration (GitHub Actions) for integration tests

---

### 6. Documentation & Examples

**Status**: 📋 Planned  
**Priority**: Medium  
**Estimated Effort**: Ongoing

**Implementation Tasks**:
- [ ] Comprehensive `$filter` expression cookbook (common patterns, pitfalls)
- [ ] Advanced query patterns (nested `$expand`, `$apply` pipelines)
- [ ] Schema editing cookbook (create-table workflows, field type reference)
- [ ] Troubleshooting guide (401, 404, 500 errors, SSL issues)
- [ ] Video tutorials (low priority)

---

## 🎯 Future Considerations (Not Committed)

1. **REST API Wrapper** — Simplified REST endpoints for non-OData users
2. **Real-time Updates** — WebSocket support for live data / change notifications
3. **Advanced Security** — OAuth 2.0 / token-based authentication
4. **Data Transformation Tools** — Built-in field mapping, computed fields

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
| v0.8.4 | Planned | Container upload (`fm_odata_upload_container`) |
| v0.8.5 | Planned | Enhanced error handling (structured codes, retry, timeouts) |
| v0.8.6 | Planned | OData batch requests (`multipart/mixed`) |
| v0.9.0 | Planned | Performance optimization (metadata caching, keep-alive) |
| v1.0.0 | Future | To be disclosed |

---

## 🤝 Contributing

Want to help implement these features? See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

**Priority Areas for Contributors**:
1. Integration testing with live FileMaker Server
2. Documentation and examples
3. Performance optimization
4. OData batch request implementation (`multipart/mixed`)
5. Container upload tool (`fm_odata_upload_container`)

---

## 📞 Feedback

Have suggestions for the roadmap?
- Open a [GitHub Issue](https://github.com/fsans/FMS-ODATA-MCP/issues)
- Start a [Discussion](https://github.com/fsans/FMS-ODATA-MCP/discussions)
- Submit a Pull Request

---

**Last Updated**: June 2026 (v0.8.3 released, v0.8.4+ planned)
