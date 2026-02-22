import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupSimpleHttpTransport, setupSimpleHttpsTransport } from "./simple-http-transport.js";

export type TransportType = "stdio" | "http" | "https";

export interface TransportConfig {
  type: TransportType;
  port?: number;
  host?: string;
  certPath?: string;
  keyPath?: string;
}

/**
 * Parse transport configuration from environment variables
 */
export function getTransportConfig(): TransportConfig {
  const transportType = (process.env.MCP_TRANSPORT || "stdio") as TransportType;

  const config: TransportConfig = {
    type: transportType,
    port: process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : (transportType === "https" ? 3443 : 3333),
    host: process.env.MCP_HOST || "localhost",
    certPath: process.env.MCP_CERT_PATH,
    keyPath: process.env.MCP_KEY_PATH,
  };

  return config;
}

/**
 * Create and connect transport based on configuration
 */
export async function setupTransport(
  server: Server,
  config: TransportConfig
): Promise<void> {
  switch (config.type) {
    case "stdio":
      await setupStdioTransport(server);
      break;

    case "http":
      await setupSimpleHttpTransport(server, config);
      break;

    case "https":
      await setupSimpleHttpsTransport(server, config);
      break;

    default:
      throw new Error(`Unknown transport type: ${config.type}`);
  }
}

/**
 * Setup stdio transport (default, for local use)
 */
async function setupStdioTransport(server: Server): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("FMS-ODATA-MCP Server running on stdio");
}
