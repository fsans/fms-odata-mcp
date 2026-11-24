import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import https from "https";
import crypto from "crypto";
import { logger } from "./logger.js";
import { FMServerVersion, parseServerVersion, isFeatureSupported } from "./fm-version.js";

export interface ODataClientConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  /** Authentication method: "basic" (default) or "bearer" (token-based). */
  authType?: "basic" | "bearer";
  /** Bearer token (required when authType === "bearer"). */
  bearerToken?: string;
  timeout?: number;
  verifySsl?: boolean;
}

export interface ODataQueryOptions {
  filter?: string;
  select?: string;
  orderby?: string;
  top?: number;
  skip?: number;
  expand?: string;
  count?: boolean;
  /** OData $apply expression for server-side aggregation (FileMaker Server v22.0.1+ / FileMaker 2025+) */
  apply?: string;
}

export interface ODataResponse<T = any> {
  "@odata.context": string;
  "@odata.count"?: number;
  "@odata.nextLink"?: string;
  value: T[];
}

export interface ODataError {
  error: {
    code: string;
    message: string;
  };
}

/**
 * Result of a single operation within a batch.
 */
export interface BatchItemResult {
  index: number;
  ok: boolean;
  data?: any;
  error?: string;
}

/**
 * Result of a batch operation (bulk create/update/delete).
 */
export interface BatchResult {
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    strategy: "batch" | "parallel";
    atomic: boolean;
  };
  results: BatchItemResult[];
}

/**
 * Result of queryAllRecords — all records accumulated across pages.
 */
export interface QueryAllResult<T = any> {
  records: T[];
  summary: {
    totalRecords: number;
    pagesFetched: number;
    pageSize: number;
    truncated: boolean;
    maxRecords: number;
  };
}

/**
 * Result returned by a FileMaker script executed via OData.
 */
export interface ScriptResult {
  /** FileMaker script error code; 0 means success. */
  code: number;
  /** Value passed to Exit Script script step, or null if none. */
  resultParameter: string | null;
}

/**
 * Field definition for FileMaker schema operations (FileMaker_Tables endpoint).
 * `type` is a SQL-style type string: NUMERIC, DECIMAL, INT, DATE, TIME, TIMESTAMP,
 * VARCHAR(n), BLOB, etc. Repetitions are specified in brackets (e.g. "INT[4]").
 */
export interface FMFieldDefinition {
  name: string;
  type: string;
  primary?: boolean;
  unique?: boolean;
  nullable?: boolean;
  global?: boolean;
  default?: string;
  externalSecurePath?: string;
}

export interface FMTableDefinition {
  tableName: string;
  fields: FMFieldDefinition[];
}

/**
 * Media types FileMaker Server's OData endpoint documents for container
 * uploads. Uploads outside this list may be rejected server-side.
 */
export const SUPPORTED_CONTAINER_TYPES = [
  "image/gif",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "application/pdf",
] as const;

/**
 * Result of a container upload (base64 or binary mode).
 */
export interface ContainerUploadResult {
  sizeBytes: number;
  /** MIME type inferred from magic bytes, or null when unrecognized. */
  detectedMime: string | null;
}

/**
 * Result of a container download — raw bytes wrapped in base64 so the
 * payload is safe for JSON-RPC transport.
 */
export interface ContainerDownloadResult {
  base64Data: string;
  contentType: string;
  sizeBytes: number;
  filename?: string;
}

/**
 * Result of a raw `/{field}/$value` read.
 */
export interface FieldValueResult {
  /** Decoded text value, or null for empty/binary fields. */
  value: string | null;
  contentType: string;
  /** True when the response media type indicates container/binary data. */
  isBinaryContainer: boolean;
}

/**
 * Normalize user-supplied base64 input and decode it.
 *
 * Accepts raw base64 or a `data:<mime>;base64,<data>` URI, tolerates
 * embedded whitespace, and enforces canonical padding so corrupt input is
 * rejected before it reaches the server.
 */
export function normalizeAndValidateBase64(input: string): {
  cleanBase64: string;
  buffer: Buffer;
} {
  let s = String(input ?? "").trim();
  if (s.startsWith("data:")) {
    const marker = s.indexOf(";base64,");
    if (marker !== -1) {
      s = s.substring(marker + ";base64,".length);
    }
  }
  const cleanBase64 = s.replace(/[\r\n\s]+/g, "");
  if (
    cleanBase64.length === 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(cleanBase64) ||
    cleanBase64.length % 4 !== 0
  ) {
    throw new Error(
      "Invalid base64 data: input is empty or contains non-base64 characters / invalid padding"
    );
  }
  const buffer = Buffer.from(cleanBase64, "base64");
  if (buffer.length === 0) {
    throw new Error("Invalid base64 data: decoded buffer is empty");
  }
  return { cleanBase64, buffer };
}

/**
 * Detect the container media type from magic bytes, mirroring the
 * signatures FileMaker Server itself inspects for base64 uploads.
 */
export function detectContainerMimeFromBytes(buf: Buffer): string | null {
  if (buf.length >= 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return "image/gif"; // GIF8
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 4 &&
    ((buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00) ||
      (buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a))
  ) {
    return "image/tiff"; // II*\x00 (LE) or MM\x00* (BE)
  }
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return "application/pdf"; // %PDF
  }
  return null;
}

/**
 * Validate a string destined for an HTTP header value (filename, MIME
 * type). Rejects empty values and CR/LF/NUL characters to prevent header
 * injection.
 */
export function sanitizeHeaderValue(value: string, label: string): string {
  const v = String(value ?? "");
  if (v.trim().length === 0 || /[\r\n\0]/.test(v)) {
    throw new Error(
      `Invalid ${label}: must be non-empty and must not contain CR/LF/null characters`
    );
  }
  return v.trim();
}

/**
 * Build an RFC 6266-style `Content-Disposition: inline; filename=...`
 * header value, quoting/escaping when the filename is not a bare token.
 */
export function formatContentDisposition(filename: string): string {
  const clean = sanitizeHeaderValue(filename, "filename");
  if (/^[A-Za-z0-9._-]+$/.test(clean)) {
    return `inline; filename=${clean}`;
  }
  const escaped = clean.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `inline; filename="${escaped}"`;
}

