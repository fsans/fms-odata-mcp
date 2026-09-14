import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock connection.js — must use unstable_mockModule for ESM
jest.unstable_mockModule("../../../src/connection.js", () => ({
  ConnectionManager: jest.fn(() => ({})),
  connectionManager: {
    getCurrentClient: jest.fn(),
    getClientByName: jest.fn(),
  },
}));

// Mock odata-parser.js — provide ALL static methods used by odata.ts
jest.unstable_mockModule("../../../src/odata-parser.js", () => ({
  ODataParser: {
    formatServiceDocument: jest.fn((doc: unknown) => JSON.stringify(doc)),
    parseMetadataForTables: jest.fn(() => [{ name: "table1" }, { name: "table2" }]),
    parseMetadataForFields: jest.fn(() => [{ name: "field1", type: "Edm.String" }]),
    parseMetadataForScripts: jest.fn(() => []),
    createQuerySummary: jest.fn(() => "Found 5 records"),
    formatQueryResponse: jest.fn(() => "Formatted results"),
    formatRecordResponse: jest.fn(() => "Formatted record"),
    formatResponse: jest.fn((data: unknown) => JSON.stringify(data)),
    formatError: jest.fn((error: unknown) => {
      if (error instanceof Error) {
        return error.message;
      }
      return String(error);
    }),
    buildParameterizedFilter: jest.fn((template: string, params: Record<string, string>) => {
      let result = template;
      for (const [key, value] of Object.entries(params)) {
        result = result.replace(key, `'${value}'`);
      }
      return result;
    }),
    buildCastExpression: jest.fn((table: string, field: string, type: string) => `${table}/${field}.${type}`),
    buildApplyExpression: jest.fn(() => "apply-expression"),
  },
}));

// Dynamically import AFTER mock setup
const { odataTools, handleODataTool } = await import("../../../src/tools/odata.js");
const { connectionManager } = await import("../../../src/connection.js");
const { ODataParser } = await import("../../../src/odata-parser.js");

