import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';

// Mock axios for ODataClient-level tests (same pattern as odata-client.test.ts)
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock connection.js + odata-parser.js for tool-handler tests — ESM mocks
// require the consuming modules to be imported dynamically (below).
jest.unstable_mockModule('../../src/connection.js', () => ({
  ConnectionManager: jest.fn(() => ({})),
  connectionManager: {
    getCurrentClient: jest.fn(),
    getClientByName: jest.fn(),
  },
}));

jest.unstable_mockModule('../../src/odata-parser.js', () => ({
  ODataParser: {
    formatError: jest.fn((error: unknown) =>
      error instanceof Error ? error.message : String(error)
    ),
  },
}));

// Mock config.js — the tools/index.js import graph pulls it in via
// configuration.js and logger.js. Providing a full stub keeps the module
// graph consistent with multi-session-handlers.test.ts.
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

const {
  ODataClient,
  SUPPORTED_CONTAINER_TYPES,
  normalizeAndValidateBase64,
  detectContainerMimeFromBytes,
  formatContentDisposition,
  parseContentDispositionFilename,
} = await import('../../src/odata-client.js');
// NOTE: tools/odata.js must be imported BEFORE tools/index.js. Jest's
// unstable_mockModule registry is not concurrency-safe — when tools/index.js
// fans out its link phase, odata.ts/connection.ts/schema.ts resolve
// ../connection.js concurrently and each importMock call creates a separate
// synthetic module instance, so the test's connectionManager differs from the
// one bound inside odata.ts. Importing odata.js first registers a single
// synthetic that every later importer reuses.
const { handleODataTool } = await import('../../src/tools/odata.js');
const { handleToolCall } = await import('../../src/tools/index.js');
const { connectionManager } = await import('../../src/connection.js');

// 1x1 transparent PNG (67 bytes, padded canonical base64)
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_BYTES = Buffer.from(PNG_B64, 'base64');
// 1x1 GIF89a
const GIF_B64 = 'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const GIF_BYTES = Buffer.from(GIF_B64, 'base64');

