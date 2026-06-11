import { connectionManager } from "../connection.js";
import { Connection } from "../config.js";
import { logger } from "../logger.js";
import { buildFeatureReport, featureWarning, isFeatureSupported } from "../fm-version.js";

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
        verifySsl: {
          type: "boolean",
          description: "Verify SSL certificate (default: true)",
        },
      },
      required: ["server", "database", "user", "password"],
    },
  },
  {
    name: "fm_odata_connect_multi",
    description:
      "Connect to multiple FileMaker databases in a single call. " +
      "Designed for FileMaker separation-of-concerns solutions (LOGIC + DATA files) " +
      "or any setup that requires simultaneous sessions to multiple databases on the same server. " +
      "All sessions share a default server/user/password unless overridden per entry. " +
      "Each session is registered under an alias and can be targeted individually " +
      "by OData tools via their optional 'connection' parameter. " +
      "The entry marked primary (or the first successful one) becomes the active session.",
    inputSchema: {
      type: "object",
      properties: {
        server: {
          type: "string",
          description: "Shared FileMaker Server URL (e.g., 'https://fms.example.com')",
        },
        user: {
          type: "string",
          description: "Shared default username (can be overridden per database entry)",
        },
        password: {
          type: "string",
          description: "Shared default password (can be overridden per database entry)",
        },
        databases: {
          type: "array",
          description: "List of databases to connect to",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              database: {
                type: "string",
                description: "Database (file) name on the server",
              },
              alias: {
                type: "string",
                description:
                  "Human-readable session name used to target this connection later " +
                  "(e.g. 'logic', 'data'). Defaults to the database name.",
              },
              user: {
                type: "string",
                description: "Override username for this database",
              },
              password: {
                type: "string",
                description: "Override password for this database",
              },
              primary: {
                type: "boolean",
                description:
                  "Mark this session as the active connection after connecting. " +
                  "If no entry is marked, the first successful connection becomes active.",
              },
            },
            required: ["database"],
          },
        },
        verifySsl: {
          type: "boolean",
          description: "Verify SSL certificate for all connections (default: true)",
        },
      },
      required: ["server", "user", "password", "databases"],
    },
  },
  {
    name: "fm_odata_set_connection",
    description:
      "Switch the active connection by name. Accepts both saved connection names " +
      "(from fm_odata_config_add_connection) and runtime session aliases " +
      "(from fm_odata_connect or fm_odata_connect_multi).",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Connection name or session alias",
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
  {
    name: "fm_odata_list_active_sessions",
    description:
      "List all active in-memory sessions (connected via fm_odata_connect or fm_odata_connect_multi). " +
      "Shows alias, server, database, user, and which session is currently active. " +
      "Useful for multi-file FileMaker solutions to understand which connections are live " +
      "and what alias to pass in the 'connection' parameter of OData tools.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "fm_odata_describe_sessions",
    description:
      "Fetch and merge the OData schema ($metadata) from every active session. " +
      "Returns a flat list of all EntitySets (tables) across all connected databases, " +
      "each annotated with the session alias that owns it. " +
      "On FileMaker Server v26+ table and field comments / AI annotations are included. " +
      "Flags any table names that appear in more than one session (collision). " +
      "Use this to understand the full schema of a multi-file FileMaker solution " +
      "and to know which 'connection' alias to pass when querying a specific table. " +
      "Call fm_odata_get_server_version first to know whether enriched metadata (comments) will be available.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "fm_odata_get_server_version",
    description:
      "Detect the FileMaker Server version and feature capabilities for the active (or named) session. " +
      "Reads the OData $metadata document and returns the version number plus a compatibility report " +
      "showing which advanced features are supported: aggregate (v22.0.1+), cast (v21.1+), " +
      "build_filter (v21.1+), and metadata_comments (v26+). " +
      "The result is cached for the session lifetime — subsequent calls are instant. " +
      "ALWAYS call this first after connecting to understand what the server can do before using " +
      "version-gated tools such as fm_odata_aggregate, fm_odata_cast, fm_odata_build_filter, " +
      "or fm_odata_list_tables with includeDetails.",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description:
            "Optional session alias to check. When omitted the currently active session is used.",
        },
      },
      required: [],
    },
  },
];

