import { connectionManager } from "../connection.js";
import { ODataParser } from "../odata-parser.js";
import { logger } from "../logger.js";
import { featureWarning, isFeatureSupported } from "../fm-version.js";

/**
 * Shared property definition for the optional per-call connection targeting param.
 * Added to every OData tool that requires an active session.
 */
const connectionParam = {
  connection: {
    type: "string",
    description:
      "Optional session alias to use for this call. " +
      "When omitted the currently active session is used. " +
      "Use fm_odata_list_active_sessions to see available aliases.",
  },
};

/**
 * OData Tool Definitions
 */
export const odataTools = [
  // Metadata Tools
  {
    name: "fm_odata_get_service_document",
    description: "Get the OData service document listing all available tables/entity sets in the database",
    inputSchema: {
      type: "object",
      properties: { ...connectionParam },
      required: [],
    },
  },
  {
    name: "fm_odata_get_metadata",
    description: "Get the OData metadata document (EDMX/XML) describing the database schema, tables, and fields",
    inputSchema: {
      type: "object",
      properties: { ...connectionParam },
      required: [],
    },
  },
  {
    name: "fm_odata_list_tables",
    description:
      "List all tables/entity sets available in the database (parsed from metadata). " +
      "On FileMaker Server 2026 (v26+) set includeDetails to true to also receive " +
      "table comments when they are present in the metadata. " +
      "Call fm_odata_get_server_version first to know whether includeDetails will have any effect.",
    inputSchema: {
      type: "object",
      properties: {
        includeDetails: {
          type: "boolean",
          description:
            "When true and the server is v26+, returns table names with their comments. " +
            "Defaults to false for backwards compatibility.",
        },
        ...connectionParam,
      },
      required: [],
    },
  },

  // Query Tools
  {
    name: "fm_odata_query_records",
    description: "Query records from a table with OData filter expressions and query options",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Table/entity set name (e.g., 'contact', 'address')",
        },
        filter: {
          type: "string",
          description: "OData $filter expression (e.g., \"FirstName eq 'John'\" or \"Age gt 25\")",
        },
        select: {
          type: "string",
          description: "Comma-separated list of fields to return (e.g., 'FirstName,LastName,Email')",
        },
        orderby: {
          type: "string",
          description: "OData $orderby expression (e.g., 'LastName asc' or 'Age desc')",
        },
        top: {
          type: "number",
          description: "Maximum number of records to return (pagination)",
        },
        skip: {
          type: "number",
          description: "Number of records to skip (pagination)",
        },
        expand: {
          type: "string",
          description: "Related records to expand (navigation properties)",
        },
        count: {
          type: "boolean",
          description: "Include total count of matching records",
        },
        ...connectionParam,
      },
      required: ["table"],
    },
  },
  {
    name: "fm_odata_get_record",
    description: "Get a single record by its ID",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Table/entity set name",
        },
        recordId: {
          type: "string",
          description: "Record ID",
        },
        select: {
          type: "string",
          description: "Comma-separated list of fields to return",
        },
        expand: {
          type: "string",
          description: "Related records to expand",
        },
        ...connectionParam,
      },
      required: ["table", "recordId"],
    },
  },
  {
    name: "fm_odata_get_records",
    description: "Get records from a table (simple query without filters)",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Table/entity set name",
        },
        top: {
          type: "number",
          description: "Maximum number of records to return",
        },
        skip: {
          type: "number",
          description: "Number of records to skip",
        },
        ...connectionParam,
      },
      required: ["table"],
    },
  },
  {
    name: "fm_odata_count_records",
    description: "Count records in a table, optionally with a filter",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Table/entity set name",
        },
        filter: {
          type: "string",
          description: "OData $filter expression",
        },
        ...connectionParam,
      },
      required: ["table"],
    },
  },

  // Type Cast Tool (FileMaker Server v21.1+ / FileMaker 2024+)
  // Connection-free: builds expressions locally, no session needed.
  {
    name: "fm_odata_cast",
    description:
      "Build OData type-cast property path expressions (requires FileMaker Server v21.1 / FileMaker 2024 or later). " +
      "Returns the cast expression(s) ready to use in $select or $filter of fm_odata_query_records. " +
      "Casting tells the server to return a field value in a specific EDM primitive type, " +
      "avoiding the need for client-side conversion. " +
      "Call fm_odata_get_server_version first to verify your server supports this feature. " +
      "Example: cast 'StartDate' to Int64 for numeric date math, or 'Amount' to String for text comparison.",
    inputSchema: {
      type: "object",
      properties: {
        fields: {
          type: "array",
          description: "One or more fields to cast, each with a field name and target EDM type.",
          items: {
            type: "object",
            properties: {
              field: {
                type: "string",
                description: "Field name to cast (e.g. 'StartDate', 'Amount')",
              },
              type: {
                type: "string",
                enum: [
                  "String",
                  "Int32",
                  "Int64",
                  "Decimal",
                  "Double",
                  "Boolean",
                  "Date",
                  "TimeOfDay",
                  "DateTimeOffset",
                ],
                description: "Target EDM primitive type (e.g. 'Int64', 'String', 'Date')",
              },
            },
            required: ["field", "type"],
          },
          minItems: 1,
        },
        context: {
          type: "string",
          enum: ["select", "filter"],
          description:
            "Where the cast expression will be used. " +
            "'select' joins multiple casts with commas for use in $select. " +
            "'filter' returns individual cast paths to embed in a $filter expression. " +
            "Defaults to 'select'.",
        },
      },
      required: ["fields"],
    },
  },

  // Parameterized Filter Builder (FileMaker Server v21.1+ / FileMaker 2024+)
  // Connection-free: builds expressions locally, no session needed.
  {
    name: "fm_odata_build_filter",
    description:
      "Build a parameterized OData $filter expression (requires FileMaker Server v21.1 / FileMaker 2024 or later). " +
      "Write a filter template with @alias placeholders and supply values separately. " +
      "In 'resolved' mode (default) the aliases are substituted client-side and the result " +
      "can be used directly as the 'filter' argument of fm_odata_query_records. " +
      "In 'raw' mode the OData parameter alias query string is returned instead, " +
      "useful for constructing URLs manually. " +
      "String values are automatically single-quoted; numbers/booleans are passed through as-is. " +
      "Call fm_odata_get_server_version first to verify your server supports this feature. " +
      "Example: template 'Title eq @title and Status eq @status', " +
      "params { '@title': 'Wizard of Oz', '@status': 'Active' }.",
    inputSchema: {
      type: "object",
      properties: {
        template: {
          type: "string",
          description:
            "OData $filter template using @alias placeholders for values. " +
            "Example: \"Title eq @title and Age gt @minAge\"",
        },
        params: {
          type: "object",
          description:
            "Map of alias names (starting with @) to their values. " +
            "String values are auto-quoted; numbers and booleans are used as-is. " +
            "Example: { \"@title\": \"Wizard of Oz\", \"@minAge\": 18 }",
          additionalProperties: {
            oneOf: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" },
              { type: "null" },
            ],
          },
        },
        mode: {
          type: "string",
          enum: ["resolved", "raw"],
          description:
            "'resolved' (default): substitutes alias values into the template and returns a plain filter string. " +
            "'raw': returns the OData parameterized query string form with aliases kept separate.",
        },
      },
      required: ["template", "params"],
    },
  },

  // Aggregation Tool (FileMaker Server v22.0.1+ / FileMaker 2025+)
  {
    name: "fm_odata_aggregate",
    description:
      "Aggregate records server-side using OData $apply (requires FileMaker Server v22.0.1 / FileMaker 2025 or later). " +
      "Groups records by one or more fields and computes sum, average, min, max, or count. " +
      "Returns only the summary rows — no need to fetch all records and compute client-side. " +
      "Call fm_odata_get_server_version first to verify your server supports this feature; " +
      "on older servers the tool falls back to client-side computation. " +
      "Example: sum of invoice amounts grouped by customer, or count of open cases per user.",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Table/entity set name",
        },
        method: {
          type: "string",
          enum: ["sum", "average", "min", "max", "countdistinct", "count"],
          description:
            "Aggregation function. Use 'count' to count all matching records (no field needed). " +
            "Use 'countdistinct' to count unique values of a field.",
        },
        alias: {
          type: "string",
          description: "Name for the result column (e.g. 'TotalSales', 'AvgAge', 'Total')",
        },
        field: {
          type: "string",
          description:
            "Field to aggregate. Required for sum/average/min/max/countdistinct. " +
            "Omit when method is 'count'.",
        },
        groupBy: {
          type: "array",
          items: { type: "string" },
          description:
            "Fields to group by (e.g. ['Region', 'Status']). " +
            "Omit to aggregate across the whole table.",
        },
        filter: {
          type: "string",
          description:
            "OData $filter expression applied before aggregation (e.g. \"Status eq 'Active'\"). " +
            "Equivalent to a WHERE clause.",
        },
        ...connectionParam,
      },
      required: ["table", "method", "alias"],
    },
  },

  // CRUD Tools
  {
    name: "fm_odata_create_record",
    description: "Create a new record in a table",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Table/entity set name",
        },
        data: {
          type: "object",
          description: "Field values for the new record (JSON object with field names as keys)",
        },
        ...connectionParam,
      },
      required: ["table", "data"],
    },
  },
  {
    name: "fm_odata_update_record",
    description: "Update an existing record",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Table/entity set name",
        },
        recordId: {
          type: "string",
          description: "Record ID to update",
        },
        data: {
          type: "object",
          description: "Field values to update (JSON object with field names as keys)",
        },
        ...connectionParam,
      },
      required: ["table", "recordId", "data"],
    },
  },
  {
    name: "fm_odata_delete_record",
    description: "Delete a record",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Table/entity set name",
        },
        recordId: {
          type: "string",
          description: "Record ID to delete",
        },
        ...connectionParam,
      },
      required: ["table", "recordId"],
    },
  },
];

