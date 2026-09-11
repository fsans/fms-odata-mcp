# Plan 010: Clean up dev_stuf/ cruft and fix broken documentation links

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2829524..HEAD -- dev_stuf/ CONTRIBUTING.md .github/workflows/bump.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/003-scrub-test-credentials.md (credentials in dev_stuf/ must be scrubbed first)
- **Category**: docs
- **Planned at**: commit `2829524`, 2026-07-16

## Why this matters

The `dev_stuf/` directory (typo: "stuf" instead of "stuff") contains 14 development artifact files committed to the repo — dev docs that duplicate and sometimes contradict root-level docs, test scripts with hardcoded paths, a stale ROADMAP referencing a non-existent tool (`fm_odata_test_connection_detailed`), and an implementation plan from a completed feature. Additionally, `.github/workflows/bump.md` is an agent workflow document misplaced in the GitHub Actions workflows directory (it's not a YAML workflow), and `CONTRIBUTING.md` references two non-existent files (`dev_stuf/VERSIONING.md` and `dev_stuf/IMPLEMENTATION_PLAN.md`). This cruft confuses contributors and creates maintenance burden.

## Current state

**`dev_stuf/` directory contents (14 files, all git-tracked):**
```
ARCHITECTURE.md          (15KB — duplicates info in CLAUDE.md)
CLAUDE_DESKTOP_PROMPTS.md (11KB)
CLAUDE_DESKTOP_SETUP.md   (7.7KB — references non-existent .env.test)
DEPLOYMENT_SCENARIOS.md   (8.2KB)
NPM_PUBLISHING.md         (6.9KB)
PLAN-server-version-detection.md (8.2KB — completed feature plan)
PROJECT_STRUCTURE.md      (10.9KB — may be stale)
QUICK_REFERENCE.md        (6.9KB)
QUICK_START_TEST.md       (7.1KB)
ROADMAP.md                (12.5KB — references non-existent tool)
TESTING_GUIDE.md          (8.1KB — had credentials, scrubbed by Plan 003)
WINDSURF_SETUP.md         (10.1KB)
test-connection.js        (6.5KB — had credentials, scrubbed by Plan 003)
test-docker.sh            (920B — referenced by package.json docker:test script)
```

**`.github/workflows/bump.md`** — an agent workflow document (Devin/bump workflow) misplaced in the GitHub Actions directory. It's a markdown file, not a YAML workflow, so GitHub Actions ignores it, but it's confusing in the directory listing.

**`CONTRIBUTING.md` broken references:**
```
Line 281: - Document breaking changes in `dev_stuf/VERSIONING.md`
Line 291: - **[Implementation Plan](./dev_stuf/IMPLEMENTATION_PLAN.md)** - Development roadmap
Line 296: 2. Update `dev_stuf/VERSIONING.md`
```
Neither `dev_stuf/VERSIONING.md` nor `dev_stuf/IMPLEMENTATION_PLAN.md` exists.

**`dev_stuf/ROADMAP.md` stale reference (line 34):**
References `fm_odata_test_connection_detailed` — a tool that does not exist in the codebase (confirmed: `grep -rn "test_connection_detailed\|fm_odata_test_connection" src/` → no matches).

**`dev_stuf/CLAUDE_DESKTOP_SETUP.md` (lines 178, 180):**
```
### 1. Create .env file (already created as .env.test)
cp .env.test .env
```
References `.env.test` which doesn't exist (it's in `.gitignore` but was never committed).

**`package.json` (line 27):**
```json
"docker:test": "./test-docker.sh"
```
This references `test-docker.sh` at the repo root, but the script is in `dev_stuf/test-docker.sh`. The script path is already broken.

