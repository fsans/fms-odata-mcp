import {
  addConnection,
  removeConnection,
  listConnections,
  getConnection,
  setDefaultConnection,
  getDefaultConnectionName,
} from "../config.js";
import { logger } from "../logger.js";

/**
 * Configuration Tool Definitions
 */
export const configurationTools = [
  {
    name: "fm_odata_config_add_connection",
    description: "Add a new connection configuration (saved permanently)",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Connection name (e.g., 'production', 'staging', 'local')",
        },
        server: {
          type: "string",
          description: "FileMaker Server URL (e.g., 'http://192.168.0.24')",
        },
        database: {
          type: "string",
          description: "Database name",
        },
        user: {
          type: "string",
          description: "Username",
        },
        password: {
          type: "string",
          description: "Password",
        },
        verifySsl: {
          type: "boolean",
          description: "Verify SSL certificate (default: true)",
        },
      },
      required: ["name", "server", "database", "user", "password"],
    },
  },
  {
    name: "fm_odata_config_remove_connection",
    description: "Remove a saved connection configuration",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Connection name to remove",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "fm_odata_config_list_connections",
    description: "List all saved connection configurations (passwords masked)",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "fm_odata_config_get_connection",
    description: "Get details of a specific saved connection (password masked)",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Connection name",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "fm_odata_config_set_default_connection",
    description: "Set the default connection to use",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Connection name to set as default",
        },
      },
      required: ["name"],
    },
  },
];

/**
 * Configuration Tool Handlers
 */
export async function handleConfigurationTool(name: string, args: any): Promise<any> {
  try {
    logger.debug(`Handling configuration tool: ${name}`, args);

    switch (name) {
      case "fm_odata_config_add_connection":
        return await handleAddConnection(args);

      case "fm_odata_config_remove_connection":
        return await handleRemoveConnection(args);

      case "fm_odata_config_list_connections":
        return await handleListConnections();

      case "fm_odata_config_get_connection":
        return await handleGetConnection(args);

      case "fm_odata_config_set_default_connection":
        return await handleSetDefaultConnection(args);

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown configuration tool: ${name}`,
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
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

// Configuration Tool Handlers
async function handleAddConnection(args: any) {
  addConnection(args.name, {
    server: args.server,
    database: args.database,
    user: args.user,
    password: args.password,
    verifySsl: args.verifySsl !== undefined ? args.verifySsl : true,
  });

  return {
    content: [
      {
        type: "text",
        text: `Connection "${args.name}" added successfully.\nServer: ${args.server}\nDatabase: ${args.database}\nUser: ${args.user}\nSSL Verification: ${args.verifySsl !== undefined ? args.verifySsl : true}`,
      },
    ],
  };
}

async function handleRemoveConnection(args: any) {
  removeConnection(args.name);

  return {
    content: [
      {
        type: "text",
        text: `Connection "${args.name}" removed successfully.`,
      },
    ],
  };
}

async function handleListConnections() {
  const connections = listConnections();

  if (connections.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: "No saved connections found. Use fm_odata_config_add_connection to add a connection.",
        },
      ],
    };
  }

  const defaultName = getDefaultConnectionName();
  const list = connections
    .map((conn) => {
      const isDefault = conn.name === defaultName ? " (default)" : "";
      const sslStatus = conn.verifySsl !== false ? "SSL:✓" : "SSL:✗";
      return `- ${conn.name}${isDefault}: ${conn.server}/${conn.database} (user: ${conn.user}) [${sslStatus}]`;
    })
    .join("\n");

  return {
    content: [
      {
        type: "text",
        text: `Saved connections:\n${list}`,
      },
    ],
  };
}

async function handleGetConnection(args: any) {
  const connection = getConnection(args.name);

  if (!connection) {
    return {
      content: [
        {
          type: "text",
          text: `Connection "${args.name}" not found.`,
        },
      ],
      isError: true,
    };
  }

  const isDefault = connection.name === getDefaultConnectionName() ? " (default)" : "";

  return {
    content: [
      {
        type: "text",
        text: `Connection: ${connection.name}${isDefault}\nServer: ${connection.server}\nDatabase: ${connection.database}\nUser: ${connection.user}\nPassword: ******\nSSL Verification: ${connection.verifySsl !== false ? true : false}`,
      },
    ],
  };
}

async function handleSetDefaultConnection(args: any) {
  setDefaultConnection(args.name);

  return {
    content: [
      {
        type: "text",
        text: `Default connection set to: ${args.name}`,
      },
    ],
  };
}
