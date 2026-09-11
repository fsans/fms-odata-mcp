# Plan 006: Add authentication to HTTP/HTTPS transport

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2829524..HEAD -- src/simple-http-transport.ts .env.example`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-verification-baseline.md (needs working verification)
- **Category**: security
- **Planned at**: commit `2829524`, 2026-07-16

## Why this matters

When the MCP server runs in HTTP or HTTPS transport mode, the `/mcp` endpoint is accessible to anyone on the network with no authentication. CORS is set to `Access-Control-Allow-Origin: *`. An attacker who can reach the port can invoke any MCP tool — including `fm_odata_connect` with their own credentials, or any tool on an existing session that already has FileMaker credentials loaded. This is a significant exposure for any deployment where the HTTP transport is bound to a non-loopback address (as required for Docker, Dify, and remote MCP clients).

## Current state

**`src/simple-http-transport.ts` (lines 53-82, HTTP setup with CORS and routes):**
```ts
export async function setupSimpleHttpTransport(
  server: Server,
  config: HttpTransportConfig = {}
): Promise<void> {
  const app = express();

  // CORS support for web clients — MUST be registered BEFORE routes so that
  // preflight OPTIONS requests and CORS headers actually apply.
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }

    next();
  });

  // Body parser
  app.use(express.json());

  // Create HTTP transport instance
  const transport = new HttpTransport();

  // Connect server to transport
  await server.connect(transport);

  // Handle MCP requests
  app.post("/mcp", async (req: Request, res: Response) => {
    await transport.handleRequest(req, res, req.body);
  });

  // Health check endpoint
  app.get("/health", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      transport: "http",
      server: "fms-odata-mcp",
      version: PACKAGE_VERSION,
    });
  });
```

No authentication middleware. The `/mcp` POST route is open. The `/health` GET route is intentionally open (health checks should not require auth). The same pattern is duplicated in `setupSimpleHttpsTransport` (lines 121-163).

**`.env.example` (lines 15-25):**
```
# MCP Transport Configuration
# Options: stdio (default for local use), http, https
MCP_TRANSPORT=stdio

# HTTP/HTTPS Transport Settings (only needed if MCP_TRANSPORT is http or https)
MCP_PORT=3000
MCP_HOST=localhost
```

No `MCP_AUTH_TOKEN` or similar env var documented.

**Repo conventions:**
- TypeScript strict mode, ES Modules (Node16 — imports use `.js` extensions)
- Config from env vars with precedence: env > config file > defaults (see `src/config.ts`)
- Express middleware pattern: `app.use((req, res, next) => { ... })`
- Commit style: conventional commits (`feat:`, `fix:` — see `git log --oneline -20`)
- The `CLAUDE.md` documents: "Dify integration: configure the URL as `http://host.docker.internal:3333/mcp`"

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Typecheck | `npm run typecheck`      | exit 0 (if Plan 001 landed) or `npx tsc --noEmit` |
| Build     | `npm run build`          | exit 0              |
| Tests     | `npm test`               | all pass            |

## Scope

**In scope** (the only files you should modify):
- `src/simple-http-transport.ts` — add auth middleware to both `setupSimpleHttpTransport` and `setupSimpleHttpsTransport`
- `.env.example` — document the new `MCP_AUTH_TOKEN` env var
- `README.md` — document the auth requirement for HTTP transport
- `CLAUDE.md` — update the "Known Gotchas" section if relevant

**Out of scope** (do NOT touch):
- `src/transport.ts` — the factory; auth is handled in the transport setup, not the factory
- `src/working-http-transport.ts` — the MCP Transport implementation; auth is at the Express middleware layer, not the JSON-RPC layer
- `src/index.ts` — no changes needed (the shutdown handler is separate)
- `src/config.ts` — the auth token is read directly from `process.env` in the transport setup; no need to add it to the config interface for this plan

## Git workflow

- Branch: `advisor/006-http-transport-auth`
- Commit per logical unit; message style: conventional commits
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add auth middleware to setupSimpleHttpTransport

