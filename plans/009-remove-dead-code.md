# Plan 009: Remove dead code (http-server.ts and batch stub)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2829524..HEAD -- src/http-server.ts src/odata-client.ts tests/unit/odata-client.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-verification-baseline.md (needs working `npm test` and `npm run typecheck`)
- **Category**: tech-debt
- **Planned at**: commit `2829524`, 2026-07-16

## Why this matters

Two pieces of dead code add confusion and maintenance burden: (1) `src/http-server.ts` is a standalone HTTP server entry point that is never imported or referenced by any file or npm script — it duplicates the transport setup already handled by `src/index.ts` + `src/transport.ts`. (2) `ODataClient.batch()` is a "simplified version" (per its own comment) that doesn't implement real OData batch (multipart/mixed), is never called from any MCP tool, and is only exercised by its own unit test. Removing dead code reduces the surface area that future changes must consider and eliminates false signals about available functionality.

## Current state

**`src/http-server.ts` (full file, 46 lines):**
```ts
#!/usr/bin/env node

/**
 * Standalone HTTP server for FileMaker OData MCP
 * Run with: MCP_TRANSPORT=http MCP_PORT=3000 filemaker-odata-mcp
 */

import { FileMakerODataServer } from "./index.js";
import { setupSimpleHttpTransport, setupSimpleHttpsTransport } from "./simple-http-transport.js";
import { getConfig } from "./config.js";

async function main() {
  const config = getConfig();
  const server = new FileMakerODataServer();
  
  // Wait a bit for server to initialize
  await new Promise(resolve => setTimeout(resolve, 100));
  
  if (config.server.transport === "http") {
    await setupSimpleHttpTransport(
      server as any, // Type assertion to access internal server
      { port: config.server.port, host: config.server.host }
    );
  } else if (config.server.transport === "https") {
    await setupSimpleHttpsTransport(
      server as any,
      { port: config.server.port, host: config.server.host,
        certPath: config.security?.certPath, keyPath: config.security?.keyPath }
    );
  } else {
    console.error("HTTP server requires MCP_TRANSPORT=http or MCP_TRANSPORT=https");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
```

Confirmed dead: `grep -rn "http-server" src/ package.json` → no imports, no npm script references. The actual entry point is `src/bin/cli.ts` which imports `FileMakerODataServer` from `src/index.ts` and calls `server.run()`, which calls `setupTransport()` from `src/transport.ts`. The `http-server.ts` file duplicates this flow with a `setTimeout(100ms)` hack and `as any` type assertions.

**`src/odata-client.ts` batch method (lines 329-372):**
```ts
  /**
   * Execute batch operations
   */
  async batch(operations: BatchOperation[]): Promise<BatchResponse[]> {
    // OData batch implementation
    // This is a simplified version - full batch requires multipart/mixed format
    logger.debug(`Executing batch with ${operations.length} operations`);
    
    const results: BatchResponse[] = [];
    
    for (const op of operations) {
      try {
        let result: any;
        switch (op.method) {
          case "GET":
            result = await this.axiosInstance.get(op.url);
            break;
          case "POST":
            result = await this.axiosInstance.post(op.url, op.data);
            break;
          case "PATCH":
            result = await this.axiosInstance.patch(op.url, op.data);
            break;
          case "DELETE":
            result = await this.axiosInstance.delete(op.url);
            break;
          default:
            throw new Error(`Unsupported method: ${op.method}`);
        }
        results.push({ success: true, status: result.status, data: result.data });
      } catch (error: any) {
        results.push({ success: false, status: error.response?.status || 500, error: error.message });
      }
    }
    return results;
  }
```

And the interfaces (lines 405-416):
```ts
export interface BatchOperation {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  url: string;
  data?: any;
}

export interface BatchResponse {
  success: boolean;
  status: number;
  data?: any;
  error?: string;
}
```

Confirmed dead: `grep -rn "\.batch(" src/` → no callers in source code. Only called from `tests/unit/odata-client.test.ts:470,484`.

**`tests/unit/odata-client.test.ts` (batch tests, around lines 461-484):**
The test file contains tests for `client.batch()` that exercise the sequential loop implementation. These tests will need to be removed along with the method.

**`src/odata-parser.ts` — `formatBatchResults` method:**
Check if this exists: `grep -n "formatBatchResults" src/odata-parser.ts`. If it exists and is only used by batch tests, remove it too.

**Repo conventions:**
- TypeScript strict mode, ES Modules (Node16 — imports use `.js` extensions)
- Commit style: conventional commits (`refactor:`, `chore:` — see `git log --oneline -20`)

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Typecheck | `npm run typecheck`      | exit 0 (if Plan 001 landed) or `npx tsc --noEmit` |
| Build     | `npm run build`          | exit 0              |
| Tests     | `npm test`               | all pass (minus removed batch tests) |

## Scope

