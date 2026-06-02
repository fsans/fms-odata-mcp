import { describe, test, expect, beforeEach } from "@jest/globals";
import { connectionManager } from "../../src/connection";
import { handleToolCall } from "../../src/tools/index";

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