In `src/simple-http-transport.ts`, add an authentication middleware function that checks for a Bearer token in the `Authorization` header. The token is read from `process.env.MCP_AUTH_TOKEN`. If the env var is not set, auth is disabled (backward compatibility for existing local deployments). If it IS set, all requests to `/mcp` must include `Authorization: Bearer <token>`.

Add this middleware AFTER the CORS middleware and BEFORE the `/mcp` route in `setupSimpleHttpTransport`:

```ts
  // Authentication (optional — enabled when MCP_AUTH_TOKEN env var is set)
  const authToken = process.env.MCP_AUTH_TOKEN;
  if (authToken) {
    app.use("/mcp", (req: Request, res: Response, next: NextFunction) => {
      // Allow GET /mcp (info endpoint) without auth
      if (req.method === "GET") {
        return next();
      }
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${authToken}`) {
        res.status(401).json({
          jsonrpc: "2.0",
          error: {
            code: -32001,
            message: "Unauthorized: valid Bearer token required",
          },
        });
        return;
      }
      next();
    });
    console.error("HTTP transport authentication enabled (MCP_AUTH_TOKEN set)");
  } else {
    console.error(
      "[WARN] HTTP transport has no authentication. Set MCP_AUTH_TOKEN to secure the /mcp endpoint."
    );
  }
```

Note: you'll need to import `NextFunction` from `express` — add it to the existing `import express, { Request, Response } from "express";` line:
```ts
import express, { Request, Response, NextFunction } from "express";
```

**Verify**: `npm run typecheck` → exit 0

### Step 2: Add the same auth middleware to setupSimpleHttpsTransport

Apply the identical auth middleware block in `setupSimpleHttpsTransport`, after the CORS middleware (around line 139) and before the `/mcp` route (line 151). Use the same code as Step 1.

To avoid duplication, you may extract the auth middleware into a shared helper function at the top of the file:

```ts
/**
 * Create an Express authentication middleware that checks for a Bearer token
 * matching MCP_AUTH_TOKEN. Returns null if no token is configured (auth disabled).
 */