**Repo conventions:**
- Root-level docs: `README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `DOCKER.md`, `CHANGELOG.md`
- Commit style: conventional commits (`docs:`, `chore:` — see `git log --oneline -20`)

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Build     | `npm run build`          | exit 0              |
| Tests     | `npm test`               | all pass            |

## Scope

**In scope** (the only files you should modify/delete):
- `dev_stuf/` — remove the entire directory from git (or selectively keep valuable docs by moving them)
- `.github/workflows/bump.md` — move to `dev_stuf/` (if keeping dev_stuf) or delete
- `CONTRIBUTING.md` — fix broken references to non-existent files
- `package.json` — fix the `docker:test` script path (or remove it if the script is deleted)

**Out of scope** (do NOT touch):
- `src/` — no source code changes
- `tests/` — no test changes
- `README.md`, `CLAUDE.md`, `AGENTS.md`, `DOCKER.md`, `CHANGELOG.md` — root docs are separate; only update if they reference `dev_stuf/` paths
- `.dockerignore` — already excludes `dev_stuf`; no change needed

## Git workflow

- Branch: `advisor/010-clean-dev-stuf`
- Commit per logical unit; message style: conventional commits
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Decide what to keep vs delete from dev_stuf/

Before deleting, check if any root-level docs reference `dev_stuf/` files:

```bash
grep -rn "dev_stuf/" README.md CLAUDE.md AGENTS.md CONTRIBUTING.md DOCKER.md CHANGELOG.md
```

The `CONTRIBUTING.md` references (lines 281, 291, 296) are broken links to non-existent files. The `package.json` `docker:test` script references `./test-docker.sh` (root, not `dev_stuf/`).

**Decision**: Remove the entire `dev_stuf/` directory. The valuable content (ARCHITECTURE.md, DEPLOYMENT_SCENARIOS.md, setup guides) either duplicates root-level docs or should be consolidated into root docs in a future documentation plan. The stale ROADMAP, completed implementation plan, and broken test scripts have no value.

If the maintainer wants to keep specific files, they can be moved to a `docs/` directory before the cleanup — but that's a separate documentation effort. This plan removes the cruft.

### Step 2: Remove dev_stuf/ from git

```bash
git rm -r dev_stuf/
```

**Verify**: `ls dev_stuf/ 2>/dev/null` → directory does not exist. `git status` → shows dev_stuf/ files as deleted.

### Step 3: Move .github/workflows/bump.md out of the workflows directory

The bump workflow doc is an agent workflow, not a GitHub Actions workflow. Either delete it or move it to a docs location. Since `dev_stuf/` is being deleted, and this is an agent workflow doc (not project documentation), delete it:

```bash
git rm .github/workflows/bump.md
```

**Verify**: `ls .github/workflows/bump.md 2>/dev/null` → does not exist. `ls .github/workflows/` → only `docker.yml` remains.

### Step 4: Fix CONTRIBUTING.md broken references

In `CONTRIBUTING.md`, find and fix the three broken references:

Line 281: `- Document breaking changes in \`dev_stuf/VERSIONING.md\``
→ Replace with: `- Document breaking changes in \`CHANGELOG.md\``

