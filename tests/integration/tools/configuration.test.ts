import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { configurationTools, handleConfigurationTool } from "../../../src/tools/configuration.js";

// Mock config functions
jest.mock("../../../src/config.js", () => ({
  addConnection: jest.fn(),
  removeConnection: jest.fn(),
  listConnections: jest.fn(() => [
    {
      name: "prod",
      server: "https://prod.example.com",
      database: "ProdDB",
      user: "produser",
    },
    {
      name: "dev",
      server: "https://dev.example.com",
      database: "DevDB",
      user: "devuser",
    },
  ]),
  getConnection: jest.fn((name) => {
    if (name === "prod") {
      return {
        name: "prod",
        server: "https://prod.example.com",
        database: "ProdDB",
        user: "produser",
      };
    }
    return null;
  }),
  setDefaultConnection: jest.fn(),
  getDefaultConnectionName: jest.fn(() => "prod"),
}));

describe("Configuration Tools", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Tool Definitions", () => {
    it("should export correct number of tools", () => {
      expect(configurationTools).toHaveLength(5);
    });

    it("should have fm_odata_config_add_connection tool", () => {
      const tool = configurationTools.find((t) => t.name === "fm_odata_config_add_connection");
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toContain("name");
      expect(tool?.inputSchema.required).toContain("server");
      expect(tool?.inputSchema.required).toContain("database");
      expect(tool?.inputSchema.required).toContain("user");
      expect(tool?.inputSchema.required).toContain("password");
    });

    it("should have fm_odata_config_remove_connection tool", () => {
      const tool = configurationTools.find((t) => t.name === "fm_odata_config_remove_connection");
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toContain("name");
    });

    it("should have fm_odata_config_list_connections tool", () => {
      const tool = configurationTools.find((t) => t.name === "fm_odata_config_list_connections");
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toHaveLength(0);
    });

    it("should have fm_odata_config_get_connection tool", () => {
      const tool = configurationTools.find((t) => t.name === "fm_odata_config_get_connection");
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toContain("name");
    });

    it("should have fm_odata_config_set_default_connection tool", () => {
      const tool = configurationTools.find((t) => t.name === "fm_odata_config_set_default_connection");
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toContain("name");
    });
  });

  describe("handleConfigurationTool", () => {
    describe("fm_odata_config_add_connection", () => {
      it("should add a new connection", async () => {
        const result = await handleConfigurationTool("fm_odata_config_add_connection", {
          name: "test",
          server: "https://test.example.com",
          database: "TestDB",
          user: "testuser",
          password: "testpass",
        });

        const { addConnection } = await import("../../../src/config.js");
        expect(addConnection).toHaveBeenCalledWith("test", {
          server: "https://test.example.com",
          database: "TestDB",
          user: "testuser",
          password: "testpass",
        });

        expect(result.content[0].text).toContain('Connection "test" added successfully');
        expect(result.content[0].text).toContain("Server: https://test.example.com");
      });

      it("should handle errors when adding connection", async () => {
        const { addConnection } = await import("../../../src/config.js");
        (addConnection as jest.Mock).mockImplementation(() => {
          throw new Error("Connection already exists");
        });

        const result = await handleConfigurationTool("fm_odata_config_add_connection", {
          name: "duplicate",
          server: "https://test.example.com",
          database: "TestDB",
          user: "testuser",
          password: "testpass",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Connection already exists");
      });
    });

    describe("fm_odata_config_remove_connection", () => {
      it("should remove a connection", async () => {
        const result = await handleConfigurationTool("fm_odata_config_remove_connection", {
          name: "test",
        });

        const { removeConnection } = await import("../../../src/config.js");
        expect(removeConnection).toHaveBeenCalledWith("test");

        expect(result.content[0].text).toContain('Connection "test" removed successfully');
      });

      it("should handle errors when removing connection", async () => {
        const { removeConnection } = await import("../../../src/config.js");
        (removeConnection as jest.Mock).mockImplementation(() => {
          throw new Error("Connection not found");
        });

        const result = await handleConfigurationTool("fm_odata_config_remove_connection", {
          name: "nonexistent",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Connection not found");
      });
    });

    describe("fm_odata_config_list_connections", () => {
      it("should list all saved connections", async () => {
        const result = await handleConfigurationTool("fm_odata_config_list_connections", {});

        expect(result.content[0].text).toContain("Saved connections:");
        expect(result.content[0].text).toContain("prod (default)");
        expect(result.content[0].text).toContain("dev");
        expect(result.content[0].text).toContain("https://prod.example.com");
      });

      it("should handle no saved connections", async () => {
        const { listConnections } = await import("../../../src/config.js");
        (listConnections as jest.Mock).mockReturnValue([]);

        const result = await handleConfigurationTool("fm_odata_config_list_connections", {});

        expect(result.content[0].text).toContain("No saved connections found");
      });
    });

    describe("fm_odata_config_get_connection", () => {
      it("should get connection details", async () => {
        const result = await handleConfigurationTool("fm_odata_config_get_connection", {
          name: "prod",
        });

        expect(result.content[0].text).toContain("Connection: prod (default)");
        expect(result.content[0].text).toContain("Server: https://prod.example.com");
        expect(result.content[0].text).toContain("Database: ProdDB");
        expect(result.content[0].text).toContain("User: produser");
        expect(result.content[0].text).toContain("Password: ******");
      });

      it("should handle connection not found", async () => {
        const result = await handleConfigurationTool("fm_odata_config_get_connection", {
          name: "nonexistent",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Connection "nonexistent" not found');
      });
    });

    describe("fm_odata_config_set_default_connection", () => {
      it("should set default connection", async () => {
        const result = await handleConfigurationTool("fm_odata_config_set_default_connection", {
          name: "dev",
        });

        const { setDefaultConnection } = await import("../../../src/config.js");
        expect(setDefaultConnection).toHaveBeenCalledWith("dev");

        expect(result.content[0].text).toContain("Default connection set to: dev");
      });

      it("should handle errors when setting default", async () => {
        const { setDefaultConnection } = await import("../../../src/config.js");
        (setDefaultConnection as jest.Mock).mockImplementation(() => {
          throw new Error("Connection not found");
        });

        const result = await handleConfigurationTool("fm_odata_config_set_default_connection", {
          name: "nonexistent",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Connection not found");
      });
    });

    describe("Unknown tool", () => {
      it("should return error for unknown tool", async () => {
        const result = await handleConfigurationTool("unknown_tool", {});

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Unknown configuration tool");
      });
    });
  });
});
