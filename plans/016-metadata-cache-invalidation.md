# Plan 016: Invalidate cached $metadata after schema mutations (+ minor fixes)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3705083..HEAD -- src/odata-client.ts src/tools/schema.ts src/logger.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-verification-baseline.md (needs working `npm test` and `npm run typecheck`)
- **Category**: bug
- **Planned at**: commit `3705083`, 2026-09-11 (found by post-audit delta review)

## Why this matters

`ODataClient.getMetadata()` caches the `$metadata` XML for the session lifetime (`_cachedMetadata`). The schema tools added in v0.8.3 — `fm_odata_create_table`, `fm_odata_add_fields`, `fm_odata_delete_table`, `fm_odata_delete_field`, `fm_odata_create_index`, `fm_odata_delete_index` — mutate the schema but never invalidate that cache. After a successful `create_table`, every metadata-driven tool (`fm_odata_list_tables`, `fm_odata_describe_table`, `fm_odata_describe_sessions`, `fm_odata_list_scripts`) keeps returning the pre-mutation schema until the session is reconnected. An agent that creates a table then tries to describe or query it gets stale results — a silent, confusing failure on the most obvious post-DDL workflow.

Two smaller issues are folded in:

- **`runScriptById` does not encode `scriptId`** (`odata-client.ts:~596`). The value is typed `number | string` and interpolated raw into the URL path (`Script.FMSID:${scriptId}`). A string containing `/`, `?`, `#`, or spaces produces a malformed URL.
- **`_fieldIdMap` collides across tables** (`odata-client.ts:~624`). The name→FMFID map is built by scanning *all* `<Property>` elements in the metadata, keyed only by field name. Two different tables with the same non-ASCII field name map to the last-seen FMFID — `normalizeFilter` can substitute the wrong table's field ID. (Worst case is a server-side error, not wrong data — but it's wrong either way.)
- **`logger.ts` log path moved** — from `getConfigDir()/../fms-odata-mcp/logs/` (i.e. `~/fms-odata-mcp/logs/`) to `getConfigDir()/logs/` (i.e. `~/.fms-odata-mcp/logs/`). Verify no docs still reference the old path.

## Current state

**`src/odata-client.ts` (lines 83-87, cached state):**
```ts
  private _cachedVersion: FMServerVersion | null | undefined = undefined;
  /** Cached metadata XML, kept after the first `getMetadata()` or `getServerVersion()` call. */
  private _cachedMetadata?: string;
  /** Map of field name → FMFID built from cached metadata (v26+ only). */
  private _fieldIdMap?: Map<string, string>;
```

**`src/odata-client.ts` (lines 331-343, cached getMetadata):**
```ts
  async getMetadata(): Promise<string> {
    if (this._cachedMetadata !== undefined) {
      return this._cachedMetadata;
    }
    logger.debug(`Getting metadata from ${this.baseUrl}/$metadata`);
    const response = await this.axiosInstance.get(`${this.baseUrl}/$metadata`, {
      headers: {
        Accept: "application/xml",
      },
    });
    this._cachedMetadata = String(response.data);
    return this._cachedMetadata;
  }
```

**`src/odata-client.ts` (lines 352-366, getServerVersion — also populates the cache):**
```ts
  async getServerVersion(): Promise<FMServerVersion | null> {
    if (this._cachedVersion !== undefined) {
      return this._cachedVersion;
    }
    try {
      const xml = await this.getMetadata();
      this._cachedMetadata = xml;
      this._cachedVersion = parseServerVersion(xml);
      this._fieldIdMap = undefined; // force rebuild now that version is known
      this._buildFieldIdMap();
    } catch {
      this._cachedVersion = null;
    }
    return this._cachedVersion;
  }
```

**`src/odata-client.ts` (lines ~596-603, runScriptById — unencoded interpolation):**
```ts
  async runScriptById(scriptId: number | string, scriptParam?: any): Promise<ScriptResult> {
    const url = `${this.baseUrl}/Script.FMSID:${scriptId}`;
```

**`src/odata-client.ts` (lines ~624-651, _buildFieldIdMap — global name key, collisions overwrite):**
```ts
    const map = new Map<string, string>();
    // Match block-style <Property> elements that contain a FieldID annotation
    const propertyRegex =
      /<Property\s+Name="([^"]+)"\s+Type="[^"]+"[^>]*>[\s\S]*?<Annotation\s+Term="com\.filemaker\.odata\.FieldID"[^>]*String="FMFID:([^"]+)"\s*\/>?[\s\S]*?<\/Property>/g;
    let match;
    while ((match = propertyRegex.exec(this._cachedMetadata)) !== null) {
      const fieldName = match[1];
      const fmfid = `FMFID:${match[2]}`;
      map.set(fieldName, fmfid);
    }
    this._fieldIdMap = map;
```

**`src/tools/schema.ts` (lines ~281-337)** — the six handlers call `client.createTable`, `client.addFields`, `client.deleteTable`, `client.deleteField`, `client.createIndex`, `client.deleteIndex`. None invalidate the metadata cache afterward.