describe('Container helpers', () => {
  describe('normalizeAndValidateBase64', () => {
    test('accepts standard padded base64 (1x1 PNG)', () => {
      const { cleanBase64, buffer } = normalizeAndValidateBase64(PNG_B64);
      expect(cleanBase64).toBe(PNG_B64);
      expect(buffer.equals(PNG_BYTES)).toBe(true);
    });

    test('accepts valid base64 without padding characters', () => {
      // "hello!" encodes to 8 chars with no '=' padding needed
      const { buffer } = normalizeAndValidateBase64('aGVsbG8h');
      expect(buffer.toString('utf-8')).toBe('hello!');
    });

    test('strips data:...;base64, URI prefix', () => {
      const { cleanBase64, buffer } = normalizeAndValidateBase64(
        `data:image/png;base64,${PNG_B64}`
      );
      expect(cleanBase64).toBe(PNG_B64);
      expect(buffer.equals(PNG_BYTES)).toBe(true);
    });

    test('strips embedded \\r\\n whitespace', () => {
      const wrapped = `${PNG_B64.slice(0, 20)}\r\n${PNG_B64.slice(20, 40)}\n${PNG_B64.slice(40)}`;
      const { cleanBase64 } = normalizeAndValidateBase64(wrapped);
      expect(cleanBase64).toBe(PNG_B64);
    });

    test('rejects empty string', () => {
      expect(() => normalizeAndValidateBase64('')).toThrow('Invalid base64 data');
      expect(() => normalizeAndValidateBase64('   ')).toThrow('Invalid base64 data');
    });

    test('rejects non-base64 characters', () => {
      expect(() => normalizeAndValidateBase64('not!valid@base64')).toThrow(
        'Invalid base64 data'
      );
    });

    test('rejects bad length (not a multiple of 4)', () => {
      expect(() => normalizeAndValidateBase64('abc')).toThrow('Invalid base64 data');
    });
  });

  describe('detectContainerMimeFromBytes', () => {
    test('detects GIF (GIF8)', () => {
      expect(detectContainerMimeFromBytes(GIF_BYTES)).toBe('image/gif');
    });

    test('detects PNG', () => {
      expect(detectContainerMimeFromBytes(PNG_BYTES)).toBe('image/png');
    });

    test('detects JPEG (FF D8 FF)', () => {
      expect(
        detectContainerMimeFromBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))
      ).toBe('image/jpeg');
    });

    test('detects TIFF little-endian (II*\\x00)', () => {
      expect(
        detectContainerMimeFromBytes(Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08]))
      ).toBe('image/tiff');
    });

    test('detects TIFF big-endian (MM\\x00*)', () => {
      expect(
        detectContainerMimeFromBytes(Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0x00]))
      ).toBe('image/tiff');
    });

    test('detects PDF (%PDF)', () => {
      expect(detectContainerMimeFromBytes(Buffer.from('%PDF-1.7'))).toBe(
        'application/pdf'
      );
    });

    test('returns null for plain text and short buffers', () => {
      expect(detectContainerMimeFromBytes(Buffer.from('hi'))).toBeNull();
      expect(
        detectContainerMimeFromBytes(Buffer.from('plain text content'))
      ).toBeNull();
    });
  });

  describe('formatContentDisposition', () => {
    test('emits unquoted token for simple filenames', () => {
      expect(formatContentDisposition('ALFKI.png')).toBe(
        'inline; filename=ALFKI.png'
      );
    });

    test('quotes filenames with spaces/parens', () => {
      expect(formatContentDisposition('My Invoice (2026).pdf')).toBe(
        'inline; filename="My Invoice (2026).pdf"'
      );
    });

    test('escapes embedded double quotes', () => {
      expect(formatContentDisposition('a"b.png')).toBe(
        'inline; filename="a\\"b.png"'
      );
    });

    test('rejects CR/LF header-injection attempts', () => {
      expect(() => formatContentDisposition('bad.png\r\nX-Evil: 1')).toThrow(
        'Invalid filename'
      );
      expect(() => formatContentDisposition('bad\n.png')).toThrow('Invalid filename');
    });
  });

  describe('parseContentDispositionFilename', () => {
    test('parses unquoted token filename', () => {
      expect(parseContentDispositionFilename('inline; filename=ALFKI.png')).toBe(
        'ALFKI.png'
      );
    });

    test('parses quoted-string filename with spaces', () => {
      expect(
        parseContentDispositionFilename('attachment; filename="report final.pdf"')
      ).toBe('report final.pdf');
    });

    test('parses RFC 5987 UTF-8 extended filename', () => {
      expect(
        parseContentDispositionFilename(
          "inline; filename*=UTF-8''%E5%86%99%E7%9C%9F.png"
        )
      ).toBe('写真.png');
    });

    test('returns undefined when no filename present', () => {
      expect(parseContentDispositionFilename('inline')).toBeUndefined();
      expect(parseContentDispositionFilename(undefined)).toBeUndefined();
    });
  });
});

