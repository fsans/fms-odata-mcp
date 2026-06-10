import { ODataResponse } from "./odata-client.js";
import { FMServerVersion, isFeatureSupported } from "./fm-version.js";

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
   * Parse OData $metadata XML to extract table information.
   *
   * When `serverVersion` is v26+ (FileMaker 2026), table comments are also
   * extracted from annotation elements. On older or unknown servers comments
   * are omitted to avoid false positives.
   */
  static parseMetadataForTables(
    metadataXml: string,
    serverVersion?: FMServerVersion
  ): TableInfo[] {
    const enriched = !!serverVersion && isFeatureSupported(serverVersion, "metadata_comments");
    const tables: TableInfo[] = [];

    const entitySetRegex = /<EntitySet\s+Name="([^"]+)"([^>]*)>/g;
    let match;

    while ((match = entitySetRegex.exec(metadataXml)) !== null) {
      const name = match[1];
      const tagBody = match[2];
      const entry: TableInfo = { name };

      if (enriched) {
        // Attempt to extract comment from the EntitySet tag or a trailing Annotation
        const commentMatch = tagBody.match(/Description="([^"]*)"/);
        if (commentMatch) {
          entry.comment = commentMatch[1];
        }
      }

      tables.push(entry);
    }

    return tables;
  }

  /**
   * Parse OData $metadata XML to extract field information for a table.
   *
   * When `serverVersion` is v26+ (FileMaker 2026), field comments and AI
   * annotations are also extracted from annotation elements inside the
   * EntityType definition. On older or unknown servers these fields are
   * omitted.
   */
  static parseMetadataForFields(
    metadataXml: string,
    tableName: string,
    serverVersion?: FMServerVersion
  ): FieldInfo[] {
    const fields: FieldInfo[] = [];
    const enriched = !!serverVersion && isFeatureSupported(serverVersion, "metadata_comments");

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

        const field: FieldInfo = {
          name,
          type,
          nullable,
          maxLength: maxLength ? parseInt(maxLength) : undefined,
        };

        if (enriched) {
          // Look for a trailing Description Annotation for this property.
          // Use Core.V1.Description (standard OData) and exclude AI-specific terms.
          const annotationRegex = new RegExp(
            `<Annotation\\s+Term="(?:(?!AI)[^"])*Description"[^>]*>\\s*<String>([^<]*)</String>\\s*</Annotation>\\s*<Property\\s+Name="${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
            "i"
          );
          const annotationMatch = entityTypeContent.match(annotationRegex);
          if (annotationMatch) {
            field.comment = annotationMatch[1];
          }

          // AI annotation (vendor-specific term containing 'AI')
          const aiRegex = new RegExp(
            `<Annotation\\s+Term="[^"]*AI[^"]*"[^>]*>\\s*<String>([^<]*)</String>\\s*</Annotation>\\s*<Property\\s+Name="${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
            "i"
          );
          const aiMatch = entityTypeContent.match(aiRegex);
          if (aiMatch) {
            field.aiAnnotation = aiMatch[1];
          }
        }

        fields.push(field);
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
   * Build a parameterized OData $filter expression (FileMaker Server v21.1+ / FileMaker 2024+).
   *
   * OData parameter aliases let you write a filter template with @param
   * placeholders and supply values separately, improving readability and
   * allowing reuse of the same template with different values.
   *
   * FileMaker Server supports parameter aliases in $filter only (not $orderby).
   * Alias names must start with "@".
   *
   * This helper supports two output modes:
   *
   * 1. "resolved" (default) — substitutes alias values directly into the
   *    filter string, producing a plain filter expression ready for use as the
   *    `filter` argument of fm_odata_query_records.
   *
   *    buildParameterizedFilter(
   *      "Title eq @title and Status eq @status",
   *      { "@title": "'Wizard of Oz'", "@status": "'Active'" }
   *    )
   *    // → "Title eq 'Wizard of Oz' and Status eq 'Active'"
   *
   * 2. "raw" — returns both the template and the alias key=value pairs as
   *    separate query string segments, which together form the OData
   *    parameterized URL. Useful when the caller wants to construct the full
   *    URL manually.
   *
   *    buildParameterizedFilter(
   *      "Title eq @title",
   *      { "@title": "'Wizard of Oz'" },
   *      "raw"
   *    )
   *    // → {
   *    //     filter: "Title eq @title",
   *    //     params: "@title='Wizard of Oz'",
   *    //     queryString: "$filter=Title eq @title&@title='Wizard of Oz'"
   *    //   }
   *
   * Value formatting rules (applied automatically in "resolved" mode):
   *   - String values that are not already single-quoted are wrapped in '...'
   *     with internal single quotes doubled ('O''Brien').
   *   - Numeric, boolean, and null literals are passed through unchanged.
   *   - Date/time literals must be pre-formatted by the caller (ISO 8601).
   */
  static buildParameterizedFilter(
    template: string,
    params: Record<string, string | number | boolean | null>,
    mode: "resolved" | "raw" = "resolved"
  ): string | { filter: string; params: string; queryString: string } {
    if (mode === "raw") {
      const paramParts = Object.entries(params)
        .map(([k, v]) => `${k}=${ODataParser.formatParamValue(v)}`)
        .join("&");
      const queryString = `$filter=${template}&${paramParts}`;
      return { filter: template, params: paramParts, queryString };
    }

    // "resolved" mode: substitute each @alias with its formatted value
    let resolved = template;
    // Sort by descending length so "@titlePrefix" is replaced before "@title"
    const sortedKeys = Object.keys(params).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      const value = ODataParser.formatParamValue(params[key]);
      // Replace all occurrences; use word-boundary-style check (alias ends at
      // non-identifier chars or end of string) to avoid partial substitution
      resolved = resolved.replace(
        new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![A-Za-z0-9_])", "g"),
        value
      );
    }
    return resolved;
  }

  /** Format a parameter value for embedding in an OData expression. */
  private static formatParamValue(value: string | number | boolean | null): string {
    if (value === null) return "null";
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    const s = String(value);
    // Already single-quoted — pass through as-is
    if (s.startsWith("'") && s.endsWith("'")) return s;
    // Wrap in single quotes, escaping internal single quotes by doubling them
    return `'${s.replace(/'/g, "''")}'`;
  }

  /**
   * Build an OData type-cast property path segment (FileMaker Server v21.1+ / FileMaker 2024+).
   *
   * FileMaker's OData API supports explicit server-side type coercion by appending
   * "/Edm.<Type>" to a field name inside $select or $filter expressions.
   * This avoids the need for client-side conversion and ensures the server returns
   * the value in the requested primitive type.
   *
   * Supported target types (Edm primitives):
   *   String, Int32, Int64, Decimal, Double, Boolean, Date, TimeOfDay, DateTimeOffset
   *
   * Usage in $select:
   *   buildCastExpression('StartDate', 'Int64')
   *   // → "StartDate/Edm.Int64"
   *   // Use as: $select=StartDate/Edm.Int64
   *
   * Usage in $filter (cast before comparison):
   *   buildCastExpression('Amount', 'String') + " eq '100'"
   *   // → "Amount/Edm.String eq '100'"
   *   // Use as: $filter=Amount/Edm.String eq '100'
   *
   * Multiple casts in $select (join with comma):
   *   [buildCastExpression('Price','Decimal'), buildCastExpression('Name','String')].join(',')
   *   // → "Price/Edm.Decimal,Name/Edm.String"
   */
  static buildCastExpression(field: string, targetType: string): string {
    // Normalize: strip any leading "Edm." so callers can pass either "Int32" or "Edm.Int32"
    const type = targetType.startsWith("Edm.") ? targetType : `Edm.${targetType}`;
    return `${field}/${type}`;
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

export interface TableInfo {
  name: string;
  comment?: string;
}

export interface FieldInfo {
  name: string;
  type: string;
  nullable: boolean;
  maxLength?: number;
  comment?: string;
  aiAnnotation?: string;
}

export interface BatchResult {
  success: boolean;
  status: number;
  data?: any;
  error?: string;
}
