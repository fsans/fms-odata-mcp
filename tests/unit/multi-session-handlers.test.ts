import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock connection.js
jest.unstable_mockModule('../../src/connection.js', () => ({
  ConnectionManager: jest.fn(() => ({})),
  connectionManager: {
    createInlineClientNamed: jest.fn(),
    setCurrentConnection: jest.fn(),
    getCurrentConnectionName: jest.fn(),
    listActiveSessions: jest.fn(() => []),
    getClientByName: jest.fn(),
    removeClient: jest.fn(),
    clearClients: jest.fn(),
    getServerVersion: jest.fn(),
  },
}));

// Mock config.js — provide ALL exports needed by the import chain
jest.unstable_mockModule('../../src/config.js', () => ({
  DEFAULT_HTTP_PORT: 3333,
  DEFAULT_HTTPS_PORT: 3443,
  getConfig: jest.fn(() => ({
    server: { transport: 'stdio' as const },
    filemaker: { verifySsl: false, timeout: 30000 },
  })),
  getConnection: jest.fn(),
  listConnections: jest.fn(() => []),
  addConnection: jest.fn(),
  removeConnection: jest.fn(),
  setDefaultConnection: jest.fn(),
  getDefaultConnectionName: jest.fn(),
  getDefaultConnection: jest.fn(() => null),
  getConfigDir: jest.fn(() => '/tmp/fms-odata-mcp-test'),
  getConfigFilePath: jest.fn(() => '/tmp/fms-odata-mcp-test/config.json'),
  getEnvFilePath: jest.fn(() => '/tmp/.env'),
  hasConfig: jest.fn(() => false),
  getConnections: jest.fn(() => []),
  resolveVerifySsl: jest.fn(() => false),
  validateConfig: jest.fn(),
  loadConfigFile: jest.fn(),
  saveConfigFile: jest.fn(),
  loadEnvFile: jest.fn(),
}));

// Mock odata-parser.js
jest.unstable_mockModule('../../src/odata-parser.js', () => ({
  ODataParser: {
    parseMetadataForTables: jest.fn(() => [{ name: 'table1' }, { name: 'table2' }]),
    parseMetadataForFields: jest.fn(() => [{ name: 'field1', type: 'Edm.String' }]),
  },
}));

// Dynamically import AFTER mock setup
const { handleConnectionTool } = await import('../../src/tools/connection.js');
const { connectionManager } = await import('../../src/connection.js');
const { ODataParser } = await import('../../src/odata-parser.js');

