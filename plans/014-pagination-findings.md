# Plan 014 Findings: @odata.nextLink Pagination Helper

> **Spike output** — investigation, proposed API, and open questions.
> Not a production implementation. The maintainer should review this before
> a build plan is written.

## FileMaker @odata.nextLink Behavior

**Verdict: Yes — FileMaker Server emits `@odata.nextLink` for paginated
responses.**

Confirmed via official Claris documentation
(https://help.claris.com/en/odata-guide/content/request-records-from-table.html)
and the project's OData spec (`docs/12-version-deltas.md`):

- **Server-driven paging**: FileMaker uses server-driven paging with a default
  page size of **10,000 records**.
- **`@odata.nextLink`**: When a query returns more records than the page size,
  the response includes an `@odata.nextLink` URL at the bottom of the JSON
  payload for fetching the next batch.
- **Default page size**: 10,000 records (when `$top` is not specified).
- **Custom page size**: Use the `Prefer: odata.maxpagesize=N` header to
  reduce the page size below 10,000.
- **Manual pagination**: `$top` and `$skip` are also supported for
  client-driven pagination.
- **Link format**: The `@odata.nextLink` URL is opaque to the client (per
  OData spec) — it should not be decoded or modified. It typically contains
  a `$skiptoken` parameter.

### Key details

| Property | Value |
|----------|-------|
| Default page size | 10,000 records |
| `@odata.nextLink` emitted? | Yes, when results exceed page size |
| Link format | Opaque URL (typically contains `$skiptoken`) |
| `Prefer: odata.maxpagesize=N` | Supported — reduces page size |
| `$top`/`$skip` | Supported — manual pagination |
| Data API page size | 100 (different — do not confuse with OData) |

### Current `ODataResponse` interface gap

The current `ODataResponse<T>` interface in `src/odata-client.ts` does NOT
include `@odata.nextLink`:

```ts
export interface ODataResponse<T = any> {
  "@odata.context": string;
  "@odata.count"?: number;
  value: T[];
}
```

The build plan should add `"@odata.nextLink"?: string` to this interface.

The `formatQueryResponse` method in `src/odata-parser.ts` also does not
surface `@odata.nextLink` — the build plan should extract and include it in
the formatted output so AI agents know more pages are available.

## Proposed Tool API

### `fm_odata_query_all_records`

```ts
{
  name: "fm_odata_query_all_records",
  description: "Query all matching records from a table, automatically " +
    "following @odata.nextLink pagination until all records are retrieved " +
    "or maxRecords is reached. Use this instead of fm_odata_query_records " +
    "when you need the complete result set and don't want to manually " +
    "paginate with $top/$skip.",
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string", description: "Table/entity set name" },
      filter: { type: "string", description: "OData $filter expression" },
      select: { type: "string", description: "Comma-separated fields to return" },
      orderby: { type: "string", description: "OData $orderby expression" },
      expand: { type: "string", description: "Related records to expand" },
      pageSize: {
        type: "number",
        description: "Records per page (default: 1000). Each page is a " +
          "separate HTTP request. Uses the Prefer: odata.maxpagesize header.",
        default: 1000,
      },
      maxRecords: {
        type: "number",
        description: "Safety cap on total records returned (default: 10000). " +
          "Prevents unbounded fetches on very large tables.",
        default: 10000,
      },
      ...connectionParam,
    },
    required: ["table"],
  },
}
```

### Response shape

```json
{
  "summary": {
    "totalRecords": 5420,
    "pagesFetched": 6,
    "pageSize": 1000,
    "truncated": false,
    "maxRecords": 10000
  },
  "records": [
    { "RecordId": 1, "Name": "..." },
    ...
  ]
}
```

When `truncated` is `true`, the response includes a note:
`"Result truncated at maxRecords (10000). Use fm_odata_query_records with $skip to retrieve remaining records."`

## Implementation Approach

### Approach A: Follow `@odata.nextLink` (recommended)

FileMaker emits `@odata.nextLink`, so this is the natural approach:

```ts
async queryAllRecords(table, options, pageSize, maxRecords) {
  const allRecords = [];
  // First request with Prefer: odata.maxpagesize to control page size
  let url = this.buildUrl(table, { ...options, top: pageSize });
  let pages = 0;

  while (url && allRecords.length < maxRecords) {
    const response = await this.axiosInstance.get(url, {
      headers: { Prefer: `odata.maxpagesize=${pageSize}` },
    });
    allRecords.push(...(response.data.value || []));
    pages++;
    url = response.data["@odata.nextLink"]; // server provides next URL
  }

  const truncated = allRecords.length > maxRecords;
  return {
    value: allRecords.slice(0, maxRecords),
    totalFetched: allRecords.length,
    pagesFetched: pages,
    truncated,
  };
}
```

**Pros**: Simple, respects server-side cursor state, no `$skip` offset
calculation needed, works with FileMaker's opaque `@odata.nextLink` URLs.

### Approach B: `$skip` increment (fallback)

Works universally but may be slower for large offsets:

```ts
async queryAllRecords(table, options, pageSize, maxRecords) {
  const allRecords = [];
  let skip = 0;
  let pages = 0;

  while (allRecords.length < maxRecords) {
    const response = await this.queryRecords(table, {
      ...options, top: pageSize, skip,
    });
    if (response.value.length === 0) break;       // no more records
    allRecords.push(...response.value);
    pages++;
    if (response.value.length < pageSize) break;  // last page
    skip += pageSize;
  }

  const truncated = allRecords.length > maxRecords;
  return {
    value: allRecords.slice(0, maxRecords),
    totalFetched: allRecords.length,
    pagesFetched: pages,
    truncated,
  };
}
```

**Cons**: FileMaker may scan from the beginning for large `$skip` values,
making deep pagination slow. The OData spec does not guarantee `$skip`
performance for large offsets.

### Recommendation

**Approach A (follow `@odata.nextLink`)** as the primary implementation,
since FileMaker confirmed supports it. Approach B as a fallback if
`@odata.nextLink` is not present in the response (e.g., if the result set
fits in one page).

The `pageSize` parameter should use the `Prefer: odata.maxpagesize=N` header
to control the server's page size, rather than relying solely on `$top`.
This is more efficient because the server generates the `@odata.nextLink`
with the correct page size baked in.

## Open Questions

1. **`@odata.nextLink` format**: Does FileMaker's `@odata.nextLink` contain
   an absolute URL or a relative path? The implementation needs to handle
   both (prepend the base URL if relative).
2. **`$skip` maximum**: Is there a maximum `$skip` value that FileMaker
   supports? Some OData servers cap skip at 10,000. If so, Approach B has a
   hard limit.
3. **Default page size**: The default is 10,000 when `$top` is not specified.
   Should the tool's default `pageSize` be 1,000 (more requests but smaller
   responses) or 10,000 (fewer requests but large responses)?
4. **Streaming vs buffering**: MCP tools are synchronous (request-response,
   no streaming). The tool must buffer all records and return them in one
   response. For very large datasets, should the tool warn the AI agent to
   use manual pagination instead?
5. **`maxRecords` configurability**: Should `maxRecords` be configurable
   per-tool-call only, or should there also be a server-wide cap via env var
   `FM_MAX_RECORDS`?
6. **Progress reporting**: MCP tools can't stream progress. Should the tool
   include intermediate page counts in the final response summary? (e.g.,
   `"pagesFetched": 6`)
7. **`@odata.count` pre-check**: Should the tool first issue a
   `$count=true` request to check the total record count before fetching?
   This would let the tool warn: "This query will return 50,000 records,
   exceeding maxRecords. Refine your filter or raise maxRecords."
8. **Memory concerns**: Fetching all records into memory is risky for very
   large tables. Should the tool enforce a hard maximum (e.g., 50,000)
   regardless of the `maxRecords` parameter?
9. **`@odata.nextLink` in `ODataResponse` interface**: The current interface
   lacks this field. Should the build plan add it, or should the pagination
   helper access it via `(response as any)["@odata.nextLink"]`?
