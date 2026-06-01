import { describe, test, expect, beforeEach } from "@jest/globals";
import { handleToolCall } from "../../src/tools/index";
import { connectionManager } from "../../src/connection";

/**
 * Routing regression tests.
 *
 * Bug: previously `fm_odata_list_connections` was matched by the
 * `fm_odata_list_` prefix and routed to the OData handler (which has no
 * handler for it), producing "No active connection" instead of listing
 * connections. We verify routing by observing distinguishable handler output.
 */
describe("handleToolCall routing", () => {
  beforeEach(() => {
    connectionManager.clearClients();
  });

  test("fm_odata_list_connections does NOT return 'No active connection' (routes to connection handler, not OData handler)", async () => {
    const result: any = await handleToolCall("fm_odata_list_connections", {});
    const text = result.content?.[0]?.text ?? "";
    // Connection handler returns either a list or a "No configured connections" message.
    expect(text).not.toMatch(/No active connection/i);
    expect(text).toMatch(/(connections|configured)/i);
  });

  test("fm_odata_list_tables (an OData tool) DOES return 'No active connection' when there's no client", async () => {
    const result: any = await handleToolCall("fm_odata_list_tables", {});
    const text = result.content?.[0]?.text ?? "";
    expect(text).toMatch(/No active connection/i);
    expect(result.isError).toBe(true);
  });

  test("fm_odata_get_current_connection routes to connection handler", async () => {
    const result: any = await handleToolCall("fm_odata_get_current_connection", {});
    const text = result.content?.[0]?.text ?? "";
    expect(text).toMatch(/No active connection|Active connection|Current connection/i);
  });

  test("fm_odata_config_list_connections routes to configuration handler", async () => {
    const result: any = await handleToolCall("fm_odata_config_list_connections", {});
    const text = result.content?.[0]?.text ?? "";
    expect(text).toMatch(/(saved connections|No saved connections)/i);
  });

  test("fm_odata_build_filter works without an active connection (connection-free tool)", async () => {
    const result: any = await handleToolCall("fm_odata_build_filter", {
      template: "Title eq @title",
      params: { "@title": "Wizard of Oz" },
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content?.[0]?.text ?? "{}");
    expect(parsed.filter).toBe("Title eq 'Wizard of Oz'");
  });

  test("fm_odata_build_filter raw mode returns queryString", async () => {
    const result: any = await handleToolCall("fm_odata_build_filter", {
      template: "Title eq @title",
      params: { "@title": "'Oz'" },
      mode: "raw",
    });
    const parsed = JSON.parse(result.content?.[0]?.text ?? "{}");
    expect(parsed.queryString).toBe("$filter=Title eq @title&@title='Oz'");
  });

  test("fm_odata_build_filter rejects alias keys not starting with @", async () => {
    const result: any = await handleToolCall("fm_odata_build_filter", {
      template: "Title eq @title",
      params: { "title": "Oz" },
    });
    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text).toMatch(/@/);
  });

  test("fm_odata_cast works without an active connection (connection-free tool)", async () => {
    // No connection set — must NOT return 'No active connection'
    const result: any = await handleToolCall("fm_odata_cast", {
      fields: [{ field: "StartDate", type: "Int64" }],
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content?.[0]?.text ?? "{}");
    expect(parsed.castExpression).toBe("StartDate/Edm.Int64");
  });

  test("fm_odata_cast with multiple fields joins them with commas for select context", async () => {
    const result: any = await handleToolCall("fm_odata_cast", {
      fields: [
        { field: "StartDate", type: "Int64" },
        { field: "Amount", type: "Decimal" },
      ],
      context: "select",
    });
    const parsed = JSON.parse(result.content?.[0]?.text ?? "{}");
    expect(parsed.castExpression).toBe("StartDate/Edm.Int64,Amount/Edm.Decimal");
  });

  test("fm_odata_cast with filter context returns newline-separated expressions", async () => {
    const result: any = await handleToolCall("fm_odata_cast", {
      fields: [
        { field: "Amount", type: "String" },
        { field: "Status", type: "Int32" },
      ],
      context: "filter",
    });
    const parsed = JSON.parse(result.content?.[0]?.text ?? "{}");
    expect(parsed.castExpression).toBe("Amount/Edm.String\nStatus/Edm.Int32");
  });

  test("unknown tool returns isError", async () => {
    const result: any = await handleToolCall("fm_odata_made_up_tool", {});
    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text).toMatch(/Unknown tool/);
  });
});
