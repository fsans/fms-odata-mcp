# AGENTS.md

Project-level rules for AI agents working in this repository.

## Git Commits

- Do NOT add `Co-Authored-By: Devin` or any `Generated with [Devin]` trailer/link to commit messages.
- Keep commit messages concise: a short subject line and optional body. No attribution footers.

## Verification Commands

```bash
npm run build    # TypeScript compile (tsc)
npm test         # Unit tests (jest, tests/unit/**)
```

## Known FileMaker OData Limitations

These standard OData 4.01 features are **not supported** by FileMaker Server (as of 2025/v22).
Do not implement tools that rely on them against FileMaker Server without a clear unsupported warning:

- **Lambda operators `any` / `all`** — explicitly unsupported per Claris docs (`odata-unsupported-features.html`).
  The FileMaker-supported alternative for filtering on related data is nested `$expand($filter=...)` options.
- **`$search` query option** — not supported.
- **`fractionalseconds()`, `isof()`, `geo.*()` functions** — not supported.

## Branch: feature/multisession

Features implemented in this branch (v0.5.0):
- `fm_odata_connect_multi` — bulk-connect N databases with shared or per-entry credentials
- `fm_odata_list_active_sessions` — list all live in-memory sessions and which is active
- `fm_odata_describe_sessions` — merged `$metadata` schema across all active sessions, with collision detection
- Per-call `connection` parameter on all 11 connection-dependent OData tools
- `fm_odata_set_connection` extended to resolve runtime aliases (not just saved config names)

## FileMaker Separation-of-Concerns Architecture

In the standard FileMaker "separation model" (LOGIC + DATA files):
- Connecting to the LOGIC file is sufficient — all external DATA tables that have a
  Table Occurrence (TO) in LOGIC's relationship graph are accessible via OData.
- A second session to DATA is only needed for: direct writes bypassing LOGIC, tables
  with no TO in LOGIC, or credentials that differ per file.
- `fm_odata_describe_sessions` reflects what each OData endpoint actually exposes —
  it cannot identify the physical source file of a TO, as FileMaker does not surface
  this in the `$metadata` XML.

## Branch: feat/fm2025-odata-features (merged → develop → v0.4.0)

Features shipped in v0.4.0:
- `fm_odata_cast` and `fm_odata_build_filter`: FileMaker Server v21.1+ (FileMaker 2024)
- `fm_odata_aggregate`: FileMaker Server v22.0.1+ (FileMaker 2025)
- `fm_odata_aggregate` — server-side aggregation via OData `$apply`
- `fm_odata_cast` — type coercion via property path segments (`Field/Edm.Type`)
- `fm_odata_build_filter` — parameterized `$filter` via OData `@alias` substitution
