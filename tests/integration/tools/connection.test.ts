import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock connection.js — must use unstable_mockModule for ESM
jest.unstable_mockModule("../../../src/connection.js", () => ({
  ConnectionManager: jest.fn(() => ({})),
  connectionManager: {
    createInlineClientNamed: jest.fn(),
    createInlineClient: jest.fn(),
    getClient: jest.fn(),
    getClientByName: jest.fn(),
    getCurrentClient: jest.fn(),
    getCurrentConnectionName: jest.fn(),
    setCurrentConnection: jest.fn(),
    listActiveSessions: jest.fn(() => []),
    removeClient: jest.fn(),
    clearClients: jest.fn(),
    testConnection: jest.fn(),
    getServerVersion: jest.fn(),
  },
}));

// Mock config.js — provide ALL exports needed by any module in the import chain
jest.unstable_mockModule("../../../src/config.js", () => ({
  DEFAULT_HTTP_PORT: 3333,
  DEFAULT_HTTPS_PORT: 3443,
  getConfig: jest.fn(() => ({
    server: { transport: "stdio" as const },
    filemaker: { verifySsl: false, timeout: 30000 },
  })),
  getConnection: jest.fn((name: string) => {
    if (name === "test-connection") {
      return {
        name: "test-connection",
        server: "https://test.example.com",
        database: "TestDB",
        user: "testuser",
        password: "testpass",
        verifySsl: false,
      };
    }
    return null;
  }),
  listConnections: jest.fn(() => [
    {
      name: "test-connection",
      server: "https://test.example.com",
      database: "TestDB",
      user: "testuser",
      password: "testpass",
    },
  ]),
  addConnection: jest.fn(),
  removeConnection: jest.fn(),
  setDefaultConnection: jest.fn(),
  getDefaultConnectionName: jest.fn(),
  getDefaultConnection: jest.fn(() => null),
  getConfigDir: jest.fn(() => "/tmp/fms-odata-mcp-test"),
  getConfigFilePath: jest.fn(() => "/tmp/fms-odata-mcp-test/config.json"),
  getEnvFilePath: jest.fn(() => "/tmp/.env"),
  hasConfig: jest.fn(() => false),
  getConnections: jest.fn(() => []),
  resolveVerifySsl: jest.fn(() => false),
  validateConfig: jest.fn(),
  loadConfigFile: jest.fn(),
  saveConfigFile: jest.fn(),
  loadEnvFile: jest.fn(),
}));

// Dynamically import AFTER mock setup
const { connectionTools, handleConnectionTool } = await import("../../../src/tools/connection.js");
const { connectionManager } = await import("../../../src/connection.js");
const config = await import("../../../src/config.js");

describe("Connection Tools", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset default mock implementations after clearAllMocks
    (connectionManager.listActiveSessions as jest.Mock).mockReturnValue([]);
    (config.getConfig as jest.Mock).mockReturnValue({
      server: { transport: "stdio" as const },
      filemaker: { verifySsl: false, timeout: 30000 },
    });
    (config.getConnection as jest.Mock).mockImplementation((name: string) => {
      if (name === "test-connection") {
        return {
          name: "test-connection",
          server: "https://test.example.com",
          database: "TestDB",
          user: "testuser",
          password: "testpass",
          verifySsl: false,
        };
      }
      return null;
    });
    (config.listConnections as jest.Mock).mockReturnValue([
      {
        name: "test-connection",
        server: "https://test.example.com",
        database: "TestDB",
        user: "testuser",
        password: "testpass",
      },
    ]);
  });

  describe("Tool Definitions", () => {
    it("should export correct number of tools", () => {
      expect(connectionTools).toHaveLength(8);
    });

    it("should have fm_odata_connect tool", () => {
      const tool = connectionTools.find((t) => t.name === "fm_odata_connect");
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toContain("server");
      expect(tool?.inputSchema.required).toContain("database");
      expect(tool?.inputSchema.required).toContain("user");
      expect(tool?.inputSchema.required).toContain("password");
    });

    it("should have fm_odata_connect_multi tool", () => {
      const tool = connectionTools.find((t) => t.name === "fm_odata_connect_multi");
      expect(tool).toBeDefined();
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

    it("should have fm_odata_list_active_sessions tool", () => {
      const tool = connectionTools.find((t) => t.name === "fm_odata_list_active_sessions");
      expect(tool).toBeDefined();
    });

    it("should have fm_odata_describe_sessions tool", () => {
      const tool = connectionTools.find((t) => t.name === "fm_odata_describe_sessions");
      expect(tool).toBeDefined();
    });

    it("should have fm_odata_get_server_version tool", () => {
      const tool = connectionTools.find((t) => t.name === "fm_odata_get_server_version");
      expect(tool).toBeDefined();
    });
  });

  describe("handleConnectionTool", () => {
    describe("fm_odata_connect", () => {
      it("should create inline client with valid credentials", async () => {
        const mockClient = {
          testConnectionDetailed: jest.fn(() => Promise.resolve({ ok: true })),
        };
        (connectionManager.createInlineClientNamed as jest.Mock).mockReturnValue({
          client: mockClient,
          name: "inline_test",
        });

        const result = await handleConnectionTool("fm_odata_connect", {
          server: "https://test.example.com",
          database: "TestDB",
          user: "testuser",
          password: "testpass",
        });

        expect(connectionManager.createInlineClientNamed).toHaveBeenCalledWith(
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
          testConnectionDetailed: jest.fn(() => Promise.resolve({ ok: false, error: "Auth failed" })),
        };
        (connectionManager.createInlineClientNamed as jest.Mock).mockReturnValue({
          client: mockClient,
          name: "inline_test",
        });

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
      it("should switch to existing saved connection", async () => {
        // No active session found, falls through to saved config
        (connectionManager.testConnection as jest.Mock).mockResolvedValue(true);

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

      it("should handle connection not found", async () => {
        // No active session, no saved config
        (connectionManager.setCurrentConnection as jest.Mock).mockImplementation(() => {
          throw new Error("Connection not found");
        });

        const result = await handleConnectionTool("fm_odata_set_connection", {
          name: "nonexistent",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("not found");
      });
    });

    describe("fm_odata_list_connections", () => {
      it("should list all configured connections", async () => {
        const result = await handleConnectionTool("fm_odata_list_connections", {});

        expect(result.content[0].text).toContain("Saved connections");
        expect(result.content[0].text).toContain("test-connection");
        expect(result.content[0].text).toContain("https://test.example.com");
      });

      it("should handle no connections", async () => {
        (config.listConnections as jest.Mock).mockReturnValue([]);
        (connectionManager.listActiveSessions as jest.Mock).mockReturnValue([]);

        const result = await handleConnectionTool("fm_odata_list_connections", {});

        expect(result.content[0].text).toContain("No configured connections found");
      });
    });

    describe("fm_odata_get_current_connection", () => {
      it("should return current connection details", async () => {
        (connectionManager.getCurrentConnectionName as jest.Mock).mockReturnValue("test-connection");
        (connectionManager.listActiveSessions as jest.Mock).mockReturnValue([]);

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
        (connectionManager.listActiveSessions as jest.Mock).mockReturnValue([]);
        (config.getConnection as jest.Mock).mockReturnValue(null);

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
