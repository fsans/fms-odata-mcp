import { connectionManager } from "../connection.js";
import { Connection } from "../config.js";
import { logger } from "../logger.js";

/**
 * Connection Tool Definitions
 */
export const connectionTools = [
  {
    name: "fm_odata_connect",
    description: "Connect to FileMaker Server with inline credentials (temporary connection, not saved)",
    inputSchema: {
      type: "object",
      properties: {
        server: {
          type: "string",
          description: "FileMaker Server URL (e.g., 'http://192.168.0.24' or 'https://fms.example.com')",
        },
        database: {
          type: "string",
          description: "Database name (e.g., 'Contacts')",
        },
        user: {
          type: "string",
          description: "Username",
        },
        password: {
          type: "string",
          description: "Password",
        },
      },
      required: ["server", "database", "user", "password"],
    },
  },
  {
    name: "fm_odata_set_connection",
    description: "Switch to a pre-configured connection by name",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Connection name (must be previously configured)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "fm_odata_list_connections",
    description: "List all configured connections (passwords masked)",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "fm_odata_get_current_connection",
    description: "Get details of the current active connection",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

/**
 * Connection Tool Handlers
 */
export async function handleConnectionTool(name: string, args: any): Promise<any> {
  try {
    logger.debug(`Handling connection tool: ${name}`, args);

    switch (name) {
      case "fm_odata_connect":
        return await handleConnect(args);

      case "fm_odata_set_connection":
        return await handleSetConnection(args);

      case "fm_odata_list_connections":
        return await handleListConnections();

      case "fm_odata_get_current_connection":
        return await handleGetCurrentConnection();

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown connection tool: ${name}`,
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

// Connection Tool Handlers
async function handleConnect(args: any) {
  const { getConfig } = await import("../config.js");
  const config = getConfig();
  
  const connection: Connection = {
    server: args.server,
    database: args.database,
    user: args.user,
    password: args.password,
  };

  const client = connectionManager.createInlineClient(
    connection, 
    config.filemaker.verifySsl, 
    config.filemaker.timeout
  );
  
  // Test the connection
  const isConnected = await client.testConnection();
  
  if (isConnected) {
    return {
      content: [
        {
          type: "text",
          text: `Connected to ${args.server}/${args.database} as ${args.user}`,
        },
      ],
    };
  } else {
    return {
      content: [
        {
          type: "text",
          text: `Failed to connect to ${args.server}/${args.database}. Please check your credentials and server URL.`,
        },
      ],
      isError: true,
    };
  }
}

async function handleSetConnection(args: any) {
  connectionManager.setCurrentConnection(args.name);
  
  // Test the connection
  const isConnected = await connectionManager.testConnection(args.name);
  
  if (isConnected) {
    return {
      content: [
        {
          type: "text",
          text: `Switched to connection: ${args.name}`,
        },
      ],
    };
  } else {
    return {
      content: [
        {
          type: "text",
          text: `Switched to connection: ${args.name} (warning: connection test failed)`,
        },
      ],
      isError: false,
    };
  }
}

async function handleListConnections() {
  const { listConnections } = await import("../config.js");
  const connections = listConnections();

  if (connections.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: "No configured connections found. Use fm_odata_config_add_connection to add a connection or fm_odata_connect for a temporary connection.",
        },
      ],
    };
  }

  const list = connections
    .map((conn) => {
      return `- ${conn.name}: ${conn.server}/${conn.database} (user: ${conn.user})`;
    })
    .join("\n");

  return {
    content: [
      {
        type: "text",
        text: `Configured connections:\n${list}`,
      },
    ],
  };
}

async function handleGetCurrentConnection() {
  const connectionName = connectionManager.getCurrentConnectionName();
  
  if (!connectionName) {
    return {
      content: [
        {
          type: "text",
          text: "No active connection. Use fm_odata_connect or fm_odata_set_connection to establish a connection.",
        },
      ],
    };
  }

  const { getConnection } = await import("../config.js");
  const connection = getConnection(connectionName);

  if (!connection) {
    return {
      content: [
        {
          type: "text",
          text: `Active connection: ${connectionName} (inline/temporary)`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Current connection: ${connection.name}\nServer: ${connection.server}\nDatabase: ${connection.database}\nUser: ${connection.user}`,
      },
    ],
  };
}
