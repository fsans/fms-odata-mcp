# Plan 011: Add tests for critical untested paths (transport, URL building, multi-session)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3705083..HEAD -- src/odata-client.ts src/transport.ts src/simple-http-transport.ts src/working-http-transport.ts src/tools/connection.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001-verification-baseline.md, plans/004-wire-integration-tests.md (needs working test infrastructure)
- **Category**: tests
- **Planned at**: commit `2829524`, 2026-07-16
- **Reconciled at**: commit `3705083`, 2026-09-11 — line numbers updated (odata-client.ts grew ~290 lines post-audit); note `src/tools/schema.ts` (new, ~346 lines) already has `tests/unit/schema-tools.test.ts`, so it's out of this plan's scope

## Why this matters

Three critical code paths have zero test coverage: (1) OData URL building (`buildUrl`, `odataEncode`, `entityKey`) — the code that constructs FileMaker OData URLs with FileMaker-specific encoding quirks (spaces as `%20` not `+`, literal `$` not `%24`, literal commas not `%2C`, numeric vs string key quoting); (2) the HTTP transport layer (`transport.ts`, `simple-http-transport.ts`, `working-http-transport.ts`) — the Express setup, CORS, JSON-RPC request handling, and notification 204 logic; (3) multi-session tool handlers (`handleConnectMulti`, `handleDescribeSessions`, `handleGetServerVersion`) — the complex parallel-connection and metadata-merging logic. These are the paths most likely to break silently on refactoring.

## Current state

**`src/odata-client.ts` URL building (lines ~176-310 as of `3705083` — `entityKey` at 176, `odataEncode` at 191, `buildUrl` at 291):**
```ts
  private entityKey(recordId: string | number): string {
    const rid = String(recordId);
    return /^-?\d+$/.test(rid) ? `(${rid})` : `('${rid.replace(/'/g, "''")}')`;
  }

  private odataEncode(v: string): string {
    return encodeURIComponent(v).replace(/%2C/gi, ",");
  }

  private buildUrl(table: string, options?: ODataQueryOptions, recordId?: string): string {
    let url = `${this.baseUrl}/${table}`;
    if (recordId !== undefined && recordId !== null && recordId !== "") {
      url += this.entityKey(recordId);
    }
    if (options) {
      const parts: string[] = [];
      const add = (k: string, v: string) => parts.push(`${k}=${this.odataEncode(v)}`);
      if (options.apply) add("$apply", options.apply);
      if (options.filter) add("$filter", options.filter);
      if (options.select) add("$select", options.select);
      if (options.orderby) add("$orderby", options.orderby);
      if (options.top !== undefined) parts.push(`$top=${options.top}`);
      if (options.skip !== undefined) parts.push(`$skip=${options.skip}`);
      if (options.expand) add("$expand", options.expand);
      if (options.count) parts.push(`$count=true`);
      if (parts.length) { url += `?${parts.join("&")}`; }
    }
    return url;
  }
```

These are `private` methods — they're tested indirectly through the public methods (`queryRecords`, `getRecord`, etc.) which make HTTP calls. To test them directly, either make them accessible (export a test helper or use `Object.getOwnPropertyNames`) or test through the public methods with a mocked axios instance.

**`src/working-http-transport.ts` (lines 55-101, handleRequest):**
```ts
  async handleRequest(_req: IncomingMessage, res: ServerResponse, request: JSONRPCRequest): Promise<void> {
    try {
      if (!("id" in request) || request.id === null || request.id === undefined) {
        if (this.onmessage) { this.onmessage(request); }
        res.writeHead(204);
        res.end();
        return;
      }
      const id = request.id;
      const responsePromise = new Promise<JSONRPCResponse>((resolve) => {
        this.pending.set(id, resolve);
      });
      if (this.onmessage) { this.onmessage(request); }
      const response = await responsePromise;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response));
    } catch (error) {
      // ...
    }
  }
