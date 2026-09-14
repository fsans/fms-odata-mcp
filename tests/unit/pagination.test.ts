import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { ODataClient, ODataClientConfig } from '../../src/odata-client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ODataClient queryAllRecords', () => {
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
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: { use: jest.fn((handler: (cfg: any) => any) => { handler({ headers: {} }); return 0; }) },
        response: { use: jest.fn() },
      },
    };
    mockedAxios.create = jest.fn(() => mockAxiosInstance) as any;
    client = new ODataClient(testConfig);
  });

  test('single page — no @odata.nextLink, no fallback needed', async () => {
    mockAxiosInstance.get.mockResolvedValue({
      data: {
        value: [{ id: 1 }, { id: 2 }],
        "@odata.context": "ctx",
      },
      status: 200,
    });

    const result = await client.queryAllRecords('contact', {}, 100, 10000);

    expect(result.records).toHaveLength(2);
    expect(result.summary.totalRecords).toBe(2);
    expect(result.summary.pagesFetched).toBe(1);
    expect(result.summary.truncated).toBe(false);
    expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
  });

  test('follows @odata.nextLink across multiple pages', async () => {
    // Page 1: 2 records + nextLink
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        value: [{ id: 1 }, { id: 2 }],
        "@odata.nextLink": "https://test-server.com/fmi/odata/v4/TestDB/contact?$skiptoken=2",
      },
    });
    // Page 2: 2 records + nextLink
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        value: [{ id: 3 }, { id: 4 }],
        "@odata.nextLink": "https://test-server.com/fmi/odata/v4/TestDB/contact?$skiptoken=4",
      },
    });
    // Page 3: 1 record, no nextLink (last page)
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        value: [{ id: 5 }],
      },
    });

    const result = await client.queryAllRecords('contact', {}, 2, 10000);

    expect(result.records).toHaveLength(5);
    expect(result.summary.totalRecords).toBe(5);
    expect(result.summary.pagesFetched).toBe(3);
    expect(result.summary.truncated).toBe(false);
    expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
  });

  test('truncates at maxRecords', async () => {
    // 3 pages of 2 records each, maxRecords=3
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        value: [{ id: 1 }, { id: 2 }],
        "@odata.nextLink": "https://test-server.com/next",
      },
    });
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        value: [{ id: 3 }, { id: 4 }],
        "@odata.nextLink": "https://test-server.com/next2",
      },
    });

    const result = await client.queryAllRecords('contact', {}, 2, 3);

    expect(result.records).toHaveLength(3);
    expect(result.summary.totalRecords).toBe(3);
    expect(result.summary.truncated).toBe(true);
  });

  test('falls back to $skip when no @odata.nextLink and first page is full', async () => {
    // Page 1: 2 records (full page), no nextLink
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        value: [{ id: 1 }, { id: 2 }],
      },
    });
    // Page 2 via $skip: 2 records (full page), no nextLink
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        value: [{ id: 3 }, { id: 4 }],
      },
    });
    // Page 3 via $skip: 1 record (partial page = last)
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        value: [{ id: 5 }],
      },
    });

    const result = await client.queryAllRecords('contact', {}, 2, 10000);

    expect(result.records).toHaveLength(5);
    expect(result.summary.pagesFetched).toBe(3);
    expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
    // Verify $skip was used in the URL (2nd and 3rd calls)
    const secondCallUrl = mockAxiosInstance.get.mock.calls[1][0];
    expect(secondCallUrl).toContain('$skip=2');
    const thirdCallUrl = mockAxiosInstance.get.mock.calls[2][0];
    expect(thirdCallUrl).toContain('$skip=4');
  });

  test('does not fall back to $skip when first page is partial', async () => {
    // Page 1: 1 record (partial page = last), no nextLink
    mockAxiosInstance.get.mockResolvedValue({
      data: {
        value: [{ id: 1 }],
      },
    });

    const result = await client.queryAllRecords('contact', {}, 2, 10000);

    expect(result.records).toHaveLength(1);
    expect(result.summary.pagesFetched).toBe(1);
    expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
  });

  test('hard cap at 50000 regardless of maxRecords param', async () => {
    // Simulate many pages — just check the cap logic
    // We can't easily simulate 50k records, but we can verify the cap
    // by passing maxRecords=100000 and checking the effective max in summary
    mockAxiosInstance.get.mockResolvedValue({
      data: {
        value: [{ id: 1 }],
      },
    });

    const result = await client.queryAllRecords('contact', {}, 1, 100000);

    // effectiveMax should be min(100000, 50000) = 50000
    expect(result.summary.maxRecords).toBe(50000);
  });

  test('handles relative @odata.nextLink by prepending server URL', async () => {
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        value: [{ id: 1 }],
        "@odata.nextLink": "/fmi/odata/v4/TestDB/contact?$skiptoken=1",
      },
    });
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        value: [{ id: 2 }],
      },
    });

    await client.queryAllRecords('contact', {}, 1, 10000);

    const secondCallUrl = mockAxiosInstance.get.mock.calls[1][0];
    expect(secondCallUrl).toBe('https://test-server.com/fmi/odata/v4/TestDB/contact?$skiptoken=1');
  });

  test('sends Prefer: odata.maxpagesize header', async () => {
    mockAxiosInstance.get.mockResolvedValue({
      data: { value: [{ id: 1 }] },
    });

    await client.queryAllRecords('contact', {}, 100, 10000);

    const callConfig = mockAxiosInstance.get.mock.calls[0][1];
    expect(callConfig.headers.Prefer).toBe('odata.maxpagesize=100');
  });

  test('stops when @odata.nextLink is absent after a full page', async () => {
    // Page 1: full page (2 records) + nextLink
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        value: [{ id: 1 }, { id: 2 }],
        "@odata.nextLink": "https://test-server.com/next",
      },
    });
    // Page 2: full page (2 records), no nextLink — should stop
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        value: [{ id: 3 }, { id: 4 }],
      },
    });

    const result = await client.queryAllRecords('contact', {}, 2, 10000);

    // Should NOT fall back to $skip because we followed nextLink successfully
    // and the last page had no nextLink (natural end)
    expect(result.records).toHaveLength(4);
    expect(result.summary.pagesFetched).toBe(2);
    expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
  });
});
