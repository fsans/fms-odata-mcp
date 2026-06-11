import { connectionManager } from "../connection.js";
import { ODataParser } from "../odata-parser.js";
import { logger } from "../logger.js";
import { FMFieldDefinition } from "../odata-client.js";

/**
 * FileMaker OData Schema (DDL) Tools
 *
 * Wraps FileMaker's proprietary OData schema extension endpoints:
 *   FileMaker_Tables  — create tables, add fields, delete tables/fields
 *   FileMaker_Indexes — create and delete field indexes
 *
 * These tools are only registered when the environment variable
 * FM_ALLOW_SCHEMA_EDITS is set to "true" (see tools/index.ts).
 * Destructive operations (delete table / delete field) additionally
 * require an explicit confirm: true argument.
 *
 * Requires a FileMaker account with full access (schema modification)
 * privileges in the target file.
 */

/** Env flag that enables registration of the schema DDL tools. */
export function schemaEditsEnabled(): boolean {
  return process.env.FM_ALLOW_SCHEMA_EDITS === "true";
}

const connectionParam = {
  connection: {
    type: "string",
    description:
      "Optional session alias to use for this call. " +
      "When omitted the currently active session is used. " +
      "Use fm_odata_list_active_sessions to see available aliases.",
  },
};

/** JSON Schema fragment for a FileMaker field definition. */
const fieldDefinitionSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "Field name (e.g. 'Company Name')",
    },
    type: {
      type: "string",
      description:
        "SQL-style field type: NUMERIC, DECIMAL, INT, DATE, TIME, TIMESTAMP, " +
        "VARCHAR(n), CHARACTER VARYING, BLOB, VARBINARY, LONGVARBINARY, or BINARY VARYING. " +
        "Repetitions in brackets (e.g. 'INT[4]'); max text length in parentheses (e.g. 'VARCHAR(200)').",
    },
    primary: {
      type: "boolean",
      description: "Whether the field is a primary key (default false)",
    },
    unique: {
      type: "boolean",
      description: "Whether the field must have a unique value (default false)",
    },
    nullable: {
      type: "boolean",
      description: "Set to false to make the field NOT NULL (default true)",
    },
    global: {
      type: "boolean",
      description: "Whether the field is a global field (default false)",
    },
    default: {
      type: "string",
      description:
        "Default-value keyword appropriate for the data type: USER, USERNAME, CURRENT_USER, " +
        "CURRENT_DATE, CURDATE, CURRENT_TIME, CURTIME, CURRENT_TIMESTAMP, or CURTIMESTAMP.",
    },
    externalSecurePath: {
      type: "string",
      description:
        "Container (BLOB) fields only: relative path for secure external storage, " +
        "excluding the '[database location]/' portion (e.g. 'ContactMgmt/').",
    },
  },
  required: ["name", "type"],
};

/**
 * Schema (DDL) Tool Definitions
 */
