# Plan 015: Design spike — OAuth/Bearer token authentication for FileMaker

> **Executor instructions**: This is a **design/spike plan**, not a
> build-everything plan. Your goal is to investigate, prototype, define the
> API, and list open questions — not to ship a production feature. Follow
> this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in the "STOP
> conditions" section occurs, stop and report — do not improvise. When done,
> update the status row for this plan in `plans/README.md` — unless a
> reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2829524..HEAD -- src/odata-client.ts src/tools/connection.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW (spike — no production changes)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `2829524`, 2026-07-16

## Why this matters

The OData client uses HTTP Basic Authentication exclusively (`src/odata-client.ts:79-89`). Basic Auth sends credentials with every request and requires the MCP server to store the password. Enterprise FileMaker deployments increasingly use OAuth 2.0 or token-based authentication for security compliance. The `dev_stuf/ROADMAP.md` (if not yet deleted by Plan 010) listed OAuth 2.0 as a potential feature. This spike investigates what authentication methods FileMaker Server's OData API supports beyond Basic Auth, defines a phased approach (starting with the simplest: pre-existing Bearer token), and lists open questions.

## Current state

**`src/odata-client.ts` (lines 65-89, axios setup with Basic Auth):**
```ts
    this.axiosInstance = axios.create({
      timeout: config.timeout || 30000,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySsl !== false,
      }),
    });

    // Add request interceptor for Basic Auth
    this.axiosInstance.interceptors.request.use(
      (config) => {
        config.headers.Authorization = this.getAuthHeader();
        return config;
      },
      (error) => {
        logger.error("Request interceptor error:", error);
        return Promise.reject(error);
      }
    );
```

**`src/odata-client.ts` (lines 104-109, getAuthHeader):**
```ts
  private getAuthHeader(): string {
    const credentials = Buffer.from(
      `${this.config.user}:${this.config.password}`
    ).toString("base64");
    return `Basic ${credentials}`;
  }
```

**`src/odata-client.ts` (lines 6-13, ODataClientConfig):**
```ts
export interface ODataClientConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  timeout?: number;
  verifySsl?: boolean;
}
```

No `authType`, `token`, or `bearerToken` field. Basic Auth is hardcoded.

**`src/tools/connection.ts` (lines 10-38, fm_odata_connect tool):**
```ts
  {
    name: "fm_odata_connect",
    description: "Connect to FileMaker Server with inline credentials (temporary connection, not saved)",
    inputSchema: {
      type: "object",
      properties: {
        server: { type: "string", ... },
        database: { type: "string", ... },
        user: { type: "string", ... },
        password: { type: "string", ... },
        verifySsl: { type: "boolean", ... },
      },
      required: ["server", "database", "user", "password"],
    },
  },
```

`user` and `password` are required fields. No token-based alternative.

**`src/config.ts` (lines 33-40, Connection interface):**
```ts
export interface Connection {
  name?: string;
  server: string;
  database: string;
  user: string;
  password: string;
  verifySsl?: boolean;
}
```

**Repo conventions:**
- Config from env vars with precedence: env > config file > defaults
- `ODataClientConfig` is the interface passed to `ODataClient` constructor
- `Connection` is the persisted config format
- Commit style: conventional commits

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Build     | `npm run build`          | exit 0              |
| Tests     | `npm test`               | all pass            |

## Scope

**In scope** (files you should create or modify):
- `plans/015-oauth-auth-findings.md` — create this file with investigation findings, proposed API, and open questions
- `src/odata-client.ts` — you MAY prototype an alternative auth header method for investigation, but do NOT change the production Basic Auth flow

**Out of scope** (do NOT touch):
- `src/tools/connection.ts` — do NOT modify the `fm_odata_connect` tool in this spike
- `src/tools/configuration.ts` — no changes
- `src/config.ts` — no changes to the `Connection` interface
- `src/tools/odata.ts` — no changes

## Git workflow

- Branch: `advisor/015-oauth-spike`
- Commit per logical unit; message style: conventional commits
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Investigate FileMaker OData authentication options

Research what authentication methods FileMaker Server's OData 4.01 API supports:

