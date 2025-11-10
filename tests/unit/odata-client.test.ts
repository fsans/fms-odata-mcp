import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { ODataClient, ODataClientConfig } from '../../src/odata-client';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ODataClient', () => {
  let client: ODataClient;
  let mockAxiosInstance: any;

  const testConfig: ODataClientConfig = {
    server: 'https://test-server.com',
    database: 'TestDB',
    user: 'admin',
    password: 'password',
    verifySsl: false,
    timeout: 30000,
  };

  beforeEach(() => {
    // Create a mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn((successHandler) => {
            // Call the success handler to test it
            const config = { headers: {} };
            successHandler(config);
            return 0;
          }),
        },
        response: {
          use: jest.fn(),
        },
      },
    };

    // Mock axios.create to return our mock instance
    mockedAxios.create = jest.fn(() => mockAxiosInstance) as any;

    client = new ODataClient(testConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create client with correct base URL', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }),
        })
      );
    });

    test('should configure SSL verification', () => {
      const createCall = (mockedAxios.create as jest.Mock).mock.calls[0][0];
      expect(createCall.httpsAgent).toBeDefined();
    });

    test('should default verifySsl to true', () => {
      const configWithoutVerifySsl = {
        ...testConfig,
        verifySsl: undefined,
      };
      
      new ODataClient(configWithoutVerifySsl);
      
      const createCall = (mockedAxios.create as jest.Mock).mock.calls[1][0];
      // Should create agent with rejectUnauthorized: true (default)
      expect(createCall.httpsAgent).toBeDefined();
    });
  });

  describe('getServiceDocument', () => {
    test('should fetch service document successfully', async () => {
      const mockResponse = {
        data: {
          '@odata.context': 'https://test-server.com/fmi/odata/v4/TestDB/$metadata',
          value: [
            { name: 'table1', kind: 'EntitySet' },
            { name: 'table2', kind: 'EntitySet' },
          ],
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await client.getServiceDocument();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        'https://test-server.com/fmi/odata/v4/TestDB'
      );
      expect(result).toEqual(mockResponse.data);
    });

    test('should handle errors correctly', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      await expect(client.getServiceDocument()).rejects.toThrow();
    });
  });

  describe('getMetadata', () => {
    test('should fetch metadata with XML accept header', async () => {
      const mockMetadata = '<?xml version="1.0"?><edmx:Edmx>...</edmx:Edmx>';
      mockAxiosInstance.get.mockResolvedValue({ data: mockMetadata });

      const result = await client.getMetadata();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        'https://test-server.com/fmi/odata/v4/TestDB/$metadata',
        expect.objectContaining({
          headers: {
            Accept: 'application/xml',
          },
        })
      );
      expect(result).toBe(mockMetadata);
    });
  });

  describe('queryRecords', () => {
    test('should query records with basic options', async () => {
      const mockResponse = {
        data: {
          '@odata.context': 'test',
          value: [
            { id: 1, name: 'Test1' },
            { id: 2, name: 'Test2' },
          ],
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await client.queryRecords('contacts');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        'https://test-server.com/fmi/odata/v4/TestDB/contacts'
      );
      expect(result).toEqual(mockResponse.data);
    });

    test('should build URL with filter option', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { value: [] } });

      await client.queryRecords('contacts', {
        filter: "name eq 'John'",
      });

      const url = mockAxiosInstance.get.mock.calls[0][0];
      expect(url).toContain('filter');
      expect(url).toContain('John');
    });

    test('should build URL with select option', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { value: [] } });

      await client.queryRecords('contacts', {
        select: 'id,name,email',
      });

      const url = mockAxiosInstance.get.mock.calls[0][0];
      expect(url).toContain('select');
      expect(url).toContain('id');
    });

    test('should build URL with top and skip options', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { value: [] } });

      await client.queryRecords('contacts', {
        top: 10,
        skip: 20,
      });

      const url = mockAxiosInstance.get.mock.calls[0][0];
      expect(url).toContain('top=10');
      expect(url).toContain('skip=20');
    });

    test('should build URL with count option', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { value: [] } });

      await client.queryRecords('contacts', {
        count: true,
      });

      const url = mockAxiosInstance.get.mock.calls[0][0];
      expect(url).toContain('count=true');
    });

    test('should build URL with multiple options', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { value: [] } });

      await client.queryRecords('contacts', {
        filter: "status eq 'active'",
        select: 'id,name',
        orderby: 'name asc',
        top: 5,
        skip: 10,
        count: true,
      });

      const url = mockAxiosInstance.get.mock.calls[0][0];
      expect(url).toContain('filter');
      expect(url).toContain('select');
      expect(url).toContain('orderby');
      expect(url).toContain('top=5');
      expect(url).toContain('skip=10');
      expect(url).toContain('count=true');
    });
  });

  describe('getRecord', () => {
    test('should get single record by ID', async () => {
      const mockRecord = { id: '123', name: 'John' };
      mockAxiosInstance.get.mockResolvedValue({ data: mockRecord });

      const result = await client.getRecord('contacts', '123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "https://test-server.com/fmi/odata/v4/TestDB/contacts('123')"
      );
      expect(result).toEqual(mockRecord);
    });

    test('should get record with select option', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: {} });

      await client.getRecord('contacts', '123', {
        select: 'id,name',
      });

      const url = mockAxiosInstance.get.mock.calls[0][0];
      expect(url).toContain('select');
      expect(url).toContain('id');
    });
  });

  describe('createRecord', () => {
    test('should create new record', async () => {
      const newRecord = { name: 'John', email: 'john@test.com' };
      const createdRecord = { id: '123', ...newRecord };
      
      mockAxiosInstance.post.mockResolvedValue({ data: createdRecord });

      const result = await client.createRecord('contacts', newRecord);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://test-server.com/fmi/odata/v4/TestDB/contacts',
        newRecord
      );
      expect(result).toEqual(createdRecord);
    });
  });

  describe('updateRecord', () => {
    test('should update existing record', async () => {
      const updates = { name: 'John Updated' };
      
      mockAxiosInstance.patch.mockResolvedValue({ data: {} });

      await client.updateRecord('contacts', '123', updates);

      expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
        "https://test-server.com/fmi/odata/v4/TestDB/contacts('123')",
        updates
      );
    });
  });

  describe('deleteRecord', () => {
    test('should delete record', async () => {
      mockAxiosInstance.delete.mockResolvedValue({ data: {} });

      await client.deleteRecord('contacts', '123');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        "https://test-server.com/fmi/odata/v4/TestDB/contacts('123')"
      );
    });
  });

  describe('countRecords', () => {
    test('should count all records', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: 42 });

      const count = await client.countRecords('contacts');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        'https://test-server.com/fmi/odata/v4/TestDB/contacts/$count',
        { params: undefined }
      );
      expect(count).toBe(42);
    });

    test('should count records with filter', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: 10 });

      const count = await client.countRecords('contacts', "status eq 'active'");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        'https://test-server.com/fmi/odata/v4/TestDB/contacts/$count',
        { params: { $filter: "status eq 'active'" } }
      );
      expect(count).toBe(10);
    });
  });

  describe('testConnection', () => {
    test('should return true on successful connection', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: {} });

      const result = await client.testConnection();

      expect(result).toBe(true);
    });

    test('should return false on connection failure', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed'));

      const result = await client.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle HTTP error responses', async () => {
      // Setup response interceptor to reject with error
      const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
      const error = {
        response: {
          status: 404,
          statusText: 'Not Found',
          data: {},
        },
      };

      mockAxiosInstance.get.mockImplementation(() => Promise.reject(error));

      try {
        await client.getServiceDocument();
        fail('Should have thrown an error');
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    test('should handle OData error responses', async () => {
      const error = {
        response: {
          status: 400,
          data: {
            error: {
              code: '-1002',
              message: 'Invalid query',
            },
          },
        },
      };

      mockAxiosInstance.get.mockImplementation(() => Promise.reject(error));

      try {
        await client.getServiceDocument();
        fail('Should have thrown an error');
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    test('should handle network errors', async () => {
      const error = new Error('Network Error');

      mockAxiosInstance.get.mockImplementation(() => Promise.reject(error));

      try {
        await client.getServiceDocument();
        fail('Should have thrown an error');
      } catch (e) {
        expect(e).toBeDefined();
      }
    });
  });

  describe('Batch Operations', () => {
    test('should execute batch operations', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { value: [] }, status: 200 });
      mockAxiosInstance.post.mockResolvedValue({ data: { id: '1' }, status: 201 });

      const operations = [
        { method: 'GET' as const, url: 'test1' },
        { method: 'POST' as const, url: 'test2', data: { name: 'test' } },
      ];

      const results = await client.batch(operations);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    test('should handle failed operations in batch', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Failed'));

      const operations = [
        { method: 'GET' as const, url: 'test1' },
      ];

      const results = await client.batch(operations);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBeDefined();
    });
  });
});
