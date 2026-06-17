import { describe, test, expect, beforeEach, afterEach, jest } from "@jest/globals";
import axios from "axios";
import { ODataClient, ODataClientConfig } from "../../src/odata-client";
import { getAllTools, handleToolCall } from "../../src/tools/index";
import { schemaTools, schemaEditsEnabled } from "../../src/tools/schema";
import { connectionManager } from "../../src/connection";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const ENV_FLAG = "FM_ALLOW_SCHEMA_EDITS";

function setSchemaEdits(value: string | undefined) {
  if (value === undefined) {
    delete process.env[ENV_FLAG];
  } else {
    process.env[ENV_FLAG] = value;
  }
}

describe("Schema DDL tools", () => {
  const originalEnv = process.env[ENV_FLAG];

  afterEach(() => {
    setSchemaEdits(originalEnv);
    jest.clearAllMocks();
  });

  describe("env gating (FM_ALLOW_SCHEMA_EDITS)", () => {
    test("schemaEditsEnabled() is false when the flag is unset", () => {
      setSchemaEdits(undefined);
      expect(schemaEditsEnabled()).toBe(false);
    });

    test("schemaEditsEnabled() is false for values other than 'true'", () => {
      setSchemaEdits("1");
      expect(schemaEditsEnabled()).toBe(false);
      setSchemaEdits("TRUE");
      expect(schemaEditsEnabled()).toBe(false);
    });

    test("schemaEditsEnabled() is true when flag is 'true'", () => {
      setSchemaEdits("true");
      expect(schemaEditsEnabled()).toBe(true);
    });

    test("getAllTools() hides schema tools when flag is unset", () => {
      setSchemaEdits(undefined);
      const names = getAllTools().map((t: any) => t.name);
      for (const tool of schemaTools) {
        expect(names).not.toContain(tool.name);
      }
    });

    test("getAllTools() exposes all 6 schema tools when flag is 'true'", () => {
      setSchemaEdits("true");
      const names = getAllTools().map((t: any) => t.name);
      expect(names).toContain("fm_odata_create_table");
      expect(names).toContain("fm_odata_add_fields");
      expect(names).toContain("fm_odata_delete_table");
      expect(names).toContain("fm_odata_delete_field");
      expect(names).toContain("fm_odata_create_index");
      expect(names).toContain("fm_odata_delete_index");
      expect(schemaTools).toHaveLength(6);
    });

    test("calling a schema tool with the flag disabled returns an error, not 'Unknown tool'", async () => {
      setSchemaEdits(undefined);
      const result: any = await handleToolCall("fm_odata_create_table", {
        tableName: "Company",
        fields: [{ name: "ID", type: "int", primary: true }],
      });
      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toMatch(/FM_ALLOW_SCHEMA_EDITS/);
      expect(result.content?.[0]?.text).not.toMatch(/Unknown tool/i);
    });
  });

  describe("routing and confirm-flag guard (flag enabled, no connection)", () => {
    beforeEach(() => {
      setSchemaEdits("true");
      connectionManager.clearClients();
    });

    test("schema tool without an active connection returns 'No active connection'", async () => {
      const result: any = await handleToolCall("fm_odata_create_index", {
        table: "Company",
        field: "State",
      });
      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toMatch(/No active connection/i);
    });

    test("unknown connection alias is reported", async () => {
      const result: any = await handleToolCall("fm_odata_delete_index", {
        table: "Company",
        field: "State",
        connection: "nope",
      });
      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toMatch(/Session "nope" not found/);
    });
  });

  describe("handler behaviour with a mocked client", () => {
    let mockAxiosInstance: any;

    const testConfig: ODataClientConfig = {
      server: "https://test-server.com",
      database: "ContactMgmt",
      user: "admin",
      password: "password",
      verifySsl: false,
    };

    beforeEach(() => {
      setSchemaEdits("true");
      connectionManager.clearClients();

      mockAxiosInstance = {
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      };
      mockedAxios.create = jest.fn(() => mockAxiosInstance) as any;
    });

    function makeClient(): ODataClient {
      return new ODataClient(testConfig);
    }

    test("createTable POSTs the definition to FileMaker_Tables", async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { tableName: "Company" } });
      const client = makeClient();
      const definition = {
        tableName: "Company",
        fields: [
          { name: "Company ID", type: "int", primary: true },
          { name: "Company Name", type: "varchar(100)", nullable: false },
        ],
      };
      await client.createTable(definition);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "https://test-server.com/fmi/odata/v4/ContactMgmt/FileMaker_Tables",
        definition
      );
    });

    test("addFields PATCHes a fields array to FileMaker_Tables/{table}", async () => {
      mockAxiosInstance.patch.mockResolvedValue({ data: {} });
      const client = makeClient();
      const fields = [{ name: "Phone", type: "varchar(25)" }];
      await client.addFields("Company", fields);
      expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
        "https://test-server.com/fmi/odata/v4/ContactMgmt/FileMaker_Tables/Company",
        { fields }
      );
    });

    test("deleteTable DELETEs FileMaker_Tables/{table}", async () => {
      mockAxiosInstance.delete.mockResolvedValue({});
      const client = makeClient();
      await client.deleteTable("Company");
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        "https://test-server.com/fmi/odata/v4/ContactMgmt/FileMaker_Tables/Company"
      );
    });

    test("deleteField DELETEs FileMaker_Tables/{table}/{field}", async () => {
      mockAxiosInstance.delete.mockResolvedValue({});
      const client = makeClient();
      await client.deleteField("Company", "Notes");
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        "https://test-server.com/fmi/odata/v4/ContactMgmt/FileMaker_Tables/Company/Notes"
      );
    });

    test("createIndex POSTs {indexName} to FileMaker_Indexes/{table}", async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: {} });
      const client = makeClient();
      await client.createIndex("Company", "State");
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "https://test-server.com/fmi/odata/v4/ContactMgmt/FileMaker_Indexes/Company",
        { indexName: "State" }
      );
    });

    test("deleteIndex DELETEs FileMaker_Indexes/{table}/{field}", async () => {
      mockAxiosInstance.delete.mockResolvedValue({});
      const client = makeClient();
      await client.deleteIndex("Company", "State");
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        "https://test-server.com/fmi/odata/v4/ContactMgmt/FileMaker_Indexes/Company/State"
      );
    });

    test("table and field names with special characters are URL-encoded", async () => {
      mockAxiosInstance.delete.mockResolvedValue({});
      const client = makeClient();
      await client.deleteField("My Table", "Field/Name");
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        "https://test-server.com/fmi/odata/v4/ContactMgmt/FileMaker_Tables/My%20Table/Field%2FName"
      );
    });

    describe("via handleToolCall with a registered session", () => {
      beforeEach(() => {
        // Register an inline session; the created client is backed by the
        // mocked axios instance because axios.create is mocked module-wide.
        connectionManager.createInlineClient({
          server: testConfig.server,
          database: testConfig.database,
          user: testConfig.user,
          password: testConfig.password,
        });
      });

      test("fm_odata_delete_table without confirm refuses and does NOT call the server", async () => {
        const result: any = await handleToolCall("fm_odata_delete_table", {
          table: "Company",
        });
        expect(result.isError).toBe(true);
        expect(result.content?.[0]?.text).toMatch(/REFUSED/);
        expect(result.content?.[0]?.text).toMatch(/confirm=true/);
        expect(mockAxiosInstance.delete).not.toHaveBeenCalled();
      });

      test("fm_odata_delete_table with confirm=true executes the delete", async () => {
        mockAxiosInstance.delete.mockResolvedValue({});
        const result: any = await handleToolCall("fm_odata_delete_table", {
          table: "Company",
          confirm: true,
        });
        expect(result.isError).toBeUndefined();
        expect(result.content?.[0]?.text).toMatch(/deleted/i);
        expect(mockAxiosInstance.delete).toHaveBeenCalledTimes(1);
      });

      test("fm_odata_delete_field without confirm refuses and does NOT call the server", async () => {
        const result: any = await handleToolCall("fm_odata_delete_field", {
          table: "Company",
          field: "Notes",
        });
        expect(result.isError).toBe(true);
        expect(result.content?.[0]?.text).toMatch(/REFUSED/);
        expect(mockAxiosInstance.delete).not.toHaveBeenCalled();
      });

      test("fm_odata_delete_field with confirm=true executes the delete", async () => {
        mockAxiosInstance.delete.mockResolvedValue({});
        const result: any = await handleToolCall("fm_odata_delete_field", {
          table: "Company",
          field: "Notes",
          confirm: true,
        });
        expect(result.isError).toBeUndefined();
        expect(mockAxiosInstance.delete).toHaveBeenCalledTimes(1);
      });

      test("fm_odata_create_table reports success with field count", async () => {
        mockAxiosInstance.post.mockResolvedValue({ data: { tableName: "Company" } });
        const result: any = await handleToolCall("fm_odata_create_table", {
          tableName: "Company",
          fields: [{ name: "ID", type: "int", primary: true }],
        });
        expect(result.isError).toBeUndefined();
        expect(result.content?.[0]?.text).toMatch(/Table "Company" created with 1 field/);
      });

      test("fm_odata_add_fields reports the added field names", async () => {
        mockAxiosInstance.patch.mockResolvedValue({ data: {} });
        const result: any = await handleToolCall("fm_odata_add_fields", {
          table: "Company",
          fields: [{ name: "Phone", type: "varchar(25)" }],
        });
        expect(result.isError).toBeUndefined();
        expect(result.content?.[0]?.text).toMatch(/Phone/);
      });

      test("fm_odata_create_index reports success", async () => {
        mockAxiosInstance.post.mockResolvedValue({ data: {} });
        const result: any = await handleToolCall("fm_odata_create_index", {
          table: "Company",
          field: "State",
        });
        expect(result.isError).toBeUndefined();
        expect(result.content?.[0]?.text).toMatch(/Index created/);
      });

      test("server errors are surfaced via formatted error result", async () => {
        mockAxiosInstance.post.mockRejectedValue(
          new Error("OData Error [8309]: insufficient privileges")
        );
        const result: any = await handleToolCall("fm_odata_create_table", {
          tableName: "Company",
          fields: [{ name: "ID", type: "int" }],
        });
        expect(result.isError).toBe(true);
        expect(result.content?.[0]?.text).toMatch(/8309|privileges/);
      });
    });
  });
});
