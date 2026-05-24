import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage, JSONRPCRequest, JSONRPCResponse } from "@modelcontextprotocol/sdk/types.js";
import { IncomingMessage, ServerResponse } from "http";

type Resolver = (response: JSONRPCResponse) => void;

/**
 * HTTP Transport that can handle individual JSON-RPC requests.
 *
 * Responses are correlated to their originating request by JSON-RPC `id` so
 * concurrent requests on the same transport do not race or clobber each
 * other's response promise.
 */
export class HttpTransport implements Transport {
  private pending = new Map<string | number, Resolver>();

  onmessage?: (message: JSONRPCMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;

  async start(): Promise<void> {
    // Nothing to start for HTTP transport
  }

  async close(): Promise<void> {
    this.pending.clear();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    // Server-originated responses carry an `id` that matches the request.
    if (("result" in message || "error" in message) && "id" in message) {
      const id = (message as JSONRPCResponse).id;
      const resolver = id != null ? this.pending.get(id) : undefined;
      if (resolver) {
        this.pending.delete(id);
        resolver(message as JSONRPCResponse);
        return;
      }
      // No matching pending request — drop with onerror for visibility.
      if (this.onerror) {
        this.onerror(new Error(`Received response with unknown id: ${String(id)}`));
      }
      return;
    }

    // Server-initiated notifications/requests forwarded via onmessage.
    if (this.onmessage) {
      this.onmessage(message);
    }
  }

  /**
   * Handle an HTTP request and return the response.
   */
  async handleRequest(_req: IncomingMessage, res: ServerResponse, request: JSONRPCRequest): Promise<void> {
    try {
      // Notifications have no id — fire and return 204 immediately.
      if (!("id" in request) || request.id === null || request.id === undefined) {
        if (this.onmessage) {
          this.onmessage(request);
        }
        res.writeHead(204);
        res.end();
        return;
      }

      const id = request.id;

      // Register a per-request resolver keyed by id BEFORE dispatching, so a
      // synchronous `send` from the server cannot race the registration.
      const responsePromise = new Promise<JSONRPCResponse>((resolve) => {
        this.pending.set(id, resolve);
      });

      if (this.onmessage) {
        this.onmessage(request);
      }

      const response = await responsePromise;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response));
    } catch (error) {
      // Clean up pending entry on failure (best effort).
      if ("id" in request && request.id != null) {
        this.pending.delete(request.id);
      }
      console.error("Error handling HTTP request:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: request.id ?? null,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "Internal error",
          },
        })
      );
    }
  }
}
