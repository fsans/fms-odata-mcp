# Plan 013: Design spike — batch/bulk OData operations

> **Executor instructions**: This is a **design/spike plan**, not a
> build-everything plan. Your goal is to investigate, prototype, define the
> API, and list open questions — not to ship a production feature. Follow
> this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in the "STOP
> conditions" section occurs, stop and report — do not improvise. When done,
> update the status row for this plan in `plans/README.md` — unless a
> reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2829524..HEAD -- src/odata-client.ts src/tools/odata.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW (spike — no production changes)
- **Depends on**: plans/009-remove-dead-code.md (the old batch stub should be removed before designing the real thing)
- **Category**: direction
- **Planned at**: commit `2829524`, 2026-07-16

## Why this matters

The codebase has clear evidence of unfinished intent around batch operations: `ODataClient.batch()` existed as a stub (removed by Plan 009), `ODataParser.formatBatchResults()` may exist, and `dev_stuf/ROADMAP.md` (if not yet deleted by Plan 010) listed bulk operations as a planned feature. AI agents using this MCP server currently must issue N separate `fm_odata_create_record` calls to import N records — one HTTP round-trip per record. Bulk operations would reduce this to a single tool call, dramatically improving data migration and bulk update workflows.

This spike investigates two implementation approaches, defines the MCP tool API, identifies FileMaker OData batch capabilities and limitations, and lists open questions for the maintainer to resolve before a build plan is written.

## Current state

**After Plan 009 lands**, the dead `batch()` stub will be removed. The spike investigates what a real implementation should look like.

**Existing single-record tools in `src/tools/odata.ts` (lines 325-386):**
```ts
  // CRUD Tools
  { name: "fm_odata_create_record", ... required: ["table", "data"] },
  { name: "fm_odata_update_record", ... required: ["table", "recordId", "data"] },
  { name: "fm_odata_delete_record", ... required: ["table", "recordId"] },
```

Each accepts a single record. No bulk variants exist.

**OData 4.01 batch specification**: OData defines batch requests using `multipart/mixed` content type with change sets for grouping atomic operations. The request body contains multiple individual requests separated by MIME boundaries.

**FileMaker OData batch support**: FileMaker Server's OData 4.01 implementation may or may not support `$batch`. The Claris documentation lists some unsupported OData features (lambda operators, $search) but does not explicitly mention $batch. This is a key open question.

**`src/odata-client.ts` (lines 263-293, existing single-record methods):**
```ts
  async createRecord<T = any>(table: string, data: Partial<T>): Promise<T> {
    const url = `${this.baseUrl}/${table}`;
    const response = await this.axiosInstance.post<T>(url, data);
    return response.data;
  }

  async updateRecord<T = any>(table: string, recordId: string, data: Partial<T>): Promise<void> {
    const url = `${this.baseUrl}/${table}${this.entityKey(recordId)}`;
    await this.axiosInstance.patch(url, data);
  }

  async deleteRecord(table: string, recordId: string): Promise<void> {
    const url = `${this.baseUrl}/${table}${this.entityKey(recordId)}`;
    await this.axiosInstance.delete(url);
  }
```

**Repo conventions:**
- Tools defined in `src/tools/odata.ts` as objects with `name`, `description`, `inputSchema`
- Tool handlers are async functions returning `{ content: [{ type: "text", text: ... }], isError?: boolean }`
- The `connectionParam` spread adds the optional `connection` parameter to session-dependent tools
- Commit style: conventional commits (`feat:`, `docs:` — see `git log --oneline -20`)

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Build     | `npm run build`          | exit 0              |
| Tests     | `npm test`               | all pass            |

## Scope

**In scope** (files you should create or modify):
- `plans/013-batch-operations-findings.md` — create this file with your investigation findings, proposed API, and open questions
- `src/odata-client.ts` — you MAY add a prototype `batchCreateRecords` method for investigation, but mark it clearly as experimental and do NOT expose it as an MCP tool
- `tests/unit/odata-client.test.ts` — you MAY add a prototype test for the batch method