/**
 * Extract the filename from a `Content-Disposition` response header.
 * Supports RFC 5987 `filename*=UTF-8''...`, quoted-string, and bare-token
 * forms. Returns undefined when no filename is present.
 */
export function parseContentDispositionFilename(
  header?: string
): string | undefined {
  if (!header) return undefined;

  const ext = /filename\*\s*=\s*UTF-8''([^;\r\n]+)/i.exec(header);
  if (ext) {
    try {
      return decodeURIComponent(ext[1].trim());
    } catch {
      return ext[1].trim();
    }
  }

  const quoted = /filename\s*=\s*"((?:[^"\\]|\\.)*)"/i.exec(header);
  if (quoted) {
    return quoted[1].replace(/\\(.)/g, "$1");
  }

  const token = /filename\s*=\s*([^;\s\r\n]+)/i.exec(header);
  if (token) {
    return token[1].trim();
  }

  return undefined;
}

/**
 * OData Client for FileMaker Server
 * Implements Basic Authentication and OData 4.01 operations
 */
export class ODataClient {
  private axiosInstance: AxiosInstance;
  private config: ODataClientConfig;
  private baseUrl: string;
  /**
   * undefined = not yet fetched; null = fetched but version unparseable.
   * Any other value = cached FM Server version for this session lifetime.
   */
  private _cachedVersion: FMServerVersion | null | undefined = undefined;
  /** Cached metadata XML, kept after the first `getMetadata()` or `getServerVersion()` call. */
  private _cachedMetadata?: string;
  /** Map of field name → FMFID built from cached metadata (v26+ only). */
  private _fieldIdMap?: Map<string, string>;

