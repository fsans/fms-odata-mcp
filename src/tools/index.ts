import { odataTools, handleODataTool } from "./odata.js";
import { connectionTools, handleConnectionTool } from "./connection.js";
import { configurationTools, handleConfigurationTool } from "./configuration.js";

/**
 * All tool definitions
 */
export const allTools = [
  ...odataTools,
  ...connectionTools,
  ...configurationTools,
];

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