**Out of scope** (do NOT touch):
- `src/tools/odata.ts` — do NOT add a batch MCP tool in this spike. That's the build plan's job, after the maintainer approves the design.
- `src/tools/connection.ts`, `src/tools/configuration.ts` — no changes
- `src/odata-parser.ts` — no changes (unless prototyping a batch response parser)

## Git workflow

- Branch: `advisor/013-batch-spike`
- Commit per logical unit; message style: conventional commits
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Investigate FileMaker OData $batch support

Research whether FileMaker Server's OData 4.01 implementation supports `$batch` requests:

1. Check the Claris/FileMaker OData documentation for `$batch` support:
   - Search the web for "FileMaker OData $batch" or "FileMaker Server OData batch operations"
   - Check `https://help.claris.com/en/odata-api-guide/` or similar official docs
2. Check the OData $metadata document for a `$batch` entity set or batch-related annotations — the metadata is fetched by `client.getMetadata()` and parsed by `ODataParser.parseMetadataForTables()`
3. If you have access to a FileMaker Server (the maintainer can provide test credentials), try sending a manual `$batch` request:
   ```
   POST /fmi/odata/v4/YourDatabase/$batch
   Content-Type: multipart/mixed; boundary=batch_123
   
   --batch_123
   Content-Type: application/http
   Content-Transfer-Encoding: binary
   
   POST /fmi/odata/v4/YourDatabase/YourTable HTTP/1.1
   Content-Type: application/json
   
   {"Field1": "Value1"}
   
   --batch_123--
   ```

Document your findings in `plans/013-batch-operations-findings.md`:
- Does FileMaker OData support `$batch`? (Yes/No/Partial/Unknown)
- If yes, what are the limitations? (max operations per batch, atomicity, change set support)
- If no, what are the alternatives? (parallel `Promise.all`, sequential loop)

**Verify**: `plans/013-batch-operations-findings.md` exists with a "FileMaker $batch Support" section.

### Step 2: Evaluate two implementation approaches

In `plans/013-batch-operations-findings.md`, document the two approaches:

**Approach A: Real OData $batch (multipart/mixed)**
- If FileMaker supports `$batch`, implement a proper multipart/mixed batch request
- Pros: atomic change sets, single HTTP round-trip, server-side transactional
- Cons: complex MIME boundary handling, harder to debug, FileMaker may not support it
- Implementation: `ODataClient.batchRequest(operations)` builds a multipart body, sends to `/$batch`

**Approach B: Parallel Promise.all (client-side batching)**
- Send N individual HTTP requests in parallel using `Promise.allSettled()`
- Pros: simple, works with any OData server, easy to debug, per-operation error isolation
- Cons: N HTTP round-trips (though parallel), no atomicity, server connection limit may throttle
- Implementation: `ODataClient.batchCreate(table, records[])` → `Promise.allSettled(records.map(r => this.createRecord(table, r)))`

Recommend one approach based on the Step 1 findings. If FileMaker supports `$batch`, recommend Approach A with Approach B as a fallback. If not, recommend Approach B.

**Verify**: `plans/013-batch-operations-findings.md` has an "Implementation Approaches" section with both approaches evaluated.

### Step 3: Define the proposed MCP tool API

In `plans/013-batch-operations-findings.md`, define the tool schemas for the proposed batch tools:

```ts
// Proposed: fm_odata_create_records (bulk create)
{
  name: "fm_odata_create_records",
  description: "Create multiple records in a single call. ...",
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
      ...connectionParam,
    },
    required: ["table", "records"],
  },
}

// Proposed: fm_odata_update_records (bulk update)
{
  name: "fm_odata_update_records",
  description: "Update multiple records in a single call. ...",
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
      ...connectionParam,
    },
    required: ["table", "updates"],
  },
}

// Proposed: fm_odata_delete_records (bulk delete)
{
  name: "fm_odata_delete_records",
  description: "Delete multiple records in a single call. ...",
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
      ...connectionParam,
    },
    required: ["table", "recordIds"],
  },
}
```

Document the response shape (per-record success/failure, summary count) and the `maxItems` safety cap rationale.

**Verify**: `plans/013-batch-operations-findings.md` has a "Proposed Tool API" section with all three tool schemas.

### Step 4: List open questions for the maintainer

