/**
 * FileMaker Server version detection, comparison, and feature compatibility.
 *
 * Detection reads the OData $metadata XML (lazy, cached per ODataClient).
 * Priority order:
 *   1. <Annotation Term="Org.OData.Core.V1.ProductVersion" String="x.x.x.build"/>
 *   2. Version attribute on the edmx:Edmx root element (older FM Server builds)
 *   3. null (unknown) — tools proceed with a warning, never a hard error
 */

export interface FMServerVersion {
  major: number;
  minor: number;
  patch: number;
  /** Raw string exactly as found in the XML, e.g. "21.1.2.500" */
  raw: string;
}

export interface FeatureInfo {
  /** Minimum FM Server version that supports this feature */
  minVersion: FMServerVersion;
  /** Human-readable description of the feature */
  description: string;
  /** What happens when the server is too old */
  fallback: string;
}

export const FM_FEATURE_MATRIX: Record<string, FeatureInfo> = {
  basic_odata: {
    minVersion: { major: 19, minor: 0, patch: 0, raw: "19.0.0" },
    description: "Core OData 4.01 operations (query, CRUD, metadata)",
    fallback: "n/a — all core tools require at least FM Server 19",
  },
  cast: {
    minVersion: { major: 21, minor: 1, patch: 0, raw: "21.1.0" },
    description: "OData type-cast property path expressions (FileMaker 2024)",
    fallback: "Expression is still returned as-is; server may reject it at runtime",
  },
  build_filter: {
    minVersion: { major: 21, minor: 1, patch: 0, raw: "21.1.0" },
    description: "Parameterized $filter via OData @alias substitution (FileMaker 2024)",
    fallback: "Expression is still returned as-is; server may reject it at runtime",
  },
  aggregate: {
    minVersion: { major: 22, minor: 0, patch: 1, raw: "22.0.1" },
    description: "Server-side aggregation via OData $apply (FileMaker 2025)",
    fallback: "Client-side computation over up to 10 000 records",
  },
};

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Extract a three-part semver from a raw version string that may contain a
 * build number (e.g. "21.1.2.500" → major=21, minor=1, patch=2).
 */
function parseVersionString(raw: string): FMServerVersion | null {
  const m = raw.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return {
    major: parseInt(m[1], 10),
    minor: parseInt(m[2], 10),
    patch: parseInt(m[3], 10),
    raw: raw.trim(),
  };
}

/**
 * Parse the FileMaker Server version from an OData $metadata XML string.
 *
 * Strategy 1 — Annotation Term (preferred, present in FM Server 19+):
 *   <Annotation Term="Org.OData.Core.V1.ProductVersion" String="21.1.2.500"/>
 *
 * Strategy 2 — edmx:Edmx Version attribute (older builds, value is OData
 *   spec version "4.0", not the FM version, so we skip if it looks like "4.x"):
 *   Only used as a last-resort regex fallback for non-standard annotation terms.
 *
 * Returns null if neither strategy yields a parseable version.
 */
export function parseServerVersion(metadataXml: string): FMServerVersion | null {
  if (!metadataXml || typeof metadataXml !== "string") return null;

  // Strategy 1a: canonical annotation term
  const annotationMatch = metadataXml.match(
    /Term\s*=\s*["']Org\.OData\.Core\.V1\.ProductVersion["'][^>]*String\s*=\s*["']([^"']+)["']/
  );
  if (annotationMatch) {
    const v = parseVersionString(annotationMatch[1]);
    if (v) return v;
  }

  // Strategy 1b: reversed attribute order
  const annotationMatchRev = metadataXml.match(
    /String\s*=\s*["']([^"']+)["'][^>]*Term\s*=\s*["']Org\.OData\.Core\.V1\.ProductVersion["']/
  );
  if (annotationMatchRev) {
    const v = parseVersionString(annotationMatchRev[1]);
    if (v) return v;
  }

  // Strategy 2: any annotation whose String value looks like a 3-4 part FM version
  // (major >= 17, to avoid false-positives from OData spec "4.0")
  const genericAnnotationMatch = metadataXml.match(
    /Term\s*=\s*["'][^"']*Version[^"']*["'][^>]*String\s*=\s*["'](\d{2,}\.\d+\.\d+[^"']*?)["']/
  );
  if (genericAnnotationMatch) {
    const v = parseVersionString(genericAnnotationMatch[1]);
    if (v && v.major >= 17) return v;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Comparison helpers
// ---------------------------------------------------------------------------

/**
 * Returns negative if a < b, 0 if equal, positive if a > b.
 */
export function compareVersions(a: FMServerVersion, b: FMServerVersion): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/**
 * Returns true if the given server version meets the minimum required for
 * the named feature. Returns false when version is null (unknown).
 */
export function isFeatureSupported(
  version: FMServerVersion | null,
  feature: string
): boolean {
  if (!version) return false;
  const info = FM_FEATURE_MATRIX[feature];
  if (!info) return true; // unknown feature — don't block
  return compareVersions(version, info.minVersion) >= 0;
}

/**
 * Returns a one-line advisory string when the feature is not supported or the
 * version is unknown, or null when no notice is needed.
 */
export function featureWarning(
  version: FMServerVersion | null,
  feature: string
): string | null {
  const info = FM_FEATURE_MATRIX[feature];
  if (!info) return null;

  if (!version) {
    return (
      `[Compatibility] FM Server version could not be detected. ` +
      `'${feature}' requires FM Server ${info.minVersion.raw}+. ` +
      `Proceeding anyway — ${info.fallback}.`
    );
  }

  if (compareVersions(version, info.minVersion) < 0) {
    return (
      `[Compatibility] FM Server ${version.raw} does not support '${feature}' ` +
      `(requires ${info.minVersion.raw}+). ` +
      `${info.fallback}.`
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Feature report (used by fm_odata_get_server_version)
// ---------------------------------------------------------------------------

export interface FeatureReport {
  supported: boolean;
  since: string;
  fallback?: string;
}

/**
 * Build the full feature-compatibility report for a given server version.
 * Suitable for embedding directly in tool output JSON.
 */
export function buildFeatureReport(
  version: FMServerVersion | null
): Record<string, FeatureReport> {
  const report: Record<string, FeatureReport> = {};
  for (const [key, info] of Object.entries(FM_FEATURE_MATRIX)) {
    const supported = isFeatureSupported(version, key);
    report[key] = {
      supported,
      since: info.minVersion.raw,
      ...(supported ? {} : { fallback: info.fallback }),
    };
  }
  return report;
}
