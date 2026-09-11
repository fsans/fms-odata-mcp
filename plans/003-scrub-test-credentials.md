# Plan 003: Remove committed test credentials and rotate if real

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2829524..HEAD -- dev_stuf/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (can be done in parallel with Plan 002)
- **Category**: security
- **Planned at**: commit `2829524`, 2026-07-16

## Why this matters

Test credentials are committed in two files under `dev_stuf/`: a FileMaker password (`wakawaka`) and server address (`192.168.0.24`) in both `TESTING_GUIDE.md` and `test-connection.js`. If these are real credentials for a production or accessible FileMaker Server, they are burned — anyone with repo access can log in to the FileMaker Server at that address. Even if they are test-only credentials, they set a bad precedent and should be replaced with placeholders.

## Current state

**`dev_stuf/TESTING_GUIDE.md` (lines 6-8):**
```
- **Host**: 192.168.0.24
- **User**: fsans
- **Password**: wakawaka
```

**`dev_stuf/test-connection.js` (line 15):**
```js
  password: 'wakawaka',
```

**`dev_stuf/test-connection.js` (broader context, lines 10-20):**
```js
const config = {
  server: 'http://192.168.0.24',
  database: 'FMSample',
  user: 'fsans',
  password: 'wakawaka',
  // ...
};
```

Both files are git-tracked (confirmed via `git ls-files dev_stuf/`).

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
- `dev_stuf/TESTING_GUIDE.md` — replace credentials with placeholders
- `dev_stuf/test-connection.js` — replace credentials with placeholders or env var references

**Out of scope** (do NOT touch):
- `src/` — no source code changes
- `.env.example` — already uses placeholder values (`your_password`, etc.)
- Other `dev_stuf/` files — cleanup of the entire directory is Plan 010
- Git history scrubbing — manual maintainer step (see Maintenance notes)

## Git workflow

- Branch: `advisor/003-scrub-test-credentials`
- Commit per logical unit; message style: conventional commits
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace credentials in TESTING_GUIDE.md

In `dev_stuf/TESTING_GUIDE.md`, replace the credential lines (6-8) with placeholders:

```
- **Host**: <your-filemaker-server-ip>
- **User**: <your-username>
- **Password**: <your-password>
```

Also search for any other occurrence of `wakawaka` or `192.168.0.24` in the file and replace with placeholders:

```bash
grep -n "wakawaka\|192\.168\.0\.24" dev_stuf/TESTING_GUIDE.md
```

Replace all matches with `<your-filemaker-server-ip>` and `<your-password>` respectively.

**Verify**: `grep -n "wakawaka\|192\.168\.0\.24" dev_stuf/TESTING_GUIDE.md` → no matches

### Step 2: Replace credentials in test-connection.js

In `dev_stuf/test-connection.js`, replace the hardcoded credentials with environment variable references or placeholders. Replace the config object (around lines 10-20) with:

```js
const config = {
  server: process.env.FM_SERVER || 'http://localhost',
  database: process.env.FM_DATABASE || 'FMSample',
  user: process.env.FM_USER || 'admin',
  password: process.env.FM_PASSWORD || '',
  // ...
};
```

**Verify**: `grep -n "wakawaka\|192\.168\.0\.24" dev_stuf/test-connection.js` → no matches

### Step 3: Scan entire repo for any other occurrences

Search the entire repository for the credential values to ensure no other files contain them:

```bash
grep -rn "wakawaka" --include='*.md' --include='*.js' --include='*.ts' --include='*.json' --include='*.yml' --include='*.sh' .
```

**Verify**: No matches found anywhere in the repo (excluding `.git/` and `node_modules/`).

### Step 4: Commit the changes

```bash
git add dev_stuf/TESTING_GUIDE.md dev_stuf/test-connection.js
git commit -m "fix(security): remove hardcoded test credentials from dev_stuf

Replace hardcoded FileMaker password and server IP in
TESTING_GUIDE.md and test-connection.js with placeholders
and env var references. If these were real credentials,
they must be rotated — see plan maintenance notes."
```

**Verify**: `git log --oneline -1` → shows the commit. `grep -rn "wakawaka" .` → no matches (excluding .git/ and node_modules/).

### Step 5: Verify tests still pass

**Verify**: `npm install && npm test` → all exit 0 (the test suite doesn't use `dev_stuf/` files)

## Test plan

- No new tests to write — this is a security remediation that replaces hardcoded values with placeholders.
- Verification: `grep -rn "wakawaka" .` returns no matches.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn "wakawaka" .` (excluding `.git/`, `node_modules/`) returns no matches
- [ ] `grep -rn "192\.168\.0\.24" dev_stuf/` returns no matches
- [ ] `dev_stuf/TESTING_GUIDE.md` uses placeholder values (`<your-filemaker-server-ip>`, `<your-password>`)
- [ ] `dev_stuf/test-connection.js` uses `process.env.*` references instead of hardcoded credentials
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The credential values (`wakawaka`, `192.168.0.24`) don't appear in the files at the cited locations (the codebase has drifted).
- Additional files beyond `dev_stuf/TESTING_GUIDE.md` and `dev_stuf/test-connection.js` contain the credentials — report all locations found.
- The `dev_stuf/` directory has already been removed (Plan 010 may have landed first).

## Maintenance notes

**CRITICAL — Manual step the maintainer must perform:**

1. **Determine if credentials are real**: If the FileMaker Server at `192.168.0.24` is accessible and the password `wakawaka` is (or was) a real credential, it must be rotated immediately. Change the FileMaker account password and update any services that use it.

2. **Git history**: The credentials remain in historical commits. If they are real, follow the same history-scrubbing procedure as Plan 002 (git filter-repo or BFG). If they are clearly test-only (e.g., the server is no longer accessible, the password was never used in production), history scrubbing is optional but recommended for hygiene.

3. **Future prevention**: Consider adding a pre-commit hook that scans for common credential patterns (e.g., `git-secrets` or `trufflehog`). This is out of scope for this plan but could be a future DX improvement.
