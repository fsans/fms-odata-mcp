import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { HttpTransport } from "./working-http-transport.js";
import { PACKAGE_VERSION } from "./version.js";
import { DEFAULT_HTTP_PORT, DEFAULT_HTTPS_PORT } from "./config.js";
import { logger } from "./logger.js";
import express, { Request, Response, NextFunction } from "express";
import https from "https";
import http from "http";
import fs from "fs";

let httpServer: http.Server | https.Server | null = null;

export interface HttpTransportConfig {
  port?: number;
  host?: string;
  certPath?: string;
  keyPath?: string;
}

/**
 * Detect if we're likely running inside a Docker container.
 */
function isLikelyInDocker(): boolean {
  try {
    if (fs.existsSync("/.dockerenv")) return true;
    // cgroup hint as a fallback
    const cg = fs.readFileSync("/proc/1/cgroup", "utf-8");
    return /docker|containerd|kubepods/i.test(cg);
  } catch {
    return false;
  }
}

/**
 * Print a loud warning when binding to a loopback host inside a container —
 * this is the #1 source of "port mapped but unreachable" reports.
 */
function warnIfDockerLocalhost(host: string): void {
  const loopback = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (loopback && isLikelyInDocker()) {
    console.error(
      `[WARN] Binding to '${host}' inside a container — the port will NOT be reachable from outside. ` +
        `Set MCP_HOST=0.0.0.0 to bind on all interfaces.`
    );
  }
}

/**
 * Create an Express authentication middleware that checks for a Bearer token
 * matching MCP_AUTH_TOKEN. Returns null if no token is configured (auth disabled).
 */
export function createAuthMiddleware(): ((req: Request, res: Response, next: NextFunction) => void) | null {
  const authToken = process.env.MCP_AUTH_TOKEN;
  if (!authToken) {
    console.error(
      "[WARN] HTTP transport has no authentication. Set MCP_AUTH_TOKEN to secure the /mcp endpoint."
    );
    return null;
  }
  console.error("HTTP transport authentication enabled (MCP_AUTH_TOKEN set)");
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET") {
      return next();
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${authToken}`) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Unauthorized: valid Bearer token required",
        },
      });
      return;
    }
    next();
  };
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

  // CORS support for web clients — MUST be registered BEFORE routes so that
  // preflight OPTIONS requests and CORS headers actually apply.
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

  // Body parser
  app.use(express.json());

  // Authentication (optional — enabled when MCP_AUTH_TOKEN env var is set)
  const authMiddleware = createAuthMiddleware();
  if (authMiddleware) {
    app.use("/mcp", authMiddleware);
  }

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
      version: PACKAGE_VERSION,
    });
  });

  // Info endpoint
  app.get("/mcp", (req: Request, res: Response) => {
    res.json({
      name: "FileMaker OData MCP Server",
      version: PACKAGE_VERSION,
      transport: "http",
      endpoint: "/mcp",
      methods: ["POST"],
      streaming: false,
    });
  });

  const port = config.port || DEFAULT_HTTP_PORT;
  const host = config.host || "localhost";
  warnIfDockerLocalhost(host);

  httpServer = http.createServer(app);
  httpServer.listen(port, host, () => {
    console.error(`fms-odata-mcp Server running on http://${host}:${port}`);
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

  // CORS support for web clients — must be registered BEFORE routes.
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

  // Body parser
  app.use(express.json());

  // Authentication (optional — enabled when MCP_AUTH_TOKEN env var is set)
  const authMiddleware = createAuthMiddleware();
  if (authMiddleware) {
    app.use("/mcp", authMiddleware);
  }

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
      version: PACKAGE_VERSION,
    });
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
  
  const port = config.port || DEFAULT_HTTPS_PORT;
  const host = config.host || "localhost";
  warnIfDockerLocalhost(host);
  
  httpServer = https.createServer({ cert, key }, app);
  httpServer.listen(port, host, () => {
    console.error(`fms-odata-mcp Server running on https://${host}:${port}`);
    console.error(`MCP endpoint: https://${host}:${port}/mcp`);
    console.error(`Health check: https://${host}:${port}/health`);
    console.error(`Transport: HTTPS (JSON-RPC 2.0)`);
  });
}

/**
 * Close the HTTP/HTTPS server listener if one is active.
 * Called during graceful shutdown to release the bound port.
 */
export async function closeHttpServer(): Promise<void> {
  if (httpServer) {
    await new Promise<void>((resolve) => {
      httpServer!.close(() => resolve());
    });
    httpServer = null;
    logger.info("HTTP server closed");
  }
}
