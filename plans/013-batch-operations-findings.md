# Plan 013 Findings: Batch/Bulk OData Operations

> **Spike output** — investigation, proposed API, and open questions.
> Not a production implementation. The maintainer should review this before
> a build plan is written.

## FileMaker $batch Support

**Verdict: Yes — FileMaker Server supports `$batch`.**

Confirmed via official Claris documentation
(https://help.claris.com/en/odata-guide/content/batch-requests.html) and the
project's own OData spec (`docs/08-batch.md`):

- **Endpoint**: `POST /fmi/odata/v4/<database>/$batch`
- **Content-Type**: `multipart/mixed; boundary=<boundary>`
- **OData-Version**: `4.0` (FileMaker supports OData 4.0, not 4.01)
- **Supported operations**: GET (retrieve), POST (create), PATCH/PUT (update),
  DELETE (delete)
- **Change sets**: Operations grouped in a `multipart/mixed` changeset are
  **atomic** — either all succeed or all fail (rollback).
- **Content-ID referencing**: Operations within a changeset can reference
  entities created by prior operations using `$<Content-ID>` as the entity
  reference. However, FileMaker has a quirk: **batch requests do not support
  referencing newly created records using `$` in a change set** (per Claris
  docs).
- **GET placement quirk**: On some FileMaker Server versions, GET operations
  placed before changesets cause parsing issues. Workaround: place all
  changesets first, then GET operations at the end. Limit to one GET at the
  end, or accept potential loss of results.

### Limitations

| Limitation | Detail |
|-----------|--------|
| No `$` referencing in changesets | Can't reference a just-created record in a subsequent operation within the same changeset |
| GET ordering bug | GETs before changesets may be silently dropped on some versions |
| Boundary uniqueness | Must be unique per request; use UUIDs |
| No nested batches | Standard OData restriction |
| Max operations per batch | Not documented — needs testing on target server |

## Implementation Approaches

### Approach A: Real OData $batch (multipart/mixed)

**Recommended** — FileMaker supports it natively.

- **Pros**: Atomic change sets (all-or-nothing), single HTTP round-trip,
  server-side transactional, bandwidth-efficient
- **Cons**: Complex MIME boundary handling, harder to debug, FileMaker GET
  ordering quirk, no `$` referencing in changesets
- **Implementation**: `ODataClient.batchRequest(operations)` builds a
  multipart/mixed body, sends to `/$batch`, parses the multipart response
- **Best for**: Bulk creates/updates/deletes where atomicity matters

### Approach B: Parallel Promise.all (client-side batching)

**Fallback** — use if `$batch` proves unreliable on a specific server version.

- **Pros**: Simple, works with any OData server, easy to debug, per-operation
  error isolation, no MIME parsing
- **Cons**: N HTTP round-trips (though parallel), no atomicity, server
  connection limit may throttle, higher bandwidth overhead
- **Implementation**: `ODataClient.batchCreate(table, records[])` →
  `Promise.allSettled(records.map(r => this.createRecord(table, r)))`
- **Best for**: Non-atomic bulk operations, servers with unreliable `$batch`

### Recommendation

**Approach A (real `$batch`) as primary, Approach B as fallback.**

The build plan should:
1. Implement Approach A with proper multipart/mixed construction
2. Add a fallback to Approach B if the `$batch` endpoint returns an error
3. Expose a `strategy` parameter on the MCP tool: `"batch"` (default) or
   `"parallel"`

## Proposed Tool API

### `fm_odata_create_records` (bulk create)

```ts
{
  name: "fm_odata_create_records",
  description: "Create multiple records in a single call. " +
    "Uses OData $batch (multipart/mixed) for atomic, single-round-trip creation. " +
    "Falls back to parallel HTTP requests if $batch is unavailable.",
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string", description: "Table/entity set name" },
      records: {
        type: "array",
        items: { type: "object", description: "Field values for each record" },
        minItems: 1,
        maxItems: 100,  // safety cap
      },
      strategy: {
        type: "string",
        enum: ["batch", "parallel"],
        description: "batch = OData $batch (atomic, default). parallel = Promise.all (non-atomic)",
      },
      ...connectionParam,
    },
    required: ["table", "records"],
  },
}
```

### `fm_odata_update_records` (bulk update)

```ts
{
  name: "fm_odata_update_records",
  description: "Update multiple records in a single call via OData $batch.",
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string" },
      updates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            recordId: { type: "string" },
            data: { type: "object" },
          },
          required: ["recordId", "data"],
        },
        minItems: 1,
        maxItems: 100,
      },
      strategy: { type: "string", enum: ["batch", "parallel"] },
      ...connectionParam,
    },
    required: ["table", "updates"],
  },
}
```

### `fm_odata_delete_records` (bulk delete)

```ts
{
  name: "fm_odata_delete_records",
  description: "Delete multiple records in a single call via OData $batch.",
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string" },
      recordIds: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 100,
      },
      strategy: { type: "string", enum: ["batch", "parallel"] },
      ...connectionParam,
    },
    required: ["table", "recordIds"],
  },
}
```

### Response shape

```json
{
  "summary": {
    "total": 50,
    "succeeded": 48,
    "failed": 2,
    "strategy": "batch",
    "atomic": true
  },
  "results": [
    { "index": 0, "ok": true, "recordId": "1" },
    { "index": 1, "ok": false, "error": "Validation failed: Field 'Name' is required" }
  ]
}
```

### `maxItems` safety cap rationale

The default cap of **100** balances:
- AI agent context window limits (large responses consume tokens)
- Server-side batch size limits (undocumented for FileMaker)
- Timeout risk (very large batches may exceed HTTP timeout)
- Error granularity (with 100 records, per-record errors are manageable)

The maintainer may raise this to 500 or 1000 after testing server capacity.

## Open Questions

1. **Test server access**: Does the maintainer have access to a FileMaker
   Server to test `$batch` with real data? The GET ordering quirk needs
   version-specific validation.
2. **Atomicity requirement**: Is all-or-nothing (changeset rollback) required,
   or is per-record success/failure acceptable? This determines whether to
   use changesets or individual operations in the batch body.
3. **`maxItems` cap**: What is the appropriate cap? (100? 500? 1000?) Should
   it be configurable via env var `FM_BATCH_MAX_ITEMS`?
4. **Response detail**: Should the tools return the full created/updated
   records, or just IDs and status? Full records are useful but consume
   context window.
5. **Mixed operations**: Should there be a `fm_odata_batch_mixed` tool for
   mixed operations (create + update + delete in one call)? This maps to
   a single `$batch` with multiple changesets.
6. **Partial failure reporting**: How should partial failures be reported?
   Per-record error array? Summary with error count? Both?
7. **Criteria-based bulk update/delete**: Should the tools respect `$filter`
   for bulk update/delete by criteria (e.g., "delete all records where
   Status = 'inactive'")? This would use `$batch` with a GET + DELETE pattern
   or a custom OData operation.
8. **FileMaker GET ordering bug**: Which FileMaker Server versions exhibit
   the GET-before-changeset bug? Should the implementation always place
   changesets first as a defensive measure?
9. **Timeout handling**: What is the HTTP timeout for `$batch` requests?
   Should the MCP server set a longer timeout for batch operations?

## Prototype status

**Implemented and tested against a live FileMaker Server.**

### Live test results (2026-09-14)

Tested against FileMaker Server at `nbcn.ddns.net` with the `Contacts` database:

| Strategy | Create | Update | Delete | Notes |
|----------|--------|--------|--------|-------|
| **parallel** | 3/3 OK, IDs returned | 3/3 OK | 3/3 OK | Full record data returned for creates |
| **batch** ($batch) | 2/2 OK, no IDs | 2/2 OK | 2/2 OK | Single HTTP round-trip; 204 No Content for POST |

### Key findings from live testing

1. **FileMaker `$batch` works** — the multipart/mixed format is accepted when:
   - Using **relative URLs** in sub-requests (not absolute URLs)
   - No blank line between changeset close (`--changeset_...--`) and batch close (`--batch_...--`)
   - MIME boundaries use CRLF line endings with blank lines between headers and content

2. **FileMaker returns `204 No Content` for POST in `$batch`** — even with
   `Prefer: return=representation` at both sub-request and batch level. Created
   record IDs are NOT available in the `$batch` response. Use `strategy: "parallel"`
   when you need the created record IDs back.

3. **The implementation falls back to parallel** when `$batch` fails — this
   happens transparently. The response's `strategy` field indicates which
   strategy was actually used.

4. **Error code -1033** ("Unexpected batch boundary") was caused by missing
   blank lines in the MIME structure. Fixed by adding proper CRLF + blank line
   separators.

5. **Error code -1015** ("Expected batch boundary") was caused by absolute URLs
   in sub-requests. Fixed by converting to relative URLs.
