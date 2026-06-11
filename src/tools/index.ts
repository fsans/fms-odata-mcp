import { odataTools, handleODataTool } from "./odata.js";
import { connectionTools, handleConnectionTool } from "./connection.js";
import { configurationTools, handleConfigurationTool } from "./configuration.js";
import { schemaTools, handleSchemaTool, schemaEditsEnabled } from "./schema.js";

/**
 * All tool definitions.
 *
 * Schema (DDL) tools are opt-in: they are only exposed when the environment
 * variable FM_ALLOW_SCHEMA_EDITS is set to "true". Evaluated lazily so the
 * env flag is honoured at request time (and testable without module reloads).
 */
export function getAllTools() {
  return [
    ...odataTools,
    ...connectionTools,
    ...configurationTools,
    ...(schemaEditsEnabled() ? schemaTools : []),
  ];
}

/** @deprecated Use getAllTools() so the FM_ALLOW_SCHEMA_EDITS flag is honoured. */
export const allTools = getAllTools();

// Build exact-name lookup sets from the tool definitions themselves.
// Using sets (rather than fragile name-prefix heuristics) ensures a tool like
// `fm_odata_list_connections` is routed to the connection handler and not
// accidentally matched by `fm_odata_list_*` prefix logic.
const odataToolNames = new Set(odataTools.map((t) => t.name));
const connectionToolNames = new Set([
  ...connectionTools.map((t) => t.name),
  // Multi-session tools registered in connectionTools but worth making explicit:
  "fm_odata_connect_multi",
  "fm_odata_list_active_sessions",
  "fm_odata_describe_sessions",
  "fm_odata_get_server_version",
]);
const configurationToolNames = new Set(configurationTools.map((t) => t.name));
const schemaToolNames = new Set(schemaTools.map((t) => t.name));

/**
 * Route tool calls to appropriate handler
 */
export async function handleToolCall(name: string, args: any): Promise<any> {
  // Connection tools (checked first because some names overlap OData prefixes,
  // e.g. fm_odata_list_connections vs fm_odata_list_tables).
  if (connectionToolNames.has(name)) {
    return await handleConnectionTool(name, args);
  }

  // Configuration tools
  if (configurationToolNames.has(name)) {
    return await handleConfigurationTool(name, args);
  }

  // OData tools
  if (odataToolNames.has(name)) {
    return await handleODataTool(name, args);
  }

  // Schema (DDL) tools — gated behind FM_ALLOW_SCHEMA_EDITS=true
  if (schemaToolNames.has(name)) {
    if (!schemaEditsEnabled()) {
      return {
        content: [
          {
            type: "text",
            text:
              `Schema editing is disabled. Set the environment variable ` +
              `FM_ALLOW_SCHEMA_EDITS=true on the MCP server to enable ${name}.`,
          },
        ],
        isError: true,
      };
    }
    return await handleSchemaTool(name, args);
  }

  // Unknown tool
  return {
    content: [
      {
        type: "text",
        text: `Unknown tool: ${name}`,
      },
    ],
    isError: true,
  };
}