In `plans/013-batch-operations-findings.md`, list the open questions that need maintainer input before a build plan can be written:

1. Does the maintainer have access to a FileMaker Server to test `$batch` support?
2. Is atomicity (all-or-nothing) required, or is per-record success/failure acceptable?
3. What is the appropriate `maxItems` cap? (100? 500? 1000? Depends on server capacity)
4. Should the tools return the full created/updated records, or just IDs and status?
5. Should there be a `fm_odata_batch_mixed` tool for mixed operations (create + update + delete in one call)?
6. How should partial failures be reported? (per-record error array? summary with error count?)
7. Should the tools respect `$apply` or `$filter` for bulk update/delete by criteria (e.g., "delete all records where Status = 'inactive'")?

**Verify**: `plans/013-batch-operations-findings.md` has an "Open Questions" section with ≥5 questions.

### Step 5: Optional prototype (if FileMaker $batch is supported)

If Step 1 found that FileMaker supports `$batch`, and you have access to a test server, write a prototype `batchCreateRecords` method in `src/odata-client.ts` (clearly marked as experimental):

```ts
  /**
   * EXPERIMENTAL — prototype only, not exposed as an MCP tool.
   * Create multiple records via OData $batch (multipart/mixed).
   * ...
   */
  async batchCreateRecordsExperimental(table: string, records: any[]): Promise<any[]> {
    // ... prototype implementation ...
  }
```

If FileMaker does NOT support `$batch`, or you don't have test server access, skip this step and document that the prototype is deferred to the build plan.

**Verify**: If prototyped, `npm run build` → exit 0. If not prototyped, document why in the findings file.

### Step 6: Commit the findings

```bash
git add plans/013-batch-operations-findings.md
# Also add prototype code if you wrote any
git commit -m "docs: batch operations design spike — findings and proposed API

Investigate FileMaker OData $batch support, evaluate two
implementation approaches (real $batch vs parallel Promise.all),
define proposed MCP tool schemas for bulk create/update/delete,
and list open questions for the maintainer."
```

**Verify**: `git log --oneline -1` → shows the commit

## Test plan

- No production tests required for a spike.
- If you wrote a prototype, add a basic test in `tests/unit/odata-client.test.ts` that verifies the prototype method exists and returns the expected shape with mocked axios.
- Verification: `npm test` → all pass (existing + any prototype tests)

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `plans/013-batch-operations-findings.md` exists with sections: "FileMaker $batch Support", "Implementation Approaches", "Proposed Tool API", "Open Questions"
- [ ] The findings document answers whether FileMaker OData supports `$batch` (or documents that it could not be determined and why)
- [ ] The proposed tool API defines schemas for `fm_odata_create_records`, `fm_odata_update_records`, `fm_odata_delete_records`
- [ ] At least 5 open questions are listed for the maintainer
- [ ] `npm run build` exits 0 (if prototype code was added)
- [ ] `npm test` exits 0
- [ ] No production MCP tools were added to `src/tools/odata.ts` (this is a spike, not a build)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- You cannot determine FileMaker $batch support from available documentation and don't have test server access — document this as an open question and proceed with Approach B (parallel Promise.all) as the recommended path.
- The prototype `$batch` request fails with an unexpected error that suggests FileMaker actively rejects batch requests — document the error response.
- The proposed tool API conflicts with existing tool naming conventions or the `connectionParam` pattern — report the conflict.

## Maintenance notes

- **This is a spike, not a build plan.** The output is a findings document that the maintainer reviews. After the maintainer answers the open questions, a separate build plan should be written to implement the chosen approach.
- **Plan 009 dependency**: The dead `batch()` stub should be removed (Plan 009) before this spike, so the findings document doesn't reference code that no longer exists. If Plan 009 hasn't landed, note the stub in the findings.
- **Future build plan**: The build plan for batch operations would add the three MCP tools to `src/tools/odata.ts`, implement the chosen approach in `src/odata-client.ts`, add tests, and update the tool count in README/CLAUDE.md. It would depend on the maintainer's answers to the open questions in this spike.
- A reviewer should check that the findings document is specific enough that a build plan can be written from it without re-investigating.
