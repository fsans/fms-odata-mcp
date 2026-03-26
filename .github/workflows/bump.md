---
description: Bump project version (build number) with git commit and tag
---

# Bump Version Workflow

## Overview
This workflow automates the process of bumping the project version, committing all changes, creating a git tag, and pushing to remote.

By default, bumps the patch number (3rd value in semantic versioning, e.g., 1.0.1 → 1.0.2).

Add `[major|minor|patch]` to bump the corresponding segment. Lower segments are always reset to 0:
- `patch` (default): 1.2.3 → 1.2.4
- `minor`: 1.2.3 → 1.3.0 (patch reset)
- `major`: 1.2.3 → 2.0.0 (minor and patch reset)

Add `silent` to skip all confirmations and verbose output.

Add `dry-run` to preview what would happen without making any changes.

### Examples:

/bump
/bump silent
/bump major
/bump minor
/bump patch
/bump major silent
/bump minor dry-run

## Steps

1. **Pre-flight checks**
   - Verify the current branch is `main` or `master`. If on any other branch, warn the user:
     > ⚠️ You are on branch `<branch-name>`, not `main`/`master`. Version bumps on feature branches can create messy tag histories.
     - In normal mode: ask for confirmation to proceed anyway.
     - In silent mode: abort with an error message.
   - Check for a dirty working tree (`git status --porcelain`):
     - If there are uncommitted changes, inform the user:
       > ℹ️ There are uncommitted changes. They will be staged and included in the version bump commit.
     - If there are no uncommitted changes, inform the user:
       > ℹ️ No pending changes. The commit will contain only the version file update.

2. **Detect current version**
   - Read the current version depending on the project type, from:

     1. Maven: `pom.xml` → `<project><version>`; if missing, check `<project><parent><version>` or `<project><properties>`.
        - If the project has submodule `pom.xml` files, update their versions as well.
     2. Node: `package.json` → `version`.
     3. Dart: `pubspec.yaml` → `version`.
        - The version may include build metadata (e.g., `1.0.0+42`). Strip the `+build` suffix before processing, and drop it permanently in the updated version (do not re-append).
     4. Python: prefer `pyproject.toml` → `[project].version` or `[tool.poetry].version`; else `setup.cfg` → `[metadata] version`; else `setup.py` → `setup(version=...)`.
     5. Rust: `Cargo.toml` → `[package].version`.

   - If no version file is found, default to `1.0.0`.

3. **Calculate new version**
   - Parse the current version as `MAJOR.MINOR.PATCH`.
   - Increment the specified segment and reset lower segments to 0:
     - `patch` (default): increment PATCH only → `MAJOR.MINOR.(PATCH+1)`
     - `minor`: increment MINOR, reset PATCH → `MAJOR.(MINOR+1).0`
     - `major`: increment MAJOR, reset MINOR and PATCH → `(MAJOR+1).0.0`

4. **Check for tag collision**
   - Run: `git tag --list "vX.Y.Z"`
   - If the tag already exists, abort immediately with:
     > ❌ Tag `vX.Y.Z` already exists. Cannot proceed with version bump.

5. **Confirm version bump** (unless `silent` or `dry-run` mode is used)
   - Display current and new version numbers.
   - Ask for user confirmation before proceeding.
   - If user declines, stop the workflow without making any changes.

6. **Dry-run output** (only if `dry-run` mode is used)
   - Display a summary of all actions that *would* be taken, without executing any of them:
     - Version file(s) that would be updated
     - Old version → new version
     - Commit message that would be used
     - Tag that would be created
     - Remote push commands that would be run
   - Stop here — make no changes.

7. **Update version files**
   - Update the corresponding files as described in Step 2.

8. **Stage and commit changes**
   - Stage all untracked and modified files: `git add -A`
   - Commit with message: `chore: bump version to X.Y.Z`

9. **Create git tag**
   - Create annotated tag: `vX.Y.Z`
   - Tag message: `Release version X.Y.Z`

10. **Push to remote**
    - Push commits to origin.
    - Push tag to origin.

11. **Display summary**
    - Show confirmation of all completed actions.
    - Display the version bump details (old version → new version).
    - List all files that were updated.
    - Show the tag and branch that were pushed.

## Usage

**Normal mode with confirmation:**
```
/bump
```

**Silent mode (skip all confirmations):**
```
/bump silent
```

**Dry-run mode (preview only, no changes):**
```
/bump patch dry-run
```

**Bump version segment:**
```
/bump major
/bump minor
/bump patch
```

**Combined flags:**
```
/bump major silent
/bump minor dry-run
```

## Notes

- The workflow always displays the final summary, even in silent mode.
- In `dry-run` mode, no files are modified, no commits are made, and no tags or pushes are performed.
- If a confirmation is declined in normal mode, the workflow stops without making any changes.
- Unless indicated otherwise, all pending changes are staged and committed together with the version file update in a single commit.
- Version files are updated before committing, so all changes are included in one commit.
- The tag is created locally and pushed along with the commit.
- Silent mode will abort (rather than auto-confirm) if a blocking issue is detected, such as being on a non-main branch or a tag collision.
- When updating the version do not update this file
