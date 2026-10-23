import * as os from "os";
import * as path from "path";
import * as fs from "fs";

/**
 * Global per-test-file environment isolation.
 *
 * Jest runs this setup file before each test file's module registry, giving
 * every test file a pristine, isolated environment:
 *
 *  - HOME / USERPROFILE point to a fresh temp directory, so config.ts never
 *    reads (or writes) the developer's real ~/.fms-odata-mcp/config.json or
 *    ~/.fms-odata-mcp/.env. Without this, any test that reaches
 *    ConnectionManager.getCurrentClient() on a machine with a real
 *    defaultConnection would attempt live HTTP calls and time out.
 *  - FM_* / MCP_* credentials and transport env vars are removed so tests
 *    only see the fixtures they set themselves.
 *
 * Individual tests may still override HOME (e.g. config.test.ts) — they are
 * responsible for restoring it.
 */
const isolatedHome = fs.mkdtempSync(
  path.join(os.tmpdir(), "fms-odata-mcp-jest-home-")
);

process.env.HOME = isolatedHome;
process.env.USERPROFILE = isolatedHome;

for (const key of Object.keys(process.env)) {
  if (key.startsWith("FM_") || key.startsWith("MCP_")) {
    delete process.env[key];
  }
}