/**
 * Resolve the OData client for a tool call.
 *
 * When args.connection is provided the named session is looked up directly
 * (side-effect-free — does NOT change the active session pointer).
 * Otherwise the currently active session is used.
 */
function resolveClient(args: any) {
  if (args?.connection) {
    const named = connectionManager.getClientByName(args.connection);
    if (!named) {
      return {
        client: null,
        error: `Session "${args.connection}" not found. Use fm_odata_list_active_sessions to see available aliases.`,
      };
    }
    return { client: named, error: null };
  }
  const current = connectionManager.getCurrentClient();
  return {
    client: current,
    error: current
      ? null
      : "No active connection. Please set a connection first using fm_odata_set_connection or fm_odata_connect.",
  };
}

/**
 * OData Tool Handlers
 */
export async function handleODataTool(name: string, args: any): Promise<any> {
  try {
    // Connection-free tools — advisory version notice when a client is available
    if (name === "fm_odata_cast") {
      return await handleCast(args);
    }
    if (name === "fm_odata_build_filter") {
      return await handleBuildFilter(args);
    }

    const { client, error } = resolveClient(args);
    if (!client) {
      return {
        content: [{ type: "text", text: error! }],
        isError: true,
      };
    }

    logger.debug(`Handling OData tool: ${name}`, args);

    switch (name) {
      // Metadata Tools
      case "fm_odata_get_service_document":
        return await handleGetServiceDocument(client);

      case "fm_odata_get_metadata":
        return await handleGetMetadata(client);

      case "fm_odata_list_tables":
        return await handleListTables(client, args);

      // Query Tools
      case "fm_odata_query_records":
        return await handleQueryRecords(client, args);

      case "fm_odata_get_record":
        return await handleGetRecord(client, args);

      case "fm_odata_get_records":
        return await handleGetRecords(client, args);

      case "fm_odata_count_records":
        return await handleCountRecords(client, args);

      case "fm_odata_aggregate":
        return await handleAggregate(client, args);

      // CRUD Tools
      case "fm_odata_create_record":
        return await handleCreateRecord(client, args);

      case "fm_odata_update_record":
        return await handleUpdateRecord(client, args);

      case "fm_odata_delete_record":
        return await handleDeleteRecord(client, args);

      default:
        return {
          content: [{ type: "text", text: `Unknown OData tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error: any) {
    logger.error(`Error in ${name}:`, error);
    return {
      content: [{ type: "text", text: ODataParser.formatError(error) }],
      isError: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Metadata Tool Handlers
// ---------------------------------------------------------------------------

async function handleGetServiceDocument(client: any) {
  const serviceDoc = await client.getServiceDocument();
  return {
    content: [{ type: "text", text: ODataParser.formatServiceDocument(serviceDoc) }],
  };
}

async function handleGetMetadata(client: any) {
  const metadata = await client.getMetadata();
  return {
    content: [{ type: "text", text: metadata }],
  };
}

async function handleListTables(client: any, args: any) {
  const metadata = await client.getMetadata();
  const version = await client.getServerVersion();
  const tables = ODataParser.parseMetadataForTables(metadata, version ?? undefined);

  const includeDetails = args?.includeDetails === true;
  const lines = tables.map((t: { name: string; comment?: string }) => {
    if (includeDetails && t.comment) {
      return `${t.name} — ${t.comment}`;
    }
    return t.name;
  });

  return {
    content: [{ type: "text", text: `Available tables:\n${lines.join("\n")}` }],
  };
}

// ---------------------------------------------------------------------------
// Query Tool Handlers
// ---------------------------------------------------------------------------

async function handleQueryRecords(client: any, args: any) {
  const response = await client.queryRecords(args.table, {
    filter: args.filter,
    select: args.select,
    orderby: args.orderby,
    top: args.top,
    skip: args.skip,
    expand: args.expand,
    count: args.count,
  });

  const summary = ODataParser.createQuerySummary(response);
  const formatted = ODataParser.formatQueryResponse(response);

  return {
    content: [{ type: "text", text: `${summary}\n\n${formatted}` }],
  };
}

async function handleGetRecord(client: any, args: any) {
  const record = await client.getRecord(args.table, args.recordId, {
    select: args.select,
    expand: args.expand,
  });

  return {
    content: [{ type: "text", text: ODataParser.formatRecordResponse(record) }],
  };
}

async function handleGetRecords(client: any, args: any) {
  const response = await client.queryRecords(args.table, {
    top: args.top,
    skip: args.skip,
  });

  const summary = ODataParser.createQuerySummary(response);
  const formatted = ODataParser.formatQueryResponse(response);

  return {
    content: [{ type: "text", text: `${summary}\n\n${formatted}` }],
  };
}

async function handleCountRecords(client: any, args: any) {
  const count = await client.countRecords(args.table, args.filter);
  return {
    content: [{ type: "text", text: `Total records in ${args.table}: ${count}` }],
  };
}

// ---------------------------------------------------------------------------
// Connection-free expression builders
// ---------------------------------------------------------------------------

/**
 * Attempt to fetch a version advisory for a connection-free tool.
 * Never throws — if no active client is available the notice is skipped.
 */
async function getAdvisoryNotice(args: any, feature: string): Promise<string | null> {
  try {
    const { client } = resolveClient(args);
    if (!client) return null;
    const version = await client.getServerVersion();
    return featureWarning(version, feature);
  } catch {
    return null;
  }
}

async function handleBuildFilter(args: any) {
  const { template, params, mode = "resolved" } = args;

  // Validate: all param keys must start with @
  const badKeys = Object.keys(params).filter((k: string) => !k.startsWith("@"));
  if (badKeys.length > 0) {
    return {
      content: [
        {
          type: "text",
          text: `Error: parameter alias names must start with '@'. Invalid: ${badKeys.join(", ")}`,
        },
      ],
      isError: true,
    };
  }

  // Advisory version notice (best-effort — never blocks the expression)
  const advisory = await getAdvisoryNotice(args, "build_filter");

  const result = ODataParser.buildParameterizedFilter(template, params, mode);

  const body =
    typeof result === "string"
      ? JSON.stringify({ filter: result }, null, 2)
      : JSON.stringify(result, null, 2);

  return {
    content: [
      {
        type: "text",
        text: advisory ? `${advisory}\n\n${body}` : body,
      },
    ],
  };
}

async function handleCast(args: any) {
  const { fields, context = "select" } = args;

  // Advisory version notice (best-effort — never blocks the expression)
  const advisory = await getAdvisoryNotice(args, "cast");

  const castExpressions: string[] = (fields as Array<{ field: string; type: string }>).map(
    ({ field, type }) => ODataParser.buildCastExpression(field, type)
  );

  let result: string;
  let usage: string;

  if (context === "filter") {
    result = castExpressions.join("\n");
    usage =
      "Use each cast path inside a $filter expression, e.g.:\n" +
      castExpressions.map((e) => `  $filter=${e} eq <value>`).join("\n");
  } else {
    result = castExpressions.join(",");
    usage = `Use as: $select=${result}`;
  }

  const body = JSON.stringify({ castExpression: result, usage }, null, 2);

  return {
    content: [
      {
        type: "text",
        text: advisory ? `${advisory}\n\n${body}` : body,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

async function handleAggregate(client: any, args: any) {
  const { table, method, alias, field, groupBy, filter } = args;

  if (method !== "count" && !field) {
    return {
      content: [{ type: "text", text: `Error: 'field' is required when method is '${method}'.` }],
      isError: true,
    };
  }

  // Version check — fall back to client-side computation when $apply unsupported
  const version = await client.getServerVersion();
  const supported = isFeatureSupported(version, "aggregate");
  const warning = featureWarning(version, "aggregate");

  if (supported) {
    const applyExpression = ODataParser.buildApplyExpression(
      { method, alias, field },
      groupBy,
      filter
    );
    logger.debug(`Aggregating ${table} with $apply=${applyExpression}`);
    const response = await client.aggregateRecords(table, applyExpression);
    return {
      content: [{ type: "text", text: ODataParser.formatResponse(response) }],
    };
  }

  // Client-side fallback: fetch up to 10 000 records and compute locally
  const CAP = 10_000;
  logger.debug(`Aggregate fallback: fetching up to ${CAP} records from ${table}`);
  const fetchResponse = await client.queryRecords(table, {
    filter: filter ?? undefined,
    top: CAP,
  });
  const records: Record<string, any>[] = fetchResponse.value ?? [];
  const recordCount = records.length;

  const result = computeClientSideAggregate(records, method, field, alias, groupBy);
  const versionStr = version ? `FM Server ${version.raw}` : "FM Server (unknown version)";
  const notice =
    `[Compatibility] ${versionStr} does not support $apply. ` +
    `Result computed client-side from ${recordCount} record${recordCount !== 1 ? "s" : ""} (cap: ${CAP}).` +
    (warning ? ` ${warning}` : "");

  return {
    content: [
      {
        type: "text",
        text: `${notice}\n\n${JSON.stringify({ "@odata.context": `client-side`, value: result }, null, 2)}`,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Client-side aggregate helpers
// ---------------------------------------------------------------------------

/**
 * Compute an aggregation locally over an array of records.
 * Supports groupBy (returns one row per group) or ungrouped (single row).
 */
function computeClientSideAggregate(
  records: Record<string, any>[],
  method: string,
  field: string | undefined,
  alias: string | undefined,
  groupBy: string | undefined
): Record<string, any>[] {
  const outputAlias = alias ?? (field ? `${method}_${field}` : method);

  if (groupBy) {
    const groups = new Map<string, Record<string, any>[]>();
    for (const rec of records) {
      const key = String(rec[groupBy] ?? "");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(rec);
    }
    const rows: Record<string, any>[] = [];
    for (const [groupValue, groupRecords] of groups) {
      rows.push({
        [groupBy]: groupValue,
        [outputAlias]: aggregateValue(groupRecords, method, field),
      });
    }
    return rows;
  }

  return [{ [outputAlias]: aggregateValue(records, method, field) }];
}

function aggregateValue(
  records: Record<string, any>[],
  method: string,
  field: string | undefined
): number | null {
  const m = method.toLowerCase();

  if (m === "count") return records.length;
  if (!field) return null;

  // countdistinct works on any value type — handle before numeric filter
  if (m === "countdistinct") return new Set(records.map((r) => r[field])).size;

  const nums = records
    .map((r) => {
      const v = r[field];
      return v !== null && v !== undefined && !isNaN(Number(v)) ? Number(v) : null;
    })
    .filter((v): v is number => v !== null);

  if (nums.length === 0) return null;

  switch (m) {
    case "sum":     return nums.reduce((a, b) => a + b, 0);
    case "average": return nums.reduce((a, b) => a + b, 0) / nums.length;
    case "min":     return Math.min(...nums);
    case "max":     return Math.max(...nums);
    default:        return null;
  }
}

// ---------------------------------------------------------------------------
// CRUD Tool Handlers
// ---------------------------------------------------------------------------

async function handleCreateRecord(client: any, args: any) {
  const newRecord = await client.createRecord(args.table, args.data);
  return {
    content: [
      {
        type: "text",
        text: `Record created successfully:\n${ODataParser.formatRecordResponse(newRecord)}`,
      },
    ],
  };
}

async function handleUpdateRecord(client: any, args: any) {
  await client.updateRecord(args.table, args.recordId, args.data);
  return {
    content: [
      {
        type: "text",
        text: `Record ${args.recordId} in ${args.table} updated successfully.`,
      },
    ],
  };
}

async function handleDeleteRecord(client: any, args: any) {
  await client.deleteRecord(args.table, args.recordId);
  return {
    content: [
      {
        type: "text",
        text: `Record ${args.recordId} deleted from ${args.table} successfully.`,
      },
    ],
  };
}
