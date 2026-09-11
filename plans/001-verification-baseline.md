# Plan 001: Establish verification baseline (typecheck, lint, CI quality gate)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2829524..HEAD -- package.json .github/workflows/ jest.config.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `2829524`, 2026-07-16

## Why this matters

The repo has no working verification baseline. `node_modules` is absent in the working tree, `npm test` fails with `Cannot find module jest`, there is no `typecheck` or `lint` npm script, and the only CI workflow (`.github/workflows/docker.yml`) builds and publishes a Docker image without running tests, typecheck, or lint. This means broken code can be published without any quality gate. Every other plan in this set depends on a working `npm install → npm test → tsc --noEmit` cycle to verify its changes.

## Current state

**`package.json` scripts (lines 15-28):**
```json
"scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsc && node dist/index.js",
    "watch": "tsc --watch",
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js",
    "test:watch": "node --experimental-vm-modules node_modules/jest/bin/jest.js --watch",
    "test:coverage": "node --experimental-vm-modules node_modules/jest/bin/jest.js --coverage",
    "prepublishOnly": "npm run build",
    "docker:build": "docker build -t filemaker-odata-mcp:local .",
    "docker:run": "docker run -d --name filemaker-odata-mcp -p 3333:3333 filemaker-odata-mcp:local",
    "docker:stop": "docker stop filemaker-odata-mcp && docker rm filemaker-odata-mcp",
    "docker:test": "./test-docker.sh"
}
```
No `typecheck` or `lint` script exists. `prepublishOnly` only builds, doesn't test.

**CI workflow `.github/workflows/docker.yml` (lines 14-35):**
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
    - name: Checkout repository
      uses: actions/checkout@v4
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    - name: Install dependencies
      run: npm ci
    - name: Build project
      run: npm run build
```
No test, typecheck, or lint step. The job goes straight from build to Docker image build/push.

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
  // ...
};
```
`testMatch` only matches `tests/unit/**` — integration tests in `tests/integration/tools/` are silently skipped. (This is addressed separately in Plan 004.)

**Repo conventions:**
- TypeScript strict mode, ES Modules (Node16 module system — imports use `.js` extensions for `.ts` source files)
- Build: `npm run build` (tsc → `dist/`)
- Tests: `npm test` (jest with ts-jest ESM preset)
- No ESLint or Prettier config exists in the repo
- `.markdownlint.json` exists but has no npm script to run it
- Commit style: conventional commits (e.g., `feat:`, `fix:`, `docs:`, `chore:`, `style:` — see `git log --oneline -20`)

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0, creates node_modules/ |
| Build     | `npm run build`          | exit 0, dist/ populated |
| Typecheck | `npm run typecheck`      | exit 0, no errors (NEW script) |
| Tests     | `npm test`               | all pass |
| Lint      | `npm run lint`           | exit 0 (NEW script, may need config) |

## Scope

**In scope** (the only files you should modify):
- `package.json` — add `typecheck` and `lint` scripts, update `prepublishOnly`
- `.github/workflows/docker.yml` — add a `test` job that runs before the Docker build
- `jest.config.js` — no changes in this plan (integration test wiring is Plan 004)

**Out of scope** (do NOT touch):
- `src/` — no source code changes
- `tests/` — no test changes
- `tsconfig.json` — already has strict mode; no changes needed
- `.eslintrc.*` — do NOT add ESLint config in this plan; the `lint` script should use `tsc --noEmit` as the initial linting mechanism to avoid adding new dependencies. ESLint can be added in a future plan.

## Git workflow

- Branch: `advisor/001-verification-baseline`
- Commit per logical unit; message style: conventional commits
  - Example from repo: `chore: bump version to 0.5.1` or `fix: upgrade MCP SDK to 1.29.0`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Install dependencies and confirm current test suite works

Run `npm install` to create `node_modules/`, then run the existing test suite to confirm it passes before making changes.

**Verify**: `npm install && npm test` → exit 0, all tests pass (7 test files, ~100+ tests)

### Step 2: Add `typecheck` script to package.json

Add a `typecheck` script that runs `tsc --noEmit` (type-checking without emitting output). Insert it after the `"build"` script:

```json
"typecheck": "tsc --noEmit",
```

**Verify**: `npm run typecheck` → exit 0, no TypeScript errors

### Step 3: Add `lint` script to package.json

Since no ESLint config exists and we don't want to add new dependencies in this plan, use `tsc --noEmit` as the initial linting check. Add after `typecheck`:

```json
"lint": "tsc --noEmit",
```

Note: This is a minimal linting gate. A future plan can add ESLint with style rules. The goal here is to have a `npm run lint` command that CI can call.

**Verify**: `npm run lint` → exit 0

### Step 4: Update `prepublishOnly` to include typecheck and test

Change the `prepublishOnly` script to run build, typecheck, and test before publishing:

```json
"prepublishOnly": "npm run build && npm run typecheck && npm test",
```

**Verify**: `npm run prepublishOnly` → exit 0 (builds, typechecks, and tests all pass)

### Step 5: Add a `test` job to the CI workflow

Add a new `test` job in `.github/workflows/docker.yml` that runs before the existing `build` job. The `build` job should depend on `test` succeeding. Insert the new job before the existing `build:` job key:

```yaml
  test:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Typecheck
      run: npm run typecheck

    - name: Run tests
      run: npm test

    - name: Build
      run: npm run build
```

Then add `needs: test` to the existing `build` job:

```yaml
  build:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
```

**Verify**: Read the workflow file and confirm the `test` job appears before `build` and `build` has `needs: test`. If you have the `gh` CLI or `act` tool available, optionally validate the YAML syntax. Otherwise, confirm by reading the file structure.

### Step 6: Run full local verification

Run all the commands that CI will now run, in order:

**Verify**: 
```
npm install && npm run typecheck && npm test && npm run build
```
→ all exit 0, no errors

## Test plan

- No new tests to write in this plan — the goal is to make existing tests runnable in CI.
- Verification: `npm test` → all existing tests pass (7 test files in `tests/unit/`)

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm install` exits 0
- [ ] `npm run typecheck` exits 0 with no errors
- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0 (all existing tests pass)
- [ ] `npm run build` exits 0
- [ ] `npm run prepublishOnly` exits 0 (runs build + typecheck + test)
- [ ] `package.json` has `typecheck` and `lint` scripts
- [ ] `.github/workflows/docker.yml` has a `test` job with `npm ci`, `npm run typecheck`, `npm test`, `npm run build`
- [ ] `.github/workflows/docker.yml` `build` job has `needs: test`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `npm install` fails (network issues, broken package-lock.json) — report the error.
- `npm test` fails after `npm install` even before your changes — there may be pre-existing test failures; report them.
- `npm run typecheck` reports TypeScript errors in the existing codebase — there may be pre-existing type errors; report them (do NOT fix them in this plan).
- The `.github/workflows/docker.yml` file has changed significantly from the excerpts above (the codebase has drifted).

## Maintenance notes

- Future plans that add ESLint should update the `lint` script to `eslint src/**/*.ts && tsc --noEmit` or similar.
- When Plan 004 (wire integration tests) lands, the CI `test` job will automatically pick up the new testMatch pattern — no CI changes needed.
- When Plan 007 (Node.js EOL upgrade) lands, update the `node-version: '18'` in both the `test` and `build` jobs.
- A reviewer should scrutinize that `prepublishOnly` doesn't make publishing impossible if tests are flaky — consider `-- --ci` flag for jest if flakiness becomes an issue.
