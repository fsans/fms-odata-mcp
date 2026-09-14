# Plan 003: Remove committed test credentials and rotate if real

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3705083..HEAD -- dev_stuf/`
> If any in-scope file changed since this plan was reconciled, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **Reconciliation note (2026-09-11, commit `3705083`)**: The two files this
> plan originally targeted — `dev_stuf/TESTING_GUIDE.md` and
> `dev_stuf/test-connection.js` — were already deleted from the repo after
> the audit. The password `wakawaka` no longer appears anywhere in the
> working tree. What remains is the server IP `192.168.0.24` in two
> surviving `dev_stuf/` docs (see below). The plan was rescoped accordingly;
> the credential-rotation maintenance note still applies if `wakawaka` was a
> real credential — it lives in git history until scrubbed.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (can be done in parallel with Plan 002)
- **Category**: security
- **Planned at**: commit `2829524`, 2026-07-16
- **Reconciled at**: commit `3705083`, 2026-09-11

## Why this matters

A FileMaker password (`wakawaka`) and server address (`192.168.0.24`) were committed under `dev_stuf/`. The files containing the password were deleted post-audit, but the credentials remain in git history, and `192.168.0.24` still appears in `dev_stuf/CLAUDE_DESKTOP_PROMPTS.md` and `dev_stuf/DEPLOYMENT_SCENARIOS.md`. If these were real credentials for an accessible FileMaker Server, they are burned and must be rotated. The remaining IP references should be replaced with placeholders for hygiene — or removed wholesale by Plan 010 (which deletes `dev_stuf/` entirely).

## Current state

**`dev_stuf/` now contains only 6 files** (down from 14 at audit time; `TESTING_GUIDE.md`, `test-connection.js`, `ROADMAP.md`, `ARCHITECTURE.md`, and others were already deleted):
```
CLAUDE_DESKTOP_PROMPTS.md   — contains 192.168.0.24 (4 occurrences: lines ~11, 237, 341, 351)
CLAUDE_DESKTOP_SETUP.md     — clean
DEPLOYMENT_SCENARIOS.md     — contains 192.168.0.24 (1 occurrence: line ~28)
NPM_PUBLISHING.md           — clean
QUICK_REFERENCE.md          — clean
test-docker.sh              — clean
```

**`grep -rn "wakawaka" .`** (excluding `.git/`, `node_modules/`, `plans/`, `dist/`) → no matches. The password is gone from the working tree.

**Note**: `192.168.0.24` also appears in `src/tools/connection.ts:18` and `src/tools/configuration.ts:27` as a *generic example* in tool descriptions (e.g. `"FileMaker Server URL (e.g., 'http://192.168.0.24' or ...)"`). These are documentation examples, not credentials — **leave them as-is** (or substitute `192.0.2.1` / `example.com` if the maintainer prefers not to reference a real LAN address).

**Repo conventions:**
- Commit style: conventional commits (`fix:`, `chore:`, `docs:` — see `git log --oneline -20`)
- The `dev_stuf/` directory is a development artifacts folder (note: typo in name, "stuf" instead of "stuff" — addressed in Plan 010)

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Tests     | `npm test`               | all pass            |

## Scope

**In scope** (the only files you should modify):
- `dev_stuf/CLAUDE_DESKTOP_PROMPTS.md` — replace `192.168.0.24` occurrences with a placeholder
- `dev_stuf/DEPLOYMENT_SCENARIOS.md` — replace the `192.168.0.24` occurrence with a placeholder

**Out of scope** (do NOT touch):
- `src/` — the `192.168.0.24` in tool descriptions is a generic example, not a credential
- `.env.example` — already uses placeholder values
- `dist/` — generated build output, gitignored
- Other `dev_stuf/` files — deletion of the entire directory is Plan 010
- Git history scrubbing — manual maintainer step (see Maintenance notes)

## Git workflow

- Branch: `advisor/003-scrub-test-credentials`
- Commit per logical unit; message style: conventional commits
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace the server IP in the remaining dev_stuf docs

In `dev_stuf/CLAUDE_DESKTOP_PROMPTS.md` and `dev_stuf/DEPLOYMENT_SCENARIOS.md`, replace every occurrence of `192.168.0.24` with a placeholder such as `<your-filemaker-server>` or `fms.example.com`:

```bash
grep -n "192\.168\.0\.24" dev_stuf/CLAUDE_DESKTOP_PROMPTS.md dev_stuf/DEPLOYMENT_SCENARIOS.md
```

Replace all matches (~5 total).

**Verify**: `grep -rn "192\.168\.0\.24" dev_stuf/` → no matches

### Step 2: Scan entire repo for any remaining occurrences

```bash
grep -rn "wakawaka" --include='*.md' --include='*.js' --include='*.ts' --include='*.json' --include='*.yml' --include='*.sh' .
grep -rn "192\.168\.0\.24" --include='*.md' --include='*.js' --include='*.ts' --include='*.json' --include='*.yml' --include='*.sh' .
```

**Verify**: No `wakawaka` matches anywhere (excluding `.git/`, `node_modules/`, `dist/`). `192.168.0.24` matches only in `src/tools/connection.ts` and `src/tools/configuration.ts` (generic examples — acceptable, see Current state note).

### Step 3: Commit the changes

```bash
git add dev_stuf/CLAUDE_DESKTOP_PROMPTS.md dev_stuf/DEPLOYMENT_SCENARIOS.md
git commit -m "fix(security): remove remaining FileMaker server IP from dev_stuf docs

