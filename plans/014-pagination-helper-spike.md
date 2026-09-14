# Plan 014: Design spike — @odata.nextLink pagination helper

> **Executor instructions**: This is a **design/spike plan**, not a
> build-everything plan. Your goal is to investigate, prototype, define the
> API, and list open questions — not to ship a production feature. Follow
> this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in the "STOP
> conditions" section occurs, stop and report — do not improvise. When done,
> update the status row for this plan in `plans/README.md` — unless a
> reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2829524..HEAD -- src/odata-client.ts src/odata-parser.ts src/tools/odata.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (spike — no production changes)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `2829524`, 2026-07-16

## Why this matters

The current `fm_odata_query_records` tool exposes `$top` and `$skip` for manual pagination, but AI agents must implement pagination loops themselves — tracking offsets, incrementing `$skip`, and knowing when to stop. OData 4.01 collections include an `@odata.nextLink` property when more pages are available, which contains the URL for the next page. A tool that automatically follows `@odata.nextLink` until all matching records are retrieved (or a safety cap is hit) would simplify large dataset queries for AI agents that can't easily loop.

## Current state

**`src/tools/odata.ts` (lines 54-96, fm_odata_query_records):**
```ts
  {
    name: "fm_odata_query_records",
    description: "Query records from a table with OData filter expressions and query options",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", ... },
        filter: { type: "string", ... },
        select: { type: "string", ... },
        orderby: { type: "string", ... },
        top: { type: "number", description: "Maximum number of records to return (pagination)" },
        skip: { type: "number", description: "Number of records to skip (pagination)" },
        expand: { type: "string", ... },
        count: { type: "boolean", ... },
        ...connectionParam,
      },
      required: ["table"],
    },
  },
```

**`src/odata-client.ts` (lines 236-244, queryRecords):**
```ts
  async queryRecords<T = any>(table: string, options?: ODataQueryOptions): Promise<ODataResponse<T>> {
    const url = this.buildUrl(table, options);
    const response = await this.axiosInstance.get<ODataResponse<T>>(url);
    return response.data;
  }
```

Returns `ODataResponse<T>` which is:
```ts
export interface ODataResponse<T = any> {
  "@odata.context": string;
  "@odata.count"?: number;
  value: T[];
}
```

Note: `@odata.nextLink` is NOT in the interface. The OData 4.01 spec says collections may include `@odata.nextLink` when server-driven pagination is active. FileMaker Server may or may not emit this property.

**`src/odata-parser.ts` (lines 28-49, formatQueryResponse):**
```ts
  static formatQueryResponse<T>(response: ODataResponse<T>, includeContext: boolean = false): string {
    const r = response as any;
    const records: any[] = Array.isArray(r?.value) ? r.value : ...;
    const result: any = {
      count: r?.["@odata.count"],
      records,
    };
    if (includeContext) {
      result.context = r?.["@odata.context"];
    }
    return this.formatResponse(result);
  }
```

`@odata.nextLink` is not extracted or surfaced by the parser.

**`src/tools/odata.ts` (lines 521-538, handleQueryRecords):**
```ts
async function handleQueryRecords(client: any, args: any) {
  const response = await client.queryRecords(args.table, {
    filter: args.filter, select: args.select, orderby: args.orderby,
    top: args.top, skip: args.skip, expand: args.expand, count: args.count,
  });
  const summary = ODataParser.createQuerySummary(response);
  const formatted = ODataParser.formatQueryResponse(response);
  return { content: [{ type: "text", text: `${summary}\n\n${formatted}` }] };
}
```

No pagination loop, no `@odata.nextLink` handling.

**Repo conventions:**
- Tools defined in `src/tools/odata.ts`
- `ODataResponse` interface in `src/odata-client.ts`
- Parser methods in `src/odata-parser.ts`
- Commit style: conventional commits

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Build     | `npm run build`          | exit 0              |
| Tests     | `npm test`               | all pass            |

## Scope

**In scope** (files you should create or modify):
- `plans/014-pagination-findings.md` — create this file with investigation findings, proposed API, and open questions
- `src/odata-client.ts` — you MAY add `@odata.nextLink` to the `ODataResponse` interface for investigation
- `src/odata-parser.ts` — you MAY prototype a pagination helper method

**Out of scope** (do NOT touch):
- `src/tools/odata.ts` — do NOT add a pagination MCP tool in this spike
- `src/tools/connection.ts`, `src/tools/configuration.ts` — no changes

## Git workflow

- Branch: `advisor/014-pagination-spike`
- Commit per logical unit; message style: conventional commits
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Investigate FileMaker OData @odata.nextLink behavior

Research whether FileMaker Server's OData 4.01 implementation emits `@odata.nextLink`:

1. Check Claris/FileMaker OData documentation for server-driven pagination
2. Check if FileMaker uses `$top`/`$skip` pagination only (client-driven) or also `@odata.nextLink` (server-driven)
3. If you have access to a FileMaker Server, query a large table with `$top=10` and check if the response includes `@odata.nextLink`

Document findings in `plans/014-pagination-findings.md`:
- Does FileMaker OData emit `@odata.nextLink`? (Yes/No/Unknown)
- If yes, what does the link look like? (relative URL? absolute? contains `$skip` token?)
- If no, can pagination be done purely with `$top`/`$skip` increments?
- What is the default page size if `$top` is not specified?

