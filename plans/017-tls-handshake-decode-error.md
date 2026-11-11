# Plan 017: Fix OpenSSL 3.5+ TLS handshake `decode_error` (SSL alert 50) against FileMaker Server

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3705083..HEAD -- src/odata-client.ts tests/unit/odata-client.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-verification-baseline.md
- **Category**: bug
- **Planned at**: commit `3705083`, 2026-11-06

## Why this matters

On macOS (and Linux distributions) where Node.js 24+ is linked against **OpenSSL 3.5+** (for example, Homebrew `node` on macOS), every HTTPS connection from `ODataClient` to FileMaker Server (verified against FileMaker Server 26.0.2) fails during the TLS handshake with:

```text
write EPROTO ...:error:0A00041A:SSL routines:ssl3_read_bytes:tlsv1 alert decode error:ssl/record/rec_layer_s3.c:910:SSL alert number 50
```

### Root cause

1. **OpenSSL 3.5+ TLS 1.3 `ClientHello` incompatibility with FileMaker Server**:
   OpenSSL 3.5 enables hybrid post-quantum key exchange (`X25519MLKEM768`) by default in TLS 1.3 `ClientHello` messages. FileMaker Server's bundled Apache/`mod_ssl` TLS stack cannot decode this `ClientHello` and immediately aborts the handshake with `SSL alert number 50 (decode_error)`.
2. **Why `OPENSSL_CONF` alone does not fix it**:
   Node's `tls.createSecureContext()` explicitly calls `SSL_CTX_set1_curves_list(ctx, tls.DEFAULT_ECDH_CURVE)` (`'auto'`) *after* `SSL_CTX_new()`, overwriting any `Groups` directive set in `openssl.cnf`.
3. **Verified workaround**:
   Starting Node with `NODE_OPTIONS=--tls-max-v1.2` (or configuring the `https.Agent` in `ODataClient` with classical ECDH curves `ecdhCurve: "X25519:P-256:P-384"` and `maxVersion: "TLSv1.2"`) immediately resolves the handshake failure.
4. **Silent error swallowing in `ODataClient.handleError()`**:
   When a low-level TLS/socket error (`EPROTO`, `ECONNREFUSED`, `ETIMEDOUT`, `UNABLE_TO_VERIFY_LEAF_SIGNATURE`) occurs before an HTTP response is received, `error.request` is truthy and `handleError()` returns a generic `new Error("No response from server - connection failed")`, discarding `error.message` / `error.code`. The MCP user only sees `"No response from server - connection failed"` unless they inspect raw `stderr` logs.

## Current state

**`src/odata-client.ts` (lines 144-156, `https.Agent` construction):**
```ts
    this.axiosInstance = axios.create({
      timeout: config.timeout || 30000,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      // Configure SSL certificate verification
      // verifySsl defaults to true for production security
      // Set to false for self-signed certificates (development/local networks)
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySsl !== false, // true by default
      }),
    });
```

