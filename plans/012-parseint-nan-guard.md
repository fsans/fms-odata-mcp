# Plan 012: Add NaN guard to parseInt in config loading

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2829524..HEAD -- src/config.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-verification-baseline.md (needs working `npm test` and `npm run typecheck`)
- **Category**: bug
- **Planned at**: commit `2829524`, 2026-07-16

## Why this matters

`parseInt` is used to parse `MCP_PORT` and `FM_TIMEOUT` from environment variables. If these env vars contain non-numeric values (e.g., `MCP_PORT=abc`), `parseInt` returns `NaN`. The port validation check (`config.server.port < 1 || config.server.port > 65535`) silently passes because `NaN < 1` is `false` and `NaN > 65535` is `false` in JavaScript. This results in `NaN` being passed to `http.createServer().listen(NaN, ...)`, which throws a confusing runtime error instead of a clear configuration error at startup.

## Current state

**`src/config.ts` (lines 130-148, getConfig):**
```ts
  const config: AppConfig = {
    server: {
      transport: transportType,
      port: parseInt(
        process.env.MCP_PORT || String(fileConfig.server?.port || defaultPort),
        10
      ),
      host: process.env.MCP_HOST || fileConfig.server?.host || "localhost",
    },
    filemaker: {
      server: process.env.FM_SERVER || fileConfig.filemaker?.server || "",
      database: process.env.FM_DATABASE || fileConfig.filemaker?.database || "",
      user: process.env.FM_USER || fileConfig.filemaker?.user || "",
      password: process.env.FM_PASSWORD || fileConfig.filemaker?.password,
      verifySsl: process.env.FM_VERIFY_SSL
        ? process.env.FM_VERIFY_SSL.toLowerCase() === "true"
        : resolveVerifySsl(fileConfig.filemaker?.verifySsl),
      timeout: parseInt(process.env.FM_TIMEOUT || String(fileConfig.filemaker?.timeout || 30000), 10),
    },
    // ...
  };
```

Two `parseInt` calls without NaN checks:
- Line 133-136: `parseInt(process.env.MCP_PORT || ..., 10)` — port
- Line 147: `parseInt(process.env.FM_TIMEOUT || ..., 30000), 10)` — timeout

**`src/config.ts` (lines 175-180, validateConfig):**
```ts
  // Validate server configuration
  if (config.server.transport !== "stdio") {
    if (config.server.port < 1 || config.server.port > 65535) {
      errors.push("MCP_PORT must be between 1 and 65535");
    }
  }
```

`NaN < 1` is `false`, `NaN > 65535` is `false` — so `NaN` passes this validation silently.

**`src/config.ts` (lines 286-305, mergeWithDefaults):**
```ts
function mergeWithDefaults(partial: Partial<AppConfig>): AppConfig {
  return {
    server: {
      transport: partial.server?.transport || "stdio",
      port: partial.server?.port ?? DEFAULT_HTTP_PORT,
      host: partial.server?.host || "localhost",
    },
    // ...
  };
}
```

This uses `??` (nullish coalescing) which doesn't catch `NaN` (NaN is not null/undefined).

**Repo conventions:**
- TypeScript strict mode
- Error handling: `validateConfig` returns `{ valid: boolean, errors: string[] }`
- Helper functions are exported for testability (e.g., `resolveVerifySsl`)
- Commit style: conventional commits (`fix:` — see `git log --oneline -20`)

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Typecheck | `npm run typecheck`      | exit 0 (if Plan 001 landed) |
| Tests     | `npm test`               | all pass, including new tests |

## Scope

**In scope** (the only files you should modify):
- `src/config.ts` — add NaN guard to parseInt calls and port validation
- `tests/unit/config.test.ts` — add test cases for NaN port/timeout

**Out of scope** (do NOT touch):
- `src/transport.ts` — reads `MCP_PORT` via `process.env` directly but uses `getTransportConfig()` which calls `parseInt` — the fix in `config.ts` doesn't directly affect this. However, `transport.ts:24-26` also has a `parseInt` for port. If you notice this, add the same guard there, but report it as an addition.
- `src/index.ts` — calls `validateConfig` which will now catch NaN
- Other source files

## Git workflow

- Branch: `advisor/012-parseint-nan-guard`
- Commit per logical unit; message style: conventional commits
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a parseInt-with-validation helper function

In `src/config.ts`, add a helper function that wraps `parseInt` and returns a fallback if the result is `NaN`. Place it near the existing `resolveVerifySsl` helper (around line 311):

```ts
/**
 * Parse an integer from a string, returning a fallback if the result is NaN.
 * Used for env var parsing where non-numeric values should not silently
 * produce NaN (which passes comparison validation in JS).
 */
function parseIntSafe(value: string, fallback: number): number {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}
```

**Verify**: `npm run typecheck` → exit 0

### Step 2: Replace parseInt calls with parseIntSafe

In `getConfig()` (lines 133-136), replace:
```ts
      port: parseInt(
        process.env.MCP_PORT || String(fileConfig.server?.port || defaultPort),
        10
      ),
```
with:
```ts
      port: parseIntSafe(
        process.env.MCP_PORT || String(fileConfig.server?.port || defaultPort),
        defaultPort
      ),
```

