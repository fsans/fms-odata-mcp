# Plan 002: Remove committed TLS private key and rotate certificate

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2829524..HEAD -- ssl/ .gitignore`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `2829524`, 2026-07-16

## Why this matters

A TLS private key (`ssl/key.pem`) and its certificate (`ssl/cert.pem`) are committed to the git repository (since commit `3219923`, v0.2.0). A committed private key is burned — anyone with read access to the repository (now or in any future fork/clone) can use it to impersonate the HTTPS MCP server, decrypt intercepted traffic, or perform man-in-the-middle attacks. The key must be rotated, removed from the working tree, added to `.gitignore`, and scrubbed from git history. This plan covers the working-tree removal and `.gitignore` update; the history scrub is a separate manual step that the maintainer must perform (it rewrites git history and requires force-push coordination).

## Current state

**`ssl/` directory (git-tracked):**
```
ssl/cert.pem   (1964 bytes — self-signed certificate)
ssl/key.pem    (3272 bytes — RSA private key, begins with -----BEGIN PRIVATE KEY-----)
```

Confirmed via `git ls-files ssl/` → both files are tracked.
Confirmed via `git log --oneline -- ssl/` → introduced in commit `3219923` ("v0.2.0: Add Docker deployment support").

**`.gitignore` (lines 1-37):**
```
# Dependencies
node_modules/

# Build output
dist/
build/

# Environment variables
.env
.env.local
.env.*.local
.env.test

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# OS
Thumbs.db

# Logs
*.log
logs/

# Testing
coverage/
.nyc_output/

# MCP configuration (contains credentials)
.filemaker-mcp/

# Misc
*.bak
*.tmp
```

No entry for `ssl/`, `*.pem`, `*.key`, or `*.crt`.

**`.dockerignore` (line 25):**
The `.dockerignore` already excludes `*.md` and dev files but does NOT exclude `ssl/` — however, since `ssl/` is only used for HTTPS transport cert paths configured via env vars, it's not copied into the Docker image by the Dockerfile (which only copies `dist/` and `LICENSE`).

**Repo conventions:**
- Commit style: conventional commits (`fix:`, `chore:`, `docs:` — see `git log --oneline -20`)
- The `ssl/` directory appears to have been added as sample/default certificates for local HTTPS testing

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Build     | `npm run build`          | exit 0              |
| Tests     | `npm test`               | all pass            |
| Typecheck | `npm run typecheck`      | exit 0 (if Plan 001 landed) |

## Scope

**In scope** (the only files you should modify):
- `ssl/key.pem` — delete from git tracking
- `ssl/cert.pem` — delete from git tracking (the certificate is public information, but since the key is burned, the cert must be regenerated too; remove both together)
- `.gitignore` — add entries to prevent future commits of private keys
- `README.md` — update any documentation that references the bundled `ssl/` certificates
- `DOCKER.md` — update if it references the bundled certificates
- `.env.example` — update HTTPS cert path comments if they reference `ssl/`

**Out of scope** (do NOT touch):
- `src/` — no source code changes (the code reads cert paths from env vars, not the `ssl/` directory)
- `Dockerfile` — already only copies `dist/` and `LICENSE`
- Git history rewriting — this is a manual maintainer step (see "Maintenance notes")

## Git workflow

- Branch: `advisor/002-scrub-tls-key`
- Commit per logical unit; message style: conventional commits
- Do NOT push or open a PR unless the operator instructed it.
- **IMPORTANT**: This plan does NOT rewrite git history. The key remains in historical commits until the maintainer performs the history scrub (documented in Maintenance notes). The working-tree removal prevents future exposure but does not retroactively protect the key.

## Steps

### Step 1: Remove ssl/ from git tracking

Remove the `ssl/` directory from git tracking without deleting the files from the working tree (in case the maintainer needs them locally):

```bash
git rm --cached ssl/key.pem ssl/cert.pem
```

This stages the deletion from git but leaves the files on disk.

**Verify**: `git status` → shows `ssl/key.pem` and `ssl/cert.pem` as deleted from the index. `ls ssl/` → files still exist on disk.

### Step 2: Add ssl/ and key patterns to .gitignore

Add the following entries to `.gitignore`, in a new "SSL certificates and keys" section (after the "MCP configuration" section, before "Misc"):

```
# SSL certificates and keys (never commit private keys)
ssl/
*.pem
*.key
*.crt
```

**Verify**: `git status` → `ssl/` files no longer show as untracked (they're now ignored). `git check-ignore ssl/key.pem` → outputs `ssl/key.pem` (confirming it's ignored).

### Step 3: Update documentation references to bundled ssl/ certificates

Search for references to `ssl/` or the bundled certificates in documentation:

```bash
grep -rn "ssl/" README.md DOCKER.md .env.example CHANGELOG.md 2>/dev/null
```

Update any references that tell users to use the bundled `ssl/cert.pem` and `ssl/key.pem`. Replace with instructions to generate their own self-signed certificate for local testing:

For `.env.example` (if it references ssl/ paths), update the commented-out HTTPS cert paths:
```
# HTTPS Certificate Paths (only needed if MCP_TRANSPORT is https)
# Generate your own self-signed cert for local testing:
#   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
# MCP_CERT_PATH=/path/to/certificate.pem
# MCP_KEY_PATH=/path/to/private-key.pem
```

For `README.md` and `DOCKER.md`, update any HTTPS setup sections to instruct users to provide their own certificates rather than referencing the bundled ones.

**Verify**: `grep -rn "ssl/" README.md DOCKER.md .env.example` → no references to bundled `ssl/cert.pem` or `ssl/key.pem` as default paths. Documentation instructs users to generate their own certificates.

### Step 4: Commit the removal

Stage all changes and commit:

```bash
git add .gitignore README.md DOCKER.md .env.example
git commit -m "fix(security): remove committed TLS private key from git tracking

