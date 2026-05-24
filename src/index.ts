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
import { getConfig, validateConfig } from "./config.js";
import { logger } from "./logger.js";
import { allTools, handleToolCall } from "./tools/index.js";
import { PACKAGE_VERSION } from "./version.js";

/**
 * Main server class
 */
export class FileMakerODataServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "fms-odata-mcp",
        version: PACKAGE_VERSION,
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

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down server...`);
      try {
        await this.server.close();
      } finally {
        process.exit(0);
      }
    };
    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
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

      // Validate transport/HTTPS configuration (cert/key existence, port range).
      // FileMaker credentials are NOT validated here because they may be
      // supplied later via the fm_odata_connect tool at runtime.
      const validation = validateConfig({
        ...config,
        // Bypass FileMaker required-field check at startup so the server can
        // start without env-baked credentials.
        filemaker: {
          ...config.filemaker,
          server: config.filemaker.server || "placeholder",
          database: config.filemaker.database || "placeholder",
          user: config.filemaker.user || "placeholder",
        },
      });
      if (!validation.valid) {
        for (const err of validation.errors) {
          logger.error(`Config error: ${err}`);
        }
        throw new Error(`Invalid configuration: ${validation.errors.join("; ")}`);
      }

      logger.info(`Starting FMS-ODATA-MCP Server v${PACKAGE_VERSION}...`);
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
