import { ODataClient, ODataClientConfig } from "./odata-client.js";
import { Connection, getDefaultConnection, getConnection } from "./config.js";
import { logger } from "./logger.js";

/**
 * Describes a single active in-memory session returned by listActiveSessions().
 */
export interface SessionInfo {
  name: string;
  server: string;
  database: string;
  user: string;
  isCurrent: boolean;
}

/**
 * Connection Manager for OData clients
 * Manages multiple OData client instances for different connections
 */
export class ConnectionManager {
  private clients: Map<string, ODataClient>;
  // Stores the original connection params so we can surface them in session listings
  // without needing to re-read the config file.
  private clientMeta: Map<string, { server: string; database: string; user: string }>;
  private currentConnectionName?: string;

  constructor() {
    this.clients = new Map();
    this.clientMeta = new Map();
  }

  /**
   * Create an OData client from a connection configuration
   */
  private createClient(connection: Connection, verifySsl?: boolean, timeout?: number): ODataClient {
    const config: ODataClientConfig = {
      server: connection.server,
      database: connection.database,
      user: connection.user,
      password: connection.password,
      verifySsl: verifySsl !== undefined ? verifySsl : connection.verifySsl,
      timeout: timeout,
    };

    return new ODataClient(config);
  }

  /**
   * Get or create a client for a named connection from the persisted config.
   */
  getClient(connectionName: string, verifySsl?: boolean, timeout?: number): ODataClient {
    // Return cached client if available
    if (this.clients.has(connectionName)) {
      return this.clients.get(connectionName)!;
    }

    // Load connection from saved config
    const connection = getConnection(connectionName);
    if (!connection) {
      throw new Error(`Connection "${connectionName}" not found`);
    }

    const client = this.createClient(connection, verifySsl, timeout);
    this.clients.set(connectionName, client);
    this.clientMeta.set(connectionName, {
      server: connection.server,
      database: connection.database,
      user: connection.user,
    });
    this.currentConnectionName = connectionName;

    logger.debug(`Created OData client for connection: ${connectionName}`);
    return client;
  }

  /**
   * Look up a cached client by alias without any side effects (no
   * currentConnectionName mutation). Returns null if the alias is unknown.
   * Used for per-call connection targeting in OData tools.
   */
  getClientByName(name: string): ODataClient | null {
    return this.clients.get(name) ?? null;
  }

  /**
   * Create a client with inline credentials (temporary, not saved).
   */
  createInlineClient(connection: Connection, verifySsl?: boolean, timeout?: number): ODataClient {
    return this.createInlineClientNamed(connection, verifySsl, timeout).client;
  }

  /**
   * Like createInlineClient but also returns the cache key so the caller can
   * remove the entry if the connection turns out to be broken.
   *
   * @param explicitAlias  When provided the session is stored under this name
   *   instead of an auto-generated "inline_…" key. Useful for bulk-connect
   *   so that every session has a human-readable alias.
   */
  createInlineClientNamed(
    connection: Connection,
    verifySsl?: boolean,
    timeout?: number,
    explicitAlias?: string
  ): { client: ODataClient; name: string } {
    const client = this.createClient(connection, verifySsl, timeout);

    const name =
      explicitAlias && explicitAlias.trim() !== ""
        ? explicitAlias.trim()
        : `inline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.clients.set(name, client);
    this.clientMeta.set(name, {
      server: connection.server,
      database: connection.database,
      user: connection.user,
    });
    this.currentConnectionName = name;

    logger.debug(`Created inline OData client: ${name}`);
    return { client, name };
  }

  /**
   * Return metadata for every active in-memory session, indicating which one
   * is currently active. Useful for fm_odata_list_active_sessions and
   * fm_odata_describe_sessions.
   */
  listActiveSessions(): SessionInfo[] {
    const sessions: SessionInfo[] = [];
    for (const [name, meta] of this.clientMeta) {
      sessions.push({
        name,
        server: meta.server,
        database: meta.database,
        user: meta.user,
        isCurrent: name === this.currentConnectionName,
      });
    }
    return sessions;
  }

  /**
   * Get the current active client
   */
  getCurrentClient(): ODataClient | null {
    if (!this.currentConnectionName) {
      // Try to use default connection
      const defaultConn = getDefaultConnection();
      if (defaultConn && defaultConn.name) {
        return this.getClient(defaultConn.name);
      }
      return null;
    }

    // Always try to get/create the client for the current connection.
    // For inline sessions the name won't be in the persisted config, so
    // getClient() would throw — fall back to the raw clients Map instead.
    if (this.clients.has(this.currentConnectionName)) {
      return this.clients.get(this.currentConnectionName)!;
    }
    try {
      return this.getClient(this.currentConnectionName);
    } catch {
      this.currentConnectionName = undefined;
      return null;
    }
  }

  /**
   * Get current connection name
   */
  getCurrentConnectionName(): string | undefined {
    return this.currentConnectionName;
  }

  /**
   * Switch the active connection by name.
   * Accepts both persisted config names and runtime aliases (inline sessions).
   */
  setCurrentConnection(connectionName: string, verifySsl?: boolean, timeout?: number): void {
    // If already in-memory (inline session), just activate it.
    if (this.clients.has(connectionName)) {
      this.currentConnectionName = connectionName;
      logger.info(`Switched to session: ${connectionName}`);
      return;
    }

    // Otherwise try the persisted config.
    const connection = getConnection(connectionName);
    if (!connection) {
      throw new Error(`Connection "${connectionName}" not found in config or active sessions`);
    }

    this.getClient(connectionName, verifySsl, timeout);
    this.currentConnectionName = connectionName;
    logger.info(`Switched to connection: ${connectionName}`);
  }

  /**
   * Test a connection
   */
  async testConnection(connectionName: string): Promise<boolean> {
    try {
      const client = this.getClient(connectionName);
      return await client.testConnection();
    } catch (error) {
      logger.error(`Connection test failed for ${connectionName}:`, error);
      return false;
    }
  }

  /**
   * Clear all cached clients and metadata
   */
  clearClients(): void {
    this.clients.clear();
    this.clientMeta.clear();
    this.currentConnectionName = undefined;
    logger.debug("Cleared all cached OData clients");
  }

  /**
   * Remove a specific client from cache
   */
  removeClient(connectionName: string): void {
    this.clients.delete(connectionName);
    this.clientMeta.delete(connectionName);
    if (this.currentConnectionName === connectionName) {
      this.currentConnectionName = undefined;
    }
    logger.debug(`Removed OData client: ${connectionName}`);
  }
}

// Export singleton instance
export const connectionManager = new ConnectionManager();
