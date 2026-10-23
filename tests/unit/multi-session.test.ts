import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { connectionManager } from "../../src/connection";
import { handleToolCall } from "../../src/tools/index";
import { getConnection } from "../../src/config";

/**
 * Multi-session unit tests.
 *
 * These tests exercise the new multi-session tooling without a live FileMaker
 * server. All assertions rely on error messages, structural output, and
 * routing behaviour only — no real HTTP calls are made.
 */

describe("ConnectionManager — multi-session primitives", () => {
  beforeEach(() => {
    connectionManager.clearClients();
  });

  test("listActiveSessions returns empty array when no sessions are open", () => {
    expect(connectionManager.listActiveSessions()).toEqual([]);
  });

  test("createInlineClientNamed with explicit alias registers under that alias", () => {
    const connection = {
      server: "https://fms.example.com",
      database: "Logic",
      user: "admin",
      password: "secret",
    };
    const { name } = connectionManager.createInlineClientNamed(connection, false, 1000, "logic");
    expect(name).toBe("logic");

    const sessions = connectionManager.listActiveSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].name).toBe("logic");
    expect(sessions[0].database).toBe("Logic");
    expect(sessions[0].isCurrent).toBe(true);
  });

  test("createInlineClientNamed without alias generates an inline_ key", () => {
    const connection = {
      server: "https://fms.example.com",
      database: "Data",
      user: "admin",
      password: "secret",
    };
    const { name } = connectionManager.createInlineClientNamed(connection, false, 1000);
    expect(name).toMatch(/^inline_/);
  });

  test("getClientByName returns client without changing active session", () => {
    const conn1 = { server: "https://fms.example.com", database: "DB1", user: "u", password: "p" };
    const conn2 = { server: "https://fms.example.com", database: "DB2", user: "u", password: "p" };

    connectionManager.createInlineClientNamed(conn1, false, 1000, "first");
    connectionManager.createInlineClientNamed(conn2, false, 1000, "second");

    // second is now active; looking up "first" must NOT change active
    const client = connectionManager.getClientByName("first");
    expect(client).not.toBeNull();
    expect(connectionManager.getCurrentConnectionName()).toBe("second");
  });

  test("getClientByName returns null for unknown alias", () => {
    expect(connectionManager.getClientByName("nonexistent")).toBeNull();
  });

  test("listActiveSessions marks the correct session as isCurrent", () => {
    const conn1 = { server: "https://s.com", database: "A", user: "u", password: "p" };
    const conn2 = { server: "https://s.com", database: "B", user: "u", password: "p" };

    connectionManager.createInlineClientNamed(conn1, false, 1000, "alpha");
    connectionManager.createInlineClientNamed(conn2, false, 1000, "beta");

    // beta is now active (last registered)
    const sessions = connectionManager.listActiveSessions();
    const alpha = sessions.find((s) => s.name === "alpha")!;
    const beta = sessions.find((s) => s.name === "beta")!;

    expect(alpha.isCurrent).toBe(false);
    expect(beta.isCurrent).toBe(true);
  });

  test("setCurrentConnection switches to an existing inline session", () => {
    const conn1 = { server: "https://s.com", database: "A", user: "u", password: "p" };
    const conn2 = { server: "https://s.com", database: "B", user: "u", password: "p" };

    connectionManager.createInlineClientNamed(conn1, false, 1000, "alpha");
    connectionManager.createInlineClientNamed(conn2, false, 1000, "beta");

    connectionManager.setCurrentConnection("alpha");
    expect(connectionManager.getCurrentConnectionName()).toBe("alpha");
  });

  test("removeClient clears meta and unsets current if it was active", () => {
    const conn = { server: "https://s.com", database: "X", user: "u", password: "p" };
    connectionManager.createInlineClientNamed(conn, false, 1000, "toremove");

    connectionManager.removeClient("toremove");

    expect(connectionManager.listActiveSessions()).toHaveLength(0);
    expect(connectionManager.getCurrentConnectionName()).toBeUndefined();
  });
});

describe("fm_odata_list_active_sessions tool", () => {
  beforeEach(() => {
    connectionManager.clearClients();
  });

  test("returns 'No active sessions' when nothing is connected", async () => {
    const result: any = await handleToolCall("fm_odata_list_active_sessions", {});
    const text = result.content?.[0]?.text ?? "";
    expect(text).toMatch(/No active sessions/i);
    expect(result.isError).toBeFalsy();
  });

  test("routes correctly — does NOT return 'Unknown tool'", async () => {
    const result: any = await handleToolCall("fm_odata_list_active_sessions", {});
    const text = result.content?.[0]?.text ?? "";
    expect(text).not.toMatch(/Unknown tool/i);
  });

  test("lists sessions after inline connect", async () => {
    const conn = { server: "https://s.com", database: "MyDB", user: "admin", password: "pass" };
    connectionManager.createInlineClientNamed(conn, false, 1000, "mydb");

    const result: any = await handleToolCall("fm_odata_list_active_sessions", {});
    const text = result.content?.[0]?.text ?? "";
    expect(text).toMatch(/mydb/);
    expect(text).toMatch(/\[active\]/);
  });
});