```

**`src/tools/connection.ts` (as of `3705083`: `handleConnectMulti` ~line 300, `handleDescribeSessions` ~line 570, `handleGetServerVersion` ~line 683):**
The multi-connect handler uses `Promise.all` to connect all databases in parallel, handles per-entry success/failure, selects the primary session, and builds a summary. See the full excerpts in the file — line numbers drifted post-audit, locate handlers via `grep -n "^async function handle" src/tools/connection.ts`.

**Existing test patterns to follow:**
- `tests/unit/odata-client.test.ts` — uses `jest.mock("axios")` to mock axios and test ODataClient methods
- `tests/unit/multi-session.test.ts` — tests ConnectionManager with mocked ODataClient
- `tests/unit/tool-routing.test.ts` — tests tool dispatch with `@jest/globals`

**Repo conventions:**
- Tests use `@jest/globals` (`describe`, `it`, `expect`, `jest`, `beforeEach`, `beforeAll`)
- ESM module system: imports use `.js` extensions for `.ts` source files
- `jest.mock()` with factory functions for mocking modules
- Test files in `tests/unit/` (run by `npm test` per jest.config.js)

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Typecheck | `npm run typecheck`      | exit 0 (if Plan 001 landed) |
| Tests     | `npm test`               | all pass, including new tests |
| Single test file | `npm test -- tests/unit/odata-url-building.test.ts` | all pass |

## Scope

**In scope** (the only files you should create or modify):
- `tests/unit/odata-url-building.test.ts` — new test file for URL building logic
- `tests/unit/working-http-transport.test.ts` — new test file for HTTP transport
- `tests/unit/multi-session-handlers.test.ts` — new test file for multi-session tool handlers
- `src/odata-client.ts` — may need to export `odataEncode` and `entityKey` for direct testing (or test via public methods with mocked axios)

**Out of scope** (do NOT touch):
- `src/transport.ts` — the factory function; low complexity, tested indirectly
- `src/simple-http-transport.ts` — Express setup; tested via integration tests if Plan 004 landed
- `src/tools/odata.ts` — tool handler tests are covered by integration tests (Plan 004)
- Existing test files — do NOT modify existing tests

## Git workflow

- Branch: `advisor/011-critical-path-tests`
- Commit per logical unit; message style: conventional commits
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write tests for OData URL building

Create `tests/unit/odata-url-building.test.ts`. Test the URL building logic through the public ODataClient methods with a mocked axios instance. Model after `tests/unit/odata-client.test.ts`.

Test cases:
1. **`entityKey` — numeric ID**: `getRecord("contact", "42")` → URL contains `contact(42)` (unquoted)
2. **`entityKey` — string ID**: `getRecord("contact", "ABC-123")` → URL contains `contact('ABC-123')` (quoted)
3. **`entityKey` — apostrophe escaping**: `getRecord("contact", "O'Brien")` → URL contains `contact('O''Brien')` (doubled apostrophe)
4. **`entityKey` — negative numeric**: `getRecord("contact", "-5")` → URL contains `contact(-5)`
5. **`odataEncode` — spaces as %20**: `queryRecords("contact", { filter: "Name eq 'John Doe'" })` → URL contains `%20` not `+`
6. **`odataEncode` — literal $ prefix**: `queryRecords("contact", { filter: "x eq 1" })` → URL contains `$filter` not `%24filter`
7. **`odataEncode` — literal commas**: `queryRecords("contact", { select: "A,B,C" })` → URL contains `A,B,C` not `A%2CB%2CC`
8. **`buildUrl` — all options**: `queryRecords` with filter, select, orderby, top, skip, expand, count → correct query string order and encoding
9. **`buildUrl` — $apply**: `aggregateRecords("contact", "aggregate($count as Total)")` → URL contains `$apply=aggregate...`
10. **`buildUrl` — no options**: `queryRecords("contact")` → URL is just `baseUrl/contact` with no `?`

To test private methods, either:
- Mock axios and inspect the URL passed to `axiosInstance.get()` — this is the recommended approach since it tests the actual behavior
- Or export `odataEncode` and `entityKey` as standalone functions for direct testing (if the executor prefers unit-level isolation)

```ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import axios from "axios";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// ... test setup with mock axios instance that captures URLs ...
```

**Verify**: `npm test -- tests/unit/odata-url-building.test.ts` → all pass

### Step 2: Write tests for working-http-transport.ts

Create `tests/unit/working-http-transport.test.ts`. Test the `HttpTransport` class directly.

Test cases:
1. **Notification handling (no id)**: `handleRequest` with a request lacking `id` → calls `onmessage`, writes 204, ends response
2. **Request with id**: `handleRequest` with `{ id: 1, method: "tools/list" }` → registers pending resolver, calls `onmessage`
3. **Response correlation**: `send()` with `{ result: ..., id: 1 }` → resolves the pending promise for id 1
4. **Unknown response id**: `send()` with `{ result: ..., id: 999 }` when no pending request → calls `onerror`
5. **Server-initiated notification via send**: `send()` with a notification (no result/error/id) → calls `onmessage`
6. **Error handling**: `handleRequest` where `onmessage` throws → writes 500 with JSON-RPC error

Mock `ServerResponse` and `IncomingMessage` using simple objects or `jest.fn()`:

```ts
import { describe, it, expect, jest } from "@jest/globals";
import { HttpTransport } from "../../src/working-http-transport.js";