1. Check Claris/FileMaker OData documentation for authentication methods:
   - Search the web for "FileMaker OData authentication" or "FileMaker Server OData OAuth"
   - Check `https://help.claris.com/en/odata-api-guide/` or similar official docs
2. Determine if FileMaker OData supports:
   - **Basic Auth** (confirmed — currently used)
   - **Bearer token** (OAuth 2.0 access token in `Authorization: Bearer <token>`)
   - **API key** (custom header like `X-API-Key: <key>`)
   - **OAuth 2.0 client credentials flow** (server-to-server, no user interaction)
   - **FileMaker Data API token** (the FileMaker Data API has its own token-based auth — does OData share this?)
3. Check if FileMaker Server supports external authentication (AD/LDAP/OAuth) that could be used with OData

Document findings in `plans/015-oauth-auth-findings.md`:
- What auth methods does FileMaker OData support?
- Is there a token-based auth that doesn't require sending the password with every request?
- Does FileMaker's OData API share authentication with the FileMaker Data API (which has a `/auth` endpoint for token exchange)?

**Verify**: `plans/015-oauth-auth-findings.md` exists with a "FileMaker OData Authentication Options" section.

### Step 2: Define a phased approach

In `plans/015-oauth-auth-findings.md`, document a phased approach from simplest to most complex:

**Phase 1: Pre-existing Bearer token (simplest)**
- Add an `authType` field to `ODataClientConfig`: `"basic" | "bearer"`
- When `authType === "bearer"`, use `Authorization: Bearer <token>` instead of Basic Auth
- The token is supplied by the user (via env var `FM_AUTH_TOKEN` or tool arg)
- No token refresh, no OAuth flow — the user is responsible for obtaining and refreshing the token
- This supports FileMaker deployments that use a reverse proxy or identity provider (e.g., OAuth2 proxy, Authelia) that issues Bearer tokens

**Phase 2: FileMaker Data API token exchange (if supported)**
- If FileMaker OData accepts tokens from the FileMaker Data API `/auth` endpoint:
  - Add `fm_odata_connect_token` tool that exchanges username/password for a token
  - Store the token with expiry, auto-refresh when expired
  - Use Bearer auth for subsequent OData requests
- This eliminates sending the password with every request

**Phase 3: Full OAuth 2.0 client credentials flow (most complex)**
- Add `FM_OAUTH_CLIENT_ID`, `FM_OAUTH_CLIENT_SECRET`, `FM_OAUTH_TOKEN_URL` env vars
- Implement token exchange and refresh automatically
- Most enterprise-ready but most complex

Recommend Phase 1 as the immediate next step (lowest effort, immediate value), with Phase 2/3 as future enhancements based on maintainer and user demand.

**Verify**: `plans/015-oauth-auth-findings.md` has a "Phased Approach" section with all three phases.

### Step 3: Define the proposed API changes for Phase 1

In `plans/015-oauth-auth-findings.md`, define the API changes for the recommended Phase 1:

**`ODataClientConfig` interface change:**
```ts
export interface ODataClientConfig {
  server: string;
  database: string;
  user: string;        // required for basic, ignored for bearer
  password: string;    // required for basic, ignored for bearer
  authType?: "basic" | "bearer";  // default: "basic"
  bearerToken?: string;           // required when authType === "bearer"
  timeout?: number;
  verifySsl?: boolean;
}
```

**`getAuthHeader` method change:**
```ts
private getAuthHeader(): string {
  if (this.config.authType === "bearer" && this.config.bearerToken) {
    return `Bearer ${this.config.bearerToken}`;
  }
  const credentials = Buffer.from(
    `${this.config.user}:${this.config.password}`
  ).toString("base64");
  return `Basic ${credentials}`;
}
```

**`fm_odata_connect` tool schema change:**
```ts
{
  name: "fm_odata_connect",
  inputSchema: {
    type: "object",
    properties: {
      server: { type: "string", ... },
      database: { type: "string", ... },
      user: { type: "string", ... },         // make optional when authType=bearer
      password: { type: "string", ... },     // make optional when authType=bearer
      authType: {
        type: "string",
        enum: ["basic", "bearer"],
        description: "Authentication method (default: basic)",
      },
      bearerToken: {
        type: "string",
        description: "Bearer token for token-based auth (required when authType=bearer)",
      },
      verifySsl: { type: "boolean", ... },
    },
    required: ["server", "database"],  // user/password no longer always required
  },
}
```

