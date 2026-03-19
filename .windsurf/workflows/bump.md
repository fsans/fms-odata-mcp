---
description: Bump project version (build number) with git commit and tag
---

# Bump Project Version

This workflow bumps the project version and creates a git commit and tag.

## Steps

1. Check current version in package.json
2. Increment version (patch, minor, or major)
3. Update package.json with new version
4. Run npm run build to ensure everything compiles
5. Run tests to ensure everything works
6. Create git commit with version bump
7. Create git tag for the new version

## Usage

Run this workflow when you want to:
- Release a new version
- Update the build number
- Tag a specific commit for release

## Implementation

```bash
# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")

# Increment version (choose one: patch, minor, major)
npm version patch  # or minor, or major

# Build and test
npm run build
npm test

# Push changes and tag
git push origin main --tags
```
