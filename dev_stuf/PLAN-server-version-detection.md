# Plan: Server Version Detection & Feature Fallbacks

**Status:** Approved, ready to implement  
**Target branch:** `feature/multisession` (add as part of v0.5.0)  
**Estimated effort:** 1-2 days

---

## Goal

Detect the FileMaker Server version from the OData `$metadata` XML, cache it per
session in `ConnectionManager`, use it to drive a runtime feature-compatibility matrix,
surface it via a new `fm_odata_get_server_version` tool, and apply smart fallbacks
(not hard errors) when a version-gated tool is called against an incompatible server.

---

## How FileMaker Exposes Its Version

The `$metadata` XML embeds the server version in two places (in priority order):

1. **Primary:** `<Annotation Term="Org.OData.Core.V1.ProductVersion" String="x.x.x.build"/>`
2. **Fallback A:** `Version` attribute on the `edmx:Edmx` root element
3. **Fallback B:** `null` (unknown) — warnings are shown but nothing is blocked

Detection is **lazy and cached** — runs once on first use, stored for the session lifetime.

---

## Feature Compatibility Matrix

| Feature key | Tool(s) | Minimum FM Server version |
|-------------|---------|--------------------------|
| `basic_odata` | all core tools | 19.0.0 |
| `cast` | `fm_odata_cast` | 21.1.0 |
| `build_filter` | `fm_odata_build_filter` | 21.1.0 |
| `aggregate` | `fm_odata_aggregate` | 22.0.1 |

---

## Fallback Behaviour (agreed)

| Tool | Version too old or unknown | Action |
|------|---------------------------|--------|
| `fm_odata_aggregate` | < 22.0.1 or unknown | Rewrite to N `queryRecords` calls, compute aggregation client-side (capped at 10 000 records), return same shape as `$apply` response, prepend a compatibility notice |
| `fm_odata_cast` | < 21.1.0 or unknown | Still return the expression (connection-free builder), prepend an advisory notice |
| `fm_odata_build_filter` | < 21.1.0 or unknown | Same as cast |
| Any tool, version unknown | n/a | Proceed with "version could not be detected, compatibility unknown" notice |

The gate is **never a hard error**. The rationale:
- Users may be intentionally testing expressions for a later server
- Future FM Server versions may add features we don't yet know about
- Client-side fallback for `$apply` keeps the tool usable on older installs

---

## Implementation Steps

### 1. `src/fm-version.ts` — new file

```typescript
export interface FMServerVersion {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

export const FM_FEATURE_MATRIX: Record<string, {
  minVersion: FMServerVersion;
  description: string;
  fallback: string;
}> = {
  cast:         { minVersion: { major:21, minor:1, patch:0, raw:"21.1.0" }, ... },
  build_filter: { minVersion: { major:21, minor:1, patch:0, raw:"21.1.0" }, ... },
  aggregate:    { minVersion: { major:22, minor:0, patch:1, raw:"22.0.1" }, ... },
};

export function parseServerVersion(metadataXml: string): FMServerVersion | null
export function isFeatureSupported(version: FMServerVersion | null, feature: string): boolean
export function featureWarning(version: FMServerVersion | null, feature: string): string | null
```

### 2. `src/odata-client.ts`

- Add private `_cachedVersion: FMServerVersion | null | undefined`
  (`undefined` = not yet fetched; `null` = fetched but unparseable)
- Add `getServerVersion(): Promise<FMServerVersion | null>`
  — calls `getMetadata()` once, passes XML to `parseServerVersion()`, caches result

### 3. `src/connection.ts`

- Extend `clientMeta` values to include `fmVersion?: FMServerVersion | null`
- Extend `SessionInfo` to include `fmVersion?: FMServerVersion | null`
- Add `getServerVersion(sessionName: string): Promise<FMServerVersion | null>`
  — delegates to the named client, stores result back in `clientMeta`

### 4. `src/tools/odata.ts`

