import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import https from "https";
import { logger } from "./logger.js";

export interface ODataClientConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  timeout?: number;
}

export interface ODataQueryOptions {
  filter?: string;
  select?: string;
  orderby?: string;
  top?: number;
  skip?: number;
  expand?: string;
  count?: boolean;
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

  constructor(config: ODataClientConfig) {
    this.config = config;
    this.baseUrl = `${config.server}/fmi/odata/v4/${config.database}`;

    this.axiosInstance = axios.create({
      timeout: config.timeout || 30000,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      // Accept self-signed certificates (common in FileMaker Server)
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
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
   * Build OData URL with query options
   */
  private buildUrl(table: string, options?: ODataQueryOptions, recordId?: string): string {
    let url = `${this.baseUrl}/${table}`;
    
    if (recordId) {
      url += `('${recordId}')`;
    }

    if (options) {
      const params = new URLSearchParams();
      
      if (options.filter) params.append("$filter", options.filter);
      if (options.select) params.append("$select", options.select);
      if (options.orderby) params.append("$orderby", options.orderby);
      if (options.top !== undefined) params.append("$top", options.top.toString());
      if (options.skip !== undefined) params.append("$skip", options.skip.toString());
      if (options.expand) params.append("$expand", options.expand);
      if (options.count) params.append("$count", "true");

      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
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
    const url = `${this.baseUrl}/${table}('${recordId}')`;
    logger.debug(`Updating record: ${url}`);
    await this.axiosInstance.patch(url, data);
  }

  /**
   * Delete a record
   */
  async deleteRecord(table: string, recordId: string): Promise<void> {
    const url = `${this.baseUrl}/${table}('${recordId}')`;
    logger.debug(`Deleting record: ${url}`);
    await this.axiosInstance.delete(url);
  }

  /**
   * Count records
   */
  async countRecords(table: string, filter?: string): Promise<number> {
    const url = `${this.baseUrl}/${table}/$count`;
    const params = filter ? { $filter: filter } : undefined;
    logger.debug(`Counting records in ${table}`);
    const response = await this.axiosInstance.get<number>(url, { params });
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
   * Test connection
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
