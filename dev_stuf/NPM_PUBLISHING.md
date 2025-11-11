# NPM Publishing Guide

This guide walks through the process of publishing the `fms-odata-mcp` package to NPM.

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
- ✅ All 65 unit tests passing
- ✅ Core functionality has 80%+ coverage
- ✅ Clean build with no TypeScript errors
- ✅ `dist/` directory contains compiled JavaScript

### 2. Update Version Number

The current version is `0.1.2`. For the first stable release:

```bash
# Update to v1.0.0 for first stable release
npm version 1.0.0 --no-git-tag-version

# Or for a minor update
npm version patch  # 0.1.2 -> 0.1.3
npm version minor  # 0.1.2 -> 0.2.0
npm version major  # 0.1.2 -> 1.0.0
```

### 3. Review package.json

Ensure these fields are correct:

```json
{
  "name": "fms-odata-mcp",
  "version": "1.0.0",
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
tar -xzf fms-odata-mcp-*.tgz
ls -la package/

# Clean up
rm -rf package/ fms-odata-mcp-*.tgz
```

**Verify the package includes:**
- ✅ `dist/` directory with compiled code
- ✅ `README.md`
- ✅ `LICENSE` file
- ❌ No `node_modules/`
- ❌ No test files
- ❌ No source `.ts` files

## Publishing Steps

### Option 1: Publish Stable Release (v1.0.0)

```bash
# 1. Update version
npm version 1.0.0 --no-git-tag-version

# 2. Build
npm run build

# 3. Run tests
npm test

# 4. Publish to NPM
npm publish

# 5. Create git tag
git add package.json
git commit -m "Release v1.0.0"
git tag -a v1.0.0 -m "Release v1.0.0 - First stable release"

# 6. Push to GitHub (once repo is created)
git push origin master
git push origin v1.0.0
```

### Option 2: Publish Beta/RC Version

For testing before stable release:

```bash
# Publish as beta
npm version 1.0.0-beta.1
npm publish --tag beta

# Users install with:
# npm install fms-odata-mcp@beta
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
npm view fms-odata-mcp

# Install in a test project
mkdir test-install
cd test-install
npm init -y
npm install fms-odata-mcp

# Test the installation
node -e "const mcp = require('fms-odata-mcp'); console.log('Success!');"
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
- Connection management with SSL support
- Comprehensive documentation and examples

## Installation
\`\`\`bash
npm install fms-odata-mcp
\`\`\`

## Documentation
- [Quick Start](./QUICK_START_TEST.md)
- [Claude Desktop Setup](./CLAUDE_DESKTOP_SETUP.md)
- [Prompt Reference](./CLAUDE_DESKTOP_PROMPTS.md)
```

## Troubleshooting

### "Package name taken"

The package name `fms-odata-mcp` may already be taken. Check availability:

```bash
npm view fms-odata-mcp
```

If taken, consider alternative names:
- `filemaker-odata-mcp`
- `@your-username/fms-odata-mcp` (scoped package)

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
