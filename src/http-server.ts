#!/usr/bin/env node

/**
 * Standalone HTTP server for FileMaker OData MCP
 * Run with: MCP_TRANSPORT=http MCP_PORT=3000 filemaker-odata-mcp
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { setupSimpleHttpTransport, setupSimpleHttpsTransport } from "./simple-http-transport.js";
import { getConfig } from "./config.js";
import { getAllTools, handleToolCall } from "./tools/index.js";
import { PACKAGE_VERSION } from "./version.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "./logger.js";

async function main() {
  const config = getConfig();

  // Build a bare MCP Server (same wiring as FileMakerODataServer but without
  // the stdio fallback, so we can pass the real Server instance to the
  // transport setup functions).
  const server = new Server(
    { name: "fms-odata-mcp", version: PACKAGE_VERSION },
    { capabilities: { tools: {}, resources: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: getAllTools(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      return await handleToolCall(request.params.name, request.params.arguments);
    } catch (error: any) {
      logger.error(`Tool execution error:`, error);
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  });

  if (config.server.transport === "http") {
    await setupSimpleHttpTransport(server, {
      port: config.server.port,
      host: config.server.host,
    });
  } else if (config.server.transport === "https") {
    await setupSimpleHttpsTransport(server, {
      port: config.server.port,
      host: config.server.host,
      certPath: config.security?.certPath,
      keyPath: config.security?.keyPath,
    });
  } else {
    console.error("HTTP server requires MCP_TRANSPORT=http or MCP_TRANSPORT=https");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
