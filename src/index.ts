#!/usr/bin/env node
/**
 * FMS-ODATA-MCP Server
 * MCP server for FileMaker Server OData 4.01 API
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { setupTransport, getTransportConfig } from "./transport.js";
import { getConfig } from "./config.js";
import { logger } from "./logger.js";
import { allTools, handleToolCall } from "./tools/index.js";

/**
 * Main server class
 */
export class FileMakerODataServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "fms-odata-mcp",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupErrorHandling();
    this.setupToolHandlers();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      logger.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      logger.info("Shutting down server...");
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug("Listing tools");
      return {
        tools: allTools,
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      logger.debug(`Tool called: ${request.params.name}`);
      
      try {
        const result = await handleToolCall(
          request.params.name,
          request.params.arguments
        );
        return result;
      } catch (error: any) {
        logger.error(`Tool execution error:`, error);
        return {
          content: [
            {
              type: "text",
              text: `Error executing tool: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });

    logger.info(`Registered ${allTools.length} tools`);
  }

  async run(): Promise<void> {
    try {
      const config = getConfig();
      const transportConfig = getTransportConfig();

      logger.info("Starting FMS-ODATA-MCP Server...");
      logger.info(`Transport: ${transportConfig.type}`);

      await setupTransport(this.server, transportConfig);
    } catch (error) {
      logger.error("Failed to start server:", error);
      process.exit(1);
    }
  }
}

// Start the server
const server = new FileMakerODataServer();
server.run().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
