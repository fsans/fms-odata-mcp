# NPM Publishing Guide

This guide walks through the process of publishing the `filemaker-odata-mcp` package to NPM.

## Prerequisites

1. **NPM Account**
   - Create an account at https://www.npmjs.com/signup
   - Verify your email address

2. **NPM CLI Login**
   ```bash
   npm login
   # Enter your username, password, and email
   ```

3. **Two-Factor Authentication** (Recommended)
   - Enable 2FA in your NPM account settings
   - Use an authenticator app for publishing

## Pre-Publishing Checklist

### 1. Verify Package Quality

```bash
# Run all unit tests
npm test

# Check test coverage
npm run test:coverage

# Build the package
npm run build

# Verify build output
ls -la dist/
```

**Expected Results:**
- ✅ All unit tests passing
- ✅ Core functionality has 80%+ coverage
- ✅ Clean build with no TypeScript errors
- ✅ `dist/` directory contains compiled JavaScript

### 2. Update Version Number

The current version is `0.2.6`. To bump the version:

```bash
# For a patch release (bug fixes)
npm version patch  # e.g., 0.2.6 -> 0.2.7

# For a minor release (new features)
npm version minor  # e.g., 0.2.6 -> 0.3.0

# For a major release
npm version major  # e.g., 0.2.6 -> 1.0.0
```

### 3. Review package.json

Ensure these fields are correct:

```json
{
  "name": "filemaker-odata-mcp",
  "version": "0.2.6",
  "description": "Model Context Protocol (MCP) server providing FileMaker Server OData 4.01 API integration",
  "author": "Francesc Sans <fsans@ntwk.es>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/fsans/FMS-ODATA-MCP.git"
  },
  "keywords": [
    "mcp",
    "model-context-protocol",
    "filemaker",
    "filemaker-server",
    "odata",
    "odata-4",
    "rest-api",
    "ai",
    "claude",
    "windsurf",
    "cursor",
    "cline",
    "llm"
  ],
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ]
}
```

### 4. Test Package Contents

```bash
# Create a tarball to see what will be published
npm pack

# Extract and inspect
tar -xzf filemaker-odata-mcp-*.tgz
ls -la package/

# Clean up
rm -rf package/ filemaker-odata-mcp-*.tgz
```

**Verify the package includes:**
- ✅ `dist/` directory with compiled code
- ✅ `README.md`
- ✅ `LICENSE` file
- ❌ No `node_modules/`
- ❌ No test files
- ❌ No source `.ts` files

## Publishing Steps

### Option 1: Publish a New Patch/Minor/Major Release

```bash
# 1. Bump version (choose one)
npm version patch   # bug fixes
npm version minor   # new features
npm version major   # breaking changes

# 2. Build
npm run build

# 3. Run tests
npm test

# 4. Publish to NPM
npm publish

# 5. Push tag to GitHub
git push origin main --tags
```

### Option 2: Publish Beta/RC Version

For testing before stable release:

```bash
# Publish as beta
npm version 0.3.0-beta.1
npm publish --tag beta

# Users install with:
# npm install filemaker-odata-mcp@beta
```

### Option 3: Publish with Dry Run

Test publishing without actually publishing:

```bash
npm publish --dry-run
```

## Post-Publishing Tasks

### 1. Verify Publication

```bash
# Check on NPM
npm view filemaker-odata-mcp

# Install in a test project
mkdir test-install
cd test-install
npm init -y
npm install filemaker-odata-mcp

# Test via npx
npx filemaker-odata-mcp --help
```

### 2. Update Documentation

- Add installation badge to README
- Update version references in documentation
- Announce release in GitHub releases (once repo is created)

### 3. Create GitHub Release

Once the GitHub repository is created:

1. Go to https://github.com/fsans/FMS-ODATA-MCP/releases
2. Click "Create a new release"
3. Select the tag (e.g., `v1.0.0`)
4. Add release notes:

```markdown
## Features
- MCP server for FileMaker Server OData 4.01 API
- 19 tools for database introspection and CRUD operations
- HTTP/HTTPS transport for standalone server mode
- Docker deployment support
- Connection management with saved/default connections
- SSL support for self-signed certificates

## Installation
\`\`\`bash
npm install -g filemaker-odata-mcp
# or via npx (no install needed)
npx filemaker-odata-mcp
\`\`\`

## Documentation
- [Quick Start](./dev_stuf/QUICK_START_TEST.md)
- [Claude Desktop Setup](./dev_stuf/CLAUDE_DESKTOP_SETUP.md)
- [Prompt Reference](./dev_stuf/CLAUDE_DESKTOP_PROMPTS.md)
```

## Troubleshooting

### Package is already published

The package `filemaker-odata-mcp` is already live on NPM. Check current state:

```bash
npm view filemaker-odata-mcp
```

For scoped alternatives if needed:
- `@your-username/filemaker-odata-mcp`

### "Need to authenticate"

```bash
npm login
# Re-enter your credentials
```

### "403 Forbidden"

- Verify you're logged in: `npm whoami`
- Check package name isn't taken
- Verify you have publish rights

### "Files missing in package"

Check `.npmignore` or `package.json` `files` field:

```json
"files": [
  "dist",
  "README.md",
  "LICENSE"
]
```

## Updating an Existing Package

```bash
# 1. Make changes
# 2. Update version
npm version patch  # or minor/major

# 3. Build and test
npm run build
npm test

# 4. Publish
npm publish

# 5. Commit and tag
git add .
git commit -m "Release vX.X.X"
git tag -a vX.X.X -m "Release vX.X.X"
git push origin master --tags
```

## NPM Scripts Reference

```bash
npm run build          # Compile TypeScript
npm test              # Run unit tests
npm run test:coverage # Run tests with coverage
npm run dev           # Build and run
npm pack              # Create tarball for inspection
npm publish           # Publish to NPM
npm version <type>    # Bump version (patch/minor/major)
```

## Security Best Practices

1. **Enable 2FA** on your NPM account
2. **Use npm automation tokens** for CI/CD
3. **Review package contents** before publishing
4. **Keep dependencies updated** regularly
5. **Use `npm audit`** to check for vulnerabilities

## Resources

- [NPM Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org/)
- [package.json documentation](https://docs.npmjs.com/cli/v8/configuring-npm/package-json)
