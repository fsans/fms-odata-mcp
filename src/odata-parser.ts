import { ODataResponse } from "./odata-client.js";

/**
 * OData Response Parser
 * Formats OData responses for MCP tools
 */
export class ODataParser {
  /**
   * Format OData response for MCP tool output
   */
  static formatResponse(data: any, pretty: boolean = true): string {
    if (pretty) {
      return JSON.stringify(data, null, 2);
    }
    return JSON.stringify(data);
  }

  /**
   * Format query response with count information
   *
   * Tolerates responses where `value` is missing. OData collection responses
   * normally have shape `{ value: [...], "@odata.count"?: n }`, but single-entity
   * responses are the bare entity object (no `value` wrapper). Reading
   * `response.value` unconditionally crashed the formatter with
   * "Cannot read properties of undefined (reading 'length')" via
   * createQuerySummary below.
   */
  static formatQueryResponse<T>(
    response: ODataResponse<T>,
    includeContext: boolean = false
  ): string {
    const r = response as any;
    const records: any[] = Array.isArray(r?.value)
      ? r.value
      : (r && typeof r === "object" && !("value" in r))
      ? [r]
      : [];

    const result: any = {
      count: r?.["@odata.count"],
      records,
    };

    if (includeContext) {
      result.context = r?.["@odata.context"];
    }

    return this.formatResponse(result);
  }

  /**
   * Format single record response
   */
  static formatRecordResponse(record: any): string {
    return this.formatResponse(record);
  }

  /**
   * Format metadata response
   */
  static formatMetadata(metadata: string): string {
    // For XML metadata, we can add formatting hints
    return metadata;
  }

  /**
   * Format service document
   */
  static formatServiceDocument(serviceDoc: any): string {
    return this.formatResponse(serviceDoc);
  }

  /**
   * Format error for MCP tool
   */
  static formatError(error: Error): string {
    return `Error: ${error.message}`;
  }

  /**
   * Parse OData $metadata XML to extract table information
   */
  static parseMetadataForTables(metadataXml: string): string[] {
    const tables: string[] = [];
    
    // Simple regex to extract EntitySet names from metadata
    const entitySetRegex = /<EntitySet\s+Name="([^"]+)"/g;
    let match;
    
    while ((match = entitySetRegex.exec(metadataXml)) !== null) {
      tables.push(match[1]);
    }
    
    return tables;
  }

  /**
   * Parse OData $metadata XML to extract field information for a table
   */
  static parseMetadataForFields(
    metadataXml: string,
    tableName: string
  ): FieldInfo[] {
    const fields: FieldInfo[] = [];

    // Escape regex metacharacters in the table name to avoid injection and
    // accidental matches (FileMaker permits '.', '+', '(', etc. in names).
    const safeTableName = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Find the EntityType definition for this table
    const entityTypeRegex = new RegExp(
      `<EntityType\\s+Name="${safeTableName}"[^>]*>([\\s\\S]*?)</EntityType>`,
      "i"
    );
    const entityTypeMatch = metadataXml.match(entityTypeRegex);
    
    if (entityTypeMatch) {
      const entityTypeContent = entityTypeMatch[1];
      
      // Extract properties
      const propertyRegex = /<Property\s+Name="([^"]+)"\s+Type="([^"]+)"([^>]*?)\/>/g;
      let match;
      
      while ((match = propertyRegex.exec(entityTypeContent)) !== null) {
        const name = match[1];
        const type = match[2];
        const attributes = match[3];
        
        const nullable = !attributes.includes('Nullable="false"');
        const maxLength = attributes.match(/MaxLength="(\d+)"/)?.[1];
        
        fields.push({
          name,
          type,
          nullable,
          maxLength: maxLength ? parseInt(maxLength) : undefined,
        });
      }
    }
    
    return fields;
  }

  /**
   * Create a summary of query results
   *
   * Tolerates collection (`{ value: [...] }`) and single-entity response shapes.
   * See formatQueryResponse for context.
   */
  static createQuerySummary(response: ODataResponse): string {
    const r = response as any;
    const count = r?.["@odata.count"];
    const recordsReturned: number = Array.isArray(r?.value)
      ? r.value.length
      : (r && typeof r === "object" && !("value" in r))
      ? 1
      : 0;

    let summary = `Returned ${recordsReturned} record(s)`;

    if (count !== undefined && count !== recordsReturned) {
      summary += ` (${count} total matching records)`;
    }

    return summary;
  }

  /**
   * Extract field names from a record
   */
  static extractFieldNames(record: any): string[] {
    return Object.keys(record).filter(
      (key) => !key.startsWith("@odata")
    );
  }

  /**
   * Build an OData $apply expression for server-side aggregation.
   *
   * Supported aggregation methods (per OData 4.01 / FileMaker Server 2025):
   *   sum, average, min, max, countdistinct
   * Special method "count" emits `$count as <alias>` (no source field).
   *
   * Examples:
   *   // Count all records
   *   buildApplyExpression()
   *   // → "aggregate($count as Total)"
   *
   *   // Sum a field
   *   buildApplyExpression({ field: 'Amount', method: 'sum', alias: 'TotalAmount' })
   *   // → "aggregate(Amount with sum as TotalAmount)"
   *
   *   // Group + aggregate
   *   buildApplyExpression(
   *     { field: 'Sales', method: 'sum', alias: 'TotalSales' },
   *     ['Region']
   *   )
   *   // → "groupby((Region),aggregate(Sales with sum as TotalSales))"
   *
   *   // Group + aggregate + pre-filter
   *   buildApplyExpression(
   *     { field: 'Revenue', method: 'sum', alias: 'Total' },
   *     ['Region'],
   *     "Status eq 'Active'"
   *   )
   *   // → "filter(Status eq 'Active')/groupby((Region),aggregate(Revenue with sum as Total))"
   */
  static buildApplyExpression(
    aggregation?: { field?: string; method: string; alias: string },
    groupBy?: string[],
    filter?: string
  ): string {
    // Build aggregate clause
    let aggregateClause = "";
    if (aggregation) {
      if (aggregation.method === "count") {
        aggregateClause = `aggregate($count as ${aggregation.alias})`;
      } else {
        const field = aggregation.field ?? aggregation.alias;
        aggregateClause = `aggregate(${field} with ${aggregation.method} as ${aggregation.alias})`;
      }
    } else {
      aggregateClause = "aggregate($count as Total)";
    }

    // Wrap in groupby if groupBy fields are provided
    let expression: string;
    if (groupBy && groupBy.length > 0) {
      const groupFields = groupBy.join(",");
      expression = `groupby((${groupFields}),${aggregateClause})`;
    } else {
      expression = aggregateClause;
    }

    // Prepend filter transformation if provided
    if (filter) {
      expression = `filter(${filter})/${expression}`;
    }

    return expression;
  }

  /**
   * Format batch operation results
   */
  static formatBatchResults(results: BatchResult[]): string {
    const summary = {
      total: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results: results,
    };
    
    return this.formatResponse(summary);
  }
}

export interface FieldInfo {
  name: string;
  type: string;
  nullable: boolean;
  maxLength?: number;
}

export interface BatchResult {
  success: boolean;
  status: number;
  data?: any;
  error?: string;
}