describe("fm_odata_describe_sessions tool", () => {
  beforeEach(() => {
    connectionManager.clearClients();
  });

  test("returns 'No active sessions' when nothing is connected", async () => {
    const result: any = await handleToolCall("fm_odata_describe_sessions", {});
    const text = result.content?.[0]?.text ?? "";
    expect(text).toMatch(/No active sessions/i);
  });

  test("routes correctly — does NOT return 'Unknown tool'", async () => {
    const result: any = await handleToolCall("fm_odata_describe_sessions", {});
    expect(result.content?.[0]?.text).not.toMatch(/Unknown tool/i);
  });
});

describe("fm_odata_connect_multi tool — schema validation", () => {
  beforeEach(() => {
    connectionManager.clearClients();
  });

  test("routes correctly — does NOT return 'Unknown tool'", async () => {
    // Pass minimal args that will fail the connection test (no real server),
    // but the routing itself should not produce "Unknown tool".
    const result: any = await handleToolCall("fm_odata_connect_multi", {
      server: "https://no-such-server.invalid",
      user: "admin",
      password: "pass",
      databases: [{ database: "Logic", alias: "logic" }],
      verifySsl: false,
    });
    const text = result.content?.[0]?.text ?? "";
    expect(text).not.toMatch(/Unknown tool/i);
    // Should report a connection failure, not a schema error
    expect(text).toMatch(/logic/i);
  });
});

describe("OData tools — per-call 'connection' parameter targeting", () => {
  beforeEach(() => {
    connectionManager.clearClients();
  });

  test("fm_odata_query_records with unknown connection alias returns isError", async () => {
    const result: any = await handleToolCall("fm_odata_query_records", {
      table: "Contacts",
      connection: "no-such-alias",
    });
    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text).toMatch(/no-such-alias/);
  });

  test("fm_odata_get_record with unknown connection alias returns isError", async () => {
    const result: any = await handleToolCall("fm_odata_get_record", {
      table: "Contacts",
      recordId: "1",
      connection: "ghost",
    });
    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text).toMatch(/ghost/);
  });

  test("fm_odata_count_records with unknown alias returns isError", async () => {
    const result: any = await handleToolCall("fm_odata_count_records", {
      table: "Contacts",
      connection: "missing",
    });
    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text).toMatch(/missing/);
  });

  test("fm_odata_create_record with unknown alias returns isError", async () => {
    const result: any = await handleToolCall("fm_odata_create_record", {
      table: "Contacts",
      data: { FirstName: "Test" },
      connection: "nowhere",
    });
    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text).toMatch(/nowhere/);
  });

  test("fm_odata_list_tables with no session and no connection param returns 'No active connection'", async () => {
    const result: any = await handleToolCall("fm_odata_list_tables", {});
    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text).toMatch(/No active connection/i);
  });

  test("fm_odata_list_tables with unknown connection alias mentions the alias in the error", async () => {
    const result: any = await handleToolCall("fm_odata_list_tables", { connection: "no-db" });
    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text).toMatch(/no-db/);
  });
});

describe("fm_odata_set_connection — runtime alias support", () => {
  beforeEach(() => {
    connectionManager.clearClients();
  });

  test("switches to an existing inline session by alias", async () => {
    const conn1 = { server: "https://s.com", database: "A", user: "u", password: "p" };
    const conn2 = { server: "https://s.com", database: "B", user: "u", password: "p" };
    connectionManager.createInlineClientNamed(conn1, false, 1000, "alpha");
    connectionManager.createInlineClientNamed(conn2, false, 1000, "beta");

    // beta is currently active; switch to alpha
    const result: any = await handleToolCall("fm_odata_set_connection", { name: "alpha" });
    const text = result.content?.[0]?.text ?? "";
    // Should confirm the switch, not error
    expect(result.isError).toBeFalsy();
    expect(text).toMatch(/alpha/i);
    expect(connectionManager.getCurrentConnectionName()).toBe("alpha");
  });

  test("returns error for completely unknown alias", async () => {
    const result: any = await handleToolCall("fm_odata_set_connection", { name: "phantom" });
    const text = result.content?.[0]?.text ?? "";
    expect(result.isError).toBe(true);
    expect(text).toMatch(/phantom/i);
  });
});

// ---------------------------------------------------------------------------
// Lazy resolution of saved named connections (cold start)
// ---------------------------------------------------------------------------