export const schemaTools = [
  {
    name: "fm_odata_create_table",
    description:
      "Create a new table in the FileMaker database via the FileMaker_Tables OData schema endpoint. " +
      "Accepts a table name and an array of field definitions (SQL-style types). " +
      "Requires a FileMaker account with full access (schema modification) privileges. " +
      "Example: tableName='Company', fields=[{name:'Company ID', type:'int', primary:true}, " +
      "{name:'Company Name', type:'varchar(100)', nullable:false}].",
    inputSchema: {
      type: "object",
      properties: {
        tableName: {
          type: "string",
          description: "Name of the table to create",
        },
        fields: {
          type: "array",
          description: "Field definitions for the new table",
          items: fieldDefinitionSchema,
          minItems: 1,
        },
        ...connectionParam,
      },
      required: ["tableName", "fields"],
    },
  },
  {
    name: "fm_odata_add_fields",
    description:
      "Add one or more fields to an existing table via PATCH on the FileMaker_Tables OData schema endpoint. " +
      "If one field fails, the remaining fields can still be added. " +
      "Requires a FileMaker account with full access (schema modification) privileges. " +
      "Example: table='Company', fields=[{name:'Phone', type:'varchar(25)'}].",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Name of the existing table (or FileMaker Table ID)",
        },
        fields: {
          type: "array",
          description: "Field definitions to add to the table",
          items: fieldDefinitionSchema,
          minItems: 1,
        },
        ...connectionParam,
      },
      required: ["table", "fields"],
    },
  },
  {
    name: "fm_odata_delete_table",
    description:
      "DESTRUCTIVE: Delete a table and ALL its records from the FileMaker database, " +
      "without server-side confirmation and without undo. " +
      "Requires confirm=true to execute; without it, the tool returns a warning instead. " +
      "Requires a FileMaker account with privileges for deleting tables.",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Name of the table to delete (or FileMaker Table ID)",
        },
        confirm: {
          type: "boolean",
          description:
            "Must be true to actually delete the table. " +
            "When omitted or false the tool refuses and describes what would be deleted.",
        },
        ...connectionParam,
      },
      required: ["table"],
    },
  },
  {
    name: "fm_odata_delete_field",
    description:
      "DESTRUCTIVE: Delete a field from a table, including all its data, without undo. " +
      "Requires confirm=true to execute; without it, the tool returns a warning instead. " +
      "Requires a FileMaker account with full access (schema modification) privileges.",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Name of the table containing the field (or FileMaker Table ID)",
        },
        field: {
          type: "string",
          description: "Name of the field to delete (or FileMaker Field ID)",
        },
        confirm: {
          type: "boolean",
          description:
            "Must be true to actually delete the field. " +
            "When omitted or false the tool refuses and describes what would be deleted.",
        },
        ...connectionParam,
      },
      required: ["table", "field"],
    },
  },
  {
    name: "fm_odata_create_index",
    description:
      "Create an index on a field via the FileMaker_Indexes OData schema endpoint. " +
      "Requires a FileMaker account with full access (schema modification) privileges. " +
      "Example: table='Company', field='State'.",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Name of the table (or FileMaker Table ID)",
        },
        field: {
          type: "string",
          description: "Name of the field to index",
        },
        ...connectionParam,
      },
      required: ["table", "field"],
    },
  },
  {
    name: "fm_odata_delete_index",
    description:
      "Delete an index from a field via the FileMaker_Indexes OData schema endpoint. " +
      "Removes only the index — no record data is lost. " +
      "Requires a FileMaker account with full access (schema modification) privileges.",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Name of the table (or FileMaker Table ID)",
        },
        field: {
          type: "string",
          description: "Name of the indexed field (or FileMaker Field ID)",
        },
        ...connectionParam,
      },
      required: ["table", "field"],
    },
  },
];

/**
 * Resolve the OData client for a tool call (same semantics as tools/odata.ts).
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

function textResult(text: string, isError = false) {
  return {
    content: [{ type: "text", text }],
    ...(isError ? { isError: true } : {}),
  };
}

/**
 * Schema (DDL) Tool Handlers
 */
export async function handleSchemaTool(name: string, args: any): Promise<any> {
  try {
    const { client, error } = resolveClient(args);
    if (!client) {
      return textResult(error!, true);
    }

    logger.debug(`Handling schema tool: ${name}`, args);

    switch (name) {
      case "fm_odata_create_table": {
        const fields = args.fields as FMFieldDefinition[];
        const result = await client.createTable({
          tableName: args.tableName,
          fields,
        });
        return textResult(
          `Table "${args.tableName}" created with ${fields.length} field(s).\n` +
            (result ? JSON.stringify(result, null, 2) : "")
        );
      }

      case "fm_odata_add_fields": {
        const fields = args.fields as FMFieldDefinition[];
        const result = await client.addFields(args.table, fields);
        return textResult(
          `Added ${fields.length} field(s) to table "${args.table}": ` +
            fields.map((f) => f.name).join(", ") +
            (result ? `\n${JSON.stringify(result, null, 2)}` : "")
        );
      }

      case "fm_odata_delete_table": {
        if (args.confirm !== true) {
          return textResult(
            `REFUSED: Deleting table "${args.table}" would permanently destroy the table ` +
              `and ALL records in it, with no undo. ` +
              `If you are certain, repeat the call with confirm=true.`,
            true
          );
        }
        await client.deleteTable(args.table);
        return textResult(`Table "${args.table}" and all its records were deleted.`);
      }

      case "fm_odata_delete_field": {
        if (args.confirm !== true) {
          return textResult(
            `REFUSED: Deleting field "${args.field}" from table "${args.table}" would ` +
              `permanently destroy the field and all its data, with no undo. ` +
              `If you are certain, repeat the call with confirm=true.`,
            true
          );
        }
        await client.deleteField(args.table, args.field);
        return textResult(`Field "${args.field}" was deleted from table "${args.table}".`);
      }

      case "fm_odata_create_index": {
        await client.createIndex(args.table, args.field);
        return textResult(`Index created on "${args.table}"."${args.field}".`);
      }

      case "fm_odata_delete_index": {
        await client.deleteIndex(args.table, args.field);
        return textResult(`Index on "${args.table}"."${args.field}" was deleted.`);
      }

      default:
        return textResult(`Unknown schema tool: ${name}`, true);
    }
  } catch (error: any) {
    logger.error(`Error in ${name}:`, error);
    return textResult(ODataParser.formatError(error), true);
  }
}