The files containing the hardcoded password were already deleted;
this replaces the remaining references to the server IP with
placeholders. If the original credentials were real, they must be
rotated — see plan maintenance notes."
```

**Verify**: `git log --oneline -1` → shows the commit.

### Step 4: Verify tests still pass

**Verify**: `npm install && npm test` → all exit 0 (the test suite doesn't use `dev_stuf/` files)

## Test plan

- No new tests to write — this is a security remediation that replaces hardcoded values with placeholders.
- Verification: `grep -rn "192\.168\.0\.24" dev_stuf/` returns no matches.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn "wakawaka" .` (excluding `.git/`, `node_modules/`, `dist/`) returns no matches
- [ ] `grep -rn "192\.168\.0\.24" dev_stuf/` returns no matches
- [ ] `dev_stuf/CLAUDE_DESKTOP_PROMPTS.md` and `DEPLOYMENT_SCENARIOS.md` use placeholder values
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `192.168.0.24` doesn't appear at the cited locations (the codebase has drifted — Plan 010 may have deleted `dev_stuf/` first, in which case this plan is fully resolved and should be marked `done`).
- Additional files beyond the two listed contain real credential values — report all locations found.

## Maintenance notes

**CRITICAL — Manual step the maintainer must perform:**

1. **Determine if credentials are real**: If the FileMaker Server at `192.168.0.24` is accessible and the password `wakawaka` is (or was) a real credential, it must be rotated immediately. Change the FileMaker account password and update any services that use it.

2. **Git history**: The credentials remain in historical commits even though the files are deleted from the working tree. If they are real, follow the same history-scrubbing procedure as Plan 002 (git filter-repo or BFG). If they are clearly test-only (e.g., the server is no longer accessible, the password was never used in production), history scrubbing is optional but recommended for hygiene.

3. **Plan 010 interaction**: Plan 010 deletes `dev_stuf/` entirely, which resolves the remaining IP references wholesale. If 010 lands first, mark this plan `done` after confirming `grep -rn "wakawaka" .` is clean.

4. **Future prevention**: Consider adding a pre-commit hook that scans for common credential patterns (e.g., `git-secrets` or `trufflehog`). This is out of scope for this plan but could be a future DX improvement.
