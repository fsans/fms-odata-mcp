import { ODataClient, ODataClientConfig } from "./odata-client.js";
import { Connection, getDefaultConnection, getConnection } from "./config.js";
import { logger } from "./logger.js";

/**
 * Connection Manager for OData clients
 * Manages multiple OData client instances for different connections
 */
export class ConnectionManager {
  private clients: Map<string, ODataClient>;
  private currentConnectionName?: string;

  constructor() {
    this.clients = new Map();
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
      verifySsl: verifySsl,
      timeout: timeout,
    };

    return new ODataClient(config);
  }

  /**
   * Get or create a client for a connection
   */
  getClient(connectionName: string, verifySsl?: boolean, timeout?: number): ODataClient {
    // Check if we already have a client for this connection
    if (this.clients.has(connectionName)) {
      return this.clients.get(connectionName)!;
    }

    // Get connection from config
    const connection = getConnection(connectionName);
    if (!connection) {
      throw new Error(`Connection "${connectionName}" not found`);
    }

    // Create and cache the client
    const client = this.createClient(connection, verifySsl, timeout);
    this.clients.set(connectionName, client);
    this.currentConnectionName = connectionName;

    logger.debug(`Created OData client for connection: ${connectionName}`);
    return client;
  }

  /**
   * Create a client with inline credentials (temporary, not saved)
   */
  createInlineClient(connection: Connection, verifySsl?: boolean, timeout?: number): ODataClient {
    const client = this.createClient(connection, verifySsl, timeout);
    
    // Store with a unique temporary name
    const tempName = `inline_${Date.now()}`;
    this.clients.set(tempName, client);
    this.currentConnectionName = tempName;

    logger.debug(`Created inline OData client`);
    return client;
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

    return this.clients.get(this.currentConnectionName) || null;
  }

  /**
   * Get current connection name
   */
  getCurrentConnectionName(): string | undefined {
    return this.currentConnectionName;
  }

  /**
   * Set the current connection
   */
  setCurrentConnection(connectionName: string): void {
    const connection = getConnection(connectionName);
    if (!connection) {
      throw new Error(`Connection "${connectionName}" not found`);
    }

    this.getClient(connectionName);
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
   * Clear all cached clients
   */
  clearClients(): void {
    this.clients.clear();
    this.currentConnectionName = undefined;
    logger.debug("Cleared all cached OData clients");
  }

  /**
   * Remove a specific client from cache
   */
  removeClient(connectionName: string): void {
    this.clients.delete(connectionName);
    if (this.currentConnectionName === connectionName) {
      this.currentConnectionName = undefined;
    }
    logger.debug(`Removed OData client: ${connectionName}`);
  }
}

// Export singleton instance
export const connectionManager = new ConnectionManager();