  constructor(config: ODataClientConfig) {
    this.config = config;
    // Check if server URL already includes the OData path
    if (config.server.endsWith('/fmi/odata/v4')) {
      this.baseUrl = `${config.server}/${config.database}`;
    } else {
      this.baseUrl = `${config.server}/fmi/odata/v4/${config.database}`;
    }
    
    logger.debug(`OData Client initialized with baseUrl: ${this.baseUrl}`);

    this.axiosInstance = axios.create({
      timeout: config.timeout || 30000,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      // Configure SSL certificate verification
      // verifySsl defaults to true for production security
      // Set to false for self-signed certificates (development/local networks)
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.verifySsl !== false, // true by default
        // OpenSSL 3.5+ advertises hybrid post-quantum key shares
        // (X25519MLKEM768) that FileMaker Server's Apache/mod_ssl rejects
        // with SSL alert 50 (decode_error); pin classical curves.
        ecdhCurve: "X25519:P-256:P-384",
        // TLS 1.2 is verified against FileMaker Server; allow opt-in to
        // 1.3 via FM_TLS_MAX_VERSION for servers that handle it.
        maxVersion:
          process.env.FM_TLS_MAX_VERSION === "TLSv1.3" ? "TLSv1.3" : "TLSv1.2",
      }),
    });

    // Add request interceptor for Basic Auth
    this.axiosInstance.interceptors.request.use(
      (config) => {
        config.headers.Authorization = this.getAuthHeader();
        return config;
      },
      (error) => {
        logger.error("Request interceptor error:", error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error("Response error:", error.response?.data || error.message);
        return Promise.reject(this.handleError(error));
      }
    );
  }

  /**
   * Generate Authorization header.
   *
   * When authType is "bearer", sends `Authorization: Bearer <token>` for
   * FileMaker Cloud / OAuth / reverse-proxy setups. Otherwise falls back
   * to Basic Auth with user:password.
   */
  private getAuthHeader(): string {
    if (this.config.authType === "bearer" && this.config.bearerToken) {
      return `Bearer ${this.config.bearerToken}`;
    }
    const credentials = Buffer.from(
      `${this.config.user}:${this.config.password}`
    ).toString("base64");
    return `Basic ${credentials}`;
  }

  /**
   * Handle and format errors
   */
  private handleError(error: any): Error {
    if (error.response) {
      // When a request used responseType: "arraybuffer" (/$value reads),
      // error payloads arrive as Buffer/ArrayBuffer rather than parsed JSON.
      // Decode UTF-8 and attempt JSON.parse so OData error codes surface.
      let responseData = error.response.data;
      if (Buffer.isBuffer(responseData) || responseData instanceof ArrayBuffer) {
        try {
          const text = Buffer.from(responseData as any).toString("utf-8");
          responseData = JSON.parse(text);
        } catch {
          // Leave responseData as-is; fall through to HTTP status error below
        }
      }
      const odataError = responseData as ODataError;
      if (odataError?.error) {
        return new Error(
          `OData Error [${odataError.error.code}]: ${odataError.error.message}`
        );
      }
      return new Error(
        `HTTP ${error.response.status}: ${error.response.statusText}`
      );
    }
    if (error.request) {
      const detail = error.message ? ` (${error.message})` : "";
      return new Error(`No response from server - connection failed${detail}`);
    }
    return error;
  }

  /**
   * Build an entity-key segment for an OData URL.
   *
   * OData distinguishes string keys `Entity('abc')` from numeric keys `Entity(42)`.
   * FileMaker Server exposes entity keys as numeric (Edm.Int64); sending a quoted
   * string fails with error 8309 "An expression contains incompatible data types".
   * We emit the unquoted form for purely numeric record IDs, and properly escape
   * apostrophes for string-key paths.
   */
  private entityKey(recordId: string | number): string {
    const rid = String(recordId);
    return /^-?\d+$/.test(rid) ? `(${rid})` : `('${rid.replace(/'/g, "''")}')`;
  }

  /**
   * Encode a field name for use as an OData URL path segment in
   * `/{table}({id})/{field}/$value` style URLs.
   *
   * Spaces and Unicode are percent-encoded, while `:` (FMFID:12345 field
   * IDs) and `[`/`]` (repetition index, when the caller already embedded
   * it, e.g. `Field[2]`) stay literal. An optional 1-based `repetition`
   * index is appended as `[n]` unless the field already ends with `]`.
   */
  private encodeFieldSegment(field: string, repetition?: number): string {
    if (!field || field.includes("/")) {
      throw new Error(
        `Invalid field name "${field}": must be non-empty and must not contain '/'`
      );
    }
    const encoded = encodeURIComponent(field)
      .replace(/%3A/gi, ":")
      .replace(/%5B/gi, "[")
      .replace(/%5D/gi, "]");
    if (repetition === undefined) {
      return encoded;
    }
    if (!Number.isInteger(repetition) || repetition < 1) {
      throw new Error(
        `Invalid repetition "${repetition}": must be an integer >= 1`
      );
    }
    return encoded.endsWith("]") ? encoded : `${encoded}[${repetition}]`;
  }

  /**
   * Encode a value for an OData query-string parameter.
   *
   * `URLSearchParams.toString()` follows the form-urlencoded serializer, which
   * encodes spaces as `+` and the literal `$` prefix on system options as `%24`.
   * FileMaker's OData parser rejects both forms (`+` -> -1002 syntax error,
   * `%24` -> system option silently ignored). We use `encodeURIComponent`
   * (spaces -> %20, single quotes -> %27) and keep commas literal because
   * commas are valid in `$select` / `$orderby` and FileMaker rejects `%2C`.
   */
  private odataEncode(v: string): string {
    return encodeURIComponent(v).replace(/%2C/gi, ",");
  }

  /**
   * Normalize identifiers in an OData $filter expression.
   *
   * The OData 4.01 specification requires that property names containing
   * non-ASCII characters (e.g. CJK ideographs like `位置`) or spaces be
   * enclosed in double-quotes. FileMaker Server returns error 8310
   * ("internal data formatting error") when unquoted non-ASCII identifiers
   * are used in $filter.
   *
   * This method tokenizes the filter expression and wraps any unquoted
   * identifier that contains non-ASCII characters or unescaped spaces in
   * double-quotes so the caller does not need to know about this rule.
   *
   * Tokens that are already correctly formed are left untouched:
   *   - String literals: 'value'
   *   - Already-quoted identifiers: "位置"
   *   - OData keywords: eq, ne, gt, ge, lt, le, and, or, not, in, has, null, true, false
   *   - Numeric literals: 123, -3.14, 2.5e10
   *   - OData functions, parentheses, commas
   */
  normalizeFilter(filter: string): string {
    // OData comparison/logical operators and constants (case-insensitive match)
    const ODATA_KEYWORDS = new Set([
      "eq", "ne", "gt", "ge", "lt", "le",
      "and", "or", "not", "in", "has",
      "true", "false", "null",
      "asc", "desc",
    ]);

    // v26+: resolve non-ASCII identifiers to FMFID when available.
    const useFieldIds =
      this._fieldIdMap !== undefined &&
      this._cachedVersion !== undefined &&
      this._cachedVersion !== null &&
      isFeatureSupported(this._cachedVersion, "field_id_in_metadata");

    // Tokenize: respect string literals ('...'), quoted identifiers ("..."
    // optionally followed by /path segments for cast expressions),
    // numbers, operators, parentheses, commas, and bare identifiers.
    const tokenRegex =
      /'(?:[^']|'')*'|"(?:[^"\\]|\\.)*"(?:\/[^\s(),'"]+)?|[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|[(),]|[^\s(),'"]+/g;

    const tokens: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(filter)) !== null) {
      let token = match[0];

      // Skip string literals, already-quoted identifiers, numbers, punctuation
      if (
        token.startsWith("'") ||         // string literal
        token.startsWith('"') ||         // already-quoted identifier
        /^[-+]?\d/.test(token) ||        // numeric literal
        /^[(),]$/.test(token)            // punctuation
      ) {
        tokens.push(token);
        continue;
      }

      // Skip OData keywords (case-insensitive)
      if (ODATA_KEYWORDS.has(token.toLowerCase())) {
        tokens.push(token);
        continue;
      }

      // Skip OData function names (token ends with '(' or next non-space is '(')
      // Functions like contains(), startswith(), endswith(), etc. are ASCII-only
      // and handled fine without quoting.

      // v26+ field-ID resolution: if the token contains non-ASCII characters,
      // try to substitute with its FMFID. Fall back to auto-quoting when not found.
      // eslint-disable-next-line no-control-regex
      const hasNonAscii = /[^\x00-\x7F]/.test(token);
      if (hasNonAscii && useFieldIds && this._fieldIdMap) {
        const fmfid = this._fieldIdMap.get(token);
        if (fmfid) {
          token = fmfid; // e.g. "FMFID:60130607233"
          tokens.push(token);
          continue;
        }
      }

      // If the token contains non-ASCII characters, wrap in double-quotes
      if (hasNonAscii) {
        token = `"${token}"`;
      }

      tokens.push(token);
    }

    return tokens.join(" ");
  }

  /**
   * Build OData URL with query options
   */
  private buildUrl(table: string, options?: ODataQueryOptions, recordId?: string): string {
    let url = `${this.baseUrl}/${table}`;

    if (recordId !== undefined && recordId !== null && recordId !== "") {
      url += this.entityKey(recordId);
    }

    if (options) {
      const parts: string[] = [];
      const add = (k: string, v: string) => parts.push(`${k}=${this.odataEncode(v)}`);

      if (options.apply) add("$apply", options.apply);
      if (options.filter) add("$filter", this.normalizeFilter(options.filter));
      if (options.select) add("$select", options.select);
      if (options.orderby) add("$orderby", options.orderby);
      if (options.top !== undefined) parts.push(`$top=${options.top}`);
      if (options.skip !== undefined) parts.push(`$skip=${options.skip}`);
      if (options.expand) add("$expand", options.expand);
      if (options.count) parts.push(`$count=true`);

      if (parts.length) {
        url += `?${parts.join("&")}`;
      }
    }

    return url;
  }

  /**
   * Get service document
   */
  async getServiceDocument(): Promise<any> {
    logger.debug(`Getting service document from ${this.baseUrl}`);
    const response = await this.axiosInstance.get(this.baseUrl);
    return response.data;
  }

  /**
   * Get metadata document
   */
  async getMetadata(): Promise<string> {
    if (this._cachedMetadata !== undefined) {
      return this._cachedMetadata;
    }
    logger.debug(`Getting metadata from ${this.baseUrl}/$metadata`);
    const response = await this.axiosInstance.get(`${this.baseUrl}/$metadata`, {
      headers: {
        Accept: "application/xml",
      },
    });
    this._cachedMetadata = String(response.data);
    return this._cachedMetadata;
  }

  /**
   * Return the FileMaker Server version for this session.
   *
   * Lazy — fetches $metadata on the first call, then caches the result for the
   * lifetime of the ODataClient instance. Subsequent calls are free.
   * Returns null if the version cannot be determined from the XML.
   */
  async getServerVersion(): Promise<FMServerVersion | null> {
    if (this._cachedVersion !== undefined) {
      return this._cachedVersion;
    }
    try {
      const xml = await this.getMetadata();
      this._cachedMetadata = xml;
      this._cachedVersion = parseServerVersion(xml);
      this._fieldIdMap = undefined; // force rebuild now that version is known
      this._buildFieldIdMap();
    } catch {
      this._cachedVersion = null;
    }
    return this._cachedVersion;
  }

  /**
   * Invalidate the cached $metadata, parsed server version, and FMFID map.
   * Must be called after any schema mutation (create/delete table/field/index)
   * so subsequent getMetadata()/getServerVersion() calls re-fetch fresh XML.
   */
  invalidateMetadataCache(): void {
    this._cachedMetadata = undefined;
    this._cachedVersion = undefined;
    this._fieldIdMap = undefined;
  }

  /**
   * Query records from a table
   */
  async queryRecords<T = any>(
    table: string,
    options?: ODataQueryOptions
  ): Promise<ODataResponse<T>> {
    const url = this.buildUrl(table, options);
    logger.debug(`Querying records: ${url}`);
    const response = await this.axiosInstance.get<ODataResponse<T>>(url);
    return response.data;
  }

  /**
   * Query all matching records, automatically following @odata.nextLink
   * pagination until all records are retrieved or maxRecords is reached.
   *
   * Falls back to $skip-based pagination when the server does not emit
   * @odata.nextLink (e.g., when the result set fits in one page).
   *
   * @param table       Table/entity set name
   * @param options     Standard OData query options (filter, select, orderby, expand)
   * @param pageSize    Records per page (default: 100). Uses Prefer: odata.maxpagesize header.
   * @param maxRecords  Safety cap on total records returned (default: 10000).
   *                    Hard-capped at 50,000 regardless of this value.
   */
  async queryAllRecords<T = any>(
    table: string,
    options?: ODataQueryOptions,
    pageSize: number = 100,
    maxRecords: number = 10000
  ): Promise<QueryAllResult<T>> {
    const HARD_CAP = 50000;
    const effectiveMax = Math.min(maxRecords, HARD_CAP);
    const allRecords: T[] = [];
    let pagesFetched = 0;
    let truncated = false;

    // First request — use $top to control page size and Prefer header
    const firstUrl = this.buildUrl(table, { ...options, top: pageSize });
    logger.debug(`queryAllRecords: first page ${firstUrl} (pageSize=${pageSize}, maxRecords=${effectiveMax})`);

    let response = await this.axiosInstance.get<ODataResponse<T>>(firstUrl, {
      headers: { Prefer: `odata.maxpagesize=${pageSize}` },
    });
    pagesFetched++;

    let nextLink: string | undefined = response.data["@odata.nextLink"];
    allRecords.push(...(response.data.value || []));

    // Follow @odata.nextLink (Approach A) — server-driven paging
    while (nextLink && allRecords.length < effectiveMax) {
      // Handle relative URLs by prepending the base server URL
      const fullUrl = nextLink.startsWith("http")
        ? nextLink
        : `${this.config.server}${nextLink}`;

      logger.debug(`queryAllRecords: following nextLink (page ${pagesFetched + 1})`);
      response = await this.axiosInstance.get<ODataResponse<T>>(fullUrl, {
        headers: { Prefer: `odata.maxpagesize=${pageSize}` },
      });
      pagesFetched++;
      allRecords.push(...(response.data.value || []));
      nextLink = response.data["@odata.nextLink"];
    }

    // Fallback: $skip-based pagination (Approach B) when no @odata.nextLink
    // and the first page was full (more records likely exist)
    if (!nextLink && allRecords.length === pageSize && allRecords.length < effectiveMax) {
      logger.debug(`queryAllRecords: no @odata.nextLink, falling back to $skip pagination`);
      let skip = pageSize;

      while (allRecords.length < effectiveMax) {
        const pageUrl = this.buildUrl(table, { ...options, top: pageSize, skip });
        logger.debug(`queryAllRecords: $skip page (skip=${skip})`);
        response = await this.axiosInstance.get<ODataResponse<T>>(pageUrl, {
          headers: { Prefer: `odata.maxpagesize=${pageSize}` },
        });
        pagesFetched++;
        const pageRecords = response.data.value || [];

        if (pageRecords.length === 0) break; // no more records
        allRecords.push(...pageRecords);

        if (pageRecords.length < pageSize) break; // last page
        skip += pageSize;
      }
    }

    // Truncate if we exceeded maxRecords
    if (allRecords.length > effectiveMax) {
      allRecords.length = effectiveMax;
      truncated = true;
    }

    return {
      records: allRecords,
      summary: {
        totalRecords: allRecords.length,
        pagesFetched,
        pageSize,
        truncated,
        maxRecords: effectiveMax,
      },
    };
  }

  /**
   * Get a single record by ID
   */
  async getRecord<T = any>(
    table: string,
    recordId: string,
    options?: Pick<ODataQueryOptions, "select" | "expand">
  ): Promise<T> {
    const url = this.buildUrl(table, options, recordId);
    logger.debug(`Getting record: ${url}`);
    const response = await this.axiosInstance.get<T>(url);
    return response.data;
  }

  /**
   * Create a new record
   */
  async createRecord<T = any>(
    table: string,
    data: Partial<T>
  ): Promise<T> {
    const url = `${this.baseUrl}/${table}`;
    logger.debug(`Creating record in ${table}`);
    const response = await this.axiosInstance.post<T>(url, data);
    return response.data;
  }

  /**
   * Update an existing record
   */
  async updateRecord<T = any>(
    table: string,
    recordId: string,
    data: Partial<T>
  ): Promise<void> {
    const url = `${this.baseUrl}/${table}${this.entityKey(recordId)}`;
    logger.debug(`Updating record: ${url}`);
    await this.axiosInstance.patch(url, data);
  }

  /**
   * Delete a record
   */
  async deleteRecord(table: string, recordId: string): Promise<void> {
    const url = `${this.baseUrl}/${table}${this.entityKey(recordId)}`;
    logger.debug(`Deleting record: ${url}`);
    await this.axiosInstance.delete(url);
  }

  // -------------------------------------------------------------------------
  // Container & Field Value Operations (Plan 018)
  // -------------------------------------------------------------------------

  /**
   * Upload container content inline as base64 inside a JSON PATCH body.
   *
   * FileMaker-specific OData extension: the base64 value is accompanied by
   * `<field>@com.filemaker.odata.Filename` and
   * `<field>@com.filemaker.odata.ContentType` annotation properties.
   * FileMaker infers the media type from the first bytes of the decoded
   * data — callers can compare `detectedMime` (magic-byte sniff on the
   * client side) with the declared `contentType` and fall back to
   * {@link uploadContainerBinary} when the types disagree.
   */
  async uploadContainerBase64(
    table: string,
    recordId: string,
    field: string,
    base64Data: string,
    filename: string,
    contentType: string
  ): Promise<ContainerUploadResult> {
    if (!field) {
      throw new Error("Invalid field name: must be non-empty");
    }
    const safeFilename = sanitizeHeaderValue(filename, "filename");
    const safeContentType = sanitizeHeaderValue(contentType, "contentType");
    const { cleanBase64, buffer } = normalizeAndValidateBase64(base64Data);
    const detectedMime = detectContainerMimeFromBytes(buffer);

    const payload: Record<string, string> = {
      [field]: cleanBase64,
      [`${field}@com.filemaker.odata.Filename`]: safeFilename,
      [`${field}@com.filemaker.odata.ContentType`]: safeContentType,
    };

    const url = `${this.baseUrl}/${encodeURIComponent(table).replace(/%3A/gi, ":")}${this.entityKey(recordId)}`;
    logger.debug(`Uploading container (base64): ${url} field=${field} (${buffer.length} bytes)`);
    await this.axiosInstance.patch(url, payload);

    return { sizeBytes: buffer.length, detectedMime };
  }

  /**
   * Upload container content as a raw binary body.
   *
   * `PATCH /{table}({id})/{field}` with `Content-Type`, `Content-Disposition`,
   * and `OData-Version` headers. Use this when FileMaker's magic-byte
   * inference misidentifies a base64 upload — the explicit `Content-Type`
   * header wins. Repetition index is NOT supported on upload by FileMaker
   * OData.
   */
  async uploadContainerBinary(
    table: string,
    recordId: string,
    field: string,
    binaryData: Buffer | Uint8Array,
    filename: string,
    contentType: string
  ): Promise<{ sizeBytes: number }> {
    if (binaryData.byteLength === 0) {
      throw new Error("Invalid binary data: buffer is empty");
    }
    const safeContentType = sanitizeHeaderValue(contentType, "contentType");
    const disposition = formatContentDisposition(filename);

    const url = `${this.baseUrl}/${encodeURIComponent(table).replace(/%3A/gi, ":")}${this.entityKey(recordId)}/${this.encodeFieldSegment(field)}`;
    logger.debug(`Uploading container (binary): ${url} (${binaryData.byteLength} bytes)`);
    await this.axiosInstance.patch(url, Buffer.from(binaryData), {
      headers: {
        "Content-Type": safeContentType,
        "Content-Disposition": disposition,
        "OData-Version": "4.0",
        "OData-MaxVersion": "4.0",
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    return { sizeBytes: binaryData.byteLength };
  }

  /**
   * Download raw bytes from a container field via `/{field}/$value`.
   *
   * Container fields are excluded from normal record responses, so this is
   * the only way to read them. Bytes are wrapped in base64 for JSON-RPC
   * safety. `contentType` comes from the response header, falling back to
   * magic-byte detection when the server reports
   * `application/octet-stream` (or omits the header).
   */
  async downloadContainer(
    table: string,
    recordId: string,
    field: string,
    repetition?: number
  ): Promise<ContainerDownloadResult> {
    const url = `${this.baseUrl}/${encodeURIComponent(table).replace(/%3A/gi, ":")}${this.entityKey(recordId)}/${this.encodeFieldSegment(field, repetition)}/$value`;
    logger.debug(`Downloading container: ${url}`);
    const response = await this.axiosInstance.get(url, {
      responseType: "arraybuffer",
      headers: { Accept: "*/*" },
      maxContentLength: Infinity,
    });

    const buf = Buffer.from(response.data ?? []);
    const headerType = response.headers?.["content-type"];
    let contentType = headerType
      ? String(headerType).split(";")[0].trim().toLowerCase()
      : "";
    if (!contentType || contentType === "application/octet-stream") {
      contentType =
        detectContainerMimeFromBytes(buf) ??
        (contentType || "application/octet-stream");
    }
    const filename = parseContentDispositionFilename(
      response.headers?.["content-disposition"]
    );

    return {
      base64Data: buf.toString("base64"),
      contentType,
      sizeBytes: buf.length,
      ...(filename ? { filename } : {}),
    };
  }

  /**
   * Read the raw value of a single field via `/{field}/$value`.
   *
   * Scalar fields come back as `text/plain` (HTTP 204 when empty/null).
   * Container fields return binary media types — those are reported via
   * `isBinaryContainer` so callers can redirect to
   * {@link downloadContainer} instead of decoding them as text.
   */
  async getFieldValue(
    table: string,
    recordId: string,
    field: string,
    repetition?: number
  ): Promise<FieldValueResult> {
    const url = `${this.baseUrl}/${encodeURIComponent(table).replace(/%3A/gi, ":")}${this.entityKey(recordId)}/${this.encodeFieldSegment(field, repetition)}/$value`;
    logger.debug(`Getting field value: ${url}`);
    const response = await this.axiosInstance.get(url, {
      responseType: "arraybuffer",
      headers: { Accept: "text/plain, */*" },
    });

    const headerType = response.headers?.["content-type"];
    const contentType = headerType
      ? String(headerType).split(";")[0].trim().toLowerCase()
      : "text/plain";
    const isBinaryContainer =
      contentType.startsWith("image/") ||
      contentType === "application/pdf" ||
      contentType === "application/octet-stream";

    if (response.status === 204) {
      return { value: null, contentType, isBinaryContainer: false };
    }
    if (isBinaryContainer) {
      return { value: null, contentType, isBinaryContainer: true };
    }

    const value = Buffer.from(response.data ?? []).toString("utf-8");
    return { value, contentType, isBinaryContainer: false };
  }

  // -------------------------------------------------------------------------
  // Batch / bulk operations (Plan 013)
  // -------------------------------------------------------------------------

  /**
   * Result of a single operation within a batch.
   */
  async batchCreateRecords(
    table: string,
    records: any[],
    strategy: "batch" | "parallel" = "batch"
  ): Promise<BatchResult> {
    if (strategy === "batch") {
      try {
        return await this._batchViaODataBatch(
          records.map((data, i) => ({
            method: "POST" as const,
            url: `${this.baseUrl}/${table}`,
            body: data,
            index: i,
          }))
        );
      } catch (error: any) {
        logger.debug(`$batch failed (${error.message}), falling back to parallel`);
        return await this._batchViaParallel(
          records.map((data, i) => ({
            fn: () => this.createRecord(table, data),
            index: i,
          }))
        );
      }
    }
    return await this._batchViaParallel(
      records.map((data, i) => ({
        fn: () => this.createRecord(table, data),
        index: i,
      }))
    );
  }

  async batchUpdateRecords(
    table: string,
    updates: { recordId: string; data: any }[],
    strategy: "batch" | "parallel" = "batch"
  ): Promise<BatchResult> {
    if (strategy === "batch") {
      try {
        return await this._batchViaODataBatch(
          updates.map((u, i) => ({
            method: "PATCH" as const,
            url: `${this.baseUrl}/${table}${this.entityKey(u.recordId)}`,
            body: u.data,
            index: i,
          }))
        );
      } catch (error: any) {
        logger.debug(`$batch failed (${error.message}), falling back to parallel`);
        return await this._batchViaParallel(
          updates.map((u, i) => ({
            fn: () => this.updateRecord(table, u.recordId, u.data).then(() => undefined),
            index: i,
          }))
        );
      }
    }
    return await this._batchViaParallel(
      updates.map((u, i) => ({
        fn: () => this.updateRecord(table, u.recordId, u.data).then(() => undefined),
        index: i,
      }))
    );
  }

  async batchDeleteRecords(
    table: string,
    recordIds: string[],
    strategy: "batch" | "parallel" = "batch"
  ): Promise<BatchResult> {
    if (strategy === "batch") {
      try {
        return await this._batchViaODataBatch(
          recordIds.map((id, i) => ({
            method: "DELETE" as const,
            url: `${this.baseUrl}/${table}${this.entityKey(id)}`,
            body: undefined,
            index: i,
          }))
        );
      } catch (error: any) {
        logger.debug(`$batch failed (${error.message}), falling back to parallel`);
        return await this._batchViaParallel(
          recordIds.map((id, i) => ({
            fn: () => this.deleteRecord(table, id).then(() => undefined),
            index: i,
          }))
        );
      }
    }
    return await this._batchViaParallel(
      recordIds.map((id, i) => ({
        fn: () => this.deleteRecord(table, id).then(() => undefined),
        index: i,
      }))
    );
  }

  /**
   * Send operations as a real OData `$batch` (multipart/mixed) request.
   *
   * All operations are placed in a single changeset (atomic). If the server
   * rejects the batch or returns an HTTP error, the caller falls back to
   * the parallel strategy.
   */
  private async _batchViaODataBatch(
    ops: { method: string; url: string; body?: any; index: number }[]
  ): Promise<BatchResult> {
    const boundary = `batch_${crypto.randomUUID()}`;
    const changesetBoundary = `changeset_${crypto.randomUUID()}`;

    // Build multipart/mixed body — changeset first (defensive against the
    // FileMaker GET-before-changeset ordering bug).
    // MIME requires CRLF line endings and blank lines between headers and content.
    // FileMaker requires relative URLs in batch sub-requests (not absolute).
    const lines: string[] = [];

    // Open batch part containing the changeset
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: multipart/mixed; boundary=${changesetBoundary}`);
    lines.push(""); // blank line: end of part headers, start of part body

    for (const op of ops) {
      // Convert absolute URL to relative path for FileMaker compatibility
      const url = new URL(op.url);
      const relativeUrl = url.pathname + url.search;

      lines.push(`--${changesetBoundary}`);
      lines.push("Content-Type: application/http");
      lines.push("Content-Transfer-Encoding: binary");
      lines.push(""); // blank line: end of sub-part headers, start of HTTP request
      lines.push(`${op.method} ${relativeUrl} HTTP/1.1`);
      lines.push("Content-Type: application/json");
      // Note: FileMaker's $batch always returns 204 No Content for POST/PATCH
      // (ignores Prefer: return=representation). Created record IDs are NOT
      // available in the $batch response. Use strategy: "parallel" when you
      // need the created record IDs back.
      if (op.body !== undefined) {
        const bodyStr = JSON.stringify(op.body);
        lines.push(`Content-Length: ${Buffer.byteLength(bodyStr)}`);
        lines.push(""); // blank line: end of HTTP headers, start of body
        lines.push(bodyStr);
      } else {
        lines.push("Content-Length: 0");
        lines.push(""); // blank line: end of HTTP headers
      }
    }

    // Close changeset — no blank line before batch closing boundary
    lines.push(`--${changesetBoundary}--`);
    lines.push(`--${boundary}--`);

    const body = lines.join("\r\n");
    const batchUrl = `${this.baseUrl}/$batch`;

    logger.debug(`Sending $batch request to ${batchUrl} (${ops.length} operations)`);

    const response = await this.axiosInstance.post(batchUrl, body, {
      headers: {
        "Content-Type": `multipart/mixed; boundary=${boundary}`,
        "OData-Version": "4.0",
        "OData-MaxVersion": "4.0",
      },
    });

    return this._parseBatchResponse(response.data, ops.length);
  }

  /**
   * Send operations as parallel individual HTTP requests (fallback).
   *
   * Non-atomic: each operation succeeds or fails independently.
   */
  private async _batchViaParallel(
    ops: { fn: () => Promise<any>; index: number }[]
  ): Promise<BatchResult> {
    const results = await Promise.allSettled(
      ops.map((op) => op.fn())
    );

    const batchResults: BatchItemResult[] = ops.map((op, i) => {
      const r = results[i];
      if (r.status === "fulfilled") {
        return { index: op.index, ok: true, data: r.value };
      }
      return {
        index: op.index,
        ok: false,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      };
    });

    return this._buildBatchResult(batchResults, "parallel", false);
  }

  /**
   * Parse a multipart/mixed $batch response.
   *
   * The response is a multipart MIME document where each part contains
   * an HTTP response (status line + headers + body) for one operation.
   */
  private _parseBatchResponse(responseData: any, expectedCount: number): BatchResult {
    const responseText = typeof responseData === "string" ? responseData : String(responseData);
    const batchResults: BatchItemResult[] = [];

    // Split on MIME boundaries. The response uses the same boundary we sent
    // or a new one from the server's Content-Type header.
    // We look for HTTP status lines within each part.
    const partRegex = /HTTP\/1\.1 (\d+) ([^\r\n]*)[\r\n]+([\s\S]*?)(?=(?:\r\n)?--|\z)/g;
    let match: RegExpExecArray | null;
    let partIndex = 0;

    while ((match = partRegex.exec(responseText)) !== null) {
      const status = parseInt(match[1], 10);
      const body = match[3].trim();

      if (status >= 200 && status < 300) {
        let parsedData: any = undefined;
        try {
          // Try to extract JSON body (skip headers)
          const jsonStart = body.indexOf("{");
          if (jsonStart !== -1) {
            parsedData = JSON.parse(body.substring(jsonStart));
          }
        } catch {
          // Non-JSON body (e.g., empty 204 for DELETE) — leave data undefined
        }
        batchResults.push({ index: partIndex, ok: true, data: parsedData });
      } else {
        let errorMsg = `HTTP ${status}: ${match[2]}`;
        try {
          const jsonStart = body.indexOf("{");
          if (jsonStart !== -1) {
            const errorJson = JSON.parse(body.substring(jsonStart));
            if (errorJson?.error?.message) {
              errorMsg = errorJson.error.message;
            }
          }
        } catch {
          // Keep the status-line error message
        }
        batchResults.push({ index: partIndex, ok: false, error: errorMsg });
      }
      partIndex++;
    }

    // If we couldn't parse any parts, treat as a total failure
    if (batchResults.length === 0) {
      return {
        summary: {
          total: expectedCount,
          succeeded: 0,
          failed: expectedCount,
          strategy: "batch",
          atomic: true,
        },
        results: Array.from({ length: expectedCount }, (_, i) => ({
          index: i,
          ok: false,
          error: "Failed to parse batch response",
        })),
      };
    }

    return this._buildBatchResult(batchResults, "batch", true);
  }

  private _buildBatchResult(
    results: BatchItemResult[],
    strategy: string,
    atomic: boolean
  ): BatchResult {
    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.length - succeeded;
    return {
      summary: {
        total: results.length,
        succeeded,
        failed,
        strategy: strategy as "batch" | "parallel",
        atomic,
      },
      results,
    };
  }

  /**
   * Count records
   *
   * Builds the query string manually so `$filter` stays literal (not `%24filter`)
   * and spaces are `%20`-encoded (not `+`). axios `{ params }` delegates to
   * URLSearchParams which trips FileMaker's strict OData parser. See odataEncode.
   */
  async countRecords(table: string, filter?: string): Promise<number> {
    let url = `${this.baseUrl}/${table}/$count`;
    if (filter) {
      url += `?$filter=${this.odataEncode(this.normalizeFilter(filter))}`;
    }
    logger.debug(`Counting records: ${url}`);
    const response = await this.axiosInstance.get<number>(url);
    return response.data;
  }

  /**
   * Aggregate records using OData $apply (FileMaker Server v22.0.1+ / FileMaker 2025+)
   *
   * Sends a GET request with `?$apply=<expression>` to the entity set.
   * The expression is built by the caller (or via ODataParser.buildApplyExpression)
   * and supports groupby(), aggregate(), and filter() transformations.
   */
  async aggregateRecords(table: string, applyExpression: string): Promise<any> {
    const url = this.buildUrl(table, { apply: applyExpression });
    logger.debug(`Aggregating records: ${url}`);
    const response = await this.axiosInstance.get(url);
    return response.data;
  }

  /**
   * Create a new table via the FileMaker_Tables system endpoint.
   * Proprietary FileMaker OData schema extension (DDL).
   */
  async createTable(definition: FMTableDefinition): Promise<any> {
    const url = `${this.baseUrl}/FileMaker_Tables`;
    logger.debug(`Creating table: ${definition.tableName}`);
    const response = await this.axiosInstance.post(url, definition);
    return response.data;
  }

  /**
   * Add fields to an existing table via PATCH on FileMaker_Tables/{table}.
   */
  async addFields(table: string, fields: FMFieldDefinition[]): Promise<any> {
    const url = `${this.baseUrl}/FileMaker_Tables/${encodeURIComponent(table)}`;
    logger.debug(`Adding ${fields.length} field(s) to table: ${table}`);
    const response = await this.axiosInstance.patch(url, { fields });
    return response.data;
  }

  /**
   * Delete a table and ALL its records via DELETE on FileMaker_Tables/{table}.
   * Destructive and irreversible — callers must guard with explicit confirmation.
   */
  async deleteTable(table: string): Promise<void> {
    const url = `${this.baseUrl}/FileMaker_Tables/${encodeURIComponent(table)}`;
    logger.debug(`Deleting table: ${table}`);
    await this.axiosInstance.delete(url);
  }

  /**
   * Delete a field from a table via DELETE on FileMaker_Tables/{table}/{field}.
   * Destructive and irreversible — callers must guard with explicit confirmation.
   */
  async deleteField(table: string, field: string): Promise<void> {
    const url = `${this.baseUrl}/FileMaker_Tables/${encodeURIComponent(table)}/${encodeURIComponent(field)}`;
    logger.debug(`Deleting field: ${table}/${field}`);
    await this.axiosInstance.delete(url);
  }

  /**
   * Create an index on a field via POST on FileMaker_Indexes/{table}.
   */
  async createIndex(table: string, fieldName: string): Promise<any> {
    const url = `${this.baseUrl}/FileMaker_Indexes/${encodeURIComponent(table)}`;
    logger.debug(`Creating index on ${table}.${fieldName}`);
    const response = await this.axiosInstance.post(url, { indexName: fieldName });
    return response.data;
  }

  /**
   * Delete an index via DELETE on FileMaker_Indexes/{table}/{field}.
   */
  async deleteIndex(table: string, field: string): Promise<void> {
    const url = `${this.baseUrl}/FileMaker_Indexes/${encodeURIComponent(table)}/${encodeURIComponent(field)}`;
    logger.debug(`Deleting index: ${table}/${field}`);
    await this.axiosInstance.delete(url);
  }

  /**
   * Run a FileMaker script by name.
   *
   * Endpoint: POST /database/Script.{scriptName}
   * Body: { "scriptParameterValue": ... }  (omit if no parameter)
   * Response: { "scriptResult": { "code": 0, "resultParameter": "..." } }
   *
   * Script names cannot contain @, &, /, or start with a number.
   */
  async runScript(scriptName: string, scriptParam?: any): Promise<ScriptResult> {
    // URL-encode the script name so spaces, #, ?, %, etc. are safe in the
    // path segment. The "Script." prefix is a literal OData action separator
    // and must NOT be encoded.
    const url = `${this.baseUrl}/Script.${encodeURIComponent(scriptName)}`;
    const body = scriptParam !== undefined ? { scriptParameterValue: scriptParam } : undefined;
    logger.debug(`Running script by name: ${scriptName}`);
    const response = await this.axiosInstance.post(url, body);
    return this.parseScriptResponse(response.data);
  }

  /**
   * Run a FileMaker script by its internal FMSID.
   *
   * Endpoint: POST /database/Script.FMSID:{scriptId}
   * Available on FileMaker Server 2026 (v26+) and some earlier versions.
   * Calling by ID avoids breakage when scripts are renamed.
   */
  async runScriptById(scriptId: number | string, scriptParam?: any): Promise<ScriptResult> {
    const id = String(scriptId);
    if (!/^\d+$/.test(id)) {
      throw new Error(`Invalid scriptId "${scriptId}": FMSID must be numeric`);
    }
    const url = `${this.baseUrl}/Script.FMSID:${id}`;
    const body = scriptParam !== undefined ? { scriptParameterValue: scriptParam } : undefined;
    logger.debug(`Running script by ID: ${scriptId}`);
    const response = await this.axiosInstance.post(url, body);
    return this.parseScriptResponse(response.data);
  }

  /**
   * Extract scriptResult from the OData response payload.
   */
  private parseScriptResponse(data: any): ScriptResult {
    const result = data?.scriptResult;
    if (!result || typeof result.code !== "number") {
      throw new Error("Invalid script response format from server");
    }
    return {
      code: result.code,
      resultParameter: result.resultParameter ?? null,
    };
  }

  /**
   * Build a name → FMFID lookup map from cached metadata.
   * Only populates the map when the server is v26+ (where FMFID annotations
   * appear inside `<Property>` elements). Safe to call repeatedly — it is a
   * no-op once the map is built.
   */
  private _buildFieldIdMap(): void {
    if (this._fieldIdMap !== undefined || !this._cachedMetadata) return;

    // Don't cache anything if the version hasn't been determined yet;
    // getServerVersion() will call us again after parsing the version.
    if (this._cachedVersion === undefined) return;

    if (
      this._cachedVersion === null ||
      !isFeatureSupported(this._cachedVersion, "field_id_in_metadata")
    ) {
      this._fieldIdMap = new Map(); // empty — prevents re-evaluation
      return;
    }

    const map = new Map<string, string>();
    const ambiguous = new Set<string>();
    // Match block-style <Property> elements that contain a FieldID annotation
    const propertyRegex =
      /<Property\s+Name="([^"]+)"\s+Type="[^"]+"[^>]*>[\s\S]*?<Annotation\s+Term="com\.filemaker\.odata\.FieldID"[^>]*String="FMFID:([^"]+)"\s*\/>?[\s\S]*?<\/Property>/g;
    let match;
    while ((match = propertyRegex.exec(this._cachedMetadata)) !== null) {
      const fieldName = match[1];
      const fmfid = `FMFID:${match[2]}`;
      const existing = map.get(fieldName);
      if (existing !== undefined && existing !== fmfid) {
        // Same field name in multiple EntityTypes with different FMFIDs —
        // the map is not table-scoped, so substitution would be ambiguous.
        ambiguous.add(fieldName);
      } else {
        map.set(fieldName, fmfid);
      }
    }
    for (const name of ambiguous) {
      map.delete(name);
      logger.debug(
        `Field "${name}" maps to multiple FMFIDs across tables — ` +
        `falling back to quoted-identifier filtering for this name.`
      );
    }

    this._fieldIdMap = map;
  }

  /**
   * Test connection (returns boolean for backwards compatibility).
   * Prefer `testConnectionDetailed` for callers that want the error message.
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getServiceDocument();
      return true;
    } catch (error) {
      logger.error("Connection test failed:", error);
      return false;
    }
  }

  /**
   * Test connection and return detailed status, including the underlying
   * error message when the connection fails. This avoids hiding useful
   * diagnostics like 401 Unauthorized, SSL verification failures, etc.
   */
  async testConnectionDetailed(): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      await this.getServiceDocument();
      return { ok: true };
    } catch (error: any) {
      const message = error?.message ? String(error.message) : String(error);
      logger.error("Connection test failed:", message);
      return { ok: false, error: message };
    }
  }
}
