import { describe, it, expect, jest } from '@jest/globals';
import { HttpTransport } from '../../src/working-http-transport.js';

function createMockRes() {
  const res: any = {
    writeHead: jest.fn(),
    end: jest.fn(),
  };
  return res;
}

describe('HttpTransport', () => {
  describe('handleRequest — notification handling (no id)', () => {
    it('calls onmessage and writes 204 for a notification (no id)', async () => {
      const transport = new HttpTransport();
      const onmessage = jest.fn();
      transport.onmessage = onmessage;
      const res = createMockRes();

      const notification = { jsonrpc: '2.0', method: 'notifications/initialized', params: {} } as any;
      await transport.handleRequest({} as any, res, notification);

      expect(onmessage).toHaveBeenCalledWith(notification);
      expect(res.writeHead).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it('writes 204 even when onmessage is not set', async () => {
      const transport = new HttpTransport();
      const res = createMockRes();

      const notification = { jsonrpc: '2.0', method: 'notifications/initialized', params: {} } as any;
      await transport.handleRequest({} as any, res, notification);

      expect(res.writeHead).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });
  });

  describe('handleRequest — request with id', () => {
    it('registers a pending resolver and calls onmessage', async () => {
      const transport = new HttpTransport();
      const onmessage = jest.fn();
      transport.onmessage = onmessage;
      const res = createMockRes();

      const request = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} } as any;

      // handleRequest awaits the response promise, so we need to send a response
      const handlePromise = transport.handleRequest({} as any, res, request);

      // onmessage should have been called with the request
      expect(onmessage).toHaveBeenCalledWith(request);

      // Send a response to resolve the pending promise
      await transport.send({ jsonrpc: '2.0', id: 1, result: { tools: [] } } as any);

      await handlePromise;

      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
      const responseBody = res.end.mock.calls[0][0];
      expect(responseBody).toContain('"id":1');
      expect(responseBody).toContain('"result"');
    });
  });

  describe('send — response correlation', () => {
    it('resolves the pending promise for the matching id', async () => {
      const transport = new HttpTransport();
      const res = createMockRes();
      const request = { jsonrpc: '2.0', id: 42, method: 'tools/list', params: {} } as any;

      const handlePromise = transport.handleRequest({} as any, res, request);

      await transport.send({ jsonrpc: '2.0', id: 42, result: { tools: [] } } as any);
      await handlePromise;

      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
    });

    it('calls onerror for unknown response id', async () => {
      const transport = new HttpTransport();
      const onerror = jest.fn();
      transport.onerror = onerror;

      await transport.send({ jsonrpc: '2.0', id: 999, result: {} } as any);

      expect(onerror).toHaveBeenCalled();
      expect(onerror.mock.calls[0][0].message).toContain('999');
    });
  });

  describe('send — server-initiated notification', () => {
    it('forwards messages without result/error/id via onmessage', async () => {
      const transport = new HttpTransport();
      const onmessage = jest.fn();
      transport.onmessage = onmessage;

      const message = { jsonrpc: '2.0', method: 'notifications/resources/updated', params: {} } as any;
      await transport.send(message);

      expect(onmessage).toHaveBeenCalledWith(message);
    });
  });

  describe('handleRequest — error handling', () => {
    it('writes 500 with JSON-RPC error when onmessage throws', async () => {
      const transport = new HttpTransport();
      transport.onmessage = jest.fn(() => {
        throw new Error('Handler crashed');
      });
      const res = createMockRes();

      const request = { jsonrpc: '2.0', id: 5, method: 'tools/call', params: {} } as any;
      await transport.handleRequest({} as any, res, request);

      expect(res.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' });
      const responseBody = res.end.mock.calls[0][0];
      expect(responseBody).toContain('-32603');
      expect(responseBody).toContain('Handler crashed');
    });
  });
});
