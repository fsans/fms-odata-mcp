import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { connectionTools, handleConnectionTool } from "../../../src/tools/connection.js";
import { connectionManager } from "../../../src/connection.js";

// Mock dependencies
jest.mock("../../../src/connection.js", () => ({
  connectionManager: {
    createInlineClient: jest.fn(),
    setCurrentConnection: jest.fn(),
    getCurrentConnectionName: jest.fn(),
    getCurrentClient: jest.fn(),
  },
}));

jest.mock("../../../src/config.js", () => ({
  getConfig: jest.fn(() => ({
    filemaker: {
      verifySsl: false,
      timeout: 30000,
    },
  })),
  listConnections: jest.fn(() => [
    {
      name: "test-connection",
      server: "https://test.example.com",
      database: "TestDB",
      user: "testuser",
      password: "testpass",
    },
  ]),
  getConnection: jest.fn((name) => {
    if (name === "test-connection") {
      return {
        name: "test-connection",
        server: "https://test.example.com",
        database: "TestDB",
        user: "testuser",
        password: "testpass",
      };
    }
    return null;
  }),
}));

describe("Connection Tools", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Tool Definitions", () => {
    it("should export correct number of tools", () => {
      expect(connectionTools).toHaveLength(4);
    });

    it("should have fm_odata_connect tool", () => {
      const tool = connectionTools.find((t) => t.name === "fm_odata_connect");
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toContain("server");
      expect(tool?.inputSchema.required).toContain("database");
      expect(tool?.inputSchema.required).toContain("user");
      expect(tool?.inputSchema.required).toContain("password");
    });

    it("should have fm_odata_set_connection tool", () => {
      const tool = connectionTools.find((t) => t.name === "fm_odata_set_connection");
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toContain("name");
    });

    it("should have fm_odata_list_connections tool", () => {
      const tool = connectionTools.find((t) => t.name === "fm_odata_list_connections");
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toHaveLength(0);
    });

    it("should have fm_odata_get_current_connection tool", () => {
      const tool = connectionTools.find((t) => t.name === "fm_odata_get_current_connection");
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toHaveLength(0);
    });
  });

  describe("handleConnectionTool", () => {
    describe("fm_odata_connect", () => {
      it("should create inline client with valid credentials", async () => {
        const mockClient = {
          testConnection: jest.fn(() => Promise.resolve(true)),
        };
        (connectionManager.createInlineClient as jest.Mock).mockReturnValue(mockClient);

        const result = await handleConnectionTool("fm_odata_connect", {
          server: "https://test.example.com",
          database: "TestDB",
          user: "testuser",
          password: "testpass",
        });

        expect(connectionManager.createInlineClient).toHaveBeenCalledWith(
          expect.objectContaining({
            server: "https://test.example.com",
            database: "TestDB",
            user: "testuser",
            password: "testpass",
          }),
          false,
          30000
        );

        expect(result.content[0].text).toContain("Connected to");
        expect(result.isError).toBeUndefined();
      });

      it("should return error when connection test fails", async () => {
        const mockClient = {
          testConnection: jest.fn(() => Promise.resolve(false)),
        };
        (connectionManager.createInlineClient as jest.Mock).mockReturnValue(mockClient);

        const result = await handleConnectionTool("fm_odata_connect", {
          server: "https://test.example.com",
          database: "TestDB",
          user: "testuser",
          password: "wrongpass",
        });

        expect(result.content[0].text).toContain("Failed to connect");
        expect(result.isError).toBe(true);
      });
    });

    describe("fm_odata_set_connection", () => {
      it("should switch to existing connection", async () => {
        const result = await handleConnectionTool("fm_odata_set_connection", {
          name: "test-connection",
        });

        expect(connectionManager.setCurrentConnection).toHaveBeenCalledWith(
          "test-connection",
          false,
          30000
        );

        expect(result.content[0].text).toContain("Switched to connection: test-connection");
      });

      it("should handle connection switch error", async () => {
        (connectionManager.setCurrentConnection as jest.Mock).mockImplementation(() => {
          throw new Error("Connection not found");
        });

        const result = await handleConnectionTool("fm_odata_set_connection", {
          name: "nonexistent",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Connection not found");
      });
    });

    describe("fm_odata_list_connections", () => {
      it("should list all configured connections", async () => {
        const result = await handleConnectionTool("fm_odata_list_connections", {});

        expect(result.content[0].text).toContain("Configured connections:");
        expect(result.content[0].text).toContain("test-connection");
        expect(result.content[0].text).toContain("https://test.example.com");
      });

      it("should handle no connections", async () => {
        const { listConnections } = await import("../../../src/config.js");
        (listConnections as jest.Mock).mockReturnValue([]);

        const result = await handleConnectionTool("fm_odata_list_connections", {});

        expect(result.content[0].text).toContain("No configured connections found");
      });
    });

    describe("fm_odata_get_current_connection", () => {
      it("should return current connection details", async () => {
        (connectionManager.getCurrentConnectionName as jest.Mock).mockReturnValue("test-connection");

        const result = await handleConnectionTool("fm_odata_get_current_connection", {});

        expect(result.content[0].text).toContain("Current connection: test-connection");
        expect(result.content[0].text).toContain("Server: https://test.example.com");
      });

      it("should handle no active connection", async () => {
        (connectionManager.getCurrentConnectionName as jest.Mock).mockReturnValue(undefined);

        const result = await handleConnectionTool("fm_odata_get_current_connection", {});

        expect(result.content[0].text).toContain("No active connection");
      });

      it("should handle inline/temporary connection", async () => {
        (connectionManager.getCurrentConnectionName as jest.Mock).mockReturnValue("inline_123");
        const { getConnection } = await import("../../../src/config.js");
        (getConnection as jest.Mock).mockReturnValue(null);

        const result = await handleConnectionTool("fm_odata_get_current_connection", {});

        expect(result.content[0].text).toContain("inline/temporary");
      });
    });

    describe("Unknown tool", () => {
      it("should return error for unknown tool", async () => {
        const result = await handleConnectionTool("unknown_tool", {});

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Unknown connection tool");
      });
    });
  });
});