// Create mock response objects
function createMockRes() {
  const res: any = {
    writeHead: jest.fn(),
    end: jest.fn(),
  };
  return res;
}
```

**Verify**: `npm test -- tests/unit/working-http-transport.test.ts` → all pass

### Step 3: Write tests for multi-session tool handlers

Create `tests/unit/multi-session-handlers.test.ts`. Test `handleConnectMulti`, `handleDescribeSessions`, and `handleGetServerVersion` from `src/tools/connection.ts`. Mock the ConnectionManager and config module.

Test cases for `handleConnectMulti`:
1. **All connections succeed**: 3 databases, all `testConnectionDetailed` returns `{ ok: true }` → summary shows 3/3, first is active
2. **Partial failure**: 2 succeed, 1 fails → summary shows 2/3, failed entry has error message
3. **Primary selection**: entry with `primary: true` succeeds → that entry is active
4. **Primary fails, first success is active**: primary fails, first non-primary succeeds → first success is active
5. **All fail**: all `testConnectionDetailed` return `{ ok: false }` → `isError: true`, summary shows 0/3

Test cases for `handleDescribeSessions`:
1. **No active sessions**: returns "No active sessions" message
2. **Single session**: returns tables from that session's metadata
3. **Multiple sessions, no collisions**: returns flat list with connection alias per table
4. **Table name collision**: same table in two sessions → collision flagged
5. **Session metadata fetch fails**: error surfaced per-session, other sessions still return tables

Mock pattern:
```ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

jest.mock("../../src/connection.js", () => ({
  connectionManager: {
    listActiveSessions: jest.fn(),
    getClientByName: jest.fn(),
    createInlineClientNamed: jest.fn(),
    setCurrentConnection: jest.fn(),
    removeClient: jest.fn(),
  },
}));
```

**Verify**: `npm test -- tests/unit/multi-session-handlers.test.ts` → all pass

### Step 4: Run full test suite

**Verify**: `npm test` → all tests pass (existing + new). Check the test count increased by the new test files.

### Step 5: Commit

```bash
git add tests/unit/odata-url-building.test.ts tests/unit/working-http-transport.test.ts tests/unit/multi-session-handlers.test.ts
# Also add src/odata-client.ts if you exported helper functions
git commit -m "test: add coverage for URL building, HTTP transport, and multi-session handlers

- odata-url-building.test.ts: entityKey quoting, odataEncode
  FileMaker-specific encoding, buildUrl with all query options
- working-http-transport.test.ts: notification 204 handling,
  request/response correlation, error responses
- multi-session-handlers.test.ts: connect_multi parallel logic,
  describe_sessions metadata merging, server version handler"
```

**Verify**: `git log --oneline -1` → shows the commit

## Test plan

- The plan IS the test plan — three new test files covering the critical untested paths.
- Model after existing tests: `tests/unit/odata-client.test.ts` (axios mocking), `tests/unit/multi-session.test.ts` (ConnectionManager mocking), `tests/unit/tool-routing.test.ts` (jest globals structure).
- Verification: `npm test` → all pass, test file count increased by 3.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `tests/unit/odata-url-building.test.ts` exists and has ≥10 test cases covering entityKey, odataEncode, and buildUrl
- [ ] `tests/unit/working-http-transport.test.ts` exists and has ≥6 test cases covering notification handling, request/response correlation, and error handling
- [ ] `tests/unit/multi-session-handlers.test.ts` exists and has ≥10 test cases covering handleConnectMulti, handleDescribeSessions, and handleGetServerVersion
- [ ] `npm test` exits 0 with all new tests passing
- [ ] `npm run typecheck` exits 0 (if Plan 001 landed)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The private methods (`entityKey`, `odataEncode`, `buildUrl`) cannot be tested through public methods with mocked axios — report the issue. You may need to export them as standalone functions, but report this decision.
- The `HttpTransport` class cannot be instantiated in isolation (requires MCP SDK Transport interface setup) — report the error.
- The multi-session handler tests fail because the handlers have side effects that can't be mocked (e.g., they call `getConfig()` which reads env vars) — report what can't be mocked.
- Existing tests break after adding the new test files (possible module mocking conflicts) — report the conflict.

## Maintenance notes

- **Private method testing**: If you exported `odataEncode` and `entityKey` for direct testing, note that future changes to these methods must keep the exports in sync. Alternatively, if you tested through public methods with mocked axios, the tests are more resilient to refactoring.
- **Transport tests**: The `HttpTransport` tests don't require a running Express server — they test the JSON-RPC correlation logic directly. If the MCP SDK's `Transport` interface changes in a future upgrade, these tests may need updating.
- **Handler tests**: The multi-session handler tests mock the ConnectionManager. If the ConnectionManager interface changes, the mocks must be updated. This is why the tests should mock at the module level (`jest.mock("../../src/connection.js")`) rather than at the instance level.
- A reviewer should read the new tests and verify they assert meaningful behavior (not just "function was called"). Each test should verify the output shape, error handling, or state change — not just that a mock was invoked.
