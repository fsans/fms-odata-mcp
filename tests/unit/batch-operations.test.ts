import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { ODataClient, ODataClientConfig } from '../../src/odata-client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ODataClient batch operations', () => {
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

  describe('batchCreateRecords — parallel strategy', () => {
    test('all records succeed — summary shows 3/3', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { RecordId: 1 }, status: 201 });

      const result = await client.batchCreateRecords('contact', [
        { Name: 'Alice' },
        { Name: 'Bob' },
        { Name: 'Charlie' },
      ], 'parallel');

      expect(result.summary.total).toBe(3);
      expect(result.summary.succeeded).toBe(3);
      expect(result.summary.failed).toBe(0);
      expect(result.summary.strategy).toBe('parallel');
      expect(result.summary.atomic).toBe(false);
      expect(result.results.every((r: any) => r.ok)).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
    });

    test('partial failure — per-record error isolation', async () => {
      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { RecordId: 1 }, status: 201 })
        .mockRejectedValueOnce(new Error('Validation failed'))
        .mockResolvedValueOnce({ data: { RecordId: 3 }, status: 201 });

      const result = await client.batchCreateRecords('contact', [
        { Name: 'Alice' },
        { Name: '' },
        { Name: 'Charlie' },
      ], 'parallel');

      expect(result.summary.succeeded).toBe(2);
      expect(result.summary.failed).toBe(1);
      expect(result.results[0].ok).toBe(true);
      expect(result.results[1].ok).toBe(false);
      expect(result.results[1].error).toContain('Validation failed');
      expect(result.results[2].ok).toBe(true);
    });

    test('all fail — all results have ok=false', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Server down'));

      const result = await client.batchCreateRecords('contact', [
        { Name: 'A' },
        { Name: 'B' },
      ], 'parallel');

      expect(result.summary.succeeded).toBe(0);
      expect(result.summary.failed).toBe(2);
      expect(result.results.every((r: any) => !r.ok)).toBe(true);
    });
  });

  describe('batchUpdateRecords — parallel strategy', () => {
    test('all updates succeed', async () => {
      mockAxiosInstance.patch.mockResolvedValue({ status: 204 });

      const result = await client.batchUpdateRecords('contact', [
        { recordId: '1', data: { Name: 'Updated1' } },
        { recordId: '2', data: { Name: 'Updated2' } },
      ], 'parallel');

      expect(result.summary.succeeded).toBe(2);
      expect(result.summary.failed).toBe(0);
      expect(mockAxiosInstance.patch).toHaveBeenCalledTimes(2);
    });

    test('partial failure', async () => {
      mockAxiosInstance.patch
        .mockResolvedValueOnce({ status: 204 })
        .mockRejectedValueOnce(new Error('Record not found'));

      const result = await client.batchUpdateRecords('contact', [
        { recordId: '1', data: { Name: 'A' } },
        { recordId: '999', data: { Name: 'B' } },
      ], 'parallel');

      expect(result.summary.succeeded).toBe(1);
      expect(result.summary.failed).toBe(1);
      expect(result.results[1].error).toContain('Record not found');
    });
  });

  describe('batchDeleteRecords — parallel strategy', () => {
    test('all deletes succeed', async () => {
      mockAxiosInstance.delete.mockResolvedValue({ status: 204 });

      const result = await client.batchDeleteRecords('contact', ['1', '2', '3'], 'parallel');

      expect(result.summary.succeeded).toBe(3);
      expect(result.summary.failed).toBe(0);
      expect(mockAxiosInstance.delete).toHaveBeenCalledTimes(3);
    });

    test('partial failure', async () => {
      mockAxiosInstance.delete
        .mockResolvedValueOnce({ status: 204 })
        .mockRejectedValueOnce(new Error('Record not found'))
        .mockResolvedValueOnce({ status: 204 });

      const result = await client.batchDeleteRecords('contact', ['1', '999', '3'], 'parallel');

      expect(result.summary.succeeded).toBe(2);
      expect(result.summary.failed).toBe(1);
      expect(result.results[1].ok).toBe(false);
    });
  });

  describe('batchCreateRecords — batch strategy (OData $batch)', () => {
    test('sends multipart/mixed to $batch endpoint', async () => {
      // Simulate a successful batch response with proper MIME boundaries.
      // FileMaker returns 204 No Content for POST in $batch (no body).
      const batchResponse = [
        '--batchresponse_123',
        'Content-Type: multipart/mixed; boundary=cs_123',
        '',
        '--cs_123',
        'Content-Type: application/http',
        '',
        'HTTP/1.1 204 No Content',
        'Content-Type: application/json;charset=utf-8',
        'Preference-Applied: return=minimal',
        '',
        '',
        '--cs_123',
        'Content-Type: application/http',
        '',
        'HTTP/1.1 204 No Content',
        'Content-Type: application/json;charset=utf-8',
        'Preference-Applied: return=minimal',
        '',
        '',
        '--cs_123--',
        '--batchresponse_123--',
      ].join('\r\n');
      mockAxiosInstance.post.mockResolvedValue({ data: batchResponse, status: 200 });

      const result = await client.batchCreateRecords('contact', [
        { Name: 'Alice' },
        { Name: 'Bob' },
      ], 'batch');

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
      const callArgs = mockAxiosInstance.post.mock.calls[0];
      expect(callArgs[0]).toContain('/$batch');
      const config = callArgs[2];
      expect(config.headers['Content-Type']).toContain('multipart/mixed');
      expect(config.headers['Content-Type']).toContain('boundary=');
      expect(result.summary.strategy).toBe('batch');
      expect(result.summary.atomic).toBe(true);
      expect(result.summary.succeeded).toBe(2);
      // $batch creates return no data (204 No Content)
      expect(result.results[0].ok).toBe(true);
      expect(result.results[0].data).toBeUndefined();
    });

    test('falls back to parallel when $batch fails', async () => {
      // First call ($batch) fails, subsequent calls (individual POSTs) succeed
      mockAxiosInstance.post
        .mockRejectedValueOnce(new Error('500 Internal Server Error'))
        .mockResolvedValue({ data: { RecordId: 1 }, status: 201 });

      const result = await client.batchCreateRecords('contact', [
        { Name: 'Alice' },
        { Name: 'Bob' },
      ], 'batch');

      // Should have fallen back to parallel (2 individual POSTs + 1 failed $batch)
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
      expect(result.summary.strategy).toBe('parallel');
      expect(result.summary.succeeded).toBe(2);
    });
  });

  describe('batchUpdateRecords — batch strategy', () => {
    test('sends PATCH operations in $batch', async () => {
      const batchResponse = [
        '--batchresponse_123',
        'Content-Type: application/http',
        'Content-Transfer-Encoding: binary',
        '',
        'HTTP/1.1 204 No Content',
        'Content-Type: application/json',
        '',
        '',
        '--batchresponse_123',
        'Content-Type: application/http',
        'Content-Transfer-Encoding: binary',
        '',
        'HTTP/1.1 204 No Content',
        'Content-Type: application/json',
        '',
        '',
        '--batchresponse_123--',
      ].join('\r\n');
      mockAxiosInstance.post.mockResolvedValue({ data: batchResponse, status: 200 });

      const result = await client.batchUpdateRecords('contact', [
        { recordId: '1', data: { Name: 'Updated1' } },
        { recordId: '2', data: { Name: 'Updated2' } },
      ], 'batch');

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
      expect(result.summary.strategy).toBe('batch');
      expect(result.summary.succeeded).toBe(2);
    });
  });

  describe('batchDeleteRecords — batch strategy', () => {
    test('sends DELETE operations in $batch', async () => {
      const batchResponse = [
        '--batchresponse_123',
        'Content-Type: application/http',
        'Content-Transfer-Encoding: binary',
        '',
        'HTTP/1.1 204 No Content',
        'Content-Type: application/json',
        '',
        '',
        '--batchresponse_123',
        'Content-Type: application/http',
        'Content-Transfer-Encoding: binary',
        '',
        'HTTP/1.1 204 No Content',
        'Content-Type: application/json',
        '',
        '',
        '--batchresponse_123--',
      ].join('\r\n');
      mockAxiosInstance.post.mockResolvedValue({ data: batchResponse, status: 200 });

      const result = await client.batchDeleteRecords('contact', ['1', '2'], 'batch');

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
      expect(result.summary.strategy).toBe('batch');
      expect(result.summary.succeeded).toBe(2);
    });
  });
});