describe('ODataClient container methods', () => {
  let client: InstanceType<typeof ODataClient>;
  let mockAxiosInstance: any;

  const testConfig = {
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
        request: {
          use: jest.fn((handler: (cfg: any) => any) => {
            handler({ headers: {} });
            return 0;
          }),
        },
        response: { use: jest.fn() },
      },
    };
    mockedAxios.create = jest.fn(() => mockAxiosInstance) as any;
    client = new ODataClient(testConfig);
  });

  describe('uploadContainerBase64', () => {
    test('PATCHes entity URL with annotation properties (numeric key)', async () => {
      const res = await client.uploadContainerBase64(
        'contacts',
        '42',
        'Photo',
        PNG_B64,
        'photo.png',
        'image/png'
      );

      expect(mockAxiosInstance.patch).toHaveBeenCalledTimes(1);
      const [url, payload] = mockAxiosInstance.patch.mock.calls[0];
      expect(url).toBe(
        'https://test-server.com/fmi/odata/v4/TestDB/contacts(42)'
      );
      expect(payload.Photo).toBe(PNG_B64);
      expect(payload['Photo@com.filemaker.odata.Filename']).toBe('photo.png');
      expect(payload['Photo@com.filemaker.odata.ContentType']).toBe('image/png');
      expect(res.sizeBytes).toBe(PNG_BYTES.length);
      expect(res.detectedMime).toBe('image/png');
    });

    test('quotes non-numeric record keys', async () => {
      await client.uploadContainerBase64(
        'contacts',
        'ALFKI',
        'Photo',
        PNG_B64,
        'photo.png',
        'image/png'
      );
      const [url] = mockAxiosInstance.patch.mock.calls[0];
      expect(url).toBe(
        "https://test-server.com/fmi/odata/v4/TestDB/contacts('ALFKI')"
      );
    });

    test('reports detectedMime null for unrecognized bytes', async () => {
      const textB64 = Buffer.from('hello world payload').toString('base64');
      const res = await client.uploadContainerBase64(
        'contacts',
        '42',
        'Photo',
        textB64,
        'note.bin',
        'application/pdf'
      );
      expect(res.detectedMime).toBeNull();
    });

    test('rejects invalid base64 before any HTTP call', async () => {
      await expect(
        client.uploadContainerBase64(
          'contacts',
          '42',
          'Photo',
          'not!base64!',
          'x.png',
          'image/png'
        )
      ).rejects.toThrow('Invalid base64 data');
      expect(mockAxiosInstance.patch).not.toHaveBeenCalled();
    });

    test('rejects filename with CR/LF before any HTTP call', async () => {
      await expect(
        client.uploadContainerBase64(
          'contacts',
          '42',
          'Photo',
          PNG_B64,
          'evil\r\n.png',
          'image/png'
        )
      ).rejects.toThrow('Invalid filename');
      expect(mockAxiosInstance.patch).not.toHaveBeenCalled();
    });
  });

  describe('uploadContainerBinary', () => {
    test('PATCHes field path with raw buffer and required headers', async () => {
      const res = await client.uploadContainerBinary(
        'contacts',
        'ALFKI',
        'Photo',
        PNG_BYTES,
        'photo.png',
        'image/png'
      );

      expect(mockAxiosInstance.patch).toHaveBeenCalledTimes(1);
      const [url, data, config] = mockAxiosInstance.patch.mock.calls[0];
      expect(url).toBe(
        "https://test-server.com/fmi/odata/v4/TestDB/contacts('ALFKI')/Photo"
      );
      expect(Buffer.isBuffer(data)).toBe(true);
      expect(data.equals(PNG_BYTES)).toBe(true);
      expect(config.headers['Content-Type']).toBe('image/png');
      expect(config.headers['Content-Disposition']).toBe(
        'inline; filename=photo.png'
      );
      expect(config.headers['OData-Version']).toBe('4.0');
      expect(config.headers['OData-MaxVersion']).toBe('4.0');
      expect(config.maxBodyLength).toBe(Infinity);
      expect(config.maxContentLength).toBe(Infinity);
      expect(res.sizeBytes).toBe(PNG_BYTES.length);
    });

    test('rejects empty buffer before any HTTP call', async () => {
      await expect(
        client.uploadContainerBinary(
          'contacts',
          '42',
          'Photo',
          Buffer.alloc(0),
          'x.png',
          'image/png'
        )
      ).rejects.toThrow('buffer is empty');
      expect(mockAxiosInstance.patch).not.toHaveBeenCalled();
    });
  });

  describe('downloadContainer', () => {
    test('GETs /$value with arraybuffer and returns base64 + detected MIME', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: PNG_BYTES,
        headers: {
          'content-type': 'image/png',
          'content-disposition': 'inline; filename=photo.png',
        },
      });

      const res = await client.downloadContainer('contacts', '42', 'Photo');

      const [url, config] = mockAxiosInstance.get.mock.calls[0];
      expect(url).toBe(
        'https://test-server.com/fmi/odata/v4/TestDB/contacts(42)/Photo/$value'
      );
      expect(config.responseType).toBe('arraybuffer');
      expect(config.headers.Accept).toBe('*/*');
      expect(res.base64Data).toBe(PNG_B64);
      expect(res.contentType).toBe('image/png');
      expect(res.sizeBytes).toBe(PNG_BYTES.length);
      expect(res.filename).toBe('photo.png');
    });

    test('round-trips high-bit bytes (0x89/0xff/0x00) without UTF-8 corruption', async () => {
      const raw = Buffer.from([0x89, 0x50, 0x00, 0xff, 0x20, 0x0a, 0xfe]);
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: raw,
        headers: { 'content-type': 'application/octet-stream' },
      });

      const res = await client.downloadContainer('contacts', '42', 'Photo');
      expect(Buffer.from(res.base64Data, 'base64').equals(raw)).toBe(true);
    });

    test('falls back to magic-byte detection on application/octet-stream', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: PNG_BYTES,
        headers: { 'content-type': 'application/octet-stream' },
      });
      const res = await client.downloadContainer('contacts', '42', 'Photo');
      expect(res.contentType).toBe('image/png');
    });

    test('builds repetition and FMFID path segments', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: PNG_BYTES,
        headers: { 'content-type': 'image/png' },
      });

      await client.downloadContainer('contacts', '42', 'Photo', 2);
      expect(mockAxiosInstance.get.mock.calls[0][0]).toBe(
        'https://test-server.com/fmi/odata/v4/TestDB/contacts(42)/Photo[2]/$value'
      );

      await client.downloadContainer('contacts', '42', 'FMFID:99');
      expect(mockAxiosInstance.get.mock.calls[1][0]).toBe(
        'https://test-server.com/fmi/odata/v4/TestDB/contacts(42)/FMFID:99/$value'
      );
    });

    test('decodes ArrayBuffer OData error payloads via handleError', async () => {
      // grab the response error interceptor registered in the constructor
      const errorHandler =
        mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
      const error = {
        response: {
          status: 404,
          statusText: 'Not Found',
          data: Buffer.from(
            JSON.stringify({
              error: { code: '20404', message: 'Record not found' },
            })
          ),
        },
      };

      await expect(errorHandler(error)).rejects.toThrow(
        'OData Error [20404]: Record not found'
      );
    });
  });

  describe('getFieldValue', () => {
    test('returns decoded UTF-8 text for scalar fields', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: Buffer.from('Alice Smith'),
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });

      const res = await client.getFieldValue('contacts', '42', 'Name');
      const [url, config] = mockAxiosInstance.get.mock.calls[0];
      expect(url).toBe(
        'https://test-server.com/fmi/odata/v4/TestDB/contacts(42)/Name/$value'
      );
      expect(config.headers.Accept).toBe('text/plain, */*');
      expect(res.value).toBe('Alice Smith');
      expect(res.contentType).toBe('text/plain');
      expect(res.isBinaryContainer).toBe(false);
    });

    test('returns null value on 204 No Content', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 204,
        data: undefined,
        headers: {},
      });
      const res = await client.getFieldValue('contacts', '42', 'Name');
      expect(res.value).toBeNull();
      expect(res.isBinaryContainer).toBe(false);
    });

    test('flags binary media as isBinaryContainer', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: PNG_BYTES,
        headers: { 'content-type': 'image/png' },
      });
      const res = await client.getFieldValue('contacts', '42', 'Photo');
      expect(res.value).toBeNull();
      expect(res.contentType).toBe('image/png');
      expect(res.isBinaryContainer).toBe(true);
    });
  });
});

