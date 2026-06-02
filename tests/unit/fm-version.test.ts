import { describe, test, expect, beforeEach, jest } from "@jest/globals";
import {
  parseServerVersion,
  isFeatureSupported,
  featureWarning,
  buildFeatureReport,
  compareVersions,
  FM_FEATURE_MATRIX,
  FMServerVersion,
} from "../../src/fm-version";
import { handleToolCall } from "../../src/tools/index";
import { connectionManager } from "../../src/connection";

// ---------------------------------------------------------------------------
// Fixture EDMX strings
// ---------------------------------------------------------------------------

function makeEdmxWithAnnotation(version: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="FileMaker" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <Annotations Target="FileMaker.Container">
        <Annotation Term="Org.OData.Core.V1.ProductVersion" String="${version}"/>
      </Annotations>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;
}

const EDMX_V21_1_2 = makeEdmxWithAnnotation("21.1.2.500");
const EDMX_V22_0_1 = makeEdmxWithAnnotation("22.0.1.0");
const EDMX_V19_6_0 = makeEdmxWithAnnotation("19.6.0.123");
const EDMX_NO_ANNOTATION = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="FileMaker" xmlns="http://docs.oasis-open.org/odata/ns/edm">
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;
const EDMX_EMPTY = "";
const EDMX_GARBAGE = "this is not xml at all !!!";

// Reversed attribute order variant
const EDMX_REVERSED_ATTRS = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="FileMaker" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <Annotations Target="FileMaker.Container">
        <Annotation String="20.3.1.100" Term="Org.OData.Core.V1.ProductVersion"/>
      </Annotations>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

// ---------------------------------------------------------------------------
// parseServerVersion
// ---------------------------------------------------------------------------