**`fm_odata_aggregate`** — smart fallback:
- After resolving client, call `client.getServerVersion()` (cached)
- If supported: run `aggregateRecords()` as today
- If not supported or unknown:
  - Fetch up to 10 000 records via `queryRecords()` (applying `filter` if provided)
  - Compute aggregation in TypeScript (`sum`/`average`/`min`/`max`/`count`/`countdistinct`)
  - Return results in the same JSON shape as a server-side `$apply` response
  - Prepend notice: `"[Compatibility] FM Server vX.X does not support $apply. Result computed client-side from N records (cap: 10 000)."`

**`fm_odata_cast`** and **`fm_odata_build_filter`** — advisory notice:
- These are connection-free builders; the expression is always returned
- Resolve the active/named client and call `getServerVersion()`
- If version known-incompatible or unknown: prepend a one-line advisory to the response text

### 5. `src/tools/connection.ts`

New tool **`fm_odata_get_server_version`**:

- Optional `connection` param (consistent with all other session-aware tools)
- Calls `getServerVersion()` on the resolved client
- Returns structured JSON:

```json
{
  "session": "logic",
  "server": "https://fms.example.com",
  "database": "MyDB",
  "version": { "major": 21, "minor": 1, "patch": 2, "raw": "21.1.2.500" },
  "features": {
    "basic_odata":  { "supported": true,  "since": "19.0.0" },
    "cast":         { "supported": true,  "since": "21.1.0" },
    "build_filter": { "supported": true,  "since": "21.1.0" },
    "aggregate":    { "supported": false, "since": "22.0.1",
                      "fallback": "client-side computation (capped at 10 000 records)" }
  }
}
```

- Update `fm_odata_list_active_sessions` output to include `fmVersion` when already
  cached for that session (no extra HTTP request triggered)

### 6. `src/tools/index.ts`

- Add `"fm_odata_get_server_version"` to `connectionToolNames` set

### 7. `tests/unit/fm-version.test.ts` — new file

- `parseServerVersion()` with fixture EDMX strings:
  - Annotation present (v21.1.2, v22.0.1, v19.6.0)
  - Annotation absent, version in `edmx:Edmx Version` attribute
  - Unparseable / empty XML → `null`
- `isFeatureSupported()` and `featureWarning()` for each feature × version boundary
- Client-side aggregate fallback:
  - Mock `queryRecords` returning N records
  - Verify `sum`, `average`, `min`, `max`, `count`, `countdistinct` produce correct values
  - Verify groupBy produces multiple result rows
- Tool routing: `fm_odata_get_server_version` routes to connection handler, not OData handler

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `src/fm-version.ts` | **Create** — version parsing, comparison, feature matrix |
| `src/odata-client.ts` | Add `getServerVersion()` with internal lazy cache |
| `src/connection.ts` | Add `fmVersion` to `clientMeta` + `SessionInfo`; add `getServerVersion()` |
| `src/tools/connection.ts` | Add `fm_odata_get_server_version` tool + handler; update `list_active_sessions` |
| `src/tools/odata.ts` | Version gate + fallback for `aggregate`, advisory for `cast`/`build_filter` |
| `src/tools/index.ts` | Register `fm_odata_get_server_version` in `connectionToolNames` |
| `tests/unit/fm-version.test.ts` | **Create** — unit tests |

---

## Risks / Considerations

- **Client-side aggregate is capped at 10 000 records.** This is a documented limitation
  of the fallback path. Users on old FM Server who need exact aggregation over larger
  datasets should upgrade to FM Server 2025 (v22.0.1+).
- **Annotation format may vary.** Claris has changed annotation Term strings across
  versions. Both `Org.OData.Core.V1.ProductVersion` and a regex fallback over the raw
  XML are used as belt-and-suspenders.
- **`fm_odata_cast` / `fm_odata_build_filter` never hit the server** — the advisory
  notice is purely informational; the expression is always returned.
- **No breaking changes.** All existing tool signatures are preserved.
  `connection` param on `fm_odata_get_server_version` is optional.
- **One extra `$metadata` request per session** on first version-check. After that it
  is free (cached). Future optimization: reuse the `$metadata` response already fetched
  by `fm_odata_list_tables` / `fm_odata_describe_sessions`.

---

## Verification

```bash
npm run build   # must compile clean
npm test        # all existing + new tests must pass
```
