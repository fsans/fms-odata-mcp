import { connectionManager } from "../connection.js";
import { ODataParser } from "../odata-parser.js";
import { logger } from "../logger.js";

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
      properties: {},
      required: [],
    },
  },
  {
    name: "fm_odata_get_metadata",
    description: "Get the OData metadata document (EDMX/XML) describing the database schema, tables, and fields",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "fm_odata_list_tables",
    description: "List all tables/entity sets available in the database (parsed from metadata)",
    inputSchema: {
      type: "object",
      properties: {},
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
      },
      required: ["table"],
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
      },
      required: ["table", "recordId"],
    },
  },
];

/**
 * OData Tool Handlers
 */
export async function handleODataTool(name: string, args: any): Promise<any> {
  try {
    const client = connectionManager.getCurrentClient();
    if (!client) {
      return {
        content: [
          {
            type: "text",
            text: "No active connection. Please set a connection first using fm_odata_set_connection or fm_odata_connect.",
          },
        ],
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
        return await handleListTables(client);

      // Query Tools
      case "fm_odata_query_records":
        return await handleQueryRecords(client, args);

      case "fm_odata_get_record":
        return await handleGetRecord(client, args);

      case "fm_odata_get_records":
        return await handleGetRecords(client, args);

      case "fm_odata_count_records":
        return await handleCountRecords(client, args);

      // CRUD Tools
      case "fm_odata_create_record":
        return await handleCreateRecord(client, args);

      case "fm_odata_update_record":
        return await handleUpdateRecord(client, args);

      case "fm_odata_delete_record":
        return await handleDeleteRecord(client, args);

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown OData tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error: any) {
    logger.error(`Error in ${name}:`, error);
    return {
      content: [
        {
          type: "text",
          text: ODataParser.formatError(error),
        },
      ],
      isError: true,
    };
  }
}

// Metadata Tool Handlers
async function handleGetServiceDocument(client: any) {
  const serviceDoc = await client.getServiceDocument();
  return {
    content: [
      {
        type: "text",
        text: ODataParser.formatServiceDocument(serviceDoc),
      },
    ],
  };
}

async function handleGetMetadata(client: any) {
  const metadata = await client.getMetadata();
  return {
    content: [
      {
        type: "text",
        text: metadata,
      },
    ],
  };
}

async function handleListTables(client: any) {
  const metadata = await client.getMetadata();
  const tables = ODataParser.parseMetadataForTables(metadata);
  return {
    content: [
      {
        type: "text",
        text: `Available tables:\n${tables.join("\n")}`,
      },
    ],
  };
}

// Query Tool Handlers
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
    content: [
      {
        type: "text",
        text: `${summary}\n\n${formatted}`,
      },
    ],
  };
}

async function handleGetRecord(client: any, args: any) {
  const record = await client.getRecord(args.table, args.recordId, {
    select: args.select,
    expand: args.expand,
  });

  return {
    content: [
      {
        type: "text",
        text: ODataParser.formatRecordResponse(record),
      },
    ],
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
    content: [
      {
        type: "text",
        text: `${summary}\n\n${formatted}`,
      },
    ],
  };
}

async function handleCountRecords(client: any, args: any) {
  const count = await client.countRecords(args.table, args.filter);
  return {
    content: [
      {
        type: "text",
        text: `Total records in ${args.table}: ${count}`,
      },
    ],
  };
}

// CRUD Tool Handlers
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
        text: `Record ${args.recordId} in ${args.table} updated successfully`,
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
        text: `Record ${args.recordId} deleted from ${args.table}`,
      },
    ],
  };
}
