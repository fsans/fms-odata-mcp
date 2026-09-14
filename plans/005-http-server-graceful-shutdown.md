# Plan 005: Store HTTP server handles for graceful shutdown

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2829524..HEAD -- src/simple-http-transport.ts src/index.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-verification-baseline.md (needs working `npm test` and `npm run typecheck`)
- **Category**: bug
- **Planned at**: commit `2829524`, 2026-07-16

## Why this matters

When the MCP server runs in HTTP or HTTPS transport mode, the Express HTTP server is created with `.listen()` but the server handle is never stored. On shutdown (SIGINT/SIGTERM), `index.ts:50` calls `this.server.close()` which closes the MCP protocol server but NOT the underlying HTTP listener. The port remains bound, causing "address already in use" errors on restart and preventing clean process termination in Docker containers.

## Current state

**`src/simple-http-transport.ts` (lines 106-115, HTTP setup):**
```ts
  const port = config.port || DEFAULT_HTTP_PORT;
  const host = config.host || "localhost";
  warnIfDockerLocalhost(host);

  http.createServer(app).listen(port, host, () => {
    console.error(`FMS-ODATA-MCP Server running on http://${host}:${port}`);
    console.error(`MCP endpoint: http://${host}:${port}/mcp`);
    console.error(`Health check: http://${host}:${port}/health`);
    console.error(`Transport: HTTP (JSON-RPC 2.0)`);
  });
```

The `http.createServer(app).listen(...)` return value (the `http.Server` instance) is not stored anywhere. Same pattern at lines 184-193 for HTTPS:

```ts
  const port = config.port || DEFAULT_HTTPS_PORT;
  const host = config.host || "localhost";
  warnIfDockerLocalhost(host);
  
  https.createServer({ cert, key }, app).listen(port, host, () => {
    console.error(`FMS-ODATA-MCP Server running on https://${host}:${port}`);
    console.error(`MCP endpoint: https://${host}:${port}/mcp`);
    console.error(`Health check: https://${host}:${port}/health`);
    console.error(`Transport: HTTPS (JSON-RPC 2.0)`);
  });
```

**`src/index.ts` (lines 42-57, shutdown handler):**
```ts
  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      logger.error("[MCP Error]", error);
    };

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down server...`);
      try {
        await this.server.close();
      } finally {
        process.exit(0);
      }
    };
    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  }
```

`this.server.close()` closes the MCP `Server` instance (from `@modelcontextprotocol/sdk`), not the HTTP listener.

**`src/transport.ts` (lines 52-69, setupTransport):**
```ts
export async function setupTransport(
  server: Server,
  config: TransportConfig
): Promise<void> {
  switch (config.type) {
    case "stdio":
      await setupStdioTransport(server);
      break;
    case "http":
      await setupSimpleHttpTransport(server, config);
      break;
    case "https":
      await setupSimpleHttpsTransport(server, config);
      break;
    default:
      throw new Error(`Unknown transport type: ${config.type}`);
  }
}
```

`setupTransport` returns `void` — there's no way to get the HTTP server handle back to the caller.

**Repo conventions:**
- TypeScript strict mode, ES Modules (Node16 — imports use `.js` extensions)
- Error handling: the shutdown handler uses try/finally with `process.exit(0)`
- Logger: `import { logger } from "./logger.js"` — use `logger.info()` for shutdown messages
- Commit style: conventional commits (`fix:`, `feat:` — see `git log --oneline -20`)

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Typecheck | `npm run typecheck`      | exit 0 (if Plan 001 landed) or `npx tsc --noEmit` |
| Build     | `npm run build`          | exit 0              |
| Tests     | `npm test`               | all pass            |

## Scope

**In scope** (the only files you should modify):
- `src/simple-http-transport.ts` — store server handles, export a cleanup function
- `src/transport.ts` — propagate the cleanup function (or store handle for return)
- `src/index.ts` — call HTTP server cleanup in the shutdown handler

**Out of scope** (do NOT touch):
- `src/working-http-transport.ts` — the MCP Transport implementation; not involved in HTTP listener lifecycle
- `src/http-server.ts` — dead code (Plan 009 removes it); don't fix it here
- `src/odata-client.ts`, `src/tools/` — no changes to business logic
- `tests/` — no new tests required for this small fix (but if Plan 011 has landed, transport tests would cover this)

## Git workflow

- Branch: `advisor/005-http-server-shutdown`
- Commit per logical unit; message style: conventional commits
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Store the HTTP server handle in simple-http-transport.ts

In `src/simple-http-transport.ts`, store the `http.Server` and `https.Server` instances in module-level variables so they can be closed on shutdown.