/**
 * Redact sensitive fields before debug-logging tool arguments.
 */
function redactArgs(args: any): any {
  if (!args || typeof args !== "object") return args;
  const out: Record<string, any> = { ...args };
  if ("password" in out) out.password = "***";
  if (Array.isArray(out.databases)) {
    out.databases = out.databases.map((d: any) => ({ ...d, password: d.password ? "***" : undefined }));
  }
  return out;
}

/**
 * Connection Tool Handlers
 */
export async function handleConnectionTool(name: string, args: any): Promise<any> {
  try {
    logger.debug(`Handling connection tool: ${name}`, redactArgs(args));

    switch (name) {
      case "fm_odata_connect":
        return await handleConnect(args);

      case "fm_odata_connect_multi":
        return await handleConnectMulti(args);

      case "fm_odata_set_connection":
        return await handleSetConnection(args);

      case "fm_odata_list_connections":
        return await handleListConnections();

      case "fm_odata_get_current_connection":
        return await handleGetCurrentConnection();

      case "fm_odata_list_active_sessions":
        return handleListActiveSessions();

      case "fm_odata_describe_sessions":
        return await handleDescribeSessions();

      case "fm_odata_get_server_version":
        return await handleGetServerVersion(args);

      default:
        return {
          content: [{ type: "text", text: `Unknown connection tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error: any) {
    logger.error(`Error in ${name}:`, error);
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Individual handlers
// ---------------------------------------------------------------------------

async function handleConnect(args: any) {
  const { getConfig } = await import("../config.js");
  const config = getConfig();

  const connection: Connection = {
    server: args.server,
    database: args.database,
    user: args.user,
    password: args.password,
    verifySsl: args.verifySsl !== undefined ? args.verifySsl : config.filemaker.verifySsl,
  };

  const { client, name: clientName } = connectionManager.createInlineClientNamed(
    connection,
    connection.verifySsl,
    config.filemaker.timeout
  );

  const result = await client.testConnectionDetailed();

  if (result.ok) {
    return {
      content: [{ type: "text", text: `Connected to ${args.server}/${args.database} as ${args.user}` }],
    };
  } else {
    connectionManager.removeClient(clientName);
    return {
      content: [{ type: "text", text: `Failed to connect to ${args.server}/${args.database}: ${result.error}` }],
      isError: true,
    };
  }
}

async function handleConnectMulti(args: any) {
  const { getConfig } = await import("../config.js");
  const config = getConfig();

  const {
    server,
    user: sharedUser,
    password: sharedPassword,
    databases,
    verifySsl,
  } = args;

  const resolvedVerifySsl =
    verifySsl !== undefined ? verifySsl : config.filemaker.verifySsl;
  const timeout = config.filemaker.timeout;

  // Connect all databases in parallel
  const results = await Promise.all(
    (databases as any[]).map(async (entry) => {
      const alias: string = (entry.alias || entry.database).trim();
      const connection: Connection = {
        server,
        database: entry.database,
        user: entry.user || sharedUser,
        password: entry.password || sharedPassword,
        verifySsl: resolvedVerifySsl,
      };

      const { client, name: clientName } = connectionManager.createInlineClientNamed(
        connection,
        resolvedVerifySsl,
        timeout,
        alias
      );

      const test = await client.testConnectionDetailed();

      if (!test.ok) {
        connectionManager.removeClient(clientName);
        return { alias, database: entry.database, ok: false, error: test.error, primary: !!entry.primary };
      }

      return { alias, database: entry.database, ok: true, error: null, primary: !!entry.primary };
    })
  );

  // Set active connection: first primary that succeeded, or first successful entry
  const primaryResult = results.find((r) => r.primary && r.ok);
  const firstOk = results.find((r) => r.ok);
  const toActivate = primaryResult ?? firstOk;

  if (toActivate) {
    connectionManager.setCurrentConnection(toActivate.alias);
  }

  // Build summary
  const lines = results.map((r) => {
    const status = r.ok ? "OK" : `FAILED: ${r.error}`;
    const active = toActivate && r.alias === toActivate.alias ? " [active]" : "";
    return `  ${r.ok ? "+" : "-"} ${r.alias} (${r.database}): ${status}${active}`;
  });

  const successCount = results.filter((r) => r.ok).length;
  const summary = `Connected ${successCount}/${results.length} sessions.\n${lines.join("\n")}`;

  const hasAnyOk = successCount > 0;
  return {
    content: [{ type: "text", text: summary }],
    isError: !hasAnyOk,
  };
}

async function handleSetConnection(args: any) {
  const { getConfig, getConnection } = await import("../config.js");
  const config = getConfig();

  // Try runtime sessions first (inline / multi-connect aliases)
  try {
    connectionManager.setCurrentConnection(args.name, config.filemaker.verifySsl, config.filemaker.timeout);

    // Verify liveness — but don't fail hard if we can't (inline sessions aren't in config)
    const sessions = connectionManager.listActiveSessions();
    const session = sessions.find((s) => s.name === args.name);

    if (session) {
      return {
        content: [
          {
            type: "text",
            text: `Switched to session: ${args.name} (${session.server}/${session.database})`,
          },
        ],
      };
    }
  } catch {
    // Fall through to saved-config path
  }

  // Saved config path
  const connection = getConnection(args.name);
  if (!connection) {
    return {
      content: [
        {
          type: "text",
          text: `Connection "${args.name}" not found in active sessions or saved configuration.`,
        },
      ],
      isError: true,
    };
  }

  connectionManager.setCurrentConnection(
    args.name,
    connection.verifySsl !== undefined ? connection.verifySsl : config.filemaker.verifySsl,
    config.filemaker.timeout
  );

  const isConnected = await connectionManager.testConnection(args.name);
  return {
    content: [
      {
        type: "text",
        text: isConnected
          ? `Switched to connection: ${args.name}`
          : `Switched to connection: ${args.name} (warning: connection test failed)`,
      },
    ],
  };
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
    .map((conn) => `- ${conn.name}: ${conn.server}/${conn.database} (user: ${conn.user})`)
    .join("\n");

  return {
    content: [{ type: "text", text: `Configured connections:\n${list}` }],
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

  // Check active sessions first (covers inline / multi-connect entries)
  const sessions = connectionManager.listActiveSessions();
  const session = sessions.find((s) => s.name === connectionName);
  if (session) {
    return {
      content: [
        {
          type: "text",
          text: `Current session: ${session.name}\nServer: ${session.server}\nDatabase: ${session.database}\nUser: ${session.user}`,
        },
      ],
    };
  }

  const { getConnection } = await import("../config.js");
  const connection = getConnection(connectionName);

  if (!connection) {
    return {
      content: [{ type: "text", text: `Active connection: ${connectionName} (inline/temporary)` }],
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

function handleListActiveSessions() {
  const sessions = connectionManager.listActiveSessions();

  if (sessions.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: "No active sessions. Use fm_odata_connect or fm_odata_connect_multi to open sessions.",
        },
      ],
    };
  }

  const lines = sessions.map((s) => {
    const active = s.isCurrent ? " [active]" : "";
    const versionStr =
      s.fmVersion !== undefined
        ? ` | FM Server ${s.fmVersion ? s.fmVersion.raw : "unknown"}`
        : "";
    return `- ${s.name}${active}: ${s.server}/${s.database} (user: ${s.user})${versionStr}`;
  });

  return {
    content: [{ type: "text", text: `Active sessions (${sessions.length}):\n${lines.join("\n")}` }],
  };
}

async function handleDescribeSessions() {
  const { ODataParser } = await import("../odata-parser.js");

  const sessions = connectionManager.listActiveSessions();

  if (sessions.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: "No active sessions. Use fm_odata_connect or fm_odata_connect_multi first.",
        },
      ],
    };
  }

  // Fetch metadata from all sessions in parallel; surface per-session errors gracefully
  const sessionSchemas = await Promise.all(
    sessions.map(async (session) => {
      const client = connectionManager.getClientByName(session.name);
      if (!client) {
        return { session, tables: [], error: "Client not found in cache" };
      }
      try {
        const metadataXml = await client.getMetadata();
        const version = await client.getServerVersion();
        const enriched = !!version && isFeatureSupported(version, "metadata_comments");
        const tableInfos = ODataParser.parseMetadataForTables(metadataXml, version ?? undefined);
        const tables = tableInfos.map((tableInfo) => ({
          table: tableInfo.name,
          comment: enriched ? tableInfo.comment : undefined,
          fields: ODataParser.parseMetadataForFields(metadataXml, tableInfo.name, version ?? undefined),
        }));
        return { session, tables, enriched, error: null };
      } catch (err: any) {
        return { session, tables: [], enriched: false, error: err.message };
      }
    })
  );

  // Build flat table list annotated with connection alias
  type FieldEntry = {
    name: string;
    type: string;
    comment?: string;
    aiAnnotation?: string;
  };

  type TableEntry = {
    table: string;
    connection: string;
    fieldCount: number;
    fields: FieldEntry[];
    comment?: string;
  };

  const flatTables: TableEntry[] = [];
  const tableNameCount: Record<string, number> = {};

  for (const { session, tables, error } of sessionSchemas) {
    if (error) continue;
    for (const { table, comment, fields } of tables) {
      const entry: TableEntry = {
        table,
        connection: session.name,
        fieldCount: fields.length,
        fields: fields.map((f) => ({
          name: f.name,
          type: f.type,
          comment: f.comment,
          aiAnnotation: f.aiAnnotation,
        })),
      };
      if (comment) entry.comment = comment;
      flatTables.push(entry);
      tableNameCount[table] = (tableNameCount[table] ?? 0) + 1;
    }
  }

  // Flag collisions
  const collisions = Object.entries(tableNameCount)
    .filter(([, count]) => count > 1)
    .map(([t]) => t);

  const output: any = {
    sessions: sessionSchemas.map(({ session, tables, error }) => ({
      alias: session.name,
      server: session.server,
      database: session.database,
      user: session.user,
      isCurrent: session.isCurrent,
      tableCount: tables.length,
      error: error ?? undefined,
    })),
    tables: flatTables.map((t) => ({
      ...t,
      collision: collisions.includes(t.table),
    })),
  };

  if (collisions.length > 0) {
    output.collisions = collisions;
    output.collisionWarning =
      "The following table names appear in more than one session. " +
      "Use the 'connection' parameter on OData tools to disambiguate: " +
      collisions.join(", ");
  }

  return {
    content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
  };
}

async function handleGetServerVersion(args: any) {
  // Resolve the target session name
  let sessionName: string | undefined;
  if (args?.connection) {
    sessionName = args.connection;
  } else {
    sessionName = connectionManager.getCurrentConnectionName();
  }

  if (!sessionName) {
    return {
      content: [
        {
          type: "text",
          text: "No active connection. Use fm_odata_connect or fm_odata_set_connection first.",
        },
      ],
      isError: true,
    };
  }

  let version;
  try {
    version = await connectionManager.getServerVersion(sessionName);
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }

  // Retrieve session meta for server/database context
  const sessions = connectionManager.listActiveSessions();
  const session = sessions.find((s) => s.name === sessionName);

  const features = buildFeatureReport(version);

  // Advisory notice when version is unknown
  let notice: string | undefined;
  if (!version) {
    notice =
      "FM Server version could not be detected from $metadata. " +
      "Feature compatibility is unknown; tools will still attempt to run.";
  }

  const output: any = {
    session: sessionName,
    server: session?.server ?? "(unknown)",
    database: session?.database ?? "(unknown)",
    version: version ?? null,
    features,
  };
  if (notice) output.notice = notice;

  return {
    content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
  };
}
