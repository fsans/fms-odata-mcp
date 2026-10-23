import { ODataClient, ODataClientConfig } from "./odata-client.js";
import {
  Connection,
  getDefaultConnection,
  getDefaultConnectionName,
  getConnection,
  getConfig,
} from "./config.js";
import { logger } from "./logger.js";
import { FMServerVersion } from "./fm-version.js";

/**
 * Describes a single active in-memory session returned by listActiveSessions().
 */
export interface SessionInfo {
  name: string;
  server: string;
  database: string;
  user: string;
  isCurrent: boolean;
  /** Cached FM Server version for this session, if already fetched. */
  fmVersion?: FMServerVersion | null;
}

/**
 * Connection Manager for OData clients
 * Manages multiple OData client instances for different connections
 */
export class ConnectionManager {
  private clients: Map<string, ODataClient>;
  // Stores the original connection params so we can surface them in session listings
  // without needing to re-read the config file.
  private clientMeta: Map<string, { server: string; database: string; user: string; fmVersion?: FMServerVersion | null }>;
  private currentConnectionName?: string;

  constructor() {
    this.clients = new Map();
    this.clientMeta = new Map();
  }

  /**
   * Create an OData client from a connection configuration.
   * Falls back to the global FileMaker config (env vars / config.json
   * `filemaker` section) for verifySsl and timeout when not supplied
   * explicitly on the call or on the connection object itself.
   */
  private createClient(connection: Connection, verifySsl?: boolean, timeout?: number): ODataClient {
    const filemakerConfig = getConfig().filemaker;
    const config: ODataClientConfig = {
      server: connection.server,
      database: connection.database,
      user: connection.user,
      password: connection.password,
      authType: connection.authType,
      bearerToken: connection.bearerToken,
      verifySsl:
        verifySsl !== undefined
          ? verifySsl
          : connection.verifySsl !== undefined
            ? connection.verifySsl
            : filemakerConfig.verifySsl,
      timeout: timeout !== undefined ? timeout : filemakerConfig.timeout,
    };

    return new ODataClient(config);
  }

  /**
   * Get or create a client for a named connection from the persisted config.
   */
  getClient(connectionName: string, verifySsl?: boolean, timeout?: number): ODataClient {
    // Return cached client if available
    if (this.clients.has(connectionName)) {
      // Surface when caller-supplied verifySsl/timeout are being ignored
      // because a client is already cached for this connection name. This
      // keeps the silent override visible in debug logs without changing the
      // long-standing caching semantics (reconnecting would invalidate every
      // active session alias that shares the underlying client).
      if (verifySsl !== undefined || timeout !== undefined) {
        logger.debug(
          `getClient("${connectionName}"): returning cached client; ` +
          `caller-supplied verifySsl/timeout ignored. ` +
          `Use removeClient() first to force a fresh client with new options.`
        );
      }
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
   * Look up a client by alias for per-call connection targeting.
   *
   * Resolution order:
   *   1. In-memory session cache (inline / multi-connect / previously loaded).
   *   2. Saved connections in config.json — lazily instantiated and cached on
   *      first use so a cold-start server can target any saved connection
   *      without a prior fm_odata_set_connection call.
   *
   * Side-effect-free with respect to the active/default session pointer:
   * this.currentConnectionName is NEVER mutated here.
   */
  getClientByName(name: string, verifySsl?: boolean, timeout?: number): ODataClient | null {
    if (this.clients.has(name)) {
      if (verifySsl !== undefined || timeout !== undefined) {
        logger.debug(
          `getClientByName("${name}"): returning cached client; ` +
          `caller-supplied verifySsl/timeout ignored. ` +
          `Use removeClient() first to force a fresh client with new options.`
        );
      }
      return this.clients.get(name)!;
    }

    const connection = getConnection(name);
    if (!connection) {
      return null;
    }

    const client = this.createClient(connection, verifySsl, timeout);
    this.clients.set(name, client);
    this.clientMeta.set(name, {
      server: connection.server,
      database: connection.database,
      user: connection.user,
    });

    logger.debug(`Lazily loaded OData client for saved connection: ${name}`);
    return client;
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
        // Only include fmVersion when it has already been fetched (avoids
        // triggering a $metadata HTTP request just to list sessions).
        ...(meta.fmVersion !== undefined ? { fmVersion: meta.fmVersion } : {}),
      });
    }
    return sessions;
  }

  /**
   * Get the current active client.
   *
   * Cold-start resolution when no session has been activated yet:
   *   1. defaultConnection from config.json (via getClient, which also
   *      sets this.currentConnectionName).
   *   2. Environment variables / config.json `filemaker` section
   *      (FM_SERVER, FM_DATABASE, FM_USER, FM_PASSWORD or bearer token) —
   *      cached under the "default" alias so env-configured deployments
   *      work out of the box.
   */
  getCurrentClient(): ODataClient | null {
    if (!this.currentConnectionName) {
      // 1. Try the default connection from config.json
      const defaultName = getDefaultConnectionName();
      const defaultConn = getDefaultConnection();
      if (defaultName && defaultConn) {
        return this.getClient(defaultName);
      }

      // 2. Fall back to env vars / global filemaker config
      const filemaker = getConfig().filemaker;
      const hasValidCredentials =
        (filemaker.authType === "bearer" && !!filemaker.bearerToken) ||
        (!!(filemaker.user && filemaker.password));
      if (filemaker.server && filemaker.database && hasValidCredentials) {
        if (!this.clients.has("default")) {
          const connection: Connection = {
            name: "default",
            server: filemaker.server,
            database: filemaker.database,
            user: filemaker.user ?? "",
            password: filemaker.password ?? "",
            verifySsl: filemaker.verifySsl,
            authType: filemaker.authType,
            bearerToken: filemaker.bearerToken,
          };
          const client = this.createClient(connection, filemaker.verifySsl, filemaker.timeout);
          this.clients.set("default", client);
          this.clientMeta.set("default", {
            server: connection.server,
            database: connection.database,
            user: connection.user,
          });
          logger.debug("Created OData client from environment/global config under alias 'default'");
        }
        this.currentConnectionName = "default";
        return this.clients.get("default")!;
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
   * Fetch (or return cached) FileMaker Server version for a named session.
   *
   * Delegates to the ODataClient's lazy getter, then stores the result back
   * in clientMeta so future listActiveSessions() calls can surface it without
   * an extra HTTP round-trip.
   *
   * @param sessionName  Alias of the in-memory session, or a saved connection
   *   name from config.json (lazily loaded and cached on first use).
   * @returns The parsed version, or null if the version cannot be determined.
   * @throws Error if the session alias is not found.
   */
  async getServerVersion(sessionName: string): Promise<FMServerVersion | null> {
    const client = this.getClientByName(sessionName);
    if (!client) {
      throw new Error(`Session "${sessionName}" not found`);
    }
    const version = await client.getServerVersion();
    const meta = this.clientMeta.get(sessionName);
    if (meta) {
      meta.fmVersion = version;
    }
    return version;
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
