import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  getConfig,
  validateConfig,
  getConfigDir,
  addConnection,
  removeConnection,
  listConnections,
  getConnection,
  setDefaultConnection,
  getDefaultConnection,
} from '../../src/config';

describe('Config Module', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv };
    
    // Set test HOME directory to unique temp dir per test
    const uniqueTempDir = path.join(os.tmpdir(), `fms-odata-test-${Date.now()}-${Math.random()}`);
    process.env.HOME = uniqueTempDir;
    
    // Clean up any existing config
    const configDir = path.join(uniqueTempDir, '.fms-odata-mcp');
    if (fs.existsSync(configDir)) {
      fs.rmSync(configDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up test directories
    const testDirs = fs.readdirSync(os.tmpdir())
      .filter(name => name.startsWith('fms-odata-test-'))
      .map(name => path.join(os.tmpdir(), name));
    
    testDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
    
    // Restore original environment
    process.env = originalEnv;
  });

  describe('getConfig', () => {
    test('should return default configuration when no env vars set', () => {
      delete process.env.FM_SERVER;
      delete process.env.FM_DATABASE;
      delete process.env.FM_USER;

      const config = getConfig();

      expect(config.server.transport).toBe('stdio');
      expect(config.server.port).toBe(3000);
      expect(config.server.host).toBe('localhost');
      expect(config.filemaker.server).toBe('');
      expect(config.filemaker.database).toBe('');
      expect(config.filemaker.user).toBe('');
    });

    test('should read configuration from environment variables', () => {
      process.env.FM_SERVER = 'https://test-server.com';
      process.env.FM_DATABASE = 'TestDB';
      process.env.FM_USER = 'testuser';
      process.env.FM_PASSWORD = 'testpass';
      process.env.FM_VERIFY_SSL = 'false';
      process.env.FM_TIMEOUT = '60000';

      const config = getConfig();

      expect(config.filemaker.server).toBe('https://test-server.com');
      expect(config.filemaker.database).toBe('TestDB');
      expect(config.filemaker.user).toBe('testuser');
      expect(config.filemaker.password).toBe('testpass');
      expect(config.filemaker.verifySsl).toBe(false);
      expect(config.filemaker.timeout).toBe(60000);
    });

    test('should default verifySsl to true when not specified', () => {
      delete process.env.FM_VERIFY_SSL;

      const config = getConfig();

      expect(config.filemaker.verifySsl).toBe(true);
    });

    test('should parse FM_VERIFY_SSL correctly', () => {
      process.env.FM_VERIFY_SSL = 'true';
      const config1 = getConfig();
      expect(config1.filemaker.verifySsl).toBe(true);

      process.env.FM_VERIFY_SSL = 'false';
      const config2 = getConfig();
      expect(config2.filemaker.verifySsl).toBe(false);

      process.env.FM_VERIFY_SSL = 'TRUE';
      const config3 = getConfig();
      expect(config3.filemaker.verifySsl).toBe(true);
    });

    test('should read MCP transport configuration', () => {
      process.env.MCP_TRANSPORT = 'https';
      process.env.MCP_PORT = '8443';
      process.env.MCP_HOST = '0.0.0.0';

      const config = getConfig();

      expect(config.server.transport).toBe('https');
      expect(config.server.port).toBe(8443);
      expect(config.server.host).toBe('0.0.0.0');
    });
  });

  describe('validateConfig', () => {
    test('should validate complete configuration', () => {
      const config = {
        server: {
          transport: 'stdio' as const,
          port: 3000,
          host: 'localhost',
        },
        filemaker: {
          server: 'https://filemaker.test',
          database: 'TestDB',
          user: 'admin',
          password: 'password',
        },
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should return errors for missing required fields', () => {
      const config = {
        server: {
          transport: 'stdio' as const,
          port: 3000,
          host: 'localhost',
        },
        filemaker: {
          server: '',
          database: '',
          user: '',
        },
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('FM_SERVER is required');
      expect(result.errors).toContain('FM_DATABASE is required');
      expect(result.errors).toContain('FM_USER is required');
    });

    test('should validate port number range', () => {
      const config = {
        server: {
          transport: 'http' as const,
          port: 70000,
          host: 'localhost',
        },
        filemaker: {
          server: 'https://test.com',
          database: 'DB',
          user: 'user',
        },
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('MCP_PORT must be between 1 and 65535');
    });

    test('should not validate port for stdio transport', () => {
      const config = {
        server: {
          transport: 'stdio' as const,
          port: 70000, // Invalid but should be ignored
          host: 'localhost',
        },
        filemaker: {
          server: 'https://test.com',
          database: 'DB',
          user: 'user',
        },
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });
  });

  describe('Connection Management', () => {
    test('should add a connection', () => {
      const connection = {
        server: 'https://test.com',
        database: 'TestDB',
        user: 'admin',
        password: 'password',
      };

      expect(() => {
        addConnection('test-conn', connection);
      }).not.toThrow();

      const saved = getConnection('test-conn');
      expect(saved).toEqual({ ...connection, name: 'test-conn' });
    });

    test('should not allow duplicate connection names', () => {
      const connection = {
        server: 'https://test.com',
        database: 'TestDB',
        user: 'admin',
        password: 'password',
      };

      addConnection('test-conn', connection);

      expect(() => {
        addConnection('test-conn', connection);
      }).toThrow('Connection "test-conn" already exists');
    });

    test('should validate connection data', () => {
      const invalidConnection = {
        server: '',
        database: 'TestDB',
        user: 'admin',
        password: 'password',
      };

      expect(() => {
        addConnection('test-conn', invalidConnection);
      }).toThrow('Server is required');
    });

    test('should remove a connection', () => {
      const connection = {
        server: 'https://test.com',
        database: 'TestDB',
        user: 'admin',
        password: 'password',
      };

      addConnection('test-conn', connection);
      expect(getConnection('test-conn')).toBeTruthy();

      removeConnection('test-conn');
      expect(getConnection('test-conn')).toBeNull();
    });

    test('should throw when removing non-existent connection', () => {
      expect(() => {
        removeConnection('non-existent');
      }).toThrow('Connection "non-existent" not found');
    });

    test('should list all connections', () => {
      const conn1 = {
        server: 'https://server1.com',
        database: 'DB1',
        user: 'user1',
        password: 'pass1',
      };

      const conn2 = {
        server: 'https://server2.com',
        database: 'DB2',
        user: 'user2',
        password: 'pass2',
      };

      addConnection('conn1', conn1);
      addConnection('conn2', conn2);

      const connections = listConnections();

      expect(connections).toHaveLength(2);
      expect(connections.map(c => c.name)).toContain('conn1');
      expect(connections.map(c => c.name)).toContain('conn2');
    });

    test('should set and get default connection', () => {
      const connection = {
        server: 'https://test.com',
        database: 'TestDB',
        user: 'admin',
        password: 'password',
      };

      addConnection('test-conn', connection);
      setDefaultConnection('test-conn');

      const defaultConn = getDefaultConnection();
      expect(defaultConn?.name).toBe('test-conn');
    });

    test('should throw when setting non-existent connection as default', () => {
      expect(() => {
        setDefaultConnection('non-existent');
      }).toThrow('Connection "non-existent" not found');
    });

    test('should clear default when removing default connection', () => {
      const connection = {
        server: 'https://test.com',
        database: 'TestDB',
        user: 'admin',
        password: 'password',
      };

      addConnection('test-conn', connection);
      setDefaultConnection('test-conn');
      expect(getDefaultConnection()).toBeTruthy();

      removeConnection('test-conn');
      expect(getDefaultConnection()).toBeNull();
    });
  });

  describe('getConfigDir', () => {
    test('should return config directory path', () => {
      const configDir = getConfigDir();
      expect(configDir).toContain('.fms-odata-mcp');
    });

    test('should use HOME environment variable', () => {
      const testHome = '/test/home';
      process.env.HOME = testHome;

      const configDir = getConfigDir();
      expect(configDir).toContain(testHome);
      expect(configDir).toContain('.fms-odata-mcp');
    });
  });
});