describe('Container tool routing & handlers', () => {
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      uploadContainerBase64: jest.fn(() =>
        Promise.resolve({ sizeBytes: PNG_BYTES.length, detectedMime: 'image/png' })
      ),
      uploadContainerBinary: jest.fn(() =>
        Promise.resolve({ sizeBytes: PNG_BYTES.length })
      ),
      downloadContainer: jest.fn(() =>
        Promise.resolve({
          base64Data: PNG_B64,
          contentType: 'image/png',
          sizeBytes: PNG_BYTES.length,
          filename: 'photo.png',
        })
      ),
      getFieldValue: jest.fn(() =>
        Promise.resolve({
          value: 'Alice',
          contentType: 'text/plain',
          isBinaryContainer: false,
        })
      ),
    };
    (connectionManager.getCurrentClient as jest.Mock).mockReturnValue(mockClient);
  });

  const uploadArgs = {
    table: 'contacts',
    recordId: '42',
    field: 'Photo',
    base64Data: PNG_B64,
    filename: 'photo.png',
    contentType: 'image/png',
  };

  describe('fm_odata_upload_container', () => {
    test('defaults to mode "base64" and emits no warning on PNG/image/png match', async () => {
      const result = await handleODataTool('fm_odata_upload_container', uploadArgs);

      expect(result.isError).toBeUndefined();
      expect(mockClient.uploadContainerBase64).toHaveBeenCalledWith(
        'contacts',
        '42',
        'Photo',
        PNG_B64,
        'photo.png',
        'image/png'
      );
      expect(mockClient.uploadContainerBinary).not.toHaveBeenCalled();
      const output = JSON.parse(result.content[0].text);
      expect(output.ok).toBe(true);
      expect(output.mode).toBe('base64');
      expect(output.sizeBytes).toBe(PNG_BYTES.length);
      expect(output.warning).toBeUndefined();
    });

    test('warns when magic-byte signature differs from declared contentType', async () => {
      mockClient.uploadContainerBase64.mockResolvedValue({
        sizeBytes: GIF_BYTES.length,
        detectedMime: 'image/gif',
      });
      const result = await handleODataTool('fm_odata_upload_container', {
        ...uploadArgs,
        base64Data: GIF_B64,
      });

      const output = JSON.parse(result.content[0].text);
      expect(output.warning).toContain('differs from magic-byte signature');
      expect(output.warning).toContain("mode: 'binary'");
    });

    test('routes to uploadContainerBinary when mode is "binary"', async () => {
      const result = await handleODataTool('fm_odata_upload_container', {
        ...uploadArgs,
        mode: 'binary',
      });

      expect(mockClient.uploadContainerBinary).toHaveBeenCalledTimes(1);
      const [, , , data] = mockClient.uploadContainerBinary.mock.calls[0];
      expect(Buffer.isBuffer(data)).toBe(true);
      expect(data.equals(PNG_BYTES)).toBe(true);
      expect(mockClient.uploadContainerBase64).not.toHaveBeenCalled();
      const output = JSON.parse(result.content[0].text);
      expect(output.mode).toBe('binary');
    });

    test('rejects invalid mode values', async () => {
      const result = await handleODataTool('fm_odata_upload_container', {
        ...uploadArgs,
        mode: 'stream',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('invalid mode');
      expect(mockClient.uploadContainerBase64).not.toHaveBeenCalled();
      expect(mockClient.uploadContainerBinary).not.toHaveBeenCalled();
    });

    test('warns on content types outside the documented container types', async () => {
      mockClient.uploadContainerBase64.mockResolvedValue({
        sizeBytes: 8,
        detectedMime: null,
      });
      const result = await handleODataTool('fm_odata_upload_container', {
        ...uploadArgs,
        base64Data: Buffer.from('whatever').toString('base64'),
        filename: 'a.zip',
        contentType: 'application/zip',
      });
      const output = JSON.parse(result.content[0].text);
      expect(output.warning).toContain(
        "outside FileMaker OData's documented container types"
      );
    });
  });

  describe('fm_odata_download_container', () => {
    test('returns JSON with base64Data, contentType, sizeBytes, filename', async () => {
      const result = await handleODataTool('fm_odata_download_container', {
        table: 'contacts',
        recordId: '42',
        field: 'Photo',
      });

      expect(result.isError).toBeUndefined();
      expect(mockClient.downloadContainer).toHaveBeenCalledWith(
        'contacts',
        '42',
        'Photo',
        undefined
      );
      const output = JSON.parse(result.content[0].text);
      expect(output.base64Data).toBe(PNG_B64);
      expect(output.contentType).toBe('image/png');
      expect(output.sizeBytes).toBe(PNG_BYTES.length);
      expect(output.filename).toBe('photo.png');
    });

    test('passes repetition through to the client and output', async () => {
      const result = await handleODataTool('fm_odata_download_container', {
        table: 'contacts',
        recordId: '42',
        field: 'Photo',
        repetition: 2,
      });
      expect(mockClient.downloadContainer).toHaveBeenCalledWith(
        'contacts',
        '42',
        'Photo',
        2
      );
      const output = JSON.parse(result.content[0].text);
      expect(output.repetition).toBe(2);
    });
  });

  describe('fm_odata_get_field_value', () => {
    test('returns unwrapped text for scalar fields', async () => {
      const result = await handleODataTool('fm_odata_get_field_value', {
        table: 'contacts',
        recordId: '42',
        field: 'Name',
      });
      expect(result.isError).toBeUndefined();
      expect(mockClient.getFieldValue).toHaveBeenCalledWith(
        'contacts',
        '42',
        'Name',
        undefined
      );
      expect(result.content[0].text).toBe('Alice');
    });

    test('returns "null" text when value is null', async () => {
      mockClient.getFieldValue.mockResolvedValue({
        value: null,
        contentType: 'text/plain',
        isBinaryContainer: false,
      });
      const result = await handleODataTool('fm_odata_get_field_value', {
        table: 'contacts',
        recordId: '42',
        field: 'Name',
      });
      expect(result.content[0].text).toBe('null');
    });

    test('isError pointing to fm_odata_download_container on binary media', async () => {
      mockClient.getFieldValue.mockResolvedValue({
        value: null,
        contentType: 'image/png',
        isBinaryContainer: true,
      });
      const result = await handleODataTool('fm_odata_get_field_value', {
        table: 'contacts',
        recordId: '42',
        field: 'Photo',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('fm_odata_download_container');
    });
  });

  describe('per-call connection targeting', () => {
    test('uses named session via getClientByName without touching active session', async () => {
      const namedClient = {
        downloadContainer: jest.fn(() =>
          Promise.resolve({
            base64Data: 'AAE=',
            contentType: 'application/octet-stream',
            sizeBytes: 2,
          })
        ),
      };
      (connectionManager.getClientByName as jest.Mock).mockReturnValue(namedClient);

      const result = await handleODataTool('fm_odata_download_container', {
        table: 'contacts',
        recordId: '42',
        field: 'Photo',
        connection: 'dev',
      });

      expect(result.isError).toBeUndefined();
      expect(connectionManager.getClientByName).toHaveBeenCalledWith('dev');
      expect(connectionManager.getCurrentClient).not.toHaveBeenCalled();
      expect(namedClient.downloadContainer).toHaveBeenCalled();
      expect(mockClient.downloadContainer).not.toHaveBeenCalled();
    });
  });

  describe('handleToolCall routing', () => {
    test('container tool names route to the OData handler', async () => {
      const result = await handleToolCall('fm_odata_upload_container', uploadArgs);

      // Reaching the OData handler (not "Unknown tool") proves routing.
      expect(result.isError).toBeUndefined();
      expect(mockClient.uploadContainerBase64).toHaveBeenCalledTimes(1);
    });
  });
});