Line 291: `- **[Implementation Plan](./dev_stuf/IMPLEMENTATION_PLAN.md)** - Development roadmap`
→ Remove this line entirely (the implementation plan doesn't exist; the ROADMAP is also being deleted)

Line 296: `2. Update \`dev_stuf/VERSIONING.md\``
→ Replace with: `2. Update \`CHANGELOG.md\``

Search for any other `dev_stuf/` references in CONTRIBUTING.md:
```bash
grep -n "dev_stuf" CONTRIBUTING.md
```
Fix or remove all remaining references.

**Verify**: `grep -n "dev_stuf" CONTRIBUTING.md` → no matches. `grep -n "VERSIONING.md\|IMPLEMENTATION_PLAN" CONTRIBUTING.md` → no matches (or only references to CHANGELOG.md).

### Step 5: Fix package.json docker:test script

The `docker:test` script (line 27) references `./test-docker.sh` which was in `dev_stuf/`. Since `dev_stuf/` is deleted, either:
- Remove the script: delete the `"docker:test": "./test-docker.sh"` line
- Or update it to point to a root-level script (but the script was in dev_stuf/ and is being deleted)

Remove the script line since the script no longer exists:

```json
    // Remove this line:
    "docker:test": "./test-docker.sh"
```

Also remove the trailing comma from the preceding line if needed to keep valid JSON.

**Verify**: `grep -n "docker:test" package.json` → no match. `npm run build` → exit 0 (valid JSON).

### Step 6: Check for other dev_stuf/ references in the codebase

```bash
grep -rn "dev_stuf" --include='*.md' --include='*.json' --include='*.ts' --include='*.yml' --include='*.sh' .
```

Fix any remaining references in root-level docs. If `README.md`, `CLAUDE.md`, or `DOCKER.md` reference `dev_stuf/` files, update or remove those references.

**Verify**: `grep -rn "dev_stuf" .` (excluding `.git/`, `node_modules/`, `plans/`) → no matches

### Step 7: Build and test

**Verify**: `npm install && npm run build && npm test` → all exit 0

### Step 8: Commit

```bash
git add -A
git commit -m "chore: remove dev_stuf/ cruft and fix broken doc links

- Delete dev_stuf/ directory (14 dev artifact files including
  stale ROADMAP, completed implementation plan, duplicate docs,
  and broken test scripts)
- Delete .github/workflows/bump.md (agent workflow doc misplaced
  in GitHub Actions directory)
- Fix CONTRIBUTING.md: replace broken VERSIONING.md and
  IMPLEMENTATION_PLAN.md references with CHANGELOG.md
- Remove package.json docker:test script (referenced deleted
  dev_stuf/test-docker.sh)"
```

**Verify**: `git log --oneline -1` → shows the commit

## Test plan

- No new tests to write — this is a documentation/cleanup change.
- Verification: `npm test` → all pass (no test files were in dev_stuf/)

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `ls dev_stuf/ 2>/dev/null` → directory does not exist
- [ ] `ls .github/workflows/bump.md 2>/dev/null` → file does not exist
- [ ] `ls .github/workflows/` → only `docker.yml`
- [ ] `grep -rn "dev_stuf" .` (excluding `.git/`, `node_modules/`, `plans/`) → no matches
- [ ] `grep -n "VERSIONING.md\|IMPLEMENTATION_PLAN" CONTRIBUTING.md` → no matches (or only CHANGELOG.md references)
- [ ] `grep -n "docker:test" package.json` → no match
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A root-level doc (README.md, CLAUDE.md, DOCKER.md) has critical content that only exists in a `dev_stuf/` file — report which file and what content would be lost. The maintainer may want to consolidate it into a root doc before deletion.
- `package.json` has other references to `dev_stuf/` files beyond `docker:test` — report them.
- The `docker:test` script is referenced by CI or other automation — report where before removing.
- `npm run build` fails after removing the `docker:test` script (JSON syntax error from comma handling).

## Maintenance notes

- **Content loss**: Some `dev_stuf/` docs (ARCHITECTURE.md, DEPLOYMENT_SCENARIOS.md, setup guides for specific MCP clients) may contain useful information not in root docs. If the maintainer wants to preserve this content, they should review the files before deletion and consolidate valuable sections into root docs or a new `docs/` directory. This plan prioritizes cleanup over preservation — the git history retains the files if needed later.
- **Future documentation structure**: If the project grows, consider a `docs/` directory with proper structure (architecture, deployment, client setup guides) rather than a catch-all `dev_stuf/` or `dev_stuff/` directory.
- **CLAUDE_DESKTOP_SETUP.md and WINDSURF_SETUP.md**: These contain client-specific setup instructions. If they're still relevant, they should be moved to root docs or a `docs/clients/` directory before this plan runs. If they're stale (referencing old versions, non-existent files like `.env.test`), deletion is appropriate.
- A reviewer should check `git show dev_stuf/ARCHITECTURE.md` before approving to confirm no unique architectural context is lost.