The ssl/key.pem private key has been in the repository since v0.2.0.
Remove it from tracking and add .gitignore patterns for ssl/, *.pem,
*.key, *.crt. The key must be rotated and git history scrubbed
separately (see plan maintenance notes)."
```

**Verify**: `git log --oneline -1` → shows the commit. `git ls-files ssl/` → empty (no tracked files in ssl/).

### Step 5: Verify build and tests still pass

The source code reads cert paths from `MCP_CERT_PATH` and `MCP_KEY_PATH` env vars, not from the `ssl/` directory directly, so removing the files from git should not affect functionality.

**Verify**: `npm install && npm run build && npm test` → all exit 0

## Test plan

- No new tests to write — this is a security remediation that removes files from git tracking.
- Verification: `git ls-files ssl/` returns empty; `git check-ignore ssl/key.pem` confirms the file is ignored.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `git ls-files ssl/` returns no output (files no longer tracked)
- [ ] `git check-ignore ssl/key.pem` outputs `ssl/key.pem` (confirmed ignored)
- [ ] `.gitignore` contains `ssl/`, `*.pem`, `*.key`, `*.crt` entries
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] No references to bundled `ssl/cert.pem` or `ssl/key.pem` as default paths in `README.md`, `DOCKER.md`, or `.env.example`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `ssl/` directory or files don't exist (they may have already been removed).
- Source code in `src/` directly references `ssl/key.pem` or `ssl/cert.pem` as hardcoded paths (it shouldn't — the code uses env vars — but if it does, STOP and report; a code change would be needed).
- `npm run build` or `npm test` fails after the removal (indicates a hidden dependency on the ssl/ files).

## Maintenance notes

**CRITICAL — Manual steps the maintainer must perform after this plan lands:**

1. **Rotate the TLS certificate**: The committed key is burned. Generate a new keypair:
   ```bash
   openssl req -x509 -newkey rsa:4096 -keyout new-key.pem -out new-cert.pem -days 365 -nodes
   ```
   Deploy the new certificate to all HTTPS MCP transport instances.

2. **Scrub git history**: The key remains in historical commits. Use `git filter-repo` or BFG Repo-Cleaner:
   ```bash
   # Using git filter-repo (recommended)
   git filter-repo --path ssl/key.pem --invert-paths
   # Or using BFG
   bfg --delete-files key.pem
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   ```
   This rewrites history and requires a force-push. All collaborators must re-clone. Coordinate before executing.

3. **Consider GitHub secret scanning**: If the repo is on GitHub, enable secret scanning alerts. GitHub may have already flagged the private key.

4. **Future reviewer note**: Any PR that adds `.pem`, `.key`, or `.crt` files should be scrutinized — the `.gitignore` patterns will block accidental commits, but `git add -f` can bypass this.
