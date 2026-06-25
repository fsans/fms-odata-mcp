import debug from "debug";
import * as fs from "fs";
import * as path from "path";
import { getConfigDir } from "./config.js";

// Create debug instances
const debugInfo = debug("fms-odata-mcp:info");
const debugError = debug("fms-odata-mcp:error");
const debugDebug = debug("fms-odata-mcp:debug");

/**
 * Logger utility for fms-odata-mcp
 */
export class Logger {
  private logFile: string;
  private fileLoggingEnabled: boolean;

  constructor() {
    this.fileLoggingEnabled = process.env.MCP_LOG_FILE === "true";
    this.logFile = path.join(getConfigDir(), "logs", "server.log");

    if (this.fileLoggingEnabled) {
      this.ensureLogDirectory();
    }

    // Enable all debug namespaces if DEBUG env var is set
    if (process.env.DEBUG) {
      debug.enable(process.env.DEBUG);
    }
  }

  private ensureLogDirectory(): void {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private writeToFile(level: string, message: string, ...args: any[]): void {
    if (!this.fileLoggingEnabled) return;

    const timestamp = new Date().toISOString();
    const formattedArgs = args.map((arg) =>
      typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
    );
    const logEntry = `[${timestamp}] [${level}] ${message} ${formattedArgs.join(" ")}\n`;

    fs.appendFileSync(this.logFile, logEntry);
  }

  info(message: string, ...args: any[]): void {
    debugInfo(message, ...args);
    this.writeToFile("INFO", message, ...args);
  }

  error(message: string, ...args: any[]): void {
    debugError(message, ...args);
    this.writeToFile("ERROR", message, ...args);
    // Also log to stderr for visibility
    console.error(`[ERROR] ${message}`, ...args);
  }

  debug(message: string, ...args: any[]): void {
    debugDebug(message, ...args);
    this.writeToFile("DEBUG", message, ...args);
  }
}

// Export singleton instance
export const logger = new Logger();
