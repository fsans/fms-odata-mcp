import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as dotenv from "dotenv";

/**
 * Default transport ports. Keep in one place so `config.ts` and
 * `transport.ts` cannot drift apart.
 */
export const DEFAULT_HTTP_PORT = 3333;
export const DEFAULT_HTTPS_PORT = 3443;

export interface ServerConfig {
  transport: "stdio" | "http" | "https";
  port: number;
  host: string;
}

export interface FileMakerConfig {
  server: string;
  database: string;
  user: string;
  password?: string;
  verifySsl?: boolean;
  timeout?: number;
}

export interface SecurityConfig {
  certPath?: string;
  keyPath?: string;
}

export interface Connection {
  name?: string;
  server: string;
  database: string;
  user: string;
  password: string;
  verifySsl?: boolean;
}

export interface AppConfig {
  server: ServerConfig;
  filemaker: FileMakerConfig;
  security?: SecurityConfig;
  connections?: Record<string, Connection>;
  defaultConnection?: string;
}

/**
 * Get config directory (dynamically resolves home directory)
 * Uses process.env.HOME for testability
 */
export function getConfigDir(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || os.homedir();
  return path.join(homeDir, ".fms-odata-mcp");
}

/**
 * Get config file path
 */
function getConfigFile(): string {
  return path.join(getConfigDir(), "config.json");
}

/**
 * Get env file path
 */
function getEnvFile(): string {
  return path.join(getConfigDir(), ".env");
}

/**
 * Load configuration from file
 */
export function loadConfigFile(): Partial<AppConfig> {
  const configFile = getConfigFile();
  if (fs.existsSync(configFile)) {
    try {
      return JSON.parse(fs.readFileSync(configFile, "utf-8"));
    } catch (error) {
      console.error("Error reading config file:", error);
      return {};
    }
  }
  return {};
}

/**
 * Save configuration to file
 */
export function saveConfigFile(config: AppConfig): void {
  const configDir = getConfigDir();
  const configFile = getConfigFile();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  fs.chmodSync(configFile, 0o600); // Restrict permissions for security
}

/**
 * Load environment variables from .env file
 */
export function loadEnvFile(): void {
  const envFile = getEnvFile();
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
  }
}

/**
 * Get configuration with precedence: env vars > config file > defaults
 */
export function getConfig(): AppConfig {
  // Load from file first
  const fileConfig = loadConfigFile();

  // Load environment variables
  loadEnvFile();

  // Build final config with precedence
  const transportType =
    (process.env.MCP_TRANSPORT as "stdio" | "http" | "https") ||
    (fileConfig.server?.transport as "stdio" | "http" | "https") ||
    "stdio";
  const defaultPort =
    transportType === "https" ? DEFAULT_HTTPS_PORT : DEFAULT_HTTP_PORT;

  const config: AppConfig = {
    server: {
      transport: transportType,
      port: parseInt(
        process.env.MCP_PORT || String(fileConfig.server?.port || defaultPort),
        10
      ),
      host: process.env.MCP_HOST || fileConfig.server?.host || "localhost",
    },
    filemaker: {
      server: process.env.FM_SERVER || fileConfig.filemaker?.server || "",
      database: process.env.FM_DATABASE || fileConfig.filemaker?.database || "",
      user: process.env.FM_USER || fileConfig.filemaker?.user || "",
      password: process.env.FM_PASSWORD || fileConfig.filemaker?.password,
      verifySsl: process.env.FM_VERIFY_SSL
        ? process.env.FM_VERIFY_SSL.toLowerCase() === "true"
        : resolveVerifySsl(fileConfig.filemaker?.verifySsl),
      timeout: parseInt(process.env.FM_TIMEOUT || String(fileConfig.filemaker?.timeout || 30000), 10),
    },
    security: {
      certPath: process.env.MCP_CERT_PATH || fileConfig.security?.certPath,
      keyPath: process.env.MCP_KEY_PATH || fileConfig.security?.keyPath,
    },
  };

  return config;
}

/**
 * Validate configuration
 */
