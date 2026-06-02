import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import https from "https";
import { logger } from "./logger.js";
import { FMServerVersion, parseServerVersion } from "./fm-version.js";

export interface ODataClientConfig {
  server: string;
  database: string;
  user: string;
  password: string;
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
  value: T[];
}

export interface ODataError {
  error: {
    code: string;
    message: string;
  };
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
   * Generate Basic Auth header
   */
  private getAuthHeader(): string {
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
      const odataError = error.response.data as ODataError;
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
      return new Error("No response from server - connection failed");
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
      if (options.filter) add("$filter", options.filter);
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
    logger.debug(`Getting metadata from ${this.baseUrl}/$metadata`);
    const response = await this.axiosInstance.get(`${this.baseUrl}/$metadata`, {
      headers: {
        Accept: "application/xml",
      },
    });
    return response.data;
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
      this._cachedVersion = parseServerVersion(xml);
    } catch {
      this._cachedVersion = null;
    }
    return this._cachedVersion;
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
      url += `?$filter=${this.odataEncode(filter)}`;
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
   * Execute batch operations
   */
  async batch(operations: BatchOperation[]): Promise<BatchResponse[]> {
    // OData batch implementation
    // This is a simplified version - full batch requires multipart/mixed format
    logger.debug(`Executing batch with ${operations.length} operations`);
    
    const results: BatchResponse[] = [];
    
    for (const op of operations) {
      try {
        let result: any;
        
        switch (op.method) {
          case "GET":
            result = await this.axiosInstance.get(op.url);
            break;
          case "POST":
            result = await this.axiosInstance.post(op.url, op.data);
            break;
          case "PATCH":
            result = await this.axiosInstance.patch(op.url, op.data);
            break;
          case "DELETE":
            result = await this.axiosInstance.delete(op.url);
            break;
          default:
            throw new Error(`Unsupported method: ${op.method}`);
        }
        
        results.push({
          success: true,
          status: result.status,
          data: result.data,
        });
      } catch (error: any) {
        results.push({
          success: false,
          status: error.response?.status || 500,
          error: error.message,
        });
      }
    }
    
    return results;
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

export interface BatchOperation {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  url: string;
  data?: any;
}

export interface BatchResponse {
  success: boolean;
  status: number;
  data?: any;
  error?: string;
}