**`src/logger.ts` (line ~20):**
```ts
    this.logFile = path.join(getConfigDir(), "logs", "server.log");
```

**Repo conventions:**
- TypeScript strict mode, ES Modules (Node16 — imports use `.js` extensions)
- Tests use `@jest/globals`; model after `tests/unit/odata-client.test.ts`
- Commit style: conventional commits (`fix:` — see `git log --oneline -20`)

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Typecheck | `npm run typecheck`      | exit 0 (if Plan 001 landed) or `npx tsc --noEmit` |
| Build     | `npm run build`          | exit 0              |
| Tests     | `npm test`               | all pass            |

## Scope

**In scope** (the only files you should modify):
- `src/odata-client.ts` — add `invalidateMetadataCache()`; fix `runScriptById` encoding; make `_fieldIdMap` collision-safe
- `src/tools/schema.ts` — call cache invalidation after each successful schema mutation
- `tests/unit/odata-client.test.ts` — add tests for invalidation and scriptId encoding
- `tests/unit/schema-tools.test.ts` — add a test asserting the cache is invalidated after `create_table` (mock the client and assert the method is called)
- `CLAUDE.md`/`README.md`/`docs` — only if they reference the old log path `~/fms-odata-mcp/logs` (check first; update or leave)

**Out of scope** (do NOT touch):
- `src/tools/odata.ts`, `src/tools/connection.ts` — the metadata consumers don't change; invalidation lives in the client + schema handlers
- `src/odata-parser.ts` — no parser changes
- `src/index.ts`, `src/connection.ts` — session lifecycle is unchanged; cache stays per-client-instance
- Plans 013/014/015 — the spike plans are unaffected

## Git workflow

- Branch: `advisor/016-metadata-cache-invalidation`
- Commit per logical unit; message style: conventional commits
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add invalidateMetadataCache() to ODataClient

In `src/odata-client.ts`, add a public method that clears all three caches. Place it after `getServerVersion` (~line 367):

```ts
  /**
   * Invalidate the cached $metadata, parsed server version, and FMFID map.
   * Must be called after any schema mutation (create/delete table/field/index)
   * so subsequent getMetadata()/getServerVersion() calls re-fetch fresh XML.
   */
  invalidateMetadataCache(): void {
    this._cachedMetadata = undefined;
    this._cachedVersion = undefined;
    this._fieldIdMap = undefined;
  }
```

Note: `_cachedVersion` is reset to `undefined` (not `null`) so the next `getServerVersion()` call re-parses the freshly fetched metadata rather than returning the "unknown" sentinel.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 2: Invalidate the cache in the schema handlers

In `src/tools/schema.ts`, call `client.invalidateMetadataCache()` immediately after each successful schema mutation — inside each `case` block, after the `await client.*` call:

```ts
      case "fm_odata_create_table": {
        const fields = args.fields as FMFieldDefinition[];
        const result = await client.createTable({
          tableName: args.tableName,
          fields,
        });
        client.invalidateMetadataCache();   // ← add this line
        ...
```

Apply to all six cases: `create_table`, `add_fields`, `delete_table`, `delete_field`, `create_index`, `delete_index`. Place the call *after* the awaited mutation so a failed mutation (thrown error → caught by the outer try/catch) doesn't invalidate unnecessarily.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 3: Fix runScriptById encoding

In `src/odata-client.ts` (~line 596), validate/encode the scriptId. FMSIDs are numeric — reject anything that isn't digits, and encode defensively:

```ts
  async runScriptById(scriptId: number | string, scriptParam?: any): Promise<ScriptResult> {
    const id = String(scriptId);
    if (!/^\d+$/.test(id)) {
      throw new Error(`Invalid scriptId "${scriptId}": FMSID must be numeric`);
    }
    const url = `${this.baseUrl}/Script.FMSID:${id}`;
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 4: Make _fieldIdMap collision-safe

In `_buildFieldIdMap` (~line 644), track which names map to more than one distinct FMFID and omit ambiguous names — they fall back to auto-quoting in `normalizeFilter`, which is the correct conservative behavior:

```ts
    const map = new Map<string, string>();
    const ambiguous = new Set<string>();
    const propertyRegex =
      /<Property\s+Name="([^"]+)"\s+Type="[^"]+"[^>]*>[\s\S]*?<Annotation\s+Term="com\.filemaker\.odata\.FieldID"[^>]*String="FMFID:([^"]+)"\s*\/>?[\s\S]*?<\/Property>/g;
    let match;
    while ((match = propertyRegex.exec(this._cachedMetadata)) !== null) {
      const fieldName = match[1];
      const fmfid = `FMFID:${match[2]}`;
      const existing = map.get(fieldName);
      if (existing !== undefined && existing !== fmfid) {
        // Same field name in multiple EntityTypes with different FMFIDs —
        // the map is not table-scoped, so substitution would be ambiguous.
        ambiguous.add(fieldName);
      } else {
        map.set(fieldName, fmfid);
      }
    }
    for (const name of ambiguous) {
      map.delete(name);
      logger.debug(
        `Field "${name}" maps to multiple FMFIDs across tables — ` +
        `falling back to quoted-identifier filtering for this name.`
      );
    }
    this._fieldIdMap = map;