function createAuthMiddleware(): ((req: Request, res: Response, next: NextFunction) => void) | null {
  const authToken = process.env.MCP_AUTH_TOKEN;
  if (!authToken) {
    console.error(
      "[WARN] HTTP transport has no authentication. Set MCP_AUTH_TOKEN to secure the /mcp endpoint."
    );
    return null;
  }
  console.error("HTTP transport authentication enabled (MCP_AUTH_TOKEN set)");
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET") {
      return next();
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${authToken}`) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Unauthorized: valid Bearer token required",
        },
      });
      return;
    }
    next();
  };
}
```

Then in both `setupSimpleHttpTransport` and `setupSimpleHttpsTransport`, after the CORS middleware and body parser:

```ts
  const authMiddleware = createAuthMiddleware();
  if (authMiddleware) {
    app.use("/mcp", authMiddleware);
  }
```

**Verify**: `npm run typecheck` → exit 0

### Step 3: Document MCP_AUTH_TOKEN in .env.example

Add to `.env.example` after the HTTP/HTTPS transport settings section (after line 21):

```
# HTTP/HTTPS Authentication (recommended for non-localhost deployments)
# Set to a random secret string. When set, requests to /mcp must include
# Authorization: Bearer <token>. When unset, the endpoint is open (not recommended).
# Generate one with: openssl rand -hex 32
# MCP_AUTH_TOKEN=
```

**Verify**: Read `.env.example` and confirm the `MCP_AUTH_TOKEN` documentation is present.

### Step 4: Update README.md with auth documentation

Add a section to `README.md` in the HTTP transport configuration area documenting the `MCP_AUTH_TOKEN` env var. Include:
- What it does (requires Bearer token for `/mcp` POST requests)
- How to generate a token (`openssl rand -hex 32`)
- That it's optional but strongly recommended for non-localhost deployments
- That `/health` remains open (no auth required for health checks)
- How to configure the MCP client to send the token (e.g., in the `Authorization` header)

**Verify**: `grep -n "MCP_AUTH_TOKEN" README.md` → shows the documentation section

### Step 5: Build, typecheck, and test

**Verify**: `npm run typecheck && npm run build && npm test` → all exit 0

### Step 6: Commit

```bash
git add src/simple-http-transport.ts .env.example README.md
git commit -m "feat(security): add optional Bearer token auth for HTTP transport

When MCP_AUTH_TOKEN env var is set, POST requests to /mcp must
include 'Authorization: Bearer <token>'. GET /health and GET /mcp
(info) remain open. When unset, a warning is logged. This protects
non-localhost HTTP transport deployments from unauthorized tool
invocation."
```

**Verify**: `git log --oneline -1` → shows the commit

## Test plan

- Write a new test file `tests/unit/http-transport-auth.test.ts` that tests the `createAuthMiddleware` function:
  - When `MCP_AUTH_TOKEN` is not set: `createAuthMiddleware()` returns `null`
  - When `MCP_AUTH_TOKEN` is set: returns a middleware function
  - Middleware allows GET requests without auth header
  - Middleware rejects POST requests without auth header (401)
  - Middleware rejects POST requests with wrong token (401)
  - Middleware allows POST requests with correct `Authorization: Bearer <token>` header
- Model after `tests/unit/tool-routing.test.ts` for structure (describe/it/expect from `@jest/globals`).
- If `createAuthMiddleware` is not exported, export it from `simple-http-transport.ts` for testability.
- Verification: `npm test -- tests/unit/http-transport-auth.test.ts` → all pass

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0 (including new auth tests)
- [ ] `src/simple-http-transport.ts` has auth middleware that checks `MCP_AUTH_TOKEN` env var
- [ ] Both `setupSimpleHttpTransport` and `setupSimpleHttpsTransport` apply the auth middleware
- [ ] `/health` endpoint remains accessible without auth
- [ ] `.env.example` documents `MCP_AUTH_TOKEN`
- [ ] `README.md` documents the auth feature
- [ ] `grep -n "MCP_AUTH_TOKEN" .env.example README.md` returns matches in both files
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the cited locations doesn't match the excerpts (the codebase has drifted).
- Adding `NextFunction` to the express import causes a type error (express version may not export it — unlikely, but report if so).
- The auth middleware breaks existing MCP client compatibility in a way that can't be resolved with the Bearer token approach (e.g., a client doesn't support custom headers — report which client and what constraint it imposes).
- Tests for `createAuthMiddleware` fail because the function can't be exported without breaking the module structure (report the issue).

## Maintenance notes

- **Backward compatibility**: When `MCP_AUTH_TOKEN` is not set, behavior is unchanged — the endpoint is open. This is intentional to avoid breaking existing local deployments, but a warning is logged. A future major version could make auth required by default.
- **Dify integration**: Dify's MCP client needs to send the `Authorization: Bearer <token>` header. Check Dify's MCP configuration documentation for how to set custom headers. If Dify doesn't support custom headers, this plan may need an alternative auth mechanism (e.g., token in URL path or query param — less secure but compatible).
- **Token rotation**: The token is read at startup from `process.env`. Changing it requires a server restart. If hot-reload is needed in the future, the middleware would need to read the env var per-request (slight performance cost).
- **CORS interaction**: The CORS middleware allows `Authorization` in `Access-Control-Allow-Headers` (line 60/131), so authenticated cross-origin requests will work. However, `Access-Control-Allow-Origin: *` with credentials is insecure. If auth is enabled, consider restricting CORS to specific origins via an env var (future improvement).
- A reviewer should verify that the 401 response uses the JSON-RPC error format (so MCP clients can parse it) and that the `GET /mcp` info endpoint is intentionally left open (it only returns server metadata, no sensitive data).
