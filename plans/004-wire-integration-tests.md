# Plan 004: Wire up integration tests so they run with `npm test`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3705083..HEAD -- jest.config.js tests/integration/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-verification-baseline.md (needs `npm install` and `npm test` working)
- **Category**: tests
- **Planned at**: commit `2829524`, 2026-07-16
- **Reconciled at**: commit `3705083`, 2026-09-11 — unit test count updated (8 files now, `schema-tools.test.ts` added)

## Why this matters

Three integration test files (~800 lines total) exist in `tests/integration/tools/` but are never executed. The jest configuration (`jest.config.js:17`) restricts `testMatch` to `**/tests/unit/**/*.test.ts` only, silently skipping all integration tests. These tests use `jest.mock()` for all external dependencies (config, connection manager, OData parser) and do NOT require a live FileMaker server — they are effectively unit tests for the tool handler layer, misclassified by directory location. Wiring them up is a one-line config change that immediately adds ~800 lines of test coverage for the tool handlers (`src/tools/odata.ts`, `src/tools/connection.ts`, `src/tools/configuration.ts`).

## Current state

**`jest.config.js` (full file, 25 lines):**
```js
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  testMatch: [
    '**/tests/unit/**/*.test.ts',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
```

Line 17: `testMatch` is `['**/tests/unit/**/*.test.ts']` — only matches `tests/unit/`.

**Integration test files that exist but are not run:**
- `tests/integration/tools/odata.test.ts` (328 lines) — tests OData tool handlers with mocked ODataClient
- `tests/integration/tools/connection.test.ts` (241 lines) — tests connection tool handlers with mocked ConnectionManager
- `tests/integration/tools/configuration.test.ts` (230 lines) — tests configuration tool handlers with mocked config module

All three use `jest.mock()` to mock `../connection.js`, `../config.js`, `../odata-parser.js`, etc. — no live FileMaker server needed.

**Existing unit tests (already running — 8 files as of `3705083`):**
- `tests/unit/config-helpers.test.ts` (35 lines)
- `tests/unit/config.test.ts` (372 lines)
- `tests/unit/fm-version.test.ts` (536 lines)
- `tests/unit/multi-session.test.ts` (255 lines)
- `tests/unit/odata-client.test.ts` (491 lines)
- `tests/unit/odata-parser.test.ts` (574 lines)
- `tests/unit/schema-tools.test.ts` (308 lines — added post-audit)
- `tests/unit/tool-routing.test.ts` (141 lines)

**Repo conventions:**
- Tests use `@jest/globals` (`describe`, `it`, `expect`, `jest`, `beforeEach`, `beforeAll`)
- Test files end in `.test.ts`
- ESM module system: imports use `.js` extensions for `.ts` source files
- Commit style: conventional commits (`test:`, `fix:`, `chore:` — see `git log --oneline -20`)

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Tests     | `npm test`               | all pass, including new integration tests |
| Test count| `npm test -- --verbose 2>&1 \| grep "Test Files\|Tests"` | shows 11 test files (8 unit + 3 integration) |

## Scope

**In scope** (the only files you should modify):
- `jest.config.js` — update `testMatch` to include integration tests

**Out of scope** (do NOT touch):
- `tests/integration/tools/*.test.ts` — do NOT modify the test files themselves; if any fail, report them (see STOP conditions)
- `src/` — no source code changes
- `tests/unit/` — no changes to existing unit tests

## Git workflow

- Branch: `advisor/004-wire-integration-tests`
- Commit per logical unit; message style: conventional commits
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm current test suite passes (baseline)

Ensure dependencies are installed and the current unit tests pass before making changes:

**Verify**: `npm install && npm test` → exit 0, all 8 unit test files pass

### Step 2: Update testMatch in jest.config.js

Change the `testMatch` array (line 17) from:
```js
  testMatch: [
    '**/tests/unit/**/*.test.ts',
  ],
```
to:
```js
  testMatch: [
    '**/tests/unit/**/*.test.ts',
    '**/tests/integration/**/*.test.ts',
  ],
```

This adds a second glob pattern that matches the integration test files. Both patterns are active — unit tests continue to run, and integration tests are now included.

**Verify**: Read `jest.config.js` and confirm both patterns are present in the `testMatch` array.

### Step 3: Run the full test suite and check for failures

Run `npm test` with the new config. All 11 test files (8 unit + 3 integration) should now run. If any integration tests fail, DO NOT fix them in this plan — report the failures as a STOP condition. The integration tests may have been written against an older version of the tool handlers and may need updates (that would be a separate plan).

**Verify**: `npm test` → exit 0, all tests pass. Check the output for the number of test files run — should be 11 (8 unit + 3 integration).

If any tests fail, run `npm test -- tests/integration/ 2>&1 | tail -50` to see the specific failures and report them.

### Step 4: Commit the change

```bash
git add jest.config.js
git commit -m "test: include integration tests in npm test run

jest.config.js testMatch only matched tests/unit/**, silently
skipping 3 integration test files (~800 lines) that use mocks
and don't need a live FileMaker server. Add a second glob
pattern to include tests/integration/**."
```

**Verify**: `git log --oneline -1` → shows the commit. `npm test` → all pass.

## Test plan

- No new tests to write — this plan makes existing tests run.
- Verification: `npm test` → 11 test files, all pass. The output should show test suites from both `tests/unit/` and `tests/integration/tools/`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `jest.config.js` `testMatch` array contains both `**/tests/unit/**/*.test.ts` and `**/tests/integration/**/*.test.ts`
- [ ] `npm test` exits 0
- [ ] `npm test` output shows 11 test files (8 unit + 3 integration) — verify by checking the jest summary output
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Integration tests fail after updating `testMatch` — the tests may have been written against an older API. Report the specific failures (test names, error messages). Do NOT modify the test files or source code to make them pass — that requires a separate plan.
- The `jest.config.js` file has changed significantly from the excerpt above (the codebase has drifted).
- The integration test files don't exist at `tests/integration/tools/` (they may have been moved or deleted).

## Maintenance notes

- If integration tests fail because the tool handler API has changed (e.g., function signatures, return shapes), a follow-up plan should update the tests to match the current API. The test failures will indicate which handlers have drifted.
- Future tests should be placed in the appropriate directory based on whether they need mocks (`tests/unit/` or `tests/integration/`) — both are now run by `npm test`.
- The distinction between "unit" and "integration" in this repo is blurry (both use mocks). A future cleanup could merge them into a single `tests/` directory, but that's cosmetic and low priority.
- A reviewer should verify that the integration tests are actually testing meaningful behavior (not just asserting that mocked functions were called with the same arguments they were mocked with — that's testing the mocks, not the code).