Add at the top of the file (after the imports, before the interface):

```ts
let httpServer: http.Server | https.Server | null = null;
```

In `setupSimpleHttpTransport` (around line 110), change:
```ts
  http.createServer(app).listen(port, host, () => {
```
to:
```ts
  httpServer = http.createServer(app);
  httpServer.listen(port, host, () => {
```

In `setupSimpleHttpsTransport` (around line 188), change:
```ts
  https.createServer({ cert, key }, app).listen(port, host, () => {
```
to:
```ts
  httpServer = https.createServer({ cert, key }, app);
  httpServer.listen(port, host, () => {
```

**Verify**: `npm run typecheck` (or `npx tsc --noEmit`) → exit 0, no type errors

### Step 2: Export a cleanup function from simple-http-transport.ts

Add an exported function at the end of the file:

```ts
/**
 * Close the HTTP/HTTPS server listener if one is active.
 * Called during graceful shutdown to release the bound port.
 */
export async function closeHttpServer(): Promise<void> {
  if (httpServer) {
    await new Promise<void>((resolve) => {
      httpServer!.close(() => resolve());
    });
    httpServer = null;
    logger.info("HTTP server closed");
  }
}
```

Note: you'll need to add `import { logger } from "./logger.js";` at the top of the file if it's not already imported. Check the existing imports first — the file currently imports from `@modelcontextprotocol/sdk`, `./working-http-transport.js`, `./version.js`, `./config.js`, `express`, `https`, `http`, `fs`. Add the logger import.

**Verify**: `npm run typecheck` → exit 0

### Step 3: Call closeHttpServer in the index.ts shutdown handler

In `src/index.ts`, add an import at the top:

```ts
import { closeHttpServer } from "./simple-http-transport.js";
```

Then update the shutdown handler (lines 47-53) from:
```ts
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down server...`);
      try {
        await this.server.close();
      } finally {
        process.exit(0);
      }
    };
```
to:
```ts
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down server...`);
      try {
        await this.server.close();
        await closeHttpServer();
      } finally {
        process.exit(0);
      }
    };
```

**Verify**: `npm run typecheck` → exit 0

### Step 4: Build and run tests

**Verify**: `npm run build && npm test` → all exit 0

### Step 5: Commit

```bash
git add src/simple-http-transport.ts src/index.ts
git commit -m "fix: close HTTP server listener on graceful shutdown

The Express HTTP/HTTPS server handle was not stored, so
SIGINT/SIGTERM only closed the MCP protocol server, leaving
the port bound. Store the handle and close it in the shutdown
handler to prevent 'address already in use' on restart."
```

**Verify**: `git log --oneline -1` → shows the commit

## Test plan

- No new tests required for this small fix. The change is structural (storing a handle and calling `.close()` on shutdown) and is best verified manually:
  1. Start the server in HTTP mode: `MCP_TRANSPORT=http MCP_PORT=3333 npm start`
  2. Send SIGINT (Ctrl+C)
  3. Confirm the process exits cleanly and the port is released (run `lsof -i :3333` — should show no listener)
- If Plan 011 (critical path tests) has landed, add a test that verifies `closeHttpServer()` is callable and is a no-op when no server is active.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] `src/simple-http-transport.ts` stores the `http.Server`/`https.Server` handle in a module-level variable
- [ ] `src/simple-http-transport.ts` exports a `closeHttpServer()` function
- [ ] `src/index.ts` shutdown handler calls `await closeHttpServer()` after `await this.server.close()`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the cited locations doesn't match the excerpts (the codebase has drifted).
- `closeHttpServer()` import causes a circular dependency error in `index.ts` (it shouldn't — `simple-http-transport.ts` doesn't import from `index.ts` — but if it does, STOP and report).
- The `http.Server.close()` callback API has changed in the Node.js version being used (unlikely, but if `close()` doesn't accept a callback, report the Node version and the error).

## Maintenance notes

- The `closeHttpServer()` function is a no-op when running in stdio mode (no HTTP server is created). This is intentional — the shutdown handler calls it unconditionally, and it safely does nothing.
- If a future plan adds WebSocket or SSE transport, the same pattern should be followed: store the server handle and close it in `closeHttpServer()` (or a renamed `closeTransportServer()`).
- The `process.exit(0)` in the `finally` block is aggressive — it doesn't wait for in-flight HTTP requests to complete. If graceful drain becomes important, use `httpServer.close()` which stops accepting new connections but waits for active ones to finish. The current behavior is acceptable for an MCP server.
- A reviewer should verify that the `httpServer` variable is correctly reset to `null` after close, so a second shutdown signal doesn't call `.close()` on an already-closed server.