In `getConfig()` (line 147), replace:
```ts
      timeout: parseInt(process.env.FM_TIMEOUT || String(fileConfig.filemaker?.timeout || 30000), 10),
```
with:
```ts
      timeout: parseIntSafe(process.env.FM_TIMEOUT || String(fileConfig.filemaker?.timeout || 30000), 30000),
```

**Verify**: `npm run typecheck` → exit 0

### Step 3: Add NaN check to validateConfig port validation

In `validateConfig()` (lines 176-180), replace:
```ts
  if (config.server.transport !== "stdio") {
    if (config.server.port < 1 || config.server.port > 65535) {
      errors.push("MCP_PORT must be between 1 and 65535");
    }
  }
```
with:
```ts
  if (config.server.transport !== "stdio") {
    if (typeof config.server.port !== "number" || isNaN(config.server.port) || config.server.port < 1 || config.server.port > 65535) {
      errors.push("MCP_PORT must be a valid number between 1 and 65535");
    }
  }
```

This is a defense-in-depth check — `parseIntSafe` should already prevent NaN, but this ensures validation catches it even if the config is constructed by other means.

**Verify**: `npm run typecheck` → exit 0

### Step 4: Add test cases for NaN handling

In `tests/unit/config.test.ts`, add test cases (model after existing tests in the file):

```ts
describe("parseIntSafe / NaN handling", () => {
  it("should fall back to default port when MCP_PORT is non-numeric", () => {
    process.env.MCP_PORT = "abc";
    const config = getConfig();
    expect(config.server.port).not.toBeNaN();
    expect(config.server.port).toBeGreaterThan(0);
    delete process.env.MCP_PORT;
  });

  it("should fall back to default timeout when FM_TIMEOUT is non-numeric", () => {
    process.env.FM_TIMEOUT = "not-a-number";
    const config = getConfig();
    expect(config.filemaker.timeout).not.toBeNaN();
    expect(config.filemaker.timeout).toBe(30000);
    delete process.env.FM_TIMEOUT;
  });

  it("should reject NaN port in validateConfig", () => {
    const result = validateConfig({
      server: { transport: "http", port: NaN, host: "localhost" },
      filemaker: { server: "x", database: "x", user: "x" },
    } as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("MCP_PORT"))).toBe(true);
  });
});
```

**Verify**: `npm test -- tests/unit/config.test.ts` → all pass, including new NaN tests

### Step 5: Full verification

**Verify**: `npm run typecheck && npm test` → all exit 0

### Step 6: Commit

```bash
git add src/config.ts tests/unit/config.test.ts
git commit -m "fix: guard parseInt against NaN in config loading

parseInt('abc', 10) returns NaN, which silently passes port
validation (NaN < 1 is false in JS). Add parseIntSafe helper
that falls back to a default, and add NaN check to
validateConfig. Add tests for non-numeric MCP_PORT and
FM_TIMEOUT env vars."
```

**Verify**: `git log --oneline -1` → shows the commit

## Test plan

- New tests in `tests/unit/config.test.ts`:
  - Non-numeric `MCP_PORT` falls back to default port
  - Non-numeric `FM_TIMEOUT` falls back to default timeout (30000)
  - `validateConfig` rejects `NaN` port with a clear error message
- Model after existing tests in `tests/unit/config.test.ts` (uses `@jest/globals`, sets/unsets `process.env` in tests).
- Verification: `npm test -- tests/unit/config.test.ts` → all pass

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `src/config.ts` has a `parseIntSafe` helper function
- [ ] `getConfig()` uses `parseIntSafe` for both port and timeout parsing
- [ ] `validateConfig()` checks for `isNaN(config.server.port)` in the port validation
- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0, including new NaN test cases
- [ ] `grep -n "parseInt(" src/config.ts` → no bare `parseInt` calls remain (only inside `parseIntSafe`)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the cited locations doesn't match the excerpts (the codebase has drifted).
- `parseIntSafe` causes a type error because the return type doesn't match the expected `number` type (it should — `isNaN` narrows to `number` in TypeScript).
- Existing config tests fail after the change (the fallback behavior may differ from what existing tests expect — report the failures).
- `src/transport.ts` also has bare `parseInt` calls that need the same fix — report them, but only fix `config.ts` in this plan (transport.ts can be a follow-up).

## Maintenance notes

- **transport.ts**: `src/transport.ts:24-26` also uses `parseInt(process.env.MCP_PORT, 10)` in `getTransportConfig()`. This is a separate code path from `getConfig()`. If `index.ts` calls `getTransportConfig()` directly (it does, at line 98), the NaN issue exists there too. A follow-up should apply `parseIntSafe` to `transport.ts` as well, or better, have `getTransportConfig()` reuse the port from `getConfig()` to avoid duplicate parsing.
- **Other env vars**: `FM_VERIFY_SSL` is parsed as a boolean (not parseInt), so it's not affected. No other numeric env vars exist currently.
- A reviewer should verify that the fallback values match the defaults: port should fall back to `DEFAULT_HTTP_PORT` (3333) or `DEFAULT_HTTPS_PORT` (3443) depending on transport type, and timeout should fall back to 30000.