/**
 * Fixture config.json written in "hand-edited" style: the inner connection
 * objects intentionally OMIT the redundant "name" field to verify that
 * getConnection() normalizes name from the map key.
 */
function writeTestConfig(home: string, extra?: Record<string, unknown>): void {
  const configDir = path.join(home, ".fms-odata-mcp");
  fs.mkdirSync(configDir, { recursive: true });
  const config = {
    connections: {
      "conn-a": {
        server: "https://fms-a.example.com",
        database: "Contacts",
        user: "user_a",
        password: "pass_a",
        verifySsl: false,
      },
      "conn-b": {
        server: "https://fms-b.example.com",
        database: "Contacts",
        user: "user_b",
        password: "pass_b",
        verifySsl: false,
      },
    },
    defaultConnection: "conn-a",
    ...extra,
  };
  fs.writeFileSync(path.join(configDir, "config.json"), JSON.stringify(config, null, 2));
}

describe("Lazy resolution of saved named connections (cold start)", () => {
  const fileHome = process.env.HOME;
  const savedFmEnv: Record<string, string | undefined> = {};
  let testHome: string;

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("FM_")) {
        savedFmEnv[key] = process.env[key];
        delete process.env[key];
      }
    }
    testHome = fs.mkdtempSync(path.join(os.tmpdir(), "fms-odata-lazy-"));
    process.env.HOME = testHome;
    writeTestConfig(testHome);
    connectionManager.clearClients();
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedFmEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    if (fileHome) process.env.HOME = fileHome;
    fs.rmSync(testHome, { recursive: true, force: true });
    connectionManager.clearClients();
  });

  test("getConnection normalizes name from the map key for hand-edited config", () => {
    const conn = getConnection("conn-b");
    expect(conn).not.toBeNull();
    expect(conn!.name).toBe("conn-b");
    expect(conn!.server).toBe("https://fms-b.example.com");
  });

  test("getCurrentClient resolves defaultConnection and sets the active pointer", () => {
    const client = connectionManager.getCurrentClient();
    expect(client).not.toBeNull();
    expect(connectionManager.getCurrentConnectionName()).toBe("conn-a");
  });

  test("getClientByName lazily loads a saved connection WITHOUT changing the active pointer", () => {
    connectionManager.getCurrentClient();
    expect(connectionManager.getCurrentConnectionName()).toBe("conn-a");

    const client = connectionManager.getClientByName("conn-b");
    expect(client).not.toBeNull();
    // Cached and visible in session listing
    expect(connectionManager.getClientByName("conn-b")).toBe(client);
    const sessions = connectionManager.listActiveSessions();
    const targetSession = sessions.find((s) => s.name === "conn-b");
    expect(targetSession).toBeDefined();
    expect(targetSession!.server).toBe("https://fms-b.example.com");
    expect(targetSession!.database).toBe("Contacts");
    expect(targetSession!.user).toBe("user_b");
    // Active pointer untouched
    expect(connectionManager.getCurrentConnectionName()).toBe("conn-a");
  });

  test("getClientByName returns null for names that are neither sessions nor saved connections", () => {
    expect(connectionManager.getClientByName("no-such-connection")).toBeNull();
  });

  test("OData tool with connection param uses the saved connection on cold start (no set_connection needed)", async () => {
    const result: any = await handleToolCall("fm_odata_create_record", {
      table: "Test",
      data: { Name: "x" },
      connection: "conn-b",
    });
    // No real server behind fms-b.example.com — reaching the HTTP layer
    // proves the conn-b client was resolved and used.
    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text).toMatch(/No response from server/i);
    // conn-b was lazily instantiated and cached
    const targetSession = connectionManager.listActiveSessions().find((s) => s.name === "conn-b");
    expect(targetSession).toBeDefined();
    expect(targetSession!.server).toBe("https://fms-b.example.com");
    // Per-call targeting must NOT change the active pointer
    expect(connectionManager.getCurrentConnectionName()).toBeUndefined();
  });

  test("subsequent calls without connection param continue to use the default connection", async () => {
    // Activate default (conn-a)
    connectionManager.getCurrentClient();
    expect(connectionManager.getCurrentConnectionName()).toBe("conn-a");

    // Per-call conn-b targeting
    await handleToolCall("fm_odata_count_records", {
      table: "Test",
      connection: "conn-b",
    });
    expect(connectionManager.getCurrentConnectionName()).toBe("conn-a");

    // Default call still uses conn-a (its session is active)
    const result: any = await handleToolCall("fm_odata_count_records", { table: "Test" });
    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text).toMatch(/No response from server/i);
    expect(connectionManager.getCurrentConnectionName()).toBe("conn-a");
  });
});