describe('Multi-session tool handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (connectionManager.listActiveSessions as jest.Mock).mockReturnValue([]);
  });

  describe('handleConnectMulti', () => {
    function makeMockClient(ok: boolean, error?: string) {
      return {
        testConnectionDetailed: jest.fn(() =>
          Promise.resolve(ok ? { ok: true } : { ok: false, error: error ?? 'Connection failed' })
        ),
      };
    }

    function makeArgs(databases: any[], opts: { server?: string; user?: string; password?: string } = {}) {
      return {
        server: opts.server ?? 'https://fms.example.com',
        user: opts.user ?? 'admin',
        password: opts.password ?? 'pass',
        databases,
        verifySsl: false,
      };
    }

    it('all connections succeed — summary shows 3/3, first is active', async () => {
      const databases = [
        { database: 'DB1' },
        { database: 'DB2' },
        { database: 'DB3' },
      ];
      (connectionManager.createInlineClientNamed as jest.Mock).mockImplementation((conn, verifySsl, timeout, alias) => ({
        client: makeMockClient(true),
        name: alias,
      }));

      const result = await handleConnectionTool('fm_odata_connect_multi', makeArgs(databases));

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('3/3');
      expect(result.content[0].text).toContain('[active]');
      // First successful entry should be active
      expect(result.content[0].text).toContain('DB1');
      expect(connectionManager.setCurrentConnection).toHaveBeenCalledWith('DB1');
    });

    it('partial failure — summary shows 2/3, failed entry has error', async () => {
      const databases = [
        { database: 'DB1' },
        { database: 'DB2' },
        { database: 'DB3' },
      ];
      (connectionManager.createInlineClientNamed as jest.Mock).mockImplementation((conn, verifySsl, timeout, alias) => ({
        client: alias === 'DB2' ? makeMockClient(false, 'Auth failed') : makeMockClient(true),
        name: alias,
      }));

      const result = await handleConnectionTool('fm_odata_connect_multi', makeArgs(databases));

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('2/3');
      expect(result.content[0].text).toContain('Auth failed');
      // First successful entry (DB1) should be active
      expect(connectionManager.setCurrentConnection).toHaveBeenCalledWith('DB1');
    });

    it('primary selection — entry with primary:true succeeds and becomes active', async () => {
      const databases = [
        { database: 'DB1' },
        { database: 'DB2', primary: true },
        { database: 'DB3' },
      ];
      (connectionManager.createInlineClientNamed as jest.Mock).mockImplementation((conn, verifySsl, timeout, alias) => ({
        client: makeMockClient(true),
        name: alias,
      }));

      const result = await handleConnectionTool('fm_odata_connect_multi', makeArgs(databases));

      expect(result.content[0].text).toContain('3/3');
      // Primary entry (DB2) should be active
      expect(connectionManager.setCurrentConnection).toHaveBeenCalledWith('DB2');
    });

    it('primary fails, first success is active', async () => {
      const databases = [
        { database: 'DB1' },
        { database: 'DB2', primary: true },
        { database: 'DB3' },
      ];
      (connectionManager.createInlineClientNamed as jest.Mock).mockImplementation((conn, verifySsl, timeout, alias) => ({
        client: alias === 'DB2' ? makeMockClient(false, 'Down') : makeMockClient(true),
        name: alias,
      }));

      const result = await handleConnectionTool('fm_odata_connect_multi', makeArgs(databases));

      expect(result.content[0].text).toContain('2/3');
      // First successful entry (DB1) should be active since primary failed
      expect(connectionManager.setCurrentConnection).toHaveBeenCalledWith('DB1');
    });

    it('all fail — isError true, summary shows 0/3', async () => {
      const databases = [
        { database: 'DB1' },
        { database: 'DB2' },
        { database: 'DB3' },
      ];
      (connectionManager.createInlineClientNamed as jest.Mock).mockImplementation((conn, verifySsl, timeout, alias) => ({
        client: makeMockClient(false, 'Server down'),
        name: alias,
      }));

      const result = await handleConnectionTool('fm_odata_connect_multi', makeArgs(databases));

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('0/3');
      expect(connectionManager.setCurrentConnection).not.toHaveBeenCalled();
    });

    it('duplicate aliases — returns error before connecting', async () => {
      const databases = [
        { database: 'DB1', alias: 'dup' },
        { database: 'DB2', alias: 'dup' },
      ];

      const result = await handleConnectionTool('fm_odata_connect_multi', makeArgs(databases));

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('duplicate');
      expect(result.content[0].text).toContain('dup');
      expect(connectionManager.createInlineClientNamed).not.toHaveBeenCalled();
    });
  });

  describe('handleDescribeSessions', () => {
    it('no active sessions — returns "No active sessions" message', async () => {
      (connectionManager.listActiveSessions as jest.Mock).mockReturnValue([]);

      const result = await handleConnectionTool('fm_odata_describe_sessions', {});

      expect(result.content[0].text).toContain('No active sessions');
    });

    it('single session — returns tables from that session', async () => {
      const session = { name: 'prod', server: 'https://s1', database: 'DB1', user: 'admin', isCurrent: true };
      (connectionManager.listActiveSessions as jest.Mock).mockReturnValue([session]);
      const mockClient = {
        getMetadata: jest.fn().mockResolvedValue('<metadata/>'),
        getServerVersion: jest.fn().mockResolvedValue(null),
      };
      (connectionManager.getClientByName as jest.Mock).mockReturnValue(mockClient);

      const result = await handleConnectionTool('fm_odata_describe_sessions', {});

      const output = JSON.parse(result.content[0].text);
      expect(output.sessions).toHaveLength(1);
      expect(output.sessions[0].alias).toBe('prod');
      expect(output.tables).toHaveLength(2);
      expect(output.tables[0].table).toBe('table1');
      expect(output.tables[0].connection).toBe('prod');
    });

    it('multiple sessions, no collisions — returns flat list with connection alias', async () => {
      const sessions = [
        { name: 'prod', server: 'https://s1', database: 'DB1', user: 'admin', isCurrent: true },
        { name: 'dev', server: 'https://s2', database: 'DB2', user: 'dev', isCurrent: false },
      ];
      (connectionManager.listActiveSessions as jest.Mock).mockReturnValue(sessions);
      (connectionManager.getClientByName as jest.Mock).mockReturnValue({
        getMetadata: jest.fn().mockResolvedValue('<metadata/>'),
        getServerVersion: jest.fn().mockResolvedValue(null),
      });
      // Return different tables per session to avoid collision
      let callCount = 0;
      (ODataParser.parseMetadataForTables as jest.Mock).mockImplementation(() => {
        callCount++;
        return callCount === 1
          ? [{ name: 'prod_table' }, { name: 'prod_other' }]
          : [{ name: 'dev_table' }, { name: 'dev_other' }];
      });

      const result = await handleConnectionTool('fm_odata_describe_sessions', {});

      const output = JSON.parse(result.content[0].text);
      expect(output.sessions).toHaveLength(2);
      expect(output.tables).toHaveLength(4); // 2 tables per session
      // Each table should have a connection alias
      const prodTables = output.tables.filter((t: any) => t.connection === 'prod');
      const devTables = output.tables.filter((t: any) => t.connection === 'dev');
      expect(prodTables).toHaveLength(2);
      expect(devTables).toHaveLength(2);
      expect(output.collisions).toBeUndefined();
    });

    it('table name collision — same table in two sessions is flagged', async () => {
      const sessions = [
        { name: 'prod', server: 'https://s1', database: 'DB1', user: 'admin', isCurrent: true },
        { name: 'dev', server: 'https://s2', database: 'DB2', user: 'dev', isCurrent: false },
      ];
      (connectionManager.listActiveSessions as jest.Mock).mockReturnValue(sessions);
      (connectionManager.getClientByName as jest.Mock).mockReturnValue({
        getMetadata: jest.fn().mockResolvedValue('<metadata/>'),
        getServerVersion: jest.fn().mockResolvedValue(null),
      });
      // Both sessions return the same table names (table1, table2)
      (ODataParser.parseMetadataForTables as jest.Mock).mockReturnValue([
        { name: 'shared_table' },
      ]);

      const result = await handleConnectionTool('fm_odata_describe_sessions', {});

      const output = JSON.parse(result.content[0].text);
      expect(output.collisions).toContain('shared_table');
      expect(output.collisionWarning).toContain('shared_table');
      // Each table entry should have collision: true
      expect(output.tables.every((t: any) => t.collision === true)).toBe(true);
    });

    it('session metadata fetch fails — error surfaced per-session', async () => {
      const sessions = [
        { name: 'prod', server: 'https://s1', database: 'DB1', user: 'admin', isCurrent: true },
        { name: 'dev', server: 'https://s2', database: 'DB2', user: 'dev', isCurrent: false },
      ];
      (connectionManager.listActiveSessions as jest.Mock).mockReturnValue(sessions);
      (connectionManager.getClientByName as jest.Mock).mockImplementation((name: string) => {
        if (name === 'prod') {
          return {
            getMetadata: jest.fn().mockRejectedValue(new Error('Network error')),
            getServerVersion: jest.fn().mockResolvedValue(null),
          };
        }
        return {
          getMetadata: jest.fn().mockResolvedValue('<metadata/>'),
          getServerVersion: jest.fn().mockResolvedValue(null),
        };
      });

      const result = await handleConnectionTool('fm_odata_describe_sessions', {});

      const output = JSON.parse(result.content[0].text);
      expect(output.sessions).toHaveLength(2);
      const prodSession = output.sessions.find((s: any) => s.alias === 'prod');
      expect(prodSession.error).toContain('Network error');
      // Dev session should still have tables
      const devTables = output.tables.filter((t: any) => t.connection === 'dev');
      expect(devTables.length).toBeGreaterThan(0);
    });
  });

  describe('handleGetServerVersion', () => {
    it('no active connection — returns error', async () => {
      (connectionManager.getCurrentConnectionName as jest.Mock).mockReturnValue(undefined);

      const result = await handleConnectionTool('fm_odata_get_server_version', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No active connection');
    });

    it('returns version info for the active session', async () => {
      (connectionManager.getCurrentConnectionName as jest.Mock).mockReturnValue('prod');
      const mockVersion = {
        major: 2024,
        minor: 1,
        build: '1.0',
        fullVersion: '2024.1',
      };
      (connectionManager.getServerVersion as jest.Mock).mockResolvedValue(mockVersion);
      (connectionManager.listActiveSessions as jest.Mock).mockReturnValue([
        { name: 'prod', server: 'https://s1', database: 'DB1', user: 'admin', isCurrent: true },
      ]);

      const result = await handleConnectionTool('fm_odata_get_server_version', {});

      expect(result.isError).toBeUndefined();
      const text = result.content[0].text;
      expect(text).toContain('2024');
    });

    it('uses connection param when provided', async () => {
      const mockVersion = { major: 2024, minor: 1, build: '1.0', fullVersion: '2024.1' };
      (connectionManager.getServerVersion as jest.Mock).mockResolvedValue(mockVersion);
      (connectionManager.listActiveSessions as jest.Mock).mockReturnValue([
        { name: 'dev', server: 'https://s2', database: 'DB2', user: 'dev', isCurrent: false },
      ]);

      const result = await handleConnectionTool('fm_odata_get_server_version', { connection: 'dev' });

      expect(connectionManager.getServerVersion).toHaveBeenCalledWith('dev');
      expect(result.isError).toBeUndefined();
    });

    it('handles getServerVersion error', async () => {
      (connectionManager.getCurrentConnectionName as jest.Mock).mockReturnValue('prod');
      (connectionManager.getServerVersion as jest.Mock).mockRejectedValue(new Error('Timeout'));

      const result = await handleConnectionTool('fm_odata_get_server_version', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Timeout');
    });
  });
});
