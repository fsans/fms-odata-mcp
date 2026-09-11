# Plan 015 Findings: OAuth/Bearer Token Authentication for FileMaker

> **Spike output** — investigation, proposed API, and open questions.
> Not a production implementation. The maintainer should review this before
> a build plan is written.

## FileMaker OData Authentication Options

FileMaker's OData API supports **multiple authentication methods** depending
on the deployment type (on-premise Server vs. Cloud) and server version.

### Summary of supported auth methods

| Method | FileMaker Server (on-prem) | FileMaker Cloud | Header format |
|--------|---------------------------|-----------------|---------------|
| **HTTP Basic Auth** | Yes (primary) | No | `Authorization: Basic <base64>` |
| **OAuth Bearer token** | Yes (v21.1+ / 2024+) | Yes (primary) | `Authorization: Bearer <token>` |
| **Claris ID token** | Yes (Cloud-connected) | Yes | `Authorization: FMID <claris_id_token>` |
| **OAuth identity provider** | Yes (v21.1+) | Yes | `X-FM-Data-OAuth-Request-Id` + `X-FM-Data-OAuth-Identifier` headers |
| **FileMaker Data API token** | **No** — Data API tokens do NOT work with OData | No | N/A |
| **API key (custom header)** | No | No | N/A |

### Key findings

1. **Basic Auth** is the primary method for on-premise FileMaker Server.
   Credentials (account:password) are sent with every request as a base64
   string. Stateless — no token expiry.

2. **OAuth Bearer token** is the primary method for FileMaker Cloud and is
   available on FileMaker Server 2024 (v21.1+) onward. The token is obtained
   from an OAuth identity provider (Google, Microsoft, Amazon, etc.) or from
   Claris ID. Tokens expire after **1 hour** — the client is responsible for
   re-authenticating.

3. **Claris ID token** (`Authorization: FMID <token>`) is used for FileMaker
   Cloud. The token is obtained from Claris ID authentication. Also expires
   after 1 hour.

4. **FileMaker Data API tokens are NOT compatible with OData.** The Data API
   (`/fmi/data/v1/`) has its own `/auth` endpoint for token exchange, but
   that token does NOT work with the OData API (`/fmi/odata/v4/`). This is a
   critical distinction — the two APIs have independent auth systems.

5. **OAuth identity provider login** uses a multi-step flow:
   - Get a tracking ID via `/oauth/getoauthurl`
   - User authenticates with the OAuth provider
   - The resulting identifier is used in subsequent OData requests via
     `X-FM-Data-OAuth-Request-Id` and `X-FM-Data-OAuth-Identifier` headers

6. **HTTPS is required** for all auth methods (Basic and Bearer).

### Sources

- Official Claris docs:
  - https://help.claris.com/en/odata-guide/content/creating-authenticated-connection.html
  - https://help.claris.com/en/odata-guide/content/log-in-database-session-oauth-odata.html
- Community spec: https://github.com/fsans/fms-odata-spec/blob/main/docs/04-authentication.md
- Quirks: https://github.com/fsans/fms-odata-spec/blob/main/docs/13-quirks.md

## Phased Approach

### Phase 1: Pre-existing Bearer token (simplest — recommended immediate next step)

Add support for a user-supplied Bearer token. The user obtains the token
from their identity provider (Claris ID, OAuth provider, or a reverse
proxy like Authelia/oauth2-proxy) and passes it to the MCP server.

- **Effort**: Low — add `authType` and `bearerToken` fields, modify
  `getAuthHeader()`
- **Value**: Immediate — supports FileMaker Cloud and any deployment using
  a token-issuing reverse proxy
- **No token refresh**: The user is responsible for obtaining and refreshing
  the token. When it expires, OData requests fail with 401, and the AI agent
  surfaces the error.
- **Backward compatible**: When `authType` is not specified, behavior is
  unchanged (Basic Auth with user/password).

### Phase 2: Claris ID token exchange (medium effort)

If the maintainer has FileMaker Cloud access, implement automatic Claris ID
token exchange:

- Add `fm_odata_connect_claris_id` tool that exchanges Claris ID credentials
  for a session token
- Store the token with its 1-hour expiry
- Auto-refresh when expired (re-exchange credentials)
- Use `Authorization: FMID <token>` for subsequent OData requests
- **Effort**: Medium — requires Claris ID auth flow implementation
- **Value**: Eliminates sending passwords with every request for FileMaker
  Cloud users

### Phase 3: Full OAuth 2.0 client credentials flow (most complex)

For enterprise deployments using OAuth 2.0 identity providers (Keycloak,
Azure AD, Auth0):

- Add `FM_OAUTH_CLIENT_ID`, `FM_OAUTH_CLIENT_SECRET`, `FM_OAUTH_TOKEN_URL`
  env vars
- Implement token exchange and automatic refresh via the OAuth 2.0 client
  credentials flow
- Use `Authorization: Bearer <token>` for OData requests
- **Effort**: High — full OAuth 2.0 implementation with refresh logic
- **Value**: Most enterprise-ready, supports automated server-to-server auth
  without storing passwords

### Recommendation

**Phase 1** as the immediate next step. It has the lowest effort and
immediate value for FileMaker Cloud users and anyone using a token-issuing
reverse proxy. Phases 2 and 3 can follow based on user demand.

## Proposed API (Phase 1)

### `ODataClientConfig` interface change

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

### `getAuthHeader` method change