export function validateConfig(config: AppConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate FileMaker configuration
  if (!config.filemaker.server) {
    errors.push("FM_SERVER is required");
  }
  if (!config.filemaker.database) {
    errors.push("FM_DATABASE is required");
  }
  if (!config.filemaker.user) {
    errors.push("FM_USER is required");
  }

  // Validate server configuration
  if (config.server.transport !== "stdio") {
    if (config.server.port < 1 || config.server.port > 65535) {
      errors.push("MCP_PORT must be between 1 and 65535");
    }
  }

  // Validate HTTPS configuration
  if (config.server.transport === "https") {
    if (!config.security?.certPath) {
      errors.push("MCP_CERT_PATH is required for HTTPS transport");
    }
    if (!config.security?.keyPath) {
      errors.push("MCP_KEY_PATH is required for HTTPS transport");
    }
    if (config.security?.certPath && !fs.existsSync(config.security.certPath)) {
      errors.push(`Certificate file not found: ${config.security.certPath}`);
    }
    if (config.security?.keyPath && !fs.existsSync(config.security.keyPath)) {
      errors.push(`Key file not found: ${config.security.keyPath}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get configuration file path
 */
export function getConfigFilePath(): string {
  return getConfigFile();
}

/**
 * Get environment file path
 */
export function getEnvFilePath(): string {
  return getEnvFile();
}

/**
 * Check if configuration exists
 */
export function hasConfig(): boolean {
  return fs.existsSync(getConfigFile());
}

/**
 * Get connections from config file
 */
export function getConnections(): Record<string, Connection> {
  const config = loadConfigFile();
  return config.connections || {};
}

/**
 * Get a specific connection from config
 */
export function getConnection(name: string): Connection | null {
  const connections = getConnections();
  return connections[name] || null;
}

/**
 * Add a connection to config file
 */
export function addConnection(name: string, connection: Connection): void {
  const config = mergeWithDefaults(loadConfigFile());

  if (!config.connections) {
    config.connections = {};
  }

  // Check if connection already exists
  if (config.connections[name]) {
    throw new Error(`Connection "${name}" already exists`);
  }

  // Validate connection data
  if (!connection.server || connection.server.trim() === "") {
    throw new Error("Server is required");
  }
  if (!connection.database || connection.database.trim() === "") {
    throw new Error("Database is required");
  }
  if (!connection.user || connection.user.trim() === "") {
    throw new Error("User is required");
  }
  if (!connection.password || connection.password.trim() === "") {
    throw new Error("Password is required");
  }

  // Store trimmed values (matches the validation above).
  config.connections[name] = {
    name,
    server: connection.server.trim(),
    database: connection.database.trim(),
    user: connection.user.trim(),
    password: connection.password,
    verifySsl: connection.verifySsl,
  };
  saveConfigFile(config);
}

/**
 * Merge a partial config (e.g. loaded from disk) with the defaults so saved
 * files always have a complete schema (`server`, `filemaker`, etc.).
 */
function mergeWithDefaults(partial: Partial<AppConfig>): AppConfig {
  return {
    server: {
      transport: partial.server?.transport || "stdio",
      port: partial.server?.port ?? DEFAULT_HTTP_PORT,
      host: partial.server?.host || "localhost",
    },
    filemaker: {
      server: partial.filemaker?.server || "",
      database: partial.filemaker?.database || "",
      user: partial.filemaker?.user || "",
      password: partial.filemaker?.password,
      verifySsl: partial.filemaker?.verifySsl,
      timeout: partial.filemaker?.timeout,
    },
    security: partial.security,
    connections: partial.connections,
    defaultConnection: partial.defaultConnection,
  };
}

/**
 * Resolve the effective verifySsl flag from possibly-undefined sources.
 * Defaults to `true` unless explicitly set to `false`.
 */
export function resolveVerifySsl(...sources: Array<boolean | undefined>): boolean {
  for (const v of sources) {
    if (v !== undefined) return v !== false;
  }
  return true;
}

/**
 * Remove a connection from config file
 */
export function removeConnection(name: string): void {
  const config = mergeWithDefaults(loadConfigFile());

  // Check if connection exists
  if (!config.connections || !config.connections[name]) {
    throw new Error(`Connection "${name}" not found`);
  }

  delete config.connections[name];

  // If this was the default connection, clear it
  if (config.defaultConnection === name) {
    config.defaultConnection = undefined;
  }

  saveConfigFile(config);
}

/**
 * List all connections from config
 */
export function listConnections(): Connection[] {
  const connections = getConnections();
  return Object.values(connections);
}

/**
 * Set default connection in config
 */
export function setDefaultConnection(name: string): void {
  const config = mergeWithDefaults(loadConfigFile());

  if (!config.connections || !config.connections[name]) {
    throw new Error(`Connection "${name}" not found`);
  }

  config.defaultConnection = name;
  saveConfigFile(config);
}

/**
 * Get default connection name from config
 */
export function getDefaultConnectionName(): string | undefined {
  const config = loadConfigFile();
  return config.defaultConnection;
}

/**
 * Get default connection from config
 */
export function getDefaultConnection(): Connection | null {
  const defaultName = getDefaultConnectionName();
  if (!defaultName) {
    return null;
  }
  return getConnection(defaultName);
}