describe("OData Tools", () => {
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      getServiceDocument: jest.fn(() => Promise.resolve({ value: [] })),
      getMetadata: jest.fn(() => Promise.resolve("<metadata/>")),
      queryRecords: jest.fn(() => Promise.resolve({ value: [] })),
      getRecord: jest.fn(() => Promise.resolve({})),
      createRecord: jest.fn(() => Promise.resolve({})),
      updateRecord: jest.fn(() => Promise.resolve()),
      deleteRecord: jest.fn(() => Promise.resolve()),
      countRecords: jest.fn(() => Promise.resolve(10)),
      aggregateRecords: jest.fn(() => Promise.resolve({ value: [] })),
      runScript: jest.fn(() => Promise.resolve({})),
      runScriptById: jest.fn(() => Promise.resolve({})),
      normalizeFilter: jest.fn((f: string) => f),
      getServerVersion: jest.fn(() => Promise.resolve(null)),
    };

    (connectionManager.getCurrentClient as jest.Mock).mockReturnValue(mockClient);
  });

  describe("Tool Definitions", () => {
    it("should export correct number of tools", () => {
      expect(odataTools).toHaveLength(20);
    });

    it("should have metadata tools", () => {
      const tools = odataTools.map((t: any) => t.name);
      expect(tools).toContain("fm_odata_get_service_document");
      expect(tools).toContain("fm_odata_get_metadata");
      expect(tools).toContain("fm_odata_list_tables");
      expect(tools).toContain("fm_odata_describe_table");
    });

    it("should have script tools", () => {
      const tools = odataTools.map((t: any) => t.name);
      expect(tools).toContain("fm_odata_run_script");
      expect(tools).toContain("fm_odata_list_scripts");
    });

    it("should have query tools", () => {
      const tools = odataTools.map((t: any) => t.name);
      expect(tools).toContain("fm_odata_query_records");
      expect(tools).toContain("fm_odata_get_record");
      expect(tools).toContain("fm_odata_get_records");
      expect(tools).toContain("fm_odata_count_records");
      expect(tools).toContain("fm_odata_aggregate");
    });

    it("should have expression builder tools", () => {
      const tools = odataTools.map((t: any) => t.name);
      expect(tools).toContain("fm_odata_cast");
      expect(tools).toContain("fm_odata_build_filter");
    });

    it("should have CRUD tools", () => {
      const tools = odataTools.map((t: any) => t.name);
      expect(tools).toContain("fm_odata_create_record");
      expect(tools).toContain("fm_odata_update_record");
      expect(tools).toContain("fm_odata_delete_record");
    });
  });

  describe("handleODataTool - No Connection", () => {
    it("should return error when no active connection", async () => {
      (connectionManager.getCurrentClient as jest.Mock).mockReturnValue(null);

      const result = await handleODataTool("fm_odata_get_metadata", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("No active connection");
    });
  });

  describe("Metadata Tools", () => {
    describe("fm_odata_get_service_document", () => {
      it("should get service document", async () => {
        const mockDoc = { value: [{ name: "table1" }] };
        mockClient.getServiceDocument.mockResolvedValue(mockDoc);

        const result = await handleODataTool("fm_odata_get_service_document", {});

        expect(mockClient.getServiceDocument).toHaveBeenCalled();
        expect(result.content[0].text).toContain(JSON.stringify(mockDoc));
      });
    });

    describe("fm_odata_get_metadata", () => {
      it("should get metadata XML", async () => {
        const mockMetadata = "<edmx:Edmx>...</edmx:Edmx>";
        mockClient.getMetadata.mockResolvedValue(mockMetadata);

        const result = await handleODataTool("fm_odata_get_metadata", {});

        expect(mockClient.getMetadata).toHaveBeenCalled();
        expect(result.content[0].text).toBe(mockMetadata);
      });
    });

    describe("fm_odata_list_tables", () => {
      it("should list tables from metadata", async () => {
        mockClient.getMetadata.mockResolvedValue("<metadata/>");

        const result = await handleODataTool("fm_odata_list_tables", {});

        expect(mockClient.getMetadata).toHaveBeenCalled();
        expect(ODataParser.parseMetadataForTables).toHaveBeenCalled();
        expect(result.content[0].text).toContain("table1");
        expect(result.content[0].text).toContain("table2");
      });
    });
  });

  describe("Query Tools", () => {
    describe("fm_odata_query_records", () => {
      it("should query records with all options", async () => {
        const mockResponse = {
          "@odata.context": "http://example.com/$metadata#contacts",
          value: [{ id: 1 }],
          "@odata.count": 100,
        };
        mockClient.queryRecords.mockResolvedValue(mockResponse);

        const result = await handleODataTool("fm_odata_query_records", {
          table: "contacts",
          filter: "Age gt 18",
          select: "Name,Email",
          orderby: "Name asc",
          top: 10,
          skip: 20,
          expand: "Address",
          count: true,
        });

        expect(mockClient.queryRecords).toHaveBeenCalledWith("contacts", {
          filter: "Age gt 18",
          select: "Name,Email",
          orderby: "Name asc",
          top: 10,
          skip: 20,
          expand: "Address",
          count: true,
        });

        expect(ODataParser.createQuerySummary).toHaveBeenCalledWith(mockResponse);
        expect(ODataParser.formatQueryResponse).toHaveBeenCalledWith(mockResponse);
      });

      it("should query records with minimal options", async () => {
        const result = await handleODataTool("fm_odata_query_records", {
          table: "contacts",
        });

        expect(mockClient.queryRecords).toHaveBeenCalledWith("contacts", {
          filter: undefined,
          select: undefined,
          orderby: undefined,
          top: undefined,
          skip: undefined,
          expand: undefined,
          count: undefined,
        });
      });
    });

    describe("fm_odata_get_record", () => {
      it("should get single record by ID", async () => {
        const mockRecord = { id: "123", name: "John" };
        mockClient.getRecord.mockResolvedValue(mockRecord);

        const result = await handleODataTool("fm_odata_get_record", {
          table: "contacts",
          recordId: "123",
        });

        expect(mockClient.getRecord).toHaveBeenCalledWith("contacts", "123", {
          select: undefined,
          expand: undefined,
        });

        expect(ODataParser.formatRecordResponse).toHaveBeenCalledWith(mockRecord);
      });

      it("should get record with select and expand", async () => {
        const result = await handleODataTool("fm_odata_get_record", {
          table: "contacts",
          recordId: "123",
          select: "Name,Email",
          expand: "Address",
        });

        expect(mockClient.getRecord).toHaveBeenCalledWith("contacts", "123", {
          select: "Name,Email",
          expand: "Address",
        });
      });
    });

    describe("fm_odata_get_records", () => {
      it("should get records with pagination", async () => {
        const result = await handleODataTool("fm_odata_get_records", {
          table: "contacts",
          top: 10,
          skip: 20,
        });

        expect(mockClient.queryRecords).toHaveBeenCalledWith("contacts", {
          top: 10,
          skip: 20,
        });
      });

      it("should get all records when no pagination", async () => {
        const result = await handleODataTool("fm_odata_get_records", {
          table: "contacts",
        });

        expect(mockClient.queryRecords).toHaveBeenCalledWith("contacts", {
          top: undefined,
          skip: undefined,
        });
      });
    });

    describe("fm_odata_count_records", () => {
      it("should count all records", async () => {
        mockClient.countRecords.mockResolvedValue(42);

        const result = await handleODataTool("fm_odata_count_records", {
          table: "contacts",
        });

        expect(mockClient.countRecords).toHaveBeenCalledWith("contacts", undefined);
        expect(result.content[0].text).toContain("Total records in contacts: 42");
      });

      it("should count filtered records", async () => {
        mockClient.countRecords.mockResolvedValue(15);

        const result = await handleODataTool("fm_odata_count_records", {
          table: "contacts",
          filter: "Age gt 18",
        });

        expect(mockClient.countRecords).toHaveBeenCalledWith("contacts", "Age gt 18");
        expect(result.content[0].text).toContain("15");
      });
    });
  });

  describe("CRUD Tools", () => {
    describe("fm_odata_create_record", () => {
      it("should create a new record", async () => {
        const newData = { name: "John", email: "john@example.com" };
        const createdRecord = { id: "new-id", ...newData };
        mockClient.createRecord.mockResolvedValue(createdRecord);

        const result = await handleODataTool("fm_odata_create_record", {
          table: "contacts",
          data: newData,
        });

        expect(mockClient.createRecord).toHaveBeenCalledWith("contacts", newData);
        expect(result.content[0].text).toContain("Record created successfully");
        expect(ODataParser.formatRecordResponse).toHaveBeenCalledWith(createdRecord);
      });
    });

    describe("fm_odata_update_record", () => {
      it("should update an existing record", async () => {
        const updateData = { email: "newemail@example.com" };

        const result = await handleODataTool("fm_odata_update_record", {
          table: "contacts",
          recordId: "123",
          data: updateData,
        });

        expect(mockClient.updateRecord).toHaveBeenCalledWith("contacts", "123", updateData);
        expect(result.content[0].text).toContain("Record 123 in contacts updated successfully");
      });
    });

    describe("fm_odata_delete_record", () => {
      it("should delete a record", async () => {
        const result = await handleODataTool("fm_odata_delete_record", {
          table: "contacts",
          recordId: "123",
        });

        expect(mockClient.deleteRecord).toHaveBeenCalledWith("contacts", "123");
        expect(result.content[0].text).toContain("Record 123 deleted from contacts");
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle client errors gracefully", async () => {
      const error = new Error("Network error");
      mockClient.getMetadata.mockRejectedValue(error);

      const result = await handleODataTool("fm_odata_get_metadata", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Network error");
    });

    it("should handle unknown tool", async () => {
      const result = await handleODataTool("fm_odata_unknown_tool", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown OData tool");
    });
  });
});