**New env var:**
```
FM_AUTH_TYPE=basic    # or "bearer"
FM_BEARER_TOKEN=      # Bearer token (when FM_AUTH_TYPE=bearer)
```

Document the backward compatibility: when `authType` is not specified, behavior is unchanged (Basic Auth with user/password). This is a non-breaking change.

**Verify**: `plans/015-oauth-auth-findings.md` has a "Proposed API (Phase 1)" section with all the above.

### Step 4: List open questions

In `plans/015-oauth-auth-findings.md`, list open questions:

1. Does FileMaker Server's OData API accept Bearer tokens from external identity providers (e.g., Keycloak, Auth0, Azure AD)?
2. Does FileMaker's OData API share tokens with the FileMaker Data API `/auth` endpoint?
3. Is there a token expiry/refresh mechanism in FileMaker OData, or do tokens expire and require re-authentication?
4. Should the `fm_odata_connect_multi` tool also support `authType=bearer`?
5. Should bearer tokens be persisted in the config file (`~/.fms-odata-mcp/config.json`)? (Security trade-off: convenience vs. token leakage)
6. Should there be a `fm_odata_refresh_token` tool for Phase 2/3?
7. What happens when a Bearer token expires mid-session? (401 error — should the client auto-refresh or surface the error to the AI agent?)

**Verify**: `plans/015-oauth-auth-findings.md` has an "Open Questions" section with ≥5 questions.

### Step 5: Commit the findings

```bash
git add plans/015-oauth-auth-findings.md
git commit -m "docs: OAuth/Bearer auth design spike — findings and proposed API

Investigate FileMaker OData authentication options beyond
Basic Auth, define a phased approach (Bearer token → Data API
token exchange → full OAuth 2.0), propose Phase 1 API changes
for pre-existing Bearer token support, and list open questions."
```

**Verify**: `git log --oneline -1` → shows the commit

## Test plan

- No production tests required for a spike.
- Verification: `npm run build && npm test` → all pass (no production code changed)

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `plans/015-oauth-auth-findings.md` exists with sections: "FileMaker OData Authentication Options", "Phased Approach", "Proposed API (Phase 1)", "Open Questions"
- [ ] The findings document answers what auth methods FileMaker OData supports (or documents that it could not be determined)
- [ ] The phased approach defines at least 3 phases from simplest to most complex
- [ ] The Phase 1 proposed API includes `ODataClientConfig` changes, `getAuthHeader` changes, and `fm_odata_connect` tool schema changes
- [ ] At least 5 open questions are listed
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] No production MCP tools or source code were modified (this is a spike)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- You cannot determine FileMaker's authentication options from available documentation — document this as an open question and proceed with the Phase 1 approach (pre-existing Bearer token) as the recommended path, since it works with any reverse proxy / identity provider setup regardless of FileMaker's native support.
- The proposed API changes would break backward compatibility with existing `fm_odata_connect` usage — report the conflict and propose a migration path.
- FileMaker OData only supports Basic Auth and has no token-based alternative — document this and recommend that the project instead focus on Plan 006 (securing the HTTP transport) rather than changing the OData auth method.

## Maintenance notes

- **This is a spike.** The output is a findings document for the maintainer. After the open questions are answered, a build plan should implement Phase 1.
- **Backward compatibility is critical**: Any auth changes must default to Basic Auth when `authType` is not specified. Existing users who pass `user`/`password` to `fm_odata_connect` must not be affected.
- **Security**: Bearer tokens are as sensitive as passwords. If tokens are persisted in the config file, the same `chmod 0o600` protection applies. Consider whether tokens should be persisted at all (they expire, unlike passwords).
- **Plan 006 interaction**: Plan 006 adds Bearer token auth for the HTTP *transport* (MCP client → MCP server). This spike is about the OData *client* auth (MCP server → FileMaker Server). They are independent — the transport auth protects who can call MCP tools; the OData auth protects how the MCP server authenticates to FileMaker.
- A reviewer should check that the findings document distinguishes between transport auth (Plan 006) and OData auth (this spike) to avoid confusion.
