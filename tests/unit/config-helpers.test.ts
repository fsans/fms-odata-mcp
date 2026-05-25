import { describe, test, expect } from "@jest/globals";
import { resolveVerifySsl, DEFAULT_HTTP_PORT, DEFAULT_HTTPS_PORT } from "../../src/config";

describe("resolveVerifySsl", () => {
  test("defaults to true when no sources provided", () => {
    expect(resolveVerifySsl()).toBe(true);
  });

  test("defaults to true when all sources are undefined", () => {
    expect(resolveVerifySsl(undefined, undefined)).toBe(true);
  });

  test("returns false when first defined source is false", () => {
    expect(resolveVerifySsl(false, true)).toBe(false);
  });

  test("returns true when first defined source is true", () => {
    expect(resolveVerifySsl(true, false)).toBe(true);
  });

  test("skips undefined and uses the first defined value", () => {
    expect(resolveVerifySsl(undefined, false, true)).toBe(false);
    expect(resolveVerifySsl(undefined, undefined, true)).toBe(true);
  });
});

describe("Default ports", () => {
  test("DEFAULT_HTTP_PORT is 3333", () => {
    expect(DEFAULT_HTTP_PORT).toBe(3333);
  });

  test("DEFAULT_HTTPS_PORT is 3443", () => {
    expect(DEFAULT_HTTPS_PORT).toBe(3443);
  });
});