describe("Cold-start fm_odata_get_server_version and fm_odata_get_current_connection", () => {
  const fileHome = process.env.HOME;
  const savedFmEnv: Record<string, string | undefined> = {};
  let testHome: string;

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("FM_")) {
        savedFmEnv[key] = process.env[key];
        delete process.env[key];
      }
    }
    testHome = fs.mkdtempSync(path.join(os.tmpdir(), "fms-odata-coldstart-"));
    process.env.HOME = testHome;
    writeTestConfig(testHome);
    connectionManager.clearClients();
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedFmEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    if (fileHome) process.env.HOME = fileHome;
    fs.rmSync(testHome, { recursive: true, force: true });
    connectionManager.clearClients();
  });

  test("fm_odata_get_server_version resolves defaultConnection on cold start", async () => {
    const result: any = await handleToolCall("fm_odata_get_server_version", {});
    // Must NOT report "No active connection" — the default connection is
    // lazily initialized. getServerVersion() swallows the network failure
    // and reports version null with a notice.
    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(result.content?.[0]?.text ?? "{}");
    expect(payload.session).toBe("conn-a");
    expect(payload.version).toBeNull();
    expect(payload.notice).toMatch(/could not be detected/i);
    expect(connectionManager.getCurrentConnectionName()).toBe("conn-a");
  });

  test("fm_odata_get_server_version lazily resolves a saved connection by name", async () => {
    const result: any = await handleToolCall("fm_odata_get_server_version", {
      connection: "conn-b",
    });
    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(result.content?.[0]?.text ?? "{}");
    expect(payload.session).toBe("conn-b");
    expect(payload.version).toBeNull();
    // conn-b lazily loaded; active pointer untouched
    const targetSession = connectionManager.listActiveSessions().find((s) => s.name === "conn-b");
    expect(targetSession).toBeDefined();
    expect(connectionManager.getCurrentConnectionName()).toBeUndefined();
  });

  test("fm_odata_get_current_connection resolves defaultConnection on cold start", async () => {
    const result: any = await handleToolCall("fm_odata_get_current_connection", {});
    const text = result.content?.[0]?.text ?? "";
    expect(text).toContain("conn-a");
    expect(text).toContain("https://fms-a.example.com");
    expect(connectionManager.getCurrentConnectionName()).toBe("conn-a");
  });
});

describe("Environment variable fallback in getCurrentClient()", () => {
  const fileHome = process.env.HOME;
  const savedFmEnv: Record<string, string | undefined> = {};
  let testHome: string;

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("FM_")) {
        savedFmEnv[key] = process.env[key];
        delete process.env[key];
      }
    }
    // Fresh empty home — NO config.json
    testHome = fs.mkdtempSync(path.join(os.tmpdir(), "fms-odata-env-"));
    process.env.HOME = testHome;
    connectionManager.clearClients();
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedFmEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    if (fileHome) process.env.HOME = fileHome;
    fs.rmSync(testHome, { recursive: true, force: true });
    connectionManager.clearClients();
  });

  test("initializes the default client from FM_* env vars on cold start", () => {
    process.env.FM_SERVER = "https://env-fms.example.com";
    process.env.FM_DATABASE = "EnvDB";
    process.env.FM_USER = "env_user";
    process.env.FM_PASSWORD = "env_pass";

    const client = connectionManager.getCurrentClient();
    expect(client).not.toBeNull();
    expect(connectionManager.getCurrentConnectionName()).toBe("default");

    const session = connectionManager
      .listActiveSessions()
      .find((s) => s.name === "default");
    expect(session).toBeDefined();
    expect(session!.server).toBe("https://env-fms.example.com");
    expect(session!.database).toBe("EnvDB");
    expect(session!.user).toBe("env_user");
  });

  test("supports Bearer auth env configuration (FM_AUTH_TYPE=bearer)", () => {
    process.env.FM_SERVER = "https://env-fms.example.com";
    process.env.FM_DATABASE = "EnvDB";
    process.env.FM_AUTH_TYPE = "bearer";
    process.env.FM_BEARER_TOKEN = "env-token";

    const client = connectionManager.getCurrentClient();
    expect(client).not.toBeNull();
    expect(connectionManager.getCurrentConnectionName()).toBe("default");
  });

  test("returns null when env vars are incomplete (no credentials)", () => {
    process.env.FM_SERVER = "https://env-fms.example.com";
    process.env.FM_DATABASE = "EnvDB";

    expect(connectionManager.getCurrentClient()).toBeNull();
    expect(connectionManager.getCurrentConnectionName()).toBeUndefined();
  });

  test("saved defaultConnection takes precedence over env vars", () => {
    process.env.FM_SERVER = "https://env-fms.example.com";
    process.env.FM_DATABASE = "EnvDB";
    process.env.FM_USER = "env_user";
    process.env.FM_PASSWORD = "env_pass";
    writeTestConfig(testHome);

    connectionManager.getCurrentClient();
    expect(connectionManager.getCurrentConnectionName()).toBe("conn-a");
  });
});
