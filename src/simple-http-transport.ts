import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { HttpTransport } from "./working-http-transport.js";
import express, { Express, Request, Response } from "express";
import https from "https";
import http from "http";
import fs from "fs";

export interface HttpTransportConfig {
  port?: number;
  host?: string;
  certPath?: string;
  keyPath?: string;
}

/**
 * Simple HTTP transport that processes MCP requests directly
 * This implementation handles JSON-RPC 2.0 requests without streaming
 */
export async function setupSimpleHttpTransport(
  server: Server,
  config: HttpTransportConfig = {}
): Promise<void> {
  const app = express();
  
  // Middleware
  app.use(express.json());
  
  // Create HTTP transport instance
  const transport = new HttpTransport();
  
  // Connect server to transport
  await server.connect(transport);
  
  // Handle MCP requests
  app.post("/mcp", async (req: Request, res: Response) => {
    await transport.handleRequest(req, res, req.body);
  });
  
  // Health check endpoint
  app.get("/health", (req: Request, res: Response) => {
    res.json({ 
      status: "ok", 
      transport: "http", 
      server: "fms-odata-mcp",
      version: "0.1.5"
    });
  });
  
  // Info endpoint
  app.get("/mcp", (req: Request, res: Response) => {
    res.json({
      name: "FileMaker OData MCP Server",
      version: "0.1.5",
      transport: "http",
      endpoint: "/mcp",
      methods: ["POST"],
      streaming: false,
    });
  });
  
  // CORS support for web clients
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    
    next();
  });
  
  const port = config.port || 3333;
  const host = config.host || "localhost";
  
  http.createServer(app).listen(port, host, () => {
    console.error(`FMS-ODATA-MCP Server running on http://${host}:${port}`);
    console.error(`MCP endpoint: http://${host}:${port}/mcp`);
    console.error(`Health check: http://${host}:${port}/health`);
    console.error(`Transport: HTTP (JSON-RPC 2.0)`);
  });
}

/**
 * Setup HTTPS transport
 */
export async function setupSimpleHttpsTransport(
  server: Server,
  config: HttpTransportConfig = {}
): Promise<void> {
  const app = express();
  
  // Middleware
  app.use(express.json());
  
  // Create HTTP transport instance
  const transport = new HttpTransport();
  
  // Connect server to transport
  await server.connect(transport);
  
  // Handle MCP requests
  app.post("/mcp", async (req: Request, res: Response) => {
    await transport.handleRequest(req, res, req.body);
  });
  
  // Health check endpoint
  app.get("/health", (req: Request, res: Response) => {
    res.json({ 
      status: "ok", 
      transport: "https", 
      server: "fms-odata-mcp",
      version: "0.1.5"
    });
  });
  
  // CORS support for web clients
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    
    next();
  });
  
  // Load certificates
  if (!config.certPath || !config.keyPath) {
    throw new Error(
      "HTTPS transport requires certPath and keyPath in config"
    );
  }
  
  let cert: Buffer;
  let key: Buffer;
  
  try {
    cert = fs.readFileSync(config.certPath);
    key = fs.readFileSync(config.keyPath);
  } catch (error) {
    throw new Error(
      `Failed to load HTTPS certificates: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  
  const port = config.port || 3443;
  const host = config.host || "localhost";
  
  https.createServer({ cert, key }, app).listen(port, host, () => {
    console.error(`FMS-ODATA-MCP Server running on https://${host}:${port}`);
    console.error(`MCP endpoint: https://${host}:${port}/mcp`);
    console.error(`Health check: https://${host}:${port}/health`);
    console.error(`Transport: HTTPS (JSON-RPC 2.0)`);
  });
}
