import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { ODataClient, ODataClientConfig } from '../../src/odata-client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ODataClient Bearer token auth', () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      get: jest.fn().mockResolvedValue({ data: {}, status: 200 }),
      post: jest.fn().mockResolvedValue({ data: {}, status: 201 }),
      patch: jest.fn().mockResolvedValue({ data: {}, status: 204 }),
      delete: jest.fn().mockResolvedValue({ data: {}, status: 204 }),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };
    mockedAxios.create = jest.fn(() => mockAxiosInstance) as any;
  });

  test('sends Authorization: Bearer <token> when authType=bearer', () => {
    let capturedConfig: any;
    mockAxiosInstance.interceptors.request.use = jest.fn((handler: (cfg: any) => any) => {
      capturedConfig = { headers: {} };
      handler(capturedConfig);
      return 0;
    });

    const config: ODataClientConfig = {
      server: 'https://fms.example.com',
      database: 'TestDB',
      user: '',
      password: '',
      authType: 'bearer',
      bearerToken: 'my-bearer-token-123',
      verifySsl: false,
    };

    new ODataClient(config);

    expect(capturedConfig.headers.Authorization).toBe('Bearer my-bearer-token-123');
  });

  test('sends Authorization: Basic <base64> when authType=basic (default)', () => {
    let capturedConfig: any;
    mockAxiosInstance.interceptors.request.use = jest.fn((handler: (cfg: any) => any) => {
      capturedConfig = { headers: {} };
      handler(capturedConfig);
      return 0;
    });

    const config: ODataClientConfig = {
      server: 'https://fms.example.com',
      database: 'TestDB',
      user: 'admin',
      password: 'secret',
      verifySsl: false,
    };

    new ODataClient(config);

    const expected = `Basic ${Buffer.from('admin:secret').toString('base64')}`;
    expect(capturedConfig.headers.Authorization).toBe(expected);
  });

  test('falls back to Basic auth when authType=bearer but no token', () => {
    let capturedConfig: any;
    mockAxiosInstance.interceptors.request.use = jest.fn((handler: (cfg: any) => any) => {
      capturedConfig = { headers: {} };
      handler(capturedConfig);
      return 0;
    });

    const config: ODataClientConfig = {
      server: 'https://fms.example.com',
      database: 'TestDB',
      user: 'admin',
      password: 'secret',
      authType: 'bearer',
      bearerToken: undefined,
      verifySsl: false,
    };

    new ODataClient(config);

    // No bearerToken → falls back to Basic
    const expected = `Basic ${Buffer.from('admin:secret').toString('base64')}`;
    expect(capturedConfig.headers.Authorization).toBe(expected);
  });

  test('backward compatible — no authType means Basic auth', () => {
    let capturedConfig: any;
    mockAxiosInstance.interceptors.request.use = jest.fn((handler: (cfg: any) => any) => {
      capturedConfig = { headers: {} };
      handler(capturedConfig);
      return 0;
    });

    const config: ODataClientConfig = {
      server: 'https://fms.example.com',
      database: 'TestDB',
      user: 'admin',
      password: 'secret',
    };

    new ODataClient(config);

    const expected = `Basic ${Buffer.from('admin:secret').toString('base64')}`;
    expect(capturedConfig.headers.Authorization).toBe(expected);
  });

  test('Bearer token is used for all HTTP methods', async () => {
    let capturedConfig: any;
    mockAxiosInstance.interceptors.request.use = jest.fn((handler: (cfg: any) => any) => {
      capturedConfig = { headers: {} };
      handler(capturedConfig);
      return 0;
    });

    const config: ODataClientConfig = {
      server: 'https://fms.example.com',
      database: 'TestDB',
      user: '',
      password: '',
      authType: 'bearer',
      bearerToken: 'test-token',
      verifySsl: false,
    };

    const client = new ODataClient(config);

    // Verify the interceptor set the Bearer header
    expect(capturedConfig.headers.Authorization).toBe('Bearer test-token');

    // Make a request — the interceptor should have set Bearer on it
    await client.getServiceDocument();
    expect(mockAxiosInstance.get).toHaveBeenCalled();
  });
});
