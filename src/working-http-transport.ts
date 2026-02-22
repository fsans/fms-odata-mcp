import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage, JSONRPCRequest, JSONRPCResponse } from "@modelcontextprotocol/sdk/types.js";
import { IncomingMessage, ServerResponse } from "http";

/**
 * HTTP Transport that can handle individual requests
 * This transport captures responses for HTTP responses
 */
export class HttpTransport implements Transport {
  private response?: JSONRPCResponse;
  private responsePromise?: Promise<JSONRPCResponse>;
  private responseResolve?: (value: JSONRPCResponse) => void;

  onmessage?: (message: JSONRPCMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;

  constructor() {
    // Create a promise that will resolve with the response
    this.responsePromise = new Promise<JSONRPCResponse>((resolve) => {
      this.responseResolve = resolve;
    });
  }

  async start(): Promise<void> {
    // Nothing to start for HTTP transport
  }

  async close(): Promise<void> {
    // Nothing to close for HTTP transport
  }

  async send(message: JSONRPCMessage): Promise<void> {
    // Capture the response when the server sends it
    if ('result' in message || 'error' in message) {
      this.response = message as JSONRPCResponse;
      if (this.responseResolve) {
        this.responseResolve(this.response);
      }
    } else if (this.onmessage) {
      this.onmessage(message);
    }
  }

  /**
   * Handle an HTTP request and return the response
   */
  async handleRequest(req: IncomingMessage, res: ServerResponse, request: JSONRPCRequest): Promise<void> {
    try {
      // Reset response for this request
      this.response = undefined;
      this.responsePromise = new Promise<JSONRPCResponse>((resolve) => {
        this.responseResolve = resolve;
      });

      // Send the request to the server (which will call this.send)
      if (this.onmessage) {
        this.onmessage(request);
      }

      // Wait for the response
      const response = await this.responsePromise;
      
      // Send the response back via HTTP
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (error) {
      console.error("Error handling HTTP request:", error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: "2.0",
        id: request.id || null,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : "Internal error",
        },
      }));
    }
  }
}