**`src/odata-client.ts` (lines 200-216, `handleError`):**
```ts
  private handleError(error: any): Error {
    if (error.response) {
      const odataError = error.response.data as ODataError;
      if (odataError?.error) {
        return new Error(
          `OData Error [${odataError.error.code}]: ${odataError.error.message}`
        );
      }
      return new Error(
        `HTTP ${error.response.status}: ${error.response.statusText}`
      );
    }
    if (error.request) {
      return new Error("No response from server - connection failed");
    }
    return error;
  }
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Build     | `npm run build`          | exit 0              |
| Tests     | `npm test`               | all pass            |

## Scope

**In scope** (the only files you should modify):
- `src/odata-client.ts` — configure `https.Agent` to avoid the OpenSSL 3.5+ TLS `decode_error` against FileMaker Server, and surface the underlying socket/TLS reason in `handleError()`
- `tests/unit/odata-client.test.ts` — update/add unit tests for `httpsAgent` options and `handleError()`

**Out of scope** (do NOT touch):
- `src/transport.ts`, `src/simple-http-transport.ts` — inbound MCP HTTP transport is unaffected
- `src/tools/*` — tool definitions and handlers need no changes

## Git workflow

- Branch: `advisor/017-tls-handshake-decode-error`
- Commit per logical unit; message style: conventional commits
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Configure `https.Agent` in `src/odata-client.ts`

In `src/odata-client.ts` (around lines 150-156), configure `https.Agent` with:
- `ecdhCurve: "X25519:P-256:P-384"` — prevents OpenSSL 3.5+ from advertising post-quantum hybrid key shares (`X25519MLKEM768`) that FileMaker Server's Apache `mod_ssl` rejects with `SSL alert number 50 (decode_error)`.
- `maxVersion: (process.env.FM_TLS_MAX_VERSION as "TLSv1.3" | "TLSv1.2") || "TLSv1.2"` — defaults to `TLSv1.2` (verified working against FileMaker Server 26.0.2 with Homebrew Node + OpenSSL 3.5+) while allowing override via `FM_TLS_MAX_VERSION=TLSv1.3`.

```ts
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySsl !== false, // true by default
        ecdhCurve: "X25519:P-256:P-384",
        maxVersion:
          process.env.FM_TLS_MAX_VERSION === "TLSv1.3" ? "TLSv1.3" : "TLSv1.2",
      }),
```

*(Note: before finalizing whether `maxVersion: "TLSv1.2"` is needed in addition to `ecdhCurve: "X25519:P-256:P-384"`, test whether `ecdhCurve: "X25519:P-256:P-384"` alone is sufficient with TLS 1.3 on OpenSSL 3.5+ against FileMaker Server. If `ecdhCurve` alone resolves alert 50, `maxVersion` can remain `"TLSv1.3"` by default and only cap at `"TLSv1.2"` when `FM_TLS_MAX_VERSION=TLSv1.2` is set.)*

**Verify**: `npx tsc --noEmit` → exit 0

### Step 2: Preserve underlying TLS/network error details in `handleError()`

In `src/odata-client.ts` (around lines 212-214), include `error.message` (if present) when `error.request` is set so TLS handshake errors (`write EPROTO ... SSL alert number 50`) and connection errors (`ECONNREFUSED`) are visible in MCP tool outputs:

```ts
    if (error.request) {
      const detail = error.message ? ` (${error.message})` : "";
      return new Error(`No response from server - connection failed${detail}`);
    }
```

Check existing unit tests in `tests/unit/odata-client.test.ts` that match `"No response from server - connection failed"` — since they use `.toThrow('No response from server - connection failed')` (substring match), preserving the prefix keeps existing tests passing while surfacing the root cause.

**Verify**: `npx tsc --noEmit && npm test` → all pass

### Step 3: Add unit tests in `tests/unit/odata-client.test.ts`

In `tests/unit/odata-client.test.ts` under `describe('Constructor', ...)`:

```ts
    test('should configure httpsAgent with classical ECDH curves for OpenSSL 3.5+ compatibility', () => {
      const createCall = (mockedAxios.create as jest.Mock).mock.calls[0][0] as any;
      expect(createCall.httpsAgent).toBeDefined();
      expect(createCall.httpsAgent.options.ecdhCurve).toBe('X25519:P-256:P-384');
    });
```

And under error handling tests, verify that when `error.request` is present alongside `error.message` (e.g. `write EPROTO`), the thrown error includes both `"No response from server - connection failed"` and the underlying message.

**Verify**: `npm test` → all pass

### Step 4: Full verification and commit

**Verify**: `npx tsc --noEmit && npm run build && npm test` → all exit 0

```bash
git add src/odata-client.ts tests/unit/odata-client.test.ts
git commit -m "fix(tls): prevent OpenSSL 3.5+ TLS alert 50 decode_error against FileMaker Server

OpenSSL 3.5+ (used by Homebrew Node 24+ on macOS) sends hybrid
post-quantum key shares (X25519MLKEM768) in TLS 1.3 ClientHello
messages by default. FileMaker Server's Apache/mod_ssl rejects the
handshake with SSL alert number 50 (decode_error).

Configure https.Agent with classical ECDH curves (X25519:P-256:P-384)
and TLS version control, and include the underlying socket/TLS error
message when handleError() reports a failed connection."
```

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `src/odata-client.ts` passes `ecdhCurve: "X25519:P-256:P-384"` (and `maxVersion` support) to `new https.Agent(...)`
- [ ] `src/odata-client.ts` `handleError()` preserves `error.message` when `error.request` is truthy
- [ ] `tests/unit/odata-client.test.ts` asserts `httpsAgent.options.ecdhCurve` is configured
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the cited locations in `src/odata-client.ts` does not match the excerpts.
- An existing test fails because it asserts an exact string equality (`=== "No response from server - connection failed"`) rather than substring matching.
