# Executor dispatch — how to run a plan in a fresh agent session

Each plan file in this directory is self-contained. To execute one, open a
new agent session in this repo (e.g. a GLM-5.2 session) and paste the
dispatch prompt below, replacing `NNN` and the filename.

> **One plan at a time per checkout.** Several plans touch `package.json`,
> `jest.config.js`, and the git index — running two executors concurrently in
> the same working tree will collide. Run them sequentially, or use a
> separate `git worktree` per plan if you want parallelism.

## Dispatch prompt (paste this)

```text
You are an executor agent. Your job is to execute exactly one plan file in
this repository, nothing more.

1. Read `plans/README.md` to understand conventions (status legend,
   dependency rules), then read the plan file `plans/NNN-<name>.md`.
2. Run the plan's "Drift check" command FIRST. If it reports changes to
   in-scope files, compare the plan's "Current state" excerpts against the
   live code — the excerpts (not line numbers) are the contract. On a real
   mismatch, STOP and report; do not improvise.
3. Confirm the plan's dependencies are satisfied (see the "Depends on" row
   and the status table in `plans/README.md`). If a dependency is not done,
   STOP and report.
4. Follow the plan's steps in order. Run every verification command and
   confirm the expected result before moving on.
5. Create the branch named in the plan's "Git workflow" section
   (`advisor/NNN-<slug>`). Use conventional-commit messages.
6. Do NOT push, do NOT open a PR, and do NOT merge into master or
   fix/improvement.
7. Do NOT update `plans/README.md` — the reviewer maintains the index.
   (This overrides the status-update instruction inside the plan.)
8. If any "STOP condition" triggers, stop immediately and report what you
   found — do not attempt workarounds.
9. When finished, output:
   - the done-criteria checklist with each item marked pass/fail
   - the exact output of each verification command
   - `git status` and `git log --oneline -3`
   - anything you skipped or deviated from, and why
```

## Per-plan invocations

Replace `NNN` in the prompt with the plan number, e.g.:

| Wave | Plan | Prompt suffix |
|------|------|---------------|
| 1 | 001 verification-baseline | `Execute plans/001-verification-baseline.md` |
| 1 | 002 scrub-tls-private-key | `Execute plans/002-scrub-tls-private-key.md` |
| 1 | 003 scrub-test-credentials | `Execute plans/003-scrub-test-credentials.md` |
| 2 | 004 wire-integration-tests | `Execute plans/004-wire-integration-tests.md` |
| 2 | 005 http-server-graceful-shutdown | `Execute plans/005-http-server-graceful-shutdown.md` |
| 2 | 008 express-dep-upgrades | `Execute plans/008-express-dep-upgrades.md` |
| 2 | 012 parseint-nan-guard | `Execute plans/012-parseint-nan-guard.md` |
| 2 | 016 metadata-cache-invalidation | `Execute plans/016-metadata-cache-invalidation.md` |
| 3 | 006 http-transport-auth | `Execute plans/006-http-transport-auth.md` |
| 3 | 007 node18-eol-upgrade | `Execute plans/007-node18-eol-upgrade.md` |
| 4 | 009 remove-dead-code | `Execute plans/009-remove-dead-code.md` |
| 4 | 010 clean-dev-stuf-docs | `Execute plans/010-clean-dev-stuf-docs.md` |
| 4 | 011 critical-path-tests | `Execute plans/011-critical-path-tests.md` |
| 5 | 013/014/015 spikes | one session per spike, anytime |

## Reviewer checklist (you or me, after each executor run)

- `git diff master...advisor/NNN-*` — every change traces to a plan step;
  reject out-of-scope edits
- Re-run the plan's done criteria locally
- Update the status row in `plans/README.md`
- Merge the `advisor/NNN-*` branch into the integration branch
  (`fix/improvement`) — never straight to master
