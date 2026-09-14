import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { ODataClient, ODataClientConfig } from '../../src/odata-client';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OData URL building', () => {
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
    mockAxiosInstance = {
      get: jest.fn().mockResolvedValue({ data: {}, status: 200 }),
      post: jest.fn().mockResolvedValue({ data: {}, status: 201 }),
      patch: jest.fn().mockResolvedValue({ data: {}, status: 204 }),
      delete: jest.fn().mockResolvedValue({ data: {}, status: 204 }),
      interceptors: {
        request: { use: jest.fn((handler: (cfg: any) => any) => { handler({ headers: {} }); return 0; }) },
        response: { use: jest.fn() },
      },
    };
    mockedAxios.create = jest.fn(() => mockAxiosInstance) as any;
    client = new ODataClient(testConfig);
  });

  // Helper: extract the URL from the first axios.get call
  function getUrl(): string {
    return mockAxiosInstance.get.mock.calls[0][0] as string;
  }

  describe('entityKey', () => {
    test('numeric ID is unquoted', async () => {
      await client.getRecord('contact', '42');
      expect(getUrl()).toContain("contact(42)");
    });

    test('string ID is single-quoted', async () => {
      await client.getRecord('contact', 'ABC-123');
      expect(getUrl()).toContain("contact('ABC-123')");
    });

    test('apostrophe in string ID is doubled', async () => {
      await client.getRecord('contact', "O'Brien");
      expect(getUrl()).toContain("contact('O''Brien')");
    });

    test('negative numeric ID is unquoted', async () => {
      await client.getRecord('contact', '-5');
      expect(getUrl()).toContain("contact(-5)");
    });
  });

  describe('odataEncode', () => {
    test('spaces encoded as %20 not +', async () => {
      await client.queryRecords('contact', { filter: "Name eq 'John Doe'" });
      const url = getUrl();
      expect(url).toContain('%20');
      expect(url).not.toContain('+');
    });

    test('literal $ prefix on system options', async () => {
      await client.queryRecords('contact', { filter: "x eq 1" });
      const url = getUrl();
      expect(url).toContain('$filter');
      expect(url).not.toContain('%24filter');
    });

    test('literal commas in $select', async () => {
      await client.queryRecords('contact', { select: 'A,B,C' });
      const url = getUrl();
      expect(url).toContain('A,B,C');
      expect(url).not.toContain('%2C');
    });
  });

  describe('buildUrl', () => {
    test('all query options in correct order', async () => {
      await client.queryRecords('contact', {
        filter: 'Age gt 18',
        select: 'Name,Email',
        orderby: 'Name asc',
        top: 10,
        skip: 20,
        expand: 'Address',
        count: true,
      });
      const url = getUrl();
      // $filter first, then $select, $orderby, $top, $skip, $expand, $count
      expect(url).toContain('$filter=');
      expect(url).toContain('$select=');
      expect(url).toContain('$orderby=');
      expect(url).toContain('$top=10');
      expect(url).toContain('$skip=20');
      expect(url).toContain('$expand=');
      expect(url).toContain('$count=true');
      // Verify order: $filter before $select before $orderby
      const filterIdx = url.indexOf('$filter');
      const selectIdx = url.indexOf('$select');
      const orderbyIdx = url.indexOf('$orderby');
      expect(filterIdx).toBeLessThan(selectIdx);
      expect(selectIdx).toBeLessThan(orderbyIdx);
    });

    test('$apply option', async () => {
      await client.aggregateRecords('contact', 'aggregate($count as Total)');
      const url = getUrl();
      expect(url).toContain('$apply=aggregate');
    });

    test('no options produces bare URL without query string', async () => {
      await client.queryRecords('contact');
      const url = getUrl();
      expect(url).not.toContain('?');
      expect(url).toMatch(/contact$/);
    });
  });
});
