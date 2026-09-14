# fms-odata-mcp v0.9.0 — Release Notes

**Release date**: September 14, 2026
**Previous version**: v0.8.3-beta.0
**npm package**: [fms-odata-mcp@0.9.0](https://www.npmjs.com/package/fms-odata-mcp)
**GitHub release**: [v0.9.0](https://github.com/fsans/fms-odata-mcp/releases/tag/v0.9.0)

---

## Overview

v0.9.0 is a major improvement release that executes 13 vetted plans (004-016) covering new features, security hardening, dead code removal, dependency upgrades, and significantly expanded test coverage. All changes were live-tested against a FileMaker Server 2026 (v26) using the `Contacts` database.

**Tool count**: 35 → **39** (33 standard + 6 optional schema editing)
**Test count**: 251 → **378** across 18 suites
**Node.js requirement**: 18+ → **24+** (LTS)

---

## New tools (4)

### Bulk CRUD operations (3 tools)

Three new tools for performing bulk create, update, and delete operations in a single tool call, reducing HTTP round-trips from N to 1 when working with multiple records.

| Tool | Description |
|------|-------------|
| `fm_odata_create_records` | Create N records in one call |
| `fm_odata_update_records` | Update N records by ID in one call |
| `fm_odata_delete_records` | Delete N records by ID in one call |

Each tool supports a `strategy` parameter:

- **`"batch"` (default)** — Uses OData `$batch` (multipart/mixed) for a single HTTP round-trip. Operations within a changeset are atomic on the FileMaker side. If `$batch` fails, the implementation transparently falls back to parallel requests.
- **`"parallel"`** — Sends N individual requests via `Promise.allSettled`. Provides per-record error isolation and returns full created record data (including assigned IDs).

**Example — bulk create with parallel strategy** (returns created records with IDs):

```json
{
  "table": "contact",
  "records": [
    { "first_name": "Alice", "last_name": "Wonder", "company": "Digital Dreams" },
    { "first_name": "Bob", "last_name": "Builder", "company": "Build Co" }
  ],
  "strategy": "parallel"
}
```

**Example — bulk delete with batch strategy** (single HTTP round-trip):

```json
{
  "table": "contact",
  "ids": ["3275,...", "3276,..."],
  "strategy": "batch"
}
```

**Configuration**: `FM_BATCH_MAX_ITEMS` env var controls the maximum records per batch operation (default: 100).

### Pagination helper (1 tool)

| Tool | Description |
|------|-------------|
| `fm_odata_query_all_records` | Auto-paginate through all matching records |

Automatically follows `@odata.nextLink` to fetch all matching records across multiple pages. Falls back to `$skip`-based pagination when the server doesn't emit next links. The response includes a summary with page count, total records, and truncation state.

**Example**:

```json
{
  "table": "contact",
  "filter": "company eq 'Digital Dreams'",
  "select": "id,first_name,last_name,company",
  "pageSize": 100,
  "maxRecords": 5000
}
```

**Response shape**:

```json
{
  "summary": {
    "pagesFetched": 3,
    "totalRecords": 250,
    "truncated": false,
    "maxRecords": 5000
  },
  "records": [ ... ]
}
```

**Configuration**: `FM_MAX_RECORDS` env var sets a server-wide cap (default: 10,000). A hard maximum of 50,000 records is enforced regardless of the `maxRecords` parameter.

---

## New features

### Bearer token authentication (Phase 1)

Added support for Bearer token authentication, enabling connections to FileMaker Cloud and OAuth/identity provider setups without storing passwords.

- New `authType` parameter on `fm_odata_connect` and `fm_odata_connect_multi` (`"basic"` | `"bearer"`)
- New `bearerToken` parameter for the token string
- Environment variables: `FM_AUTH_TYPE` (default: `basic`) and `FM_BEARER_TOKEN`
- **Backward compatible**: omitting `authType` defaults to Basic Auth (unchanged behavior)
- **Mixed auth per session**: each connection can use a different auth type
- Tokens are NOT persisted in the config file (security + 1-hour expiry)
- Tokens are redacted in debug logs
- Expired/invalid tokens surface the FileMaker error to the caller (no auto-refresh in Phase 1)

**Example — Bearer auth connect**:

```json
{
  "server": "https://fms.cloud.example.com",
  "database": "Contacts",
  "authType": "bearer",
  "bearerToken": "eyJhbGciOi..."
}
```

### MCP transport security

Optional Bearer token authentication for the MCP HTTP/HTTPS transport layer, securing the MCP server itself (not the FileMaker connection).

- New `MCP_AUTH_TOKEN` env var
- When set, all incoming MCP requests must include `Authorization: Bearer <token>`
- Works with both `http` and `https` transport modes

---

## Bug fixes

| Fix | Plan | Description |
|-----|------|-------------|
| HTTP graceful shutdown | 005 | HTTP server listener is now properly closed on SIGTERM/SIGINT, preventing hanging processes in Docker |
| Metadata cache invalidation | 016 | Cached `$metadata` XML is now invalidated after schema mutations (create/delete table, add/delete fields, create/delete index) |
| parseInt NaN guard | 012 | Config loading no longer crashes when env vars contain non-numeric values (e.g. `FM_TIMEOUT=abc`) |
| Dependency vulnerabilities | 008 | Updated express, axios, and MCP SDK to versions patching known CVEs |

---

## Maintenance and infrastructure

| Change | Plan | Details |
|--------|------|---------|
| Node.js 24 LTS upgrade | 007 | Upgraded from Node.js 18 (EOL December 2025) to Node.js 24 LTS |
| Dead code removal | 009 | Removed `http-server.ts` (broken standalone entry point), batch stub method, and `formatBatchResults` unused formatter |
| `dev_stuf/` cleanup | 010 | Removed 1,900+ lines of cruft from `dev_stuf/` directory, fixed broken documentation links |
| Integration tests wired | 004 | Previously stale integration tests fixed and included in the default `npm test` run |
| Test coverage expansion | 011 | Added 32 unit tests for URL building, HTTP transport, and multi-session handlers |

---

## New environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FM_AUTH_TYPE` | `basic` | FileMaker auth method: `basic` or `bearer` |
| `FM_BEARER_TOKEN` | — | Bearer token (required when `FM_AUTH_TYPE=bearer`) |
| `FM_BATCH_MAX_ITEMS` | `100` | Maximum records per bulk operation |
| `FM_MAX_RECORDS` | `10000` | Maximum records returned by `query_all_records` (hard cap: 50000) |
| `MCP_AUTH_TOKEN` | — | Bearer token for MCP transport authentication |

---

## Migration notes

### Node.js 24 required

The minimum Node.js version is now 24 (LTS). Node.js 18 reached end-of-life in December 2025. If you're running in Docker, update your base image:

```dockerfile
FROM node:24-slim
```

### `fm_odata_connect` schema change

The `user` and `password` fields are no longer in the unconditional `required` list (they are conditionally required based on `authType`). The runtime handler validates:
- `bearerToken` is required when `authType=bearer`
- `user` and `password` are required when `authType=basic` (or when `authType` is omitted)

If you have existing code that checks the JSON schema `required` array, update it to handle the conditional validation.

### No breaking changes for existing Basic Auth users

If you're using Basic Auth with environment variables (`FM_USER` + `FM_PASSWORD`), nothing changes. The new `FM_AUTH_TYPE` defaults to `basic` and the existing flow is unchanged.

---

## Known FileMaker OData limitations

These are server-side limitations documented during live testing, not bugs in this package:

1. **The internal `id` field cannot be used in `$filter` comparison operators** (`eq`, `gt`, `lt`, `ge`, `le`, `ne`). FileMaker returns error -1002. Use `row_id`, `uuid`, or other business fields for filtering. To retrieve a record by its internal ID, use `fm_odata_get_record` (which takes the record ID directly, not via `$filter`).

2. **`$batch` POST operations return 204 No Content** — created record IDs are not returned in the batch response, even with `Prefer: return=representation`. Use `strategy: "parallel"` when you need the created records back with their assigned IDs.

3. **FileMaker Data API tokens are not compatible with OData** — tokens from the Data API (`/fmi/data/v1/`) cannot be used as Bearer tokens for OData. OData requires Basic Auth (Server) or OAuth Bearer tokens (Cloud).

These findings have been contributed to the [fms-odata-spec](https://github.com/fsans/fms-odata-spec) repository's [quirks documentation](https://github.com/fsans/fms-odata-spec/blob/develop/docs/13-quirks.md).

---

## Stats

| Metric | v0.8.3-beta.0 | v0.9.0 |
|--------|---------------|--------|
| MCP tools | 35 | 39 |
| Standard tools | 29 | 33 |
| OData tools | 16 | 20 |
| Test suites | 8 | 18 |
| Tests | 251 | 378 |
| Node.js minimum | 18 | 24 |
| Commits since v0.8.3-beta.0 | — | 28 |

---

## Full changelog

See [CHANGELOG.md](https://github.com/fsans/fms-odata-mcp/blob/develop/CHANGELOG.md) for the complete version history.

## Install

```bash
# Global install (recommended)
npm install -g fms-odata-mcp

# Or via npx (no install needed)
npx fms-odata-mcp
```