**Verify**: `plans/014-pagination-findings.md` exists with a "FileMaker @odata.nextLink Behavior" section.

### Step 2: Define the proposed MCP tool API

In `plans/014-pagination-findings.md`, define the tool schema:

```ts
// Proposed: fm_odata_query_all_records
{
  name: "fm_odata_query_all_records",
  description: "Query all matching records from a table, automatically following " +
    "pagination links until all records are retrieved or maxRecords is reached. " +
    "Use this instead of fm_odata_query_records when you need the complete result set " +
    "and don't want to manually paginate with $top/$skip.",
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
        description: "Records per page (default: 100). Each page is a separate HTTP request.",
        default: 100,
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

Document the response shape (combined `value` array from all pages, total count, pages fetched, whether maxRecords was hit).

**Verify**: `plans/014-pagination-findings.md` has a "Proposed Tool API" section.

### Step 3: Evaluate implementation approaches

In `plans/014-pagination-findings.md`, document the implementation approach:

**If FileMaker emits @odata.nextLink:**
```ts
async queryAllRecords(table, options, pageSize, maxRecords) {
  let allRecords = [];
  let url = this.buildUrl(table, { ...options, top: pageSize });
  while (url && allRecords.length < maxRecords) {
    const response = await this.axiosInstance.get(url);
    allRecords.push(...response.data.value);
    url = response.data["@odata.nextLink"]; // server provides next URL
  }
  return { value: allRecords.slice(0, maxRecords), totalFetched: allRecords.length, truncated: allRecords.length > maxRecords };
}
```

**If FileMaker does NOT emit @odata.nextLink (use $skip increment):**
```ts
async queryAllRecords(table, options, pageSize, maxRecords) {
  let allRecords = [];
  let skip = 0;
  while (allRecords.length < maxRecords) {
    const response = await this.queryRecords(table, { ...options, top: pageSize, skip });
    if (response.value.length === 0) break; // no more records
    allRecords.push(...response.value);
    if (response.value.length < pageSize) break; // last page
    skip += pageSize;
  }
  return { value: allRecords.slice(0, maxRecords), totalFetched: allRecords.length, truncated: allRecords.length > maxRecords };
}
```

Document the trade-offs:
- `@odata.nextLink` approach is simpler and respects server-side cursor state
- `$skip` increment approach works universally but may be slower for large offsets (FileMaker may scan from the beginning)
- Safety cap (`maxRecords`) prevents memory exhaustion on very large tables

**Verify**: `plans/014-pagination-findings.md` has an "Implementation Approach" section with both approaches.

### Step 4: List open questions

In `plans/014-pagination-findings.md`, list open questions:

1. Does FileMaker OData emit `@odata.nextLink` for paginated responses?
2. Is there a maximum `$skip` value that FileMaker supports? (Some OData servers cap skip at 10000)
3. What is the default page size when `$top` is not specified?
4. Should the tool stream results (return pages as they arrive) or buffer all records and return at once?
5. Should `maxRecords` be configurable per-tool-call, or should there be a server-wide cap?
6. How should the tool report progress for long-running fetches? (MCP tools are synchronous — no streaming)
7. Should the tool respect `@odata.count` to pre-allocate or warn about large result sets?

**Verify**: `plans/014-pagination-findings.md` has an "Open Questions" section with ≥5 questions.

### Step 5: Commit the findings

```bash
git add plans/014-pagination-findings.md
git commit -m "docs: pagination helper design spike — findings and proposed API

Investigate FileMaker OData @odata.nextLink behavior, define
proposed fm_odata_query_all_records tool schema, evaluate
implementation approaches (nextLink following vs $skip increment),
and list open questions for the maintainer."
```

**Verify**: `git log --oneline -1` → shows the commit

## Test plan

- No production tests required for a spike.
- Verification: `npm run build && npm test` → all pass (no production code changed)

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `plans/014-pagination-findings.md` exists with sections: "FileMaker @odata.nextLink Behavior", "Proposed Tool API", "Implementation Approach", "Open Questions"
- [ ] The findings document answers whether FileMaker emits `@odata.nextLink` (or documents that it could not be determined)
- [ ] The proposed tool API defines a schema for `fm_odata_query_all_records` with `pageSize` and `maxRecords` safety caps
- [ ] At least 5 open questions are listed
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] No production MCP tools were added (this is a spike)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- You cannot determine FileMaker's `@odata.nextLink` behavior from documentation and don't have test server access — document this as an open question and proceed with the `$skip` increment approach as the recommended path (it works universally).
- The proposed tool API conflicts with existing tool naming conventions — report the conflict.

## Maintenance notes

- **This is a spike.** The output is a findings document for the maintainer. After the open questions are answered, a build plan should implement the chosen approach.
- **Memory concerns**: Fetching all records into memory is risky for very large tables. The `maxRecords` cap (default 10000) is the safety valve. A future enhancement could add a streaming mode or a "count first, then ask" pattern.
- **MCP protocol limitation**: MCP tools are request-response — there's no streaming. The tool must buffer all records and return them in one response. For very large datasets, the AI agent should use `fm_odata_query_records` with `$top`/`$skip` manually.
- A reviewer should check that the findings document is specific enough for a build plan to be written from it.
