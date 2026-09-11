# Advisor Audit — Implementation Plans

> **Audited at**: commit `2829524`, 2026-07-16
> **Audited by**: improve skill (GLM-5.2 High)
> **Effort level**: standard

## How to use this index

Each plan is a self-contained markdown file in this directory. An executor
(another agent or a human developer) can pick up any plan and execute it
without needing context from the audit conversation — every plan includes
the relevant code excerpts, scope boundaries, step-by-step instructions,
verification commands, and stop conditions.

**Before starting a plan:**
1. Run the drift check at the top of the plan file — if the codebase has
   changed since the plan was written, review the differences before
   proceeding.
2. Ensure all dependencies (listed in the plan's status row) are complete.
3. Create a branch: `advisor/<plan-number>-<short-name>`.

**After completing a plan:**
1. Update the status row in the table below.
2. Run the plan's "Done criteria" checklist to verify all conditions hold.

## Status legend

| Symbol | Meaning |
|--------|---------|
| `not started` | Plan written, no execution attempted |
| `in progress` | Executor is currently working on it |
| `blocked` | A dependency or stop condition is preventing progress |
| `done` | All done criteria verified, plan is complete |
| `superseded` | A newer plan replaces this one |
| `rejected` | Maintainer decided not to implement |

## Plan index

| # | Plan | Category | Priority | Effort | Risk | Depends on | Status |
|---|------|----------|----------|--------|------|------------|--------|
| 001 | [verification-baseline](001-verification-baseline.md) | dx | P1 | M | LOW | — | not started |
| 002 | [scrub-tls-private-key](002-scrub-tls-private-key.md) | security | P1 | M | LOW | — | not started |
| 003 | [scrub-test-credentials](003-scrub-test-credentials.md) | security | P1 | S | LOW | — | not started |
| 004 | [wire-integration-tests](004-wire-integration-tests.md) | tests | P1 | S | LOW | 001 | not started |
| 005 | [http-server-graceful-shutdown](005-http-server-graceful-shutdown.md) | bug | P2 | S | LOW | 001 | not started |
| 006 | [http-transport-auth](006-http-transport-auth.md) | security | P2 | M | MED | 001 | not started |
| 007 | [node18-eol-upgrade](007-node18-eol-upgrade.md) | migration | P2 | M | MED | 001 | not started |
| 008 | [express-dep-upgrades](008-express-dep-upgrades.md) | migration | P2 | S | MED | 001 | not started |
| 009 | [remove-dead-code](009-remove-dead-code.md) | tech-debt | P3 | S | LOW | 001 | not started |
| 010 | [clean-dev-stuf-docs](010-clean-dev-stuf-docs.md) | docs | P3 | S | LOW | 003 | not started |
| 011 | [critical-path-tests](011-critical-path-tests.md) | tests | P2 | M | LOW | 001, 004 | not started |
| 012 | [parseint-nan-guard](012-parseint-nan-guard.md) | bug | P3 | S | LOW | 001 | not started |
| 013 | [batch-operations-spike](013-batch-operations-spike.md) | direction | P3 | M | LOW | 009 | not started |
| 014 | [pagination-helper-spike](014-pagination-helper-spike.md) | direction | P3 | S | LOW | — | not started |
| 015 | [oauth-auth-spike](015-oauth-auth-spike.md) | direction | P3 | M | LOW | — | not started |

## Dependency graph

```
001 (verification baseline) ──┬── 004 (integration tests) ──── 011 (critical path tests)
                              ├── 005 (HTTP server shutdown)
                              ├── 006 (HTTP transport auth)
                              ├── 007 (Node 18 EOL upgrade)
                              ├── 008 (Express dep upgrades)
                              ├── 009 (remove dead code) ───── 013 (batch spike)
                              └── 012 (parseInt NaN guard)

002 (scrub TLS key) ── (independent, no dependencies)

003 (scrub test credentials) ──── 010 (clean dev_stuf docs)

014 (pagination spike) ── (independent, no dependencies)
015 (OAuth spike) ── (independent, no dependencies)
```

## Recommended execution order

### Wave 1 — Prerequisites and critical security (do first)

1. **001** — Establish verification baseline (typecheck, lint, CI). This
   unblocks every other plan by ensuring `npm install → npm test → tsc
   --noEmit` works.
2. **002** — Remove committed TLS private key. CRITICAL security issue.
   Independent of 001 but should be done early.
3. **003** — Remove committed test credentials. Independent of 001 but
   should be done early. Pairs naturally with 002.

### Wave 2 — High-value quick wins (depends on Wave 1)

4. **004** — Wire up integration tests (depends on 001). One-line config
   change that adds ~800 lines of test coverage.
5. **005** — HTTP server graceful shutdown (depends on 001). Small fix
   for a real bug.
6. **008** — Express dep upgrades (depends on 001). Fixes 10 known
   vulnerabilities with `npm audit fix` + version bumps.
7. **012** — parseInt NaN guard (depends on 001). Small bug fix.

### Wave 3 — Medium-effort security and migration (depends on Wave 1)

8. **006** — HTTP transport auth (depends on 001). Adds Bearer token
   auth for the `/mcp` endpoint.
9. **007** — Node 18 EOL upgrade (depends on 001). Updates Dockerfile,
   CI, and engines to Node 22 LTS.

### Wave 4 — Cleanup and test coverage (depends on Wave 1+2)

10. **009** — Remove dead code (depends on 001). Deletes
    `http-server.ts` and the batch stub.
11. **010** — Clean dev_stuf docs (depends on 003). Removes cruft and
    fixes broken links.
12. **011** — Critical path tests (depends on 001 + 004). Adds tests
    for URL building, transport, and multi-session handlers.

### Wave 5 — Direction spikes (can be done anytime)

13. **013** — Batch operations spike (depends on 009). Investigates
    real OData batch vs parallel Promise.all.
14. **014** — Pagination helper spike. Investigates @odata.nextLink
    auto-following.
15. **015** — OAuth auth spike. Investigates token-based auth for
    FileMaker OData.

## Summary statistics

- **Total plans**: 15 (12 fix plans + 3 direction spikes)
- **Critical security**: 2 (TLS key, test credentials)
- **High-priority**: 4 (verification baseline, integration tests, TLS key, credentials)
- **Total effort**: 3M + 7S + 4M + 1S = ~15 person-days (rough estimate)
- **Independent plans** (no dependencies): 002, 003, 014, 015 — can start immediately
- **Plans that block others**: 001 (blocks 9 plans), 003 (blocks 010), 004 (blocks 011), 009 (blocks 013)

## Findings considered and rejected

These findings were identified during the audit but rejected after
vetting. They are listed here for transparency and to prevent future
re-investigation.

| Finding | Source | Reason rejected |
|---------|--------|-----------------|
| OData $filter/$select "injection" | security subagent | These are OData query expressions the tool exists to construct. Restricting them defeats the tool's purpose. Encoding is handled by `odataEncode`. |
| Connection name "path traversal" | security subagent | Connection names are JSON object keys in config.json, not filesystem paths. No traversal vector. |
| Check-then-act race on default connection | correctness subagent | Node.js is single-threaded; no concurrent mutation between check and act. |
| `Math.min(...nums)` stack overflow on 10k array | perf subagent | V8 call stack limit is ~65k-125k frames; 10k is well within bounds. |
| No `package-lock.json` in published npm package | deps subagent | Standard npm practice — lockfiles are dev-only; consumers resolve independently. |
| Double-escaped regex in metadata parser | correctness subagent | Subagent admits it's "technically correct" — `\\s` in RegExp constructor produces `\s`. Not a bug. |
| Credentials in plaintext config.json | security subagent | `chmod 0o600` is reasonable mitigation for a local dev/agent tool. Encryption-at-rest adds significant complexity for marginal benefit here. Downgraded to investigate-only. |
| Dynamic imports in tool handlers | tech-debt subagent | Likely avoids circular dependency with config.js. Minor style, not a real problem. |

## Audit methodology

1. **Reconnaissance**: Read all source files, config files, CI workflows,
   and test infrastructure to build a complete picture of the codebase.
2. **Subagent dispatch**: Four background audit subagents investigated
   specific categories (security/dependencies, correctness/performance,
   test coverage/tech-debt, DX/docs/direction).
3. **Vetting**: Every subagent finding was checked against the actual
   code. Over-reports and false positives were rejected (see table
   above). Evidence was confirmed with `grep`, `git log`, and file reads.
4. **Prioritization**: Findings were ranked by leverage (impact ÷ effort)
   and organized into dependency waves.
5. **Plan writing**: Each vetted finding became a self-contained plan
   with code excerpts, scope boundaries, steps, verification commands,
   and stop conditions.