```ts
private getAuthHeader(): string {
  if (this.config.authType === "bearer" && this.config.bearerToken) {
    return `Bearer ${this.config.bearerToken}`;
  }
  // Also support Claris ID tokens (Phase 2)
  // if (this.config.authType === "fmid" && this.config.bearerToken) {
  //   return `FMID ${this.config.bearerToken}`;
  // }
  const credentials = Buffer.from(
    `${this.config.user}:${this.config.password}`
  ).toString("base64");
  return `Basic ${credentials}`;
}
```

### `Connection` interface change (`src/config.ts`)

```ts
export interface Connection {
  name?: string;
  server: string;
  database: string;
  user: string;        // optional when authType=bearer
  password: string;   // optional when authType=bearer
  authType?: "basic" | "bearer";  // default: "basic"
  bearerToken?: string;
  verifySsl?: boolean;
}
```

### `fm_odata_connect` tool schema change

```ts
{
  name: "fm_odata_connect",
  description: "Connect to FileMaker Server with inline credentials " +
    "(temporary connection, not saved). Supports Basic Auth (default) " +
    "and Bearer token auth (for FileMaker Cloud or OAuth/identity provider setups).",
  inputSchema: {
    type: "object",
    properties: {
      server: { type: "string", description: "FileMaker Server URL" },
      database: { type: "string", description: "Database name" },
      user: { type: "string", description: "Username (required for Basic auth, ignored for Bearer)" },
      password: { type: "string", description: "Password (required for Basic auth, ignored for Bearer)" },
      authType: {
        type: "string",
        enum: ["basic", "bearer"],
        description: "Authentication method (default: basic)",
      },
      bearerToken: {
        type: "string",
        description: "Bearer token (required when authType=bearer). " +
          "Obtain from Claris ID, OAuth provider, or reverse proxy.",
      },
      verifySsl: { type: "boolean", description: "Verify SSL certificate (default: true)" },
    },
    required: ["server", "database"],
    // Note: user/password are required when authType is "basic" or unspecified.
    // bearerToken is required when authType is "bearer".
    // JSON Schema can't express conditional requirements, so validation
    // must be done in the handler.
  },
}
```

### New env vars

```env
FM_AUTH_TYPE=basic    # or "bearer"
FM_BEARER_TOKEN=      # Bearer token (when FM_AUTH_TYPE=bearer)
```

### Backward compatibility

When `authType` is not specified (or is `"basic"`), behavior is **unchanged**:
Basic Auth with `user`/`password`. Existing users who pass `user`/`password`
to `fm_odata_connect` are not affected. This is a **non-breaking change**.

The handler should validate:
- If `authType === "bearer"`: require `bearerToken`, ignore `user`/`password`
- If `authType === "basic"` or undefined: require `user`/`password`

### Relationship to Plan 006 (transport auth)

**Plan 006** adds Bearer token auth for the **MCP transport** (MCP client →
MCP server). It protects who can call MCP tools.

**This spike (Plan 015)** is about **OData client auth** (MCP server →
FileMaker Server). It changes how the MCP server authenticates to
FileMaker.

They are **independent**:
- Transport auth (`MCP_AUTH_TOKEN`) controls access to the MCP server itself
- OData auth (`FM_AUTH_TYPE`/`FM_BEARER_TOKEN`) controls how the MCP server
  talks to FileMaker

A deployment might use both: `MCP_AUTH_TOKEN` to protect the MCP server,
and `FM_AUTH_TYPE=bearer` to authenticate to FileMaker Cloud without storing
a password.

## Open Questions

1. **External identity provider support**: Does FileMaker Server's OData API
   accept Bearer tokens from external identity providers (e.g., Keycloak,
   Auth0, Azure AD) directly, or does it require the Claris ID / OAuth
   identity provider flow?
2. **Data API token sharing**: Confirmed NOT compatible — Data API tokens
   do not work with OData. Should the findings document this prominently to
   prevent users from trying?
3. **Token expiry handling**: What happens when a Bearer token expires
   mid-session? The OData API returns 401. Should the client auto-refresh
   (Phase 2/3) or surface the error to the AI agent (Phase 1)?
4. **`fm_odata_connect_multi` support**: Should the `fm_odata_connect_multi`
   tool also support `authType=bearer`? If so, the shared `user`/`password`
   fields become optional, and a shared `bearerToken` field is added.
5. **Token persistence**: Should bearer tokens be persisted in the config
   file (`~/.fms-odata-mcp/config.json`)? Security trade-off: convenience
   (don't re-enter on restart) vs. token leakage (tokens are as sensitive as
   passwords, and they expire — a persisted token may be stale on next use).
6. **Token refresh tool**: Should there be a `fm_odata_refresh_token` tool
   for Phase 2/3? Or should token refresh be automatic and transparent?
7. **Claris ID auth flow**: For Phase 2, the Claris ID token exchange
   requires user interaction (browser-based OAuth flow). How should this work
   in an MCP server context (no browser)? Can it use a service account or
   API key instead?
8. **Multiple auth types per session**: Should the MCP server support
   connections with mixed auth types (one session using Basic, another using
   Bearer)? This would require the `Connection` interface to carry the
   `authType` field, which it does in the proposed API.
9. **Token validation**: Should the MCP server validate the Bearer token
   format before sending it to FileMaker? (e.g., check it's a non-empty
   string, maybe check JWT structure if it looks like a JWT)
