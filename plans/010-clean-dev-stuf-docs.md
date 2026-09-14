# Plan 010: Clean up dev_stuf/ cruft and fix broken documentation links

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3705083..HEAD -- dev_stuf/ CONTRIBUTING.md .github/workflows/bump.md`
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
- **Reconciled at**: commit `3705083`, 2026-09-11 — `dev_stuf/` shrank from 14 to 6 files post-audit; file list and CONTRIBUTING.md references updated below

## Why this matters

The `dev_stuf/` directory (typo: "stuf" instead of "stuff") still contains 6 development artifact files committed to the repo — dev docs that duplicate and sometimes contradict root-level docs, plus a test script with hardcoded paths. Additionally, `.github/workflows/bump.md` is an agent workflow document misplaced in the GitHub Actions workflows directory (it's not a YAML workflow), and `CONTRIBUTING.md` still references `dev_stuf/` paths plus a non-existent `../private/IMPLEMENTATION_PLANS.md`. This cruft confuses contributors and creates maintenance burden.

## Current state

**`dev_stuf/` directory contents (6 files as of `3705083`, all git-tracked):**
```
CLAUDE_DESKTOP_PROMPTS.md (12KB — contains leftover 192.168.0.24 refs, see Plan 003)
CLAUDE_DESKTOP_SETUP.md   (7.8KB — references non-existent .env.test)
DEPLOYMENT_SCENARIOS.md   (8.3KB — contains 192.168.0.24, see Plan 003)
NPM_PUBLISHING.md         (6.8KB)
QUICK_REFERENCE.md        (7.5KB)
test-docker.sh            (902B — package.json docker:test points at the WRONG path)
```
(Deleted since the audit: ARCHITECTURE.md, PLAN-server-version-detection.md, PROJECT_STRUCTURE.md, QUICK_START_TEST.md, ROADMAP.md, TESTING_GUIDE.md, WINDSURF_SETUP.md, test-connection.js — the stale ROADMAP and credential files are already gone.)

**`.github/workflows/bump.md`** — an agent workflow document (Devin/bump workflow) misplaced in the GitHub Actions directory. It's a markdown file, not a YAML workflow, so GitHub Actions ignores it, but it's confusing in the directory listing.

**`CONTRIBUTING.md` current references (as of `3705083`):**
```
Line ~56:  ├── dev_stuf/              # Detailed documentation  (in project tree listing)
Line ~280: - Add examples to `dev_stuf/CLAUDE_DESKTOP_PROMPTS.md`
Line ~293: - **[NPM Publishing](./dev_stuf/NPM_PUBLISHING.md)** - How to publish new versions
Line ~295: - **[Implementation Plans](../private/IMPLEMENTATION_PLANS.md)** - ... (private)
Line ~304: 6. Publish: Follow `dev_stuf/NPM_PUBLISHING.md`
```
Line ~295 links to `../private/IMPLEMENTATION_PLANS.md` — a path **outside the repo** — broken for any other contributor. The `dev_stuf/` links break once the directory is deleted.

**`dev_stuf/CLAUDE_DESKTOP_SETUP.md` (lines ~178-180):**
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

In `CONTRIBUTING.md`, fix these references (line numbers approximate as of `3705083` — find them with `grep -n "dev_stuf\|private/" CONTRIBUTING.md`):

Line ~56 (project tree): `├── dev_stuf/              # Detailed documentation` (plus the `dev_stuf/` sub-listing lines below it)
→ Remove the `dev_stuf/` block from the tree listing.

Line ~280: `- Add examples to \`dev_stuf/CLAUDE_DESKTOP_PROMPTS.md\``
→ Remove this line (the file is being deleted) or replace with a pointer to `README.md` examples.

Line ~293: `- **[NPM Publishing](./dev_stuf/NPM_PUBLISHING.md)** - How to publish new versions`
→ If `NPM_PUBLISHING.md` content is valuable, move it to a root `docs/` or inline the key steps into CONTRIBUTING.md first; otherwise remove the link.

Line ~295: `- **[Implementation Plans](../private/IMPLEMENTATION_PLANS.md)** - Phase-by-phase feature breakdowns (private)`
→ Remove this line — it links outside the repo and is broken for other contributors.

Line ~304: `6. Publish: Follow \`dev_stuf/NPM_PUBLISHING.md\``
→ Update to reference wherever the publishing doc ends up, or inline the `npm publish` steps.

Fix or remove all remaining references:

**Verify**: `grep -n "dev_stuf" CONTRIBUTING.md` → no matches. `grep -n "private/" CONTRIBUTING.md` → no matches.

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

- Delete dev_stuf/ directory (remaining 6 dev artifact files —
  the stale ROADMAP and credential files were already removed)
- Delete .github/workflows/bump.md (agent workflow doc misplaced
  in GitHub Actions directory)
- Fix CONTRIBUTING.md: remove dev_stuf/ references and the
  ../private/IMPLEMENTATION_PLANS.md link that points outside
  the repo
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
- [ ] `grep -n "dev_stuf\|private/" CONTRIBUTING.md` → no matches
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
- **CLAUDE_DESKTOP_SETUP.md and CLAUDE_DESKTOP_PROMPTS.md**: These contain client-specific setup instructions and example prompts. If they're still relevant, they should be moved to root docs or a `docs/clients/` directory before this plan runs. If they're stale (referencing non-existent files like `.env.test`), deletion is appropriate.
- **NPM_PUBLISHING.md**: This documents the release process and is referenced by CONTRIBUTING.md's release steps. If the maintainer still publishes to npm, either move this file to `docs/` or inline the key steps into CONTRIBUTING.md before deleting `dev_stuf/`.
- A reviewer should check `git show HEAD:dev_stuf/NPM_PUBLISHING.md` before approving to confirm no unique release-process context is lost.
- **Plan 003 interaction**: deleting `dev_stuf/` also removes the remaining `192.168.0.24` references that Plan 003 targets. If this plan lands first, mark Plan 003 `done` after confirming `grep -rn "wakawaka" .` is clean.