```

**Verify**: `npx tsc --noEmit` → exit 0

### Step 5: Check docs for the old log path

```bash
grep -rn "fms-odata-mcp/logs\|fms-odata-mcp.*log" README.md CLAUDE.md AGENTS.md DOCKER.md CONTRIBUTING.md CHANGELOG.md 2>/dev/null
```

The log file moved from `~/fms-odata-mcp/logs/server.log` to `~/.fms-odata-mcp/logs/server.log`. Update any doc that references the old path. If none reference it, skip this step.

**Verify**: no stale references remain (or none existed).

### Step 6: Add tests

In `tests/unit/odata-client.test.ts` (model after existing tests in the file):

```ts
describe("invalidateMetadataCache", () => {
  test("clears cached metadata so getMetadata re-fetches", async () => {
    // arrange: mock axios get to return different XML on 2nd call
    // call getMetadata() twice with invalidateMetadataCache() between
    // assert axios get was called twice
  });

  test("resets cached version so getServerVersion re-parses", async () => {
    // call getServerVersion(), invalidate, call again with different XML
    // assert the second result reflects the new XML
  });
});

describe("runScriptById", () => {
  test("rejects non-numeric scriptId", async () => {
    await expect(client.runScriptById("abc/../x")).rejects.toThrow(/Invalid scriptId/);
  });
});
```

In `tests/unit/schema-tools.test.ts` (model after existing tests): add a test that mocks the client, calls the `fm_odata_create_table` handler, and asserts `invalidateMetadataCache` was called.

**Verify**: `npm test` → all pass

### Step 7: Full verification and commit

**Verify**: `npx tsc --noEmit && npm run build && npm test` → all exit 0

```bash
git add src/odata-client.ts src/tools/schema.ts tests/unit/odata-client.test.ts tests/unit/schema-tools.test.ts
# plus any doc files touched in step 5
git commit -m "fix: invalidate cached $metadata after schema mutations

getMetadata() caches the XML for the session lifetime, but the
schema tools (create_table, add_fields, delete_table, delete_field,
create_index, delete_index) never invalidated it — list_tables and
describe_table returned the pre-mutation schema until reconnect.

Also: validate scriptId is numeric in runScriptById, and omit
ambiguous field names from the FMFID map (same name in multiple
tables now falls back to quoted-identifier filtering)."
```

**Verify**: `git log --oneline -1` → shows the commit

## Test plan

- New tests: cache invalidation (metadata re-fetch, version re-parse), `runScriptById` input validation, schema handler calls `invalidateMetadataCache`.
- Manual check (if a FileMaker server is available): create a table via `fm_odata_create_table`, then call `fm_odata_list_tables` — the new table must appear without reconnecting.
- Verification: `npm test` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `src/odata-client.ts` exports a public `invalidateMetadataCache()` that clears `_cachedMetadata`, `_cachedVersion`, and `_fieldIdMap`
- [ ] All six schema handlers in `src/tools/schema.ts` call `client.invalidateMetadataCache()` after a successful mutation
- [ ] `runScriptById` rejects non-numeric `scriptId` with a clear error
- [ ] `_buildFieldIdMap` omits names that map to >1 distinct FMFID
- [ ] `grep -rn "fms-odata-mcp/logs" README.md CLAUDE.md DOCKER.md CONTRIBUTING.md` → no stale references (or docs updated)
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0, including the new tests
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the cited locations doesn't match the excerpts (the codebase has drifted).
- `invalidateMetadataCache` causes a test to fail because some existing test depends on the cache persisting — report which test and why.
- The `Property` regex in `_buildFieldIdMap` was restructured (e.g. made EntityType-scoped) — the collision fix may then be unnecessary; report what you found.
- A consumer calls `getMetadata()` concurrently with a schema mutation and races the invalidation — report if you find such a call site (Node is single-threaded, so this would require an actual interleaved `await`).

## Maintenance notes

- **Cache lifetime is per-client-instance.** Sessions sharing a connection share the cache — that's correct, since they share the underlying database.
- **Deliberately no auto-invalidation on a timer.** The cache is only wrong when *this server* mutates the schema through *this client*. External schema changes (another user edits the file in FileMaker Pro) can still produce stale metadata — document this limitation or add a `fm_odata_refresh_metadata` tool if it becomes a real problem.
- **Future schema tools** must follow the same pattern: invalidate after success. Add a code comment at the top of `schema.ts` if more DDL tools are added.
- A reviewer should verify the invalidation is called *after* the await (not before), and that `_cachedVersion = undefined` (not `null`) so re-parse actually happens.
