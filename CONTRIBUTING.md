# Contributing to fms-odata-mcp

Thank you for your interest in contributing! This guide will help you set up your
development environment and understand the project structure.

## Development Setup

### Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** (comes with Node.js)
- **Git**
- **FileMaker Server** (for integration testing)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/fsans/fms-odata-mcp.git
cd fms-odata-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Project Structure

```
fms-odata-mcp/
├── src/
│   ├── index.ts           # MCP server entry point
│   ├── config.ts          # Configuration management
│   ├── connection.ts      # Connection manager
│   ├── odata-client.ts    # OData HTTP client
│   ├── odata-parser.ts    # OData response parser
│   ├── logger.ts          # Logging utilities
│   ├── transport.ts       # MCP transport layer
│   └── tools/             # MCP tool implementations
│       ├── index.ts       # Tool registry
│       ├── connection.ts  # Connection tools
│       ├── configuration.ts # Config tools
│       ├── odata.ts       # OData operation tools
│       └── schema.ts      # Schema (DDL) editing tools
├── tests/
│   ├── unit/              # Unit tests (run by default)
│   └── integration/       # Integration tests (require live server)
├── dev_stuf/              # Detailed documentation
│   ├── QUICK_REFERENCE.md
│   ├── CLAUDE_DESKTOP_SETUP.md
│   ├── CLAUDE_DESKTOP_PROMPTS.md
│   ├── NPM_PUBLISHING.md
│   ├── DEPLOYMENT_SCENARIOS.md
│   └── ...
├── private/               # Working docs (git-ignored)
│   └── ...
└── dist/                  # Compiled JavaScript (git-ignored)
```

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

- Write clean, well-documented code
- Follow existing code style (TypeScript, ESM modules)
- Add unit tests for new functionality
- Update documentation as needed

### 3. Run Tests

```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### 4. Build and Test

```bash
# Build the project
npm run build

# Test the build
node dist/index.js
```

### 5. Commit Your Changes

```bash
git add .
git commit -m "feat: add new feature"
```

We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test changes
- `chore:` Maintenance tasks

### 6. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Adding New MCP Tools

### 1. Define the Tool

Add your tool definition to the appropriate file in `src/tools/`:

```typescript
// src/tools/your-tools.ts
export const yourTools = [
  {
    name: "fm_odata_your_tool",
    description: "Description of what your tool does",
    inputSchema: {
      type: "object",
      properties: {
        param1: {
          type: "string",
          description: "Parameter description",
        },
      },
      required: ["param1"],
    },
  },
];
```

### 2. Implement the Handler

```typescript
export async function handleYourTool(name: string, args: any): Promise<any> {
  try {
    switch (name) {
      case "fm_odata_your_tool":
        return await handleYourToolLogic(args);
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}

async function handleYourToolLogic(args: any) {
  // Implementation here
  return {
    content: [{ type: "text", text: "Success!" }],
  };
}
```

### 3. Register the Tool

Update `src/tools/index.ts`:

```typescript
import { yourTools, handleYourTool } from "./your-tools.js";

export const allTools = [
  ...connectionTools,
  ...configurationTools,
  ...odataTools,
  ...yourTools, // Add your tools
];
```

### 4. Add Tests

Create unit tests in `tests/unit/tools/`:

```typescript
// tests/unit/tools/your-tools.test.ts
import { describe, it, expect } from "@jest/globals";
import { yourTools, handleYourTool } from "../../../src/tools/your-tools.js";

describe("Your Tools", () => {
  it("should have correct tool definition", () => {
    expect(yourTools).toHaveLength(1);
    expect(yourTools[0].name).toBe("fm_odata_your_tool");
  });

  it("should handle tool execution", async () => {
    const result = await handleYourTool("fm_odata_your_tool", {
      param1: "test",
    });
    expect(result.content[0].text).toContain("Success");
  });
});
```

## Testing Guidelines

### Unit Tests

- Located in `tests/unit/`
- Run by default with `npm test`
- Mock external dependencies
- Focus on business logic

### Integration Tests

- Located in `tests/integration/`
- Require a live FileMaker Server
- Test real-world scenarios
- Not run by default (use Jest directly)

### Test Coverage Goals

- **Core modules**: 80%+ coverage
- **Tools**: Unit tests for each tool
- **Critical paths**: 100% coverage

## Code Style

- **TypeScript**: Strict mode enabled
- **ESM**: Use ES modules (`import`/`export`)
- **Formatting**: Consistent with existing code
- **Comments**: Document complex logic
- **Types**: Prefer explicit types over `any`

## Debugging

### Local Development

```bash
# Run with debug logging
DEBUG=* node dist/index.js

# Test with Claude Desktop
# Update claude_desktop_config.json to point to local build
{
  "command": "node",
  "args": ["/path/to/fms-odata-mcp/dist/index.js"]
}
```

### Common Issues

1. **SSL Certificate Errors**: Set `FM_VERIFY_SSL=false` for development
2. **Connection Timeout**: Increase `FM_TIMEOUT` value
3. **Build Errors**: Run `npm run build` after code changes

## Documentation

### User Documentation

- Update `README.md` for user-facing changes
- Add examples to `dev_stuf/CLAUDE_DESKTOP_PROMPTS.md`
- Update Quick Reference if needed

### Developer Documentation

- Update `ROADMAP.md` for new features and completed work
- Update `CHANGELOG.md` for release notes
- Update `README.md` for user-facing changes

## Detailed Guides

For more detailed information, see:

- **[NPM Publishing](./dev_stuf/NPM_PUBLISHING.md)** - How to publish new versions
- **[Roadmap](../ROADMAP.md)** - Completed and planned features
- **[Implementation Plans](../private/IMPLEMENTATION_PLANS.md)** - Phase-by-phase feature breakdowns (private)

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Run all tests: `npm test && npm run test:coverage`
4. Build: `npm run build`
5. Test package: `npm pack` and inspect contents
6. Publish: Follow `dev_stuf/NPM_PUBLISHING.md`
7. Tag release: `git tag -a v1.0.0 -m "Release v1.0.0"`
8. Push: `git push origin master --tags`

## Getting Help

- **Questions**: Open a [GitHub Discussion](https://github.com/fsans/fms-odata-mcp/discussions)
- **Bugs**: Open a [GitHub Issue](https://github.com/fsans/fms-odata-mcp/issues)
- **Security**: Email security concerns to fsans@ntwk.es

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Give constructive feedback
- Focus on collaboration

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to fms-odata-mcp! 🎉
