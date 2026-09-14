import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import { createAuthMiddleware } from "../../src/simple-http-transport";

describe("createAuthMiddleware", () => {
  const originalToken = process.env.MCP_AUTH_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.MCP_AUTH_TOKEN;
    } else {
      process.env.MCP_AUTH_TOKEN = originalToken;
    }
  });

  test("returns null when MCP_AUTH_TOKEN is not set", () => {
    delete process.env.MCP_AUTH_TOKEN;
    expect(createAuthMiddleware()).toBeNull();
  });

  describe("when MCP_AUTH_TOKEN is set", () => {
    const token = "test-secret-token";

    beforeEach(() => {
      process.env.MCP_AUTH_TOKEN = token;
    });

    function mockReq(method: string, authHeader?: string): any {
      return {
        method,
        headers: authHeader ? { authorization: authHeader } : {},
      };
    }

    function mockRes(): any {
      const res: any = {
        statusCode: 200,
        body: null as any,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(data: any) {
          this.body = data;
          return this;
        },
      };
      return res;
    }

    test("returns a middleware function", () => {
      const mw = createAuthMiddleware();
      expect(typeof mw).toBe("function");
    });

    test("allows GET requests without auth header", () => {
      const mw = createAuthMiddleware()!;
      const req = mockReq("GET");
      const res = mockRes();
      let called = false;
      mw(req, res, () => {
        called = true;
      });
      expect(called).toBe(true);
      expect(res.statusCode).toBe(200);
    });

    test("rejects POST requests without auth header (401)", () => {
      const mw = createAuthMiddleware()!;
      const req = mockReq("POST");
      const res = mockRes();
      let called = false;
      mw(req, res, () => {
        called = true;
      });
      expect(called).toBe(false);
      expect(res.statusCode).toBe(401);
      expect(res.body.error.message).toMatch(/Unauthorized/);
    });

    test("rejects POST requests with wrong token (401)", () => {
      const mw = createAuthMiddleware()!;
      const req = mockReq("POST", "Bearer wrong-token");
      const res = mockRes();
      let called = false;
      mw(req, res, () => {
        called = true;
      });
      expect(called).toBe(false);
      expect(res.statusCode).toBe(401);
    });

    test("allows POST requests with correct Authorization header", () => {
      const mw = createAuthMiddleware()!;
      const req = mockReq("POST", `Bearer ${token}`);
      const res = mockRes();
      let called = false;
      mw(req, res, () => {
        called = true;
      });
      expect(called).toBe(true);
      expect(res.statusCode).toBe(200);
    });
  });
});