describe("parseServerVersion", () => {
  test("extracts version from ProductVersion annotation (v21.1.2)", () => {
    const v = parseServerVersion(EDMX_V21_1_2);
    expect(v).not.toBeNull();
    expect(v!.major).toBe(21);
    expect(v!.minor).toBe(1);
    expect(v!.patch).toBe(2);
    expect(v!.raw).toBe("21.1.2.500");
  });

  test("extracts version from ProductVersion annotation (v22.0.1)", () => {
    const v = parseServerVersion(EDMX_V22_0_1);
    expect(v).not.toBeNull();
    expect(v!.major).toBe(22);
    expect(v!.minor).toBe(0);
    expect(v!.patch).toBe(1);
  });

  test("extracts version from ProductVersion annotation (v19.6.0)", () => {
    const v = parseServerVersion(EDMX_V19_6_0);
    expect(v).not.toBeNull();
    expect(v!.major).toBe(19);
    expect(v!.minor).toBe(6);
    expect(v!.patch).toBe(0);
  });

  test("extracts version when attribute order is reversed (String before Term)", () => {
    const v = parseServerVersion(EDMX_REVERSED_ATTRS);
    expect(v).not.toBeNull();
    expect(v!.major).toBe(20);
    expect(v!.minor).toBe(3);
    expect(v!.patch).toBe(1);
  });

  test("returns null when annotation is absent", () => {
    expect(parseServerVersion(EDMX_NO_ANNOTATION)).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(parseServerVersion(EDMX_EMPTY)).toBeNull();
  });

  test("returns null for garbage input", () => {
    expect(parseServerVersion(EDMX_GARBAGE)).toBeNull();
  });

  test("returns null for non-string input (null)", () => {
    expect(parseServerVersion(null as any)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// compareVersions
// ---------------------------------------------------------------------------

describe("compareVersions", () => {
  const v19: FMServerVersion = { major: 19, minor: 0, patch: 0, raw: "19.0.0" };
  const v21: FMServerVersion = { major: 21, minor: 1, patch: 0, raw: "21.1.0" };
  const v22: FMServerVersion = { major: 22, minor: 0, patch: 1, raw: "22.0.1" };
  const v22_same: FMServerVersion = { major: 22, minor: 0, patch: 1, raw: "22.0.1" };

  test("lower major < higher major", () => {
    expect(compareVersions(v19, v21)).toBeLessThan(0);
  });

  test("higher major > lower major", () => {
    expect(compareVersions(v22, v21)).toBeGreaterThan(0);
  });

  test("equal versions return 0", () => {
    expect(compareVersions(v22, v22_same)).toBe(0);
  });

  test("minor version discriminates when major is equal", () => {
    const a: FMServerVersion = { major: 21, minor: 0, patch: 9, raw: "21.0.9" };
    const b: FMServerVersion = { major: 21, minor: 1, patch: 0, raw: "21.1.0" };
    expect(compareVersions(a, b)).toBeLessThan(0);
  });

  test("patch version discriminates when major+minor are equal", () => {
    const a: FMServerVersion = { major: 22, minor: 0, patch: 0, raw: "22.0.0" };
    expect(compareVersions(a, v22)).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// isFeatureSupported
// ---------------------------------------------------------------------------

describe("isFeatureSupported", () => {
  const v19: FMServerVersion = { major: 19, minor: 0, patch: 0, raw: "19.0.0" };
  const v21: FMServerVersion = { major: 21, minor: 1, patch: 0, raw: "21.1.0" };
  const v21_old: FMServerVersion = { major: 21, minor: 0, patch: 9, raw: "21.0.9" };
  const v22: FMServerVersion = { major: 22, minor: 0, patch: 1, raw: "22.0.1" };
  const v22_old: FMServerVersion = { major: 22, minor: 0, patch: 0, raw: "22.0.0" };

  test("basic_odata supported on v19+", () => {
    expect(isFeatureSupported(v19, "basic_odata")).toBe(true);
  });

  test("cast NOT supported below v21.1.0", () => {
    expect(isFeatureSupported(v19, "cast")).toBe(false);
    expect(isFeatureSupported(v21_old, "cast")).toBe(false);
  });

  test("cast supported at exactly v21.1.0", () => {
    expect(isFeatureSupported(v21, "cast")).toBe(true);
  });

  test("build_filter NOT supported below v21.1.0", () => {
    expect(isFeatureSupported(v19, "build_filter")).toBe(false);
  });

  test("build_filter supported at v21.1.0+", () => {
    expect(isFeatureSupported(v21, "build_filter")).toBe(true);
    expect(isFeatureSupported(v22, "build_filter")).toBe(true);
  });

  test("aggregate NOT supported below v22.0.1", () => {
    expect(isFeatureSupported(v19, "aggregate")).toBe(false);
    expect(isFeatureSupported(v21, "aggregate")).toBe(false);
    expect(isFeatureSupported(v22_old, "aggregate")).toBe(false);
  });

  test("aggregate supported at exactly v22.0.1", () => {
    expect(isFeatureSupported(v22, "aggregate")).toBe(true);
  });

  test("null version → feature NOT supported", () => {
    expect(isFeatureSupported(null, "cast")).toBe(false);
    expect(isFeatureSupported(null, "aggregate")).toBe(false);
    expect(isFeatureSupported(null, "basic_odata")).toBe(false);
  });

  test("unknown feature → returns true (don't block unknown features)", () => {
    expect(isFeatureSupported(v22, "some_future_feature")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// featureWarning
// ---------------------------------------------------------------------------

describe("featureWarning", () => {
  const v21: FMServerVersion = { major: 21, minor: 1, patch: 0, raw: "21.1.0" };
  const v22: FMServerVersion = { major: 22, minor: 0, patch: 1, raw: "22.0.1" };
  const v19: FMServerVersion = { major: 19, minor: 0, patch: 0, raw: "19.0.0" };

  test("returns null when feature is supported", () => {
    expect(featureWarning(v21, "cast")).toBeNull();
    expect(featureWarning(v22, "aggregate")).toBeNull();
  });

  test("returns advisory string when version too old for cast", () => {
    const msg = featureWarning(v19, "cast");
    expect(msg).not.toBeNull();
    expect(msg).toMatch(/19\.0\.0/);
    expect(msg).toMatch(/21\.1\.0/);
    expect(msg).toMatch(/\[Compatibility\]/);
  });

  test("returns advisory string when version too old for aggregate", () => {
    const msg = featureWarning(v21, "aggregate");
    expect(msg).not.toBeNull();
    expect(msg).toMatch(/22\.0\.1/);
  });

  test("mentions fallback text in warning", () => {
    const msg = featureWarning(v19, "aggregate");
    expect(msg).toMatch(/client-side/i);
  });

  test("returns advisory string when version is null (unknown)", () => {
    const msg = featureWarning(null, "cast");
    expect(msg).not.toBeNull();
    expect(msg).toMatch(/could not be detected/i);
    expect(msg).toMatch(/\[Compatibility\]/);
  });

  test("returns null for unknown feature regardless of version", () => {
    expect(featureWarning(v22, "some_future_feature")).toBeNull();
    expect(featureWarning(null, "some_future_feature")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildFeatureReport
// ---------------------------------------------------------------------------

describe("buildFeatureReport", () => {
  const v22: FMServerVersion = { major: 22, minor: 0, patch: 1, raw: "22.0.1" };
  const v19: FMServerVersion = { major: 19, minor: 0, patch: 0, raw: "19.0.0" };

  test("all features supported on v22.0.1", () => {
    const report = buildFeatureReport(v22);
    expect(report.basic_odata.supported).toBe(true);
    expect(report.cast.supported).toBe(true);
    expect(report.build_filter.supported).toBe(true);
    expect(report.aggregate.supported).toBe(true);
  });

  test("only basic_odata supported on v19.0.0", () => {
    const report = buildFeatureReport(v19);
    expect(report.basic_odata.supported).toBe(true);
    expect(report.cast.supported).toBe(false);
    expect(report.build_filter.supported).toBe(false);
    expect(report.aggregate.supported).toBe(false);
  });

  test("unsupported features include fallback text", () => {
    const report = buildFeatureReport(v19);
    expect(report.aggregate.fallback).toBeDefined();
    expect(report.aggregate.fallback).toMatch(/client-side/i);
  });

  test("supported features do NOT include fallback field", () => {
    const report = buildFeatureReport(v22);
    expect(report.aggregate.fallback).toBeUndefined();
  });

  test("report includes 'since' for every feature", () => {
    const report = buildFeatureReport(v22);
    for (const key of Object.keys(FM_FEATURE_MATRIX)) {
      expect(report[key].since).toBeDefined();
    }
  });

  test("null version → all features not supported", () => {
    const report = buildFeatureReport(null);
    expect(report.cast.supported).toBe(false);
    expect(report.aggregate.supported).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Client-side aggregate fallback (via handleToolCall with mocked client)
// ---------------------------------------------------------------------------

describe("fm_odata_aggregate client-side fallback", () => {
  beforeEach(() => {
    connectionManager.clearClients();
  });

  function makeMockClient(version: FMServerVersion | null, records: Record<string, any>[]) {
    return {
      getServerVersion: jest.fn<() => Promise<FMServerVersion | null>>().mockResolvedValue(version),
      queryRecords: jest.fn<() => Promise<any>>().mockResolvedValue({ value: records }),
      aggregateRecords: jest.fn<() => Promise<any>>().mockRejectedValue(new Error("should not be called")),
    };
  }

  function registerMockClient(name: string, client: any) {
    // We bypass createInlineClientNamed by reaching into the manager's internals
    // via the public API: register a dummy connection then replace the client.
    const conn = {
      server: "https://fms.test",
      database: "TestDB",
      user: "admin",
      password: "pass",
    };
    connectionManager.createInlineClientNamed(conn, false, 1000, name);
    // Replace with mock by accessing private map via cast
    (connectionManager as any).clients.set(name, client);
    (connectionManager as any).currentConnectionName = name;
  }

  const sampleRecords = [
    { Amount: 100, Category: "A" },
    { Amount: 200, Category: "B" },
    { Amount: 300, Category: "A" },
    { Amount: 50,  Category: "B" },
  ];

  const v19: FMServerVersion = { major: 19, minor: 0, patch: 0, raw: "19.0.0" };

  test("sum computed client-side on old server", async () => {
    const client = makeMockClient(v19, sampleRecords);
    registerMockClient("test_session", client);
    const result: any = await handleToolCall("fm_odata_aggregate", {
      table: "Orders",
      method: "sum",
      field: "Amount",
      alias: "TotalAmount",
    });
    const text = result.content?.[0]?.text ?? "";
    expect(text).toMatch(/\[Compatibility\]/);
    const jsonStart = text.indexOf("{");
    const payload = JSON.parse(text.slice(jsonStart));
    expect(payload.value[0].TotalAmount).toBe(650);
  });

  test("average computed client-side on old server", async () => {
    const client = makeMockClient(v19, sampleRecords);
    registerMockClient("test_session", client);
    const result: any = await handleToolCall("fm_odata_aggregate", {
      table: "Orders",
      method: "average",
      field: "Amount",
      alias: "AvgAmount",
    });
    const text = result.content?.[0]?.text ?? "";
    const jsonStart = text.indexOf("{");
    const payload = JSON.parse(text.slice(jsonStart));
    expect(payload.value[0].AvgAmount).toBeCloseTo(162.5);
  });

  test("min computed client-side on old server", async () => {
    const client = makeMockClient(v19, sampleRecords);
    registerMockClient("test_session", client);
    const result: any = await handleToolCall("fm_odata_aggregate", {
      table: "Orders",
      method: "min",
      field: "Amount",
      alias: "MinAmount",
    });
    const text = result.content?.[0]?.text ?? "";
    const jsonStart = text.indexOf("{");
    const payload = JSON.parse(text.slice(jsonStart));
    expect(payload.value[0].MinAmount).toBe(50);
  });

  test("max computed client-side on old server", async () => {
    const client = makeMockClient(v19, sampleRecords);
    registerMockClient("test_session", client);
    const result: any = await handleToolCall("fm_odata_aggregate", {
      table: "Orders",
      method: "max",
      field: "Amount",
      alias: "MaxAmount",
    });
    const text = result.content?.[0]?.text ?? "";
    const jsonStart = text.indexOf("{");
    const payload = JSON.parse(text.slice(jsonStart));
    expect(payload.value[0].MaxAmount).toBe(300);
  });

  test("count computed client-side on old server", async () => {
    const client = makeMockClient(v19, sampleRecords);
    registerMockClient("test_session", client);
    const result: any = await handleToolCall("fm_odata_aggregate", {
      table: "Orders",
      method: "count",
      alias: "RecordCount",
    });
    const text = result.content?.[0]?.text ?? "";
    const jsonStart = text.indexOf("{");
    const payload = JSON.parse(text.slice(jsonStart));
    expect(payload.value[0].RecordCount).toBe(4);
  });

  test("countdistinct computed client-side on old server", async () => {
    const client = makeMockClient(v19, sampleRecords);
    registerMockClient("test_session", client);
    const result: any = await handleToolCall("fm_odata_aggregate", {
      table: "Orders",
      method: "countdistinct",
      field: "Category",
      alias: "UniqueCategories",
    });
    const text = result.content?.[0]?.text ?? "";
    const jsonStart = text.indexOf("{");
    const payload = JSON.parse(text.slice(jsonStart));
    expect(payload.value[0].UniqueCategories).toBe(2);
  });

  test("groupBy produces multiple result rows client-side", async () => {
    const client = makeMockClient(v19, sampleRecords);
    registerMockClient("test_session", client);
    const result: any = await handleToolCall("fm_odata_aggregate", {
      table: "Orders",
      method: "sum",
      field: "Amount",
      alias: "TotalAmount",
      groupBy: "Category",
    });
    const text = result.content?.[0]?.text ?? "";
    const jsonStart = text.indexOf("{");
    const payload = JSON.parse(text.slice(jsonStart));
    expect(payload.value).toHaveLength(2);

    const byCategory = Object.fromEntries(
      payload.value.map((r: any) => [r.Category, r.TotalAmount])
    );
    expect(byCategory["A"]).toBe(400);
    expect(byCategory["B"]).toBe(250);
  });

  test("server-side $apply used when version supports aggregate (v22.0.1)", async () => {
    const v22: FMServerVersion = { major: 22, minor: 0, patch: 1, raw: "22.0.1" };
    const serverResponse = { "@odata.context": "ctx", value: [{ Total: 999 }] };
    const client = {
      getServerVersion: jest.fn<() => Promise<FMServerVersion | null>>().mockResolvedValue(v22),
      aggregateRecords: jest.fn<() => Promise<any>>().mockResolvedValue(serverResponse),
      queryRecords: jest.fn<() => Promise<any>>().mockRejectedValue(new Error("should not be called")),
    };
    registerMockClient("test_session", client);
    const result: any = await handleToolCall("fm_odata_aggregate", {
      table: "Orders",
      method: "sum",
      field: "Amount",
      alias: "Total",
    });
    // aggregateRecords was called (server-side path)
    expect(client.aggregateRecords).toHaveBeenCalled();
    expect(client.queryRecords).not.toHaveBeenCalled();
    // No compatibility notice in output
    expect(result.content?.[0]?.text).not.toMatch(/\[Compatibility\]/);
  });
});

// ---------------------------------------------------------------------------
// fm_odata_get_server_version tool routing
// ---------------------------------------------------------------------------

describe("fm_odata_get_server_version routing", () => {
  beforeEach(() => {
    connectionManager.clearClients();
  });

  test("routes to connection handler (not OData), no active session → error", async () => {
    const result: any = await handleToolCall("fm_odata_get_server_version", {});
    const text = result.content?.[0]?.text ?? "";
    // Must not say "Unknown tool"
    expect(text).not.toMatch(/Unknown tool/i);
    // No active session → error
    expect(result.isError).toBe(true);
    expect(text).toMatch(/No active connection/i);
  });

  test("returns version JSON when session has a mock client", async () => {
    const v22: FMServerVersion = { major: 22, minor: 0, patch: 1, raw: "22.0.1" };
    const conn = {
      server: "https://fms.test",
      database: "TestDB",
      user: "admin",
      password: "pass",
    };
    connectionManager.createInlineClientNamed(conn, false, 1000, "main");
    const mockClient = {
      getServerVersion: jest.fn<() => Promise<FMServerVersion | null>>().mockResolvedValue(v22),
      testConnection: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
      testConnectionDetailed: jest.fn<() => Promise<any>>().mockResolvedValue({ ok: true }),
    };
    (connectionManager as any).clients.set("main", mockClient);
    (connectionManager as any).currentConnectionName = "main";

    const result: any = await handleToolCall("fm_odata_get_server_version", {});
    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content?.[0]?.text ?? "{}");
    expect(payload.version.major).toBe(22);
    expect(payload.version.minor).toBe(0);
    expect(payload.version.patch).toBe(1);
    expect(payload.features.aggregate.supported).toBe(true);
    expect(payload.features.cast.supported).toBe(true);
  });

  test("returns null version and notice when getServerVersion returns null", async () => {
    const conn = {
      server: "https://fms.test",
      database: "TestDB",
      user: "admin",
      password: "pass",
    };
    connectionManager.createInlineClientNamed(conn, false, 1000, "main");
    const mockClient = {
      getServerVersion: jest.fn<() => Promise<FMServerVersion | null>>().mockResolvedValue(null),
    };
    (connectionManager as any).clients.set("main", mockClient);
    (connectionManager as any).currentConnectionName = "main";

    const result: any = await handleToolCall("fm_odata_get_server_version", {});
    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content?.[0]?.text ?? "{}");
    expect(payload.version).toBeNull();
    expect(payload.notice).toMatch(/could not be detected/i);
  });
});
