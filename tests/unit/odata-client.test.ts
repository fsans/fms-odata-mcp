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
          use: jest.fn((successHandler: (cfg: any) => any) => {
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
      const createCall = (mockedAxios.create as jest.Mock).mock.calls[0][0] as any;
      expect(createCall.httpsAgent).toBeDefined();
    });

    test('should default verifySsl to true', () => {
      const configWithoutVerifySsl = {
        ...testConfig,
        verifySsl: undefined,
      };
      
      new ODataClient(configWithoutVerifySsl);
      
      const createCall = (mockedAxios.create as jest.Mock).mock.calls[1][0] as any;
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
    test('should get single record by numeric ID (unquoted key — FileMaker compat)', async () => {
      const mockRecord = { id: '123', name: 'John' };
      mockAxiosInstance.get.mockResolvedValue({ data: mockRecord });

      const result = await client.getRecord('contacts', '123');

      // FileMaker entity keys are numeric; quoted form fails with error 8309.
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        'https://test-server.com/fmi/odata/v4/TestDB/contacts(123)'
      );
      expect(result).toEqual(mockRecord);
    });

    test('should get single record by string ID (quoted key, apostrophes escaped)', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: {} });

      await client.getRecord('contacts', "abc'xyz");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "https://test-server.com/fmi/odata/v4/TestDB/contacts('abc''xyz')"
      );
    });

    test('should get record with select option', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: {} });

      await client.getRecord('contacts', '123', {
        select: 'id,name',
      });

      const url = mockAxiosInstance.get.mock.calls[0][0];
      // $select must be literal (not %24select) and commas literal (not %2C).
      expect(url).toContain('$select=id,name');
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
    test('should update existing record (numeric key unquoted)', async () => {
      const updates = { name: 'John Updated' };

      mockAxiosInstance.patch.mockResolvedValue({ data: {} });

      await client.updateRecord('contacts', '123', updates);

      expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
        'https://test-server.com/fmi/odata/v4/TestDB/contacts(123)',
        updates
      );
    });

    test('should update record with string key (quoted, escaped)', async () => {
      mockAxiosInstance.patch.mockResolvedValue({ data: {} });

      await client.updateRecord('contacts', "user'a", { name: 'x' });

      expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
        "https://test-server.com/fmi/odata/v4/TestDB/contacts('user''a')",
        { name: 'x' }
      );
    });
  });

  describe('deleteRecord', () => {
    test('should delete record (numeric key unquoted)', async () => {
      mockAxiosInstance.delete.mockResolvedValue({ data: {} });

      await client.deleteRecord('contacts', '123');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        'https://test-server.com/fmi/odata/v4/TestDB/contacts(123)'
      );
    });
  });

  describe('countRecords', () => {
    test('should count all records', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: 42 });

      const count = await client.countRecords('contacts');

      // No `{ params }` arg — URL alone, since axios's URLSearchParams encodes
      // `$` as `%24` which FileMaker doesn't recognize.
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        'https://test-server.com/fmi/odata/v4/TestDB/contacts/$count'
      );
      expect(count).toBe(42);
    });

    test('should count records with filter (literal $, space as %20)', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: 10 });

      const count = await client.countRecords('contacts', "status eq 'active'");

      // $filter literal (not %24filter), space as %20 (not +), commas literal.
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "https://test-server.com/fmi/odata/v4/TestDB/contacts/$count?$filter=status%20eq%20'active'"
      );
      expect(count).toBe(10);
    });
  });

  describe('URL encoding (FileMaker OData compatibility)', () => {
    test('buildUrl: $filter with spaces uses %20 (not +)', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { value: [] } });
      await client.queryRecords('contacts', { filter: "name eq 'Anne Marie'" });
      const url = mockAxiosInstance.get.mock.calls[0][0];
      expect(url).toContain("$filter=name%20eq%20'Anne%20Marie'");
      expect(url).not.toMatch(/\+/);
      expect(url).not.toContain('%24');
    });

    test('buildUrl: $select keeps commas literal', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { value: [] } });
      await client.queryRecords('contacts', { select: 'id,name,email' });
      const url = mockAxiosInstance.get.mock.calls[0][0];
      expect(url).toContain('$select=id,name,email');
      expect(url).not.toContain('%2C');
    });

    test('buildUrl: combined filter+select+orderby+top+skip+count', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { value: [] } });
      await client.queryRecords('contacts', {
        filter: "active eq true",
        select: 'id,name',
        orderby: 'name asc',
        top: 5,
        skip: 10,
        count: true,
      });
      const url = mockAxiosInstance.get.mock.calls[0][0];
      expect(url).toContain('$filter=active%20eq%20true');
      expect(url).toContain('$select=id,name');
      expect(url).toContain('$orderby=name%20asc');
      expect(url).toContain('$top=5');
      expect(url).toContain('$skip=10');
      expect(url).toContain('$count=true');
    });
  });

  describe('Non-ASCII identifier quoting (normalizeFilter)', () => {
    test('Chinese field name gets auto-quoted in $filter', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { value: [] } });
      await client.queryRecords('orders', { filter: "位置 eq '主线'" });
      const url = mockAxiosInstance.get.mock.calls[0][0];
      // The field name 位置 should be wrapped in double-quotes
      // After encodeURIComponent: %22%E4%BD%8D%E7%BD%AE%22 (quoted) vs %E4%BD%8D%E7%BD%AE (unquoted)
      const decoded = decodeURIComponent(url.split('$filter=')[1]);
      expect(decoded).toBe("\"位置\" eq '主线'");
    });

    test('already double-quoted non-ASCII field name is not double-quoted again', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { value: [] } });
      await client.queryRecords('orders', { filter: "\"位置\" eq '主线'" });
      const url = mockAxiosInstance.get.mock.calls[0][0];
      const decoded = decodeURIComponent(url.split('$filter=')[1]);
      expect(decoded).toBe("\"位置\" eq '主线'");
    });

    test('ASCII-only field names without spaces remain unchanged', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { value: [] } });
      await client.queryRecords('contacts', { filter: "FirstName eq 'John'" });
      const url = mockAxiosInstance.get.mock.calls[0][0];
      const decoded = decodeURIComponent(url.split('$filter=')[1]);
      expect(decoded).toBe("FirstName eq 'John'");
    });

    test('string literal values containing non-ASCII are NOT quoted', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { value: [] } });
      await client.queryRecords('orders', { filter: "\"位置\" eq '主线'" });
      const url = mockAxiosInstance.get.mock.calls[0][0];
      const decoded = decodeURIComponent(url.split('$filter=')[1]);
      // '主线' should stay as a string literal, not get double-quoted
      expect(decoded).toContain("'主线'");
      expect(decoded).not.toContain("\"主线\"");
    });

    test('mixed ASCII and non-ASCII fields in compound filter', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { value: [] } });
      await client.queryRecords('orders', {
        filter: "Status eq 'Active' and 位置 eq '主线' and 数量 gt 10",
      });
      const url = mockAxiosInstance.get.mock.calls[0][0];
      const decoded = decodeURIComponent(url.split('$filter=')[1]);
      expect(decoded).toBe("Status eq 'Active' and \"位置\" eq '主线' and \"数量\" gt 10");
    });

    test('non-ASCII field name in countRecords is auto-quoted', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: 4632 });
      await client.countRecords('orders', "位置 eq '主线'");
      const url = mockAxiosInstance.get.mock.calls[0][0];
      const decoded = decodeURIComponent(url.split('$filter=')[1]);
      expect(decoded).toBe("\"位置\" eq '主线'");
    });

    test('Japanese field names get auto-quoted', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { value: [] } });
      await client.queryRecords('products', { filter: "製品名 eq '東京タワー'" });
      const url = mockAxiosInstance.get.mock.calls[0][0];
      const decoded = decodeURIComponent(url.split('$filter=')[1]);
      expect(decoded).toBe("\"製品名\" eq '東京タワー'");
    });

    test('field names with accented characters get auto-quoted', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { value: [] } });
      await client.queryRecords('contacts', { filter: "prénom eq 'André'" });
      const url = mockAxiosInstance.get.mock.calls[0][0];
      const decoded = decodeURIComponent(url.split('$filter=')[1]);
      expect(decoded).toBe("\"prénom\" eq 'André'");
    });

    test('non-ASCII field with cast path (slash) is quoted correctly', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { value: [] } });
      // Field/Edm.Type cast path — the field part contains non-ASCII
      await client.queryRecords('orders', { filter: "\"位置\"/Edm.String eq '主线'" });
      const url = mockAxiosInstance.get.mock.calls[0][0];
      const decoded = decodeURIComponent(url.split('$filter=')[1]);
      // Already-quoted identifier with cast path should pass through
      expect(decoded).toBe("\"位置\"/Edm.String eq '主线'");
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

  describe('runScript', () => {
    test('should run script by name without parameter', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { scriptResult: { code: 0, resultParameter: 'Done' } },
      });

      const result = await client.runScript('HelloScript');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://test-server.com/fmi/odata/v4/TestDB/Script.HelloScript',
        undefined
      );
      expect(result.code).toBe(0);
      expect(result.resultParameter).toBe('Done');
    });

    test('should run script by name with string parameter', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { scriptResult: { code: 0, resultParameter: 'Hello World' } },
      });

      const result = await client.runScript('HelloScript', 'World');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://test-server.com/fmi/odata/v4/TestDB/Script.HelloScript',
        { scriptParameterValue: 'World' }
      );
      expect(result.code).toBe(0);
      expect(result.resultParameter).toBe('Hello World');
    });

    test('should run script by name with JSON object parameter', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { scriptResult: { code: 0, resultParameter: null } },
      });

      const param = { ids: [1, 2, 3], mode: 'fast' };
      await client.runScript('ProcessData', param);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://test-server.com/fmi/odata/v4/TestDB/Script.ProcessData',
        { scriptParameterValue: param }
      );
    });

    test('should handle script error (non-zero code)', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { scriptResult: { code: 3, resultParameter: null } },
      });

      const result = await client.runScript('BadScript');

      expect(result.code).toBe(3);
      expect(result.resultParameter).toBeNull();
    });

    test('should throw on invalid response format', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { unexpected: 'shape' },
      });

      await expect(client.runScript('BadScript')).rejects.toThrow('Invalid script response format');
    });
  });

  describe('runScriptById', () => {
    test('should run script by internal FMSID without parameter', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { scriptResult: { code: 0, resultParameter: 'Done' } },
      });

      const result = await client.runScriptById(72);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://test-server.com/fmi/odata/v4/TestDB/Script.FMSID:72',
        undefined
      );
      expect(result.code).toBe(0);
      expect(result.resultParameter).toBe('Done');
    });

    test('should run script by string FMSID with parameter', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { scriptResult: { code: 0, resultParameter: 'Hello 42' } },
      });

      const result = await client.runScriptById('72', 42);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://test-server.com/fmi/odata/v4/TestDB/Script.FMSID:72',
        { scriptParameterValue: 42 }
      );
      expect(result.code).toBe(0);
      expect(result.resultParameter).toBe('Hello 42');
    });

    test('should handle script error by ID', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { scriptResult: { code: 401, resultParameter: 'Privilege failure' } },
      });

      const result = await client.runScriptById(5);

      expect(result.code).toBe(401);
      expect(result.resultParameter).toBe('Privilege failure');
    });
  });

  describe('normalizeFilter with v26 FMFID resolution', () => {
    const v26Metadata = `<?xml version="1.0"?>
<edmx:Edmx>
  <Annotation Term="Org.OData.Core.V1.ProductVersion" String="26.0.1" />
  <Schema>
    <EntityType Name="contacts">
      <Property Name="位置" Type="Edm.String">
        <Annotation Term="com.filemaker.odata.FieldID" String="FMFID:12345" />
      </Property>
      <Property Name="Name" Type="Edm.String" />
    </EntityType>
  </Schema>
</edmx:Edmx>`;

    test('should substitute non-ASCII field name with FMFID on v26+', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: v26Metadata });
      await client.getServerVersion(); // populates version + metadata + fieldIdMap

      mockAxiosInstance.get.mockResolvedValue({ data: { value: [] } });
      await client.queryRecords('contacts', { filter: "位置 eq 'Tokyo'" });

      const url = mockAxiosInstance.get.mock.calls[mockAxiosInstance.get.mock.calls.length - 1][0];
      expect(url).toContain('FMFID');
      expect(url).not.toContain('%E4%BD%8D%E7%BD%AE'); // should NOT contain encoded '位置'
    });

    test('should fall back to auto-quoting when FMFID not found on v26+', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: v26Metadata });
      await client.getServerVersion();

      mockAxiosInstance.get.mockResolvedValue({ data: { value: [] } });
      await client.queryRecords('contacts', { filter: "未知 eq 'X'" });

      const url = mockAxiosInstance.get.mock.calls[mockAxiosInstance.get.mock.calls.length - 1][0];
      expect(url).toContain('%22'); // should contain double-quotes (auto-quoted)
    });

    test('should auto-quote on v25 (no FMFID resolution)', async () => {
      const v25Metadata = `<?xml version="1.0"?>
<edmx:Edmx>
  <Annotation Term="Org.OData.Core.V1.ProductVersion" String="25.0.0" />
</edmx:Edmx>`;
      mockAxiosInstance.get.mockResolvedValue({ data: v25Metadata });
      await client.getServerVersion();

      mockAxiosInstance.get.mockResolvedValue({ data: { value: [] } });
      await client.queryRecords('contacts', { filter: "位置 eq 'Tokyo'" });

      const url = mockAxiosInstance.get.mock.calls[mockAxiosInstance.get.mock.calls.length - 1][0];
      expect(url).toContain('%22'); // auto-quoted
      expect(url).not.toContain('FMFID');
    });
  });
});
