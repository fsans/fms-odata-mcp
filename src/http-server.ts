#!/usr/bin/env node

/**
 * Standalone HTTP server for FileMaker OData MCP
 * Run with: MCP_TRANSPORT=http MCP_PORT=3000 filemaker-odata-mcp
 */

import { FileMakerODataServer } from "./index.js";
import { setupSimpleHttpTransport, setupSimpleHttpsTransport } from "./simple-http-transport.js";
import { getConfig } from "./config.js";

async function main() {
  const config = getConfig();
  const server = new FileMakerODataServer();
  
  // Wait a bit for server to initialize
  await new Promise(resolve => setTimeout(resolve, 100));
  
  if (config.server.transport === "http") {
    await setupSimpleHttpTransport(
      server as any, // Type assertion to access internal server
      {
        port: config.server.port,
        host: config.server.host,
      }
    );
  } else if (config.server.transport === "https") {
    await setupSimpleHttpsTransport(
      server as any, // Type assertion to access internal server
      {
        port: config.server.port,
        host: config.server.host,
        certPath: config.security?.certPath,
        keyPath: config.security?.keyPath,
      }
    );
  } else {
    console.error("HTTP server requires MCP_TRANSPORT=http or MCP_TRANSPORT=https");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