**In scope** (the only files you should modify):
- `src/http-server.ts` — delete entirely
- `src/odata-client.ts` — remove `batch()` method and `BatchOperation`/`BatchResponse` interfaces
- `tests/unit/odata-client.test.ts` — remove batch test cases
- `src/odata-parser.ts` — remove `formatBatchResults` if it exists and is only used by batch tests

**Out of scope** (do NOT touch):
- `src/index.ts` — the real entry point; no changes
- `src/bin/cli.ts` — the real CLI entry; no changes
- `src/transport.ts` — the real transport factory; no changes
- `src/simple-http-transport.ts` — the real transport setup; no changes
- `src/tools/` — no tool changes (batch was never exposed as a tool)
- Plan 013 (batch operations design spike) — this plan removes the dead stub; Plan 013 investigates whether to build a real implementation. They are independent: removing the stub doesn't prevent a future real implementation.

## Git workflow

- Branch: `advisor/009-remove-dead-code`
- Commit per logical unit; message style: conventional commits
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Delete src/http-server.ts

```bash
git rm src/http-server.ts
```

**Verify**: `ls src/http-server.ts 2>/dev/null` → file does not exist. `npm run typecheck` → exit 0 (no other file imports it).

### Step 2: Remove batch() method and interfaces from odata-client.ts

In `src/odata-client.ts`, remove:
1. The `batch()` method (lines 329-372, including the JSDoc comment)
2. The `BatchOperation` interface (lines 405-409)
3. The `BatchResponse` interface (lines 411-416)

Be careful to remove the complete method and interfaces without disturbing the surrounding code. The `testConnection()` method (line 378) and `testConnectionDetailed()` method (line 393) should remain.

**Verify**: `grep -n "batch\|BatchOperation\|BatchResponse" src/odata-client.ts` → no matches. `npm run typecheck` → exit 0.

### Step 3: Remove batch tests from odata-client.test.ts

In `tests/unit/odata-client.test.ts`, find and remove the test block(s) that call `client.batch()`. Search for the test:

```bash
grep -n "batch\|BatchOperation\|BatchResponse" tests/unit/odata-client.test.ts
```

Remove the entire `describe("batch", ...)` or `it("should batch ...", ...)` blocks that test the batch method. Do NOT remove tests for other methods.

**Verify**: `grep -n "batch" tests/unit/odata-client.test.ts` → no matches. `npm test` → all remaining tests pass.

### Step 4: Check for and remove formatBatchResults from odata-parser.ts

```bash
grep -n "formatBatchResults" src/odata-parser.ts tests/
```

If `formatBatchResults` exists in `odata-parser.ts` and is only referenced by the batch tests you just removed, remove the method from `odata-parser.ts` as well. If it's referenced elsewhere, leave it.

**Verify**: `grep -rn "formatBatchResults" src/ tests/` → no matches (if removed) or only non-batch references (if kept).

### Step 5: Full verification

**Verify**: `npm run typecheck && npm run build && npm test` → all exit 0

### Step 6: Commit

```bash
git add -A
git commit -m "refactor: remove dead code (http-server.ts and batch stub)

- Delete src/http-server.ts: standalone HTTP entry point never
  imported or referenced. The real entry is src/bin/cli.ts →
  src/index.ts → src/transport.ts.
- Remove ODataClient.batch() and BatchOperation/BatchResponse
  interfaces: 'simplified version' that doesn't implement real
  OData multipart/mixed batch, never called from any MCP tool.
- Remove corresponding unit tests.
- Remove ODataParser.formatBatchResults if only used by batch."
```

**Verify**: `git log --oneline -1` → shows the commit

## Test plan

- No new tests to write — this plan removes code and its tests.
- Verification: `npm test` → all remaining tests pass (the batch tests are gone, other tests unaffected)

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `ls src/http-server.ts` → file does not exist
- [ ] `grep -n "batch\|BatchOperation\|BatchResponse" src/odata-client.ts` → no matches
- [ ] `grep -n "batch" tests/unit/odata-client.test.ts` → no matches
- [ ] `grep -rn "http-server" src/` → no matches
- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/http-server.ts` is imported by any file you didn't expect (check `grep -rn "http-server" src/` before deleting — if there are imports beyond the file itself, STOP).
- Removing `batch()` causes TypeScript errors in other files (something else may reference `BatchOperation` or `BatchResponse` — report what).
- `npm test` fails after removing the batch tests (another test may depend on the batch test setup — report the failure).
- `formatBatchResults` is used by non-batch code (report where before removing).

## Maintenance notes

- **Plan 013 (batch operations design spike)**: This plan removes the dead stub. Plan 013 investigates whether to build a real OData batch implementation (multipart/mixed) or a parallel `Promise.all` approach. The removal doesn't conflict — a real implementation would be written fresh, not based on the stub.
- **Future dead code prevention**: Consider adding `ts-prune` or a similar tool to CI to detect unused exports automatically. This is out of scope but would prevent future accumulation.
- A reviewer should verify that `http-server.ts` was truly dead by checking `git log --all --source -- src/http-server.ts` — if it was ever referenced in a branch, note it.
